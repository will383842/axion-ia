/**
 * Lecture des chiffres de la section « Pilotage » du rapport hebdomadaire (P9).
 *
 * LECTURE SEULE sur les tables de la mesure (P2) : aucun appel à Google, aucun quota consommé,
 * aucune écriture. Éteint par défaut : sans `CONTENT_PILOTAGE_SEO="true"` (ou au build GitHub
 * Actions, base `stub.invalid`) rien n'est lu. Une table absente (P2021/P2022, le worker peut
 * atterrir avant la migration) ou toute panne rend « indisponible » — jamais des zéros.
 */
import type { PrismaClient } from "../../../prisma/generated/client";
import { ajouterJours, enDate, enJour } from "./ingestion/dates";
import { buildStub, pilotageSeoActif } from "./interrupteur";
import type { DonneesRapport, EntreeSection, OpportuniteRapport, Totaux } from "./rapport";

type Deps = Pick<
  PrismaClient,
  "gscImportRun" | "gscPageJour" | "seoOpportunite" | "gscRequete" | "gscPageRequeteJour"
>;

const TYPE_RECHERCHE = "web";
/** Retard au-delà duquel la collecte est déclarée en panne (Google publie avec ~2-3 jours). */
const RETARD_MAX_JOURS = 4;
const FENETRE_JOURS = 7;
const FENETRE_REQUETE_JOURS = 28;

async function totaux(deps: Deps, debut: string, fin: string): Promise<Totaux | null> {
  const lignes = await deps.gscPageJour.groupBy({
    by: ["chemin"],
    where: {
      typeRecherche: TYPE_RECHERCHE,
      date: { gte: enDate(debut), lte: enDate(fin) },
    },
    _sum: { clics: true, impressions: true, positionSum: true },
  });
  if (lignes.length === 0) return null;
  return lignes.reduce<Totaux>(
    (t, l) => ({
      clics: t.clics + (l._sum.clics ?? 0),
      impressions: t.impressions + (l._sum.impressions ?? 0),
      positionSum: t.positionSum + (l._sum.positionSum ?? 0),
      pages: t.pages + ((l._sum.impressions ?? 0) > 0 ? 1 : 0),
    }),
    { clics: 0, impressions: 0, positionSum: 0, pages: 0 },
  );
}

function requeteIdDe(details: unknown): number | null {
  if (typeof details !== "object" || details === null) return null;
  const id = (details as Record<string, unknown>)["requeteId"];
  return typeof id === "number" && Number.isInteger(id) ? id : null;
}

async function opportunites(deps: Deps, fin: string | null): Promise<OpportuniteRapport[]> {
  const lignes = await deps.seoOpportunite.findMany({
    where: { etat: "ouverte" },
    orderBy: [{ semaine: "desc" }, { priorite: "desc" }],
    take: 5,
    select: { semaine: true, detecteur: true, cible: true, priorite: true, details: true },
  });
  if (lignes.length === 0) return [];
  const derniere = lignes[0]!.semaine.getTime();
  const retenues = lignes.filter((l) => l.semaine.getTime() === derniere);
  const ids = [
    ...new Set(retenues.map((l) => requeteIdDe(l.details)).filter((i): i is number => i !== null)),
  ];
  const textes = new Map<number, string>();
  const affichages = new Map<number, number>();
  if (ids.length > 0 && fin) {
    const [reqs, sommes] = await Promise.all([
      deps.gscRequete.findMany({ where: { id: { in: ids } }, select: { id: true, texte: true } }),
      deps.gscPageRequeteJour.groupBy({
        by: ["requeteId"],
        where: {
          typeRecherche: TYPE_RECHERCHE,
          requeteId: { in: ids },
          date: {
            gte: enDate(ajouterJours(fin, -(FENETRE_REQUETE_JOURS - 1))),
            lte: enDate(fin),
          },
        },
        _sum: { impressions: true },
      }),
    ]);
    for (const r of reqs) textes.set(r.id, r.texte);
    for (const s of sommes) affichages.set(s.requeteId, s._sum.impressions ?? 0);
  }
  return retenues.map((l) => {
    const id = requeteIdDe(l.details);
    const trouve = id !== null && textes.has(id) && affichages.has(id);
    return {
      detecteur: l.detecteur,
      cible: l.cible,
      priorite: l.priorite,
      requete: trouve ? (textes.get(id) ?? null) : null,
      impressions28j: trouve ? (affichages.get(id) ?? null) : null,
    };
  });
}

async function sourcesIndisponibles(
  deps: Deps,
  fin: string | null,
  maintenant: Date,
): Promise<string[]> {
  const sortie: string[] = [];
  const aujourdhui = enJour(maintenant);
  const echecs = await deps.gscImportRun.findMany({
    where: {
      typeRecherche: TYPE_RECHERCHE,
      statut: { in: ["echec", "partiel"] },
      jour: { gte: enDate(ajouterJours(aujourdhui, -FENETRE_JOURS)) },
    },
    select: { jour: true, statut: true },
    orderBy: { jour: "desc" },
  });
  for (const e of echecs) {
    sortie.push(
      `Search Console : collecte du ${enJour(e.jour)} ${e.statut === "echec" ? "en échec" : "incomplète"}`,
    );
  }
  if (fin !== null && fin < ajouterJours(aujourdhui, -RETARD_MAX_JOURS - 1)) {
    sortie.push(`Search Console : dernière collecte réussie le ${fin} (en retard)`);
  }
  return sortie;
}

export async function collecterSectionPilotage(
  prisma: Deps,
  env: Readonly<Record<string, string | undefined>> = process.env,
  maintenant: () => Date = () => new Date(),
): Promise<EntreeSection> {
  if (!pilotageSeoActif(env) || buildStub(env)) return { etat: "eteint" };
  try {
    const dernier = await prisma.gscImportRun.findFirst({
      where: { typeRecherche: TYPE_RECHERCHE, statut: "reussi" },
      orderBy: { jour: "desc" },
      select: { jour: true },
    });
    const fin = dernier ? enJour(dernier.jour) : null;
    const finPrec = fin ? ajouterJours(fin, -FENETRE_JOURS) : null;
    const [courante, precedente, opps, sources] = await Promise.all([
      fin ? totaux(prisma, ajouterJours(fin, -(FENETRE_JOURS - 1)), fin) : null,
      fin && finPrec ? totaux(prisma, ajouterJours(finPrec, -(FENETRE_JOURS - 1)), finPrec) : null,
      opportunites(prisma, fin),
      sourcesIndisponibles(prisma, fin, maintenant()),
    ]);
    const donnees: DonneesRapport = {
      fin,
      courante,
      precedente,
      opportunites: opps,
      sourcesIndisponibles: sources,
    };
    return { etat: "ok", donnees };
  } catch {
    // Table absente (fenêtre app/worker) ou panne : on l'annonce, on ne chiffre rien.
    return { etat: "indisponible" };
  }
}
