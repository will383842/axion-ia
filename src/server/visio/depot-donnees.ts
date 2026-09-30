/**
 * `PortDonnees` sur la VRAIE base (Prisma) et le VRAI stockage (R2).
 *
 * Toute parole passe par `chiffrer-parole` : chiffrée à l'écriture,
 * déchiffrée à la lecture, et une valeur en clair en base LÈVE (jamais
 * relue comme si de rien n'était). Aucune parole n'est journalisée.
 *
 * Prouvé sur une vraie base par la chaîne de Gate D (`scripts/ci/gate-d-visio.ts`).
 * Module sans `server-only` : il tourne dans le worker.
 */

import { createHash } from "node:crypto";

import type { FaitType, PrismaClient } from "../../../prisma/generated/client";
import {
  chiffrerParole,
  dechiffrerOctets,
  dechiffrerParole,
  dechiffrerParoleOuNull,
} from "@/lib/chiffrer-parole";
import { reponsesFormulaire } from "@/features/admin-rendezvous/a-venir";
import type { ContactDeLaBase, FaitDeLaBase, ProjetDeLaBase } from "./contexte";
import type { Periode, SegmentStocke } from "./dialogue";
import { ETATS_ENREGISTREMENT_ACTIFS } from "./etats";
import { lireEtat } from "./etat-compte-rendu";
import { ajouterAuJournal, lireJournal } from "./journal-enregistrement";
import { euros } from "@/features/dossier-client/libelles";
import { ArretVisio } from "./etapes";
import { ErreurVisio } from "./openai/erreurs";
import { annulerEtapesDesVersions } from "./prise-d-etape";
import { stockageR2, type LectureAudio } from "./stockage-audio";
import type {
  DonneesPasses,
  DonneesPrecontrole,
  FaitDuJour,
  PortDonnees,
  TrancheATraiter,
} from "./port-donnees";

type Db = PrismaClient;

/** V1 P-1 : une version dans l'un de ces statuts ne continue plus le circuit. */
const STATUTS_COMPTE_RENDU_ARRETES: ReadonlySet<string> = new Set(["remplace", "rejete"]);

function journalDit(evenements: string, type: string): boolean {
  return lireJournal(evenements).some((e) => e.type === type);
}

function periodes(json: string | null): Periode[] {
  if (!json) return [];
  try {
    const v: unknown = JSON.parse(json);
    return Array.isArray(v)
      ? v.filter(
          (p): p is Periode =>
            typeof p === "object" &&
            p !== null &&
            Number.isFinite((p as Periode).debutMs) &&
            Number.isFinite((p as Periode).finMs),
        )
      : [];
  } catch {
    return [];
  }
}

/** Les valeurs d'un fait mises en texte (pour P2-P5 et G9). */
export function valeursEnTexte(f: {
  montantMinCents: number | null;
  montantMaxCents: number | null;
  quantite: number | null;
  unite: string | null;
  dateCible: Date | null;
  expressionTemporelle: string | null;
  texteCourt: string | null;
  refCatalogue: string | null;
}): string[] {
  const v: string[] = [];
  if (
    f.montantMinCents !== null &&
    f.montantMaxCents !== null &&
    f.montantMinCents !== f.montantMaxCents
  ) {
    v.push(
      `${euros(f.montantMinCents)} à ${euros(f.montantMaxCents)}`,
      String(f.montantMinCents / 100),
      String(f.montantMaxCents / 100),
    );
  } else if (f.montantMinCents !== null || f.montantMaxCents !== null) {
    const c = (f.montantMinCents ?? f.montantMaxCents)!;
    v.push(euros(c), String(c / 100));
  }
  if (f.quantite !== null) v.push(`${f.quantite}${f.unite ? ` ${f.unite}` : ""}`);
  if (f.dateCible !== null) {
    const d = f.dateCible;
    v.push(
      d.toISOString().slice(0, 10),
      `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
    );
  }
  if (f.expressionTemporelle) v.push(f.expressionTemporelle);
  if (f.texteCourt) v.push(f.texteCourt);
  if (f.refCatalogue) v.push(f.refCatalogue);
  return v;
}

/** Rang d'un enregistrement dans la vue fusionnée : `ordre` reste unique d'une transcription à l'autre. */
const RANG_ENREGISTREMENT = 100_000_000;

interface TranscriptionRetenue {
  readonly transcriptionId: string;
  readonly enregistrementId: string;
  readonly segments: SegmentStocke[];
}

/**
 * Les transcriptions RETENUES de la rencontre — une par enregistrement, du plus
 * ancien au plus récent — et leurs segments FUSIONNÉS (même origine des
 * horodatages ; `ordre` décalé par rang pour rester unique). Après
 * « Arrêter » puis une relance, les deux parties de l'appel sont lues.
 */
async function segmentsRetenus(
  db: Db,
  rencontreId: string,
): Promise<{
  transcriptionId: string;
  enregistrementId: string;
  parEnregistrement: TranscriptionRetenue[];
  segments: SegmentStocke[];
} | null> {
  const ts = await db.transcription.findMany({
    where: { statut: "retenue", enregistrement: { rencontreId } },
    orderBy: [{ enregistrement: { debut: "asc" } }, { createdAt: "desc" }],
    select: { id: true, enregistrementId: true },
  });
  const vus = new Set<string>();
  const parEnregistrement: TranscriptionRetenue[] = [];
  for (const t of ts) {
    if (vus.has(t.enregistrementId)) continue;
    vus.add(t.enregistrementId);
    const lignes = await db.transcriptionSegment.findMany({
      where: { transcriptionId: t.id },
      orderBy: { ordre: "asc" },
      select: {
        ordre: true,
        piste: true,
        debutMs: true,
        finMs: true,
        locuteurBrut: true,
        texte: true,
        horsAccord: true,
        apresRefus: true,
      },
    });
    parEnregistrement.push({
      transcriptionId: t.id,
      enregistrementId: t.enregistrementId,
      segments: lignes.map((s) => ({
        ordre: s.ordre,
        piste: s.piste,
        debutMs: s.debutMs,
        finMs: s.finMs,
        locuteurBrut: s.locuteurBrut,
        texte: dechiffrerParole(s.texte),
        horsAccord: s.horsAccord,
        apresRefus: s.apresRefus,
      })),
    });
  }
  const premiere = parEnregistrement[0];
  if (!premiere) return null;
  return {
    transcriptionId: premiere.transcriptionId,
    enregistrementId: premiere.enregistrementId,
    parEnregistrement,
    segments: parEnregistrement.flatMap((p, rang) =>
      p.segments.map((s) => ({ ...s, ordre: rang * RANG_ENREGISTREMENT + s.ordre })),
    ),
  };
}

async function rencontreDe(db: Db, rencontreId: string) {
  const r = await db.rencontre.findUnique({
    where: { id: rencontreId },
    select: {
      id: true,
      titre: true,
      source: true,
      clientId: true,
      debutPrevu: true,
      debutReel: true,
      finReelle: true,
      calendlyEvent: { select: { rawPayload: true } },
      enregistrements: { orderBy: { debut: "asc" }, select: { debut: true, fin: true } },
    },
  });
  if (!r) return null;
  // Du début du PREMIER enregistrement à la fin du DERNIER (relance comprise).
  const premier = r.enregistrements[0];
  const dernier = r.enregistrements[r.enregistrements.length - 1];
  const debut = r.debutReel ?? premier?.debut ?? r.debutPrevu ?? new Date(0);
  const fin = r.finReelle ?? dernier?.fin ?? debut;
  return {
    ligne: r,
    donnees: {
      id: r.id,
      titre: r.titre,
      source: r.source,
      clientId: r.clientId,
      debut,
      dureeMs: Math.max(0, fin.getTime() - debut.getTime()),
    },
  };
}

async function faitsDuClient(db: Db, clientId: string | null): Promise<FaitDeLaBase[]> {
  if (clientId === null) return [];
  const faits = await db.fait.findMany({
    where: { clientId, statut: "valide" },
    select: {
      id: true,
      type: true,
      cle: true,
      portee: true,
      projetId: true,
      statut: true,
      suivi: true,
      enonce: true,
      constateLe: true,
      rencontreId: true,
    },
  });
  return faits.map((f) => ({ ...f, enonce: dechiffrerParole(f.enonce) }));
}

async function projetsDuClient(db: Db, clientId: string | null): Promise<ProjetDeLaBase[]> {
  if (clientId === null) return [];
  const p = await db.projet.findMany({
    where: { clientId, fusionneDansId: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, numero: true, titre: true, activite: true, statut: true },
  });
  return p.map((x) => ({ ...x, activite: x.activite ?? null }));
}

async function contactsDuClient(db: Db, clientId: string | null): Promise<ContactDeLaBase[]> {
  if (clientId === null) return [];
  const c = await db.clientContact.findMany({
    // Jamais le nom d'une personne opposée à l'IA (art. 21) dans une entrée OpenAI.
    where: { clientId, oppositionIaLe: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, nom: true, fonction: true, statut: true },
  });
  return c.map((x) => ({ ...x, statut: x.statut }));
}

export function depotDonneesPrisma(db: Db, stockage: LectureAudio = stockageR2): PortDonnees {
  return {
    enregistrementActif: async (rencontreId) =>
      (await db.enregistrement.count({
        where: { rencontreId, statut: { in: [...ETATS_ENREGISTREMENT_ACTIFS] } },
      })) > 0,

    oppositionIa: async (rencontreId) => {
      const r = await db.rencontre.findUnique({
        where: { id: rencontreId },
        select: { clientId: true },
      });
      if (!r) return false;
      const surLaFiche =
        r.clientId === null
          ? 0
          : await db.clientContact.count({
              where: { clientId: r.clientId, oppositionIaLe: { not: null } },
            });
      if (surLaFiche > 0) return true;
      const participants = await db.rencontreParticipant.findMany({
        where: { rencontreId, contactId: { not: null } },
        select: { contactId: true },
      });
      const ids = participants.map((p) => p.contactId).filter((x): x is string => x !== null);
      if (ids.length === 0) return false;
      return (
        (await db.clientContact.count({
          where: { id: { in: ids }, oppositionIaLe: { not: null } },
        })) > 0
      );
    },
    abandonnerPourOpposition: async (rencontreId) => {
      await db.enregistrement.updateMany({
        where: { rencontreId, statut: { notIn: [...ETATS_ENREGISTREMENT_ACTIFS] } },
        data: { statut: "abandonne" },
      });
    },

    // ── transcrire ──
    aTranscrire: async (rencontreId) => {
      const liste = await db.enregistrement.findMany({
        where: { rencontreId, statut: { notIn: [...ETATS_ENREGISTREMENT_ACTIFS] } },
        orderBy: { debut: "asc" },
        include: {
          rencontre: { select: { debutReel: true } },
          tranches: {
            orderBy: [{ piste: "asc" }, { numero: "asc" }],
            select: {
              id: true,
              piste: true,
              numero: true,
              debutCaptureEpochMs: true,
              dureeMs: true,
              niveauFinMuet: true,
              statut: true,
              empreinteAnnoncee: true,
            },
          },
        },
      });
      const premier = liste[0];
      if (!premier) return [];
      // UNE origine pour toute la rencontre : les segments d'une relance se
      // placent après ceux de la première partie.
      const origineMs = (premier.rencontre.debutReel ?? premier.debut).getTime();
      return liste.map((e) => ({
        id: e.id,
        rencontreId: e.rencontreId,
        nature: e.nature,
        statut: e.statut,
        debut: e.debut,
        fin: e.fin,
        motifArret: e.motifArret,
        fenetresHorsAccord: periodes(e.fenetresHorsAccord),
        origineMs,
        courtConfirme: journalDit(e.evenements, "court_confirme"),
        tranches: e.tranches.map((t): TrancheATraiter => ({
          ...t,
          debutCaptureEpochMs: Number(t.debutCaptureEpochMs),
        })),
      }));
    },
    lireSonTranche: async (trancheId) => {
      const t = await db.enregistrementTranche.findUnique({
        where: { id: trancheId },
        select: {
          empreinteAnnoncee: true,
          morceaux: { orderBy: { seq: "asc" }, select: { cleR2: true } },
        },
      });
      if (!t) throw new ErreurVisio("contenu", "audio_incomplet", "tranche introuvable");
      const morceaux: Buffer[] = [];
      for (const m of t.morceaux) {
        const chiffre = await stockage.lire(m.cleR2);
        // `getObjectBufferR2` avale les erreurs et rend null : c'est une PANNE, jamais un fichier vide.
        if (chiffre === null)
          throw new ErreurVisio("passagere", "stockage_indisponible", "morceau illisible dans R2");
        morceaux.push(dechiffrerOctets(chiffre));
      }
      const octets = Buffer.concat(morceaux);
      if (
        t.empreinteAnnoncee !== null &&
        createHash("sha256").update(octets).digest("hex") !== t.empreinteAnnoncee
      ) {
        throw new ErreurVisio(
          "contenu",
          "audio_incomplet",
          "empreinte de la tranche différente de l'annonce",
        );
      }
      return octets;
    },
    ouvrirTranscription: async (tx, a) => {
      const existante = await tx.transcription.findUnique({
        where: {
          enregistrementId_empreinteEntree: {
            enregistrementId: a.enregistrementId,
            empreinteEntree: a.empreinteEntree,
          },
        },
        select: { id: true },
      });
      if (existante) return existante.id;
      const derniere = await tx.transcription.findFirst({
        where: { enregistrementId: a.enregistrementId },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      const cree = await tx.transcription.create({
        data: {
          enregistrementId: a.enregistrementId,
          version: (derniere?.version ?? 0) + 1,
          modele: a.modele,
          statut: "en_cours",
          langue: a.langue,
          empreinteEntree: a.empreinteEntree,
        },
        select: { id: true },
      });
      return cree.id;
    },
    ecrireSegmentsTranche: async (tx, a) => {
      await tx.transcriptionSegment.deleteMany({
        where: { transcriptionId: a.transcriptionId, trancheId: a.trancheId },
      });
      if (a.segments.length > 0) {
        await tx.transcriptionSegment.createMany({
          data: a.segments.map((s) => ({
            transcriptionId: a.transcriptionId,
            ordre: s.ordre,
            trancheId: a.trancheId,
            debutMs: s.debutMs,
            finMs: s.finMs,
            piste: s.piste,
            locuteurBrut: s.locuteurBrut,
            texte: s.horsAccord ? "" : chiffrerParole(s.texte),
            horsAccord: s.horsAccord,
          })),
        });
      }
      await tx.enregistrementTranche.update({
        where: { id: a.trancheId },
        data: { statut: "transcrite", transcriteLe: new Date() },
      });
    },
    retenirTranscription: async (tx, a) => {
      await tx.transcription.updateMany({
        where: {
          enregistrementId: a.enregistrementId,
          statut: "retenue",
          NOT: { id: a.transcriptionId },
        },
        data: { statut: "ecartee" },
      });
      await tx.transcription.update({
        where: { id: a.transcriptionId },
        data: { statut: "retenue", dureeAudioSecondes: a.dureeAudioSecondes },
      });
      await tx.enregistrement.update({
        where: { id: a.enregistrementId },
        data: { statut: "transcrit" },
      });
    },
    marquerEnregistrement: async (tx, id, statut) => {
      await tx.enregistrement.update({ where: { id }, data: { statut: statut as never } });
    },

    // ── précontrôler ──
    pourPrecontrole: async (rencontreId) => {
      const s = await segmentsRetenus(db, rencontreId);
      if (!s) return [];
      const premier = await db.enregistrement.findFirst({
        where: { rencontreId },
        orderBy: { debut: "asc" },
        select: { debut: true, rencontre: { select: { debutReel: true } } },
      });
      if (!premier) return [];
      // Même origine que la transcription (`aTranscrire`).
      const origine = (premier.rencontre.debutReel ?? premier.debut).getTime();
      const out: DonneesPrecontrole[] = [];
      for (const p of s.parEnregistrement) {
        const e = await db.enregistrement.findUnique({
          where: { id: p.enregistrementId },
          select: { nature: true, debut: true, fin: true, accordConfirmeLe: true },
        });
        if (!e) continue;
        const preuves = await db.enregistrementConsentement.count({
          where: { enregistrementId: p.enregistrementId, type: "phrase_retrouvee_verifiee" },
        });
        out.push({
          enregistrementId: p.enregistrementId,
          transcriptionId: p.transcriptionId,
          nature: e.nature,
          dureeMs: Math.max(0, (e.fin ?? e.debut).getTime() - e.debut.getTime()),
          accordDeclareMs: e.accordConfirmeLe ? e.accordConfirmeLe.getTime() - origine : null,
          segments: p.segments,
          preuvesDejaEcrites: preuves,
        });
      }
      return out;
    },
    marquerApresRefus: async (tx, transcriptionId, ordres) => {
      await tx.transcriptionSegment.updateMany({
        where: { transcriptionId, ordre: { in: [...ordres] } },
        data: { apresRefus: true, texte: "" },
      });
    },
    ecrirePreuvesAccord: async (tx, a) => {
      for (const accord of a.accords) {
        await tx.enregistrementConsentement.create({
          data: {
            enregistrementId: a.enregistrementId,
            rencontreId: a.rencontreId,
            type: "phrase_retrouvee_verifiee",
            versionTexte: "transcription-v1",
            texteReponse: chiffrerParole(accord.texte),
            reponseMs: Math.round(accord.reponseMs),
            survenuLe: new Date(),
          },
        });
      }
    },
    noterAuJournal: async (tx, enregistrementId, entree) => {
      const e = await tx.enregistrement.findUnique({
        where: { id: enregistrementId },
        select: { evenements: true },
      });
      if (!e) return;
      const type = Object.entries(entree)
        .map(([k, v]) => (k === "type" ? String(v) : `${k.slice(0, 3)}=${String(v)}`))
        .join(" ")
        .slice(0, 40);
      await tx.enregistrement.update({
        where: { id: enregistrementId },
        data: { evenements: ajouterAuJournal(e.evenements, { le: new Date(), type }) },
      });
    },

    // ── extraire ──
    pourExtraction: async (rencontreId) => {
      const r = await rencontreDe(db, rencontreId);
      const s = await segmentsRetenus(db, rencontreId);
      if (!r || !s) return null;
      const utiles = s.segments.filter((x) => !x.horsAccord && !x.apresRefus && x.texte !== "");
      const deja = await db.compteRendu.count({ where: { rencontreId, origine: "ia" } });
      return {
        rencontre: r.donnees,
        transcriptionId: s.transcriptionId,
        segments: s.segments,
        pistes: {
          client: utiles.some((x) => x.piste === "client") ? "OK" : "MUETTE",
          axion: utiles.some((x) => x.piste === "axion") ? "OK" : "MUETTE",
        },
        formulaire: reponsesFormulaire(r.ligne.calendlyEvent?.rawPayload ?? null),
        contacts: await contactsDuClient(db, r.donnees.clientId),
        projets: await projetsDuClient(db, r.donnees.clientId),
        faitsClient: await faitsDuClient(db, r.donnees.clientId),
        mode: deja > 0 ? "reextraire" : "initial",
      };
    },
    creerCompteRendu: async (tx, a) => {
      // Les versions en cours sont remplacées ; leurs faits encore PROPOSÉS
      // sont rejetés (`version_remplacee`) — jamais deux jeux de propositions.
      const enCours = await tx.compteRendu.findMany({
        where: { rencontreId: a.rencontreId, statut: { in: ["brouillon", "a_valider"] } },
        select: { id: true },
      });
      const ids = enCours.map((c) => c.id);
      if (ids.length > 0) {
        await tx.compteRendu.updateMany({
          where: { id: { in: ids } },
          data: { statut: "remplace" },
        });
        await annulerEtapesDesVersions(tx, ids);
        const proposes = await tx.fait.findMany({
          where: { compteRenduId: { in: ids }, statut: { in: ["propose", "en_attente"] } },
          select: { id: true },
        });
        await tx.fait.updateMany({
          where: { id: { in: proposes.map((f) => f.id) } },
          data: { statut: "rejete", motifRejet: "version_remplacee" },
        });
        if (proposes.length > 0) {
          await tx.faitEvenement.createMany({
            data: proposes.map((f) => ({
              faitId: f.id,
              action: "rejete_regeneration" as const,
              motif: "version_remplacee" as const,
            })),
          });
        }
      }
      const derniere = await tx.compteRendu.findFirst({
        where: { rencontreId: a.rencontreId },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      const cr = await tx.compteRendu.create({
        data: {
          rencontreId: a.rencontreId,
          version: (derniere?.version ?? 0) + 1,
          origine: "ia",
          mode: a.mode,
          statut: "brouillon",
          modele: a.modele,
          promptHash: a.promptHash,
          schemaVersion: a.schemaVersion,
          contenu: "",
          verification: chiffrerParole(JSON.stringify(a.etat)),
        },
        select: { id: true },
      });
      if (a.transcriptionId !== null) {
        // Toutes les transcriptions retenues de la rencontre (relance comprise).
        const retenues = await tx.transcription.findMany({
          where: { statut: "retenue", enregistrement: { rencontreId: a.rencontreId } },
          select: { id: true },
        });
        const ids = new Set([a.transcriptionId, ...retenues.map((t) => t.id)]);
        await tx.compteRenduSource.createMany({
          data: [...ids].map((transcriptionId) => ({ compteRenduId: cr.id, transcriptionId })),
          skipDuplicates: true,
        });
      }
      return cr.id;
    },
    effacerSansCompteRendu: async (tx, rencontreId) => {
      const enr = await tx.enregistrement.findMany({
        where: { rencontreId },
        select: { id: true },
      });
      const trs = await tx.transcription.findMany({
        where: { enregistrementId: { in: enr.map((e) => e.id) } },
        select: { id: true },
      });
      await tx.transcriptionSegment.deleteMany({
        where: { transcriptionId: { in: trs.map((t) => t.id) } },
      });
      await tx.transcription.updateMany({
        where: { id: { in: trs.map((t) => t.id) } },
        data: { statut: "ecartee", segmentsSupprimesLe: new Date() },
      });
      await tx.enregistrement.updateMany({
        where: { id: { in: enr.map((e) => e.id) } },
        data: { statut: "abandonne" },
      });
    },

    // ── vérifier les faits ──
    pourVerificationFaits: async (compteRenduId) => {
      const cr = await db.compteRendu.findUnique({
        where: { id: compteRenduId },
        select: { rencontreId: true, verification: true },
      });
      if (!cr || !cr.verification) return null;
      const r = await rencontreDe(db, cr.rencontreId);
      const s = await segmentsRetenus(db, cr.rencontreId);
      if (!r || !s) return null;
      const valides = await db.fait.findMany({
        where: { rencontreId: cr.rencontreId, statut: "valide" },
        select: { id: true, type: true, cle: true, citationDebutMs: true },
      });
      return {
        rencontre: r.donnees,
        compteRenduId,
        etat: lireEtat(dechiffrerParole(cr.verification)),
        segments: s.segments,
        enregistrementId: s.enregistrementId,
        faitsValidesDeLaRencontre: valides,
      };
    },
    ecrireFaits: async (tx, a) => {
      const refs: Array<readonly [string, string]> = [];
      for (const f of a.faits) {
        const portee =
          a.clientId !== null && f.statut !== "rejete" && f.porteeDeclaree === "entreprise"
            ? "entreprise"
            : "a_ranger";
        const cree = await tx.fait.create({
          data: {
            clientId: a.clientId,
            portee: portee as never,
            type: f.type,
            cle: f.cle,
            enonce: chiffrerParole(f.enonce),
            montantMinCents: f.montantMinCents,
            montantMaxCents: f.montantMaxCents,
            baseMontant: f.baseMontant,
            periodeMontant: f.periodeMontant,
            dateCible: f.dateCible ? new Date(`${f.dateCible}T00:00:00Z`) : null,
            precisionDate: f.precisionDate,
            expressionTemporelle: f.expressionTemporelle
              ? chiffrerParole(f.expressionTemporelle)
              : null,
            quantite: f.quantite,
            unite: f.unite as never,
            refCatalogue: f.refCatalogue,
            texteCourt: f.texteCourt ? chiffrerParole(f.texteCourt) : null,
            certitude: f.certitude,
            confiance: f.confiance,
            source: "transcription",
            rencontreId: a.rencontreId,
            compteRenduId: a.compteRenduId,
            refExtraction: f.ref.slice(0, 8),
            locuteur: f.locuteur,
            citation: f.citation ? chiffrerParole(f.citation) : null,
            citationDebutMs: f.citationDebutMs,
            citationFinMs: f.citationFinMs,
            confirmationCitation: f.confirmationCitation
              ? chiffrerParole(f.confirmationCitation)
              : null,
            confirmationDebutMs: f.confirmationDebutMs,
            confirmationFinMs: f.confirmationFinMs,
            citationVerifiee: f.statut !== "rejete",
            ambiguite: f.ambiguite ? chiffrerParole(f.ambiguite) : null,
            constateLe: a.constateLe,
            statut: f.statut,
            motifRejet: f.motif,
            doublonDeFaitId: f.doublonDeFaitId,
          },
          select: { id: true },
        });
        await tx.faitEvenement.create({
          data: {
            faitId: cree.id,
            action: f.statut === "rejete" ? "rejete" : "propose",
            motif: f.motif,
          },
        });
        refs.push([f.ref, cree.id] as const);
      }
      return refs;
    },

    // ── passes ──
    pourPasses: async (compteRenduId) => {
      const cr = await db.compteRendu.findUnique({
        where: { id: compteRenduId },
        select: { id: true, rencontreId: true, statut: true, verification: true },
      });
      if (!cr) return null;
      // V1 P-1 : une version remplacée (rattachement tardif) ou rejetée ne
      // continue pas le circuit — aucun appel à OpenAI pour elle.
      if (STATUTS_COMPTE_RENDU_ARRETES.has(cr.statut)) throw new ArretVisio("inconnu");
      const r = await rencontreDe(db, cr.rencontreId);
      if (!r) return null;
      const etat = cr.verification ? lireEtat(dechiffrerParole(cr.verification)) : null;
      const idsDuJour = etat ? etat.faits.map(([, id]) => id) : [];
      const refParId = new Map(etat ? etat.faits.map(([ref, id]) => [id, ref] as const) : []);
      // Réécriture sans état (compte rendu vidé) : les faits encore vivants de la rencontre.
      const lignes = await db.fait.findMany({
        where:
          etat && idsDuJour.length > 0
            ? { id: { in: idsDuJour } }
            : { rencontreId: cr.rencontreId, statut: { in: ["propose", "en_attente", "valide"] } },
        orderBy: { createdAt: "asc" },
      });
      const faitsDuJour: FaitDuJour[] = lignes.map((f, i) => ({
        id: f.id,
        ref: refParId.get(f.id) ?? f.refExtraction ?? `F${String(i + 1).padStart(2, "0")}`,
        type: f.type as FaitType,
        statut: f.statut,
        porteeDeclaree: f.portee === "entreprise" ? "entreprise" : "projet",
        projetRef: null,
        enonce: dechiffrerParole(f.enonce),
        citation: dechiffrerParoleOuNull(f.citation),
        valeurs: valeursEnTexte({
          ...f,
          expressionTemporelle: dechiffrerParoleOuNull(f.expressionTemporelle),
          texteCourt: dechiffrerParoleOuNull(f.texteCourt),
        }),
        locuteur: f.locuteur === "client" || f.locuteur === "axion" ? f.locuteur : null,
        confiance: f.confiance,
      }));
      // La portée DÉCLARÉE (projet J…) vient de l'extraction : elle est gardée dans l'état.
      const declarations = new Map(
        etat ? etat.declarations.map(([ref, portee, j]) => [ref, { portee, j }] as const) : [],
      );
      const donnees: DonneesPasses = {
        rencontre: r.donnees,
        compteRenduId: cr.id,
        statutCompteRendu: cr.statut,
        etat,
        faitsDuJour: faitsDuJour.map((f) => {
          const d = declarations.get(f.ref);
          return d ? { ...f, porteeDeclaree: d.portee, projetRef: d.j } : f;
        }),
        projets: await projetsDuClient(db, r.donnees.clientId),
        faitsConnus: await faitsDuClient(db, r.donnees.clientId),
      };
      return donnees;
    },
    majEtat: async (tx, compteRenduId, etat) => {
      await tx.compteRendu.update({
        where: { id: compteRenduId },
        data: { verification: chiffrerParole(JSON.stringify(etat)) },
      });
    },
    finaliserCompteRendu: async (tx, a) => {
      // V1 P-1 : « à valider » ne s'écrit que sur un BROUILLON. 0 ligne = la
      // version a été remplacée ou rejetée entre-temps : on s'arrête, la
      // transaction est annulée, rien n'est écrit.
      const n = await tx.compteRendu.updateMany({
        where: { id: a.compteRenduId, statut: "brouillon" },
        data: {
          contenu: chiffrerParole(a.contenu),
          verification: chiffrerParole(JSON.stringify(a.etat)),
          statut: "a_valider",
          ...(a.modele ? { modele: a.modele } : {}),
        },
      });
      if (n.count === 0) throw new ArretVisio("inconnu");
      await tx.enregistrement.updateMany({
        where: { rencontreId: a.rencontreId, statut: { in: ["transcrit", "en_traitement"] } },
        data: { statut: "compte_rendu_pret" },
      });
    },
    rejeterCompteRendu: async (tx, compteRenduId) => {
      await tx.compteRendu.update({ where: { id: compteRenduId }, data: { statut: "rejete" } });
    },

    // ── purge ──
    audiosAPurger: async (rencontreId) => {
      const enr = await db.enregistrement.findMany({
        where: {
          rencontreId,
          audioSupprimeLe: null,
          statut: { notIn: [...ETATS_ENREGISTREMENT_ACTIFS] },
        },
        select: {
          id: true,
          statut: true,
          audioAPurgerAvant: true,
          tranches: { select: { id: true, morceaux: { select: { cleR2: true } } } },
          transcriptions: {
            where: { sources: { some: { compteRendu: { statut: "valide" } } } },
            select: { id: true },
            take: 1,
          },
        },
      });
      return enr.map((e) => ({
        enregistrementId: e.id,
        trancheIds: e.tranches.map((t) => t.id),
        cles: e.tranches.flatMap((t) => t.morceaux.map((m) => m.cleR2)),
        statut: e.statut,
        audioAPurgerAvant: e.audioAPurgerAvant,
        compteRenduValide: e.transcriptions.length > 0,
      }));
    },
    supprimerObjet: (cle) => stockage.supprimer(cle),
    objetExiste: (cle) => stockage.existe(cle),
    marquerAudioPurge: async (tx, a, le) => {
      await tx.enregistrementTranche.updateMany({
        where: { id: { in: [...a.trancheIds] } },
        data: { statut: "purgee", audioSupprimeLe: le, tailleOctets: 0 },
      });
      await tx.enregistrement.update({
        where: { id: a.enregistrementId },
        data: { audioSupprimeLe: le },
      });
    },
  };
}
