/**
 * LE raccord entre l'écran « Rapport d'analyse » et le vrai code du chantier (2026-11-02).
 *
 * Implémente `AccesRapports` (contrat de l'écran) avec la persistance (`persistance.ts`,
 * `actions.ts`) et les sorties (`sorties/`). C'est le SEUL fichier de l'écran qui connaît la
 * table `rapports_avant_audit`.
 *
 * Règles (audit sécurité de la PR écran) :
 *   · CLOISON PAR CLIENT. `lireBaseAudit(id)` ne connaît pas le client : chaque méthode relit
 *     d'abord l'état (`lireEtatRapport`) et exige `etat.clientId === clientId`. Un rapport d'un
 *     autre client, mis à l'écart, ou inexistant rend EXACTEMENT la même chose (`null` / le même
 *     refus) : rien ne permet de deviner qu'un identifiant existe ailleurs ;
 *   · une ligne MISE À L'ÉCART (demande d'effacement) n'apparaît pas et ne se lit plus ;
 *   · une base illisible (`RapportEcarte`, `RapportIntrouvable`, `BaseAbsente`,
 *     `EmpreinteAlteree`, `BaseHorsContrat`) rend `null`. Une empreinte altérée est
 *     journalisée — identifiants seulement, jamais le contenu ;
 *   · `pdfChemin` n'est JAMAIS lu : le PDF client est régénéré depuis la base vérifiée, et
 *     `@react-pdf` n'est chargé (import dynamique) qu'au TÉLÉCHARGEMENT. L'aperçu (« ce que le PDF
 *     retirerait »), lu à chaque affichage de la fiche, n'utilise que les fonctions pures
 *     `filtrerPourClient` + `retirerMotsInterdits` : aucun rendu de PDF, aucun `@react-pdf`.
 */

import { z } from "zod";

import { prisma } from "@/lib/prisma";

import type { BaseAudit } from "../base-audit-schema";
import {
  BaseAbsente,
  BaseHorsContrat,
  EmpreinteAlteree,
  RapportEcarte,
  RapportIntrouvable,
  lireBaseAudit,
  lireEtatRapport,
  listerRapportsDuClient,
  validerPdfClient,
  type EtatRapport,
} from "../persistance";
import { baseEnJson, baseEnMarkdown } from "../sorties/base-markdown";
import { ficheEnMarkdown } from "../sorties/fiche-personne-markdown";
import { filtrerPourClient } from "../sorties/filtre-client";
import { retirerMotsInterdits } from "../sorties/retirer-mots";

import type {
  AccesRapports,
  FichierRapport,
  FormatTelechargement,
  ResultatAcces,
  ResumeRapport,
  StatutRapport,
} from "./contrat";

const Uuid = z.string().uuid();

/** Le refus de `validerPdf`, IDENTIQUE pour un rapport d'un autre client et un inexistant. */
export const REFUS_INTROUVABLE = "Rapport introuvable ou pas terminé.";

const JOURNAL = "[rapport-avant-audit]";

// ── Cloison ──────────────────────────────────────────────────────────────────

/**
 * L'état du rapport, SEULEMENT s'il appartient à ce client et n'est pas mis à l'écart ; sinon
 * `null` (même réponse pour « autre client », « écarté » et « inexistant »).
 */
async function etatDuClient(clientId: string, rapportId: string): Promise<EtatRapport | null> {
  if (!Uuid.safeParse(clientId).success || !Uuid.safeParse(rapportId).success) return null;
  const etat = await lireEtatRapport(rapportId);
  if (etat === null || etat.clientId !== clientId || etat.ecarteLe !== null) return null;
  return etat;
}

const ILLISIBLES = [
  RapportEcarte,
  RapportIntrouvable,
  BaseAbsente,
  EmpreinteAlteree,
  BaseHorsContrat,
];

/** La base vérifiée d'un rapport TERMINÉ de ce client, ou `null`. */
async function baseDuClient(
  clientId: string,
  rapportId: string,
): Promise<{ etat: EtatRapport; base: BaseAudit } | null> {
  const etat = await etatDuClient(clientId, rapportId);
  if (etat === null || etat.statut !== "termine") return null;
  try {
    return { etat, base: await lireBaseAudit(rapportId) };
  } catch (e) {
    if (e instanceof EmpreinteAlteree) {
      console.error(`${JOURNAL} empreinte altérée : rapport=${rapportId} client=${clientId}`);
    }
    if (ILLISIBLES.some((C) => e instanceof C)) return null;
    throw e;
  }
}

// ── Liste ────────────────────────────────────────────────────────────────────

function statutEcran(statut: string): StatutRapport {
  switch (statut) {
    case "en_attente":
    case "en_cours":
    case "termine":
      return statut;
    default:
      // `erreur`, `annule`, et tout statut inconnu.
      return "echoue";
  }
}

/** Date de la réponse la plus récente reçue AVANT le début du rapport, parmi ses questionnaires. */
function reponsesJusquau(
  etat: EtatRapport,
  envois: ReadonlyArray<{ questionnaireId: string; recuLe: Date }>,
): Date | null {
  if (etat.debutLe === null || etat.questionnaireIds.length === 0) return null;
  const debut = etat.debutLe.getTime();
  let max: number | null = null;
  for (const e of envois) {
    if (!etat.questionnaireIds.includes(e.questionnaireId)) continue;
    const t = e.recuLe.getTime();
    if (t < debut && (max === null || t > max)) max = t;
  }
  return max === null ? null : new Date(max);
}

async function listerRapports(clientId: string): Promise<ReadonlyArray<ResumeRapport>> {
  if (!Uuid.safeParse(clientId).success) return [];
  const tous = await listerRapportsDuClient(clientId);
  // Version calculée sur TOUTES les lignes (écartées comprises) : une mise à l'écart ne
  // renumérote jamais les autres versions.
  const numerotes = tous
    .map((etat, rang) => ({ etat, version: tous.length - rang }))
    .filter((x) => x.etat.ecarteLe === null && x.etat.clientId === clientId);
  if (numerotes.length === 0) return [];

  const idsAdmins = [
    ...new Set(
      numerotes.flatMap(({ etat }) =>
        [etat.lanceParId, etat.pdfValideParId].filter((x): x is string => x !== null),
      ),
    ),
  ];
  const idsQuestionnaires = [...new Set(numerotes.flatMap(({ etat }) => etat.questionnaireIds))];
  const [admins, envois] = await Promise.all([
    idsAdmins.length === 0
      ? Promise.resolve([] as Array<{ id: string; name: string }>)
      : prisma.adminUser.findMany({
          where: { id: { in: idsAdmins } },
          select: { id: true, name: true },
        }),
    idsQuestionnaires.length === 0
      ? Promise.resolve([] as Array<{ questionnaireId: string; recuLe: Date }>)
      : prisma.questionnaireAvantAuditEnvoi.findMany({
          where: { questionnaireId: { in: idsQuestionnaires }, ecarteLe: null },
          select: { questionnaireId: true, recuLe: true },
        }),
  ]);
  const noms = new Map(admins.map((a) => [a.id, a.name]));
  const nom = (id: string | null): string | null => (id === null ? null : (noms.get(id) ?? null));

  return numerotes.map(({ etat, version }) => ({
    id: etat.id,
    version,
    statut: statutEcran(etat.statut),
    etape: etat.etape,
    progression: etat.progression,
    jetonsEntree: etat.jetonsEntree,
    jetonsSortie: etat.jetonsSortie,
    lanceLe: etat.creeLe,
    termineLe: etat.finLe,
    lancePar: nom(etat.lanceParId),
    reponsesJusquau: reponsesJusquau(etat, envois),
    erreur: etat.erreur,
    pdfValideLe: etat.pdfValideLe,
    pdfValidePar: nom(etat.pdfValideParId),
  }));
}

// ── Téléchargements ──────────────────────────────────────────────────────────

const MD = "text/markdown; charset=utf-8";

/** Les fiches de chaque personne, assemblées sous un titre (niveau 2 pour chaque fiche). */
export function fichesEnMarkdown(base: BaseAudit): string {
  const titre = `# Fiches des personnes — ${base.meta.raisonSociale}`;
  if (base.fiches_personnes.length === 0) {
    return `${titre}\n\nAucune fiche individuelle dans ce rapport.\n`;
  }
  return [titre, ...base.fiches_personnes.map((f) => ficheEnMarkdown(f, 2))].join("\n\n");
}

async function telecharger(
  clientId: string,
  rapportId: string,
  format: FormatTelechargement,
): Promise<FichierRapport | null> {
  const lu = await baseDuClient(clientId, rapportId);
  if (lu === null) return null;
  const { etat, base } = lu;
  const court = rapportId.slice(0, 8);
  switch (format) {
    case "base-json":
      return {
        nom: `base-audit-${court}.json`,
        type: "application/json; charset=utf-8",
        contenu: baseEnJson(base),
      };
    case "base-md":
      return { nom: `base-audit-${court}.md`, type: MD, contenu: baseEnMarkdown(base) };
    case "fiches-md":
      return { nom: `fiches-personnes-${court}.md`, type: MD, contenu: fichesEnMarkdown(base) };
    case "pdf-client": {
      // Refusé tant que le PDF n'est pas validé. `pdfChemin` n'est jamais lu : régénéré.
      if (etat.pdfValideLe === null) return null;
      const { genererPdfClient } = await import("../sorties/pdf-client");
      const { pdf } = await genererPdfClient(base);
      return { nom: `rapport-client-${court}.pdf`, type: "application/pdf", contenu: pdf };
    }
    default:
      return null;
  }
}

// ── Accès ────────────────────────────────────────────────────────────────────

export const ACCES_BRANCHE: AccesRapports = {
  branche: true,
  listerRapports,
  async lireBase(clientId, rapportId) {
    return (await baseDuClient(clientId, rapportId))?.base ?? null;
  },
  async lirePropositions(clientId, rapportId) {
    return (await baseDuClient(clientId, rapportId))?.base.propositions_fiche ?? [];
  },
  telecharger,
  async apercuPdf(clientId, rapportId) {
    const lu = await baseDuClient(clientId, rapportId);
    if (lu === null) return null;
    // Les MÊMES fonctions pures que `genererPdfClient`, sans le rendu : même liste de passages.
    const { retiresPourRelecture } = retirerMotsInterdits(filtrerPourClient(lu.base));
    return { retiresPourRelecture };
  },
  async validerPdf(clientId, rapportId, par): Promise<ResultatAcces> {
    const etat = await etatDuClient(clientId, rapportId);
    if (etat === null || etat.statut !== "termine") return { ok: false, raison: REFUS_INTROUVABLE };
    if (etat.pdfValideLe !== null) return { ok: true }; // déjà validé : sans effet
    const pose = await validerPdfClient(rapportId, clientId, par);
    if (pose) return { ok: true };
    // Validé entre-temps par un autre clic : sans effet, mais pas une erreur.
    const relu = await etatDuClient(clientId, rapportId);
    return relu?.pdfValideLe != null ? { ok: true } : { ok: false, raison: REFUS_INTROUVABLE };
  },
  async lancer(clientId) {
    // Import dynamique : la file BullMQ n'est chargée qu'au clic, jamais à l'affichage.
    // `lancerRapportAvantAudit` revérifie la session et le rôle, et écrit LA trace du lancement.
    const { lancerRapportAvantAudit } = await import("../actions");
    const r = await lancerRapportAvantAudit(clientId);
    return r.ok ? { ok: true, rapportId: r.rapportId } : { ok: false, raison: r.erreur };
  },
};

export function accesRapports(): AccesRapports {
  return ACCES_BRANCHE;
}
