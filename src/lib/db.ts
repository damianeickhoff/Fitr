import "server-only";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const url = process.env.DATABASE_URL ?? "file:./data/fitr.db";
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
}

/**
 * One client per process. After a `prisma generate` in development the cached
 * instance belongs to the old class and rejects new columns, so the identity
 * check replaces it rather than reusing it.
 */
export const db =
  globalForPrisma.prisma instanceof PrismaClient ? globalForPrisma.prisma : createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
