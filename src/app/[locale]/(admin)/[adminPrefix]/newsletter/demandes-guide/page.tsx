// Écran « Demandes du guide » (lot L3, 2026-09-24).
//
// Décision n° 1 de Will : le guide part tout de suite par e-mail, et une
// demande du guide n'est PAS un abonnement — elle vit dans `guide_requests`.
// Cet écran montre ce que la console ne voyait pas : chaque demande, si
// l'e-mail est parti, si le lien a été ouvert (peut-être par un antivirus) ou
// cliqué (geste humain), si le CRM l'a reçue — et un « Renvoyer » unitaire,
// idempotent et journalisé.
//
// Lecture : `server/newsletter/console.ts`. Geste : `renvoyerGuideAction`.

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  AdminBadge,
  AdminCard,
  AdminEmptyState,
  AdminPageHeader,
  AdminPageShell,
  AdminPagination,
  AdminTable,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";
import { formatDateFrShort } from "@/lib/format-date-fr";
import {
  libelleSource,
  listerDemandesGuide,
  type EtatDemandeFiltre,
  type LigneDemandeGuide,
} from "@/server/newsletter/console";
import { EnvoyerGuideBouton } from "../_v2/EnvoyerGuideBouton";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

const ETATS: ReadonlyArray<{ valeur: EtatDemandeFiltre; libelle: string }> = [
  { valeur: "toutes", libelle: "Toutes" },
  { valeur: "non-envoyees", libelle: "Pas encore parties" },
  { valeur: "envoyees", libelle: "Envoyées" },
  { valeur: "cliquees", libelle: "Guide téléchargé" },
];

const STATUT_LETTRE: Record<string, string> = {
  confirmed: "Abonné",
  pending: "En attente",
  unsubscribed: "Désabonné",
  bounced: "Rejeté",
};

/** Où en est l'envoi : ce que la ligne dit, sans supposer. */
function envoi(l: LigneDemandeGuide): React.ReactElement {
  if (l.sentAt) {
    return (
      <AdminBadge tone="success">
        Envoyé {formatDateFrShort(l.sentAt)}
        {l.sendCount > 1 ? ` · ${l.sendCount} envois` : ""}
      </AdminBadge>
    );
  }
  if (l.queuedAt) return <AdminBadge tone="warning">En file</AdminBadge>;
  return <AdminBadge tone="warning">En attente</AdminBadge>;
}

export default async function DemandesGuidePage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);
  const sp = await searchParams;
  const base = `/fr/${adminPrefix}`;

  const etat = (ETATS.find((e) => e.valeur === sp["etat"])?.valeur ??
    "toutes") as EtatDemandeFiltre;
  const origine =
    sp["origine"] === "formulaire" || sp["origine"] === "admin" ? sp["origine"] : "toutes";
  const resultat = await listerDemandesGuide({
    etat,
    origine,
    ...(sp["recherche"] ? { recherche: sp["recherche"] } : {}),
    page: sp["page"] ? parseInt(sp["page"], 10) || 1 : 1,
  });

  const colonnes: ReadonlyArray<AdminTableColumn<LigneDemandeGuide>> = [
    { key: "createdAt", header: "Demandé le", cell: (l) => formatDateFrShort(l.createdAt) },
    {
      key: "email",
      header: "E-mail",
      cell: (l) =>
        l.abonneId ? <Link href={`${base}/newsletter/${l.abonneId}`}>{l.email}</Link> : l.email,
    },
    {
      key: "origine",
      header: "Provenance",
      cell: (l) => (l.origine === "admin" ? "Console" : libelleSource(l.source)),
    },
    { key: "envoi", header: "Envoi", cell: envoi },
    { key: "vu", header: "Lien ouvert", cell: (l) => formatDateFrShort(l.firstSeenAt) },
    { key: "clic", header: "Téléchargé", cell: (l) => formatDateFrShort(l.firstClickAt) },
    {
      key: "lettre",
      header: "Lettre",
      cell: (l) =>
        l.abonneStatut ? (STATUT_LETTRE[l.abonneStatut] ?? l.abonneStatut) : "Non inscrit",
    },
    {
      key: "crm",
      header: "CRM",
      cell: (l) =>
        l.crmEmittedAt ? `Transmis ${formatDateFrShort(l.crmEmittedAt)}` : "Pas encore",
    },
    {
      key: "actions",
      header: "Actions",
      cell: (l) =>
        l.abonneStatut === "bounced" ? "—" : <EnvoyerGuideBouton id={l.id} mode="renvoyer" />,
    },
  ];

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Demandes du guide"
        description={`${resultat.total} demande${resultat.total > 1 ? "s" : ""} · page ${resultat.page}/${resultat.totalPages}`}
        actions={
          <Link href={`${base}/newsletter`} className="admin-button-ghost">
            Abonnés à la lettre
          </Link>
        }
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <form className="admin-filters">
          <div className="admin-filters-grid">
            <div className="admin-field">
              <label htmlFor="etat" className="admin-label">
                État
              </label>
              <select id="etat" name="etat" defaultValue={etat} className="admin-input">
                {ETATS.map((e) => (
                  <option key={e.valeur} value={e.valeur}>
                    {e.libelle}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-field">
              <label htmlFor="origine" className="admin-label">
                Origine
              </label>
              <select id="origine" name="origine" defaultValue={origine} className="admin-input">
                <option value="toutes">Toutes</option>
                <option value="formulaire">Formulaire du site</option>
                <option value="admin">Console</option>
              </select>
            </div>
            <div className="admin-field">
              <label htmlFor="recherche" className="admin-label">
                E-mail
              </label>
              <input
                id="recherche"
                name="recherche"
                type="text"
                defaultValue={sp["recherche"] ?? ""}
                className="admin-input"
                placeholder="Min 2 caractères"
              />
            </div>
          </div>
          <div className="admin-filters-actions">
            <button type="submit" className="admin-button-ghost">
              Appliquer
            </button>
            <Link href={`${base}/newsletter/demandes-guide`} className="admin-button-secondary">
              Réinitialiser
            </Link>
          </div>
        </form>
      </AdminCard>

      <p className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
        « Lien ouvert » peut venir d&apos;un antivirus de messagerie ; « Téléchargé » est le clic
        sur le bouton de la page du guide, seul geste humain. Un renvoi respecte les bornes du
        formulaire (3 envois par 24 h à une adresse, plafond horaire, coupe-circuit) et un double
        clic n&apos;envoie qu&apos;une fois.
      </p>

      {resultat.lignes.length === 0 ? (
        <AdminEmptyState title="Aucune demande du guide." />
      ) : (
        <AdminTable
          columns={colonnes}
          rows={resultat.lignes}
          getRowId={(l) => l.id}
          caption="Demandes du guide IA entreprise"
        />
      )}

      <AdminPagination
        page={resultat.page}
        totalPages={resultat.totalPages}
        baseHref={`${base}/newsletter/demandes-guide`}
        preservedParams={{ etat: sp["etat"], origine: sp["origine"], recherche: sp["recherche"] }}
      />
    </AdminPageShell>
  );
}
