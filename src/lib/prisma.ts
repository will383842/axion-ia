// Prisma client singleton (Sprint 15 / M8)
//
// Pattern Next.js : un seul PrismaClient global pour eviter
// d'epuiser les connexions Postgres sur hot-reload dev.
// Cf. https://pris.ly/d/help/next-js-best-practices

import { PrismaClient } from "../../prisma/generated/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
