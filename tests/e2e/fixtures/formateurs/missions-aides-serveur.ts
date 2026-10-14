// Banc @formateurs (missions) — AIDES côté serveur : lectures de registres écrits
// dans le code, qu'un spec ne peut pas lire lui-même (son chargeur ne charge pas
// la chaîne de modules serveur). Aucune écriture, aucune logique métier ici.

import { TEXTES_FORMATEURS_A_VALIDER } from "@/server/email/textes-formateurs-a-valider";

/** Les textes formateurs que l'écran des gabarits fait valider (gabarit, variante). */
export function textesFormateursAValider(): Array<{ gabarit: string; variante?: string }> {
  return TEXTES_FORMATEURS_A_VALIDER.map((t) => ({
    gabarit: t.gabarit,
    ...(t.variante !== undefined ? { variante: t.variante } : {}),
  }));
}

/**
 * L'e-mail tel que le worker l'enverra : les données du job lues dans la VRAIE file
 * (Redis — un job terminé y reste sept jours), rendues par le même moteur que le
 * worker (`renderEmailTemplate` après `payloadPourRendu`).
 *
 * Pourquoi pas le puits SMTP : le worker plafonne à 40 envois par heure
 * (`email-worker.ts`, `limiter`). Le banc enfile davantage par passage : attendre la
 * réception rendrait un scénario dépendant de l'ordre des autres. Ce que le banc
 * prouve ici est le CONTENU de ce qui est en file ; la remise au puits est prouvée,
 * une fois pour toutes, par `envois-par-la-file.spec.ts`.
 */
export async function rendreEnvoiEnFile(
  jobId: string,
): Promise<{ template: string; to: string; sujet: string; texte: string } | null> {
  const { emailsQueue } = await import("@/server/queue/queues");
  const { renderEmailTemplate } = await import("@/lib/email/templates");
  const { payloadPourRendu } = await import("@/server/email/code-en-file");
  if (emailsQueue === null) throw new Error("banc @formateurs : aucune file d'e-mails");
  const job = await emailsQueue.getJob(jobId);
  if (!job) return null;
  const d = job.data;
  const rendu = await renderEmailTemplate(
    d.template,
    d.locale,
    payloadPourRendu(d.template, d.payload),
    {
      destinataire: d.to,
    },
  );
  return {
    template: d.template,
    to: d.to,
    sujet: rendu.subject,
    texte: `${rendu.text}\n${rendu.html}`,
  };
}
