/**
 * Formateurs indépendants — ÉTAPE du parcours, calculée (lot L8, plan 08 §2.2
 * à §2.4).
 *
 * Principe repris des apporteurs (`etape-suivi-apporteur.ts`) : AUCUNE colonne
 * d'« étape ». L'étape est déduite des faits en base (dossier, contrôle du
 * registre, contrat-cadre v3, activation, fin de collaboration) par cette
 * fonction pure, lue de la même façon par la liste, les compteurs et les
 * onglets. Libellés des apporteurs : verbe + date.
 *
 * Les étapes de la CANDIDATURE (§2.1 : invitation, échange, issue) restent dans
 * la vue « Candidatures » du groupe (L0h) : une fiche `Trainer` n'existe
 * qu'après « Retenu ».
 */

export type CleEtape =
  | "termine"
  | "actif"
  | "retire"
  | "registre_rouge"
  | "contresigne"
  | "contrat_signe"
  | "dossier_recu"
  | "dossier_a_completer"
  | "dossier_verifie"
  | "dossier_ouvert"
  | "fiche_creee";

export type Onglet = "actifs" | "a_verifier" | "dossier_en_cours" | "retires" | "termines";

export const LIBELLES_ONGLETS: Readonly<Record<Onglet, string>> = {
  actifs: "Actifs",
  a_verifier: "À vérifier",
  dossier_en_cours: "Dossier en cours",
  retires: "Retirés",
  termines: "Refusés ou terminés",
};

export const ORDRE_ONGLETS: ReadonlyArray<Onglet> = [
  "actifs",
  "a_verifier",
  "dossier_en_cours",
  "retires",
  "termines",
];

/** Ce que l'étape lit — rien de plus. */
export interface FaitsParcours {
  readonly actif: boolean;
  readonly finCollaborationAt: Date | null;
  readonly activationValideeAt: Date | null;
  readonly dossierStatut: "en_cours" | "a_verifier" | "a_completer" | "verifie" | null;
  readonly dossierOuvertAt: Date | null;
  readonly dossierEnvoyeAt: Date | null;
  readonly dossierVerifieAt: Date | null;
  /** Verdict du dernier contrôle du registre, ou `null`. */
  readonly dernierVerdict: "vert" | "orange" | "rouge" | null;
  /** Contrat-cadre v3+ le plus récent non annulé, ou `null`. */
  readonly contrat: {
    readonly statutSignature: string;
    readonly signeLe: Date | null;
    readonly contresigneLe: Date | null;
  } | null;
}

export interface Etape {
  readonly cle: CleEtape;
  readonly libelle: string;
  readonly onglet: Onglet;
  /** L'écran « Vérifier et contresigner » est le geste utile. */
  readonly aVerifier: boolean;
}

const JOUR = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Europe/Paris",
});

const le = (d: Date | null): string =>
  d instanceof Date && !Number.isNaN(d.getTime()) ? ` le ${JOUR.format(d)}` : "";

function etape(cle: CleEtape, libelle: string, onglet: Onglet, aVerifier = false): Etape {
  return { cle, libelle, onglet, aVerifier };
}

/** L'étape d'un formateur indépendant. `switch` exhaustif sur la clé : voir {@link LIBELLES_ONGLETS}. */
export function etapeFormateurIndependant(f: FaitsParcours): Etape {
  if (f.finCollaborationAt !== null) {
    return etape("termine", `Collaboration terminée${le(f.finCollaborationAt)}`, "termines");
  }
  if (f.actif) return etape("actif", "Actif", "actifs");
  if (f.activationValideeAt !== null) return etape("retire", "Retiré", "retires");
  if (f.dernierVerdict === "rouge")
    return etape("registre_rouge", "Registre rouge", "a_verifier", true);

  const c = f.contrat;
  if (c !== null && c.statutSignature === "signee") {
    return etape("contresigne", `Contrat contresigné${le(c.contresigneLe)}`, "a_verifier", true);
  }
  if (c !== null && c.statutSignature === "partielle") {
    return etape("contrat_signe", `Contrat signé${le(c.signeLe)}`, "a_verifier", true);
  }

  switch (f.dossierStatut) {
    case "a_verifier":
      return etape("dossier_recu", `Dossier reçu${le(f.dossierEnvoyeAt)}`, "a_verifier");
    case "a_completer":
      return etape("dossier_a_completer", "Complément demandé", "dossier_en_cours");
    case "verifie":
      return etape(
        "dossier_verifie",
        `Dossier vérifié${le(f.dossierVerifieAt)}`,
        "dossier_en_cours",
      );
    case "en_cours":
      return etape("dossier_ouvert", `Dossier ouvert${le(f.dossierOuvertAt)}`, "dossier_en_cours");
    case null:
      return etape("fiche_creee", "Fiche créée", "dossier_en_cours");
  }
}

/** Compteurs des cartes, par onglet. */
export function compterParOnglet(etapes: ReadonlyArray<Etape>): Record<Onglet, number> {
  const n = Object.fromEntries(ORDRE_ONGLETS.map((o) => [o, 0])) as Record<Onglet, number>;
  for (const e of etapes) n[e.onglet] += 1;
  return n;
}

export function estOnglet(x: unknown): x is Onglet {
  return typeof x === "string" && (ORDRE_ONGLETS as ReadonlyArray<string>).includes(x);
}
