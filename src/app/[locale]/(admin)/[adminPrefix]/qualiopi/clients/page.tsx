/**
 * Admin — Qualiopi · CRM Clients (T2).
 *
 * Liste les clients/prospects CRM avec statut et OPCO inféré.
 * Server Component force-dynamic. Authentification admin/super_admin.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { ClientBrancheForm } from "@/components/admin/qualiopi/ClientBrancheForm";
import { listClients } from "@/server/qualiopi/crm/clients";
import { opcoLabel } from "@/server/qualiopi/financements/opco-referentiel";
import { Hash, Users, FileText, CheckCircle2 } from "lucide-react";
import { AdminEmptyState } from "@/components/admin/ui";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Clients | Axion-IA Admin",
  robots: { index: false, follow: false },
};

const STATUT_LABELS: Record<string, string> = {
  prospect: "Prospect",
  devis_envoye: "Devis envoyé",
  client_actif: "Client actif",
  client_inactif: "Client inactif",
  perdu: "Perdu",
};

// Le OPCO_LABELS local (5 entrées) a été supprimé : c'était un duplicat
// appauvri de `opco-referentiel.ts` (11 entrées). Il aurait affiché le slug
// brut — « opco_ep », « uniformation » — dès que l'inférence ou la saisie
// manuelle sortirait des 5 OPCO qu'il connaissait. Utiliser `opcoLabel()`.
// ⚠️ Effet visible : « Opcommerce » devient « OPCOMMERCE » (libellé du
// référentiel, aligné sur la marque).

const TAILLE_LABELS: Record<string, string> = {
  TPE: "TPE",
  PME: "PME",
  ETI: "ETI",
  GRANDE_ENTREPRISE: "Grande entreprise",
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
  searchParams: Promise<{ q?: string }>;
}

export default async function QualiopiClientsPage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix } = await params;
  const { q } = await searchParams;
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }

  const recherche = (q ?? "").trim();
  const clients = await listClients(recherche === "" ? undefined : { recherche });

  // 🔴 Les compteurs portent sur le RÉSULTAT AFFICHÉ, et le libellé le dit.
  //
  // Laisser « Total 3 » au-dessus d'une liste filtrée à 1 ligne fait douter de
  // l'écran : on ne sait plus si la recherche a filtré ou si des fiches ont
  // disparu. Un compteur qui ne décrit pas ce qu'on voit est pire que pas de
  // compteur.
  const prospects = clients.filter((c) => c.statut === "prospect").length;
  const actifs = clients.filter((c) => c.statut === "client_actif").length;
  const devisEnvoyes = clients.filter((c) => c.statut === "devis_envoye").length;

  const cellCls = "px-[var(--space-admin-4)] py-[var(--space-admin-3)] align-top";
  const headCls =
    "px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)]";

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Clients / Prospects"
        description="CRM organisme de formation — entreprises (B2B) et particuliers (B2C). OPCO déduit de l'IDCC (source légale), à défaut du code NAF ; corrigeable par ligne."
      />

      <div className="mb-[var(--space-admin-6)] flex flex-wrap items-center gap-[var(--space-admin-4)]">
        <Link href={`/${locale}/${adminPrefix}/qualiopi/clients/new`} className="admin-button">
          + Nouveau client
        </Link>

        {/*
          Recherche en <form method="get"> : aucun JavaScript client.
          Le terme vit dans l'URL, donc il se partage, se met en favori et
          survit à un rechargement — trois choses qu'un filtre en état local
          ne sait pas faire. C'est le serveur qui filtre, pas le navigateur :
          avec 4 millions d'établissements collectés côté prospection, filtrer
          après chargement ne tiendrait de toute façon pas.
        */}
        <form method="get" className="flex flex-1 gap-[var(--space-admin-2)]">
          <input
            type="search"
            name="q"
            defaultValue={recherche}
            placeholder="Rechercher : raison sociale, SIRET, SIREN, n° de fiche, contact…"
            aria-label="Rechercher un client par raison sociale, SIRET, SIREN, numéro de fiche ou contact"
            className="min-w-[18rem] flex-1 rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]"
          />
          <button type="submit" className="admin-button-secondary">
            Rechercher
          </button>
          {recherche !== "" ? (
            <Link
              href={`/${locale}/${adminPrefix}/qualiopi/clients`}
              className="self-center text-[length:var(--text-admin-sm)] underline"
            >
              Effacer
            </Link>
          ) : null}
        </form>
      </div>

      {recherche !== "" ? (
        <p className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          {clients.length === 0
            ? `Aucun client ne correspond à « ${recherche} ». Vérifiez l'orthographe avant d'en créer un nouveau : un doublon coûte plus cher qu'une recherche ratée.`
            : `${clients.length} résultat${clients.length > 1 ? "s" : ""} pour « ${recherche} ».`}
        </p>
      ) : null}

      <div className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-4">
        <AdminStatCard
          label={recherche === "" ? "Total" : "Résultats"}
          value={clients.length}
          icon={Hash}
        />
        <AdminStatCard label="Prospects" value={prospects} icon={Users} />
        <AdminStatCard label="Devis envoyés" value={devisEnvoyes} tone="warning" icon={FileText} />
        <AdminStatCard label="Clients actifs" value={actifs} tone="success" icon={CheckCircle2} />
      </div>

      {/* Note : création d'un client via createClientAction (src/server/actions/qualiopi/clients.ts).
          L'IDCC (déclencheur du barème OPCO par dossier) et la taille sont éditables par ligne
          via ClientBrancheForm → updateClientAction. */}
      {clients.length === 0 ? (
        <AdminEmptyState
          title="Aucun client enregistré"
          description="Un client est nécessaire avant de créer une session ou d'émettre un devis."
          primaryAction={
            <Link href={`/${locale}/${adminPrefix}/qualiopi/clients/new`} className="admin-button">
              + Nouveau client
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)]">
          <table className="w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
            <thead className="border-b border-[color:var(--color-admin-border)]">
              <tr>
                <th className={headCls}>Numéro</th>
                <th className={headCls}>Raison sociale</th>
                <th className={headCls}>Type</th>
                <th className={headCls}>SIRET</th>
                <th className={headCls}>NAF</th>
                <th className={headCls}>IDCC</th>
                <th className={headCls}>Taille</th>
                <th className={headCls}>OPCO inféré</th>
                <th className={headCls}>Statut</th>
                <th className={headCls}>Édition branche</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr
                  key={client.id}
                  className="border-b border-[color:var(--color-admin-border)] last:border-0"
                >
                  <td className={cellCls}>
                    <span className="font-mono text-[length:var(--text-admin-xs)]">
                      {client.numero}
                    </span>
                  </td>
                  <td className={cellCls}>
                    {/* Le nom ouvre la fiche 360° (vue d'ensemble : sessions,
                        devis, factures, encours). L'édition garde son accès
                        PROPRE juste à côté — la retirer referait de
                        `[id]/edit` du code que rien n'appelle. */}
                    <Link
                      href={`/${locale}/${adminPrefix}/qualiopi/clients/${client.id}`}
                      className="font-medium text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
                    >
                      {client.raisonSociale}
                    </Link>{" "}
                    <Link
                      href={`/${locale}/${adminPrefix}/qualiopi/clients/${client.id}/edit`}
                      className="admin-button-ghost"
                      aria-label={`Modifier ${client.raisonSociale}`}
                    >
                      Éditer
                    </Link>
                    {client.contactEmail ? (
                      <div className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                        {client.contactEmail}
                      </div>
                    ) : (
                      // ⚠️ Dit ici, où l'admin peut agir : sans adresse de
                      // contact, le devis part sans lien de signature.
                      <div className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-warning)]">
                        Aucun e-mail de contact
                      </div>
                    )}
                  </td>
                  <td className={cellCls}>
                    {client.type === "particulier" ? "Particulier" : "Entreprise"}
                  </td>
                  <td className={cellCls}>
                    <span className="font-mono text-[length:var(--text-admin-xs)]">
                      {client.siret ?? (
                        <em className="text-[color:var(--color-admin-fg-muted)] not-italic">—</em>
                      )}
                    </span>
                  </td>
                  <td className={cellCls}>
                    {client.nafCode ?? (
                      <em className="text-[color:var(--color-admin-fg-muted)] not-italic">—</em>
                    )}
                  </td>
                  <td className={cellCls}>
                    {client.idcc ? (
                      <span className="font-mono text-[length:var(--text-admin-xs)]">
                        {client.idcc}
                      </span>
                    ) : (
                      <em className="text-[color:var(--color-admin-fg-muted)] not-italic">—</em>
                    )}
                  </td>
                  <td className={cellCls}>
                    {client.taille ? (
                      (TAILLE_LABELS[client.taille] ?? client.taille)
                    ) : (
                      <em className="text-[color:var(--color-admin-fg-muted)] not-italic">—</em>
                    )}
                  </td>
                  <td className={cellCls}>
                    {client.opcoIdentifie ? (
                      opcoLabel(client.opcoIdentifie)
                    ) : (
                      <em className="text-[color:var(--color-admin-fg-muted)] not-italic">
                        À déterminer
                      </em>
                    )}
                  </td>
                  <td className={cellCls}>
                    {client.statut === "client_actif" ? (
                      <span className="text-[color:var(--color-admin-success)]">
                        ● {STATUT_LABELS[client.statut] ?? client.statut}
                      </span>
                    ) : client.statut === "prospect" ? (
                      <span className="text-[color:var(--color-admin-fg-muted)]">
                        ○ {STATUT_LABELS[client.statut] ?? client.statut}
                      </span>
                    ) : client.statut === "devis_envoye" ? (
                      <span className="text-[color:var(--color-admin-warning)]">
                        ◑ {STATUT_LABELS[client.statut] ?? client.statut}
                      </span>
                    ) : (
                      <span className="text-[color:var(--color-admin-fg-muted)]">
                        {STATUT_LABELS[client.statut] ?? client.statut}
                      </span>
                    )}
                  </td>
                  <td className={cellCls}>
                    <ClientBrancheForm
                      id={client.id}
                      idcc={client.idcc}
                      taille={client.taille}
                      opcoIdentifie={client.opcoIdentifie}
                      estParticulier={client.type === "particulier"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminPageShell>
  );
}
