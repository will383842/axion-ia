// Réseau d'apporteurs — les ANCIENNES lignes que la grille du contrat 2.8 ne paie plus.
//
// Annexe 1 du contrat 2.8 (texte validé le 25/11/2026) : l'accompagnement individuel (coaching « one
// to one », A1.3) et la conférence (A1.6) ne donnent lieu à AUCUNE commission. Le passage n'en crée
// plus (`regles.ts#calculerCommission`) ; ce module traite celles qui existaient déjà :
//
//   · ni facturée ni versée (« à qualifier », « due » sans autofacture, « en attente de vigilance »)
//     → ANNULÉE par `ajustement.ts#annulerCommission` (geste tracé, part du parrain comprise). Jamais
//     supprimée, jamais ramenée à 0,00 € ;
//   · facturée mais pas encore versée → rien n'est modifié (l'autofacture d'origine ne se modifie
//     jamais, art. 4.5) : Williams est alerté UNE fois et tranche ;
//   · versée → jamais reprise par cette règle (seul un avoir du client la réduit, `avoir-client.ts`).
//
// Jamais une ligne LIÉE : un complément (`complement-de:`) rend à l'apporteur ce qu'une reprise lui
// avait retiré sur une ligne acquise, une reprise (`reprise-de:`) corrige une ligne versée. Ni l'un ni
// l'autre n'est annulé par cette règle. L'étape est idempotente : une ligne annulée sort de la
// requête, une alerte ne part qu'une fois (`dejaEnvoye`) ; rejouée, elle ne crée ni n'annule rien.
//
// Une part de parrain restée modifiable alors que la ligne de son filleul est déjà annulée (passage
// interrompu entre les deux écritures) est annulée à son tour. Aucun e-mail à l'apporteur.
//
// ⚠️ Atteint par le WORKER (job horaire `reseau-facturation`, tsx hors Next) : aucun `server-only`.

import { destinataireAlertesInternes } from "@/lib/destinataires-internes";
import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "@/server/queue/queues";

import { annulerCommission } from "./ajustement";
import { PREFIXE_PALIER_COMPLEMENT } from "./commandes";
import { dejaEnvoye } from "./commissions";
import { PALIER_CONFERENCE } from "./regles";
import { PREFIXE_PALIER_REPRISE } from "./resiliation";
import { signalerErreurReseau } from "./signaler";

const MODIFIABLES = ["a_qualifier", "due", "en_attente_vigilance"] as const;

export const MOTIF_HORS_GRILLE =
  "Contrat 2.8, annexe 1 (A1.3 et A1.6) : aucune commission sur le coaching individuel ni sur les conférences ; ligne non facturée annulée.";

/** Préfixes des lignes LIÉES à une ligne d'origine (complément, reprise) : jamais touchées ici. */
const PREFIXES_LIES = [PREFIXE_PALIER_COMPLEMENT, PREFIXE_PALIER_REPRISE, "reprise:"] as const;

function estLigneLiee(palier: string | null): boolean {
  return !!palier && PREFIXES_LIES.some((x) => palier.startsWith(x));
}

/** La ligne relève-t-elle d'une prestation que la grille 2.8 ne commissionne plus ? */
export function estHorsGrille(l: { activite: string; palier: string | null }): boolean {
  if (estLigneLiee(l.palier)) return false;
  return l.activite === "conference" || l.activite === "un_a_un" || l.palier === PALIER_CONFERENCE;
}

export interface BilanHorsGrille {
  annulees: number;
  alertes: number;
}

async function alerterFacturee(id: string, numero: string, maintenant: Date): Promise<boolean> {
  const jobId = `apporteur-ligne-hors-grille-facturee-${id}`;
  try {
    if (await dejaEnvoye(jobId)) return false;
    const r = await enqueueEmail(
      "qualiopi-alerte-interne",
      destinataireAlertesInternes(),
      "fr",
      {
        niveau: "important",
        code: "apporteur_ligne_hors_grille_facturee",
        titre: "Commission de conférence ou de coaching déjà facturée : à trancher",
        message: `Une commission de conférence ou de coaching individuel est déjà portée par l'autofacture ${numero}, pas encore virée. L'annexe 1 du contrat 2.8 ne commissionne plus ces prestations, mais une autofacture émise ne se modifie pas : rien n'a été changé. À trancher dans la console (Apporteurs › Commissions).`,
        cibleType: "CommissionApporteur",
        cibleId: id,
        rubrique: "apporteurs",
        chemin: "apporteurs/commissions",
        createdAt: maintenant.toLocaleDateString("fr-FR"),
      },
      { jobId, entityType: "CommissionApporteur", entityId: id },
    );
    return r.enqueued === true;
  } catch (err) {
    signalerErreurReseau("alerte ligne hors grille facturée", err);
    return false;
  }
}

async function tracer(id: string, statutAvant: string, montantAvantCents: number | null) {
  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: null,
        action: "commission_apporteur.annulee",
        targetType: "commission_apporteur",
        targetId: id,
        changes: { statutAvant, montantAvantCents, motif: MOTIF_HORS_GRILLE } as object,
      },
    });
  } catch {
    // La trace ne fait jamais échouer le passage.
  }
}

export async function annulerLignesHorsGrille(
  maintenant: Date = new Date(),
): Promise<BilanHorsGrille> {
  const bilan: BilanHorsGrille = { annulees: 0, alertes: 0 };
  const lignes = await prisma.commissionApporteur.findMany({
    where: {
      statut: { in: [...MODIFIABLES] },
      OR: [{ activite: { in: ["conference", "un_a_un"] } }, { palier: PALIER_CONFERENCE }],
      // Compléments et reprises : jamais. En SQL, `NOT (palier LIKE …)` est NULL pour un palier NULL
      // (ligne écartée à tort) : le palier NULL est donc gardé explicitement.
      AND: [
        {
          OR: [
            { palier: null },
            { NOT: PREFIXES_LIES.map((x) => ({ palier: { startsWith: x } })) },
          ],
        },
      ],
    },
    select: {
      id: true,
      apporteurId: true,
      factureId: true,
      parrainage: true,
      activite: true,
      palier: true,
      statut: true,
      montantCents: true,
      autofactureNumero: true,
      verseeAt: true,
    },
  });
  // Défense en profondeur : la requête a beau filtrer, seule une ligne hors grille et modifiable bouge.
  const candidates = lignes.filter(
    (l) => estHorsGrille(l) && (MODIFIABLES as readonly string[]).includes(l.statut) && !l.verseeAt,
  );

  // Parts de parrain : elles suivent leur filleul ; seule une part dont le filleul est déjà annulé
  // est annulée ici (sinon `annulerCommission` du filleul la porte).
  const parts = candidates.filter((l) => l.parrainage && !l.autofactureNumero);
  const filleuls = parts.length
    ? await prisma.commissionApporteur.findMany({
        where: {
          factureId: { in: [...new Set(parts.map((p) => p.factureId))] },
          parrainage: false,
        },
        select: { factureId: true, statut: true },
      })
    : [];

  for (const l of candidates) {
    try {
      if (l.autofactureNumero) {
        if (!l.parrainage && (await alerterFacturee(l.id, l.autofactureNumero, maintenant)))
          bilan.alertes += 1;
        continue;
      }
      if (l.parrainage) {
        const desFilleuls = filleuls.filter((x) => x.factureId === l.factureId);
        if (desFilleuls.length === 0 || desFilleuls.some((x) => x.statut !== "annulee")) continue;
        const u = await prisma.commissionApporteur.updateMany({
          where: {
            id: l.id,
            autofactureNumero: null,
            statut: { in: [...MODIFIABLES] },
          },
          data: { statut: "annulee" },
        });
        if (u.count === 1) {
          bilan.annulees += 1;
          await tracer(l.id, l.statut, l.montantCents);
        }
        continue;
      }
      const r = await annulerCommission(l.id, MOTIF_HORS_GRILLE);
      if (r.ok) {
        bilan.annulees += 1;
        if (r.avertissement)
          signalerErreurReseau("ligne hors grille : part du parrain", new Error(r.avertissement));
      }
    } catch (err) {
      // Une ligne en échec n'arrête pas les autres ; le passage suivant la reprend.
      signalerErreurReseau("ligne hors grille", err);
    }
  }
  return bilan;
}
