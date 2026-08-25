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
 *   /console-editoriale/export?type=plan&asset=carrousel&periode=2026-10&format=md
 *   /console-editoriale/export?type=plan&asset=carrousel&format=pdf
 */

import { NextResponse, type NextRequest } from "next/server";
import fsp from "node:fs/promises";
import JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/server/actions/editorial/_guards";
import { dayKeyOfGridDate } from "@/lib/calendar-grid";
import {
  lireAnnee,
  lireMois,
  bornesDuMois,
  lirePeriodeMois,
} from "@/server/editorial/calendrier-pur";
import {
  construireCsv,
  nomFichierCsv,
  assemblerSauvegarde,
  serialiserSauvegarde,
  nomFichierSauvegarde,
  type PublicationExportable,
} from "@/server/editorial/exports";
import { cheminAbsolu, nomArchive, nomDansArchive } from "@/server/editorial/stockage";
import {
  construireMarkdown,
  construireCsvPlan,
  nomFichierPlan,
  TYPES_PLAN,
  type AssetPlan,
} from "@/server/editorial/plan-production";
import { rendrePlanEnPdf } from "@/server/editorial/plan-production-pdf";

/** Le titre humain d'un plan. La clé sert l'URL, le mot sert le lecteur. */
const LIBELLE_TYPE_PLAN: Record<string, string> = {
  video: "Vidéos",
  carrousel: "Carrousels",
  image: "Images",
  photo: "Photos de Williams",
  audio: "Audio",
  document: "Documents",
  tout: "tous les assets",
};

/**
 * Plafond du plan de production.
 *
 * Il existe pour la même raison que tous les plafonds de requête : sans lui,
 * un compte qui aurait dix mille assets sortirait un PDF que personne
 * n'imprime et qui fait tomber la route. Ce qui compte n'est pas sa valeur,
 * c'est que le document DISE quand il l'atteint — cf. `tronque` plus bas.
 */
const LIMITE_PLAN = 2000;

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

/**
 * Le plan de production — l'export centré sur l'ASSET, et non sur le post.
 *
 * Les autres exports répondent à « qu'est-ce qui part le 12 ? ». Celui-ci
 * répond à « qu'est-ce que je fabrique aujourd'hui ? ». Ce n'est pas la même
 * question, et un tri par date de publication n'y repond pas : on ne produit
 * pas une vidéo et un carrousel dans la même séance.
 */
async function exporterPlan(
  typeAsset: string | null,
  periode: string | null,
  format: "md" | "csv" | "pdf",
  seulementAProduire: boolean,
): Promise<NextResponse> {
  // Bornes de période. `periode` vaut « 2026-10 », ou rien pour tout.
  //
  // 🔴 Ce bloc testait la période avec `/^d{4}-d{2}$/` — les deux antislashs
  // manquaient. L'expression ne reconnaissait que la chaîne littérale
  // « dddd-dd » : AUCUNE période n'a jamais matché, le filtre n'était jamais
  // posé, et l'export sortait tous les mois en affichant « Toutes périodes ».
  // La lecture vit désormais dans `calendrier-pur`, sous test — une regex
  // écrite dans un Route Handler n'était couverte par rien.
  let bornes: { debut: Date; fin: Date } | null = null;
  if (periode) {
    const lue = lirePeriodeMois(periode);
    // Et on REFUSE au lieu d'ignorer : retomber en silence sur « tout », c'est
    // rendre un document qui ment sur son propre périmètre.
    if (!lue.ok) return NextResponse.json({ error: lue.erreur }, { status: 400 });
    bornes = bornesDuMois(lue.annee, lue.mois);
  }

  const assets = await prisma.edAsset.findMany({
    where: {
      ...(typeAsset && TYPES_PLAN.includes(typeAsset as never) ? { type: typeAsset as never } : {}),
      // `pret` est le seul statut qui signifie « il n'y a plus rien à faire ».
      ...(seulementAProduire ? { NOT: { statut: "pret" as never } } : {}),
      ...(bornes
        ? {
            publications: {
              some: { publication: { datePrevue: { gte: bornes.debut, lt: bornes.fin } } },
            },
          }
        : {}),
    },
    select: {
      id: true,
      type: true,
      libelle: true,
      statut: true,
      segments: {
        orderBy: { ordre: "asc" },
        select: { ordre: true, role: true, titre: true, contenu: true, prompt: true, fait: true },
      },
      publications: {
        orderBy: { ordre: "asc" },
        take: 1,
        select: {
          publication: { select: { datePrevue: true, heurePrevue: true, titreInterne: true } },
        },
      },
    },
    // ⚠️ `+ 1` : on demande un élément DE PLUS que le plafond, uniquement
    // pour savoir s'il en existait d'autres. Un `take: LIMITE` sec rend un
    // plan tronqué indiscernable d'un plan complet — le travail qui manque
    // ne manque alors nulle part.
    take: LIMITE_PLAN + 1,
  });

  const tronque = assets.length > LIMITE_PLAN;
  const retenus = tronque ? assets.slice(0, LIMITE_PLAN) : assets;

  const plan: AssetPlan[] = retenus.map((a) => {
    const pub = a.publications[0]?.publication ?? null;
    return {
      id: a.id,
      type: a.type,
      libelle: a.libelle,
      statut: a.statut,
      datePost: pub ? dayKeyOfGridDate(pub.datePrevue) : null,
      heurePost: pub?.heurePrevue ?? null,
      titrePost: pub?.titreInterne ?? null,
      segments: a.segments,
    };
  });

  const libelleType = typeAsset && TYPES_PLAN.includes(typeAsset as never) ? typeAsset : "tout";
  const libellePeriode = bornes ? (periode ?? "tout") : "tout";

  const contexte = {
    titre: `Plan de production — ${LIBELLE_TYPE_PLAN[libelleType] ?? libelleType}`,
    periode:
      (bornes ? `Période ${libellePeriode}` : "Toutes périodes") +
      (seulementAProduire ? " · assets non terminés seulement" : " · tous statuts"),
    avertissement: tronque
      ? `Ce plan est TRONQUÉ : il s'arrête à ${LIMITE_PLAN} assets, et le ` +
        "périmètre demandé en contient davantage. Filtrez par type " +
        "(« asset=carrousel ») ou par mois (« periode=2026-10 ») pour tout voir."
      : null,
  };

  // Le nom du fichier porte la troncature quel que soit le format : c'est le
  // seul avertissement qu'un CSV peut transporter — y écrire une ligne de
  // commentaire casserait le tableur qui l'ouvre.
  const nom = (extension: "md" | "csv" | "pdf") =>
    nomFichierPlan(libelleType, libellePeriode, extension, tronque);

  if (format === "csv") {
    return new NextResponse(construireCsvPlan(plan), {
      headers: enTetes(nom("csv"), "text/csv"),
    });
  }

  if (format === "pdf") {
    const buffer = await rendrePlanEnPdf(plan, contexte);
    return new NextResponse(new Uint8Array(buffer), {
      headers: enTetes(nom("pdf"), "application/pdf"),
    });
  }

  return new NextResponse(construireMarkdown(plan, contexte), {
    headers: enTetes(nom("md"), "text/markdown"),
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

  if (type === "plan") {
    const demande = params.get("format");
    const format = demande === "csv" ? "csv" : demande === "pdf" ? "pdf" : "md";
    // Par defaut on ne sort QUE ce qui reste a faire : un plan de production
    // qui reliste les assets termines se relit mal et se coche deux fois.
    const seulementAProduire = params.get("statut") !== "tous";
    return exporterPlan(params.get("asset"), params.get("periode"), format, seulementAProduire);
  }

  if (type === "csv") {
    const maintenant = new Date();
    const annee = lireAnnee(params.get("year") ?? undefined, maintenant.getUTCFullYear());
    const mois = lireMois(params.get("month") ?? undefined, maintenant.getUTCMonth() + 1);
    return exporterCsv(annee, mois);
  }

  return NextResponse.json(
    { error: `Type d'export inconnu : « ${type} ». Attendu : csv, plan, archive ou sauvegarde.` },
    { status: 400 },
  );
}
