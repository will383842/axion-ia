/**
 * Formateurs indépendants — RÈGLES du dossier en ligne (lot L5, 10d F-5, 05 E7).
 *
 * Module PUR : ce qui manque à chaque étape, la première étape à montrer, les pièces
 * demandées, la liste des déclarations de l'étape 4. Lu par la page, les actions et
 * (plus tard) les relances.
 *
 * Les libellés sont ceux de la maquette `maquette-formateur-dossier.html` : « Pour
 * continuer, il manque : … ».
 */

/** Les pièces que le dossier propose de déposer (étape 3). */
export const PIECES_DOSSIER = [
  "attestation_vigilance_urssaf",
  "rib",
  "cv",
  "recepisse_declaration_activite",
  "assurance_rc_pro",
  "diplome",
] as const;

export type PieceDossier = (typeof PIECES_DOSSIER)[number];

export function estPieceDossier(v: unknown): v is PieceDossier {
  return typeof v === "string" && (PIECES_DOSSIER as readonly string[]).includes(v);
}

/**
 * Pièces facultatives : jamais un manque. L'attestation URSSAF l'est depuis le lot G1
 * (décision du 12/10) : elle est demandée plus tard, à l'approche du seuil de vigilance
 * (`vigilance-seuil.ts`). Déposée quand même, son code de sécurité est demandé à l'écran,
 * mais il ne bloque pas le dossier (V2-N-4) : une pièce facultative ne doit jamais devenir
 * une impasse. La console garde ses contrôles (« l'attestation vérifiée » au-delà du
 * seuil, demande de complément `code_urssaf`).
 */
export const PIECES_FACULTATIVES: ReadonlySet<PieceDossier> = new Set([
  "attestation_vigilance_urssaf",
  "assurance_rc_pro",
  "diplome",
]);

export const LIBELLE_PIECE: Readonly<Record<PieceDossier, string>> = {
  attestation_vigilance_urssaf: "Attestation URSSAF",
  rib: "RIB",
  cv: "CV",
  recepisse_declaration_activite: "Récépissé de déclaration d'activité",
  assurance_rc_pro: "Assurance RC pro",
  diplome: "Diplômes",
};

/** Ce que dit la ligne « il manque » pour chaque pièce. */
const MANQUE_PIECE: Readonly<Record<PieceDossier, string>> = {
  attestation_vigilance_urssaf: "votre attestation URSSAF",
  rib: "votre RIB",
  cv: "votre CV",
  recepisse_declaration_activite: "le récépissé de votre déclaration d'activité",
  assurance_rc_pro: "votre assurance RC pro",
  diplome: "vos diplômes",
};

export const REGIMES_TVA = ["franchise_293b", "exonere_formation", "assujetti_20"] as const;
export type RegimeTvaDossier = (typeof REGIMES_TVA)[number];

export function estRegimeTva(v: unknown): v is RegimeTvaDossier {
  return typeof v === "string" && (REGIMES_TVA as readonly string[]).includes(v);
}

/** Valeur écrite dans `sousTraitantNda` quand la personne n'a pas encore son numéro. */
export const NDA_EN_COURS = "en cours";

/**
 * V1-A-11 — l'adresse professionnelle saisie dans le dossier (le registre ne la donne pas
 * pour une entreprise en diffusion partielle) : espaces resserrés, 300 caractères au plus.
 */
export function normaliserAdressePro(brut: string): string {
  return brut.replace(/\s+/g, " ").trim().slice(0, 300);
}

/** Une adresse imprimable sur le contrat : une voie et un code postal à 5 chiffres. */
export function adresseProValide(adresse: string): boolean {
  return (
    adresse.length >= 10 && /(^|\D)\d{5}(\D|$)/.test(adresse) && /[a-zA-ZÀ-ÿ]{2}/.test(adresse)
  );
}

/** Code postal français à 5 chiffres. */
export function codePostalValide(brut: string): boolean {
  return /^\d{5}$/.test(brut.replace(/\s+/g, ""));
}

export interface EtatDossier {
  readonly codePostalPro: string | null;
  readonly siret: string | null;
  /** Numéro saisi, ou `NDA_EN_COURS`. */
  readonly nda: string | null;
  readonly regimeTva: RegimeTvaDossier | null;
  readonly ibanSaisi: boolean;
  /** Pièces déposées (non archivées, non rejetées). */
  readonly piecesDeposees: ReadonlyArray<PieceDossier>;
  /** Le code de sécurité de l'attestation URSSAF est saisi. */
  readonly codeUrssafSaisi: boolean;
  /** Dernier écran de l'entreprise : seuls « trouvée » et « muette » laissent continuer. */
  readonly entrepriseBloquante: boolean;
}

export function ndaEnCours(nda: string | null): boolean {
  return nda !== null && nda.trim().toLowerCase() === NDA_EN_COURS;
}

export function manquesEtape1(e: Pick<EtatDossier, "codePostalPro">): string[] {
  return e.codePostalPro && codePostalValide(e.codePostalPro) ? [] : ["votre code postal"];
}

export function manquesEtape2(
  e: Pick<EtatDossier, "siret" | "nda" | "regimeTva" | "ibanSaisi" | "entrepriseBloquante">,
): string[] {
  const m: string[] = [];
  if (!e.siret || !/^\d{14}$/.test(e.siret) || e.entrepriseBloquante) {
    m.push("votre numéro SIRET, recherché au registre");
  }
  // Qualiopi ind. 21 — un numéro « en cours » (dossiers d'avant le 17/10) ne vaut plus.
  if (!e.nda || ndaEnCours(e.nda)) m.push("votre numéro de déclaration d'activité");
  if (!e.regimeTva) m.push("votre régime de TVA");
  if (!e.ibanSaisi) m.push("un IBAN valide");
  return m;
}

/** Les pièces demandées à l'étape 3 (le récépissé seulement sans numéro). */
export function piecesDemandees(nda: string | null): PieceDossier[] {
  return PIECES_DOSSIER.filter((p) => p !== "recepisse_declaration_activite" || ndaEnCours(nda));
}

export function manquesEtape3(
  e: Pick<EtatDossier, "nda" | "piecesDeposees" | "codeUrssafSaisi">,
): string[] {
  const m: string[] = [];
  for (const p of piecesDemandees(e.nda)) {
    if (PIECES_FACULTATIVES.has(p)) continue;
    if (!e.piecesDeposees.includes(p)) m.push(MANQUE_PIECE[p]);
  }
  // Le code de l'attestation ne manque que si l'attestation elle-même est exigée (V2-N-4).
  if (
    !PIECES_FACULTATIVES.has("attestation_vigilance_urssaf") &&
    e.piecesDeposees.includes("attestation_vigilance_urssaf") &&
    !e.codeUrssafSaisi
  ) {
    m.push("le code de sécurité de votre attestation URSSAF");
  }
  return m;
}

/** Tout ce qui manque pour envoyer le dossier. */
export function manquesDuDossier(e: EtatDossier): string[] {
  return [...manquesEtape1(e), ...manquesEtape2(e), ...manquesEtape3(e)];
}

/** La première étape qui reste à faire (4 quand tout est prêt). */
export function etapeInitiale(e: EtatDossier): 1 | 2 | 3 | 4 {
  if (manquesEtape1(e).length > 0) return 1;
  if (manquesEtape2(e).length > 0) return 2;
  if (manquesEtape3(e).length > 0) return 3;
  return 4;
}

/**
 * Les déclarations de l'étape 4, regroupées en UNE case « Je certifie que » (10d F-5) :
 * exactitude, cumul d'activité, pas d'exclusivité, données des stagiaires, ancien salarié.
 * ⚠️ Texte à relire par Will avant l'allumage : toute retouche change la version.
 */
export const DECLARATIONS_VERSION = "formateur-2026-10-11";

export const DECLARATIONS_FORMATEUR: ReadonlyArray<{
  readonly cle: string;
  readonly texte: string;
}> = [
  { cle: "exactitude", texte: "les informations de mon dossier sont exactes" },
  {
    cle: "cumul",
    texte: "j'exerce mon activité de formateur en indépendant, à côté de mes autres activités",
  },
  {
    cle: "liberte",
    texte: "je reste libre de travailler pour d'autres clients, sans exclusivité",
  },
  {
    cle: "donnees_stagiaires",
    texte:
      "je ne confierai aucune donnée des stagiaires à un outil d'IA qu'Axion-IA n'a pas autorisé",
  },
  {
    cle: "ancien_salarie",
    texte: "je n'ai pas été salarié d'Axion-IA au cours des 12 derniers mois",
  },
];
