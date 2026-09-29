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
import { ErreurVisio } from "./openai/erreurs";
import type { DonneesPasses, FaitDuJour, PortDonnees, TrancheATraiter } from "./port-donnees";

/** Le stockage des objets audio (R2 ; en mémoire pour Gate D). */
export interface StockageLecture {
  /** `null` = panne (jamais un fichier vide). */
  readonly lire: (cle: string) => Promise<Buffer | null>;
  readonly supprimer: (cle: string) => Promise<void>;
  readonly existe: (cle: string) => Promise<boolean>;
}

export const stockageLectureR2: StockageLecture = {
  lire: async (cle) => {
    const { getObjectBufferR2 } = await import("@/lib/r2-storage");
    return getObjectBufferR2(cle);
  },
  supprimer: async (cle) => {
    const { deleteFromR2 } = await import("@/lib/r2-storage");
    await deleteFromR2(cle);
  },
  existe: async (cle) => {
    const { existsInR2 } = await import("@/lib/r2-storage");
    return existsInR2(cle);
  },
};

type Db = PrismaClient;

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

function euros(cents: number): string {
  return `${(cents / 100).toLocaleString("fr-FR")} €`;
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

async function segmentsRetenus(
  db: Db,
  rencontreId: string,
): Promise<{
  transcriptionId: string;
  enregistrementId: string;
  segments: SegmentStocke[];
} | null> {
  const t = await db.transcription.findFirst({
    where: { statut: "retenue", enregistrement: { rencontreId } },
    orderBy: { createdAt: "desc" },
    select: { id: true, enregistrementId: true },
  });
  if (!t) return null;
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
  return {
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
      enregistrements: { orderBy: { debut: "desc" }, take: 1, select: { debut: true, fin: true } },
    },
  });
  if (!r) return null;
  const e = r.enregistrements[0];
  const debut = r.debutReel ?? e?.debut ?? r.debutPrevu ?? new Date(0);
  const fin = r.finReelle ?? e?.fin ?? debut;
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
    where: { clientId },
    orderBy: { createdAt: "asc" },
    select: { id: true, nom: true, fonction: true, statut: true },
  });
  return c.map((x) => ({ ...x, statut: x.statut }));
}

export function depotDonneesPrisma(
  db: Db,
  stockage: StockageLecture = stockageLectureR2,
): PortDonnees {
  return {
    enregistrementActif: async (rencontreId) =>
      (await db.enregistrement.count({
        where: { rencontreId, statut: { in: [...ETATS_ENREGISTREMENT_ACTIFS] } },
      })) > 0,

    // ── transcrire ──
    aTranscrire: async (rencontreId) => {
      const e = await db.enregistrement.findFirst({
        where: { rencontreId, statut: { notIn: [...ETATS_ENREGISTREMENT_ACTIFS] } },
        orderBy: { debut: "desc" },
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
      if (!e) return null;
      return {
        id: e.id,
        rencontreId: e.rencontreId,
        nature: e.nature,
        statut: e.statut,
        debut: e.debut,
        fin: e.fin,
        motifArret: e.motifArret,
        fenetresHorsAccord: periodes(e.fenetresHorsAccord),
        origineMs: (e.rencontre.debutReel ?? e.debut).getTime(),
        courtConfirme: journalDit(e.evenements, "court_confirme"),
        tranches: e.tranches.map((t): TrancheATraiter => ({
          ...t,
          debutCaptureEpochMs: Number(t.debutCaptureEpochMs),
        })),
      };
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
      if (!s) return null;
      const e = await db.enregistrement.findUnique({
        where: { id: s.enregistrementId },
        select: {
          nature: true,
          debut: true,
          fin: true,
          accordConfirmeLe: true,
          rencontre: { select: { debutReel: true } },
        },
      });
      if (!e) return null;
      const origine = (e.rencontre.debutReel ?? e.debut).getTime();
      const preuves = await db.enregistrementConsentement.count({
        where: { enregistrementId: s.enregistrementId, type: "phrase_retrouvee_verifiee" },
      });
      return {
        enregistrementId: s.enregistrementId,
        transcriptionId: s.transcriptionId,
        nature: e.nature,
        dureeMs: Math.max(0, (e.fin ?? e.debut).getTime() - e.debut.getTime()),
        accordDeclareMs: e.accordConfirmeLe ? e.accordConfirmeLe.getTime() - origine : null,
        segments: s.segments,
        preuvesDejaEcrites: preuves,
      };
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
        await tx.compteRenduSource.create({
          data: { compteRenduId: cr.id, transcriptionId: a.transcriptionId },
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
      await tx.compteRendu.update({
        where: { id: a.compteRenduId },
        data: {
          contenu: chiffrerParole(a.contenu),
          verification: chiffrerParole(JSON.stringify(a.etat)),
          statut: "a_valider",
          ...(a.modele ? { modele: a.modele } : {}),
        },
      });
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
          tranches: { select: { id: true, morceaux: { select: { cleR2: true } } } },
        },
      });
      return enr.map((e) => ({
        enregistrementId: e.id,
        trancheIds: e.tranches.map((t) => t.id),
        cles: e.tranches.flatMap((t) => t.morceaux.map((m) => m.cleR2)),
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
