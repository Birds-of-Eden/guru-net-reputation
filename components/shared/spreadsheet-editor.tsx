// components/shared/spreadsheet-editor.tsx
"use client";

/**
 * Google-Sheets-like multi-sheet grid editor.
 *
 * - Click / drag / Shift+click to select ranges, click row/column headers
 * - Arrow keys, Tab, Enter, Ctrl+Arrow navigation
 * - Type to edit, F2 / Enter / double-click to edit existing value
 * - Ctrl+C / Ctrl+X / Ctrl+V (works with Excel & Google Sheets clipboard data)
 * - Ctrl+Z / Ctrl+Y undo & redo, Delete to clear
 * - Right-click menu: insert / delete rows & columns, clear
 * - Resizable columns, formula bar, sheet tabs (add / rename / delete)
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  ClipboardPaste,
  Copy,
  Eraser,
  Plus,
  Redo2,
  Scissors,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ---------------------------------------------------------------------------
// Types & pure helpers
// ---------------------------------------------------------------------------

export type SheetData = {
  id: string;
  name: string;
  columns: string[];
  rows: string[][];
  colWidths?: number[];
};

type Pos = { r: number; c: number };

const DEFAULT_COL_WIDTH = 160;
const MIN_COL_WIDTH = 60;
const ROW_HEADER_WIDTH = 48;
const MAX_HISTORY = 100;

export const colLetter = (index: number) => {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

let idSeq = 0;
const newSheetId = () =>
  `sheet_${Date.now().toString(36)}_${(idSeq++).toString(36)}`;

export const createEmptySheet = (
  name: string,
  cols = 3,
  rows = 5,
): SheetData => ({
  id: newSheetId(),
  name,
  columns: Array.from({ length: cols }, (_, i) => `Field ${i + 1}`),
  rows: Array.from({ length: rows }, () => Array(cols).fill("")),
});

const isSheetLike = (x: any) =>
  !!x && typeof x === "object" && Array.isArray(x.columns) && Array.isArray(x.rows);

function normalizeSheet(s: any, idx: number): SheetData {
  const rawRows: any[][] = (Array.isArray(s.rows) ? s.rows : []).map((r: any) =>
    Array.isArray(r) ? r : [],
  );
  const columns: string[] = (Array.isArray(s.columns) ? s.columns : []).map(
    (c: any) => String(c ?? ""),
  );
  const width = Math.max(columns.length, ...rawRows.map((r) => r.length), 1);
  while (columns.length < width) columns.push(`Field ${columns.length + 1}`);
  const rows = rawRows.map((r) =>
    Array.from({ length: width }, (_, i) => (r[i] == null ? "" : String(r[i]))),
  );
  if (rows.length === 0) rows.push(Array(width).fill(""));

  const sheet: SheetData = {
    id: typeof s.id === "string" && s.id ? s.id : `sheet_init_${idx}`,
    name:
      typeof s.name === "string" && s.name.trim() ? s.name : `Sheet ${idx + 1}`,
    columns,
    rows,
  };
  if (Array.isArray(s.colWidths)) {
    sheet.colWidths = columns.map((_, i) =>
      Number(s.colWidths[i]) > 0 ? Number(s.colWidths[i]) : DEFAULT_COL_WIDTH,
    );
  }
  return sheet;
}

/**
 * Split a stored `otherField` JSON value into spreadsheet sheets and any
 * non-sheet items (e.g. the system `name_keywords` entry) that must be
 * preserved untouched when saving.
 */
export function splitOtherField(raw: any): { sheets: SheetData[]; extras: any[] } {
  const arr: any[] = Array.isArray(raw) ? raw : [];
  const sheetItems = arr.filter(isSheetLike);
  let extras = arr.filter((x) => !isSheetLike(x));

  if (sheetItems.length > 0) {
    return { sheets: sheetItems.map(normalizeSheet), extras };
  }

  // Legacy format: [{ category, title, data }]
  const legacy = extras.filter(
    (x) => x && typeof x === "object" && x.category !== "system",
  );
  if (legacy.length > 0) {
    extras = extras.filter((x) => !legacy.includes(x));
    const sheet = normalizeSheet(
      {
        name: "Sheet 1",
        columns: ["Category", "Title", "Data"],
        rows: legacy.map((it) => [
          String(it.category ?? ""),
          String(it.title ?? ""),
          Array.isArray(it.data) ? it.data.join(", ") : String(it.data ?? ""),
        ]),
      },
      0,
    );
    return { sheets: [sheet], extras };
  }

  return { sheets: [createEmptySheet("Sheet 1")], extras };
}

/** Parse clipboard text (TSV, Excel/Sheets quoting rules) into a 2D array. */
function parseClipboardTable(text: string): string[][] {
  const t = text.replace(/\r\n?/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let cellStart = true;

  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (inQuotes) {
      if (ch === '"') {
        if (t[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"' && cellStart) {
      inQuotes = true;
      cellStart = false;
    } else if (ch === "\t") {
      row.push(cell);
      cell = "";
      cellStart = true;
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      cellStart = true;
    } else {
      cell += ch;
      cellStart = false;
    }
  }
  row.push(cell);
  rows.push(row);

  // Trailing newline produces one empty final row – drop it
  const last = rows[rows.length - 1];
  if (rows.length > 1 && last.length === 1 && last[0] === "") rows.pop();
  return rows;
}

const isMultiCellText = (text: string) => {
  const t = text.replace(/\r\n?/g, "\n").replace(/\n$/, "");
  return t.includes("\t") || t.includes("\n");
};

const toClipboardCell = (v: string) =>
  /[\t\n"]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;

const uniqueFieldName = (existing: string[]) => {
  let k = existing.length + 1;
  while (existing.includes(`Field ${k}`)) k++;
  return `Field ${k}`;
};

// --- sheet transforms (all return new objects) ---

function ensureSize(s: SheetData, minRows: number, minCols: number): SheetData {
  let { columns, rows, colWidths } = s;
  if (minCols > columns.length) {
    columns = [...columns];
    while (columns.length < minCols) columns.push(uniqueFieldName(columns));
    if (colWidths) {
      colWidths = [...colWidths];
      while (colWidths.length < minCols) colWidths.push(DEFAULT_COL_WIDTH);
    }
    rows = rows.map((r) => [...r, ...Array(columns.length - r.length).fill("")]);
  }
  if (minRows > rows.length) {
    rows = [
      ...rows,
      ...Array.from({ length: minRows - rows.length }, () =>
        Array(columns.length).fill(""),
      ),
    ];
  }
  return { ...s, columns, rows, ...(colWidths ? { colWidths } : {}) };
}

function insertRows(s: SheetData, at: number, count: number): SheetData {
  const blank = Array.from({ length: count }, () => Array(s.columns.length).fill(""));
  return { ...s, rows: [...s.rows.slice(0, at), ...blank, ...s.rows.slice(at)] };
}

function deleteRows(s: SheetData, r1: number, r2: number): SheetData {
  const rows = s.rows.filter((_, i) => i < r1 || i > r2);
  return { ...s, rows: rows.length ? rows : [Array(s.columns.length).fill("")] };
}

function insertCols(s: SheetData, at: number, count: number): SheetData {
  const names: string[] = [];
  for (let i = 0; i < count; i++) names.push(uniqueFieldName([...s.columns, ...names]));
  return {
    ...s,
    columns: [...s.columns.slice(0, at), ...names, ...s.columns.slice(at)],
    rows: s.rows.map((r) => [...r.slice(0, at), ...Array(count).fill(""), ...r.slice(at)]),
    ...(s.colWidths
      ? {
          colWidths: [
            ...s.colWidths.slice(0, at),
            ...Array(count).fill(DEFAULT_COL_WIDTH),
            ...s.colWidths.slice(at),
          ],
        }
      : {}),
  };
}

function deleteCols(s: SheetData, c1: number, c2: number): SheetData {
  const keep = (_: unknown, i: number) => i < c1 || i > c2;
  if (s.columns.filter(keep).length === 0) {
    // Never leave a sheet without columns
    return {
      ...s,
      columns: ["Field 1"],
      rows: s.rows.map(() => [""]),
      ...(s.colWidths ? { colWidths: [DEFAULT_COL_WIDTH] } : {}),
    };
  }
  return {
    ...s,
    columns: s.columns.filter(keep),
    rows: s.rows.map((r) => r.filter(keep)),
    ...(s.colWidths ? { colWidths: s.colWidths.filter(keep) } : {}),
  };
}

function moveCol(s: SheetData, from: number, to: number): SheetData {
  if (to < 0 || to >= s.columns.length || from === to) return s;
  const swap = <T,>(arr: T[]) => {
    const a = [...arr];
    [a[from], a[to]] = [a[to], a[from]];
    return a;
  };
  return {
    ...s,
    columns: swap(s.columns),
    rows: s.rows.map(swap),
    ...(s.colWidths ? { colWidths: swap(s.colWidths) } : {}),
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SpreadsheetEditorProps {
  value: SheetData[];
  onChange: (sheets: SheetData[]) => void;
  /** CSS max-height of the grid viewport */
  maxHeight?: string;
  className?: string;
}

type MenuState = { x: number; y: number } | null;

export function SpreadsheetEditor({
  value,
  onChange,
  maxHeight = "60vh",
  className,
}: SpreadsheetEditorProps) {
  const [sheets, setSheets] = useState<SheetData[]>(() =>
    value.length ? value : [createEmptySheet("Sheet 1")],
  );
  const sheetsRef = useRef(sheets);
  sheetsRef.current = sheets;
  const lastEmitted = useRef<SheetData[]>(sheets);

  const [past, setPast] = useState<SheetData[][]>([]);
  const [future, setFuture] = useState<SheetData[][]>([]);

  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const sheetIdx = Math.min(activeSheetIndex, sheets.length - 1);
  const sheet = sheets[sheetIdx];
  const rowCount = sheet.rows.length;
  const colCount = sheet.columns.length;

  const [activeRaw, setActive] = useState<Pos>({ r: 0, c: 0 });
  const [anchorRaw, setAnchor] = useState<Pos>({ r: 0, c: 0 });
  const clampPos = (p: Pos): Pos => ({
    r: Math.max(0, Math.min(p.r, rowCount - 1)),
    c: Math.max(0, Math.min(p.c, colCount - 1)),
  });
  const act = clampPos(activeRaw);
  const anc = clampPos(anchorRaw);
  const range = {
    r1: Math.min(anc.r, act.r),
    r2: Math.max(anc.r, act.r),
    c1: Math.min(anc.c, act.c),
    c2: Math.max(anc.c, act.c),
  };
  const rangeRows = range.r2 - range.r1 + 1;
  const rangeCols = range.c2 - range.c1 + 1;

  // Editing state (refs mirror state so blur handlers never see stale values)
  const [editing, setEditingState] = useState<null | "cell" | "bar">(null);
  const editingRef = useRef<null | "cell" | "bar">(null);
  const [editValue, setEditValueState] = useState("");
  const editValueRef = useRef("");
  const setEditing = (v: null | "cell" | "bar") => {
    editingRef.current = v;
    setEditingState(v);
  };
  const setEditValue = (v: string) => {
    editValueRef.current = v;
    setEditValueState(v);
  };

  const [headerEditing, setHeaderEditing] = useState<number | null>(null);
  const [tabEditing, setTabEditing] = useState<number | null>(null);
  const [sheetToDelete, setSheetToDelete] = useState<number | null>(null);
  const [menu, setMenu] = useState<MenuState>(null);
  const [resizing, setResizing] = useState<{ c: number; w: number } | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);
  const cellEditorRef = useRef<HTMLTextAreaElement>(null);
  const draggingRef = useRef(false);

  // ---- external value sync (e.g. parent refetched data) ----
  useEffect(() => {
    if (value === lastEmitted.current) return;
    if (JSON.stringify(value) === JSON.stringify(lastEmitted.current)) return;
    const next = value.length ? value : [createEmptySheet("Sheet 1")];
    lastEmitted.current = next;
    setSheets(next);
    setPast([]);
    setFuture([]);
    setEditing(null);
  }, [value]);

  // ---- state application ----
  const apply = (next: SheetData[]) => {
    sheetsRef.current = next;
    lastEmitted.current = next;
    setSheets(next);
    onChange(next);
  };

  const commit = (next: SheetData[]) => {
    if (next === sheetsRef.current) return;
    setPast((p) => [...p.slice(-(MAX_HISTORY - 1)), sheetsRef.current]);
    setFuture([]);
    apply(next);
  };

  const commitSheet = (fn: (s: SheetData) => SheetData) => {
    const cur = sheetsRef.current;
    const idx = Math.min(activeSheetIndex, cur.length - 1);
    const updated = fn(cur[idx]);
    if (updated === cur[idx]) return;
    commit(cur.map((s, i) => (i === idx ? updated : s)));
  };

  const undo = () => {
    if (!past.length) return;
    const prev = past[past.length - 1];
    setPast(past.slice(0, -1));
    setFuture((f) => [sheetsRef.current, ...f]);
    apply(prev);
  };

  const redo = () => {
    if (!future.length) return;
    const next = future[0];
    setFuture(future.slice(1));
    setPast((p) => [...p, sheetsRef.current]);
    apply(next);
  };

  // ---- selection ----
  const focusGrid = () => gridRef.current?.focus({ preventScroll: true });

  const scrollToCell = (p: Pos) => {
    requestAnimationFrame(() => {
      gridRef.current
        ?.querySelector<HTMLElement>(`[data-cell="${p.r}-${p.c}"]`)
        ?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  };

  const select = (p: Pos, extend = false) => {
    const cp = clampPos(p);
    setActive(cp);
    if (!extend) setAnchor(cp);
    scrollToCell(cp);
  };

  const selectRange = (from: Pos, to: Pos) => {
    setAnchor(clampPos(from));
    setActive(clampPos(to));
  };

  // ---- editing ----
  const currentValue = sheet.rows[act.r]?.[act.c] ?? "";

  const startEdit = (initial?: string, source: "cell" | "bar" = "cell") => {
    setMenu(null);
    setAnchor(act);
    setEditValue(initial ?? currentValue);
    setEditing(source);
  };

  const commitEdit = (
    move: "down" | "up" | "left" | "right" | null,
    refocus = true,
  ) => {
    if (!editingRef.current) return;
    const val = editValueRef.current;
    setEditing(null);
    const { r, c } = act;
    const addRow = move === "down" && r === rowCount - 1;

    commitSheet((s) => {
      let next = s;
      if ((s.rows[r]?.[c] ?? "") !== val) {
        next = {
          ...next,
          rows: next.rows.map((row, ri) =>
            ri === r ? row.map((cell, ci) => (ci === c ? val : cell)) : row,
          ),
        };
      }
      if (addRow) next = insertRows(next, next.rows.length, 1);
      return next;
    });

    if (move) {
      const d = { down: [1, 0], up: [-1, 0], left: [0, -1], right: [0, 1] }[move];
      const target = { r: r + d[0], c: c + d[1] };
      // clampPos uses the pre-commit size; allow the freshly added row
      const p = addRow ? { r: r + 1, c } : clampPos(target);
      setActive(p);
      setAnchor(p);
      scrollToCell(p);
    }
    if (refocus) focusGrid();
  };

  const cancelEdit = () => {
    setEditing(null);
    focusGrid();
  };

  useEffect(() => {
    if (editing === "cell" && cellEditorRef.current) {
      const el = cellEditorRef.current;
      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }
  }, [editing]);

  // ---- clipboard ----
  const rangeToText = () =>
    sheet.rows
      .slice(range.r1, range.r2 + 1)
      .map((row) => row.slice(range.c1, range.c2 + 1).map(toClipboardCell).join("\t"))
      .join("\n");

  const clearRange = () =>
    commitSheet((s) => {
      let changed = false;
      const rows = s.rows.map((row, r) =>
        r < range.r1 || r > range.r2
          ? row
          : row.map((cell, c) => {
              if (c < range.c1 || c > range.c2 || cell === "") return cell;
              changed = true;
              return "";
            }),
      );
      return changed ? { ...s, rows } : s;
    });

  const pasteText = (text: string, at: Pos) => {
    if (!text) return;
    const single = !isMultiCellText(text);
    const data = single
      ? [[text.replace(/\r\n?/g, "\n").replace(/\n$/, "")]]
      : parseClipboardTable(text);

    // Single value onto a multi-cell selection fills the whole selection
    if (single && (rangeRows > 1 || rangeCols > 1)) {
      const v = data[0][0];
      commitSheet((s) => ({
        ...s,
        rows: s.rows.map((row, r) =>
          r < range.r1 || r > range.r2
            ? row
            : row.map((cell, c) => (c < range.c1 || c > range.c2 ? cell : v)),
        ),
      }));
      return;
    }

    const h = data.length;
    const w = Math.max(...data.map((r) => r.length));
    commitSheet((s) => {
      const sized = ensureSize(s, at.r + h, at.c + w);
      const rows = sized.rows.map((row, r) => {
        if (r < at.r || r >= at.r + h) return row;
        const src = data[r - at.r];
        return row.map((cell, c) =>
          c >= at.c && c < at.c + src.length ? src[c - at.c] : cell,
        );
      });
      return { ...sized, rows };
    });
    // Select the pasted block (rows/cols may have just been created)
    setAnchor(at);
    setActive({ r: at.r + h - 1, c: at.c + w - 1 });
  };

  const copySelection = async (cut: boolean) => {
    try {
      await navigator.clipboard.writeText(rangeToText());
      if (cut) clearRange();
    } catch {
      toast.error(`Use ${cut ? "Ctrl+X" : "Ctrl+C"} to ${cut ? "cut" : "copy"}`);
    }
  };

  const pasteFromMenu = async () => {
    try {
      const text = await navigator.clipboard.readText();
      pasteText(text, { r: range.r1, c: range.c1 });
    } catch {
      toast.error("Browser blocked clipboard access. Use Ctrl+V to paste.");
    }
  };

  // Native clipboard events (fire at document level when the grid div is focused)
  const clipHandlers = useRef({
    copy: (_e: ClipboardEvent) => {},
    cut: (_e: ClipboardEvent) => {},
    paste: (_e: ClipboardEvent) => {},
  });
  clipHandlers.current = {
    copy: (e) => {
      e.preventDefault();
      e.clipboardData?.setData("text/plain", rangeToText());
    },
    cut: (e) => {
      e.preventDefault();
      e.clipboardData?.setData("text/plain", rangeToText());
      clearRange();
    },
    paste: (e) => {
      e.preventDefault();
      pasteText(e.clipboardData?.getData("text/plain") ?? "", {
        r: range.r1,
        c: range.c1,
      });
    },
  };

  useEffect(() => {
    const make = (type: "copy" | "cut" | "paste") => (e: ClipboardEvent) => {
      if (!gridRef.current || document.activeElement !== gridRef.current) return;
      clipHandlers.current[type](e);
    };
    const onCopy = make("copy");
    const onCut = make("cut");
    const onPaste = make("paste");
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCut);
    document.addEventListener("paste", onPaste);
    return () => {
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCut);
      document.removeEventListener("paste", onPaste);
    };
  }, []);

  // ---- global mouse (drag-select end, column resize) ----
  useEffect(() => {
    const up = () => {
      draggingRef.current = false;
    };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  const startResize = (e: React.MouseEvent, c: number) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = sheet.colWidths?.[c] ?? DEFAULT_COL_WIDTH;
    let latest = startW;
    setResizing({ c, w: startW });

    const move = (ev: MouseEvent) => {
      latest = Math.max(MIN_COL_WIDTH, startW + ev.clientX - startX);
      setResizing({ c, w: latest });
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      setResizing(null);
      if (latest !== startW) {
        commitSheet((s) => {
          const widths = s.columns.map((_, i) => s.colWidths?.[i] ?? DEFAULT_COL_WIDTH);
          widths[c] = latest;
          return { ...s, colWidths: widths };
        });
      }
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  // Double-click a column edge → fit width to the longest value (like Sheets)
  const autoFitColumn = (c: number) => {
    const longest = Math.max(
      sheet.columns[c]?.length ?? 0,
      ...sheet.rows.map((r) =>
        Math.max(0, ...String(r[c] ?? "").split("\n").map((l) => l.length)),
      ),
    );
    const width = Math.min(600, Math.max(MIN_COL_WIDTH, Math.round(longest * 7.5 + 28)));
    commitSheet((s) => {
      const widths = s.columns.map((_, i) => s.colWidths?.[i] ?? DEFAULT_COL_WIDTH);
      if (widths[c] === width) return s;
      widths[c] = width;
      return { ...s, colWidths: widths };
    });
  };

  // ---- close context menu ----
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("mousedown", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  // ---- keyboard on grid ----
  const onGridKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (editingRef.current || e.target !== gridRef.current) return;
    const mod = e.ctrlKey || e.metaKey;

    const move = (dr: number, dc: number) => {
      e.preventDefault();
      let { r, c } = act;
      if (mod) {
        if (dr) r = dr > 0 ? rowCount - 1 : 0;
        if (dc) c = dc > 0 ? colCount - 1 : 0;
      } else {
        r += dr;
        c += dc;
      }
      select({ r, c }, e.shiftKey);
    };

    switch (e.key) {
      case "ArrowUp":
        return move(-1, 0);
      case "ArrowDown":
        return move(1, 0);
      case "ArrowLeft":
        return move(0, -1);
      case "ArrowRight":
        return move(0, 1);
      case "Tab":
        e.preventDefault();
        return select({ r: act.r, c: act.c + (e.shiftKey ? -1 : 1) });
      case "Enter":
      case "F2":
        e.preventDefault();
        return startEdit();
      case "Delete":
      case "Backspace":
        e.preventDefault();
        return clearRange();
      case "Escape":
        setAnchor(act);
        return;
    }

    if (mod) {
      const k = e.key.toLowerCase();
      if (k === "z") {
        e.preventDefault();
        return e.shiftKey ? redo() : undo();
      }
      if (k === "y") {
        e.preventDefault();
        return redo();
      }
      if (k === "a") {
        e.preventDefault();
        return selectRange({ r: 0, c: 0 }, { r: rowCount - 1, c: colCount - 1 });
      }
      return; // Ctrl+C / X / V handled by native clipboard events
    }

    if (e.key.length === 1 && !e.altKey) {
      e.preventDefault();
      startEdit(e.key);
    }
  };

  // ---- mouse on cells / headers ----
  const onCellMouseDown = (e: React.MouseEvent, r: number, c: number) => {
    if (e.button !== 0) return;
    e.preventDefault();
    if (editingRef.current) {
      if (editingRef.current === "cell" && act.r === r && act.c === c) return;
      commitEdit(null, false);
    }
    focusGrid();
    select({ r, c }, e.shiftKey);
    draggingRef.current = true;
  };

  const onCellMouseEnter = (r: number, c: number) => {
    if (draggingRef.current) setActive({ r, c });
  };

  const onContextMenu = (e: React.MouseEvent, r: number, c: number) => {
    e.preventDefault();
    if (editingRef.current) commitEdit(null, false);
    if (r < range.r1 || r > range.r2 || c < range.c1 || c > range.c2) {
      select({ r, c });
    }
    focusGrid();
    const W = 240;
    const H = 400;
    setMenu({
      x: Math.min(e.clientX, window.innerWidth - W - 8),
      y: Math.min(e.clientY, window.innerHeight - H - 8),
    });
  };

  const selectColumn = (e: React.MouseEvent, c: number) => {
    e.preventDefault();
    if (editingRef.current) commitEdit(null, false);
    focusGrid();
    if (e.shiftKey) {
      setAnchor({ r: 0, c: anc.c });
      setActive({ r: rowCount - 1, c });
    } else {
      selectRange({ r: 0, c }, { r: rowCount - 1, c });
    }
  };

  const selectRow = (e: React.MouseEvent, r: number) => {
    e.preventDefault();
    if (editingRef.current) commitEdit(null, false);
    focusGrid();
    if (e.shiftKey) {
      setAnchor({ r: anc.r, c: 0 });
      setActive({ r, c: colCount - 1 });
    } else {
      selectRange({ r, c: 0 }, { r, c: colCount - 1 });
    }
  };

  // ---- structural actions ----
  const runAndClose = (fn: () => void) => () => {
    setMenu(null);
    fn();
    focusGrid();
  };

  const renameColumn = (c: number, name: string) => {
    setHeaderEditing(null);
    const clean = name.trim() || `Field ${c + 1}`;
    commitSheet((s) =>
      s.columns[c] === clean
        ? s
        : { ...s, columns: s.columns.map((col, i) => (i === c ? clean : col)) },
    );
    focusGrid();
  };

  const switchSheet = (i: number) => {
    if (editingRef.current) commitEdit(null, false);
    setActiveSheetIndex(i);
    setActive({ r: 0, c: 0 });
    setAnchor({ r: 0, c: 0 });
    setHeaderEditing(null);
  };

  const addSheet = () => {
    const cur = sheetsRef.current;
    let n = cur.length + 1;
    while (cur.some((s) => s.name === `Sheet ${n}`)) n++;
    commit([...cur, createEmptySheet(`Sheet ${n}`)]);
    switchSheet(cur.length);
  };

  const renameSheet = (i: number, name: string) => {
    setTabEditing(null);
    const clean = name.trim();
    if (!clean) return;
    const cur = sheetsRef.current;
    if (cur[i].name === clean) return;
    commit(cur.map((s, idx) => (idx === i ? { ...s, name: clean } : s)));
  };

  const confirmDeleteSheet = () => {
    if (sheetToDelete === null) return;
    const cur = sheetsRef.current;
    if (cur.length <= 1) return;
    const next = cur.filter((_, i) => i !== sheetToDelete);
    commit(next);
    setActiveSheetIndex((a) =>
      a > sheetToDelete ? a - 1 : Math.min(a, next.length - 1),
    );
    setActive({ r: 0, c: 0 });
    setAnchor({ r: 0, c: 0 });
    setSheetToDelete(null);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const widths = sheet.columns.map((_, i) =>
    resizing?.c === i ? resizing.w : (sheet.colWidths?.[i] ?? DEFAULT_COL_WIDTH),
  );
  const tableWidth = ROW_HEADER_WIDTH + widths.reduce((a, b) => a + b, 0);
  const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

  const toolbarBtn =
    "h-8 gap-1.5 rounded-md px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800";

  return (
    <div
      className={cn(
        // `isolate` creates a stacking context so the sticky headers' z-index
        // never leaks above dialogs/modals (the app Dialog uses z-10)
        "isolate overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900",
        className,
      )}
    >
      {/* Sheet tabs (top) */}
      <div className="flex items-end gap-1.5 border-b-2 border-emerald-500 bg-linear-to-r from-emerald-50 via-teal-50 to-sky-50 px-2 pt-2 dark:border-emerald-600 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-sky-950/30">
        <div className="flex min-w-0 flex-1 items-end gap-1.5 overflow-x-auto">
          {sheets.map((s, i) => {
            const isActive = i === sheetIdx;
            return (
              <div
                key={s.id}
                onClick={() => !isActive && switchSheet(i)}
                onDoubleClick={() => setTabEditing(i)}
                title="Double-click to rename"
                className={cn(
                  "group flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-t-lg px-4 text-sm font-bold transition-all",
                  isActive
                    ? "bg-linear-to-r from-emerald-500 to-teal-600 text-white shadow-md"
                    : "border border-b-0 border-emerald-200 bg-white/80 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-slate-900/60 dark:text-emerald-300 dark:hover:bg-emerald-900/40",
                )}
              >
                {tabEditing === i ? (
                  <input
                    autoFocus
                    defaultValue={s.name}
                    onFocus={(e) => e.currentTarget.select()}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => renameSheet(i, e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") renameSheet(i, e.currentTarget.value);
                      if (e.key === "Escape") setTabEditing(null);
                    }}
                    className="h-6 w-32 rounded border border-blue-500 bg-white px-1.5 text-sm font-semibold text-slate-900 outline-none dark:bg-slate-900 dark:text-slate-100"
                  />
                ) : (
                  <span className="max-w-[180px] truncate">{s.name}</span>
                )}
                {sheets.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSheetToDelete(i);
                    }}
                    className={cn(
                      "rounded p-0.5 transition-opacity",
                      isActive
                        ? "text-white/80 hover:bg-white/20 hover:text-white"
                        : "text-emerald-600/60 opacity-70 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950/40",
                    )}
                    title="Delete sheet"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <Button
          type="button"
          size="sm"
          onClick={addSheet}
          title="Add sheet"
          className="mb-1 h-8 shrink-0 gap-1 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" /> Sheet
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800/60">
        <Button type="button" variant="ghost" size="sm" className={toolbarBtn} onClick={undo} disabled={!past.length} title="Undo (Ctrl+Z)">
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" className={toolbarBtn} onClick={redo} disabled={!future.length} title="Redo (Ctrl+Y)">
          <Redo2 className="h-4 w-4" />
        </Button>
        <div className="mx-1 h-5 w-px bg-slate-300 dark:bg-slate-600" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={toolbarBtn}
          onClick={() => {
            commitSheet((s) => insertRows(s, s.rows.length, 1));
            select({ r: rowCount, c: act.c });
          }}
        >
          <Plus className="h-4 w-4" /> Row
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={toolbarBtn}
          onClick={() => commitSheet((s) => insertCols(s, s.columns.length, 1))}
        >
          <Plus className="h-4 w-4" /> Column
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={toolbarBtn}
          onClick={() => {
            clearRange();
            focusGrid();
          }}
          title="Clear selected cells (Delete)"
        >
          <Eraser className="h-4 w-4" /> Clear
        </Button>
        <div className="flex-1" />
        <span className="hidden text-xs text-slate-500 sm:inline dark:text-slate-400">
          {rowCount} rows × {colCount} columns · Paste from Excel / Google Sheets with Ctrl+V
        </span>
      </div>

      {/* Formula bar */}
      <div className="flex items-stretch border-b border-slate-200 dark:border-slate-700">
        <div className="flex w-20 shrink-0 items-center justify-center border-r border-slate-200 font-mono text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
          {rangeRows > 1 || rangeCols > 1
            ? `${colLetter(range.c1)}${range.r1 + 1}:${colLetter(range.c2)}${range.r2 + 1}`
            : `${colLetter(act.c)}${act.r + 1}`}
        </div>
        <div className="flex items-center px-2 font-serif text-sm italic text-slate-400">fx</div>
        <input
          className="min-w-0 flex-1 bg-transparent py-1.5 pr-2 text-sm text-slate-900 outline-none dark:text-slate-100"
          value={editing ? editValue : currentValue}
          onFocus={() => {
            if (!editingRef.current) startEdit(undefined, "bar");
          }}
          onChange={(e) => {
            if (!editingRef.current) setEditing("bar");
            setEditValue(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitEdit("down");
            } else if (e.key === "Tab") {
              e.preventDefault();
              commitEdit(e.shiftKey ? "left" : "right");
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancelEdit();
            }
          }}
          onBlur={() => {
            if (editingRef.current === "bar") commitEdit(null, false);
          }}
        />
      </div>

      {/* Grid */}
      <div
        ref={gridRef}
        tabIndex={0}
        onKeyDown={onGridKeyDown}
        className="relative overflow-auto outline-none"
        style={{
          maxHeight,
          scrollPaddingTop: 58,
          scrollPaddingLeft: ROW_HEADER_WIDTH,
        }}
      >
        <table
          className="border-separate border-spacing-0 text-sm"
          style={{ tableLayout: "fixed", width: tableWidth }}
        >
          <colgroup>
            <col style={{ width: ROW_HEADER_WIDTH }} />
            {widths.map((w, i) => (
              <col key={i} style={{ width: w }} />
            ))}
          </colgroup>
          <thead>
            {/* Column letters */}
            <tr>
              <th
                className="sticky left-0 top-0 z-30 h-6 border-b border-r border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
                onMouseDown={(e) => {
                  e.preventDefault();
                  focusGrid();
                  selectRange({ r: 0, c: 0 }, { r: rowCount - 1, c: colCount - 1 });
                }}
                title="Select all"
              />
              {sheet.columns.map((_, c) => {
                const colSelected = c >= range.c1 && c <= range.c2;
                return (
                  <th
                    key={c}
                    onMouseDown={(e) => e.button === 0 && selectColumn(e, c)}
                    onContextMenu={(e) => onContextMenu(e, act.r, c)}
                    className={cn(
                      "sticky top-0 z-20 h-6 cursor-pointer select-none border-b border-r border-slate-300 text-[11px] font-medium dark:border-slate-700",
                      colSelected
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200"
                        : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
                    )}
                  >
                    {colLetter(c)}
                    <ResizeHandle
                      active={resizing?.c === c}
                      onMouseDown={(e) => startResize(e, c)}
                      onDoubleClick={() => autoFitColumn(c)}
                    />
                  </th>
                );
              })}
            </tr>
            {/* Column names (header row) */}
            <tr>
              <th className="sticky left-0 top-6 z-30 h-8 border-b-2 border-r border-slate-300 bg-slate-100 text-[11px] font-medium text-slate-400 dark:border-slate-600 dark:bg-slate-800">
                #
              </th>
              {sheet.columns.map((col, c) => (
                <th
                  key={c}
                  onMouseDown={(e) => {
                    if (e.button !== 0 || headerEditing === c) return;
                    selectColumn(e, c);
                  }}
                  onDoubleClick={() => setHeaderEditing(c)}
                  onContextMenu={(e) => onContextMenu(e, act.r, c)}
                  title={`${col} — double-click to rename`}
                  className="sticky top-6 z-20 h-8 overflow-hidden text-ellipsis whitespace-nowrap border-b-2 border-r border-slate-300 bg-slate-50 px-2 text-left text-xs font-semibold text-slate-800 select-none dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-100"
                >
                  {headerEditing === c ? (
                    <input
                      autoFocus
                      defaultValue={col}
                      onFocus={(e) => e.currentTarget.select()}
                      onBlur={(e) => renameColumn(c, e.currentTarget.value)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter") renameColumn(c, e.currentTarget.value);
                        if (e.key === "Escape") {
                          setHeaderEditing(null);
                          focusGrid();
                        }
                      }}
                      className="h-6 w-full rounded border border-blue-500 bg-white px-1 text-xs font-semibold outline-none dark:bg-slate-900"
                    />
                  ) : (
                    col
                  )}
                  <ResizeHandle
                    active={resizing?.c === c}
                    onMouseDown={(e) => startResize(e, c)}
                    onDoubleClick={() => autoFitColumn(c)}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((row, r) => {
              const rowSelected = r >= range.r1 && r <= range.r2;
              return (
                <tr key={r}>
                  <td
                    onMouseDown={(e) => e.button === 0 && selectRow(e, r)}
                    onContextMenu={(e) => onContextMenu(e, r, act.c)}
                    className={cn(
                      "sticky left-0 z-10 h-8 cursor-pointer select-none border-b border-r border-slate-300 text-center text-[11px] dark:border-slate-700",
                      rowSelected
                        ? "bg-blue-100 font-semibold text-blue-800 dark:bg-blue-900/50 dark:text-blue-200"
                        : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
                    )}
                  >
                    {r + 1}
                  </td>
                  {row.map((cell, c) => {
                    const isActive = act.r === r && act.c === c;
                    const inRange =
                      rowSelected && c >= range.c1 && c <= range.c2;
                    return (
                      <td
                        key={c}
                        data-cell={`${r}-${c}`}
                        onMouseDown={(e) => onCellMouseDown(e, r, c)}
                        onMouseEnter={() => onCellMouseEnter(r, c)}
                        onDoubleClick={() => startEdit()}
                        onContextMenu={(e) => onContextMenu(e, r, c)}
                        title={cell.length > 24 ? cell : undefined}
                        className={cn(
                          "relative h-8 cursor-cell select-none overflow-hidden text-ellipsis whitespace-nowrap border-b border-r border-slate-200 px-2 text-slate-900 dark:border-slate-700/70 dark:text-slate-100",
                          inRange && !isActive && "bg-blue-50 dark:bg-blue-500/15",
                        )}
                      >
                        {cell}
                        {isActive && (
                          <span className="pointer-events-none absolute inset-0 border-2 border-blue-600 dark:border-blue-400" />
                        )}
                        {isActive && editing === "cell" && (
                          <textarea
                            ref={cellEditorRef}
                            value={editValue}
                            rows={1}
                            onChange={(e) => setEditValue(e.target.value)}
                            onMouseDown={(e) => e.stopPropagation()}
                            onDoubleClick={(e) => e.stopPropagation()}
                            onBlur={() => {
                              if (editingRef.current === "cell") commitEdit(null, false);
                            }}
                            onPaste={(e) => {
                              const text = e.clipboardData.getData("text/plain");
                              if (!isMultiCellText(text)) {
                                // Single value: insert at caret, minus the trailing
                                // newline Excel/Sheets add when copying one cell
                                const clean = text.replace(/\r\n?/g, "\n").replace(/\n$/, "");
                                if (clean === text) return; // let native paste run
                                e.preventDefault();
                                e.stopPropagation();
                                const el = e.currentTarget;
                                const { selectionStart: s, selectionEnd: en } = el;
                                setEditValue(el.value.slice(0, s) + clean + el.value.slice(en));
                                requestAnimationFrame(() =>
                                  el.setSelectionRange(s + clean.length, s + clean.length),
                                );
                                return;
                              }
                              e.preventDefault();
                              e.stopPropagation();
                              commitEdit(null);
                              pasteText(text, { r, c });
                            }}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === "Enter" && e.altKey) {
                                e.preventDefault();
                                const el = e.currentTarget;
                                const { selectionStart: s, selectionEnd: en } = el;
                                setEditValue(el.value.slice(0, s) + "\n" + el.value.slice(en));
                                requestAnimationFrame(() => el.setSelectionRange(s + 1, s + 1));
                              } else if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                commitEdit("down");
                              } else if (e.key === "Tab") {
                                e.preventDefault();
                                commitEdit(e.shiftKey ? "left" : "right");
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                cancelEdit();
                              }
                            }}
                            className="absolute inset-0 z-10 resize-none overflow-hidden border-2 border-blue-600 bg-white px-2 py-1.5 text-sm leading-[18px] text-slate-900 outline-none dark:border-blue-400 dark:bg-slate-900 dark:text-slate-100"
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Context menu (portaled to body so it isn't trapped by `isolate`) */}
      {menu && createPortal(
        <div
          className="fixed z-50 w-60 rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900"
          style={{ left: menu.x, top: menu.y }}
          onMouseDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <MenuItem icon={Scissors} label="Cut" hint="Ctrl+X" onClick={runAndClose(() => copySelection(true))} />
          <MenuItem icon={Copy} label="Copy" hint="Ctrl+C" onClick={runAndClose(() => copySelection(false))} />
          <MenuItem icon={ClipboardPaste} label="Paste" hint="Ctrl+V" onClick={runAndClose(pasteFromMenu)} />
          <MenuSep />
          <MenuItem
            icon={ArrowUpToLine}
            label={`Insert ${plural(rangeRows, "row")} above`}
            onClick={runAndClose(() => commitSheet((s) => insertRows(s, range.r1, rangeRows)))}
          />
          <MenuItem
            icon={ArrowDownToLine}
            label={`Insert ${plural(rangeRows, "row")} below`}
            onClick={runAndClose(() => commitSheet((s) => insertRows(s, range.r2 + 1, rangeRows)))}
          />
          <MenuItem
            icon={ArrowLeftToLine}
            label={`Insert ${plural(rangeCols, "column")} left`}
            onClick={runAndClose(() => commitSheet((s) => insertCols(s, range.c1, rangeCols)))}
          />
          <MenuItem
            icon={ArrowRightToLine}
            label={`Insert ${plural(rangeCols, "column")} right`}
            onClick={runAndClose(() => commitSheet((s) => insertCols(s, range.c2 + 1, rangeCols)))}
          />
          {rangeCols === 1 && (
            <>
              <MenuItem
                icon={ArrowLeftToLine}
                label="Move column left"
                disabled={range.c1 === 0}
                onClick={runAndClose(() => {
                  commitSheet((s) => moveCol(s, range.c1, range.c1 - 1));
                  select({ r: act.r, c: range.c1 - 1 });
                })}
              />
              <MenuItem
                icon={ArrowRightToLine}
                label="Move column right"
                disabled={range.c1 === colCount - 1}
                onClick={runAndClose(() => {
                  commitSheet((s) => moveCol(s, range.c1, range.c1 + 1));
                  select({ r: act.r, c: range.c1 + 1 });
                })}
              />
            </>
          )}
          <MenuSep />
          <MenuItem
            icon={Trash2}
            danger
            label={
              rangeRows > 1
                ? `Delete rows ${range.r1 + 1}–${range.r2 + 1}`
                : `Delete row ${range.r1 + 1}`
            }
            onClick={runAndClose(() => {
              commitSheet((s) => deleteRows(s, range.r1, range.r2));
              select({ r: range.r1, c: act.c });
            })}
          />
          <MenuItem
            icon={Trash2}
            danger
            label={
              rangeCols > 1
                ? `Delete columns ${colLetter(range.c1)}–${colLetter(range.c2)}`
                : `Delete column ${colLetter(range.c1)}`
            }
            onClick={runAndClose(() => {
              commitSheet((s) => deleteCols(s, range.c1, range.c2));
              select({ r: act.r, c: range.c1 });
            })}
          />
          <MenuItem icon={Eraser} label="Clear cells" hint="Del" onClick={runAndClose(clearRange)} />
        </div>,
        document.body,
      )}

      {/* Delete sheet confirmation */}
      <AlertDialog
        open={sheetToDelete !== null}
        onOpenChange={(open) => !open && setSheetToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete sheet?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{sheetToDelete !== null ? sheets[sheetToDelete]?.name : ""}&quot; and all
              of its data will be removed. You can still undo with Ctrl+Z before saving.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteSheet}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  hint,
  onClick,
  danger,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40 dark:hover:bg-slate-800",
        danger ? "text-red-600 dark:text-red-400" : "text-slate-700 dark:text-slate-200",
      )}
    >
      <Icon className="h-4 w-4 shrink-0 opacity-70" />
      <span className="flex-1">{label}</span>
      {hint && <span className="text-xs text-slate-400">{hint}</span>}
    </button>
  );
}

function ResizeHandle({
  active,
  onMouseDown,
  onDoubleClick,
}: {
  active: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
}) {
  return (
    <span
      onMouseDown={onMouseDown}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick();
      }}
      title="Drag to resize · double-click to fit"
      className={cn(
        "absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize transition-colors hover:bg-blue-500",
        active && "bg-blue-500",
      )}
    />
  );
}

function MenuSep() {
  return <div className="my-1 h-px bg-slate-200 dark:bg-slate-700" />;
}
