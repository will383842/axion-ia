/**
 * Admin — Qualiopi · Nouveau devis (T19 Cluster E4a).
 *
 * Server Component — auth + redirect, force-dynamic, noindex.
 * Monte `DevisForm` avec la liste des clients CRM et des offres actives.
 *
 * Chantier visio (PR 7) — ouvert depuis un PROJET (`?clientId=…&projetId=…`) :
 * le devis reste VIDE (décision de Will du 29/09) et le panneau « Ce que le
 * client a dit » s'affiche à côté, en lecture seule, pour les rôles de
 * `ROLES_DOSSIER_ECHANGES` seulement (décision A2).
 */

import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { DevisForm } from "@/components/admin/qualiopi/DevisForm";
import { listClients } from "@/server/qualiopi/crm/clients";
import { listOffres } from "@/server/qualiopi/offres/offres";
import { ACTIVITE_LABELS } from "@/server/qualiopi/financements/facture-libre-pur";
import type { ActiviteFacturation } from "../../../../../../../../prisma/generated/client";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";
import { chargerAideDuProjet } from "@/features/dossier-client/aide-du-projet";
import { CeQueLeClientADit } from "@/features/dossier-client/ce-que-le-client-a-dit";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Qualiopi — Nouveau devis | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
  /**
   * `clientId` : pré-sélection du client (lien « Créer un devis » depuis /qualiopi/entrees).
   * `projetId` : devis ouvert depuis un projet de ce client (chantier visio, PR 7).
   */
  searchParams: Promise<{ clientId?: string; projetId?: string }>;
}

export default async function QualiopiDevisNewPage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix } = await params;
  const sp = await searchParams;
  const acces = await gardePage("ecriture", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }

  const [clients, offresWithPrice] = await Promise.all([
    listClients(),
    listOffres({ actifOnly: true }),
  ]);

  const clientOptions = clients.map((c) => ({
    id: c.id,
    numero: c.numero,
    raisonSociale: c.raisonSociale,
  }));

  // Le montant part d'ici en CENTIMES, déjà résolu côté serveur. Importer
  // `pricing-resolver` dans le composant client tirerait tout `pricing.ts`
  // (PRICING_CATEGORIES entier) dans le bundle admin et ferait sauter le gate
  // `size-limit`. Ne pas « simplifier » en déplaçant la résolution côté client.
  const offreOptions = offresWithPrice.map((o) => ({
    tierId: o.offre.tierId,
    code: o.offre.code,
    titreFr: o.offre.titreFr,
    prixLabelFr: o.prixLabelFr,
    prixHtCents: o.prixHtEur === null ? null : Math.round(o.prixHtEur * 100),
    noteDevisFr: o.noteDevisFr,
  }));

  // Pré-sélection sûre : le clientId du searchParam n'est retenu que s'il
  // correspond à un client CRM réel (sinon ignoré silencieusement).
  const defaultClientId = clientOptions.some((c) => c.id === sp.clientId)
    ? (sp.clientId as string)
    : undefined;

  const basePath = `/${locale}/${adminPrefix}/qualiopi/devis`;

  // Chantier visio (PR 7) : le lien au projet et l'aide à côté — la garde A2
  // (rôle non habilité : lien gardé, rien lu du dossier) est dans le chargeur.
  const { projetId, aide } = await chargerAideDuProjet({
    role: acces.role,
    clientId: defaultClientId,
    projetId: sp.projetId,
  });

  const formulaire = (
    <DevisForm
      clients={clientOptions}
      offres={offreOptions}
      activites={(Object.keys(ACTIVITE_LABELS) as ActiviteFacturation[]).map((value) => ({
        value,
        label: ACTIVITE_LABELS[value],
      }))}
      basePath={basePath}
      {...(defaultClientId !== undefined ? { defaultClientId } : {})}
      {...(projetId !== null ? { projetId } : {})}
    />
  );

  return (
    <AdminPageShell width={aide !== null ? "wide" : "narrow"}>
      <div className="mb-[var(--space-admin-4)]">
        <Link
          href={basePath}
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-accent)] underline hover:no-underline"
        >
          ← Retour aux devis
        </Link>
      </div>

      <AdminPageHeader
        title="Nouveau devis"
        description="Créez un devis commercial formation. Le numéro est alloué automatiquement (AXI-DEV-AAAA-NNN). La TVA suit le régime configuré."
      />

      {aide !== null ? (
        <div className="grid gap-[var(--space-admin-5)] lg:grid-cols-[minmax(0,1fr)_22rem]">
          {formulaire}
          <CeQueLeClientADit aide={aide.aide} projetTitre={aide.titre} />
        </div>
      ) : (
        formulaire
      )}
    </AdminPageShell>
  );
}
