/**
 * Alertes « à appeler » du suivi de l'entreprise OPCO (lot OPCO A8).
 *
 *   · `entreprise_a_appeler_depot` — trois relances de dépôt sans « oui », ou
 *     J-3 de la date limite de dépôt ;
 *   · `entreprise_a_appeler_reponse_opco` — trois relances de réponse sans
 *     accord ni refus, ou session dans 10 jours sans accord ;
 *   · `opco_refus_a_traiter` — refus déclaré par l'entreprise, tant que le
 *     dossier n'est ni clos ni renvoyé.
 *
 * Décision PURE dans `suivi-entreprise/planning.ts` (`alertesSuivi`) ; ici, la
 * lecture et le texte. Le message nomme l'ENTREPRISE et donne le TÉLÉPHONE du
 * contact s'il est en base (la console en fait un lien `tel:` ; il ne part
 * jamais à l'entreprise). La cible est la session : l'alerte mène à sa fiche,
 * d'où l'on ouvre la page Financement.
 *
 * Fenêtre app/worker : les tables du suivi peuvent manquer pendant l'heure qui
 * suit une fusion — la règle s'abstient (`tablesSuiviDisponibles`) au lieu de
 * casser le tour, ce qui suspendrait la résolution de TOUTES les alertes.
 */

import { prisma } from "@/lib/prisma";
import {
  SELECT_DOSSIER_SUIVI,
  contexteSuivi,
  type ContexteSuivi,
} from "@/server/qualiopi/financements/suivi-entreprise/lecture";
import {
  alertesSuivi,
  jourDeDate,
  jourFr,
  type CodeAlerteSuivi,
} from "@/server/qualiopi/financements/suivi-entreprise/planning";
import { tablesSuiviDisponibles } from "@/server/qualiopi/financements/suivi-entreprise/tables";
import type { AlerteNiveau } from "../../../../prisma/generated/client";
import type { AlerteCandidate } from "./evaluateur";

const JOUR_MS = 24 * 60 * 60 * 1000;
/** Une session commencée depuis plus de 60 jours sort du suivi. */
const RETARD_MAX_JOURS = 60;
const PLAFOND_DOSSIERS = 500;

/**
 * Les trois codes, écrits en LITTÉRAUX : la garde `routage.spec.ts` lit les
 * `code: "…"` des modules de règle pour savoir qu'ils sont émis par le balayage
 * (donc autorisés à se refermer seuls).
 */
interface EntreeAlerte {
  code: CodeAlerteSuivi;
  titre: string;
  niveau: AlerteNiveau;
}

const ENTREES: Record<CodeAlerteSuivi, EntreeAlerte> = {
  entreprise_a_appeler_depot: {
    code: "entreprise_a_appeler_depot",
    titre: "Entreprise à appeler : dépôt de la demande OPCO",
    niveau: "important",
  },
  entreprise_a_appeler_reponse_opco: {
    code: "entreprise_a_appeler_reponse_opco",
    titre: "Entreprise à appeler : réponse de l'OPCO",
    niveau: "important",
  },
  opco_refus_a_traiter: {
    code: "opco_refus_a_traiter",
    titre: "Refus de l'OPCO à traiter",
    niveau: "critique",
  },
};

function joindre(c: ContexteSuivi): string {
  const tel = c.entreprise?.contactTelephone?.trim();
  return tel
    ? `Appelez le contact au ${tel}`
    : "Appelez le contact (aucun téléphone sur la fiche client)";
}

/** Décision + texte, PURE (testée). */
export function candidatsSuiviEntreprise(
  contextes: readonly ContexteSuivi[],
  now: Date,
): AlerteCandidate[] {
  const out: AlerteCandidate[] = [];
  for (const c of contextes) {
    if (!c.suivi) continue;
    const entreprise = c.entreprise?.raisonSociale ?? "L'entreprise";
    for (const a of alertesSuivi(c.dossier, c.suivi, now)) {
      const message =
        a.code === "entreprise_a_appeler_depot"
          ? `${entreprise} (session ${c.numeroSession}) n'a pas confirmé le dépôt de sa demande de prise en charge auprès de ${c.nomOpco} : ${a.motif}. ${joindre(c)}, puis saisissez la date de dépôt sur la page Financement de la session.`
          : a.code === "entreprise_a_appeler_reponse_opco"
            ? `${entreprise} (session ${c.numeroSession}) a déposé sa demande auprès de ${c.nomOpco}${c.dossier.depotFaitLe ? ` le ${jourFr(jourDeDate(c.dossier.depotFaitLe))}` : ""} et aucune réponse n'est enregistrée : ${a.motif}. ${joindre(c)}, puis saisissez l'accord sur la page Financement de la session.`
            : `${entreprise} déclare un refus de ${c.nomOpco} pour la session ${c.numeroSession}. ${joindre(c)} pour en connaître le motif, puis renvoyez ou clôturez le dossier depuis le Hub facturation.`;
      const entree = ENTREES[a.code];
      out.push({
        code: entree.code,
        niveau: entree.niveau,
        titre: entree.titre,
        message,
        cibleType: "TrainingSession",
        cibleId: c.sessionId,
      });
    }
  }
  return out;
}

export async function regleSuiviEntrepriseOpco(now: Date): Promise<AlerteCandidate[]> {
  if (!(await tablesSuiviDisponibles())) return [];
  const bruts = await prisma.dossierFinancement.findMany({
    where: {
      statut: { not: "clos" },
      suiviEntreprise: { isNot: null },
      trainingSession: { dateDebut: { gte: new Date(now.getTime() - RETARD_MAX_JOURS * JOUR_MS) } },
    },
    orderBy: { createdAt: "asc" },
    take: PLAFOND_DOSSIERS,
    select: SELECT_DOSSIER_SUIVI,
  });
  const contextes = bruts.map(contexteSuivi).filter((c): c is ContexteSuivi => c !== null);
  return candidatsSuiviEntreprise(contextes, now);
}
