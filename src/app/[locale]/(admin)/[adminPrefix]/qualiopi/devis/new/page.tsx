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
import { isUuid } from "@/lib/is-uuid";
import { prisma } from "@/lib/prisma";
import { formulesActives } from "@/server/qualiopi/devis/interrupteur-formules";
import { TAUX_TVA_STANDARD } from "@/server/qualiopi/legal/tva";

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
   * `rencontreId` : devis ouvert depuis « Après l'appel » (lien de retour, m-8).
   */
  searchParams: Promise<{ clientId?: string; projetId?: string; rencontreId?: string }>;
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
  const clientPreselectionne = clientOptions.find((c) => c.id === defaultClientId);

  // Chantier visio (PR 7) : le lien au projet et l'aide à côté — la garde A2
  // (rôle non habilité : lien gardé, rien lu du dossier) est dans le chargeur.
  const { projetId, aide } = await chargerAideDuProjet({
    role: acces.role,
    clientId: defaultClientId,
    projetId: sp.projetId,
  });

  // Mode formules : proposé SEULEMENT si l'interrupteur est allumé (éteint par défaut) ;
  // les textes copiés dans l'offre sont ceux de la bibliothèque « actifs par défaut ».
  const formulesOn = await formulesActives();
  const textesParDefaut = formulesOn
    ? await prisma.devisTexteBibliotheque.findMany({
        where: { archiveAt: null, actifParDefaut: true },
        orderBy: [{ formule: "asc" }, { nature: "asc" }, { ordre: "asc" }],
        select: { id: true, version: true, texte: true },
      })
    : [];

  const formulaire = (
    <DevisForm
      clients={clientOptions}
      offres={offreOptions}
      activites={(Object.keys(ACTIVITE_LABELS) as ActiviteFacturation[]).map((value) => ({
        value,
        label: ACTIVITE_LABELS[value],
      }))}
      basePath={basePath}
      {...(formulesOn
        ? {
            formules: {
              tvaStandardPct: TAUX_TVA_STANDARD,
              textes: textesParDefaut.map((t) => ({
                bibliothequeId: t.id,
                version: String(t.version),
                texte: t.texte,
                actif: true,
              })),
            },
          }
        : {})}
      {...(defaultClientId !== undefined ? { defaultClientId } : {})}
      {...(projetId !== null ? { projetId } : {})}
    />
  );

  return (
    <AdminPageShell width={aide !== null ? "wide" : "narrow"}>
      <div className="mb-[var(--space-admin-4)] flex flex-wrap items-center gap-x-[var(--space-admin-4)] gap-y-[var(--space-admin-2)]">
        {clientPreselectionne !== undefined ? (
          <Link
            href={`/${locale}/${adminPrefix}/qualiopi/clients/${clientPreselectionne.id}`}
            className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
          >
            ← {clientPreselectionne.raisonSociale}
          </Link>
        ) : null}
        <Link
          href={basePath}
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
        >
          ← Devis
        </Link>
        {isUuid(sp.rencontreId) ? (
          <Link
            href={`/${locale}/${adminPrefix}/rendez-vous/rencontres/${sp.rencontreId}`}
            className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
          >
            ← Rendez-vous
          </Link>
        ) : null}
      </div>

      <AdminPageHeader
        title="Nouveau devis"
        description={
          clientPreselectionne !== undefined
            ? `Devis pour ${clientPreselectionne.raisonSociale}. Le numéro est alloué automatiquement (AXI-DEV-AAAA-NNN). La TVA suit le régime configuré.`
            : "Créez un devis commercial formation. Le numéro est alloué automatiquement (AXI-DEV-AAAA-NNN). La TVA suit le régime configuré."
        }
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
