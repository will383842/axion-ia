/**
 * Relances des pièces à renouveler d'un formateur indépendant (lot L13b ; séquences
 * S6 et S6 bis de 10c §3, inscrites au registre des campagnes de CAMP-3).
 *
 * - **S6 — attestation URSSAF (F40, variante « avant l'échéance »)** : 15 jours avant
 *   l'échéance, puis tous les 15 jours, 3 fois au plus (texte F40 soumis à Will). Les
 *   relances continuent après l'échéance : ce sont elles qui débloquent.
 * - **S6 bis — CV et assurance RC pro (F41)** : 30 jours puis 15 jours avant l'échéance
 *   (texte F41 soumis à Will). Rien après l'échéance.
 * - **Lot G1 — attestation URSSAF à l'APPROCHE du seuil (F40, variante 4, validée à part)** :
 *   une seule demande par épisode, quand le cumul des honoraires HT facturés atteint
 *   l'approche du seuil de vigilance sans attestation valable (`vigilance-seuil.ts`).
 *   S6 (le renouvellement) ne vise plus que les formateurs qui ont ATTEINT le seuil.
 *
 * ⚠️ La règle J-30/J-15/J0 et `clePiece` de `pieces-a-renouveler.ts` (L13) ne sont PAS
 * utilisées : le texte F41 soumis à Will annonce deux envois (J-30, J-15), et la clé de
 * toute relance est celle du passage (`cleRelance`). Ne pas appeler `clePiece` pour un
 * envoi : il échapperait à l'anti-doublon de cette campagne.
 *
 * 🔑 L'état d'une pièce vient de `pieces-a-renouveler.ts` (lot L13),
 * la décision du moteur commun (`lib/relances/campagne.ts`), l'envoi de l'adaptateur des
 * formateurs (texte validé, fin de collaboration, crochets) via le passage de CAMP-3.
 *
 * 🔴 ÉTEINT : les deux campagnes exigent `formateurs.dossier_en_ligne` (clé mère de
 * `pieces_cron` : la couper suspend ces relances) ET `formateurs.pieces_cron`.
 * Interrupteur absent, le passage ne les lit même pas.
 *
 * Hors périmètre (dit dans le RAPPORT L13b) : F40 « avant une formation », F41 « pièce
 * refusée » (le motif de refus en base est un texte libre, pas un motif fermé), F57.
 *
 * Module sans `server-only` : il tourne dans le worker `formation-crons`.
 */

import type { Prisma } from "../../../../prisma/generated/client";

import {
  FENETRE_ENVOI_PAR_DEFAUT,
  type EtatCampagne,
  type RegleCampagne,
} from "@/lib/relances/campagne";
import { prisma } from "@/lib/prisma";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { MARQUE_EFFACEMENT } from "@/server/email/relecture-au-depart";
import type { DeclarationCampagne, FaitsCampagne } from "@/server/relances/registre-campagnes";

import { PIECES_SUIVIES, etatPiece, type EtatPiece, type PieceLue } from "./pieces-a-renouveler";
import {
  SEUIL_VIGILANCE_LIBELLE,
  phaseVigilanceFormateur,
  vigilanceExigible,
} from "./vigilance-seuil";
import { lireCumulsHonorairesHtCents } from "./vigilance-seuil-lecture";

const JOUR_MS = 24 * 60 * 60 * 1000;

/** Identifiants des campagnes : ils entrent dans la clé d'envoi (`fi-vigilance-…`, `fi-piece-…`). */
const CAMPAGNE_VIGILANCE_ID = "vigilance";
const CAMPAGNE_PIECES_ID = "piece";
/** Lot G1 — ne commence PAS par `vigilance-` : aucun préfixe partagé avec S6. */
const CAMPAGNE_SEUIL_ID = "seuil-urssaf";

/**
 * Une fiche telle que lue pour les relances : l'identité, et TOUT ce qui décide si la
 * personne fait partie de la population (relu en code, pas seulement dans le `where`).
 */
export interface FicheRelance {
  readonly id: string;
  readonly prenom: string;
  readonly email: string;
  readonly statut: "salarie" | "sous_traitant" | "dirigeant";
  readonly actif: boolean;
  readonly finCollaborationAt: Date | null;
  readonly organismeSousTraitantId: string | null;
  readonly dossierStatut: "en_cours" | "a_verifier" | "a_completer" | "verifie" | null;
  /** La candidature d'origine (nouveau parcours) ; `null` : fiche hors parcours. */
  readonly candidature: {
    readonly natureCollaboration: "salarie" | "freelance" | null;
    readonly status: string;
  } | null;
  /** Un effacement art. 17 a été journalisé pour cette fiche (même avec lien conservé). */
  readonly pseudonymisee: boolean;
}

/** Action du journal posée par l'effacement art. 17 d'un formateur indépendant. */
export const ACTION_EFFACEMENT_FORMATEUR = "qualiopi.trainer.rgpd_effacement";

/** Une candidature arrêtée de notre fait ou du sien : jamais relancée. */
// `archived` : candidatures reprises de l'ancien stock — hors nouveau parcours.
const STATUTS_NON_RETENUS = ["rejected", "withdrawn", "archived"] as const;
const CANDIDATURE_NON_RETENUE: ReadonlySet<string> = new Set(STATUTS_NON_RETENUS);

export type MotifHorsPopulation =
  | "salarie"
  | "dirigeant"
  | "intervenant-organisme"
  | "hors-nouveau-parcours"
  | "dossier-non-verifie"
  | "candidat-non-retenu"
  | "inactif"
  | "collaboration-terminee"
  | "efface";

/**
 * La population STRICTE des relances de pièces : un formateur INDÉPENDANT venu du
 * nouveau parcours (candidature « freelance » non refusée, dossier en ligne vérifié),
 * actif, collaboration en cours, jamais effacé ni pseudonymisé. Rend le motif
 * d'exclusion, ou `null`. Pur ; le même prédicat filtre la lecture en lot et la
 * relecture au départ.
 */
export function motifHorsPopulation(f: FicheRelance): MotifHorsPopulation | null {
  if (f.statut === "salarie") return "salarie";
  if (f.statut !== "sous_traitant") return "dirigeant";
  if (f.organismeSousTraitantId !== null) return "intervenant-organisme";
  if (f.candidature === null || f.candidature.natureCollaboration !== "freelance") {
    return "hors-nouveau-parcours";
  }
  if (CANDIDATURE_NON_RETENUE.has(f.candidature.status)) return "candidat-non-retenu";
  if (f.dossierStatut !== "verifie") return "dossier-non-verifie";
  if (!f.actif) return "inactif";
  if (f.finCollaborationAt !== null) return "collaboration-terminee";
  if (f.pseudonymisee || estEffacee(f.email) || f.prenom === MARQUE_EFFACEMENT) return "efface";
  return null;
}

/** Une relance déjà tentée (journal ou corbeille), par sa clé. */
export interface EnvoiTente {
  readonly entityId: string;
  readonly jobId: string;
  readonly at: Date;
}

/** Tout ce que les deux campagnes lisent, en lot. */
export interface LecturePieces {
  readonly fiches: readonly FicheRelance[];
  readonly pieces: ReadonlyMap<string, readonly PieceLue[]>;
  readonly envois: readonly EnvoiTente[];
  /** Fiches dont l'adresse est dans la liste d'opposition. */
  readonly opposes: ReadonlySet<string>;
  /** Fiches dont l'adresse a rebondi définitivement. */
  readonly adressesMortes: ReadonlySet<string>;
  /**
   * Lot G1 — cumul des honoraires HT facturés, par fiche (`null` : illisible). Absent :
   * illisible pour tous — S6 garde son comportement d'avant, la demande au seuil se tait.
   */
  readonly cumuls?: ReadonlyMap<string, number | null>;
}

// ── Les règles ───────────────────────────────────────────────────────────

export type EtapeVigilance = "j15" | "relance1" | "relance2";
export type EtapePieceF41 = "j30" | "j15";

/** S6 : origine = J-15 de l'échéance ; tous les 15 jours ; 3 au plus. */
export const REGLE_VIGILANCE: RegleCampagne<EtapeVigilance> = {
  etapes: [
    { id: "j15", delaiMs: 0 },
    { id: "relance1", delaiMs: 15 * JOUR_MS },
    { id: "relance2", delaiMs: 30 * JOUR_MS },
  ],
  ecartMinMs: 15 * JOUR_MS,
  // Un jour de grâce après la dernière étape pour un passage manqué, puis plus rien.
  silenceApresMs: 31 * JOUR_MS,
  max: 3,
  unParJour: true,
  fenetre: FENETRE_ENVOI_PAR_DEFAUT,
};

export type EtapeSeuil = "demande";

/**
 * Lot G1 : UNE demande par épisode (clé = la dernière attestation au dossier, ou
 * « aucune »). L'origine est le passage lui-même ; le plafond fait le reste.
 */
export const REGLE_VIGILANCE_SEUIL: RegleCampagne<EtapeSeuil> = {
  etapes: [{ id: "demande", delaiMs: 0 }],
  ecartMinMs: 15 * JOUR_MS,
  silenceApresMs: 365 * JOUR_MS,
  max: 1,
  unParJour: true,
  fenetre: FENETRE_ENVOI_PAR_DEFAUT,
};

/** S6 bis (F41) : origine = J-30 de l'échéance ; J-30 puis J-15 ; 2 au plus. */
export const REGLE_PIECE_F41: RegleCampagne<EtapePieceF41> = {
  etapes: [
    { id: "j30", delaiMs: 0 },
    { id: "j15", delaiMs: 15 * JOUR_MS },
  ],
  ecartMinMs: 7 * JOUR_MS,
  silenceApresMs: 30 * JOUR_MS,
  max: 2,
  unParJour: true,
  fenetre: FENETRE_ENVOI_PAR_DEFAUT,
};

/**
 * Fenêtre de S6 : de J-15 de l'échéance jusqu'au silence de la règle (dernière étape à
 * J+15, un jour de grâce). Hors de là, la fiche n'est même pas candidate.
 */
const VIGILANCE_DEBUT_AVANT_ECHEANCE_MS = 15 * JOUR_MS;
const VIGILANCE_FIN_APRES_ECHEANCE_MS =
  REGLE_VIGILANCE.silenceApresMs - VIGILANCE_DEBUT_AVANT_ECHEANCE_MS;

/**
 * Variantes du texte F40 (1 = à la signature, 2 = avant l'échéance, 3 = avant une
 * formation, 4 = à l'approche du seuil — lot G1, validée à part).
 */
const VARIANTE_F40_AVANT_ECHEANCE = 2;
const VARIANTE_F40_APPROCHE_SEUIL = 4;
/** Variantes du texte F41 (1 = premier rappel, 2 = relance, 3 = pièce refusée). */
const VARIANTES_F41: Readonly<Record<EtapePieceF41, number>> = { j30: 1, j15: 2 };

/** Le libellé de la pièce dans F41 (« merci de déposer [la pièce] »). */
const LIBELLE_PIECE_F41: Readonly<Record<string, string>> = {
  cv: "votre CV",
  assurance_rc_pro: "votre attestation d'assurance RC pro",
};

const TYPES_F41 = PIECES_SUIVIES.map((p) => p.type).filter((t) =>
  Object.prototype.hasOwnProperty.call(LIBELLE_PIECE_F41, t),
);

const DATE_FR = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" });

const jourCle = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");

// ── Les faits (purs) ─────────────────────────────────────────────────────

function estEffacee(email: string): boolean {
  return email.trim() === "" || email.endsWith("@erased.local") || email === MARQUE_EFFACEMENT;
}

/** Les fiches de la population, et elles seules. */
const population = (l: LecturePieces) => l.fiches.filter((f) => motifHorsPopulation(f) === null);

function prefixeEnvoi(campagne: string, entityId: string, origineId: string): string {
  return `fi-${campagne}-${entityId}-${origineId}-`.replace(/:/g, "-");
}

function envoisDe(l: LecturePieces, campagne: string, entityId: string, origineId: string) {
  const prefixe = prefixeEnvoi(campagne, entityId, origineId);
  return l.envois
    .filter((e) => e.entityId === entityId && e.jobId.startsWith(prefixe))
    .map((e) => e.at);
}

function etatCommun(
  l: LecturePieces,
  fiche: FicheRelance,
): Omit<EtatCampagne, "origine" | "envois" | "actionFaite"> {
  return {
    // Déjà exclue par la population ; gardé comme second verrou.
    efface: motifHorsPopulation(fiche) !== null,
    opposition: l.opposes.has(fiche.id),
    adresseMorte: l.adressesMortes.has(fiche.id),
    close: fiche.finCollaborationAt !== null,
    // ⚠️ Les réponses humaines (Zoho) ne se lisent pas encore (CAMP-4) : aucune pause.
    reponseHumaine: false,
    derniereRelancePersonne: null,
  };
}

/** Le cumul lu pour cette fiche ; `null` : illisible (ou non lu). */
function cumulDe(l: LecturePieces, id: string): number | null {
  return l.cumuls === undefined ? null : (l.cumuls.get(id) ?? null);
}

/**
 * S6 : une ligne par fiche de la population dont l'attestation est dans la fenêtre
 * (J-15 de l'échéance à J+16), à renouveler ou échue. Lot G1 : seulement les fiches qui
 * ont ATTEINT le seuil de vigilance (cumul illisible : comme avant, garde fermée).
 */
export function faitsVigilance(l: LecturePieces, maintenant: Date): FaitsCampagne[] {
  return population(l).flatMap((fiche): FaitsCampagne[] => {
    if (!vigilanceExigible(cumulDe(l, fiche.id))) return [];
    const e: EtatPiece = etatPiece(
      l.pieces.get(fiche.id) ?? [],
      "attestation_vigilance_urssaf",
      maintenant,
    );
    if (e.etat !== "a_renouveler" && e.etat !== "echue") return [];
    const ecart = e.echeance.getTime() - maintenant.getTime();
    if (ecart > VIGILANCE_DEBUT_AVANT_ECHEANCE_MS || -ecart > VIGILANCE_FIN_APRES_ECHEANCE_MS) {
      return [];
    }
    const origineId = jourCle(e.echeance);
    return [
      {
        entityId: fiche.id,
        personneId: fiche.id,
        origineId,
        destinataire: fiche.email,
        etat: {
          ...etatCommun(l, fiche),
          actionFaite: e.etat === "a_renouveler" && e.depotEnAttente,
          origine: new Date(e.echeance.getTime() - 15 * JOUR_MS),
          envois: envoisDe(l, CAMPAGNE_VIGILANCE_ID, fiche.id, origineId),
        },
        payload: { prenom: fiche.prenom, valeurs: {}, origineRelance: origineId },
      },
    ];
  });
}

/**
 * Lot G1 — la demande à l'APPROCHE du seuil : une ligne par fiche de la population dont
 * le cumul (LISIBLE : on n'écrit pas sur une donnée inconnue) atteint l'approche, sans
 * attestation valable. Au seuil, une attestation ÉCHUE relève de S6 (le renouvellement) :
 * jamais deux demandes pour la même chose. Une attestation déposée en vérification est
 * « action faite ».
 */
export function faitsVigilanceSeuil(l: LecturePieces, maintenant: Date): FaitsCampagne[] {
  return population(l).flatMap((fiche): FaitsCampagne[] => {
    const cumul = cumulDe(l, fiche.id);
    if (cumul === null) return [];
    const phase = phaseVigilanceFormateur(cumul);
    if (phase === "sous_le_seuil") return [];
    const pieces = l.pieces.get(fiche.id) ?? [];
    const e = etatPiece(pieces, "attestation_vigilance_urssaf", maintenant);
    if (e.etat === "valable" || e.etat === "a_renouveler") return [];
    if (phase === "seuil_atteint" && e.etat === "echue") return [];
    // L'épisode : la dernière attestation au dossier (une nouvelle pièce en ouvre un autre).
    const derniere = pieces
      .filter((p) => p.type === "attestation_vigilance_urssaf" && p.archiveAt === null)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    const origineId = derniere?.id ?? "aucune";
    return [
      {
        entityId: fiche.id,
        personneId: fiche.id,
        origineId,
        destinataire: fiche.email,
        etat: {
          ...etatCommun(l, fiche),
          actionFaite: e.etat === "en_verification",
          origine: maintenant,
          envois: envoisDe(l, CAMPAGNE_SEUIL_ID, fiche.id, origineId),
        },
        payload: {
          prenom: fiche.prenom,
          valeurs: { montant: SEUIL_VIGILANCE_LIBELLE },
          origineRelance: origineId,
        },
      },
    ];
  });
}

/** S6 bis : une ligne par (fiche de la population, pièce) à renouveler dans les 30 jours. */
export function faitsPieces(l: LecturePieces, maintenant: Date): FaitsCampagne[] {
  return population(l).flatMap((fiche) =>
    TYPES_F41.flatMap((type): FaitsCampagne[] => {
      const e = etatPiece(l.pieces.get(fiche.id) ?? [], type, maintenant);
      if (e.etat !== "a_renouveler") return [];
      const origineId = `${type}-${jourCle(e.echeance)}`;
      const joursRestants = Math.max(
        0,
        Math.ceil((e.echeance.getTime() - maintenant.getTime()) / JOUR_MS),
      );
      return [
        {
          entityId: fiche.id,
          personneId: fiche.id,
          origineId,
          destinataire: fiche.email,
          etat: {
            ...etatCommun(l, fiche),
            actionFaite: e.depotEnAttente,
            origine: new Date(e.echeance.getTime() - 30 * JOUR_MS),
            envois: envoisDe(l, CAMPAGNE_PIECES_ID, fiche.id, origineId),
          },
          payload: {
            prenom: fiche.prenom,
            origineRelance: origineId,
            valeurs: {
              "la pièce": LIBELLE_PIECE_F41[type],
              date: DATE_FR.format(e.echeance),
              N: String(joursRestants),
            },
          },
        },
      ];
    }),
  );
}

// ── La lecture en lot ────────────────────────────────────────────────────

/** Bornes de lecture, comme la console des pièces (L13). */
const PLAFOND_FICHES = 500;
const PLAFOND_PIECES = 10_000;
const PLAFOND_ENVOIS = 20_000;

/**
 * Le `where` de la population (miroir en base de {@link motifHorsPopulation}, qui relit
 * chaque fiche ensuite) : indépendant, hors intervenant d'un organisme, venu d'une
 * candidature « freelance » non refusée, dossier en ligne vérifié, actif, collaboration
 * en cours, adresse non effacée.
 */
export const WHERE_POPULATION: Prisma.TrainerWhereInput = {
  statut: "sous_traitant",
  organismeSousTraitantId: null,
  dossierStatut: "verifie",
  candidatureOrigine: {
    is: {
      natureCollaboration: "freelance",
      status: { notIn: [...STATUTS_NON_RETENUS] },
    },
  },
  actif: true,
  finCollaborationAt: null,
  NOT: { email: { endsWith: "@erased.local" } },
};

const LECTURE_VIDE: LecturePieces = {
  fiches: [],
  pieces: new Map(),
  envois: [],
  opposes: new Set(),
  adressesMortes: new Set(),
};

/**
 * Lecture en lot de la population (ou d'UNE fiche, `seulement`, pour la relecture au
 * départ). Lève si la base ne répond pas : le passage saute la campagne, le départ retient.
 */
export async function lirePourRelances(seulement?: string): Promise<LecturePieces> {
  const lues = await prisma.trainer.findMany({
    where: seulement === undefined ? WHERE_POPULATION : { ...WHERE_POPULATION, id: seulement },
    select: {
      id: true,
      prenom: true,
      email: true,
      statut: true,
      actif: true,
      finCollaborationAt: true,
      organismeSousTraitantId: true,
      dossierStatut: true,
      candidatureOrigine: { select: { natureCollaboration: true, status: true } },
    },
    orderBy: { id: "asc" },
    take: PLAFOND_FICHES,
  });
  if (lues.length >= PLAFOND_FICHES) throw new Error("lecture des fiches tronquée");
  if (lues.length === 0) return LECTURE_VIDE;
  // Pseudonymisée AVEC lien contractuel : l'adresse reste (facturation), mais la personne
  // a exercé son droit à l'effacement — plus aucune relance.
  const effacements = await prisma.activityLog.findMany({
    where: {
      action: ACTION_EFFACEMENT_FORMATEUR,
      targetType: "Trainer",
      targetId: { in: lues.map((f) => f.id) },
    },
    select: { targetId: true },
  });
  const pseudonymisees = new Set(effacements.map((e) => e.targetId));
  const fiches: FicheRelance[] = lues
    .map(({ candidatureOrigine, ...f }): FicheRelance => ({
      ...f,
      candidature: candidatureOrigine,
      pseudonymisee: pseudonymisees.has(f.id),
    }))
    .filter((f) => motifHorsPopulation(f) === null);
  if (fiches.length === 0) return LECTURE_VIDE;
  const ids = fiches.map((f) => f.id);
  const prefixes = [
    `fi-${CAMPAGNE_VIGILANCE_ID}-`,
    `fi-${CAMPAGNE_PIECES_ID}-`,
    `fi-${CAMPAGNE_SEUIL_ID}-`,
  ];
  const empreintes = new Map<string, string>();
  for (const f of fiches) {
    const h = hashEmailForLookup(f.email);
    if (h !== null) empreintes.set(h, f.id);
  }
  const parAdresse = new Map(fiches.map((f) => [f.email.trim().toLowerCase(), f.id]));

  const [docs, journal, corbeille, oppositions, rebonds, cumuls] = await Promise.all([
    prisma.trainerDocument.findMany({
      where: {
        trainerId: { in: ids },
        type: { in: PIECES_SUIVIES.map((p) => p.type) },
        archiveAt: null,
      },
      take: PLAFOND_PIECES,
      select: {
        id: true,
        trainerId: true,
        type: true,
        statutValidation: true,
        fichierUrl: true,
        dateEmission: true,
        dateExpiration: true,
        createdAt: true,
        archiveAt: true,
        rejetMotif: true,
        valideAt: true,
      },
    }),
    prisma.emailLog.findMany({
      where: {
        entityId: { in: ids },
        status: { not: "failed" },
        OR: prefixes.map((p) => ({ jobId: { startsWith: p } })),
      },
      select: { entityId: true, jobId: true, createdAt: true },
      take: PLAFOND_ENVOIS,
    }),
    prisma.emailOutbox.findMany({
      where: { entityId: { in: ids }, OR: prefixes.map((p) => ({ jobId: { startsWith: p } })) },
      select: { entityId: true, jobId: true, createdAt: true },
      take: PLAFOND_ENVOIS,
    }),
    prisma.emailOpposition.findMany({
      where: { emailHash: { in: [...empreintes.keys()] } },
      select: { emailHash: true },
    }),
    prisma.emailLog.findMany({
      where: { recipient: { in: [...parAdresse.keys()] }, status: "bounced", bounceType: "hard" },
      select: { recipient: true },
      distinct: ["recipient"],
    }),
    // Lot G1 — illisible : `null` pour tous (S6 comme avant, demande au seuil muette).
    lireCumulsHonorairesHtCents(ids),
  ]);

  // Une lecture tronquée pourrait cacher la pièce valable la plus récente et faire partir
  // un rappel à tort : échec FERMÉ, le passage saute la campagne.
  if (
    docs.length >= PLAFOND_PIECES ||
    journal.length >= PLAFOND_ENVOIS ||
    corbeille.length >= PLAFOND_ENVOIS
  ) {
    throw new Error("lecture des pièces tronquée");
  }
  const pieces = new Map<string, PieceLue[]>();
  for (const d of docs) {
    const liste = pieces.get(d.trainerId) ?? [];
    liste.push(d as PieceLue);
    pieces.set(d.trainerId, liste);
  }
  const envois: EnvoiTente[] = [...journal, ...corbeille].flatMap((r) =>
    r.entityId !== null && r.jobId !== null
      ? [{ entityId: r.entityId, jobId: r.jobId, at: r.createdAt }]
      : [],
  );
  const opposes = new Set(
    oppositions.flatMap((o) => {
      const id = empreintes.get(o.emailHash);
      return id ? [id] : [];
    }),
  );
  const adressesMortes = new Set(
    rebonds.flatMap((r) => {
      const id = parAdresse.get(r.recipient.trim().toLowerCase());
      return id ? [id] : [];
    }),
  );
  return { fiches, pieces, envois, opposes, adressesMortes, cumuls };
}

// ── Les déclarations ─────────────────────────────────────────────────────

export const CAMPAGNE_VIGILANCE: DeclarationCampagne<EtapeVigilance> = {
  id: CAMPAGNE_VIGILANCE_ID,
  gabarit: "formateur-vigilance",
  entityType: "Trainer",
  classe: "B",
  regle: REGLE_VIGILANCE,
  interrupteurs: ["dossier_en_ligne", "pieces_cron"],
  variante: () => VARIANTE_F40_AVANT_ECHEANCE,
  lireFaits: async (maintenant) => faitsVigilance(await lirePourRelances(), maintenant),
};

/** Lot G1 — F40 variante 4, à l'approche du seuil ; mêmes interrupteurs que S6. */
export const CAMPAGNE_VIGILANCE_SEUIL: DeclarationCampagne<EtapeSeuil> = {
  id: CAMPAGNE_SEUIL_ID,
  gabarit: "formateur-vigilance",
  entityType: "Trainer",
  classe: "B",
  regle: REGLE_VIGILANCE_SEUIL,
  interrupteurs: ["dossier_en_ligne", "pieces_cron"],
  variante: () => VARIANTE_F40_APPROCHE_SEUIL,
  lireFaits: async (maintenant) => faitsVigilanceSeuil(await lirePourRelances(), maintenant),
};

export const CAMPAGNE_PIECES: DeclarationCampagne<EtapePieceF41> = {
  id: CAMPAGNE_PIECES_ID,
  gabarit: "formateur-piece-a-renouveler",
  entityType: "Trainer",
  classe: "B",
  regle: REGLE_PIECE_F41,
  interrupteurs: ["dossier_en_ligne", "pieces_cron"],
  variante: (etape) => VARIANTES_F41[etape as EtapePieceF41] ?? 1,
  lireFaits: async (maintenant) => faitsPieces(await lirePourRelances(), maintenant),
};

// ── La relecture au départ ───────────────────────────────────────────────

const CAMPAGNE_PAR_GABARIT: ReadonlyMap<string, DeclarationCampagne> = new Map(
  [CAMPAGNE_VIGILANCE, CAMPAGNE_PIECES].map((c): [string, DeclarationCampagne] => [c.gabarit, c]),
);

/**
 * Juste avant l'envoi d'une relance F40 / F41 (job en file ou approuvé depuis la
 * corbeille) : la campagne est-elle toujours allumée, la personne toujours dans la
 * population, et CETTE pièce (`payload.origineRelance`) toujours à renouveler, sans
 * dépôt en attente, sans opposition ni adresse morte ? Rend le motif de la retenue, ou
 * `null`. Échec FERMÉ : toute lecture impossible retient.
 */
export async function motifRetenueRelancePiece(
  gabarit: string,
  entityType: string | undefined,
  entityId: string | undefined,
  payload: unknown,
  interrupteursAllumes: (cles: DeclarationCampagne["interrupteurs"]) => Promise<boolean>,
  maintenant: Date = new Date(),
): Promise<string | null> {
  const parGabarit = CAMPAGNE_PAR_GABARIT.get(gabarit);
  if (!parGabarit) return null;
  // Lot G1 : F40 porte deux campagnes ; la variante 4 est la demande au seuil.
  const campagne =
    parGabarit === CAMPAGNE_VIGILANCE &&
    (payload as { etape?: unknown } | null | undefined)?.etape === VARIANTE_F40_APPROCHE_SEUIL
      ? CAMPAGNE_VIGILANCE_SEUIL
      : parGabarit;
  const origine = (payload as { origineRelance?: unknown } | null | undefined)?.origineRelance;
  if (entityType !== "Trainer" || !entityId || typeof origine !== "string") {
    return "relance de pièce sans origine lisible — état invérifiable";
  }
  try {
    if (!(await interrupteursAllumes(campagne.interrupteurs))) {
      return "relances des pièces coupées";
    }
    const l = await lirePourRelances(entityId);
    if (l.fiches.length === 0) return "la personne n'est plus concernée par ces relances";
    const faits =
      campagne === CAMPAGNE_VIGILANCE_SEUIL
        ? faitsVigilanceSeuil(l, maintenant)
        : campagne === CAMPAGNE_VIGILANCE
          ? faitsVigilance(l, maintenant)
          : faitsPieces(l, maintenant);
    const f = faits.find((x) => x.entityId === entityId && x.origineId === origine);
    if (!f) return "la pièce n'est plus à renouveler";
    if (f.etat.actionFaite) return "une nouvelle pièce a été déposée";
    if (f.etat.opposition) return "la personne s'est opposée aux envois";
    if (f.etat.adresseMorte) return "adresse en rebond définitif";
    return null;
  } catch {
    return "état illisible au départ — retenu par prudence";
  }
}
