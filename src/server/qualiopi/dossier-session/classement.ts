/**
 * 🔴 CHANTIER QNC, LOT L11 — LE CLASSEMENT DU DOSSIER DE SESSION.
 *
 * Exigence de Will : tout ce qui concerne une session est rangé DANS la
 * session, par DESTINATAIRE (stagiaire, entreprise, formateur, financeur), par
 * CANAL (espace personnel, e-mail, papier, autre) et par DATE.
 *
 * Ce module ne lit rien : il reçoit des lignes déjà chargées et décide où elles
 * vont. L'écran et le ZIP le lisent tous deux (`rendu.ts`) — une seule règle de
 * classement, donc une seule réponse à « où est la convocation de Camille ? ».
 *
 * ⚠️ Les tables de classement sont des `Record<…>` COMPLETS sur les énumérations
 * du schéma : un type de pièce ajouté demain casse la compilation tant que
 * personne n'a décidé à qui il s'adresse, au lieu de tomber en silence dans un
 * « divers ».
 *
 * Module PUR : aucun import Prisma à l'exécution, aucun import Next.
 */

import type {
  CanalRemise,
  DestinataireRemise,
  DocumentType,
} from "../../../../prisma/generated/client";

/**
 * Les destinataires du dossier. Les quatre parties prenantes du schéma
 * (`DestinataireRemise`), plus l'ORGANISME lui-même : une alerte interne ou un
 * registre (feuille d'émargement, inventaire des moyens) ne s'adresse à aucune
 * d'elles, et le ranger chez le stagiaire mentirait sur sa nature.
 */
export type Destinataire = DestinataireRemise | "organisme";

export type Canal = CanalRemise;

export const ORDRE_DESTINATAIRES: readonly Destinataire[] = [
  "stagiaire",
  "entreprise",
  "formateur",
  "financeur",
  "organisme",
];

export const ORDRE_CANAUX: readonly Canal[] = ["espace", "email", "papier", "autre"];

export const LIBELLE_DESTINATAIRE: Record<Destinataire, string> = {
  stagiaire: "Stagiaires",
  entreprise: "Entreprise",
  formateur: "Formateurs",
  financeur: "Financeur",
  organisme: "Organisme (registres et alertes internes)",
};

export const LIBELLE_CANAL: Record<Canal, string> = {
  espace: "Espace personnel",
  email: "E-mail",
  papier: "Papier",
  autre: "Autre (registre, remise non tracée)",
};

/**
 * À qui s'adresse chaque pièce du registre. C'est le destinataire NATUREL de la
 * pièce — celui qui la reçoit ou la signe —, pas celui qui l'a demandée.
 */
const DESTINATAIRE_PIECE: Record<DocumentType, Destinataire> = {
  convention: "entreprise",
  convention_tripartite: "entreprise",
  // Contrat de formation : conclu avec une personne physique (art. L.6353-3).
  contrat: "stagiaire",
  convocation: "stagiaire",
  // Registre de l'organisme : signé par les stagiaires, tenu par l'organisme.
  emargement: "organisme",
  releve_connexion: "organisme",
  positionnement: "stagiaire",
  grille_evaluation: "stagiaire",
  satisfaction: "stagiaire",
  attestation: "stagiaire",
  attestation_partielle: "stagiaire",
  // Le certificat de réalisation est la pièce que réclame le financeur.
  certificat_realisation: "financeur",
  facture: "entreprise",
  kit_opco: "financeur",
  kit_cpf: "financeur",
  kit_france_travail: "financeur",
  lettre_mission: "formateur",
  reglement_interieur: "stagiaire",
  livret_accueil: "stagiaire",
  protocole_afest: "entreprise",
  devis: "entreprise",
  avoir: "entreprise",
  inventaire_moyens: "organisme",
  contrat_sous_traitance: "formateur",
  cv_formateur: "formateur",
  programme: "entreprise",
  organisation_action: "entreprise",
  autorisation_captation: "stagiaire",
  liste_formateurs: "organisme",
  procedure_sous_traitance: "organisme",
  autofacture_honoraires: "formateur",
  contrat_travail: "formateur",
  // Mandat donné par l'entreprise pour agir auprès de SON OPCO.
  mandat_opco: "financeur",
};

export function destinatairePiece(type: DocumentType): Destinataire {
  return DESTINATAIRE_PIECE[type];
}

/**
 * Destinataire d'un e-mail par son GABARIT — la source la plus sûre, puisque
 * c'est le gabarit qui sait à qui il parle. Ceux qui manquent ici se rangent
 * par l'entité qu'ils visent (`destinataireEmail`).
 */
const DESTINATAIRE_PAR_GABARIT: Readonly<Record<string, Destinataire>> = {
  "qualiopi-convocation": "stagiaire",
  "qualiopi-rappel-j7": "stagiaire",
  "qualiopi-rappel-j1": "stagiaire",
  "qualiopi-satisfaction-j1": "stagiaire",
  "qualiopi-suivi-j30": "stagiaire",
  "qualiopi-positionnement": "stagiaire",
  "qualiopi-questionnaire-relance": "stagiaire",
  "qualiopi-emargement-lien": "stagiaire",
  "qualiopi-presence-confirmation": "stagiaire",
  "qualiopi-presence-entreprise": "entreprise",
  "qualiopi-attestation-disponible": "stagiaire",
  "qualiopi-portail-acces": "stagiaire",
  // Le questionnaire à froid de l'ENTREPRISE vise le commanditaire, même
  // lorsqu'il est rattaché à une inscription.
  "qualiopi-enquete-entreprise": "entreprise",
  "convention-envoi": "entreprise",
  "devis-envoi": "entreprise",
  "facture-envoi": "entreprise",
  "facture-pieces-remboursement-opco": "entreprise",
  "opco-suivi-entreprise": "entreprise",
  "qualiopi-relance-impayee": "entreprise",
  "formateur-magic-link": "formateur",
  "formateur-mission-proposee": "formateur",
  "formateur-convocation-j7": "formateur",
  "formateur-rappel-j1": "formateur",
  "formateur-contresignature": "formateur",
  "formateur-contrat-travail": "formateur",
  "autofacture-transmission": "formateur",
  "qualiopi-alerte-interne": "organisme",
};

/** L'entité visée par l'envoi, à défaut de gabarit connu. */
const DESTINATAIRE_PAR_ENTITE: Readonly<Record<string, Destinataire>> = {
  Enrollment: "stagiaire",
  Questionnaire: "stagiaire",
  PortailAcces: "stagiaire",
  SessionFormateur: "formateur",
  MissionFormateur: "formateur",
  Trainer: "formateur",
  Devis: "entreprise",
  Client: "entreprise",
  FactureFormation: "entreprise",
  DossierFinancement: "financeur",
  AlerteSysteme: "organisme",
};

export function destinataireEmail(email: {
  readonly template: string;
  readonly entityType: string | null;
  /** Type de la pièce visée, quand l'envoi vise une pièce du registre. */
  readonly typePiece: DocumentType | null;
}): Destinataire {
  const parGabarit = DESTINATAIRE_PAR_GABARIT[email.template];
  if (parGabarit !== undefined) return parGabarit;
  if (email.typePiece !== null) return destinatairePiece(email.typePiece);
  if (email.entityType !== null) {
    const parEntite = DESTINATAIRE_PAR_ENTITE[email.entityType];
    if (parEntite !== undefined) return parEntite;
  }
  // Gabarit et entité inconnus : rangé chez l'organisme, et le dossier le dit
  // (« non attribué »), plutôt que de deviner un destinataire.
  return "organisme";
}

/**
 * E-mails de RÉMUNÉRATION, de FACTURATION ou d'EMPLOYEUR : même règle que les
 * pièces (`hors-dossier-audit.ts`) — aucun indicateur Qualiopi ne les réclame,
 * et une facture nomme ce qu'une personne a payé. Comptés, jamais joints.
 */
const GABARITS_HORS_DOSSIER: ReadonlySet<string> = new Set([
  "facture-envoi",
  "qualiopi-relance-impayee",
  "autofacture-transmission",
  "formateur-contrat-travail",
]);

export function emailHorsDossier(template: string, pieceHorsDossier: boolean): boolean {
  return pieceHorsDossier || GABARITS_HORS_DOSSIER.has(template);
}

/** Les gabarits classés : exportés pour la garde de cohérence. */
export function gabaritsClasses(): readonly string[] {
  return Object.keys(DESTINATAIRE_PAR_GABARIT);
}

/** Les gabarits hors dossier : exportés pour la garde de cohérence. */
export function gabaritsHorsDossier(): readonly string[] {
  return [...GABARITS_HORS_DOSSIER];
}

// ─────────────────────────────────────────────────────────────────────────────
// Les étiquettes d'une pièce
// ─────────────────────────────────────────────────────────────────────────────

function objet(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/**
 * Le badge « NON PROBANTE », déduit de l'instantané de rendu.
 *
 * Une pièce produite alors que l'identité de l'organisme était incomplète est
 * DÉCLASSÉE en spécimen : `generateDocument` injecte `estSpecimen` et son motif
 * dans les données rendues, puis les fige dans `metadata.renderData.data`. C'est
 * donc là que se lit ce que la pièce DIT d'elle-même — le filigrane imprimé.
 *
 * Repli : une pièce sans instantané (antérieure, ou dont l'instantané a échoué)
 * peut encore porter `metadata.specimen`, posé par le même appel.
 *
 * @returns le motif, ou `null` si la pièce est probante.
 */
export function motifNonProbante(metadata: unknown): string | null {
  const meta = objet(metadata);
  if (meta === null) return null;
  const data = objet(objet(meta["renderData"])?.["data"]);
  if (data !== null && data["estSpecimen"] === true) {
    const motif = data["specimenMotif"];
    return typeof motif === "string" && motif.trim() !== "" ? motif.trim() : "spécimen";
  }
  if (meta["specimen"] === true) {
    const manquants = meta["champsManquants"];
    return Array.isArray(manquants) && manquants.length > 0
      ? `spécimen — manquent : ${manquants.filter((m) => typeof m === "string").join(", ")}`
      : "spécimen";
  }
  return null;
}

/**
 * Un MODÈLE VIERGE : une pièce générée dont le contenu est un formulaire non
 * rempli (positionnement, satisfaction) ou une grille sans aucune note. Il
 * reste en base et au dossier (nommé), mais n'est ni probant ni joint : les
 * réponses réelles sont dans les pièces « remplies ».
 *
 * `null` dans tous les autres cas, y compris une grille sans instantané
 * (illisible) : on n'invente pas un constat. Pur — n'importe pas les constantes
 * des producteurs (ils chargent React).
 */
export function motifModeleVierge(type: string, metadata: unknown): string | null {
  if (type === "positionnement") {
    return "questionnaire de positionnement VIERGE (formulaire non rempli)";
  }
  if (type === "satisfaction") {
    return "questionnaire de satisfaction VIERGE (formulaire non rempli)";
  }
  if (type === "grille_evaluation") {
    const data = objet(objet(objet(metadata)?.["renderData"])?.["data"]);
    const competences = data?.["competences"];
    if (!Array.isArray(competences)) return null;
    const notee = competences.some((c) => {
      const note = objet(c)?.["note"];
      return note !== undefined && note !== null;
    });
    return notee ? null : "grille d'évaluation VIERGE (aucune compétence notée)";
  }
  return null;
}

/**
 * Une pièce REMPLACÉE : sa contre-trace `remplaceeParNumero` est posée. Elle
 * reste au dossier, étiquetée — un original remplacé est une trace de ce qui
 * a été remis à l'époque —, mais elle ne compte plus dans aucun voyant.
 */
export function remplaceePar(remplaceeParNumero: string | null): string | null {
  if (remplaceeParNumero === null) return null;
  const n = remplaceeParNumero.trim();
  return n === "" ? null : n;
}
