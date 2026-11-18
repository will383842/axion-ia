/**
 * Changer le type d'une fiche client (particulier ↔ entreprise) : les règles PURES
 * et les lectures, partagées par l'action (`changerTypeClientAction`) et par l'écran
 * (`ChangerTypeClient`). AUCUNE écriture ici : `clients` n'a qu'un écrivain déclaré
 * (`scripts/gates/cliquet-ecrivains.ts`), l'action de `actions/qualiopi/clients.ts`.
 *
 * Décision conservatrice : on ne retire jamais une donnée pour changer de type. Une fiche
 * qui porte des pièces, ou — vers « particulier » — des informations d'employeur, ne change pas.
 */

import { normaliserNom } from "@/server/qualiopi/crm/normaliser-nom";

/**
 * Champs d'employeur : sans objet pour un particulier (voir `refuserChampsEntreprisePourParticulier`
 * dans `actions/qualiopi/clients.ts`, qui s'en sert).
 */
export const CHAMPS_ENTREPRISE = [
  "siret",
  "siren",
  "nafCode",
  "conventionCollective",
  "idcc",
  "taille",
  "opcoIdentifie",
  "opcoNumeroAdherent",
  "opcoEnveloppeAnnuelleCents",
  "opco",
  "effectif",
  "opcoAdhesionOffreMobilites",
  "opcoVersementVolontaire",
  // Fiche Modifier (lot A2) : le numéro de TVA identifie une entreprise.
  "tvaIntracom",
] as const;

/** Les champs d'employeur « annexes » : provenance et dates qui suivent les valeurs ci-dessus. */
export const CHAMPS_ENTREPRISE_ANNEXES = [
  "opcoAdhesionsRenseigneesLe",
  "effectifSource",
  "effectifReleveLe",
] as const;

/** Les colonnes à lire pour décider (`select` Prisma). */
export const SELECT_CHAMPS_EMPLOYEUR = Object.fromEntries(
  [...CHAMPS_ENTREPRISE, ...CHAMPS_ENTREPRISE_ANNEXES].map((c) => [c, true]),
) as Record<(typeof CHAMPS_ENTREPRISE)[number] | (typeof CHAMPS_ENTREPRISE_ANNEXES)[number], true>;

/** Les champs d'employeur renseignés (null, undefined et chaîne vide ne comptent pas). */
export function champsEmployeurRestants(fiche: Record<string, unknown>): string[] {
  return [...CHAMPS_ENTREPRISE, ...CHAMPS_ENTREPRISE_ANNEXES].filter((c) => {
    const v = fiche[c];
    return v !== undefined && v !== null && v !== "";
  });
}

/** Mots normalisés (sans accents, casse, ponctuation, formes juridiques), triés : « DUPONT Anne » = « Anne Dupont ». */
export function motsTries(nom: string | null | undefined): string {
  return normaliserNom(nom)
    .split(" ")
    .filter((m) => m !== "")
    .sort()
    .join(" ");
}

// ── Pièces ───────────────────────────────────────────────────────────────────

/**
 * Documents contractuels qui engagent le type de la fiche.
 *
 * `mandat_opco` n'y figure PAS, après vérification (`documents.ts`, génération du mandat) : un
 * mandat exige une session (`refs: { sessionId, clientId }`) ET que le client en soit partie,
 * soit par `trainingSession.clientId`, soit par une inscription portant son `clientId` (sinon
 * « Ce client n'est pas partie à cette session »). Les deux sont déjà comptés (familles
 * `trainingSession` et `enrollment`, sans filtre de statut), et aucune session n'est supprimée
 * par le code. Un mandat ne peut donc pas exister sans qu'une pièce déjà comptée bloque.
 */
export const TYPES_DOCUMENT_CONTRACTUEL = [
  "convention",
  "convention_tripartite",
  "contrat",
] as const;

type Compteur = { count(args: { where: Record<string, unknown> }): Promise<number> };

/** Ce dont la lecture a besoin : `prisma` ou une transaction. */
export interface BasePieces {
  devis: Compteur;
  factureFormation: Compteur;
  documentGenere: Compteur;
  trainingSession: Compteur;
  dossierFinancement: Compteur;
  enrollment: Compteur;
  coachingContract: Compteur;
  planRecurrent: Compteur;
  auditMission: Compteur;
  /** Facture établie hors console (Tiime…) : une ligne par fiche, clé `clientId`. */
  clientFactureHorsConsole: Compteur;
}

interface Famille {
  readonly cle: keyof BasePieces;
  readonly singulier: string;
  readonly pluriel: string;
  readonly filtre?: Record<string, unknown>;
}

const FAMILLES: readonly Famille[] = [
  { cle: "devis", singulier: "devis", pluriel: "devis" },
  { cle: "factureFormation", singulier: "facture", pluriel: "factures" },
  {
    cle: "documentGenere",
    singulier: "convention ou contrat",
    pluriel: "conventions ou contrats",
    filtre: { type: { in: [...TYPES_DOCUMENT_CONTRACTUEL] } },
  },
  { cle: "trainingSession", singulier: "session de formation", pluriel: "sessions de formation" },
  {
    cle: "dossierFinancement",
    singulier: "dossier de financement",
    pluriel: "dossiers de financement",
  },
  { cle: "enrollment", singulier: "inscription", pluriel: "inscriptions" },
  { cle: "coachingContract", singulier: "contrat de coaching", pluriel: "contrats de coaching" },
  { cle: "planRecurrent", singulier: "plan récurrent", pluriel: "plans récurrents" },
  { cle: "auditMission", singulier: "mission d'audit", pluriel: "missions d'audit" },
  {
    cle: "clientFactureHorsConsole",
    singulier: "facture hors console",
    pluriel: "factures hors console",
  },
];

export interface PieceCompteeClient {
  readonly cle: string;
  readonly n: number;
  readonly libelle: string;
}

/** Les pièces portées par la fiche ET ses fiches absorbées (`ids`), famille par famille. */
export async function compterPiecesClient(
  db: BasePieces,
  ids: readonly string[],
): Promise<PieceCompteeClient[]> {
  const liste = [...ids];
  const comptes = await Promise.all(
    FAMILLES.map((f) =>
      db[f.cle].count({ where: { clientId: { in: liste }, ...(f.filtre ?? {}) } }),
    ),
  );
  return FAMILLES.flatMap((f, i) => {
    const n = comptes[i] ?? 0;
    return n > 0 ? [{ cle: f.cle, n, libelle: `${n} ${n > 1 ? f.pluriel : f.singulier}` }] : [];
  });
}

/** « 2 devis, 1 facture et 3 sessions de formation ». */
export function phrasePieces(pieces: readonly PieceCompteeClient[]): string {
  const l = pieces.map((p) => p.libelle);
  if (l.length <= 1) return l.join("");
  return `${l.slice(0, -1).join(", ")} et ${l[l.length - 1]}`;
}

export function raisonPieces(pieces: readonly PieceCompteeClient[]): string {
  return `Le type ne peut plus changer : la fiche porte ${phrasePieces(pieces)}.`;
}

/** Libellés français des champs d'employeur, pour les messages (jamais les noms de colonnes). */
export const LIBELLES_CHAMPS_EMPLOYEUR: Record<string, string> = {
  siret: "SIRET",
  siren: "SIREN",
  nafCode: "code NAF",
  conventionCollective: "convention collective",
  idcc: "IDCC",
  taille: "taille de l'entreprise",
  opcoIdentifie: "OPCO identifié",
  opcoNumeroAdherent: "numéro d'adhérent OPCO",
  opcoEnveloppeAnnuelleCents: "enveloppe annuelle OPCO",
  opco: "OPCO",
  effectif: "effectif",
  opcoAdhesionOffreMobilites: "adhésion OPCO à l'offre mobilités",
  opcoVersementVolontaire: "versement volontaire OPCO",
  tvaIntracom: "numéro de TVA intracommunautaire",
  opcoAdhesionsRenseigneesLe: "date de renseignement des adhésions OPCO",
  effectifSource: "source de l'effectif",
  effectifReleveLe: "date de relevé de l'effectif",
};

export function raisonEmployeur(champs: readonly string[]): string {
  const libelles = champs.map((c) => LIBELLES_CHAMPS_EMPLOYEUR[c] ?? c);
  return (
    "Le type ne peut pas repasser en particulier : la fiche porte des informations d'employeur " +
    `(${libelles.join(", ")}). Rien n'est effacé.`
  );
}

/** Ce que la lecture de l'écran demande à la base (`prisma`). */
export interface BaseBlocage extends BasePieces {
  clientFusion: {
    findFirst(args: { where: Record<string, unknown>; select: { id: true } }): Promise<unknown>;
    findMany(args: {
      where: Record<string, unknown>;
      select: { absorbeId: true };
    }): Promise<Array<{ absorbeId: string }>>;
  };
}

/**
 * La raison pour laquelle le type de cette fiche ne peut pas changer, ou `null`. Lecture seule,
 * même ordre de règles que l'action (qui refait ces contrôles sous verrou : ceci n'est que l'écran).
 */
export async function raisonBlocageChangementType(
  db: BaseBlocage,
  fiche: Record<string, unknown> & { id: string; type: string },
): Promise<string | null> {
  const absorbee = await db.clientFusion.findFirst({
    where: { absorbeId: fiche.id, defaiteLe: null },
    select: { id: true },
  });
  if (absorbee !== null) {
    return "Cette fiche a été absorbée. Changez le type sur la fiche principale.";
  }
  const absorbees = await db.clientFusion.findMany({
    where: { absorbantId: fiche.id, defaiteLe: null },
    select: { absorbeId: true },
  });
  const pieces = await compterPiecesClient(db, [fiche.id, ...absorbees.map((f) => f.absorbeId)]);
  if (pieces.length > 0) return raisonPieces(pieces);
  if (fiche.type === "entreprise") {
    const restants = champsEmployeurRestants(fiche);
    if (restants.length > 0) return raisonEmployeur(restants);
  }
  return null;
}
