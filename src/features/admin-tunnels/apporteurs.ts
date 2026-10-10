/**
 * Chargement du tableau « Tunnel apporteurs » (2026-10-06).
 *
 * Séparé de l'agrégation (`apporteurs-entonnoir.ts`, pure et testée) : ce fichier
 * ne fait que LIRE, par lectures isolées. Chacune est dans son propre `try` : une
 * lecture en échec (table absente pendant la fenêtre app/worker, base muette au
 * build) rend « non mesuré » pour ses marches, jamais un zéro — et jamais une
 * page en erreur.
 *
 * Jonction bas de tunnel : par EMPREINTE d'adresse (`contactEmailHash`), jamais
 * par adresse. `apporteurs_reseau.email_hash` et `Submission.contactEmailHash`
 * sont calculées par la même fonction. La table `apporteurs_reseau` et
 * `presentations_entreprise` appartiennent à l'autre chantier : on les LIT, on
 * n'y écrit rien.
 */

import { prisma } from "@/lib/prisma";
import { Prisma } from "../../../prisma/generated/client";
import { etapeDeLaLigne } from "@/lib/commercial-application/etape-apporteur";
import { CANDIDATURE_COMMERCIALE_SUBTYPE } from "@/lib/commercial-application/model";
import { VSL_VERSION } from "@/lib/commercial-application/vsl-apporteur";
import { lireRetoursVsl } from "@/features/commercial-application/lead-vsl-details";
import {
  construireEntonnoir,
  comparerPages,
  coutParApporteurActif,
  decouperParCampagne,
  repartirParAnnonce,
  lundiDe,
  type ComparaisonPage,
  type CoutActif,
  type Depense,
  type EntonnoirApporteurs,
  type LeadSuivi,
  type LigneBalise,
  type LigneDecoupage,
  type RepartitionAnnonces,
  type RetourConnuSuivi,
  type SourcesLues,
} from "./apporteurs-entonnoir";

export const PERIODES = [
  { cle: "4s", libelle: "4 dernières semaines" },
  { cle: "semaine", libelle: "Semaine en cours" },
  { cle: "tout", libelle: "Tout" },
] as const;
export type PeriodeCle = (typeof PERIODES)[number]["cle"];

/** Liste fermée : une valeur libre de l'URL ne dimensionne jamais une requête. */
export function lirePeriode(brut: string | undefined): PeriodeCle {
  return PERIODES.find((p) => p.cle === brut)?.cle ?? "4s";
}

/** Début de la période (lundi 00:00 UTC) ; `tout` remonte avant tout le tunnel. */
export function debutDePeriode(periode: PeriodeCle, maintenant: Date): Date {
  if (periode === "tout") return new Date("2026-09-01T00:00:00.000Z");
  const lundi = new Date(`${lundiDe(maintenant)}T00:00:00.000Z`);
  if (periode === "4s") lundi.setUTCDate(lundi.getUTCDate() - 21);
  return lundi;
}

const PLAFOND_BALISES = 100_000;
const PLAFOND_LEADS = 5_000;
const FENETRE_ACTIF_MS = 60 * 24 * 3_600_000;

export interface LigneDepense {
  id: string;
  spentOn: Date;
  canal: string;
  campagne: string | null;
  montantCentimes: number;
  note: string | null;
}

export interface TableauApporteurs {
  periode: PeriodeCle;
  depuis: Date;
  jusqua: Date;
  entonnoir: EntonnoirApporteurs;
  comparaison: ComparaisonPage[];
  parCampagne: LigneDecoupage[];
  /** Par annonce (`utm_content` de la fiche), avec total, coûts au total et « déjà connus ». */
  parAnnonce: RepartitionAnnonces;
  actifs: CoutActif;
  /** Dépenses de la période (centimes) — 0 = rien de saisi, affiché « non saisi ». */
  depenseTotale: number;
  dernieresDepenses: LigneDepense[];
  sources: SourcesLues;
  /** Les balises lues atteignent le plafond : les taux seraient faussés, la page le dit. */
  tronquee: boolean;
}

function enregistrement(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

async function lire<T>(f: () => Promise<T>, repli: T): Promise<{ ok: boolean; v: T }> {
  try {
    return { ok: true, v: await f() };
  } catch (err) {
    console.warn("[tunnel-apporteurs] lecture échouée", err instanceof Error ? err.message : err);
    return { ok: false, v: repli };
  }
}

export async function chargerTableauApporteurs(
  periode: PeriodeCle,
  maintenant: Date = new Date(),
): Promise<TableauApporteurs> {
  const depuis = debutDePeriode(periode, maintenant);

  // 1. Balises anonymes (haut de l'entonnoir, comparaison des pages).
  const balises = await lire(
    () =>
      prisma.funnelEvent.findMany({
        where: { funnel: "apporteur", createdAt: { gte: depuis } },
        select: { event: true, sessionId: true, route: true, utmCampaign: true, createdAt: true },
        orderBy: { createdAt: "asc" },
        take: PLAFOND_BALISES,
      }),
    [] as LigneBalise[],
  );

  // 2. Les personnes entrées par la page vidéo.
  const fiches = await lire(
    () =>
      prisma.submission.findMany({
        where: {
          deletedAt: null,
          submittedAt: { gte: depuis },
          AND: [
            { details: { path: ["subType"], equals: CANDIDATURE_COMMERCIALE_SUBTYPE } },
            { details: { path: ["vsl", "version"], equals: VSL_VERSION } },
          ],
        },
        select: { id: true, contactEmailHash: true, submittedAt: true, details: true },
        orderBy: { submittedAt: "asc" },
        take: PLAFOND_LEADS,
      }),
    [] as Array<{
      id: string;
      contactEmailHash: string | null;
      submittedAt: Date;
      details: Prisma.JsonValue;
    }>,
  );
  const ids = fiches.v.map((f) => f.id);
  const hashes = [
    ...new Set(fiches.v.map((f) => f.contactEmailHash).filter((h): h is string => !!h)),
  ];

  // 3. Réservations et issues d'échange, rattachées aux fiches.
  const rdv = await lire(
    () =>
      ids.length === 0
        ? Promise.resolve([])
        : prisma.calendlyEvent.findMany({
            where: { linkedSubmissionId: { in: ids } },
            select: {
              linkedSubmissionId: true,
              suivi: { select: { issue: true, decision: true } },
            },
          }),
    [] as Array<{
      linkedSubmissionId: string | null;
      suivi: { issue: string; decision: string | null } | null;
    }>,
  );

  // 4. Dossier complet : une autre ligne de la même personne, sans marqueur d'étape.
  const dossiers = await lire(
    () =>
      hashes.length === 0
        ? Promise.resolve([])
        : prisma.submission.findMany({
            where: {
              contactEmailHash: { in: hashes },
              deletedAt: null,
              AND: [{ details: { path: ["subType"], equals: CANDIDATURE_COMMERCIALE_SUBTYPE } }],
            },
            select: { contactEmailHash: true, details: true },
          }),
    [] as Array<{ contactEmailHash: string | null; details: Prisma.JsonValue }>,
  );

  // 5. Contrat et présentations (tables de l'autre chantier, en lecture seule).
  const reseau = await lire(
    () =>
      hashes.length === 0
        ? Promise.resolve([])
        : prisma.apporteurReseau.findMany({
            where: { emailHash: { in: hashes } },
            select: {
              emailHash: true,
              signeParSocieteAt: true,
              presentations: { select: { recueAt: true } },
            },
          }),
    [] as Array<{
      emailHash: string;
      signeParSocieteAt: Date | null;
      presentations: Array<{ recueAt: Date }>;
    }>,
  );

  // 5 bis. Personnes DÉJÀ CONNUES revenues par la page vidéo (`details.retoursVsl`,
  // 2026-10-10) : comptées À PART, à partir de leur premier retour de la période.
  const connusLus = await lire(
    () =>
      prisma.submission.findMany({
        where: {
          deletedAt: null,
          AND: [
            { details: { path: ["subType"], equals: CANDIDATURE_COMMERCIALE_SUBTYPE } },
            { details: { path: ["retoursVsl"], not: Prisma.AnyNull } },
          ],
        },
        select: { id: true, contactEmailHash: true, details: true },
        take: PLAFOND_LEADS,
      }),
    [] as Array<{ id: string; contactEmailHash: string | null; details: Prisma.JsonValue }>,
  );
  const retoursDePeriode = connusLus.v
    .map((f) => {
      const r = lireRetoursVsl(f.details).filter((x) => Date.parse(x.le) >= depuis.getTime());
      return { f, r, premier: Math.min(...r.map((x) => Date.parse(x.le))) };
    })
    .filter((x) => x.r.length > 0);
  const idsConnus = retoursDePeriode.map((x) => x.f.id);
  const hashesConnus = retoursDePeriode
    .map((x) => x.f.contactEmailHash)
    .filter((h): h is string => !!h);
  const rdvConnus = await lire(
    () =>
      idsConnus.length === 0
        ? Promise.resolve([])
        : prisma.calendlyEvent.findMany({
            where: { linkedSubmissionId: { in: idsConnus } },
            select: {
              linkedSubmissionId: true,
              capturedAt: true,
              suivi: { select: { issue: true, decision: true } },
            },
          }),
    [] as Array<{
      linkedSubmissionId: string | null;
      capturedAt: Date;
      suivi: { issue: string; decision: string | null } | null;
    }>,
  );
  const reseauConnus = await lire(
    () =>
      hashesConnus.length === 0
        ? Promise.resolve([])
        : prisma.apporteurReseau.findMany({
            where: { emailHash: { in: hashesConnus } },
            select: { emailHash: true, signeParSocieteAt: true },
          }),
    [] as Array<{ emailHash: string; signeParSocieteAt: Date | null }>,
  );
  const connus: RetourConnuSuivi[] = retoursDePeriode.map(({ f, r, premier }) => {
    // Seul ce qui suit le RETOUR compte : une réservation d'avant n'est pas la pub.
    const mes = rdvConnus.v.filter(
      (x) => x.linkedSubmissionId === f.id && x.capturedAt.getTime() >= premier,
    );
    const signe = reseauConnus.v.find((x) => x.emailHash === f.contactEmailHash)?.signeParSocieteAt;
    return {
      id: f.id,
      etape2: r.some((x) => x.etape === 2),
      reserve: mes.length > 0,
      tenu: mes.some((m) => m.suivi?.issue === "eu_lieu"),
      retenu: mes.some((m) => m.suivi?.decision === "retenu"),
      contrat: !!signe && signe.getTime() >= premier,
    };
  });

  // 6. Dépenses.
  const depensesLues = await lire(
    () =>
      prisma.acquisitionSpend.findMany({
        where: { spentOn: { gte: depuis } },
        select: { spentOn: true, canal: true, campagne: true, montantCentimes: true },
        take: 5_000,
      }),
    [] as Depense[],
  );
  const dernieres = await lire(
    () =>
      prisma.acquisitionSpend.findMany({
        orderBy: [{ spentOn: "desc" }, { createdAt: "desc" }],
        take: 20,
        select: {
          id: true,
          spentOn: true,
          canal: true,
          campagne: true,
          montantCentimes: true,
          note: true,
        },
      }),
    [] as LigneDepense[],
  );

  // ── Assemblage : un `LeadSuivi` par personne ─────────────────────────────
  const rdvParFiche = new Map<string, typeof rdv.v>();
  for (const r of rdv.v) {
    if (!r.linkedSubmissionId) continue;
    const l = rdvParFiche.get(r.linkedSubmissionId) ?? [];
    l.push(r);
    rdvParFiche.set(r.linkedSubmissionId, l);
  }
  const dossierDe = new Set(
    dossiers.v
      .filter((d) => d.contactEmailHash && etapeDeLaLigne(d.details) === "dossier-complet")
      .map((d) => d.contactEmailHash as string),
  );
  const reseauDe = new Map(reseau.v.map((r) => [r.emailHash, r]));

  const leads: LeadSuivi[] = fiches.v.map((f) => {
    const d = enregistrement(f.details);
    const utm = enregistrement(enregistrement(d["funnel"])["utm"]);
    const vsl = enregistrement(d["vsl"]);
    const cand = enregistrement(d["candidature"]);
    const mes = rdvParFiche.get(f.id) ?? [];
    const r = f.contactEmailHash ? reseauDe.get(f.contactEmailHash) : undefined;
    const signeLe = r?.signeParSocieteAt ?? null;
    const presente = (r?.presentations.length ?? 0) > 0;
    const canal =
      typeof cand["sourceConnaissance"] === "string" ? cand["sourceConnaissance"] : null;
    const sous60j =
      signeLe !== null &&
      (r?.presentations ?? []).some(
        (p) =>
          p.recueAt.getTime() >= signeLe.getTime() &&
          p.recueAt.getTime() - signeLe.getTime() <= FENETRE_ACTIF_MS,
      );
    return {
      id: f.id,
      page: "video",
      inscritLe: f.submittedAt,
      campagne: typeof utm["utm_campaign"] === "string" ? utm["utm_campaign"] : null,
      annonce: typeof utm["utm_content"] === "string" ? utm["utm_content"] : null,
      canal,
      etape2: vsl["etapeAtteinte"] === 2,
      reserve: mes.length > 0,
      tenu: mes.some((m) => m.suivi?.issue === "eu_lieu"),
      retenu: mes.some((m) => m.suivi?.decision === "retenu"),
      dossier: f.contactEmailHash ? dossierDe.has(f.contactEmailHash) : false,
      contrat: signeLe !== null,
      presente,
      actif: signeLe !== null && sous60j && canal === "facebook",
    };
  });

  const sources: SourcesLues = {
    balises: balises.ok,
    fiches: fiches.ok,
    reservations: rdv.ok,
    reseau: reseau.ok && dossiers.ok,
  };

  const jusqua = maintenant;
  const entonnoir = construireEntonnoir({
    lignes: balises.v,
    leads,
    depenses: depensesLues.v,
    sources,
    depuis,
    jusqua,
  });
  const actifsN = leads.filter((l) => l.actif).length;

  return {
    periode,
    depuis,
    jusqua,
    entonnoir,
    comparaison: comparerPages(balises.v),
    parCampagne: decouperParCampagne(balises.v, leads, depensesLues.v, balises.ok),
    parAnnonce: repartirParAnnonce(leads, sources, entonnoir.depenseTotale, {
      suivis: connus,
      sources: {
        balises: false,
        fiches: connusLus.ok,
        reservations: rdvConnus.ok,
        reseau: reseauConnus.ok,
      },
    }),
    actifs: coutParApporteurActif(entonnoir.depenseTotale, actifsN),
    depenseTotale: entonnoir.depenseTotale,
    dernieresDepenses: dernieres.v,
    sources,
    tronquee: balises.v.length >= PLAFOND_BALISES,
  };
}
