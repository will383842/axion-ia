/**
 * Page /avis/deposer — formulaire public de dépôt d'un avis client.
 *
 * L'avis est créé en `status = "pending"` et n'apparaît nulle part tant qu'un
 * admin ne l'a pas validé en console. Full server component ; seul le formulaire
 * (`ReviewSubmissionForm`) est un client component (note, upload, Turnstile).
 *
 * JSON-LD : WebPage (publisher Organization + speakable). Lien retour vers /avis.
 */

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ShieldCheck, Star, MessageSquareReply } from "lucide-react";
import { routing } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { Link } from "@/i18n/navigation";
import { ReviewSubmissionForm } from "@/components/forms/ReviewSubmissionForm";
import { buildProductMetadata, buildWebPageJsonLd, SITE_EDITORIAL_DATE } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export const revalidate = 86400;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: "/avis/deposer",
    title: "Déposer un avis client · Axion-IA",
    description:
      "Partagez votre retour d'expérience sur Axion-IA. Chaque avis est vérifié par notre équipe avant publication (authenticité contrôlée, conforme RGPD).",
    alternates: { fr: "/avis/deposer", en: "/avis/deposer" },
  });
}

export default async function DeposerAvisPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const webPageJsonLd = buildWebPageJsonLd({
    locale,
    path: "/avis/deposer",
    name: "Déposer un avis client · Axion-IA",
    description: "Formulaire de dépôt d'un avis client Axion-IA, vérifié avant publication (RGPD).",
    dateModified: SITE_EDITORIAL_DATE,
    speakable: true,
  });

  const steps = [
    {
      icon: Star,
      title: "1. Votre note & votre avis",
      body: "Attribuez une note sur 5 et décrivez votre expérience (contexte, résultats).",
    },
    {
      icon: ShieldCheck,
      title: "2. Vérification",
      body: "Notre équipe contrôle l'authenticité de chaque avis avant toute mise en ligne.",
    },
    {
      icon: MessageSquareReply,
      title: "3. Publication & réponse",
      body: "Une fois validé, votre avis est publié — et nous pouvons y répondre publiquement.",
    },
  ];

  return (
    <>
      <JsonLd data={webPageJsonLd} />
      <Section
        eyebrow="Avis clients"
        title="Déposer un"
        titleEm="avis"
        titleAs="h1"
        tone="halo-warm"
        description="Votre retour compte. Partagez votre expérience avec Axion-IA — chaque avis est vérifié avant publication."
      >
        <Breadcrumbs
          items={[
            { href: "/avis", label: "Avis clients" },
            { href: "/avis/deposer", label: "Déposer un avis" },
          ]}
        />
      </Section>

      <Section tone="canvas">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-14">
          <aside className="space-y-6">
            <h2 className="font-serif text-2xl font-semibold">Comment ça marche</h2>
            <ol className="space-y-5">
              {steps.map((s) => (
                <li key={s.title} className="flex gap-3">
                  <s.icon
                    aria-hidden="true"
                    className="text-terracotta mt-0.5 h-6 w-6 flex-shrink-0"
                    strokeWidth={1.75}
                  />
                  <div>
                    <p className="text-fg font-medium">{s.title}</p>
                    <p className="text-fg-soft text-sm">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="text-fg-muted text-sm">
              Nous publions les avis positifs comme négatifs. Voir{" "}
              <Link href="/avis" className="text-primary underline">
                tous les avis clients
              </Link>
              .
            </p>
          </aside>
          <div>
            <ReviewSubmissionForm />
          </div>
        </div>
      </Section>
    </>
  );
}
