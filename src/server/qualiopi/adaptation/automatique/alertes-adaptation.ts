/**
 * Chantier QNC, lot L04 — les deux alertes de l'adaptation automatique.
 *
 *   · `adaptation_cas_complexe` : interprète, matériel, financement, autre
 *     aménagement, demande d'échange, ou précisions refusées. Le référent doit
 *     répondre PAR ÉCRIT avant la formation — dans la colonne « Adaptations »
 *     de la fiche session (`setEnrollmentAdaptationsAction`). L'alerte ne se
 *     ferme QU'AINSI : la résolution à la main est refusée
 *     (`CODES_FERMES_PAR_REPONSE_ECRITE`).
 *   · `adaptation_utilite_a_examiner` : le stagiaire a répondu « non » à « les
 *     aménagements vous ont-ils été utiles ? ». Elle ouvre un examen.
 *
 * 🔴 Comme `besoin-adaptation.ts` : ces fonctions ne REÇOIVENT pas le besoin,
 * ni les mesures demandées. Le texte d'une alerte est figé en base, recopié en
 * pastille et en notification, et lisible par tout administrateur — le référent
 * lit le détail sur la fiche stagiaire, lecture réservée et journalisée.
 *
 * ⚠️ Module PUR.
 */

export const CODE_ALERTE_CAS_COMPLEXE = "adaptation_cas_complexe";
export const CODE_ALERTE_UTILITE = "adaptation_utilite_a_examiner";

/** Codes qu'aucun clic « Résoudre » ne ferme : seule la réponse écrite les ferme. */
export const CODES_FERMES_PAR_REPONSE_ECRITE: readonly string[] = [CODE_ALERTE_CAS_COMPLEXE];

export const MESSAGE_RESOLUTION_REFUSEE =
  "Cette alerte se ferme par la réponse écrite du référent : consignez-la dans la colonne " +
  "« Adaptations (ind. 10) » de la fiche session.";

const instantParis = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeStyle: "medium",
  timeZone: "Europe/Paris",
});
const jourParis = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "full",
  timeZone: "Europe/Paris",
});

export interface PersonnePourAlerte {
  readonly prenom: string;
  readonly nom: string;
  readonly sessionNumero: string;
  readonly dateDebut: Date;
}

export function construireAlerteCasComplexe(p: PersonnePourAlerte & { readonly declareLe: Date }): {
  titre: string;
  message: string;
} {
  const identite = `${p.prenom} ${p.nom}`.trim();
  return {
    titre: "Adaptation : cas à traiter par le référent, réponse écrite attendue",
    // Le message porte l'instant de la déclaration : une nouvelle déclaration
    // n'est pas écartée par le dédoublonnage (cf. `besoin-adaptation.ts`).
    message:
      `${identite} (session ${p.sessionNumero}) a déclaré le ${instantParis.format(p.declareLe)} ` +
      `un besoin d'adaptation qui ne relève pas des mesures standard. Lisez le détail sur sa ` +
      `fiche stagiaire (lecture réservée au référent), puis répondez PAR ÉCRIT avant le ` +
      `${jourParis.format(p.dateDebut)} dans la colonne « Adaptations (ind. 10) » de la fiche ` +
      `session. Cette alerte ne se ferme qu'avec cette réponse.`,
  };
}

export function construireAlerteUtilite(p: PersonnePourAlerte & { readonly reponduLe: Date }): {
  titre: string;
  message: string;
} {
  const identite = `${p.prenom} ${p.nom}`.trim();
  return {
    titre: "Aménagements jugés non utiles par un stagiaire : examen à mener",
    message:
      `${identite} (session ${p.sessionNumero}) a répondu le ${instantParis.format(p.reponduLe)} ` +
      `que les aménagements prévus ne lui ont pas été utiles. Examinez avec le référent ce qui ` +
      `n'a pas fonctionné et, si besoin, ouvrez une action d'amélioration.`,
  };
}
