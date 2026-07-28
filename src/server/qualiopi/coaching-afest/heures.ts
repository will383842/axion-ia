/**
 * Qualiopi 1-to-1 / AFEST — calcul des heures réelles (C1, 2026-06-14).
 *
 * Règle FONDAMENTALE : les heures d'un parcours 1-to-1 = Σ des durées de séance
 * réellement réalisées (`CompteRenduSeance.dureeMinutes`), JAMAIS
 * `Formation.dureeHeures × taux` (logique des formations collectives).
 *
 * ## Pourquoi une FONCTION UNIQUE, gatée par régime
 *
 * Cette grandeur irrigue QUATRE surfaces qui doivent dire la même chose du même
 * parcours : l'attestation d'assiduité (`heures.ts`), la facture
 * (`facturation-1to1.ts`), le BPF (`bpf/service.ts`) et le certificat de
 * réalisation R.6313-3 avec les kits financeurs (`kits-1to1.ts`). Elles
 * divergeaient déjà — le BPF filtrait `estAfest` + `statut: realisee`, la
 * facture ne filtrait rien. Une facture qui ne dit pas la même chose que le
 * certificat du même parcours est un motif de redressement à elle seule.
 *
 * ## Pourquoi un régime PAR PARCOURS
 *
 * 🔴 Introduire de vraies signatures sans toucher au calcul ne corrigerait rien :
 * cela déplacerait simplement le faux positif des booléens vers `dureeMinutes`
 * non filtré. Mais appliquer le filtre « heures réellement signées » à TOUT
 * l'existant ferait BAISSER des montants OPCO / France Travail déjà déclarés et
 * RÉTROGRADER des attestations déjà remises.
 *
 * D'où `CoachingSession.regimePreuve`, avec `legacy_boolean` par défaut : à
 * l'issue de ce chantier, la production ne change strictement pas de
 * comportement. Le passage en `signature_reelle` est une décision explicite,
 * parcours par parcours, après validation chiffrée de l'impact.
 *
 * Fonctions pures (testables sans DB) + lecteurs DB stub-aware.
 */

import { prisma } from "@/lib/prisma";

/** Régime de preuve d'un parcours. Miroir de l'enum DB `coaching_regime_preuve`. */
export type RegimePreuve = "legacy_boolean" | "signature_reelle";

/** Statut d'une séance. Miroir de l'enum DB `coaching_seance_statut`. */
export type StatutSeance = "planifiee" | "realisee" | "annulee" | "absence_justifiee";

/**
 * Une séance, telle que les quatre surfaces doivent la lire.
 *
 * `signaturesBeneficiaire` est un TABLEAU (et non un booléen) parce que c'est la
 * forme que rend Prisma sur une relation filtrée : le convertir en booléen dans
 * chaque appelant est exactement l'endroit où les quatre surfaces
 * re-divergeraient.
 */
export interface SeancePourHeures {
  dureeMinutes: number | null;
  /** `undefined` sur les lectures legacy → traité comme `realisee`. */
  statut?: StatutSeance | null | undefined;
  presenceSigneeAt?: Date | null | undefined;
  beneficiairePresent?: boolean | undefined;
  /** Signatures `role='beneficiaire'` NON RÉVOQUÉES de cette séance. */
  signaturesBeneficiaire?: ReadonlyArray<unknown> | undefined;
}

/** Sélecteur Prisma partagé par les quatre surfaces — une seule vérité. */
export const SEANCE_HEURES_SELECT = {
  dureeMinutes: true,
  statut: true,
  presenceSigneeAt: true,
  beneficiairePresent: true,
  signatures: {
    where: { role: "beneficiaire" as const, revokedAt: null },
    select: { id: true },
    take: 1,
  },
} as const;

/** Normalise une ligne Prisma (relation nommée `signatures`) en entrée de calcul. */
export function versSeancePourHeures(cr: {
  dureeMinutes: number | null;
  statut?: StatutSeance | null;
  presenceSigneeAt?: Date | null;
  beneficiairePresent?: boolean;
  signatures?: ReadonlyArray<unknown>;
}): SeancePourHeures {
  return {
    dureeMinutes: cr.dureeMinutes,
    statut: cr.statut ?? null,
    presenceSigneeAt: cr.presenceSigneeAt ?? null,
    beneficiairePresent: cr.beneficiairePresent,
    signaturesBeneficiaire: cr.signatures ?? [],
  };
}

/**
 * Une séance annulée ou justifiée comme non tenue n'est NI comptée, NI bloquante.
 *
 * Vaut dans les DEUX régimes, et c'est sans effet rétroactif : la colonne
 * `statut` est arrivée avec un défaut `realisee`, donc aucune séance existante
 * n'en sort. Sans cette neutralisation, une absence légitime bloquait
 * l'attestation à vie (le gate exige que toutes les séances soient signées) et
 * gonflait les heures d'une séance qui n'a pas eu lieu.
 */
function neutralisee(s: SeancePourHeures): boolean {
  return s.statut === "annulee" || s.statut === "absence_justifiee";
}

/**
 * Heures réellement réalisées d'un parcours, selon son RÉGIME DE PREUVE.
 *
 * ## Régime `signature_reelle`
 *
 * Ne comptent que les séances portant une ligne `CoachingSeanceSignature`
 * `role='beneficiaire'` NON RÉVOQUÉE.
 *
 * 🔴 La LIGNE DE SIGNATURE EST LA SOURCE DE PRÉSENCE. `beneficiairePresent`
 * n'est plus qu'un cache d'affichage et n'entre PAS dans le critère : le
 * traiter comme co-critère ferait qu'un cache posé tardivement — ou dont
 * l'écriture a échoué — zéro-erait des heures pourtant réellement signées.
 *
 * ⚠️ Le critère est INDÉPENDANT DE LA MODALITÉ. Une `confirmation_accessible`
 * n'a pas d'image, et exiger une image exclurait précisément les signataires
 * qui ont besoin du chemin clavier / lecteur d'écran (ind. 26). Les trois
 * modalités valent présence probante ; le mode dégradé produit une ligne, donc
 * une séance clôturée en mode dégradé n'est jamais exclue des heures.
 *
 * ⚠️ La présence du TUTEUR conditionne l'admissibilité AFEST, JAMAIS les heures
 * facturables : un tuteur injoignable ne doit pas rendre une séance non
 * facturable.
 *
 * ## Régime `legacy_boolean`
 *
 * Comportement historique, préservé au caractère près : on n'exclut que les
 * absences explicitement ACTÉES (présence signée ET bénéficiaire déclaré
 * absent). On NE filtre PAS sur `beneficiairePresent` seul — ce booléen vaut
 * `false` tant que rien n'a été signé, si bien qu'un tel filtre mettrait à zéro
 * toutes les séances en attente.
 *
 * @returns heures décimales arrondies au centième (format réglementaire R.6313-3).
 */
export function heuresReellesSignees(
  comptesRendus: ReadonlyArray<SeancePourHeures>,
  regime: RegimePreuve,
): number {
  const minutes = comptesRendus.reduce((acc, cr) => {
    if (neutralisee(cr)) return acc;

    if (regime === "signature_reelle") {
      const signee = (cr.signaturesBeneficiaire?.length ?? 0) > 0;
      return signee ? acc + (cr.dureeMinutes ?? 0) : acc;
    }

    const absenceActee = cr.presenceSigneeAt != null && cr.beneficiairePresent === false;
    if (absenceActee) return acc;
    return acc + (cr.dureeMinutes ?? 0);
  }, 0);
  return Math.round((minutes / 60) * 100) / 100;
}

/**
 * Somme historique, régime `legacy_boolean`.
 *
 * ⚠️ Conservée pour les lectures d'AFFICHAGE qui n'ont pas le régime sous la
 * main (console). Toute surface qui produit une pièce OPPOSABLE — facture,
 * attestation, BPF, certificat — doit passer par `heuresReellesSignees` avec le
 * régime réel du parcours, sans exception.
 */
export function sumHeuresReelles(comptesRendus: ReadonlyArray<SeancePourHeures>): number {
  return heuresReellesSignees(comptesRendus, "legacy_boolean");
}

/**
 * Taux d'assiduité 1-to-1 = heures réalisées / heures prévues à la convention.
 *
 * 🔴 Audit certification 2026-07-26 (F65). Sans durée conventionnelle, la
 * fonction retournait **100 %** dès qu'une seule heure était réalisée — et ce
 * taux partait sur l'attestation. Un parcours de 2 h sur 30 prévues aurait été
 * attesté « 100 % d'assiduité » du seul fait qu'aucune durée n'était renseignée.
 *
 * Un taux d'assiduité SANS référence n'est pas 100 %, c'est un taux
 * **incalculable**. On retourne donc `null`, à charge de l'appelant d'afficher
 * « non calculable » plutôt qu'un chiffre flatteur et faux.
 *
 * @returns Le taux en %, ou `null` si aucune durée prévue n'est renseignée.
 */
export function computeTaux1to1(
  heuresReelles: number,
  heuresPrevues: number | null,
): number | null {
  if (heuresPrevues == null || heuresPrevues <= 0) {
    return null;
  }
  return Math.round((heuresReelles / heuresPrevues) * 100);
}

function estStub(): boolean {
  return process.env["DATABASE_URL"]?.includes("stub.invalid") === true;
}

/**
 * Heures réelles d'UN parcours, sous SON régime de preuve.
 *
 * Point d'entrée unique des surfaces qui raisonnent au grain du parcours
 * (attestation, certificat, kits financeurs). Stub-aware.
 */
export async function getHeuresReelles1to1(coachingSessionId: string): Promise<number> {
  if (estStub()) return 0;
  const cs = await prisma.coachingSession.findUnique({
    where: { id: coachingSessionId },
    select: { regimePreuve: true, comptesRendus: { select: SEANCE_HEURES_SELECT } },
  });
  if (cs === null) return 0;
  return heuresReellesSignees(cs.comptesRendus.map(versSeancePourHeures), cs.regimePreuve);
}

/**
 * Heures réelles d'un CONTRAT = Σ des parcours qu'il regroupe.
 *
 * ⚠️ Le régime se lit PAR PARCOURS, pas au contrat : un contrat peut regrouper
 * un parcours déjà basculé en `signature_reelle` et un parcours legacy. Sommer
 * sous un régime unique ferait mentir la facture sur l'un des deux.
 */
export async function getHeuresReellesContrat(coachingContractId: string): Promise<number> {
  if (estStub()) return 0;
  const sessions = await prisma.coachingSession.findMany({
    where: { coachingContractId },
    select: { regimePreuve: true, comptesRendus: { select: SEANCE_HEURES_SELECT } },
  });
  const total = sessions.reduce(
    (acc, cs) =>
      acc + heuresReellesSignees(cs.comptesRendus.map(versSeancePourHeures), cs.regimePreuve),
    0,
  );
  return Math.round(total * 100) / 100;
}
