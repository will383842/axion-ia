"use server";

/**
 * Aperçu en direct de l'assistant de devis (fiche S07). LECTURE SEULE : aucune écriture,
 * aucun numéro, aucun e-mail. Les montants viennent de `calculerApercu` (mêmes fonctions que le PDF).
 */
import { prisma } from "@/lib/prisma";
import { requireAdminWrite } from "@/server/actions/qualiopi/_guards";
import { formulesActives } from "@/server/qualiopi/devis/interrupteur-formules";
import { calculerApercu, type ApercuAssistant } from "@/server/qualiopi/devis/assistant/apercu";
import { lirePayload } from "@/server/qualiopi/devis/assistant/payload";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { regimeTvaDepuisConfig, TAUX_TVA_STANDARD } from "@/server/qualiopi/legal/tva";

type ActionResult<T> = { data: T } | { error: string };

export async function apercuAssistantAction(
  payload: unknown,
): Promise<ActionResult<ApercuAssistant>> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { error: "Indisponible pendant le build" };
  }
  await requireAdminWrite();
  const lu = lirePayload(payload);
  if (!lu.ok) return { error: lu.error };
  const p = lu.payload;

  const regime = regimeTvaDepuisConfig(await getQualiopiConfig("regime_tva"));
  const tauxStandard = (await getQualiopiConfig("taux_tva_standard_percent")) || TAUX_TVA_STANDARD;
  const client = p.clientId
    ? await prisma.client.findUnique({ where: { id: p.clientId }, select: { type: true } })
    : null;
  // Automatisations déjà enregistrées sur le devis rouvert : seules à passer la validation.
  const devisId = p.sync.devisId;
  const devis = devisId
    ? await prisma.devis.findUnique({ where: { id: devisId }, select: { offre: true } })
    : null;
  const offre = devis?.offre as { automatisations?: unknown[] } | null | undefined;

  return {
    data: calculerApercu(p, {
      regime,
      tauxStandard,
      formulesActives: await formulesActives(),
      typeClient: client ? (client.type === "particulier" ? "particulier" : "entreprise") : null,
      maintenant: new Date(),
      ...(offre?.automatisations ? { automatisationsHeritees: offre.automatisations } : {}),
    }),
  };
}
