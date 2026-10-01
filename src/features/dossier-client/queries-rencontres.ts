/**
 * Les lectures des écrans des RENCONTRES (chantier visio, PR 4) : « Après
 * l'appel », la page du compte rendu, « À classer », les cartes de l'onglet
 * « Rendez-vous », la fusion sur la fiche client.
 *
 * Même contrat que `queries.ts` (dont le nom de ce module porte le MARQUEUR
 * `dossier-client/queries`) : appelées APRÈS la garde du rôle, jamais avant ;
 * les paroles déchiffrées ICI, par `dechiffrerParole` seulement ; une valeur
 * illisible ne fait pas tomber la page.
 */

import type {
  Confiance,
  FaitCertitude,
  FaitPortee,
  FaitStatut,
  FaitType,
  MotifProposition,
  RattachementStatut,
  RencontreSource,
  RencontreStatut,
  RencontreType,
  RendezVousIssue,
  RendezVousSuite,
} from "../../../prisma/generated/client";
import { prisma } from "@/lib/prisma";
import { dechiffrerParole } from "@/lib/chiffrer-parole";
import { TEXTE_ILLISIBLE } from "./queries";
import { debriefsExistants, type DebriefExistant } from "./debriefs-existants";
import { entrepriseDeclaree, reponsesFormulaire } from "@/features/admin-rendezvous/a-venir";
import { lireEtat } from "@/server/visio/etat-compte-rendu";
import { evocationsDe, type Evocations } from "./projets-evoques";
import {
  caseTestInterneVisible,
  estClientTestInterne,
  HORS_RENCONTRES_DE_TEST,
  modePiloteDisponible,
} from "./client-test";

function lire(valeur: string | null): string | null {
  if (valeur === null) return null;
  try {
    return dechiffrerParole(valeur);
  } catch {
    return TEXTE_ILLISIBLE;
  }
}

export interface FicheCourte {
  readonly id: string;
  readonly numero: string;
  readonly raisonSociale: string;
}

export interface FaitDeLaRencontre {
  readonly id: string;
  readonly type: FaitType;
  readonly portee: FaitPortee;
  readonly projetId: string | null;
  readonly statut: FaitStatut;
  readonly confiance: Confiance;
  readonly certitude: FaitCertitude;
  readonly enonce: string;
  readonly question: string | null;
}

export interface RencontreDetaillee {
  readonly id: string;
  readonly titre: string;
  readonly type: RencontreType;
  readonly source: RencontreSource;
  readonly debutPrevu: Date | null;
  readonly finPrevue: Date | null;
  readonly statut: RencontreStatut | null;
  readonly estTestInterne: boolean;
  readonly repriseHistorique: boolean;
  readonly rattachementStatut: RattachementStatut;
  readonly client: FicheCourte | null;
  readonly clientPropose: FicheCourte | null;
  readonly motifProposition: MotifProposition | null;
  readonly projetId: string | null;
  readonly calendlyEventId: string | null;
  /** Le titulaire de la réservation (écran d'un administrateur). */
  readonly titulaire: { readonly nom: string | null; readonly email: string | null } | null;
  readonly entrepriseDeclaree: { readonly nom: string | null; readonly ville: string | null };
  readonly reponsesFormulaire: ReadonlyArray<{ question: string; reponse: string }>;
  /** Les débriefs déjà écrits (notes Calendly, point de l'onglet) — A4. */
  readonly debriefs: ReadonlyArray<DebriefExistant>;
  readonly participants: ReadonlyArray<{ nom: string; role: string }>;
  readonly suivi: {
    readonly issue: RendezVousIssue;
    readonly suite: RendezVousSuite | null;
    readonly suiteLe: Date | null;
  } | null;
  readonly comptesRendus: ReadonlyArray<{
    readonly id: string;
    readonly version: number;
    readonly origine: string;
    readonly statut: string;
    readonly valideLe: Date | null;
    readonly champs: ReadonlyArray<{ type: string; enonce: string }>;
  }>;
  readonly faits: ReadonlyArray<FaitDeLaRencontre>;
  /** Projets évoqués et propositions de P2 (V1-03), `null` sans compte rendu lisible. */
  readonly evocations: Evocations | null;
}

/** Les projets évoqués du compte rendu vivant le plus récent ; illisible : `null`. */
function evocationsDuCompteRendu(
  comptesRendus: ReadonlyArray<{ statut: string; verification: string | null }>,
): Evocations | null {
  const cr = comptesRendus.find(
    (c) => c.verification !== null && c.statut !== "remplace" && c.statut !== "rejete",
  );
  const clair = cr ? lire(cr.verification) : null;
  if (clair === null || clair === TEXTE_ILLISIBLE) return null;
  try {
    return evocationsDe(lireEtat(clair));
  } catch {
    return null;
  }
}

async function ficheCourte(id: string | null): Promise<FicheCourte | null> {
  if (id === null) return null;
  return prisma.client.findUnique({
    where: { id },
    select: { id: true, numero: true, raisonSociale: true },
  });
}

/** Tout ce qu'affichent « Après l'appel » et la page du compte rendu. */
export async function lireRencontreDetaillee(
  rencontreId: string,
): Promise<RencontreDetaillee | null> {
  const r = await prisma.rencontre.findUnique({
    where: { id: rencontreId },
    select: {
      id: true,
      titre: true,
      type: true,
      source: true,
      debutPrevu: true,
      finPrevue: true,
      statut: true,
      estTestInterne: true,
      repriseHistorique: true,
      rattachementStatut: true,
      clientId: true,
      clientProposeId: true,
      motifProposition: true,
      projetId: true,
      calendlyEventId: true,
      participants: { select: { nomAffiche: true, role: true } },
      suivi: { select: { issue: true, suite: true, suiteLe: true } },
      comptesRendus: {
        select: {
          id: true,
          version: true,
          origine: true,
          statut: true,
          valideLe: true,
          contenu: true,
          verification: true,
        },
        orderBy: { version: "desc" },
      },
      faits: {
        where: { statut: { in: ["propose", "en_attente", "valide"] } },
        select: {
          id: true,
          type: true,
          portee: true,
          projetId: true,
          statut: true,
          confiance: true,
          certitude: true,
          enonce: true,
          texteCourt: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (r === null) return null;
  const ev = r.calendlyEventId
    ? await prisma.calendlyEvent.findUnique({
        where: { id: r.calendlyEventId },
        select: { inviteeName: true, inviteeEmail: true, rawPayload: true, notes: true },
      })
    : null;
  const point = r.calendlyEventId
    ? await prisma.rendezVousSuivi.findUnique({
        where: { calendlyEventId: r.calendlyEventId },
        select: { note: true },
      })
    : null;

  return {
    id: r.id,
    titre: r.titre,
    type: r.type,
    source: r.source,
    debutPrevu: r.debutPrevu,
    finPrevue: r.finPrevue,
    statut: r.statut,
    estTestInterne: r.estTestInterne,
    repriseHistorique: r.repriseHistorique,
    rattachementStatut: r.rattachementStatut,
    client: await ficheCourte(r.clientId),
    clientPropose: await ficheCourte(r.clientProposeId),
    motifProposition: r.motifProposition,
    projetId: r.projetId,
    calendlyEventId: r.calendlyEventId,
    titulaire: ev ? { nom: ev.inviteeName, email: ev.inviteeEmail } : null,
    entrepriseDeclaree: ev ? entrepriseDeclaree(ev.rawPayload) : { nom: null, ville: null },
    // Le téléphone est déjà écarté par la règle de l'onglet « Rendez-vous ».
    reponsesFormulaire: ev ? reponsesFormulaire(ev.rawPayload) : [],
    debriefs: debriefsExistants({ notesCalendly: ev?.notes, noteDuPoint: point?.note }),
    participants: r.participants.map((p) => ({ nom: p.nomAffiche, role: p.role })),
    suivi: r.suivi,
    comptesRendus: r.comptesRendus.map((c) => {
      let champs: Array<{ type: string; enonce: string }> = [];
      const clair = lire(c.contenu);
      if (clair !== null && clair !== TEXTE_ILLISIBLE && clair !== "") {
        try {
          const j = JSON.parse(clair) as { champs?: unknown };
          if (Array.isArray(j.champs)) {
            champs = j.champs.flatMap((x) =>
              typeof x === "object" &&
              x !== null &&
              typeof (x as { type?: unknown }).type === "string" &&
              typeof (x as { enonce?: unknown }).enonce === "string"
                ? [{ type: (x as { type: string }).type, enonce: (x as { enonce: string }).enonce }]
                : [],
            );
          }
        } catch {
          champs = [];
        }
      }
      return {
        id: c.id,
        version: c.version,
        origine: c.origine,
        statut: c.statut,
        valideLe: c.valideLe,
        champs,
      };
    }),
    faits: r.faits.map((f) => ({
      id: f.id,
      type: f.type,
      portee: f.portee,
      projetId: f.projetId,
      statut: f.statut,
      confiance: f.confiance,
      certitude: f.certitude,
      enonce: lire(f.enonce) ?? "",
      question: lire(f.texteCourt),
    })),
    evocations: evocationsDuCompteRendu(r.comptesRendus),
  };
}

/** Les projets d'une fiche (pour « Ranger dans… »). */
export async function lireProjetsCourts(
  clientId: string,
): Promise<ReadonlyArray<{ id: string; numero: string; titre: string }>> {
  return prisma.projet.findMany({
    where: { clientId, statut: { in: ["ouvert", "en_pause"] } },
    select: { id: true, numero: true, titre: true },
    orderBy: { createdAt: "desc" },
  });
}

/** Les fiches vivantes (non absorbées), pour « Ranger chez… » et « Fusionner dans… ». */
export async function lireFichesVivantes(
  o: { readonly fictivesSeulement?: boolean } = {},
): Promise<FicheCourte[]> {
  const fiches = await prisma.client.findMany({
    where: {
      fusionsAbsorbee: { none: { defaiteLe: null } },
      // M-1 : une rencontre de test ne se range que chez une fiche fictive du pilote.
      ...(o.fictivesSeulement ? { testInterne: { isNot: null } } : {}),
    },
    select: { id: true, numero: true, raisonSociale: true },
    orderBy: { raisonSociale: "asc" },
    take: 1000,
  });
  return fiches;
}

export interface RencontreAClasser {
  readonly id: string;
  readonly titre: string;
  readonly debutPrevu: Date | null;
  readonly rattachementStatut: RattachementStatut;
  readonly clientPropose: FicheCourte | null;
  readonly motifProposition: MotifProposition | null;
  readonly titulaire: string | null;
}

/** « À classer » : les rencontres sans fiche validée. `historique` : les reprises seulement. */
export async function lireRencontresAClasser(historique: boolean): Promise<RencontreAClasser[]> {
  const lignes = await prisma.rencontre.findMany({
    where: {
      rattachementStatut: { in: ["a_classer", "propose"] },
      repriseHistorique: historique,
      ...HORS_RENCONTRES_DE_TEST,
    },
    select: {
      id: true,
      titre: true,
      debutPrevu: true,
      rattachementStatut: true,
      clientProposeId: true,
      motifProposition: true,
      participants: { where: { role: "client" }, select: { nomAffiche: true }, take: 1 },
    },
    orderBy: [{ debutPrevu: { sort: "desc", nulls: "last" } }],
    take: 300,
  });
  const proposees = await prisma.client.findMany({
    where: {
      id: { in: lignes.map((l) => l.clientProposeId).filter((x): x is string => x !== null) },
    },
    select: { id: true, numero: true, raisonSociale: true },
  });
  return lignes.map((l) => ({
    id: l.id,
    titre: l.titre,
    debutPrevu: l.debutPrevu,
    rattachementStatut: l.rattachementStatut,
    clientPropose: proposees.find((p) => p.id === l.clientProposeId) ?? null,
    motifProposition: l.motifProposition,
    titulaire: l.participants[0]?.nomAffiche ?? null,
  }));
}

/** Le nombre de rencontres « à classer » hors historique (badge). */
export async function lireNombreAClasser(): Promise<number> {
  return prisma.rencontre.count({
    where: {
      rattachementStatut: { in: ["a_classer", "propose"] },
      repriseHistorique: false,
      ...HORS_RENCONTRES_DE_TEST,
    },
  });
}

export interface DossierDuRendezVous {
  readonly rencontreId: string;
  readonly clientId: string | null;
  readonly rattachementStatut: RattachementStatut;
  readonly clientPropose: FicheCourte | null;
  readonly compteRenduNonValide: boolean;
}

/** Pour les cartes de l'onglet « Rendez-vous » : la rencontre de chaque rendez-vous Calendly. */
export async function lireDossiersDesRendezVous(
  calendlyEventIds: readonly string[],
): Promise<Map<string, DossierDuRendezVous>> {
  const carte = new Map<string, DossierDuRendezVous>();
  if (calendlyEventIds.length === 0) return carte;
  const lignes = await prisma.rencontre.findMany({
    where: { calendlyEventId: { in: [...calendlyEventIds] } },
    select: {
      id: true,
      calendlyEventId: true,
      clientId: true,
      rattachementStatut: true,
      clientProposeId: true,
    },
  });
  const clients = [
    ...new Set(
      lignes.flatMap((l) => [l.clientId, l.clientProposeId]).filter((x): x is string => x !== null),
    ),
  ];
  const [fiches, nonValides] = await Promise.all([
    prisma.client.findMany({
      where: { id: { in: clients } },
      select: { id: true, numero: true, raisonSociale: true },
    }),
    prisma.compteRendu.findMany({
      where: { statut: "a_valider", rencontre: { clientId: { in: clients } } },
      select: { rencontre: { select: { clientId: true } } },
    }),
  ]);
  const clientsNonValides = new Set(nonValides.map((c) => c.rencontre.clientId));
  for (const l of lignes) {
    if (l.calendlyEventId === null) continue;
    carte.set(l.calendlyEventId, {
      rencontreId: l.id,
      clientId: l.clientId,
      rattachementStatut: l.rattachementStatut,
      clientPropose: fiches.find((f) => f.id === l.clientProposeId) ?? null,
      compteRenduNonValide: l.clientId !== null && clientsNonValides.has(l.clientId),
    });
  }
  return carte;
}

export interface FusionDeLaFiche {
  readonly id: string;
  readonly le: Date;
  readonly autre: FicheCourte | null;
  readonly sens: "absorbee" | "absorbante";
}

/** Les fusions VIVANTES d'une fiche : absorbée par une autre, ou ayant absorbé. */
export async function lireFusionsDeLaFiche(clientId: string): Promise<FusionDeLaFiche[]> {
  const fusions = await prisma.clientFusion.findMany({
    where: { defaiteLe: null, OR: [{ absorbeId: clientId }, { absorbantId: clientId }] },
    select: { id: true, le: true, absorbeId: true, absorbantId: true },
    orderBy: { le: "desc" },
  });
  const res: FusionDeLaFiche[] = [];
  for (const f of fusions) {
    const absorbee = f.absorbeId === clientId;
    res.push({
      id: f.id,
      le: f.le,
      autre: await ficheCourte(absorbee ? f.absorbantId : f.absorbeId),
      sens: absorbee ? "absorbee" : "absorbante",
    });
  }
  return res;
}

/** Les personnes d'une fiche, pour inviter à un rendez-vous. */
export async function lirePersonnesCourtes(
  clientId: string,
): Promise<ReadonlyArray<{ id: string; nom: string }>> {
  return prisma.clientContact.findMany({
    where: { clientId, statut: "actif" },
    select: { id: true, nom: true },
    orderBy: { nom: "asc" },
  });
}

/** La case « test interne » se montre-t-elle sur CETTE fiche (pilote + client fictif) ? */
export async function lireCaseTestVisible(clientId: string): Promise<boolean> {
  return caseTestInterneVisible({
    modePilote: await modePiloteDisponible(prisma),
    surLeClientFictif: await estClientTestInterne(prisma, clientId),
  });
}
