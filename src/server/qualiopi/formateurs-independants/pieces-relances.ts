/**
 * Relances des pièces à renouveler d'un formateur indépendant (lot L13b ; séquences
 * S6 et S6 bis de 10c §3, inscrites au registre des campagnes de CAMP-3).
 *
 * - **S6 — attestation URSSAF (F40, variante « avant l'échéance »)** : 15 jours avant
 *   l'échéance, puis tous les 15 jours, 3 fois au plus (texte F40 soumis à Will). Les
 *   relances continuent après l'échéance : ce sont elles qui débloquent.
 * - **S6 bis — CV et assurance RC pro (F41)** : 30 jours puis 15 jours avant l'échéance
 *   (texte F41 soumis à Will). Rien après l'échéance.
 *
 * 🔑 Rien n'est recréé : l'état d'une pièce vient de `pieces-a-renouveler.ts` (lot L13),
 * la décision du moteur commun (`lib/relances/campagne.ts`), l'envoi de l'adaptateur des
 * formateurs (texte validé, fin de collaboration, crochets) via le passage de CAMP-3.
 *
 * 🔴 ÉTEINT : les deux campagnes exigent `formateurs.pieces_cron`. Interrupteur absent,
 * le passage ne les lit même pas.
 *
 * Hors périmètre (dit dans le RAPPORT L13b) : F40 « avant une formation », F41 « pièce
 * refusée » (le motif de refus en base est un texte libre, pas un motif fermé), F57.
 *
 * Module sans `server-only` : il tourne dans le worker `formation-crons`.
 */

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

const JOUR_MS = 24 * 60 * 60 * 1000;

/** Identifiants des campagnes : ils entrent dans la clé d'envoi (`fi-vigilance-…`, `fi-piece-…`). */
const CAMPAGNE_VIGILANCE_ID = "vigilance";
const CAMPAGNE_PIECES_ID = "piece";

/** Une fiche telle que lue pour les relances. */
export interface FicheRelance {
  readonly id: string;
  readonly prenom: string;
  readonly email: string;
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

/** Variantes du texte F40 (1 = à la signature, 2 = avant l'échéance, 3 = avant une formation). */
const VARIANTE_F40_AVANT_ECHEANCE = 2;
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

const estEffacee = (email: string) =>
  email.trim() === "" || email.endsWith("@erased.local") || email === MARQUE_EFFACEMENT;

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
    efface: estEffacee(fiche.email),
    opposition: l.opposes.has(fiche.id),
    adresseMorte: l.adressesMortes.has(fiche.id),
    // La lecture ne prend que des fiches ouvertes (sans fin de collaboration).
    close: false,
    // ⚠️ Les réponses humaines (Zoho) ne se lisent pas encore (CAMP-4) : aucune pause.
    reponseHumaine: false,
    derniereRelancePersonne: null,
  };
}

/** S6 : une ligne par fiche dont l'attestation arrive à échéance ou est échue. */
export function faitsVigilance(l: LecturePieces, maintenant: Date): FaitsCampagne[] {
  return l.fiches.flatMap((fiche): FaitsCampagne[] => {
    const e: EtatPiece = etatPiece(
      l.pieces.get(fiche.id) ?? [],
      "attestation_vigilance_urssaf",
      maintenant,
    );
    if (e.etat !== "a_renouveler" && e.etat !== "echue") return [];
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
        payload: { prenom: fiche.prenom, valeurs: {} },
      },
    ];
  });
}

/** S6 bis : une ligne par (fiche, pièce) à renouveler dans les 30 jours. */
export function faitsPieces(l: LecturePieces, maintenant: Date): FaitsCampagne[] {
  return l.fiches.flatMap((fiche) =>
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
 * Indépendants seulement : actifs, sans fin de collaboration, hors intervenants d'un
 * organisme (qui n'ont pas d'espace). Lève si la base ne répond pas : le passage saute
 * la campagne.
 */
export async function lirePourRelances(): Promise<LecturePieces> {
  const fiches = await prisma.trainer.findMany({
    where: {
      statut: "sous_traitant",
      actif: true,
      finCollaborationAt: null,
      organismeSousTraitantId: null,
    },
    select: { id: true, prenom: true, email: true },
    orderBy: { id: "asc" },
    take: PLAFOND_FICHES,
  });
  if (fiches.length === 0) {
    return {
      fiches: [],
      pieces: new Map(),
      envois: [],
      opposes: new Set(),
      adressesMortes: new Set(),
    };
  }
  const ids = fiches.map((f) => f.id);
  const prefixes = [`fi-${CAMPAGNE_VIGILANCE_ID}-`, `fi-${CAMPAGNE_PIECES_ID}-`];
  const empreintes = new Map<string, string>();
  for (const f of fiches) {
    const h = hashEmailForLookup(f.email);
    if (h !== null) empreintes.set(h, f.id);
  }
  const parAdresse = new Map(fiches.map((f) => [f.email.trim().toLowerCase(), f.id]));

  const [docs, journal, corbeille, oppositions, rebonds] = await Promise.all([
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
  ]);

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
  return { fiches, pieces, envois, opposes, adressesMortes };
}

// ── Les déclarations ─────────────────────────────────────────────────────

export const CAMPAGNE_VIGILANCE: DeclarationCampagne<EtapeVigilance> = {
  id: CAMPAGNE_VIGILANCE_ID,
  gabarit: "formateur-vigilance",
  entityType: "Trainer",
  classe: "B",
  regle: REGLE_VIGILANCE,
  interrupteurs: ["pieces_cron"],
  variante: () => VARIANTE_F40_AVANT_ECHEANCE,
  lireFaits: async (maintenant) => faitsVigilance(await lirePourRelances(), maintenant),
};

export const CAMPAGNE_PIECES: DeclarationCampagne<EtapePieceF41> = {
  id: CAMPAGNE_PIECES_ID,
  gabarit: "formateur-piece-a-renouveler",
  entityType: "Trainer",
  classe: "B",
  regle: REGLE_PIECE_F41,
  interrupteurs: ["pieces_cron"],
  variante: (etape) => VARIANTES_F41[etape as EtapePieceF41] ?? 1,
  lireFaits: async (maintenant) => faitsPieces(await lirePourRelances(), maintenant),
};
