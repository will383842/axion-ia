"use server";

/**
 * Devis à formules (A achat / B mise en place + abonnement) — création et édition d'un BROUILLON.
 *
 * INERTE tant que `qualiopi.devis_formules.actif` est éteint : chaque action le lit d'abord et
 * refuse, sans lire ni écrire en base. Aucun e-mail, aucune facture, aucune migration.
 *
 * Édition : `updateMany` conditionnel sur (statut brouillon, offre déjà posée, version `updatedAt`
 * lue par l'onglet). Deux onglets sur la même version : le premier enregistre et fait bouger
 * `updatedAt`, le second reçoit un refus explicite. Un devis envoyé ne se modifie pas : on le révise.
 *
 * Montants : UN seul point d'entrée, `montantsDevis` (une formule → lignes + total de sa partie
 * ponctuelle ; deux formules → lignes vides et total 0 jusqu'au choix du client).
 */

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { formulesActives } from "@/server/qualiopi/devis/interrupteur-formules";
import { montantsDevis } from "@/server/qualiopi/devis/montants-devis";
import { sha256Offre } from "@/server/qualiopi/devis/offre-calculs";
import { offreDevisV1, type OffreDevisV1 } from "@/server/qualiopi/devis/offre-devis";
import { nextNumero } from "@/server/qualiopi/numbering/allocate";
import { withNumberRetry } from "@/server/qualiopi/numbering/retry";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { LEGAL_MENTIONS } from "@/server/qualiopi/legal/legal-mentions";
import { regimeTvaDepuisConfig, mentionTva } from "@/server/qualiopi/legal/tva";

type ActionResult<T> = { data: T } | { error: string };

const MSG_ETEINT = "Le devis à formules n'est pas activé.";

/** Lignes, total et empreinte dérivés de l'offre, ou un message de refus. */
function deriver(offreBrute: unknown):
  | {
      ok: true;
      offre: OffreDevisV1;
      sha: string;
      lignes: ReturnType<typeof montantsDevis>["lignes"];
      total: number;
    }
  | { ok: false; error: string } {
  const p = offreDevisV1.safeParse(offreBrute);
  if (!p.success) {
    return { ok: false, error: `Offre invalide : ${p.error.issues[0]?.message ?? "inconnue"}` };
  }
  try {
    const m = montantsDevis({ offre: p.data, lignes: [], montantTotalHtCents: 0 });
    return {
      ok: true,
      offre: p.data,
      sha: sha256Offre(p.data),
      lignes: m.lignes,
      total: m.montantTotalHtCents,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Montants impossibles" };
  }
}

const modifierSchema = z.object({
  id: z.string().uuid(),
  /** Valeur `updatedAt` (ISO) lue au chargement de la page : la version qu'on croit modifier. */
  attenduMajLe: z.string().datetime(),
  offre: z.unknown(),
  refClient: z.string().trim().min(1).max(120).nullable().optional(),
});

export async function modifierDevisBrouillonAction(
  input: z.infer<typeof modifierSchema>,
): Promise<ActionResult<{ id: string }>> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { error: "Indisponible pendant le build" };
  }
  const session = await requireAdminWrite();
  if (!(await formulesActives())) return { error: MSG_ETEINT };
  const p = modifierSchema.safeParse(input);
  if (!p.success) return { error: "Données invalides" };
  const d = deriver(p.data.offre);
  if (!d.ok) return { error: d.error };

  const { count } = await prisma.devis.updateMany({
    where: {
      id: p.data.id,
      statut: "brouillon",
      // Seul un devis déjà créé en mode formules s'édite ici : un devis classique ne
      // voit jamais ses lignes réécrites depuis cet écran.
      offreSha256: { not: null },
      updatedAt: new Date(p.data.attenduMajLe),
    },
    data: {
      offre: d.offre as never,
      offreSha256: d.sha,
      lignes: d.lignes as never,
      montantTotalHtCents: d.total,
      ...(p.data.refClient !== undefined ? { refClient: p.data.refClient } : {}),
    },
  });
  if (count === 0) {
    const actuel = await prisma.devis.findUnique({
      where: { id: p.data.id },
      select: { statut: true },
    });
    if (!actuel) return { error: "Devis introuvable" };
    if (actuel.statut !== "brouillon") {
      return {
        error: "Un devis envoyé ne se modifie pas : créez une révision (nouvelle version).",
      };
    }
    return {
      error: "Ce brouillon a été modifié ailleurs (autre onglet) : rechargez la page.",
    };
  }
  await logQualiopiActivity({
    action: "qualiopi.devis.modifier_brouillon",
    targetType: "Devis",
    targetId: p.data.id,
    changes: { offreSha256: d.sha, montantTotalHtCents: d.total },
    session,
  });
  return { data: { id: p.data.id } };
}

const creerSchema = z.object({
  clientId: z.string().uuid(),
  offre: z.unknown(),
  activite: z.enum(["implementation", "site_web"]),
  refClient: z.string().trim().min(1).max(120).optional(),
});

/** Crée un brouillon à formules (activité implémentation ou site web, client professionnel). */
export async function creerDevisFormulesAction(
  input: z.infer<typeof creerSchema>,
): Promise<ActionResult<{ id: string; numero: string }>> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { error: "Indisponible pendant le build" };
  }
  const session = await requireAdminWrite();
  if (!(await formulesActives())) return { error: MSG_ETEINT };
  const p = creerSchema.safeParse(input);
  if (!p.success) return { error: "Données invalides" };
  const d = deriver(p.data.offre);
  if (!d.ok) return { error: d.error };

  const regime = await getQualiopiConfig("regime_tva");
  const mention = mentionTva(regimeTvaDepuisConfig(regime)) ?? LEGAL_MENTIONS.factureTvaAssujetti;
  const dateValidite = new Date();
  dateValidite.setDate(dateValidite.getDate() + 30);
  const year = new Date().getFullYear();

  const created = await withNumberRetry(() =>
    prisma.$transaction(async (tx) => {
      const numero = await nextNumero("devis", year, (prefixe) =>
        tx.devis.findMany({
          where: { numero: { startsWith: prefixe } },
          select: { numero: true },
        }),
      );
      return tx.devis.create({
        data: {
          numero,
          clientId: p.data.clientId,
          lignes: d.lignes as never,
          montantTotalHtCents: d.total,
          mentionTva: mention,
          statut: "brouillon",
          dateValidite,
          activite: p.data.activite,
          offre: d.offre as never,
          offreSha256: d.sha,
          ...(p.data.refClient !== undefined ? { refClient: p.data.refClient } : {}),
        },
        select: { id: true, numero: true },
      });
    }),
  );
  await logQualiopiActivity({
    action: "qualiopi.devis.create_formules",
    targetType: "Devis",
    targetId: created.id,
    changes: { numero: created.numero, offreSha256: d.sha },
    session,
  });
  return { data: { id: created.id, numero: created.numero } };
}
