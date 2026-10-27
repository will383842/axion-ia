/**
 * Tour France IA : les mots communs au registre des demandes (PR-2a).
 *
 * Module PUR, sans import : les statuts sont des chaînes (colonnes VARCHAR, aucune énumération
 * Postgres), et ces listes sont leur seule définition côté code.
 */

/** Le statut STOCKÉ d'une demande. « Rendez-vous pris » n'y est jamais : il est calculé. */
export const STATUTS_DEMANDE = ["recue", "relancee_main", "ecartee", "effacee_rgpd"] as const;
export type StatutDemande = (typeof STATUTS_DEMANDE)[number];

/** Le statut AFFICHÉ : le statut stocké, ou « rendez-vous pris » (calculé à la lecture). */
export const STATUTS_AFFICHES = [
  "rdv_pris",
  "relancee_main",
  "recue",
  "ecartee",
  "effacee_rgpd",
] as const;
export type StatutAffiche = (typeof STATUTS_AFFICHES)[number];

/** Où en est le rapprochement de la demande avec une fiche prospect de la console. */
export const RATTACHEMENTS = [
  "a_verifier",
  "fiche_completee",
  "a_arbitrer",
  "sans_fiche",
  "fiche_creee",
] as const;
export type Rattachement = (typeof RATTACHEMENTS)[number];

/** Pourquoi une fiche est « proche » d'une demande. `telephone` s'ajoute aux signaux de la porte. */
export type SignalDemande = "siren" | "email" | "domaine" | "nom_ville" | "telephone";

/** Une fiche proche, telle qu'elle est gardée sur la demande (JSON, jamais une fusion). */
export type FicheProcheStockee = {
  readonly ficheId: string;
  readonly numero: string;
  readonly raisonSociale: string;
  readonly signal: SignalDemande;
};

export const LIBELLE_STATUT_AFFICHE: Readonly<Record<StatutAffiche, string>> = {
  rdv_pris: "Rendez-vous pris",
  relancee_main: "Relancée à la main",
  recue: "Demande reçue",
  ecartee: "Écartée",
  effacee_rgpd: "Effacée (demande de la personne)",
};

export const LIBELLE_RATTACHEMENT: Readonly<Record<Rattachement, string>> = {
  a_verifier: "À vérifier",
  fiche_completee: "Fiche complétée",
  a_arbitrer: "À arbitrer",
  sans_fiche: "Sans fiche",
  fiche_creee: "Fiche créée",
};

export const LIBELLE_SIGNAL: Readonly<Record<SignalDemande, string>> = {
  siren: "même numéro SIREN",
  email: "même adresse e-mail",
  domaine: "même fin d'adresse professionnelle",
  nom_ville: "même nom dans la même ville",
  telephone: "même téléphone",
};

export function estStatutDemande(x: unknown): x is StatutDemande {
  return typeof x === "string" && (STATUTS_DEMANDE as ReadonlyArray<string>).includes(x);
}

export function estStatutAffiche(x: unknown): x is StatutAffiche {
  return typeof x === "string" && (STATUTS_AFFICHES as ReadonlyArray<string>).includes(x);
}

/** Lit une colonne `rattachement` ; une valeur inconnue vaut « à vérifier ». */
export function versRattachement(x: unknown): Rattachement {
  return typeof x === "string" && (RATTACHEMENTS as ReadonlyArray<string>).includes(x)
    ? (x as Rattachement)
    : "a_verifier";
}

const SIGNAUX: ReadonlyArray<string> = ["siren", "email", "domaine", "nom_ville", "telephone"];

/** Relit `fichesProches` (JSON de la base) : tout ce qui n'a pas la forme attendue est ignoré. PUR. */
export function lireFichesProches(valeur: unknown): FicheProcheStockee[] {
  if (!Array.isArray(valeur)) return [];
  const sortie: FicheProcheStockee[] = [];
  for (const brut of valeur as unknown[]) {
    if (typeof brut !== "object" || brut === null) continue;
    const o = brut as Record<string, unknown>;
    const { ficheId, numero, raisonSociale, signal } = o;
    if (
      typeof ficheId === "string" &&
      typeof numero === "string" &&
      typeof raisonSociale === "string" &&
      typeof signal === "string" &&
      SIGNAUX.includes(signal)
    ) {
      sortie.push({ ficheId, numero, raisonSociale, signal: signal as SignalDemande });
    }
  }
  return sortie;
}
