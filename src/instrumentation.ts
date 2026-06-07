// Next.js 16 instrumentation hook — runs once per runtime (node + edge).
// Sentry server/edge init lives here per @sentry/nextjs v10 conventions.
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env["NEXT_RUNTIME"] === "nodejs") {
    await import("./sentry.server.config");
    await seedQualiopiReferenceDataOnBoot();
  }
  if (process.env["NEXT_RUNTIME"] === "edge") {
    await import("./sentry.edge.config");
  }
}

/**
 * Seed AUTOMATIQUE du référentiel Qualiopi (offres + config + grilles) au démarrage
 * du serveur Node, une fois par boot. Rend le système opérationnel sans étape manuelle
 * post-déploiement (le même seed reste pilotable depuis /qualiopi/config).
 *
 * Garde-fous : jamais au build (stub.invalid), désactivable via QUALIOPI_AUTO_SEED=false,
 * idempotent + verrou Postgres côté service, et 100 % fail-soft (une erreur de seed ne
 * doit JAMAIS empêcher le serveur de démarrer).
 */
async function seedQualiopiReferenceDataOnBoot(): Promise<void> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return; // build (ADR 0026)
  if (process.env["QUALIOPI_AUTO_SEED"] === "false") return; // kill-switch
  try {
    const { prisma } = await import("@/lib/prisma");
    const { seedQualiopiReferenceData } = await import("@/server/qualiopi/seed/reference-data");
    const report = await seedQualiopiReferenceData(prisma);
    // Alerte SEULEMENT si le seed a tourné mais laisse le référentiel incomplet
    // (sinon silence : succès = pas de bruit dans les logs).
    if (report.ran && (report.offresCount === 0 || report.grilleActiveCle == null)) {
      console.warn(
        `[qualiopi:auto-seed] référentiel incomplet après seed — offres=${report.offresCount}, grille=${report.grilleActiveCle ?? "aucune"}.`,
      );
    }
  } catch (err) {
    // Fail-soft : on logge et on laisse le serveur démarrer.
    console.error(
      "[qualiopi:auto-seed] échec (best-effort, le serveur démarre quand même) :",
      err instanceof Error ? err.message : String(err),
    );
  }
}

// Hand server-side render errors to Sentry. Le scrub PII est appliqué par
// `beforeSend` posé dans `sentry.server.config.ts` et `sentry.edge.config.ts`
// (audit E2E 2026-05-11 P0-CONF-06 — RGPD Art. 32).
export function onRequestError(err: unknown): void {
  Sentry.captureException(err);
}
