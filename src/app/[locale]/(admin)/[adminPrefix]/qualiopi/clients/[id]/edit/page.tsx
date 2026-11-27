/**
 * Admin — Qualiopi · Édition d'une fiche client.
 *
 * 🔴 Cette page manquait. Il n'existait que `clients/new` et la liste : une fois
 * un client créé, son CONTACT était figé. Or `updateClientAction` acceptait
 * depuis toujours `contactNom`, `contactEmail`, `contactTelephone`,
 * `contactFonction`, `raisonSociale`, `siret`, `nafCode` et `adresse` — seul
 * `ClientBrancheForm` l'appelait, avec trois champs sans rapport (IDCC, taille,
 * OPCO).
 *
 * Conséquence : une faute de frappe sur l'adresse de contact bloquait tout le
 * circuit commercial (`devis.ts` refuse d'émettre un lien de signature sans
 * `contactEmail`) sans aucun moyen de la corriger depuis l'interface.
 *
 * Server Component — auth + redirect, force-dynamic, noindex.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import { AlertTriangle, Building2, CheckCircle2, Mail, MapPin, User } from "lucide-react";

import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { AdminBlocRepliable } from "@/components/admin/ui/AdminBlocRepliable";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { lireMessageDeRetour } from "@/features/dossier-client/message-de-retour";
import { ChangerTypeClient } from "@/components/admin/qualiopi/ChangerTypeClient";
import { ClientEditForm } from "@/components/admin/qualiopi/ClientEditForm";
import { titreOngletClient, libelleBlocBranche } from "@/server/qualiopi/crm/libelles-fiche-client";
import { getClient } from "@/server/qualiopi/crm/clients";
import { raisonBlocageChangementType } from "@/server/qualiopi/crm/changer-type-client";
import { prisma } from "@/lib/prisma";
import { lireApercuCrmPro } from "@/server/crm-sync/lire-apercu";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { profilDeLaFiche } from "@/components/admin/dossier-client/fiche/ProfilDeLaFiche";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";
// Avant la certification, le titre n'emploie pas le mot « Qualiopi ».
export function generateMetadata(): Metadata {
  return {
    title: titreOngletClient("Modifier un client"),
    robots: { index: false, follow: false },
  };
}

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string; id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ModifierClientPage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix, id } = await params;
  const sp = (await searchParams) ?? {};
  const erreurType = lireMessageDeRetour(sp, "erreur");
  const messageType = lireMessageDeRetour(sp, "message");
  const acces = await gardePage("ecriture", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }

  const client = await getClient(id);
  if (!client) notFound();

  const blocageType = await raisonBlocageChangementType(prisma, client).catch(() => null);

  // Ce que « Passer en entreprise » enverra au CRM Pro : même lecture et mêmes fonctions que
  // l'envoi, posées comme si la fiche était une entreprise. Lecture seule. Particulier seulement.
  const apercuCrm =
    client.type === "particulier" && blocageType === null
      ? await lireApercuCrmPro(id).catch(() => null)
      : null;

  const base = `/${locale}/${adminPrefix}/qualiopi/clients`;
  // Retour à la FICHE du client (et non à la liste) : on vient de la fiche.
  const ficheHref = `/${locale}/${adminPrefix}/qualiopi/clients/${id}`;

  return (
    <AdminPageShell width="narrow">
      <div className="mb-[var(--space-admin-4)]">
        <Link
          href={ficheHref}
          className="inline-flex min-h-[var(--target-admin-min-desktop)] items-center text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
        >
          ← {client.raisonSociale}
        </Link>
      </div>

      <AdminPageHeader title={`Modifier ${client.raisonSociale}`} description={client.numero} />

      {/* Chiffres clés : calculés sur la fiche déjà chargée, aucune requête de plus. */}
      <div className="mb-[var(--space-admin-6)] grid gap-[var(--space-admin-4)] sm:grid-cols-2 lg:grid-cols-4">
        <AdminStatCard
          label="Type de fiche"
          value={client.type === "particulier" ? "Particulier" : "Entreprise"}
          icon={client.type === "particulier" ? User : Building2}
          tone="info"
        />
        <AdminStatCard
          label="SIRET"
          value={
            client.type === "particulier"
              ? "Sans objet"
              : client.siret
                ? "Renseigné"
                : "À compléter"
          }
          icon={client.type === "particulier" ? User : client.siret ? CheckCircle2 : AlertTriangle}
          tone={client.type === "particulier" ? "default" : client.siret ? "success" : "warning"}
        />
        <AdminStatCard
          label="E-mail de contact"
          value={client.contactEmail ? "Renseigné" : "Manquant"}
          icon={client.contactEmail ? Mail : AlertTriangle}
          tone={client.contactEmail ? "success" : "warning"}
        />
        <AdminStatCard
          label="Adresse"
          value={client.adresseRue && client.adresseVille ? "Complète" : "À compléter"}
          icon={MapPin}
          tone={client.adresseRue && client.adresseVille ? "success" : "warning"}
        />
      </div>

      <AdminBlocRepliable titre="À savoir avant de modifier" className="mb-[var(--space-admin-6)]">
        <p className="text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg-soft)]">
          Entreprise, adresse, contact et facturation. La branche (IDCC, effectif) se modifie sur la
          fiche, bloc « {libelleBlocBranche()} ».
        </p>
      </AdminBlocRepliable>

      {erreurType !== null ? (
        <div
          role="alert"
          className="mb-[var(--space-admin-4)] flex items-start gap-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border border-l-4 border-[color:var(--color-admin-border)] border-l-[color:var(--color-admin-destructive)] bg-[color:var(--color-admin-destructive-soft)] p-[var(--space-admin-5)] text-[length:var(--text-admin-base)] font-medium text-[color:var(--color-admin-destructive-fg)]"
        >
          <AlertTriangle size={20} aria-hidden="true" className="mt-[2px] shrink-0" />
          <p>{erreurType}</p>
        </div>
      ) : null}
      {messageType !== null ? (
        <div
          role="status"
          className="mb-[var(--space-admin-4)] flex items-start gap-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border border-l-4 border-[color:var(--color-admin-border)] border-l-[color:var(--color-admin-success)] bg-[color:var(--color-admin-success-soft)] p-[var(--space-admin-5)] text-[length:var(--text-admin-base)] font-medium text-[color:var(--color-admin-success-fg)]"
        >
          <CheckCircle2 size={20} aria-hidden="true" className="mt-[2px] shrink-0" />
          <p>{messageType}</p>
        </div>
      ) : null}
      <ChangerTypeClient
        clientId={client.id}
        type={client.type === "particulier" ? "particulier" : "entreprise"}
        contactNom={client.contactNom}
        raisonSociale={client.raisonSociale}
        blocage={blocageType}
        apercu={apercuCrm}
      />

      <ClientEditForm
        clientId={client.id}
        estParticulier={client.type === "particulier"}
        retourHref={base}
        initial={{
          raisonSociale: client.raisonSociale,
          // `?? ""` partout : le formulaire travaille en chaînes et compare au
          // trim pour décider quoi transmettre. Un `null` rendu tel quel dans un
          // input le rendrait non contrôlé.
          siret: client.siret ?? "",
          tvaIntracom: client.tvaIntracom ?? "",
          nafCode: client.nafCode ?? "",
          secteur: client.secteur ?? "",
          source: client.source ?? "",
          adresseRue: client.adresseRue ?? "",
          adresseCodePostal: client.adresseCodePostal ?? "",
          adresseVille: client.adresseVille ?? "",
          contactNom: client.contactNom ?? "",
          contactEmail: client.contactEmail ?? "",
          contactTelephone: client.contactTelephone ?? "",
          contactFonction: client.contactFonction ?? "",
          contactCivilite: client.contactCivilite ?? "",
          contactPrenom: client.contactPrenom ?? "",
          contactNomFamille: client.contactNomFamille ?? "",
          delaiPaiementJours: client.delaiPaiementJours?.toString() ?? "",
          tauxAcomptePct: client.tauxAcomptePct?.toString() ?? "",
          modeFacturation: client.modeFacturation ?? "",
        }}
        lecture={{
          siren: client.siren,
          effectif: client.effectif,
          estPublic: client.estPublic,
          adresseHistorique: client.adresse,
          brancheHref: `${ficheHref}?onglet=resume`,
          brancheLibelle: libelleBlocBranche(),
        }}
        initialFlags={{ penalitesRetardActives: client.penalitesRetardActives }}
      />

      {/* EMPLACEMENT:MODIFIER-PROFIL (lot B6) */}
      {await profilDeLaFiche(id)}
    </AdminPageShell>
  );
}
