/**
 * PROBE 02 — Seed edge-cases (Phase 1) : stub no-op, concurrence/verrou.
 * Le kill-switch (QUALIOPI_AUTO_SEED) et stub.invalid sont gérés dans
 * instrumentation.ts (boot) ; ici on teste la couche service.
 */
import { PrismaClient } from "../../../prisma/generated/client";
import { seedQualiopiReferenceData } from "@/server/qualiopi/seed/reference-data";

async function main() {
  // --- 1. STUB no-op : DATABASE_URL contient stub.invalid → ran:false, 0 mutation ---
  console.log("=== STUB no-op ===");
  const saved = process.env["DATABASE_URL"];
  process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
  // Client réel mais isStub() lit l'env → doit court-circuiter AVANT tout $queryRaw
  const prismaForStub = new PrismaClient();
  const stubReport = await seedQualiopiReferenceData(prismaForStub);
  console.log("STUB_RAN_FALSE:", stubReport.ran === false, JSON.stringify(stubReport));
  await prismaForStub.$disconnect();
  process.env["DATABASE_URL"] = saved;

  // --- 2. CONCURRENCE : deux seeds simultanés → un seul acquiert le verrou ---
  console.log("\n=== CONCURRENCE verrou advisory ===");
  // Deux clients distincts (deux connexions = deux sessions Postgres) pour que
  // pg_try_advisory_lock soit réellement disputé (le lock est par-session).
  const a = new PrismaClient();
  const b = new PrismaClient();
  // Force la même connexion établie puis lance en parallèle.
  await a.$connect();
  await b.$connect();
  const [ra, rb] = await Promise.all([seedQualiopiReferenceData(a), seedQualiopiReferenceData(b)]);
  console.log("A.ran:", ra.ran, "B.ran:", rb.ran);
  console.log("UN_SEUL_A_SEEDE:", ra.ran !== rb.ran || (!ra.ran && !rb.ran));
  await a.$disconnect();
  await b.$disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("PROBE_ERROR:", e);
    process.exit(1);
  });
