// Healthz endpoint — patch F1 cert 2026-05-08.
//
// Caddyfile Vague D référence `health_uri /api/healthz` pour le passive
// health check Caddy → reverse_proxy. Sans cet endpoint, Caddy aurait
// systématiquement marqué Next 502 et retiré le backend de la pool en
// prod. Bug CRITIQUE de la Vague D maintenant corrigé.
//
// Comportement :
//   - GET /api/healthz → 200 OK + JSON { status, timestamp, version, db, redis }
//   - DB / Redis checks "best-effort" : si lib indispo ou erreur, on ne fail
//     pas le healthz (Caddy ne couperait que sur 5xx complet). On expose
//     l'état dans le payload pour observability sans bloquer le routing.
//
// Sprint 17+ : ajouter `Sentry.captureException` sur erreurs persistantes,
// + intégrer dans dashboard `/admin/pseo-stats` (Sprint 20).

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface HealthzPayload {
  status: "ok" | "degraded";
  timestamp: string;
  version: string;
  db: "ok" | "error" | "skipped";
  redis: "ok" | "error" | "skipped";
}

async function checkDb(): Promise<"ok" | "error" | "skipped"> {
  if (!process.env["DATABASE_URL"]) return "skipped";
  try {
    // Import dynamique pour éviter de charger Prisma en routes qui ne le
    // touchent pas (cohérent avec serverExternalPackages strict).
    const { prisma } = await import("@/lib/prisma");
    await prisma.$queryRaw`SELECT 1`;
    return "ok";
  } catch {
    return "error";
  }
}

async function checkRedis(): Promise<"ok" | "error" | "skipped"> {
  if (!process.env["REDIS_URL"]) return "skipped";
  try {
    const { getBullConnection } = await import("@/server/queue/connection");
    const conn = getBullConnection();
    if (!conn) return "skipped"; // BULLMQ_DISABLED toggle
    await conn.ping();
    return "ok";
  } catch {
    return "error";
  }
}

export async function GET(): Promise<NextResponse<HealthzPayload>> {
  const [db, redis] = await Promise.all([checkDb(), checkRedis()]);
  const status: HealthzPayload["status"] = db === "error" || redis === "error" ? "degraded" : "ok";
  const payload: HealthzPayload = {
    status,
    timestamp: new Date().toISOString(),
    version: process.env["npm_package_version"] ?? "0.1.0",
    db,
    redis,
  };
  // Status code 200 même en degraded : Caddy ne doit pas retirer le
  // backend tant que le serveur Next répond. Le degraded est un signal
  // observability via JSON payload (UptimeRobot peut parser).
  return NextResponse.json(payload, {
    status: 200,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
