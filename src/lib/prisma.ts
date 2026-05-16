// Prisma client singleton (Sprint 15 / M8)
//
// Pattern Next.js : un seul PrismaClient global pour eviter
// d'epuiser les connexions Postgres sur hot-reload dev.
// Cf. https://pris.ly/d/help/next-js-best-practices
//
// Build-time stub (option F.1 recovery 2026-05-16) : si DATABASE_URL pointe
// vers le stub `stub.invalid` (GH Actions build), on retourne un Proxy qui
// short-circuit toutes les queries vers des valeurs vides ([], null, 0).
// Évite de faire crasher le SSG des pages /ressources, /actualites,
// /connaissances, /equipe/[slug], /reserver, /sitemap.xml, etc. qui font
// des prisma.X.findMany/findFirst/count au build. Le runtime container
// Coolify aura le vrai DATABASE_URL injecté via env var [RUN] et créera
// un vrai PrismaClient.

import { PrismaClient } from "../../prisma/generated/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createStubPrisma(): PrismaClient {
  // Proxy qui répond à toute query par une valeur vide. Couvre :
  //   prisma.<model>.findMany() → []
  //   prisma.<model>.findFirst() / findUnique() → null
  //   prisma.<model>.count() → 0
  //   prisma.<model>.aggregate() → { _count: { _all: 0 } }
  //   prisma.$connect / $disconnect / $transaction → no-op
  // Toute mutation (create/update/delete) throw — au build aucun call ne
  // devrait muter, mais on garde un guard.
  const stubModel = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === "findMany") return async () => [];
        if (prop === "findFirst" || prop === "findUnique") return async () => null;
        if (prop === "count") return async () => 0;
        if (prop === "aggregate") return async () => ({ _count: { _all: 0 } });
        if (prop === "groupBy") return async () => [];
        // Mutations
        if (
          prop === "create" ||
          prop === "createMany" ||
          prop === "update" ||
          prop === "updateMany" ||
          prop === "upsert" ||
          prop === "delete" ||
          prop === "deleteMany"
        ) {
          return async () => {
            throw new Error(`[prisma stub] Mutation ${String(prop)} not allowed at build time`);
          };
        }
        // Unknown method → resolve to undefined (graceful).
        return async () => undefined;
      },
    },
  );
  const stub = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === "$connect" || prop === "$disconnect") return async () => {};
        if (prop === "$transaction") {
          return async (arg: unknown) => {
            if (Array.isArray(arg)) return arg.map(() => null);
            return null;
          };
        }
        if (prop === "$queryRaw" || prop === "$executeRaw") return async () => [];
        // Any model accessor returns the stubModel proxy.
        return stubModel;
      },
    },
  ) as PrismaClient;
  return stub;
}

const isBuildStub = process.env.DATABASE_URL?.includes("stub.invalid") === true;

export const prisma =
  globalForPrisma.prisma ??
  (isBuildStub
    ? createStubPrisma()
    : new PrismaClient({
        log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
      }));

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
