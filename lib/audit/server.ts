// lib/audit/server.ts
// Automatic, system-wide audit trail.
//
// A Prisma query extension (see lib/prisma.ts) calls `auditedWrite` for every
// write on every audited model. For each affected record it stores, in
// ActivityLog:
//   - who did it (impersonation aware), from where (IP, browser, page)
//   - what it was before, what it is now, and a field-by-field / cell-by-cell diff
//
// Logging never blocks or breaks the original query: snapshots are read with the
// raw client, the log is written in the background and every failure is swallowed.

import { AsyncLocalStorage } from "node:async_hooks";
import { Prisma } from "@prisma/client";
import { deepDiff, snapshot, type Change } from "./diff";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Models never audited: the log itself, auth/session plumbing, high-volume or private chat data. */
const EXCLUDED_MODELS = new Set([
  "ActivityLog",
  "Session",
  "Account",
  "Verification",
  "Notification",
  "Conversation",
  "ConversationParticipant",
  "ChatMessage",
  "MessageReceipt",
  "MessageReaction",
]);

/** Values are never stored — the log only records that they changed. */
const SECRET_FIELDS = new Set(["passwordHash", "password", "accessToken", "refreshToken", "idToken", "token"]);

/** Bookkeeping fields that never count as a change on their own. */
const NOISE_FIELDS = new Set(["updatedAt", "createdAt", "lastSeenAt"]);

const WRITE_OPS = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
  "delete",
  "deleteMany",
]);

/** Bulk operations: per-record logs up to this many, then one summary entry. */
const MAX_BULK_RECORDS = 100;
const MASK = "••••••";

// ---------------------------------------------------------------------------
// Schema metadata (from the generated client)
// ---------------------------------------------------------------------------

type FieldMeta = { name: string; kind: string; type: string; relationFromFields?: readonly string[] };
type ModelMeta = {
  name: string;
  idFields: string[];
  scalar: Set<string>;
  json: Set<string>;
  /** foreign-key field → related model name (e.g. assignedToId → User) */
  fkTarget: Map<string, string>;
  labelField?: string;
};

const LABEL_CANDIDATES = ["name", "title", "label", "email", "slug", "subject", "text", "message"];

const META: Map<string, ModelMeta> = (() => {
  const map = new Map<string, ModelMeta>();
  for (const m of Prisma.dmmf.datamodel.models) {
    const fields = m.fields as unknown as FieldMeta[];
    const idFields = fields.filter((f: any) => f.isId).map((f) => f.name);
    const pk = (m as any).primaryKey?.fields as string[] | undefined;
    const scalar = new Set(fields.filter((f) => f.kind !== "object").map((f) => f.name));
    const json = new Set(fields.filter((f) => f.type === "Json").map((f) => f.name));
    const fkTarget = new Map<string, string>();
    for (const f of fields) {
      if (f.kind === "object" && f.relationFromFields?.length === 1) {
        fkTarget.set(f.relationFromFields[0], f.type);
      }
    }
    map.set(m.name, {
      name: m.name,
      idFields: idFields.length ? idFields : pk ?? [],
      scalar,
      json,
      fkTarget,
      labelField: LABEL_CANDIDATES.find((c) => scalar.has(c)),
    });
  }
  return map;
})();

const delegateName = (model: string) => model.charAt(0).toLowerCase() + model.slice(1);

// ---------------------------------------------------------------------------
// Request context (actor + request info), with a re-entrancy guard
// ---------------------------------------------------------------------------

type AuditScope = { suppressed?: boolean; resolving?: boolean };
const scope = new AsyncLocalStorage<AuditScope>();

/** Run `fn` without writing audit logs (bulk jobs, migrations, seeds). */
export function withoutAudit<T>(fn: () => T): T {
  return scope.run({ suppressed: true }, fn);
}

export type AuditActor = {
  id: string | null;
  name: string | null;
  email: string | null;
  role: string | null;
  impersonatedBy: string | null;
};
export type AuditRequest = { ip: string | null; userAgent: string | null; page: string | null };

async function resolveContext(): Promise<{ actor: AuditActor | null; request: AuditRequest | null }> {
  // Auth lookups below may read (or, during sign-in, write) the DB: never audit those.
  return scope.run({ resolving: true }, async () => {
    let actor: AuditActor | null = null;
    let request: AuditRequest | null = null;
    try {
      const { headers } = await import("next/headers");
      const h = await headers();
      request = {
        ip: (h.get("x-forwarded-for") || "").split(",")[0].trim() || h.get("x-real-ip") || null,
        userAgent: h.get("user-agent"),
        page: h.get("referer"),
      };
    } catch {
      // Not inside a request (custom server, scripts, timers)
    }
    if (request) {
      try {
        const { getAuthUser } = await import("@/lib/getAuthUser");
        const u: any = await Promise.race([
          getAuthUser(),
          new Promise((r) => setTimeout(() => r(null), 2000)),
        ]);
        if (u?.id) {
          actor = {
            id: u.id,
            name: u.name ?? null,
            email: u.email ?? null,
            role: u.role ?? null,
            impersonatedBy: u.__impersonating ? u.__impersonatedBy ?? null : null,
          };
        }
      } catch {}
    }
    return { actor, request };
  });
}

// ---------------------------------------------------------------------------
// Snapshot helpers
// ---------------------------------------------------------------------------

const pickScalars = (meta: ModelMeta, row: any) => {
  if (!row || typeof row !== "object") return {};
  const out: Record<string, any> = {};
  for (const k of Object.keys(row)) if (meta.scalar.has(k)) out[k] = row[k];
  return out;
};

const numOp = (cur: any, op: string, n: number) => {
  const c = Number(cur) || 0;
  if (op === "increment") return c + n;
  if (op === "decrement") return c - n;
  if (op === "multiply") return c * n;
  if (op === "divide") return n ? c / n : c;
  return cur;
};

/** Apply a Prisma `data` payload to a snapshot (scalar fields only). */
function applyData(meta: ModelMeta, base: any, data: any) {
  const next: Record<string, any> = { ...(base ?? {}) };
  if (!data || typeof data !== "object") return next;
  for (const [k, v] of Object.entries(data)) {
    if (!meta.scalar.has(k)) continue;
    if (v === undefined) continue;
    if (!meta.json.has(k) && v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
      const op = Object.keys(v)[0];
      const val = (v as any)[op];
      if (op === "set") next[k] = val;
      else if (op === "push") next[k] = [...(Array.isArray(next[k]) ? next[k] : []), ...(Array.isArray(val) ? val : [val])];
      else next[k] = numOp(next[k], op, Number(val));
    } else {
      next[k] = v;
    }
  }
  return next;
}

const recordId = (meta: ModelMeta, row: any, fallback?: any) => {
  const src = row ?? fallback ?? {};
  const parts = meta.idFields.map((f) => src?.[f]).filter((v) => v !== undefined && v !== null);
  if (parts.length) return parts.map(String).join(":");
  const w = fallback?.id;
  return typeof w === "string" ? w : "unknown";
};

const recordLabel = (meta: ModelMeta, row: any): string | null => {
  if (!row) return null;
  if (meta.labelField && row[meta.labelField]) {
    const s = String(row[meta.labelField]).replace(/<[^>]+>/g, "").trim();
    return s.length > 80 ? `${s.slice(0, 80)}…` : s;
  }
  const first = typeof row.firstName === "string" ? `${row.firstName} ${row.lastName ?? ""}`.trim() : "";
  return first || null;
};

function maskSecrets(row: any) {
  if (!row) return row;
  const out = { ...row };
  for (const k of Object.keys(out)) if (SECRET_FIELDS.has(k) && out[k]) out[k] = MASK;
  return out;
}

function diffRecords(meta: ModelMeta, before: any, after: any): Change[] {
  const changes: Change[] = [];
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  for (const k of keys) {
    if (NOISE_FIELDS.has(k) || !meta.scalar.has(k)) continue;
    const a = before?.[k];
    const b = after?.[k];
    if (SECRET_FIELDS.has(k)) {
      if (String(a ?? "") !== String(b ?? "")) {
        changes.push({
          path: [k],
          kind: !a ? "added" : !b ? "removed" : "changed",
          ...(a ? { before: MASK } : {}),
          ...(b ? { after: `${MASK} (new value)` } : {}),
        });
      }
      continue;
    }
    const { changes: sub } = deepDiff(a ?? null, b ?? null, { maxChanges: 300 });
    for (const c of sub) changes.push({ ...c, path: [k, ...c.path] });
  }
  return changes.slice(0, 400);
}

/** Replace foreign-key ids in changes with "Name (id)" for readability. */
async function labelForeignKeys(base: any, meta: ModelMeta, changes: Change[]) {
  const wanted = new Map<string, Set<string>>();
  for (const c of changes) {
    if (c.path.length !== 1) continue;
    const target = meta.fkTarget.get(c.path[0]);
    if (!target) continue;
    for (const v of [c.before, c.after]) {
      if (typeof v === "string" && v) {
        if (!wanted.has(target)) wanted.set(target, new Set());
        wanted.get(target)!.add(v);
      }
    }
  }
  const names = new Map<string, string>();
  await Promise.all(
    Array.from(wanted.entries()).map(async ([model, ids]) => {
      const m = META.get(model);
      if (!m?.labelField || m.idFields.length !== 1) return;
      try {
        const rows = await base[delegateName(model)].findMany({
          where: { [m.idFields[0]]: { in: Array.from(ids) } },
          select: { [m.idFields[0]]: true, [m.labelField]: true },
        });
        for (const r of rows) names.set(`${model}:${r[m.idFields[0]]}`, String(r[m.labelField!] ?? ""));
      } catch {}
    }),
  );
  if (!names.size) return;
  for (const c of changes as any[]) {
    const target = c.path.length === 1 ? meta.fkTarget.get(c.path[0]) : undefined;
    if (!target) continue;
    if (typeof c.before === "string" && names.get(`${target}:${c.before}`)) c.beforeLabel = names.get(`${target}:${c.before}`);
    if (typeof c.after === "string" && names.get(`${target}:${c.after}`)) c.afterLabel = names.get(`${target}:${c.after}`);
  }
}

// ---------------------------------------------------------------------------
// Log writing
// ---------------------------------------------------------------------------

type Entry = {
  model: string;
  action: "create" | "update" | "delete";
  operation: string;
  entityId: string;
  label: string | null;
  changes: Change[];
  before?: any;
  after?: any;
  bulk?: { count: number; logged: number };
};

const ACTION_VERB = { create: "Created", update: "Updated", delete: "Deleted" } as const;

const fieldList = (changes: Change[]) => Array.from(new Set(changes.map((c) => c.path[0])));

function summarize(e: Entry) {
  const name = e.label ? ` "${e.label}"` : "";
  const base = `${ACTION_VERB[e.action]} ${e.model}${name}`;
  if (e.bulk) return `${base} · bulk ${e.bulk.count} records`;
  if (e.action !== "update") return base;
  const fields = fieldList(e.changes);
  const shown = fields.slice(0, 4).join(", ") + (fields.length > 4 ? ` +${fields.length - 4}` : "");
  return `${base} · ${e.changes.length} change${e.changes.length === 1 ? "" : "s"} (${shown})`;
}

const newId = () => `log_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

async function writeEntries(
  base: any,
  entries: Entry[],
  ctx: { actor: AuditActor | null; request: AuditRequest | null },
  at: Date,
) {
  if (!entries.length) return;
  for (const e of entries) {
    const meta = META.get(e.model);
    if (meta && e.changes.length) await labelForeignKeys(base, meta, e.changes);
  }
  const rows = entries.map((e) => {
    const summary = summarize(e);
    return {
      id: newId(),
      entityType: e.model,
      entityId: e.entityId,
      userId: ctx.actor?.id ?? null,
      action: e.action,
      timestamp: at,
      details: snapshot({
        v: 2,
        source: "system",
        model: e.model,
        operation: e.operation,
        label: e.label,
        summary,
        changedFields: fieldList(e.changes),
        changes: e.changes,
        ...(e.before ? { before: e.before } : {}),
        ...(e.after ? { after: e.after } : {}),
        ...(e.bulk ? { bulk: e.bulk } : {}),
        actor: ctx.actor,
        request: ctx.request,
      }, 4000) as any,
      activitylog_field_01: summary.slice(0, 500),
      activitylog_field_02: e.label?.slice(0, 200) ?? null,
      activitylog_field_03: e.changes.length,
    };
  });

  try {
    await base.activityLog.createMany({ data: rows });
  } catch (err: any) {
    // Actor may have been deleted in the same request — retry without the FK
    try {
      await base.activityLog.createMany({ data: rows.map((r) => ({ ...r, userId: null })) });
    } catch {
      if (process.env.NODE_ENV === "development") console.error("[audit] write failed:", err?.message);
      return;
    }
  }

  try {
    const { realtime } = await import("@/lib/realtime/server");
    // Ping only: the feed refetches with its own (permission-checked) request
    await realtime.trigger("activity", "activity:new", {
      id: rows[0].id,
      count: rows.length,
      entityType: rows[0].entityType,
      action: rows[0].action,
    });
  } catch {}
}

// ---------------------------------------------------------------------------
// The extension hook
// ---------------------------------------------------------------------------

type HookParams = { model?: string; operation: string; args: any; query: (args: any) => Promise<any> };

export function isAudited(model: string | undefined, operation: string) {
  return !!model && WRITE_OPS.has(operation) && !EXCLUDED_MODELS.has(model) && META.has(model);
}

const onlyNoise = (data: any) =>
  !!data && typeof data === "object" && Object.keys(data).length > 0 && Object.keys(data).every((k) => NOISE_FIELDS.has(k));

export async function auditedWrite(base: any, { model, operation, args, query }: HookParams) {
  const st = scope.getStore();
  if (!isAudited(model, operation) || st?.suppressed || st?.resolving) return query(args);
  if ((operation === "update" || operation === "updateMany") && onlyNoise(args?.data)) return query(args);

  const meta = META.get(model!)!;
  const delegate = base[delegateName(model!)];
  const at = new Date();

  // 1) Who + where, and the state before the write (read with the raw client)
  let before: any = null;
  let beforeMany: any[] = [];
  const ctxP = resolveContext().catch(() => ({ actor: null, request: null }));
  try {
    if (operation === "update" || operation === "delete" || operation === "upsert") {
      before = args?.where ? await delegate.findUnique({ where: args.where }) : null;
    } else if (operation === "updateMany" || operation === "updateManyAndReturn" || operation === "deleteMany") {
      beforeMany = await delegate.findMany({ where: args?.where ?? {}, take: MAX_BULK_RECORDS + 1 });
    }
  } catch {
    // Unusual `where` shape — still run the query, just with less detail
  }

  // 2) The real write — its result/errors are returned untouched
  const result = await query(args);

  // 3) Build log entries in the background
  void (async () => {
    try {
      const ctx = await ctxP;
      const entries: Entry[] = [];
      const pushCreate = (row: any, data: any, op: string) => {
        const after = maskSecrets({ ...pickScalars(meta, applyData(meta, {}, data)), ...pickScalars(meta, row) });
        entries.push({
          model: model!, action: "create", operation: op,
          entityId: recordId(meta, after, data), label: recordLabel(meta, after),
          changes: diffRecords(meta, {}, after).filter(
            (c) => c.after !== null && c.after !== undefined && !meta.idFields.includes(c.path[0]),
          ),
          after,
        });
      };
      const pushUpdate = (prev: any, data: any, row: any, op: string) => {
        const next = { ...applyData(meta, pickScalars(meta, prev), data), ...pickScalars(meta, row) };
        const changes = diffRecords(meta, prev, next);
        if (!changes.length) return;
        entries.push({
          model: model!, action: "update", operation: op,
          entityId: recordId(meta, prev), label: recordLabel(meta, next) ?? recordLabel(meta, prev),
          changes,
        });
      };
      const pushDelete = (prev: any, op: string) => {
        const b = maskSecrets(pickScalars(meta, prev));
        entries.push({
          model: model!, action: "delete", operation: op,
          entityId: recordId(meta, prev), label: recordLabel(meta, prev), changes: [], before: b,
        });
      };

      switch (operation) {
        case "create":
          pushCreate(result, args?.data, operation);
          break;
        case "update":
          if (before) pushUpdate(before, args?.data, result, operation);
          break;
        case "upsert":
          if (before) pushUpdate(before, args?.update, result, operation);
          else pushCreate(result, args?.create, operation);
          break;
        case "delete":
          pushDelete(before ?? result, operation);
          break;
        case "createMany":
        case "createManyAndReturn": {
          const list: any[] = Array.isArray(args?.data) ? args.data : [args?.data];
          const rows: any[] = Array.isArray(result) ? result : list;
          rows.slice(0, MAX_BULK_RECORDS).forEach((r, i) => pushCreate(r, list[i], operation));
          if (rows.length > MAX_BULK_RECORDS) {
            entries.push({
              model: model!, action: "create", operation, entityId: "bulk", label: null, changes: [],
              bulk: { count: rows.length, logged: MAX_BULK_RECORDS },
            });
          }
          break;
        }
        case "updateMany":
        case "updateManyAndReturn":
          beforeMany.slice(0, MAX_BULK_RECORDS).forEach((prev) => pushUpdate(prev, args?.data, null, operation));
          if (beforeMany.length > MAX_BULK_RECORDS) {
            entries.push({
              model: model!, action: "update", operation, entityId: "bulk", label: null,
              changes: diffRecords(meta, {}, pickScalars(meta, applyData(meta, {}, args?.data))),
              bulk: { count: Number(result?.count ?? beforeMany.length), logged: MAX_BULK_RECORDS },
            });
          }
          break;
        case "deleteMany":
          beforeMany.slice(0, MAX_BULK_RECORDS).forEach((prev) => pushDelete(prev, operation));
          if (beforeMany.length > MAX_BULK_RECORDS) {
            entries.push({
              model: model!, action: "delete", operation, entityId: "bulk", label: null, changes: [],
              bulk: { count: Number(result?.count ?? beforeMany.length), logged: MAX_BULK_RECORDS },
            });
          }
          break;
      }

      await writeEntries(base, entries, ctx, at);
    } catch (err: any) {
      if (process.env.NODE_ENV === "development") console.error("[audit] failed:", err?.message);
    }
  })();

  return result;
}

/** Shared by API routes that record a hand-written event (sign-in, UI edits…). */
export async function writeEventLog(
  base: any,
  e: { entityType: string; entityId: string; action: string; summary: string; label?: string | null; details?: any; changes?: Change[] },
) {
  const ctx = await resolveContext().catch(() => ({ actor: null, request: null }));
  const changes = e.changes ?? [];
  const row = {
    id: newId(),
    entityType: e.entityType,
    entityId: e.entityId,
    userId: ctx.actor?.id ?? null,
    action: e.action,
    details: snapshot({
      v: 2,
      source: "user",
      summary: e.summary,
      label: e.label ?? null,
      changedFields: Array.from(new Set(changes.map((c) => c.path[0]))),
      changes,
      ...(e.details ? { extra: e.details } : {}),
      actor: ctx.actor,
      request: ctx.request,
    }, 4000) as any,
    activitylog_field_01: e.summary.slice(0, 500),
    activitylog_field_02: e.label?.slice(0, 200) ?? null,
    activitylog_field_03: changes.length,
  };
  const log = await base.activityLog.create({ data: row });
  try {
    const { realtime } = await import("@/lib/realtime/server");
    await realtime.trigger("activity", "activity:new", { id: log.id, count: 1, entityType: row.entityType, action: row.action });
  } catch {}
  return log;
}
