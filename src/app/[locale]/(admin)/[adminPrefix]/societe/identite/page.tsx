// Fiche d'identité société — LECTURE SEULE.
//
// Rien n'est saisi ici. Tout vient de `legal_overrides` (SSOT
// `src/lib/legal-identity.ts`) et des réglages Qualiopi, c'est-à-dire des mêmes
// sources que lisent déjà les mentions légales publiques, les factures et les
// documents de formation. Une seconde saisie propre au dossier fournisseur
// aurait produit deux vérités sur le SIREN de la société.
//
// L'écran sert donc à une chose : montrer d'un coup d'œil ce qui est renseigné
// et ce qui ne l'est pas. Un champ vide n'est pas masqué — c'est précisément
// l'information utile avant d'envoyer un dossier à un service achats.

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { SocieteTabs } from "@/components/admin/societe-documents/SocieteTabs";
import { adminPath } from "@/lib/admin-path";
import { resolveLegalIdentity } from "@/lib/legal-identity";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Société — Identité | Axion-IA Admin",
  robots: { index: false, follow: false },
};

const ROLES_LECTURE = new Set(["super_admin", "admin", "editor"]);

interface Champ {
  label: string;
  valeur: string | null;
  /** Ce que l'absence de ce champ empêche concrètement. */
  manque?: string;
}

function Bloc({ titre, champs }: { titre: string; champs: Champ[] }): React.ReactElement {
  return (
    <section className="border-border rounded-lg border bg-[color:var(--color-admin-paper)] p-5">
      <h2 className="text-mocha mb-3 text-sm font-semibold">{titre}</h2>
      <dl className="space-y-2">
        {champs.map((c) => (
          <div key={c.label} className="grid gap-1 sm:grid-cols-[14rem_1fr] sm:gap-4">
            <dt className="text-fg-muted text-xs sm:text-sm">{c.label}</dt>
            <dd className="text-sm">
              {c.valeur ? (
                <span className="text-mocha">{c.valeur}</span>
              ) : (
                <span className="text-[color:var(--color-admin-warning-fg)]">
                  Non renseigné
                  {c.manque ? <span className="text-fg-muted"> — {c.manque}</span> : null}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default async function SocieteIdentitePage({
  params,
}: {
  params: Promise<{ locale: string; adminPrefix: string }>;
}): Promise<React.ReactElement> {
  const { locale, adminPrefix } = await params;

  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || !ROLES_LECTURE.has(role ?? "")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const [legal, of] = await Promise.all([resolveLegalIdentity(), getOrganismeIdentite()]);

  const vide = (v: string | null | undefined): string | null => (v && v.trim() !== "" ? v : null);

  return (
    <>
      <SocieteTabs adminPrefix={adminPrefix} actif="identite" />

      <AdminPageHeader
        title="Identité de la société"
        description="Les valeurs lues depuis les réglages — les mêmes que portent les mentions légales, les factures et les documents de formation. Un champ vide ici est un champ vide partout."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Bloc
          titre="Immatriculation"
          champs={[
            { label: "Dénomination sociale", valeur: vide(legal.legalName) },
            { label: "Forme juridique", valeur: vide(legal.legalForm) },
            {
              label: "Capital social",
              valeur: vide(legal.capitalSocial),
              manque: "mention obligatoire sur les factures (art. R.123-238 C. com.)",
            },
            {
              label: "SIREN",
              valeur: vide(legal.siren),
              manque: "réclamé par toute plateforme de référencement fournisseur",
            },
            { label: "SIRET du siège", valeur: vide(legal.siret) },
            {
              label: "RCS (ville du greffe)",
              valeur: vide(legal.rcsVille),
              manque: "mention obligatoire sur les factures",
            },
            {
              label: "TVA intracommunautaire",
              valeur: vide(legal.vatNumber),
              manque: "obligatoire sur toute facture au-delà de 150 €",
            },
          ]}
        />

        <Bloc
          titre="Siège et contacts"
          champs={[
            { label: "Adresse du siège", valeur: vide(legal.addressSiege) },
            { label: "Code postal", valeur: vide(legal.addressPostalCode) },
            { label: "Ville", valeur: vide(legal.addressCity) },
            { label: "Pays", valeur: vide(legal.addressCountryCode) },
            { label: "Email de contact", valeur: vide(legal.contactEmail) },
            { label: "Téléphone", valeur: vide(legal.contactPhone) },
            { label: "Contact RGPD", valeur: vide(legal.dpoContact) },
          ]}
        />

        <Bloc
          titre="Représentation"
          champs={[
            { label: "Directeur de la publication", valeur: vide(legal.directorName) },
            { label: "Qualité", valeur: vide(legal.directorTitle) },
            {
              label: "Signataire des contrats",
              valeur: vide(legal.representantNom),
              manque: "porté sur les conventions et lettres de mission",
            },
            { label: "Qualité du signataire", valeur: vide(legal.representantQualite) },
          ]}
        />

        <Bloc
          titre="Coordonnées bancaires"
          champs={[
            {
              label: "IBAN",
              valeur: vide(legal.iban),
              manque:
                "le bloc RIB est alors omis des factures, et le dossier achats reste incomplet",
            },
            { label: "BIC", valeur: vide(legal.bic) },
            { label: "Titulaire du compte", valeur: vide(legal.bankAccountHolder) },
            { label: "Banque", valeur: vide(legal.bankName) },
          ]}
        />

        <Bloc
          titre="Organisme de formation"
          champs={[
            {
              label: "N° de déclaration d'activité",
              valeur: vide(of.nda),
              manque: "onze gabarits de documents l'attendent",
            },
            {
              label: "N° de certificat Qualiopi",
              valeur: vide(of.qualiopi),
              manque:
                "sans lui, la catégorie affichée publiquement vient d'un défaut codé en dur, pas d'un certificat",
            },
            { label: "Adresse d'exercice", valeur: vide(of.adresseExercice) },
            { label: "Référent handicap", valeur: vide(of.referentHandicapNom) },
            { label: "Téléphone du référent", valeur: vide(of.referentHandicapTelephone) },
          ]}
        />
      </div>

      <p className="text-fg-muted mt-6 text-sm">
        Pour corriger une de ces valeurs&nbsp;: l&apos;identité légale se saisit dans{" "}
        <a className="text-terracotta underline" href={adminPath("fr", "settings")}>
          Réglages
        </a>{" "}
        (clé <code className="text-xs">legal_overrides</code>), et les champs organisme dans{" "}
        <a className="text-terracotta underline" href={adminPath("fr", "qualiopi/config")}>
          Formations &amp; prestations → Configuration
        </a>
        .
      </p>
    </>
  );
}
