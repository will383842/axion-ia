/**
 * Chantier QNC, lot L04 — CATALOGUE des mesures d'adaptation, et lecture de la
 * déclaration structurée du positionnement (NC1, NC4, NC12).
 *
 * ## Décision de Will (2026-10-16)
 *
 * Aucun appel systématique du stagiaire : il coche un TYPE de besoin, le
 * catalogue lui PROPOSE des mesures, il confirme en un clic (ou demande un
 * échange). Les mesures standard s'appliquent seules ; seuls les cas complexes
 * remontent au référent, qui répond par écrit dans la console.
 *
 * ## 🔴 Ce qui est donnée de santé, et ce qui ne l'est pas
 *
 * - le TYPE de besoin, les mesures COMPLEXES et le commentaire libre : ils ne
 *   vont qu'au référent, chiffrés sur la fiche stagiaire
 *   (`textePourReferent` → `chiffrerDetailSante`). Ils ne sont JAMAIS écrits
 *   dans la réponse du questionnaire (`retirerChampsDeclaration`).
 * - les mesures STANDARD retenues : c'est la réponse de l'organisme, consignée
 *   sur l'inscription (`texteConsignationAutomatique`) — ce que voient la fiche
 *   d'adaptation du formateur et la convocation. Aucun type n'y figure.
 *
 * ⚠️ Module PUR et sans import : il est tiré par le formulaire client du
 * portail ET par le serveur. Les deux appliquent la même liste.
 */

export const TYPES_BESOIN = [
  { code: "auditif", libelle: "Auditif" },
  { code: "visuel", libelle: "Visuel" },
  { code: "dys", libelle: "Troubles dys" },
  { code: "psychique", libelle: "Psychique ou cognitif" },
  { code: "chronique", libelle: "Maladie chronique ou fatigabilité" },
  { code: "mobilite", libelle: "Mobilité" },
  { code: "autre", libelle: "Autre" },
] as const;

export type TypeBesoin = (typeof TYPES_BESOIN)[number]["code"];

const TOUS: readonly TypeBesoin[] = TYPES_BESOIN.map((t) => t.code);

/** Pourquoi une mesure complexe remonte au référent. */
export type MotifCasComplexe =
  "interprete" | "materiel" | "financement" | "autre" | "echange" | "sans_precision";

export interface MesureCatalogue {
  readonly code: string;
  readonly libelle: string;
  readonly types: readonly TypeBesoin[];
  /** `null` : mesure standard, appliquée sans intervention. Sinon : le motif d'alerte. */
  readonly complexe: Exclude<MotifCasComplexe, "echange" | "sans_precision"> | null;
  /** La mesure porte sur les SUPPORTS : le formateur les transmet avant la formation. */
  readonly support: boolean;
}

/**
 * L'ordre est celui de l'affichage et de la consignation : standard d'abord,
 * complexes ensuite. Un code publié ne se renomme pas — il est relu dans les
 * réponses en base.
 */
export const MESURES: readonly MesureCatalogue[] = [
  {
    code: "supports_avance",
    libelle: "Supports de formation transmis à l'avance",
    types: ["auditif", "visuel", "dys", "psychique", "chronique"],
    complexe: null,
    support: true,
  },
  {
    code: "supports_agrandis",
    libelle: "Supports en grands caractères et contrastés",
    types: ["visuel", "dys"],
    complexe: null,
    support: true,
  },
  {
    code: "police_adaptee",
    libelle: "Supports en police adaptée, interligne aéré",
    types: ["dys"],
    complexe: null,
    support: true,
  },
  {
    code: "supports_numeriques_accessibles",
    libelle: "Supports numériques compatibles avec un lecteur d'écran",
    types: ["visuel"],
    complexe: null,
    support: true,
  },
  {
    code: "sous_titrage",
    libelle: "Sous-titrage ou transcription écrite des vidéos et des visios",
    types: ["auditif"],
    complexe: null,
    support: false,
  },
  {
    code: "consignes_ecrites",
    libelle: "Consignes données aussi par écrit",
    types: ["auditif", "dys", "psychique"],
    complexe: null,
    support: false,
  },
  {
    code: "place_proche",
    libelle: "Place à proximité du formateur et de l'écran",
    types: ["auditif", "visuel"],
    complexe: null,
    support: false,
  },
  {
    code: "pauses",
    libelle: "Pauses supplémentaires",
    types: ["dys", "psychique", "chronique", "mobilite"],
    complexe: null,
    support: false,
  },
  {
    code: "temps_majore",
    libelle: "Temps supplémentaire pour les exercices et l'évaluation",
    types: ["visuel", "dys", "psychique", "chronique"],
    complexe: null,
    support: false,
  },
  {
    code: "environnement_calme",
    libelle: "Place au calme, sollicitations limitées",
    types: ["dys", "psychique"],
    complexe: null,
    support: false,
  },
  {
    code: "salle_accessible",
    libelle: "Salle accessible (plain-pied ou ascenseur, sanitaires adaptés)",
    types: ["mobilite"],
    complexe: null,
    support: false,
  },
  {
    code: "interprete_lsf",
    libelle: "Interprète en langue des signes (LSF) ou codeur LPC",
    types: ["auditif"],
    complexe: "interprete",
    support: false,
  },
  {
    code: "materiel_specifique",
    libelle: "Matériel spécifique (boucle magnétique, plage braille, siège adapté…)",
    types: ["auditif", "visuel", "mobilite", "chronique"],
    complexe: "materiel",
    support: false,
  },
  {
    code: "financement_agefiph",
    libelle: "Aide au financement d'une compensation (Agefiph, FIPHFP)",
    types: TOUS,
    complexe: "financement",
    support: false,
  },
  {
    code: "autre_mesure",
    libelle: "Autre aménagement, à préciser par écrit avec le référent",
    types: TOUS,
    complexe: "autre",
    support: false,
  },
];

const PAR_CODE = new Map(MESURES.map((m) => [m.code, m]));

export function estTypeBesoin(v: unknown): v is TypeBesoin {
  return typeof v === "string" && (TOUS as readonly string[]).includes(v);
}

/** Les mesures cochables pour ces types : standard puis complexes, ordre du catalogue. */
export function mesuresDisponibles(types: readonly TypeBesoin[]): MesureCatalogue[] {
  return MESURES.filter((m) => m.types.some((t) => types.includes(t)));
}

/** Les mesures PROPOSÉES d'office (pré-cochées) : les standard des types cochés. */
export function mesuresProposees(types: readonly TypeBesoin[]): string[] {
  return mesuresDisponibles(types)
    .filter((m) => m.complexe === null)
    .map((m) => m.code);
}

export function libelleMesure(code: string): string {
  return PAR_CODE.get(code)?.libelle ?? code;
}

/** Une mesure retenue porte-t-elle sur les supports ? */
export function comporteMesureSupport(codes: readonly string[]): boolean {
  return codes.some((c) => PAR_CODE.get(c)?.support === true);
}

/** Le texte consigné cite-t-il une mesure de supports (ligne du catalogue, mot pour mot) ? */
export function texteCiteMesureSupport(texte: string): boolean {
  const lignes = new Set(lignesDeMesures(texte));
  return MESURES.some((m) => m.support && lignes.has(m.libelle));
}

const LIBELLES_MESURES: ReadonlySet<string> = new Set(MESURES.map((m) => m.libelle));

/**
 * Les lignes d'une réponse consignée, telles qu'on les transmet (fiche du
 * formateur, récapitulatif, convocation) : une mesure par ligne, sans puce.
 *
 * 🔴 Relecture #1571 — SEULES passent les lignes qui sont, mot pour mot, un
 * libellé du catalogue. Le texte libre saisi à la main dans la console (qui peut
 * porter une information de santé) ne sort jamais : ni en-tête, ni phrase du
 * référent, ni ligne « presque » du catalogue.
 */
export function lignesDeMesures(texte: string): string[] {
  const lignes = texte
    .split("\n")
    .map((l) => l.trim().replace(/^[-•]\s*/, ""))
    .filter((l) => LIBELLES_MESURES.has(l));
  return [...new Set(lignes)];
}

/** Le texte porte-t-il un bloc écrit par la consignation automatique ? */
export function porteConsignationAutomatique(texte: string): boolean {
  return texte.split("\n\n").some((b) => b.trim().startsWith(ENTETE_CONSIGNATION_AUTOMATIQUE));
}

/**
 * Le catalogue tel que le formulaire du portail le reçoit, en PROPRIÉTÉ : les
 * composants du portail ne tirent pas le domaine qualiopi (cloisonnement,
 * `scripts/qualiopi/isolation-check.ts`) — la page le leur passe.
 */
export interface CataloguePortail {
  readonly types: readonly { readonly code: string; readonly libelle: string }[];
  readonly mesures: readonly {
    readonly code: string;
    readonly libelle: string;
    readonly types: readonly string[];
    readonly complexe: boolean;
  }[];
  readonly champs: typeof CHAMPS_DECLARATION;
  readonly commentaireMax: number;
}

export function cataloguePortail(): CataloguePortail {
  return {
    types: TYPES_BESOIN.map((t) => ({ code: t.code, libelle: t.libelle })),
    mesures: MESURES.map((m) => ({
      code: m.code,
      libelle: m.libelle,
      types: [...m.types],
      complexe: m.complexe !== null,
    })),
    champs: CHAMPS_DECLARATION,
    commentaireMax: COMMENTAIRE_MAX,
  };
}

/** Les champs que le FORMULAIRE envoie. Jamais écrits tels quels en base. */
export const CHAMPS_DECLARATION = {
  types: "adaptationTypes",
  mesures: "adaptationMesures",
  commentaire: "adaptationCommentaire",
  consentement: "adaptationConsentement",
  choix: "adaptationChoix",
} as const;

/**
 * Les clés que le SERVEUR écrit dans la réponse du positionnement : le
 * consentement (daté par `reponduAt`) et le choix. Ni l'un ni l'autre ne dit la
 * nature du besoin. Un client ne peut pas les forger : elles sont retirées des
 * entrées puis réécrites par le serveur.
 */
export const CLES_REPONSE_ADAPTATION = {
  consentement: "consentementPrecisionAdaptation",
  choix: "choixAdaptation",
} as const;

export const COMMENTAIRE_MAX = 1000;

export type ChoixAdaptation = "confirme" | "echange";

export interface DeclarationAdaptation {
  readonly consentement: boolean;
  readonly choix: ChoixAdaptation;
  readonly types: readonly TypeBesoin[];
  readonly mesuresStandard: readonly string[];
  readonly mesuresComplexes: readonly string[];
  readonly commentaire: string;
  readonly motifs: readonly MotifCasComplexe[];
  readonly casComplexe: boolean;
}

export type LectureDeclaration =
  | { readonly ok: true; readonly declaration: DeclarationAdaptation }
  | { readonly ok: false; readonly erreur: string };

function listeTextes(v: unknown): string[] | null {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) return null;
  return [...new Set(v as string[])];
}

/**
 * Lit et valide la déclaration envoyée par le formulaire. Le serveur l'appelle
 * à chaque soumission : le formulaire peut être ancien, ou forgé.
 */
export function lireDeclaration(brut: Readonly<Record<string, unknown>>): LectureDeclaration {
  const choix = brut[CHAMPS_DECLARATION.choix];
  if (choix !== "confirme" && choix !== "echange") {
    return {
      ok: false,
      erreur:
        "Confirmez les aménagements proposés, ou demandez un échange écrit avec le référent handicap.",
    };
  }
  const consentement = brut[CHAMPS_DECLARATION.consentement] === true;

  if (!consentement) {
    // Sans accord, aucune précision n'est traitée : le référent prend contact
    // par écrit, sans rien savoir d'autre que l'existence d'un besoin.
    if (choix !== "echange") {
      return {
        ok: false,
        erreur:
          "Sans votre accord pour transmettre ces précisions au référent handicap, nous ne pouvons pas " +
          "appliquer d'aménagement automatiquement : choisissez l'échange écrit avec le référent.",
      };
    }
    return {
      ok: true,
      declaration: {
        consentement: false,
        choix,
        types: [],
        mesuresStandard: [],
        mesuresComplexes: [],
        commentaire: "",
        motifs: ["sans_precision"],
        casComplexe: true,
      },
    };
  }

  const typesBruts = listeTextes(brut[CHAMPS_DECLARATION.types]);
  if (typesBruts === null || typesBruts.length === 0 || !typesBruts.every(estTypeBesoin)) {
    return { ok: false, erreur: "Cochez au moins un type de besoin dans la liste." };
  }
  const types = TOUS.filter((t) => typesBruts.includes(t));

  const mesuresBrutes = listeTextes(brut[CHAMPS_DECLARATION.mesures]);
  const disponibles = new Set(mesuresDisponibles(types).map((m) => m.code));
  if (mesuresBrutes === null || !mesuresBrutes.every((c) => disponibles.has(c))) {
    return { ok: false, erreur: "Un aménagement coché ne correspond pas aux besoins indiqués." };
  }
  // Ordre du catalogue, quel que soit l'ordre des clics.
  const mesures = MESURES.filter((m) => mesuresBrutes.includes(m.code));
  if (choix === "confirme" && mesures.length === 0) {
    return {
      ok: false,
      erreur: "Cochez au moins un aménagement, ou demandez un échange avec le référent handicap.",
    };
  }

  const commentaireBrut = brut[CHAMPS_DECLARATION.commentaire];
  const commentaire = typeof commentaireBrut === "string" ? commentaireBrut.trim() : "";
  if (commentaire.length > COMMENTAIRE_MAX) {
    return { ok: false, erreur: `Le commentaire est limité à ${COMMENTAIRE_MAX} caractères.` };
  }

  const motifs: MotifCasComplexe[] = [];
  for (const m of mesures) {
    if (m.complexe !== null && !motifs.includes(m.complexe)) motifs.push(m.complexe);
  }
  if (choix === "echange") motifs.push("echange");

  return {
    ok: true,
    declaration: {
      consentement: true,
      choix,
      types,
      mesuresStandard: mesures.filter((m) => m.complexe === null).map((m) => m.code),
      mesuresComplexes: mesures.filter((m) => m.complexe !== null).map((m) => m.code),
      commentaire,
      motifs,
      casComplexe: motifs.length > 0,
    },
  };
}

/** Retire des réponses reçues tout champ de la déclaration ET toute clé réservée au serveur. */
export function retirerChampsDeclaration(
  reponses: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const interdites = new Set<string>([
    ...Object.values(CHAMPS_DECLARATION),
    ...Object.values(CLES_REPONSE_ADAPTATION),
  ]);
  return Object.fromEntries(Object.entries(reponses).filter(([k]) => !interdites.has(k)));
}

const dateParis = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

/** Première ligne du texte consigné automatiquement — reconnue par la consignation. */
export const ENTETE_CONSIGNATION_AUTOMATIQUE = "Mesures d'adaptation retenues";

/**
 * La réponse de l'organisme, consignée sur l'inscription (ind. 10). Ne porte
 * QUE les mesures standard : ni type, ni mesure complexe, ni commentaire.
 */
export function texteConsignationAutomatique(
  mesuresStandard: readonly string[],
  confirmeLe: Date,
): string {
  return [
    `${ENTETE_CONSIGNATION_AUTOMATIQUE} (catalogue de l'organisme, confirmées par le bénéficiaire le ${dateParis.format(confirmeLe)}) :`,
    ...mesuresStandard.map((c) => `- ${libelleMesure(c)}`),
  ].join("\n");
}

/**
 * Ce que la consignation automatique écrit dans `adaptationsRealisees`.
 *
 * 🔴 Rien ne s'efface : une réponse déjà consignée (par le référent, ou par une
 * déclaration précédente) est GARDÉE, et la nouvelle s'y ajoute. Une même
 * déclaration resoumise ne s'ajoute pas deux fois.
 */
export function fusionnerConsignation(existante: string | null, nouvelle: string): string {
  const avant = existante?.trim() ?? "";
  if (avant === "") return nouvelle;
  // Même liste de mesures déjà consignée (seule la date d'en-tête diffère).
  const corps = (t: string): string => t.split("\n").slice(1).join("\n");
  const blocs = avant.split("\n\n");
  if (
    blocs.some((b) => b.startsWith(ENTETE_CONSIGNATION_AUTOMATIQUE) && corps(b) === corps(nouvelle))
  ) {
    return avant;
  }
  return `${avant}\n\n${nouvelle}`;
}

/** Le texte chiffré pour le référent (lecture réservée et journalisée). */
export function textePourReferent(
  d: DeclarationAdaptation,
  contexte: { readonly declareLe: Date; readonly sessionTitre: string },
): string {
  const libelleType = (c: TypeBesoin): string =>
    TYPES_BESOIN.find((t) => t.code === c)?.libelle ?? c;
  const lignes = [
    `Déclaration du ${dateParis.format(contexte.declareLe)} (positionnement, session « ${contexte.sessionTitre} »)`,
    `Type(s) de besoin : ${d.types.map(libelleType).join(", ") || "non précisé"}`,
    `Aménagements souhaités : ${
      [...d.mesuresStandard, ...d.mesuresComplexes].map(libelleMesure).join(" ; ") || "aucun coché"
    }`,
    `Choix du bénéficiaire : ${
      d.choix === "confirme" ? "mesures confirmées" : "échange écrit avec le référent demandé"
    }`,
  ];
  if (d.commentaire !== "") lignes.push(`Commentaire : ${d.commentaire}`);
  return lignes.join("\n");
}
