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
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AssistantDevisDiffere } from "@/components/admin/qualiopi/assistant-devis/AssistantDevisDiffere";
import { CGV_VERSION_LIBELLE } from "@/content/cgv-version";
import { dayKeyInParis } from "@/lib/calendar-grid";
import { chargerAssistantDevis } from "@/server/qualiopi/devis/assistant/charger";
import { LOT_DEVIS_ASSISTANT } from "@/server/qualiopi/devis/interrupteur-assistant";
import { lireInterrupteurQualiopi } from "@/server/qualiopi/socle/interrupteurs";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AdminButton } from "@/components/admin/ui/AdminButton";
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
import { isQualiopiCertificationObtenue } from "@/server/qualiopi/config/flag";
import { formulesActives } from "@/server/qualiopi/devis/interrupteur-formules";
import { TAUX_TVA_STANDARD } from "@/server/qualiopi/legal/tva";

export const dynamic = "force-dynamic";

// Avant la certification, le titre n'emploie pas le mot « Qualiopi » (modèle de `devis/[id]`).
export function generateMetadata(): Metadata {
  return {
    title: isQualiopiCertificationObtenue()
      ? "Qualiopi — Nouveau devis | Axion-IA Admin"
      : "Devis — Nouveau devis | Axion-IA Admin",
    robots: { index: false, follow: false },
  };
}

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
  /**
   * `clientId` : pré-sélection du client (lien « Créer un devis » depuis /qualiopi/entrees).
   * `projetId` : devis ouvert depuis un projet de ce client (chantier visio, PR 7).
   * `rencontreId` : devis ouvert depuis « Après l'appel » (lien de retour, m-8).
   * `brouillon`, `devis`, `modele`, `venteBrouillonId` (ou `vente`, ancien nom) : réservés à l'assistant (interrupteur allumé).
   */
  searchParams: Promise<{
    clientId?: string;
    projetId?: string;
    rencontreId?: string;
    brouillon?: string;
    devis?: string;
    modele?: string;
    venteBrouillonId?: string;
    vente?: string;
  }>;
}

const JOUR_MS = 86_400_000;
const VALIDITE_PAR_DEFAUT_JOURS = 30;

/** Date du jour à Paris + 30 jours (AAAA-MM-JJ). */
function plusJours(iso: string, n: number): string {
  const [a, m, j] = iso.split("-").map(Number);
  return new Date(Date.UTC(a!, m! - 1, j!) + n * JOUR_MS).toISOString().slice(0, 10);
}

export default async function QualiopiDevisNewPage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix } = await params;
  const sp = await searchParams;
  const acces = await gardePage("ecriture", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }

  // `?devis=` n'est retenu que s'il est un UUID (colonne `@db.Uuid`) : sinon il est ignoré.
  const devisParam = isUuid(sp.devis) ? sp.devis : undefined;
  // Assistant : état BRUT de l'interrupteur (éteint = page d'avant, à l'identique).
  const etatAssistant = await lireInterrupteurQualiopi(LOT_DEVIS_ASSISTANT);
  if (etatAssistant === "eteint" && devisParam !== undefined) {
    // Jamais un DevisForm vide pour un devis existant : sa fiche.
    redirect(`/${locale}/${adminPrefix}/qualiopi/devis/${devisParam}`);
  }
  if (etatAssistant !== "eteint") {
    const session = await auth();
    const adminId = session?.user?.id;
    if (!adminId) redirect(`/${locale}/${adminPrefix}/login`);
    const base = `/${locale}/${adminPrefix}`;
    const basePath = `${base}/qualiopi/devis`;
    // Nom envoyé par « Nouvelle vente » : `venteBrouillonId` ; `vente` reste lu en repli.
    const venteParam = sp.venteBrouillonId ?? sp.vente;
    const ctx = await chargerAssistantDevis({
      adminId,
      role: acces.role,
      ...(sp.brouillon !== undefined ? { brouillonId: sp.brouillon } : {}),
      ...(devisParam !== undefined ? { devisId: devisParam } : {}),
      ...(sp.clientId !== undefined ? { clientId: sp.clientId } : {}),
      ...(sp.projetId !== undefined ? { projetId: sp.projetId } : {}),
      ...(sp.rencontreId !== undefined ? { rencontreId: sp.rencontreId } : {}),
      ...(venteParam !== undefined ? { venteBrouillonId: venteParam } : {}),
      ...(sp.modele !== undefined ? { modele: sp.modele } : {}),
    });

    if ("redirection" in ctx) {
      if (ctx.message === undefined) redirect(`${base}${ctx.redirection}`);
      return (
        <AdminPageShell width="narrow">
          <AdminPageHeader title="Nouveau devis" />
          <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]">
            <p>{ctx.message}</p>
            <Link
              href={`${base}${ctx.redirection}`}
              className="mt-[var(--space-admin-3)] inline-block text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
            >
              {ctx.libelleLien ?? "Ouvrir la fiche du devis"}
            </Link>
          </div>
        </AdminPageShell>
      );
    }

    // « essai » : l'assistant n'agit que sur une fiche d'essai ; sinon la page d'avant.
    const retenu = ctx.payloadInitial.clientId;
    const monter =
      etatAssistant === "actif" ||
      (retenu !== null && ctx.clients.some((c) => c.id === retenu && c.ficheEssai));

    if (monter) {
      // Ceinture : un devis demandé sans brouillon d'assistant lié ne monte JAMAIS l'assistant
      // (le chargeur ne renvoie un contexte pour `?devis=` qu'avec un brouillon lié lisible).
      if (devisParam !== undefined && ctx.brouillon === null) {
        return (
          <AdminPageShell width="narrow">
            <AdminPageHeader title="Nouveau devis" />
            <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]">
              <p>Devis introuvable.</p>
              <Link
                href={basePath}
                className="mt-[var(--space-admin-3)] inline-block text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
              >
                Retour à la liste des devis
              </Link>
            </div>
          </AdminPageShell>
        );
      }

      const aujourdhui = dayKeyInParis(new Date());
      const clientsAssistant = ctx.clients.filter((c) => etatAssistant === "actif" || c.ficheEssai);
      // En-tête « ton dossier » : données déjà chargées (aucune requête de plus).
      const clientChoisi = clientsAssistant.find((c) => c.id === ctx.payloadInitial.clientId);
      return (
        <AdminPageShell width="wide">
          <div className="mb-[var(--space-admin-4)] flex flex-wrap items-center gap-x-[var(--space-admin-4)] gap-y-[var(--space-admin-2)]">
            <Link
              href={basePath}
              className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
            >
              ← Devis
            </Link>
            {isUuid(sp.rencontreId) ? (
              <Link
                href={`${base}/rendez-vous/rencontres/${sp.rencontreId}`}
                className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
              >
                ← Rendez-vous
              </Link>
            ) : null}
          </div>
          <AdminPageHeader
            title="Nouveau devis"
            description="Le numéro est alloué automatiquement (AXI-DEV-AAAA-NNN). La TVA suit le régime configuré."
            meta={
              <>
                {clientChoisi !== undefined ? (
                  <>
                    <AdminBadge tone="neutral">{clientChoisi.raisonSociale}</AdminBadge>
                    <AdminBadge tone="outline">
                      {clientChoisi.type === "particulier" ? "Particulier" : "Professionnel"}
                    </AdminBadge>
                  </>
                ) : null}
              </>
            }
            actions={
              clientChoisi !== undefined ? (
                <AdminButton
                  variant="secondary"
                  size="lg"
                  href={`${base}/qualiopi/clients/${clientChoisi.id}`}
                >
                  Ouvrir la fiche client
                </AdminButton>
              ) : undefined
            }
          />
          <AssistantDevisDiffere
            payloadInitial={ctx.payloadInitial}
            brouillon={ctx.brouillon}
            clients={clientsAssistant}
            offres={ctx.offres.map((o) => ({
              tierId: o.tierId,
              code: o.code,
              titreFr: o.titreFr,
              prixHtCents: o.prixHtCents,
              noteDevisFr: o.noteDevisFr,
            }))}
            textesParDefaut={ctx.textesParDefaut}
            bibliotheque={ctx.bibliotheque}
            tauxStandard={ctx.tauxStandard}
            formulesActives={ctx.formulesActives}
            validiteParDefaut={plusJours(aujourdhui, VALIDITE_PAR_DEFAUT_JOURS)}
            versionCgv={CGV_VERSION_LIBELLE}
            aujourdhui={aujourdhui}
            urlAssistant={`${basePath}/new`}
            baseDevis={basePath}
            modeEssai={etatAssistant === "essai"}
            aide={
              ctx.aide !== null ? (
                <CeQueLeClientADit aide={ctx.aide.aide} projetTitre={ctx.aide.titre} />
              ) : undefined
            }
          />
        </AdminPageShell>
      );
    }
    // Assistant non monté (essai sur une vraie fiche) : un devis existant va à sa fiche,
    // jamais à un DevisForm vide.
    if (devisParam !== undefined) redirect(`${basePath}/${devisParam}`);
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
  // Essai : seulement si le client PRÉSÉLECTIONNÉ est une fiche d'essai (sans client : faux).
  const formulesOn = await formulesActives(undefined, { clientId: defaultClientId ?? null });
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
