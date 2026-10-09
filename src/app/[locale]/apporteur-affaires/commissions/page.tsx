// `/fr/apporteur-affaires/commissions` — ancienne adresse PUBLIQUE de la grille de référence.
//
// 🔒 Depuis le 2026-10-09 (décision de Will, transmise par a1), la grille est RÉSERVÉE AUX
// APPORTEURS : elle ne s'ouvre que depuis leur lien personnel
// (`/apporteur/dossier/<id>/<jeton>/commissions`). Cette adresse reste servie, pour ne pas
// briser un lien déjà partagé, mais n'affiche qu'un message sobre : AUCUN chiffre, aucun
// pourcentage, aucun montant (verrouillé par `la-grille-publique-n-affiche-aucun-chiffre.spec.tsx`).
// `noindex`, hors sitemap.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";

import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { TunnelFacebookShell } from "@/components/recrutement/TunnelFacebookShell";
import { GRILLE_RESERVEE } from "@/features/apporteurs-reseau/grille-reservee";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return {
    title: { absolute: "Grille de référence des commissions — Axion-IA" },
    description: GRILLE_RESERVEE.titre,
    robots: { index: false, follow: false },
  };
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale as Locale);
  return (
    <TunnelFacebookShell sousTitre="Apporteurs d'affaires">
      <Section tone="halo-warm" className="pt-10 pb-16 sm:pt-14 sm:pb-20">
        <div className="mx-auto max-w-2xl">
          <h1 className="display-editorial text-fg text-balance">{GRILLE_RESERVEE.titre}</h1>
          <p className="text-fg-soft mt-4 text-lg leading-relaxed">{GRILLE_RESERVEE.texte}</p>
          <a
            href={`/${locale}/apporteur-affaires`}
            className="text-terracotta-deep mt-6 inline-flex min-h-[48px] items-center gap-2 text-[17px] font-bold underline underline-offset-4"
          >
            {GRILLE_RESERVEE.lien}
          </a>
        </div>
      </Section>
    </TunnelFacebookShell>
  );
}
