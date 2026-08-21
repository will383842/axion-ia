/**
 * Console éditoriale — les téléchargements d'export (§2 bis D, critères 9 et 10).
 *
 * Route Handler et non Server Action, pour une raison simple : une Server
 * Action ne peut pas rendre un FICHIER avec ses en-têtes de téléchargement.
 * C'est l'exception documentée à la convention « Server Actions, pas d'API
 * REST » du §3 — la convention vise les MUTATIONS, et ici on ne mute rien.
 *
 *   /console-editoriale/export?type=csv&year=2026&month=9
 *   /console-editoriale/export?type=sauvegarde
 */

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/server/actions/editorial/_guards";
import { dayKeyOfGridDate } from "@/lib/calendar-grid";
import { lireAnnee, lireMois, bornesDuMois } from "@/server/editorial/calendrier-pur";
import {
  construireCsv,
  nomFichierCsv,
  assemblerSauvegarde,
  serialiserSauvegarde,
  nomFichierSauvegarde,
  type PublicationExportable,
} from "@/server/editorial/exports";

export const dynamic = "force-dynamic";

/** En-têtes qui déclenchent un vrai téléchargement, pas un affichage. */
function enTetes(nomFichier: string, type: string): HeadersInit {
  return {
    "Content-Type": `${type}; charset=utf-8`,
    // Le nom est cité : sans cela, un nom à espace serait tronqué.
    "Content-Disposition": `attachment; filename="${nomFichier}"`,
    // Un export est un instantané : il ne se met jamais en cache.
    "Cache-Control": "no-store, max-age=0",
  };
}

async function exporterCsv(annee: number, mois: number): Promise<NextResponse> {
  const { debut, fin } = bornesDuMois(annee, mois);

  const lignes = await prisma.edPublication.findMany({
    where: { datePrevue: { gte: debut, lt: fin }, archiveeA: null },
    select: {
      refImport: true,
      datePrevue: true,
      heurePrevue: true,
      titreInterne: true,
      accroche: true,
      corps: true,
      premierCommentaire: true,
      tags: true,
      lienUrl: true,
      statutRedaction: true,
      statutAsset: true,
      statutDiffusion: true,
      urlPubliee: true,
      compte: { select: { libelle: true, identite: true } },
      assets: { select: { asset: { select: { cheminObjet: true } } }, orderBy: { ordre: "asc" } },
    },
    orderBy: [{ datePrevue: "asc" }, { heurePrevue: "asc" }],
  });

  const exportables: PublicationExportable[] = lignes.map((l) => ({
    refImport: l.refImport,
    datePrevue: dayKeyOfGridDate(l.datePrevue),
    heurePrevue: l.heurePrevue,
    compteLibelle: l.compte.libelle,
    identite: l.compte.identite,
    titreInterne: l.titreInterne,
    accroche: l.accroche,
    corps: l.corps,
    premierCommentaire: l.premierCommentaire,
    tags: l.tags,
    lienUrl: l.lienUrl,
    statutRedaction: l.statutRedaction,
    statutAsset: l.statutAsset,
    statutDiffusion: l.statutDiffusion,
    urlPubliee: l.urlPubliee,
    cheminsMedias: l.assets.map((a) => a.asset.cheminObjet).filter((c): c is string => Boolean(c)),
  }));

  return new NextResponse(construireCsv(exportables), {
    headers: enTetes(nomFichierCsv(annee, mois), "text/csv"),
  });
}

/**
 * La sauvegarde complète — SANS les fichiers (§2 bis D et §5).
 *
 * Toutes les tables `Ed*` y passent. L'ordre est celui des dépendances, pour
 * qu'une relecture puisse réinsérer sans casser une clé étrangère.
 */
async function exporterSauvegarde(): Promise<NextResponse> {
  const [
    marques,
    comptes,
    piliers,
    familles,
    specs,
    series,
    membres,
    publications,
    versions,
    assets,
    liens,
    idees,
    invites,
    episodesInvites,
    metriques,
    objectifs,
    recettes,
    recetteLignes,
    gabarits,
    reglesConformite,
    reglesAlerte,
    alertes,
    canaux,
    journal,
  ] = await Promise.all([
    prisma.edMarque.findMany(),
    prisma.edCompte.findMany(),
    prisma.edPilier.findMany(),
    prisma.edFamille.findMany(),
    prisma.edSpecPlateforme.findMany(),
    prisma.edSerie.findMany(),
    prisma.edMembre.findMany(),
    prisma.edPublication.findMany(),
    prisma.edPublicationVersion.findMany(),
    prisma.edAsset.findMany(),
    prisma.edAssetPublication.findMany(),
    prisma.edIdee.findMany(),
    prisma.edInvite.findMany(),
    prisma.edEpisodeInvite.findMany(),
    prisma.edMetrique.findMany(),
    prisma.edObjectif.findMany(),
    prisma.edRecette.findMany(),
    prisma.edRecetteLigne.findMany(),
    prisma.edGabarit.findMany(),
    prisma.edRegleConformite.findMany(),
    prisma.edRegleAlerte.findMany(),
    prisma.edAlerteDeclenchee.findMany(),
    prisma.edCanalNotification.findMany(),
    prisma.edJournal.findMany(),
  ]);

  const genereeA = new Date();
  const sauvegarde = assemblerSauvegarde(
    {
      edMarques: marques,
      edComptes: comptes,
      edPiliers: piliers,
      edFamilles: familles,
      edSpecsPlateforme: specs,
      edSeries: series,
      edMembres: membres,
      edPublications: publications,
      edPublicationsVersions: versions,
      edAssets: assets,
      edAssetsPublications: liens,
      edIdees: idees,
      edInvites: invites,
      edEpisodesInvites: episodesInvites,
      edMetriques: metriques,
      edObjectifs: objectifs,
      edRecettes: recettes,
      edRecettesLignes: recetteLignes,
      edGabarits: gabarits,
      edReglesConformite: reglesConformite,
      edReglesAlerte: reglesAlerte,
      edAlertesDeclenchees: alertes,
      edCanauxNotification: canaux,
      edJournal: journal,
    },
    genereeA,
  );

  return new NextResponse(serialiserSauvegarde(sauvegarde), {
    headers: enTetes(nomFichierSauvegarde(genereeA), "application/json"),
  });
}

export async function GET(requete: NextRequest): Promise<NextResponse> {
  try {
    // Exporter, c'est SORTIR des données : le §4 réserve ce geste à
    // `production` et au-dessus, pas à `lecture`.
    await requirePermission("publication.ecrire");
  } catch (e) {
    const message = e instanceof Error ? e.message : "Refusé";
    const statut = message === "unauthorized" ? 401 : 403;
    return NextResponse.json({ error: message }, { status: statut });
  }

  const params = requete.nextUrl.searchParams;
  const type = params.get("type") ?? "csv";

  if (type === "sauvegarde") return exporterSauvegarde();

  if (type === "csv") {
    const maintenant = new Date();
    const annee = lireAnnee(params.get("year") ?? undefined, maintenant.getUTCFullYear());
    const mois = lireMois(params.get("month") ?? undefined, maintenant.getUTCMonth() + 1);
    return exporterCsv(annee, mois);
  }

  return NextResponse.json(
    { error: `Type d'export inconnu : « ${type} ». Attendu : csv ou sauvegarde.` },
    { status: 400 },
  );
}
