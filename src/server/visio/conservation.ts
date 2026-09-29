/**
 * Conservation codée du dossier client et des enregistrements (B1, ADR 0056 ;
 * chantier visio, PR 8). Fonctions PURES : elles calculent des échéances, la
 * base est lue et effacée par `src/lib/rgpd-erase.ts` (seul module autorisé à
 * poser le drapeau d'effacement), planifié par `retention-purge-worker.ts`.
 *
 * Les durées viennent de `CONSERVATION_VISIO` (`src/content/visio-annonce-textes.ts`),
 * celles-là mêmes que la notice écrit en toutes lettres. La garde
 * `src/content/__tests__/une-duree-annoncee-a-sa-purge.spec.ts` relit la
 * notice et compare : une durée annoncée sans purge, ou l'inverse, rougit.
 *
 * ## Les ancres (LOTS-EXECUTION §5, PR 8)
 *
 * - **prospect** (aucune facture émise, aucun devis accepté) : 3 ans après la
 *   dernière rencontre ou le dernier fait constaté ;
 * - **client** : 5 ans après `max(dernière rencontre TENUE, dernière facture
 *   émise, dernier devis accepté)` ;
 * - **fiche absorbée par une fusion** (non défaite) : l'échéance de la fiche
 *   ABSORBANTE — une fusion ne raccourcit ni n'allonge rien ;
 * - **rencontre jamais rattachée** : sa date + 3 ans ;
 * - **preuve d'accord** : fin de conservation du dossier + 5 ans.
 *
 * Aucune fonction ici ne regarde une pièce légale pour la SUPPRIMER : les
 * factures et devis ne sont lus que comme ancres de date.
 */

import { CONSERVATION_VISIO } from "@/content/visio-annonce-textes";

const JOUR_MS = 86_400_000;

/** `date` décalée de `ans` années (UTC). */
export function plusAns(date: Date, ans: number): Date {
  const d = new Date(date.getTime());
  d.setUTCFullYear(d.getUTCFullYear() + ans);
  return d;
}

/** `date` décalée de `mois` mois (UTC). */
export function plusMois(date: Date, mois: number): Date {
  const d = new Date(date.getTime());
  d.setUTCMonth(d.getUTCMonth() + mois);
  return d;
}

/** `maintenant` moins `jours` jours. */
export function ilYA(maintenant: Date, jours: number): Date {
  return new Date(maintenant.getTime() - jours * JOUR_MS);
}

function plusRecente(dates: ReadonlyArray<Date | null | undefined>): Date | null {
  let max: Date | null = null;
  for (const d of dates) if (d && (!max || d.getTime() > max.getTime())) max = d;
  return max;
}

/** Ce qu'on sait d'une fiche pour dater la fin de sa conservation. */
export interface AncresDossier {
  /** Dernière rencontre, quel que soit son statut (date prévue ou réelle). */
  readonly derniereRencontre: Date | null;
  /** Dernière rencontre TENUE. */
  readonly derniereRencontreTenue: Date | null;
  /** Dernier fait constaté (un dossier peut n'avoir que des faits de questionnaire). */
  readonly dernierFait: Date | null;
  /** Dernière facture ÉMISE (`emiseAt`). */
  readonly derniereFacture: Date | null;
  /** Dernier devis ACCEPTÉ (`acceptedAt`). */
  readonly dernierDevisAccepte: Date | null;
}

/** Régime d'une fiche : client dès qu'une facture est émise ou un devis accepté. */
export function regimeDossier(a: AncresDossier): "client" | "prospect" {
  return a.derniereFacture || a.dernierDevisAccepte ? "client" : "prospect";
}

/**
 * Date à laquelle le dossier (comptes rendus, faits, questionnaires, e-mails
 * de suivi) doit être effacé ; `null` si rien ne l'ancre (une fiche sans
 * rencontre ni fait n'a rien à purger).
 */
export function finConservationDossier(a: AncresDossier): Date | null {
  if (regimeDossier(a) === "client") {
    const ancre = plusRecente([a.derniereRencontreTenue, a.derniereFacture, a.dernierDevisAccepte]);
    return ancre ? plusAns(ancre, CONSERVATION_VISIO.clientAns) : null;
  }
  const ancre = plusRecente([a.derniereRencontre, a.dernierFait]);
  return ancre ? plusAns(ancre, CONSERVATION_VISIO.prospectAns) : null;
}

/** Fin de conservation d'une rencontre jamais rattachée à une fiche. */
export function finConservationRencontreOrpheline(dateRencontre: Date): Date {
  return plusAns(dateRencontre, CONSERVATION_VISIO.prospectAns);
}

/** Fin de conservation d'une preuve d'accord : fin du dossier + 5 ans. */
export function finConservationPreuve(finDossier: Date): Date {
  return plusAns(finDossier, CONSERVATION_VISIO.preuvesApresDossierAns);
}

/**
 * Échéance EFFECTIVE de chaque fiche, fusions comprises : une fiche absorbée
 * (fusion non défaite) prend l'échéance de l'absorbante, en suivant la chaîne
 * (A absorbée par B, elle-même absorbée par C → échéance de C). Une boucle —
 * impossible en principe — s'arrête sur la fiche déjà vue plutôt que de
 * tourner sans fin.
 */
export function echeancesAvecFusions(
  propres: ReadonlyMap<string, Date | null>,
  absorbeePar: ReadonlyMap<string, string>,
): Map<string, Date | null> {
  const resultat = new Map<string, Date | null>();
  for (const id of propres.keys()) {
    let courant = id;
    const vus = new Set<string>([courant]);
    while (absorbeePar.has(courant)) {
      const suivant = absorbeePar.get(courant)!;
      if (vus.has(suivant)) break;
      vus.add(suivant);
      courant = suivant;
    }
    resultat.set(
      id,
      propres.has(courant) ? (propres.get(courant) ?? null) : (propres.get(id) ?? null),
    );
  }
  return resultat;
}

/** Seuils du jour, tous dérivés de `CONSERVATION_VISIO`. */
export function seuilsDuJour(maintenant: Date) {
  return {
    /** Segments des enregistrements commencés avant cette date. */
    segmentsAvant: plusMois(maintenant, -CONSERVATION_VISIO.segmentsMois),
    /** Versions `remplace` / `rejete` créées avant cette date. */
    versionsAvant: ilYA(maintenant, CONSERVATION_VISIO.versionsJours),
    /** Faits `rejete` créés avant cette date. */
    faitsRejetesAvant: ilYA(maintenant, CONSERVATION_VISIO.faitsRejetesJours),
  };
}
