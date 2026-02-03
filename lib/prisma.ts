// lib/prisma.ts

import { PrismaClient } from "@prisma/client";

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    // ✅ Connection pool configuration for better performance
  });
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

// ✅ Connection pooling optimization
const prismaBase = globalForPrisma.prisma ?? prismaClientSingleton();

// ✅ Optimized Middleware: Cache roles to avoid repeated DB queries
const roleCache = new Map<string, string>();
let roleCacheInitialized = false;

// Initialize role cache on first use
async function initRoleCache() {
  if (roleCacheInitialized) return;
  const roles = await prismaBase.role.findMany({ select: { id: true, name: true } });
  roles.forEach(r => roleCache.set(r.name, r.id));
  roleCacheInitialized = true;
}

// ✅ Prisma v6: use $extends query hook instead of $use middleware
const prisma = prismaBase.$extends({
  query: {
    user: {
      async create({ args, query }) {
        const data = args.data as any;
        if (data?.role && typeof data.role === "string") {
          const roleName = data.role;
          delete data.role;

          // Initialize cache if needed
          await initRoleCache();

          const roleId = roleCache.get(roleName);
          if (roleId) {
            data.role = { connect: { id: roleId } };
          } else {
            console.warn(
              `Prisma Extension: Role '${roleName}' not found in cache. User will be created without a linked role.`
            );
          }
        }
        return query(args);
      },
    },
  },
});

export default prisma;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prismaBase;
