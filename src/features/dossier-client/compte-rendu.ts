/**
 * Lecture du COMPTE RENDU d'un rendez-vous pour la console (chantier visio, PR 6).
 *
 * Réservé à `ROLES_DOSSIER_ECHANGES` (décision A2) : la page appelle
 * `gardeLectureEchanges` AVANT cette lecture. Toute parole est déchiffrée par
 * `chiffrer-parole` et rendue au composant sous forme de TEXTE : aucun HTML,
 * aucun Markdown, aucun lien produit par l'IA n'atteint l'écran.
 */

import type {
  CompteRenduStatut,
  EtapeVisio,
  MotifRejetFait,
  PrismaClient,
  StatutEtape,
  TypeConsentement,
} from "../../../prisma/generated/client";
import { dechiffrerParole, dechiffrerParoleOuNull } from "@/lib/chiffrer-parole";
import type { LigneReferencee } from "@/server/visio/catalogue-ia";
import type { CompteRenduV1 } from "@/server/visio/schemas/autres";
import type { Couverture } from "@/server/visio/verification/g06-couverture";
import { lireEtat, type EtatCompteRendu } from "@/server/visio/etat-compte-rendu";
import { rencontreAccordAConfirmer } from "@/server/visio/accord-a-confirmer";
import { lireVoix, voixNonAttribuees } from "@/server/visio/gestes-compte-rendu";

export interface DocumentCompteRendu {
  readonly v: 1;
  readonly redaction: CompteRenduV1;
  readonly couverture: Couverture;
  readonly ebauches: ReadonlyArray<{
    readonly projetRef: string;
    /** Pistes d'offre évoquées, SANS PRIX : le devis se compose à la main. */
    readonly lignes: readonly LigneReferencee[];
    readonly hypotheses: readonly string[];
    readonly manquant: readonly string[];
    readonly sansReference: readonly string[];
  }>;
  readonly signaux: readonly string[];
}

export interface FaitAffiche {
  readonly id: string;
  readonly ref: string | null;
  readonly type: string;
  readonly statut: string;
  readonly motifRejet: MotifRejetFait | null;
  readonly enonce: string;
  readonly citation: string | null;
  readonly citationDebutMs: number | null;
  readonly citationVerifiee: boolean;
  readonly certitude: string;
  readonly confiance: string;
  readonly locuteur: string | null;
}

export interface VueCompteRendu {
  readonly rencontre: {
    readonly id: string;
    readonly titre: string;
    readonly debut: Date | null;
    readonly clientId: string | null;
    readonly rattachementStatut: string;
  };
  readonly courant: {
    readonly id: string;
    readonly version: number;
    readonly statut: CompteRenduStatut;
    readonly mode: string | null;
    readonly modele: string | null;
    readonly promptHash: string | null;
    readonly creeLe: Date;
    readonly valideLe: Date | null;
  } | null;
  readonly document: DocumentCompteRendu | null;
  readonly etat: EtatCompteRendu | null;
  readonly versions: ReadonlyArray<{
    readonly version: number;
    readonly statut: CompteRenduStatut;
    readonly mode: string | null;
    readonly creeLe: Date;
  }>;
  readonly faits: readonly FaitAffiche[];
  readonly voix: {
    readonly voixClient: readonly string[];
    readonly nonAttribuees: readonly string[];
    /** Pour chaque voix, la personne à qui ses passages sont attribués (sinon `null`). */
    readonly attribueeA: Readonly<Record<string, string | null>>;
    /** Les personnes à qui une voix peut être attribuée : le client, et Williams (écho). */
    readonly participants: ReadonlyArray<{
      readonly id: string;
      readonly nom: string;
      readonly estWilliams: boolean;
    }>;
  };
  /**
   * ⛔ G16 : l'accord d'une personne qui a parlé côté client n'a pas été
   * retrouvé (ou aucun accord ne l'a été), et Will ne l'a pas encore confirmé
   * à la main. Toute validation est refusée tant que c'est vrai.
   */
  readonly accordAConfirmer: boolean;
  readonly etapes: ReadonlyArray<{
    readonly etape: EtapeVisio;
    readonly statut: StatutEtape;
    readonly classeErreur: string | null;
    readonly derniereErreur: string | null;
    readonly prochaineTentativeLe: Date | null;
  }>;
  readonly enregistrements: ReadonlyArray<{
    readonly statut: string;
    readonly incomplet: boolean;
    readonly audioAPurgerAvant: Date | null;
    readonly audioSupprimeLe: Date | null;
  }>;
  readonly accords: ReadonlyArray<{ readonly type: TypeConsentement; readonly survenuLe: Date }>;
}

const ORDRE_COURANT = ["a_valider", "brouillon", "valide", "a_regenerer", "rejete"];

/**
 * Une étape attend-elle une RÉPONSE de Will (enregistrement de moins de
 * 90 s : « le client a-t-il refusé ? ») ? Suspendue SANS classe d'erreur :
 * ce n'est pas une panne. Lue par la vue du compte rendu et par la page du
 * rendez-vous — une seule règle.
 */
export function attendReponseDeWill(e: {
  readonly etape: string;
  readonly statut: string;
  readonly classeErreur: string | null;
}): boolean {
  return e.etape === "transcrire" && e.statut === "suspendu" && e.classeErreur === null;
}

export interface CircuitDeLaRencontre {
  /** Un enregistrement, une étape ou un compte rendu IA existe : la vue a quelque chose à montrer. */
  readonly aOuvrir: boolean;
  readonly reponseAttendue: boolean;
}

/**
 * Ce que la page du rendez-vous doit savoir du circuit pour rendre la vue du
 * compte rendu ATTEIGNABLE dès qu'il y a un enregistrement — pendant le
 * traitement, après un échec, ou quand Will est attendu —, et pas seulement
 * une fois un compte rendu rédigé. C'est là que se trouvent « Le client
 * retire son accord » (B2) et la réponse aux enregistrements courts.
 */
export async function lireCircuitDeLaRencontre(
  db: PrismaClient,
  rencontreId: string,
): Promise<CircuitDeLaRencontre> {
  const [enregistrements, etapes, crIa] = await Promise.all([
    db.enregistrement.count({ where: { rencontreId } }),
    db.traitementVisio.findMany({
      where: { rencontreId },
      select: { etape: true, statut: true, classeErreur: true },
    }),
    db.compteRendu.count({ where: { rencontreId, origine: "ia" } }),
  ]);
  return {
    aOuvrir: enregistrements > 0 || etapes.length > 0 || crIa > 0,
    reponseAttendue: etapes.some(attendReponseDeWill),
  };
}

export async function lireCompteRendu(
  db: PrismaClient,
  rencontreId: string,
): Promise<VueCompteRendu | null> {
  const r = await db.rencontre.findUnique({
    where: { id: rencontreId },
    select: {
      id: true,
      titre: true,
      debutReel: true,
      debutPrevu: true,
      clientId: true,
      rattachementStatut: true,
    },
  });
  if (!r) return null;
  const [crs, faits, participants, etapes, enregistrements, accords, voixLues] = await Promise.all([
    db.compteRendu.findMany({
      where: { rencontreId },
      orderBy: { version: "desc" },
      select: {
        id: true,
        version: true,
        statut: true,
        mode: true,
        modele: true,
        promptHash: true,
        createdAt: true,
        valideLe: true,
        contenu: true,
        verification: true,
      },
    }),
    db.fait.findMany({
      where: { rencontreId, statut: { not: "efface" }, source: "transcription" },
      orderBy: [{ citationDebutMs: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        refExtraction: true,
        type: true,
        statut: true,
        motifRejet: true,
        enonce: true,
        citation: true,
        citationDebutMs: true,
        citationVerifiee: true,
        certitude: true,
        confiance: true,
        locuteur: true,
      },
    }),
    db.rencontreParticipant.findMany({
      where: { rencontreId, role: { in: ["client", "axion"] } },
      orderBy: { role: "desc" },
      select: { id: true, nomAffiche: true, role: true },
    }),
    db.traitementVisio.findMany({
      where: { rencontreId },
      orderBy: { id: "asc" },
      select: {
        etape: true,
        statut: true,
        classeErreur: true,
        derniereErreur: true,
        prochaineTentativeLe: true,
      },
    }),
    db.enregistrement.findMany({
      where: { rencontreId },
      orderBy: { debut: "desc" },
      select: {
        statut: true,
        incomplet: true,
        audioAPurgerAvant: true,
        audioSupprimeLe: true,
        evenements: true,
      },
    }),
    db.enregistrementConsentement.findMany({
      where: { rencontreId },
      orderBy: { survenuLe: "asc" },
      select: { type: true, survenuLe: true },
    }),
    lireVoix(db, rencontreId),
  ]);
  const { voixClient, attributions } = voixLues;
  const courant =
    [...crs]
      .sort(
        (a, b) =>
          ORDRE_COURANT.indexOf(a.statut) - ORDRE_COURANT.indexOf(b.statut) ||
          b.version - a.version,
      )
      .find((c) => ORDRE_COURANT.includes(c.statut)) ?? null;
  let document: DocumentCompteRendu | null = null;
  let etat: EtatCompteRendu | null = null;
  if (courant) {
    if (courant.contenu !== "")
      document = JSON.parse(dechiffrerParole(courant.contenu)) as DocumentCompteRendu;
    if (courant.verification) etat = lireEtat(dechiffrerParole(courant.verification));
  }
  return {
    rencontre: {
      id: r.id,
      titre: r.titre,
      debut: r.debutReel ?? r.debutPrevu,
      clientId: r.clientId,
      rattachementStatut: r.rattachementStatut,
    },
    courant: courant
      ? {
          id: courant.id,
          version: courant.version,
          statut: courant.statut,
          mode: courant.mode,
          modele: courant.modele,
          promptHash: courant.promptHash,
          creeLe: courant.createdAt,
          valideLe: courant.valideLe,
        }
      : null,
    document,
    etat,
    versions: crs.map((c) => ({
      version: c.version,
      statut: c.statut,
      mode: c.mode,
      creeLe: c.createdAt,
    })),
    faits: faits.map((f) => ({
      id: f.id,
      ref: f.refExtraction,
      type: f.type,
      statut: f.statut,
      motifRejet: f.motifRejet,
      enonce: dechiffrerParole(f.enonce),
      citation: dechiffrerParoleOuNull(f.citation),
      citationDebutMs: f.citationDebutMs,
      citationVerifiee: f.citationVerifiee,
      certitude: f.certitude,
      confiance: f.confiance,
      locuteur: f.locuteur,
    })),
    voix: {
      voixClient,
      nonAttribuees: voixNonAttribuees(voixClient, attributions),
      attribueeA: Object.fromEntries(
        voixClient.map((v) => {
          const ids = attributions.filter((a) => a.voix === v).map((a) => a.participantId);
          return [v, ids.length === 1 ? (ids[0] ?? null) : null];
        }),
      ),
      participants: participants.map((p) => ({
        id: p.id,
        nom: p.nomAffiche,
        estWilliams: p.role === "axion",
      })),
    },
    accordAConfirmer: rencontreAccordAConfirmer(enregistrements),
    etapes,
    enregistrements: enregistrements.map((e) => ({
      statut: e.statut,
      incomplet: e.incomplet,
      audioAPurgerAvant: e.audioAPurgerAvant,
      audioSupprimeLe: e.audioSupprimeLe,
    })),
    accords,
  };
}
