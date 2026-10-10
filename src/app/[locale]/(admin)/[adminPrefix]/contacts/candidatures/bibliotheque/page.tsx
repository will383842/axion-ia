// Bibliothèque de fichiers — Candidatures unifiées, lot L4 (ADR 0065).
//
// Les fichiers que l'équipe envoie aux candidats : LUT, rushs, vidéos
// d'exemple, consignes, musique, présentation — et les liens Drive / WeTransfer.
// Les octets vont DIRECTEMENT du navigateur au stockage en ligne (R2), par
// morceaux, jusqu'à 20 Go ; rien n'est posé sur le serveur.
//
// 🔴 ÉTEINTE PAR DÉFAUT : tant que le compartiment dédié et ses accès ne sont
//    pas réglés, l'écran le DIT (avec la raison) et ne lit ni n'écrit rien.
// 🔴 AUCUN EFFACEMENT : un fichier s'archive et se réaffiche.
// Mobile : le tableau défile horizontalement (décision de Will, pas de cartes).

import Link from "next/link";
import { redirect } from "next/navigation";
import { Archive, ArrowLeft, Download, FolderOpen, RotateCcw } from "lucide-react";

import { auth } from "@/auth";
import {
  AdminBadge,
  AdminCard,
  AdminEmptyState,
  AdminPageHeader,
  AdminPageShell,
  AdminTable,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import {
  archiverFichierAction,
  reafficherFichierAction,
} from "@/features/bibliotheque-fichiers/actions";
import { formatDateFrShort } from "@/lib/format-date-fr";
import { peutOuvrirDossierCandidat } from "@/server/auth/habilitations";
import { raisonExtinction } from "@/server/partages/config";
import {
  listerBibliotheque,
  relancerAnalysesPartagesEnAttente,
  PLAFOND_LISTE,
  type FichierListe,
} from "@/server/partages/depot";
import { LIBELLE_CATEGORIE, tailleLisible } from "@/server/partages/regles";
import { OuvrirDepot } from "./_composants/OuvrirDepot";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<{ archives?: string; retour?: string }>;
}

/** Les messages de retour : des CODES fixes dans l'URL, jamais de texte libre. */
const RETOURS: Readonly<Record<string, { ton: "success" | "warning"; texte: string }>> = {
  archive: {
    ton: "success",
    texte: "Fichier archivé. Il reste stocké : vous pouvez le réafficher.",
  },
  reaffiche: { ton: "success", texte: "Fichier réaffiché dans la bibliothèque." },
  infecte: {
    ton: "warning",
    texte: "L'antivirus a trouvé un risque dans ce fichier : il reste archivé.",
  },
  refus: { ton: "warning", texte: "Votre rôle ne permet pas ce geste." },
  introuvable: { ton: "warning", texte: "Ce fichier est introuvable." },
  erreur: { ton: "warning", texte: "Le geste n'a pas abouti. Réessayez dans un instant." },
};

/** L'état lisible d'une ligne : dépôt, antivirus, lien. */
function Etat({ f }: { f: FichierListe }) {
  if (f.nature === "lien_externe") return <AdminBadge tone="outline">Lien externe</AdminBadge>;
  if (f.etatDepot === "en_cours") return <AdminBadge tone="warning">Envoi en cours</AdminBadge>;
  switch (f.analyse) {
    case "sain":
      return <AdminBadge tone="success">Vérifié</AdminBadge>;
    case "hors_limite":
      return <AdminBadge tone="neutral">Non analysé (déposé par vous)</AdminBadge>;
    case "infecte":
      return <AdminBadge tone="destructive">Risque détecté</AdminBadge>;
    default:
      return <AdminBadge tone="info">Analyse en cours</AdminBadge>;
  }
}

function telechargeable(f: FichierListe): boolean {
  if (f.nature === "lien_externe") return true;
  return f.etatDepot === "disponible" && (f.analyse === "sain" || f.analyse === "hors_limite");
}

export default async function BibliothequePage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect(`/fr/${adminPrefix}/login`);
  const role = (session.user as { role?: string }).role ?? null;
  const base = `/fr/${adminPrefix}/contacts/candidatures`;
  if (!peutOuvrirDossierCandidat(role)) {
    return (
      <AccesRefuse
        motif="La bibliothèque de fichiers est réservée aux rôles qui ouvrent les dossiers des candidats."
        retourHref={`/fr/${adminPrefix}`}
      />
    );
  }

  const retourListe = (
    <Link href={base} className="admin-button-ghost">
      <ArrowLeft size={15} aria-hidden="true" /> Candidatures
    </Link>
  );

  const raison = raisonExtinction();
  if (raison) {
    return (
      <AdminPageShell width="wide">
        <AdminPageHeader
          title="Bibliothèque de fichiers"
          description="LUT, rushs, vidéos d'exemple et consignes à envoyer aux candidats"
          actions={retourListe}
        />
        <div className="admin-alert admin-alert-info" role="status">
          <FolderOpen size={18} aria-hidden="true" />
          <div>
            <p className="font-semibold">La bibliothèque n&apos;est pas encore activée.</p>
            <p>Raison : {raison}.</p>
            <p className="admin-meta-small">
              Rien n&apos;est envoyé ni enregistré tant qu&apos;elle est éteinte. Elle s&apos;allume
              d&apos;elle-même dès que le stockage en ligne dédié est réglé.
            </p>
          </div>
        </div>
      </AdminPageShell>
    );
  }

  const archives = sp.archives === "1";
  void relancerAnalysesPartagesEnAttente();
  const biblio = await listerBibliotheque({ archives });
  const retour = sp.retour ? RETOURS[sp.retour] : undefined;
  const ici = `${base}/bibliotheque`;

  const colonnes: ReadonlyArray<AdminTableColumn<FichierListe>> = [
    {
      key: "fichier",
      header: "Fichier",
      cell: (f) => (
        <span className="block max-w-[22rem]">
          <span className="block font-medium">{f.titre}</span>
          {f.nomFichier && f.nomFichier !== f.titre ? (
            <span className="admin-meta-small block break-all">{f.nomFichier}</span>
          ) : null}
        </span>
      ),
    },
    { key: "categorie", header: "Catégorie", cell: (f) => LIBELLE_CATEGORIE[f.categorie] },
    {
      key: "taille",
      header: "Taille",
      align: "right",
      cell: (f) => (f.taille === null ? "—" : tailleLisible(f.taille)),
    },
    { key: "etat", header: "État", cell: (f) => <Etat f={f} /> },
    { key: "par", header: "Déposé par", cell: (f) => f.deposeParNom },
    { key: "le", header: "Le", cell: (f) => formatDateFrShort(f.creeLe) },
    {
      key: "actions",
      header: "Actions",
      cell: (f) => (
        <span className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
          {telechargeable(f) ? (
            <a
              href={`${ici}/${f.id}`}
              className="admin-button-secondary admin-button-sm"
              rel="noopener noreferrer"
              target={f.nature === "lien_externe" ? "_blank" : undefined}
            >
              <Download size={14} aria-hidden="true" />
              {f.nature === "lien_externe" ? "Ouvrir" : "Télécharger"}
            </a>
          ) : null}
          {archives ? (
            f.analyse === "infecte" ? null : (
              <form action={reafficherFichierAction}>
                <input type="hidden" name="fichierId" value={f.id} />
                <button type="submit" className="admin-button-ghost admin-button-sm">
                  <RotateCcw size={14} aria-hidden="true" /> Réafficher
                </button>
              </form>
            )
          ) : (
            <form action={archiverFichierAction}>
              <input type="hidden" name="fichierId" value={f.id} />
              <button type="submit" className="admin-button-ghost admin-button-sm">
                <Archive size={14} aria-hidden="true" /> Archiver
              </button>
            </form>
          )}
        </span>
      ),
    },
  ];

  const n = biblio.fichiers.length;
  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title={archives ? "Bibliothèque de fichiers — archives" : "Bibliothèque de fichiers"}
        description={`${n} ${archives ? "archivé" : "fichier"}${n > 1 ? "s" : ""} · ${tailleLisible(biblio.volumeOctets)} stockés au total`}
        actions={
          <div className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
            {retourListe}
            {archives ? (
              <Link href={ici} className="admin-button-ghost">
                <FolderOpen size={15} aria-hidden="true" /> Bibliothèque
              </Link>
            ) : (
              <Link href={`${ici}?archives=1`} className="admin-button-ghost">
                <Archive size={15} aria-hidden="true" /> Archives ({biblio.nombreArchives})
              </Link>
            )}
          </div>
        }
      />

      {retour ? (
        <div
          className={`admin-alert ${retour.ton === "success" ? "admin-alert-success" : "admin-alert-warning"} mb-[var(--space-admin-4)]`}
          role="status"
        >
          {retour.texte}
        </div>
      ) : null}

      {archives ? null : (
        <AdminCard className="mb-[var(--space-admin-5)]">
          <OuvrirDepot>
            <p className="admin-meta-small">
              Jusqu&apos;à 20 Go par fichier, envoyé directement au stockage en ligne. Un envoi
              coupé reprend où il s&apos;était arrêté.
            </p>
          </OuvrirDepot>
        </AdminCard>
      )}

      <AdminTable
        columns={colonnes}
        rows={biblio.fichiers}
        getRowId={(f) => f.id}
        caption={archives ? "Fichiers archivés" : "Fichiers de la bibliothèque"}
        emptyState={
          <AdminEmptyState
            title={archives ? "Aucun fichier archivé." : "La bibliothèque est vide."}
            {...(archives
              ? {}
              : { description: "Ajoutez un fichier depuis votre ordinateur ou collez un lien." })}
          />
        }
      />
      {n >= PLAFOND_LISTE ? (
        <p className="admin-meta-small mt-[var(--space-admin-3)]">
          Les {PLAFOND_LISTE} plus récents sont affichés.
        </p>
      ) : null}
    </AdminPageShell>
  );
}
