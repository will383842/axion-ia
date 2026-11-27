/**
 * Rotation d'inspection d'URL (P5), tâche `inspection` du worker `seo-pilotage`.
 *
 * - Sous le quota PARTAGÉ (`quota.ts`) : usage « rotation », 1 400 par jour ; une réservation par
 *   appel (atomique), donc un suivi concurrent ne peut pas être dépassé.
 * - Débit : au moins 200 ms entre deux appels (≤ 300 par minute, moitié du plafond de Google).
 * - Une ligne `GscInspection` n'est écrite QUE si un champ change ; la date de dernier passage
 *   est tenue à part (Redis, `marquerVue`), sinon une page inchangée reviendrait chaque jour.
 * - Quota Google atteint ou identifiants absents : arrêt propre du passage. 5 erreurs de suite :
 *   arrêt aussi (Google en panne).
 *
 * Aucune requête de recherche ni donnée personnelle ici : des chemins de pages publiques.
 */
import { choisirPages, type CandidatInspection } from "./priorites";
import { INTERVALLE_MIN_MS, reserverInspections, type MagasinQuota } from "./quota";

export interface LigneInspection {
  readonly chemin: string;
  readonly verdict: string | null;
  readonly couverture: string | null;
  readonly canoniqueGoogle: string | null;
  readonly canoniqueDeclaree: string | null;
  readonly dernierPassageRobot: Date | null;
}

export type ResultatInspection =
  | { readonly etat: "ok"; readonly resultat: Partial<Omit<LigneInspection, "chemin">> }
  | { readonly etat: "quota" | "identifiants_absents" | "erreur" };

export type ArretRotation =
  "fini" | "quota_jour" | "quota_google" | "identifiants_absents" | "erreurs_de_suite";

export interface BilanRotation {
  inspectees: number;
  ecrites: number;
  inchangees: number;
  echecs: number;
  arret: ArretRotation;
}

export interface DepsRotation {
  readonly magasinQuota: MagasinQuota;
  readonly maintenant: () => Date;
  readonly attendre: (ms: number) => Promise<void>;
  readonly chargerCandidats: () => Promise<CandidatInspection[]>;
  readonly derniereLigne: (chemin: string) => Promise<Omit<LigneInspection, "chemin"> | null>;
  readonly ecrireLigne: (ligne: LigneInspection) => Promise<void>;
  readonly marquerVue: (chemin: string, quand: Date) => Promise<void>;
  readonly inspecter: (url: string) => Promise<ResultatInspection>;
}

export const URL_SITE = "https://axion-ia.com";
export const ERREURS_DE_SUITE_MAX = 5;

const instant = (d: Date | null | undefined): number | null => (d ? d.getTime() : null);

/** Vrai si une ligne doit être écrite : première ligne, ou un des cinq champs a changé. */
export function champsDifferents(
  avant: Omit<LigneInspection, "chemin"> | null,
  apres: Omit<LigneInspection, "chemin">,
): boolean {
  if (!avant) return true;
  return (
    avant.verdict !== apres.verdict ||
    avant.couverture !== apres.couverture ||
    avant.canoniqueGoogle !== apres.canoniqueGoogle ||
    avant.canoniqueDeclaree !== apres.canoniqueDeclaree ||
    instant(avant.dernierPassageRobot) !== instant(apres.dernierPassageRobot)
  );
}

export async function executerRotation(deps: DepsRotation): Promise<BilanRotation> {
  const bilan: BilanRotation = {
    inspectees: 0,
    ecrites: 0,
    inchangees: 0,
    echecs: 0,
    arret: "fini",
  };
  const candidats = await deps.chargerCandidats();
  const choisies = choisirPages(candidats, deps.maintenant(), candidats.length);
  let deSuite = 0;
  let premier = true;
  for (const page of choisies) {
    if ((await reserverInspections(deps.magasinQuota, "rotation", 1, deps.maintenant())) < 1) {
      bilan.arret = "quota_jour";
      return bilan;
    }
    if (!premier) await deps.attendre(INTERVALLE_MIN_MS);
    premier = false;
    const r = await deps.inspecter(`${URL_SITE}${page.chemin}`);
    if (r.etat !== "ok") {
      if (r.etat === "quota") {
        bilan.arret = "quota_google";
        return bilan;
      }
      if (r.etat === "identifiants_absents") {
        bilan.arret = "identifiants_absents";
        return bilan;
      }
      bilan.echecs++;
      if (++deSuite >= ERREURS_DE_SUITE_MAX) {
        bilan.arret = "erreurs_de_suite";
        return bilan;
      }
      continue;
    }
    deSuite = 0;
    const apres: Omit<LigneInspection, "chemin"> = {
      verdict: r.resultat.verdict ?? null,
      couverture: r.resultat.couverture ?? null,
      canoniqueGoogle: r.resultat.canoniqueGoogle ?? null,
      canoniqueDeclaree: r.resultat.canoniqueDeclaree ?? null,
      dernierPassageRobot: r.resultat.dernierPassageRobot ?? null,
    };
    const avant = await deps.derniereLigne(page.chemin);
    if (champsDifferents(avant, apres)) {
      await deps.ecrireLigne({ chemin: page.chemin, ...apres });
      bilan.ecrites++;
    } else {
      bilan.inchangees++;
    }
    await deps.marquerVue(page.chemin, deps.maintenant());
    bilan.inspectees++;
  }
  return bilan;
}
