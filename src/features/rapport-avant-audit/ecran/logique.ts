/**
 * Écran « Rapport d'analyse » — toute la LOGIQUE, sans base ni réseau (PUR, testé).
 *
 *   · `rappelReponses` : « réponses reçues : rapport pas lancé » / « nouvelles réponses : relancer » ;
 *   · `etatBoutonLancer` : actif ou éteint, avec la raison en français simple ;
 *   · `decisionTelechargement` : réservée au super-administrateur ;
 *   · `listerPropositions` / `planifierCompletion` : la liste « Compléter la fiche » et ce qu'un
 *     clic écrirait. ⛔ Un champ déjà rempli n'est JAMAIS remplacé ; le SIREN n'est jamais écrit
 *     par cette liste (il a son propre bouton, `poserSirenDepuisRapportAction`) ; le SIRET,
 *     l'adresse e-mail et tout champ inconnu sont à recopier à la main.
 */

import {
  FORMATS_TELECHARGEMENT,
  STATUTS_AVEC_BASE,
  STATUTS_EN_COURS,
  type FormatTelechargement,
  type PropositionFiche,
  type ResumeRapport,
} from "./contrat";

export const ROLE_AUTORISE = "super_admin";
export const RESERVE_SUPER_ADMIN = "Réservé au super-administrateur.";

export const estSuperAdmin = (role: string | null | undefined): boolean => role === ROLE_AUTORISE;

const aUneBase = (r: ResumeRapport): boolean => STATUTS_AVEC_BASE.includes(r.statut);
const tourne = (r: ResumeRapport): boolean => STATUTS_EN_COURS.includes(r.statut);

/** Le plus récent rapport dont la base est lisible, ou `null`. */
export function dernierRapportLisible(
  rapports: ReadonlyArray<ResumeRapport>,
): ResumeRapport | null {
  return rapports.find(aUneBase) ?? null;
}

export function analyseEnCours(rapports: ReadonlyArray<ResumeRapport>): boolean {
  return rapports.some(tourne);
}

// ── Rappel ───────────────────────────────────────────────────────────────────

export type GenreRappel =
  "sans_reponse" | "en_cours" | "pas_lance" | "echec" | "nouvelles" | "a_jour";

export interface Rappel {
  readonly genre: GenreRappel;
  /** `attention` : quelque chose attend Will. */
  readonly ton: "neutre" | "attention";
  readonly texte: string;
}

const pluriel = (n: number, un: string, plusieurs: string): string =>
  `${n} ${n > 1 ? plusieurs : un}`;

/**
 * Ce que l'écran rappelle à Will. `datesReponses` : la date de réception de chaque réponse au
 * questionnaire (réponses mises à l'écart exclues). `rapports` : le plus récent d'abord.
 */
export function rappelReponses(
  datesReponses: ReadonlyArray<Date>,
  rapports: ReadonlyArray<ResumeRapport>,
): Rappel {
  if (datesReponses.length === 0) {
    return {
      genre: "sans_reponse",
      ton: "neutre",
      texte: "Aucune réponse au questionnaire pour l'instant : l'analyse attendra les réponses.",
    };
  }
  if (analyseEnCours(rapports)) {
    return {
      genre: "en_cours",
      ton: "neutre",
      texte: "Une analyse est en cours. Cette page montre où elle en est.",
    };
  }
  const dernier = dernierRapportLisible(rapports);
  if (dernier === null) {
    if (rapports.length > 0) {
      return {
        genre: "echec",
        ton: "attention",
        texte: "Le dernier lancement n'a pas abouti : relancez l'analyse.",
      };
    }
    return {
      genre: "pas_lance",
      ton: "attention",
      texte: `Réponses reçues (${datesReponses.length}) : le rapport n'a pas encore été lancé.`,
    };
  }
  const reference = (dernier.reponsesJusquau ?? dernier.lanceLe).getTime();
  const nouvelles = datesReponses.filter((d) => d.getTime() > reference).length;
  if (nouvelles > 0) {
    return {
      genre: "nouvelles",
      ton: "attention",
      texte: `Nouvelles réponses depuis le dernier rapport (${pluriel(nouvelles, "réponse", "réponses")}) : relancez l'analyse pour en tenir compte.`,
    };
  }
  return {
    genre: "a_jour",
    ton: "neutre",
    texte: "Le dernier rapport tient compte de toutes les réponses reçues.",
  };
}

// ── Bouton « Lancer l'analyse complète » ─────────────────────────────────────

export interface EntreeBouton {
  readonly role: string | null | undefined;
  readonly interrupteurAllume: boolean;
  readonly branche: boolean;
  readonly nbReponses: number;
  readonly rapports: ReadonlyArray<ResumeRapport>;
}

export interface EtatBouton {
  readonly actif: boolean;
  readonly libelle: string;
  /** Pourquoi le bouton est éteint ; `null` s'il est actif. */
  readonly raison: string | null;
}

export const RAISON_INTERRUPTEUR =
  "L'analyse est éteinte sur ce site (réglage « RAPPORT_AVANT_AUDIT_ENABLED »). Rien ne peut être lancé tant qu'elle l'est.";
export const RAISON_NON_BRANCHE =
  "L'analyse n'est pas encore installée sur ce site : elle arrive avec une prochaine mise à jour.";
export const RAISON_SANS_REPONSE =
  "Aucune réponse au questionnaire : il n'y a encore rien à analyser.";
export const RAISON_EN_COURS = "Une analyse est déjà en cours : attendez qu'elle se termine.";

/** L'ordre des raisons compte : la première vraie est celle que Will lit. */
export function etatBoutonLancer(e: EntreeBouton): EtatBouton {
  const libelle =
    dernierRapportLisible(e.rapports) === null
      ? "Lancer l'analyse complète"
      : "Relancer l'analyse complète";
  const raison = !estSuperAdmin(e.role)
    ? RESERVE_SUPER_ADMIN
    : !e.branche
      ? RAISON_NON_BRANCHE
      : !e.interrupteurAllume
        ? RAISON_INTERRUPTEUR
        : e.nbReponses === 0
          ? RAISON_SANS_REPONSE
          : analyseEnCours(e.rapports)
            ? RAISON_EN_COURS
            : null;
  return { actif: raison === null, libelle, raison };
}

// ── Progression ──────────────────────────────────────────────────────────────

const LIBELLES_STATUT: Readonly<Record<ResumeRapport["statut"], string>> = {
  en_attente: "En attente de démarrage",
  en_cours: "En cours",
  termine: "Terminé",
  echoue: "N'a pas abouti",
};

export const libelleStatut = (r: ResumeRapport): string => LIBELLES_STATUT[r.statut];

/** Pourcentage d'avancement : 100 pour un rapport terminé, sinon borné à 0-99. */
export function pourcentage(r: ResumeRapport): number {
  if (r.statut === "termine") return 100;
  if (!Number.isFinite(r.progression)) return 0;
  return Math.max(0, Math.min(99, Math.round(r.progression)));
}

const nombre = new Intl.NumberFormat("fr-FR");

/** « 12 345 jetons lus, 6 789 jetons écrits ». */
export function libelleJetons(r: ResumeRapport): string {
  return `${nombre.format(r.jetonsEntree)} jetons lus, ${nombre.format(r.jetonsSortie)} jetons écrits`;
}

// ── Téléchargements ──────────────────────────────────────────────────────────

export type Decision =
  | { readonly ok: true }
  | { readonly ok: false; readonly statut: 400 | 403 | 404 | 409; readonly texte: string };

export const estFormat = (f: string | null | undefined): f is FormatTelechargement =>
  typeof f === "string" && (FORMATS_TELECHARGEMENT as ReadonlyArray<string>).includes(f);

/** Les deux documents qui n'existent que pour une base `base-audit/2`. */
export const FORMATS_VERSION_2 = ["automatisations-html", "schema-html"] as const;
export const VERSION_2_REQUISE =
  "Ce document n'existe que pour une analyse lancée après la mise à jour : relancez l'analyse";

export function decisionTelechargement(e: {
  readonly role: string | null | undefined;
  readonly format: string | null | undefined;
  readonly rapport: ResumeRapport | null;
}): Decision {
  if (!estSuperAdmin(e.role)) return { ok: false, statut: 403, texte: RESERVE_SUPER_ADMIN };
  if (!estFormat(e.format)) return { ok: false, statut: 400, texte: "Demande invalide." };
  if (e.rapport === null) return { ok: false, statut: 404, texte: "Introuvable." };
  if (!aUneBase(e.rapport)) {
    return { ok: false, statut: 409, texte: "Ce rapport n'est pas terminé : rien à télécharger." };
  }
  if (
    (FORMATS_VERSION_2 as ReadonlyArray<string>).includes(e.format) &&
    e.rapport.versionSchema !== "base-audit/2"
  ) {
    return { ok: false, statut: 409, texte: VERSION_2_REQUISE };
  }
  return { ok: true };
}

/**
 * « Compléter la fiche » (et « Poser ce SIREN ») : super-administrateur, rapport de CE client,
 * terminé. Décision propre à la complétion : ses textes parlent de la fiche.
 */
export function decisionCompletion(e: {
  readonly role: string | null | undefined;
  readonly rapport: ResumeRapport | null;
}): Decision {
  if (!estSuperAdmin(e.role)) return { ok: false, statut: 403, texte: RESERVE_SUPER_ADMIN };
  if (e.rapport === null) return { ok: false, statut: 404, texte: "Rapport introuvable." };
  if (!aUneBase(e.rapport)) {
    return {
      ok: false,
      statut: 409,
      texte: "Ce rapport n'est pas terminé : rien ne peut compléter la fiche.",
    };
  }
  return { ok: true };
}

// ── « Compléter la fiche » ───────────────────────────────────────────────────

/** Les champs de la fiche qu'une proposition peut remplir (tous acceptés par `updateClientAction`). */
export const CHAMPS_FICHE = [
  "secteur",
  "nafCode",
  "conventionCollective",
  "idcc",
  "adresseRue",
  "adresseCodePostal",
  "adresseVille",
  "tvaIntracom",
  "contactNom",
  "contactTelephone",
  "contactFonction",
] as const;
export type ChampFiche = (typeof CHAMPS_FICHE)[number];

/** Les valeurs actuelles de la fiche pour ces champs, plus le SIREN. */
export type FicheActuelle = Readonly<Record<ChampFiche | "siren", string | null>>;

export const LIBELLES_CHAMPS: Readonly<Record<ChampFiche | "siren", string>> = {
  secteur: "Secteur d'activité",
  nafCode: "Code NAF",
  conventionCollective: "Convention collective",
  idcc: "Code IDCC",
  adresseRue: "Adresse (rue)",
  adresseCodePostal: "Code postal",
  adresseVille: "Ville",
  tvaIntracom: "Numéro de TVA",
  contactNom: "Nom du contact",
  contactTelephone: "Téléphone du contact",
  contactFonction: "Fonction du contact",
  siren: "SIREN",
};

const normaliser = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

type Cible = ChampFiche | "siren" | "siret" | "email";

const ALIAS: ReadonlyArray<readonly [Cible, ReadonlyArray<string>]> = [
  ["secteur", ["secteur", "secteur d activite", "activite"]],
  ["nafCode", ["naf", "code naf", "ape", "code ape", "naf ape", "code naf ape", "nafcode"]],
  ["conventionCollective", ["convention collective", "conventioncollective"]],
  ["idcc", ["idcc", "code idcc"]],
  ["adresseRue", ["adresse", "rue", "adresse rue", "adresserue", "adresse du siege"]],
  ["adresseCodePostal", ["code postal", "cp", "adresse code postal", "adressecodepostal"]],
  ["adresseVille", ["ville", "commune", "adresse ville", "adresseville"]],
  [
    "tvaIntracom",
    ["tva", "tva intracommunautaire", "numero de tva", "numero tva", "tvaintracom", "n tva"],
  ],
  ["contactNom", ["contact", "nom du contact", "contact nom", "contactnom"]],
  [
    "contactTelephone",
    ["telephone", "tel", "telephone du contact", "contact telephone", "contacttelephone"],
  ],
  ["contactFonction", ["fonction du contact", "contact fonction", "contactfonction"]],
  ["siren", ["siren", "numero siren"]],
  ["siret", ["siret", "numero siret"]],
  ["email", ["email", "e mail", "adresse e mail", "courriel", "contact email", "contactemail"]],
];

/** Le champ de la fiche visé par le libellé libre d'une proposition, ou `null`. PUR. */
export function cibleDuChamp(champ: string): Cible | null {
  const n = normaliser(champ);
  for (const [cible, alias] of ALIAS) if (alias.includes(n)) return cible;
  return null;
}

const LONGUEURS: Readonly<Record<ChampFiche, number>> = {
  secteur: 200,
  nafCode: 6,
  conventionCollective: 200,
  idcc: 10,
  adresseRue: 300,
  adresseCodePostal: 12,
  adresseVille: 120,
  tvaIntracom: 40,
  contactNom: 200,
  contactTelephone: 40,
  contactFonction: 150,
};

/** La valeur telle qu'elle serait écrite, ou `null` si elle n'a pas la bonne forme. PUR. */
export function valeurPourLeChamp(champ: ChampFiche | "siren", brute: string): string | null {
  const v = brute.trim();
  if (v === "") return null;
  switch (champ) {
    case "siren": {
      const s = v.replace(/\s/g, "");
      return /^\d{9}$/.test(s) ? s : null;
    }
    case "nafCode": {
      const s = v.replace(/\s/g, "").toUpperCase();
      return /^\d{2}\.?\d{2}[A-Z]$/.test(s) ? s : null;
    }
    case "idcc": {
      const s = v.replace(/\s/g, "");
      return /^\d{1,4}$/.test(s) ? s : null;
    }
    case "adresseCodePostal": {
      const s = v.replace(/\s/g, "");
      return /^\d{5}$/.test(s) ? s : null;
    }
    case "tvaIntracom": {
      const s = v.replace(/\s/g, "").toUpperCase();
      return /^FR[0-9A-Z]{2}\d{9}$/.test(s) ? s : null;
    }
    default:
      return v.length <= LONGUEURS[champ] ? v : null;
  }
}

const vide = (v: string | null | undefined): boolean =>
  v === null || v === undefined || v.trim() === "";

export const LIBELLES_CONFIANCE: Readonly<Record<PropositionFiche["confiance"], string>> = {
  etabli: "Sûre",
  probable: "Probable",
  hypothese: "À vérifier",
};

export type EtatProposition =
  /** Champ vide, valeur valable : case à cocher. */
  | "a_cocher"
  /** Le champ a déjà une valeur : jamais remplacée. */
  | "deja_rempli"
  /** SIREN vide sur la fiche : bouton à part, « Poser ce SIREN ». */
  | "siren"
  /** Champ que la liste n'écrit pas (SIRET, e-mail, inconnu) : à recopier soi-même. */
  | "a_recopier"
  /** Valeur dont la forme ne convient pas (code postal à 4 chiffres…). */
  | "invalide";

export interface LigneProposition {
  /** Clé stable pour CE rapport : `p<rang>`. */
  readonly cle: string;
  readonly champ: string;
  readonly champFiche: ChampFiche | "siren" | null;
  readonly valeur: string;
  /** Valeur normalisée qui serait écrite (`null` si rien ne serait écrit). */
  readonly valeurAEcrire: string | null;
  readonly valeurActuelle: string | null;
  readonly source: string;
  readonly confiance: string;
  readonly etat: EtatProposition;
  readonly explication: string;
}

const cleDe = (rang: number): string => `p${rang}`;

function sourceLisible(p: PropositionFiche): string {
  return p.sources.map((s) => s.reference).join(" · ");
}

/** La liste « Compléter la fiche », dans l'ordre des propositions. PUR. */
export function listerPropositions(
  propositions: ReadonlyArray<PropositionFiche>,
  fiche: FicheActuelle,
): ReadonlyArray<LigneProposition> {
  return propositions.map((p, rang) => {
    const cible = cibleDuChamp(p.champ);
    const commun = {
      cle: cleDe(rang),
      champ: p.champ,
      valeur: p.valeur,
      source: sourceLisible(p),
      confiance: LIBELLES_CONFIANCE[p.confiance],
    };
    if (cible === null || cible === "siret" || cible === "email") {
      return {
        ...commun,
        champFiche: null,
        valeurAEcrire: null,
        valeurActuelle: null,
        etat: "a_recopier" as const,
        explication:
          cible === "siret"
            ? "Le SIRET se saisit dans « Éditer » (le SIREN en est tiré) : vérifiez-le d'abord."
            : cible === "email"
              ? "Une adresse e-mail se vérifie et se saisit à la main dans « Éditer »."
              : "Ce renseignement n'a pas de case sur la fiche : recopiez-le à la main si utile.",
      };
    }
    const actuelle = fiche[cible];
    const aEcrire = valeurPourLeChamp(cible, p.valeur);
    const base = { ...commun, champFiche: cible, valeurActuelle: vide(actuelle) ? null : actuelle };
    if (!vide(actuelle)) {
      return {
        ...base,
        valeurAEcrire: null,
        etat: "deja_rempli" as const,
        explication: "Déjà rempli sur la fiche : la valeur actuelle est gardée.",
      };
    }
    if (aEcrire === null) {
      return {
        ...base,
        valeurAEcrire: null,
        etat: "invalide" as const,
        explication: "La forme de cette valeur ne convient pas : à vérifier à la main.",
      };
    }
    if (cible === "siren") {
      return {
        ...base,
        valeurAEcrire: aEcrire,
        etat: "siren" as const,
        explication: "Le SIREN se pose seul, par son propre bouton, après vérification.",
      };
    }
    return {
      ...base,
      valeurAEcrire: aEcrire,
      etat: "a_cocher" as const,
      explication: "Champ vide sur la fiche : cochez pour le remplir.",
    };
  });
}

export interface PlanCompletion {
  /** Ce qui sera transmis à `updateClientAction` (uniquement des champs VIDES). */
  readonly aEcrire: Readonly<Partial<Record<ChampFiche, string>>>;
  readonly ecrits: ReadonlyArray<{
    readonly champ: ChampFiche;
    readonly valeur: string;
    readonly source: string;
  }>;
  readonly refuses: ReadonlyArray<{ readonly cle: string; readonly raison: string }>;
}

/**
 * Ce qu'un clic « Compléter la fiche » écrirait. `fiche` est relue AU MOMENT DU CLIC : un champ
 * rempli entre l'affichage et le clic est refusé. Deux propositions cochées pour le même champ :
 * la première seulement. PUR.
 */
export function planifierCompletion(
  propositions: ReadonlyArray<PropositionFiche>,
  fiche: FicheActuelle,
  clesCochees: ReadonlyArray<string>,
): PlanCompletion {
  const lignes = new Map(listerPropositions(propositions, fiche).map((l) => [l.cle, l]));
  const aEcrire: Partial<Record<ChampFiche, string>> = {};
  const ecrits: Array<{ champ: ChampFiche; valeur: string; source: string }> = [];
  const refuses: Array<{ cle: string; raison: string }> = [];
  for (const cle of new Set(clesCochees)) {
    const l = lignes.get(cle);
    if (l === undefined) {
      refuses.push({ cle, raison: "Proposition inconnue." });
      continue;
    }
    if (l.etat !== "a_cocher" || l.champFiche === null || l.champFiche === "siren") {
      refuses.push({ cle, raison: l.explication });
      continue;
    }
    const champ = l.champFiche;
    if (aEcrire[champ] !== undefined) {
      refuses.push({ cle, raison: "Une autre valeur est déjà retenue pour ce champ." });
      continue;
    }
    if (l.valeurAEcrire === null) {
      refuses.push({ cle, raison: l.explication });
      continue;
    }
    aEcrire[champ] = l.valeurAEcrire;
    ecrits.push({ champ, valeur: l.valeurAEcrire, source: l.source });
  }
  return { aEcrire, ecrits, refuses };
}

// ── Fiche hôte ───────────────────────────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * L'identifiant du client tiré de l'adresse de sa fiche (`…/qualiopi/clients/<uuid>`), ou `null`.
 * Le bloc est logé dans `BlocQuestionnaireFiche`, qui reçoit cette adresse et pas l'identifiant
 * (la page fiche client est figée par le lot 0 : `les-emplacements-sont-poses.spec.ts`). PUR.
 */
export function clientIdDeLaFiche(ficheHref: string): string | null {
  const m = /\/qualiopi\/clients\/([^/?#]+)\/?$/.exec(ficheHref);
  const id = m?.[1]?.toLowerCase() ?? "";
  return UUID.test(id) ? id : null;
}
