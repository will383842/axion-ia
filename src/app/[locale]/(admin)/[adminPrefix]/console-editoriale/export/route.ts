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
import fsp from "node:fs/promises";
import JSZip from "jszip";
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
import { cheminAbsolu, nomArchive, nomDansArchive } from "@/server/editorial/stockage";

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

/**
 * L'archive des médias d'une publication — critère 3 du lot 1.
 *
 * > « Une publication portant trois images télécharge une archive `.zip`
 * >   NOMMÉE LISIBLEMENT. »
 *
 * Deux refus explicites plutôt qu'une archive vide :
 *   - aucune publication → 404 ;
 *   - aucun média déposé → 409 avec un message qui dit quoi faire.
 *
 * Une archive vide se télécharge sans erreur, s'ouvre sur rien, et laisse
 * croire à une perte de données. Mieux vaut refuser en le disant.
 */
async function exporterArchive(publicationId: string): Promise<NextResponse> {
  const publication = await prisma.edPublication.findUnique({
    where: { id: publicationId },
    select: {
      refImport: true,
      titreInterne: true,
      assets: {
        orderBy: { ordre: "asc" },
        select: { ordre: true, asset: { select: { libelle: true, cheminObjet: true } } },
      },
    },
  });
  if (!publication) {
    return NextResponse.json({ error: "Publication introuvable" }, { status: 404 });
  }

  const medias = publication.assets.filter((a) => a.asset.cheminObjet);
  if (medias.length === 0) {
    return NextResponse.json(
      {
        error:
          "Cette publication ne porte aucun média déposé. Déposez un fichier " +
          "depuis sa fiche avant de demander une archive.",
      },
      { status: 409 },
    );
  }

  const zip = new JSZip();
  let ajoutes = 0;

  for (const lien of medias) {
    const chemin = lien.asset.cheminObjet as string;
    try {
      const contenu = await fsp.readFile(cheminAbsolu(chemin));
      const extension = chemin.split(".").pop() ?? "bin";
      zip.file(nomDansArchive(lien.ordre, lien.asset.libelle, extension), contenu);
      ajoutes += 1;
    } catch {
      // Un fichier référencé mais absent du disque ne doit pas faire échouer
      // toute l'archive : on le NOTE dedans, pour que celui qui décompresse
      // sache ce qui manque au lieu de compter les fichiers à la main.
      zip.file(
        `MANQUANT-${nomDansArchive(lien.ordre, lien.asset.libelle, "txt")}`,
        `Le fichier « ${chemin} » est référencé en base mais introuvable sur le disque.`,
      );
    }
  }

  if (ajoutes === 0) {
    return NextResponse.json(
      { error: "Tous les fichiers de cette publication sont introuvables sur le disque." },
      { status: 409 },
    );
  }

  const contenu = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return new NextResponse(new Uint8Array(contenu), {
    headers: enTetes(
      nomArchive(publication.refImport, publication.titreInterne),
      "application/zip",
    ),
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

  if (type === "archive") {
    const id = params.get("publication");
    if (!id) {
      return NextResponse.json(
        { error: "Paramètre « publication » attendu pour une archive." },
        { status: 400 },
      );
    }
    return exporterArchive(id);
  }

  if (type === "csv") {
    const maintenant = new Date();
    const annee = lireAnnee(params.get("year") ?? undefined, maintenant.getUTCFullYear());
    const mois = lireMois(params.get("month") ?? undefined, maintenant.getUTCMonth() + 1);
    return exporterCsv(annee, mois);
  }

  return NextResponse.json(
    { error: `Type d'export inconnu : « ${type} ». Attendu : csv, archive ou sauvegarde.` },
    { status: 400 },
  );
}
