/**
 * Écran « Pilotage SEO & IA » : lectures SEULES (aucune écriture, aucun appel réseau).
 * Chaque section est lue à part : une panne ou une table absente rend CETTE section
 * indisponible (`null`), jamais un zéro.
 */
import type { PrismaClient } from "../../../../prisma/generated/client";
import { buildStub, lireModePilotage, pilotageSeoActif } from "../interrupteur";
import type { ImportEcran, LignePageEcran, ModelePilotage, OpportuniteEcran } from "./modele";
import { composerRequetes, type LigneRequetePage } from "./requetes";
import { etatSourceSearchConsole, fenetres28Jours } from "./sources";
import { composerVueEnsemble, type AgregatType } from "./vue";
import { positionMoyenne } from "../donnees/agregats";

type Lecteur = Pick<
  PrismaClient,
  | "gscImportRun"
  | "gscPageJour"
  | "gscPageRequeteSemaine"
  | "gscRequete"
  | "seoOpportunite"
  | "contentGenConfig"
>;

export interface OptionsLecture {
  readonly prisma: Lecteur;
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** `YYYY-MM-DD` */
  readonly aujourdhui: string;
}

const LIMITE_PAGES = 100;
const LIMITE_REQUETES = 500;
const LIMITE_OPPORTUNITES = 100;

const jourIso = (d: Date): string => d.toISOString().slice(0, 10);
const dateUtc = (s: string): Date => new Date(`${s}T00:00:00Z`);

async function ouNull<T>(lecture: () => Promise<T>): Promise<T | null> {
  try {
    return await lecture();
  } catch {
    return null;
  }
}

function texteOuNull(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim().slice(0, 300) : null;
}

export async function lireModelePilotage(o: OptionsLecture): Promise<ModelePilotage> {
  const env = o.env ?? process.env;
  if (!pilotageSeoActif(env)) return { etat: "eteint" };
  const { prisma } = o;
  const mode = await lireModePilotage(prisma);

  const runs = buildStub(env)
    ? null
    : await ouNull(() => prisma.gscImportRun.findMany({ orderBy: { jour: "desc" }, take: 30 }));
  const source = etatSourceSearchConsole(
    (runs ?? []).map((r) => ({ jour: jourIso(r.jour), statut: r.statut })),
    o.aujourdhui,
  );
  if (runs === null) {
    return {
      etat: "actif",
      mode,
      source: {
        etat: "indisponible",
        donneesJusquAu: null,
        explication: "Impossible de lire l'état des imports pour l'instant.",
      },
      donneesJusquAu: null,
      vue: null,
      pages: null,
      requetes: null,
      opportunites: null,
      imports: null,
    };
  }
  const imports: ImportEcran[] = runs.map((r) => ({
    jour: jourIso(r.jour),
    statut: r.statut,
    nbLignesPage: r.nbLignesPage,
    nbLignesRequete: r.nbLignesReq,
    tentatives: r.tentatives,
    erreurCode: r.erreurCode,
  }));

  const opportunites = await ouNull(async () => {
    const lignes = await prisma.seoOpportunite.findMany({
      where: { etat: "ouverte" },
      orderBy: { priorite: "desc" },
      take: LIMITE_OPPORTUNITES,
    });
    return lignes.map((l): OpportuniteEcran => {
      const d =
        typeof l.details === "object" && l.details !== null && !Array.isArray(l.details)
          ? (l.details as Record<string, unknown>)
          : {};
      return {
        id: l.id,
        detecteur: l.detecteur,
        cible: l.cible,
        typePage: l.typePage,
        priorite: l.priorite,
        motif: texteOuNull(d["motif"]),
        signalement: typeof d["kind"] === "string",
      };
    });
  });

  const fin = source.donneesJusquAu;
  if (fin === null) {
    return {
      etat: "actif",
      mode,
      source,
      donneesJusquAu: null,
      vue: null,
      pages: null,
      requetes: null,
      opportunites,
      imports,
    };
  }

  const f = fenetres28Jours(fin);
  const agreger = (debut: string, jusqua: string) =>
    prisma.gscPageJour.groupBy({
      by: ["typePage"],
      where: { typeRecherche: "web", date: { gte: dateUtc(debut), lte: dateUtc(jusqua) } },
      _sum: { clics: true, impressions: true, positionSum: true },
    });
  const versAgregat = (r: {
    typePage: string | null;
    _sum: { clics: number | null; impressions: number | null; positionSum: number | null };
  }): AgregatType => ({
    typePage: r.typePage,
    clics: r._sum.clics ?? 0,
    impressions: r._sum.impressions ?? 0,
    positionSum: r._sum.positionSum ?? 0,
  });

  const vue = await ouNull(async () => {
    const [c, p] = await Promise.all([
      agreger(f.courante.debut, f.courante.fin),
      agreger(f.precedente.debut, f.precedente.fin),
    ]);
    return composerVueEnsemble(c.map(versAgregat), p.map(versAgregat));
  });

  const pages = await ouNull(async () => {
    const lignes = await prisma.gscPageJour.groupBy({
      by: ["chemin", "typePage"],
      where: {
        typeRecherche: "web",
        date: { gte: dateUtc(f.courante.debut), lte: dateUtc(f.courante.fin) },
      },
      _sum: { clics: true, impressions: true, positionSum: true },
      orderBy: { _sum: { impressions: "desc" } },
      take: LIMITE_PAGES,
    });
    return lignes.map((l): LignePageEcran => {
      const impressions = l._sum.impressions ?? 0;
      return {
        chemin: l.chemin,
        typePage: l.typePage ?? "autre",
        clics: l._sum.clics ?? 0,
        impressions,
        position: positionMoyenne(l._sum.positionSum ?? 0, impressions),
      };
    });
  });

  const requetes = await ouNull(async () => {
    const lignes = await prisma.gscPageRequeteSemaine.groupBy({
      by: ["requeteId", "chemin"],
      where: { typeRecherche: "web", semaine: { gte: dateUtc(f.courante.debut) } },
      _sum: { clics: true, impressions: true, positionSum: true },
      orderBy: { _sum: { impressions: "desc" } },
      take: LIMITE_REQUETES,
    });
    if (lignes.length === 0) return [];
    const textes = await prisma.gscRequete.findMany({
      where: { id: { in: [...new Set(lignes.map((l) => l.requeteId))] } },
      select: { id: true, texte: true },
    });
    const parId = new Map(textes.map((t) => [t.id, t.texte]));
    const entree: LigneRequetePage[] = [];
    for (const l of lignes) {
      const texte = parId.get(l.requeteId);
      if (texte === undefined) continue;
      entree.push({
        requete: texte,
        chemin: l.chemin,
        impressions: l._sum.impressions ?? 0,
        clics: l._sum.clics ?? 0,
        positionSum: l._sum.positionSum ?? 0,
      });
    }
    return composerRequetes(entree);
  });

  return {
    etat: "actif",
    mode,
    source,
    donneesJusquAu: fin,
    vue,
    pages,
    requetes,
    opportunites,
    imports,
  };
}
