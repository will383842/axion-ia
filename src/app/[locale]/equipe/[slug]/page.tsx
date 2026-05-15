/**
 * Route publique équipe — fiche auteur (Sprint 6 audit correctif).
 *
 * Lit `AuthorProfile` depuis Prisma (slug=manon en V1). Render bio markdown,
 * photo 1024 + sources alternatives 256/80 pour srcset, JSON-LD Person via
 * `buildPersonManonJsonLd()` (doctrine v2.1 — IA disclosed + zéro réseau social).
 *
 * Anti-doorway HCU 2024 : la page n'agrège pas de listes — chaque slug = page
 * dédiée avec contenu unique (bio Markdown édité depuis admin /content-gen/author/manon).
 *
 * FR uniquement (doctrine content-gen v1.2). Si locale != fr → 404.
 */

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { prisma } from "@/lib/prisma";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { JsonLd } from "@/components/marketing/JsonLd";
import { buildProductMetadata } from "@/lib/seo";
import { buildPersonManonJsonLd } from "@/lib/seo-content-gen-factories";

// ISR 24h : bio Manon ne change quasiment jamais (édition via admin
// /content-gen/author/manon) → cache CDN agressif justifié. `force-dynamic`
// retiré (audit Web Vitals 2026-05-15 — annulait silencieusement le cache).
export const revalidate = 86400;
export const dynamicParams = true;

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  if (locale !== "fr") return {};

  const profile = await prisma.authorProfile.findUnique({ where: { slug } });
  if (!profile || !profile.isActive) return { robots: "noindex, nofollow" };

  return buildProductMetadata({
    locale,
    path: `/equipe/${slug}`,
    title: `${profile.displayName} · ${profile.jobTitle} · Axion-IA`,
    description:
      profile.personaDisclaimer ??
      `${profile.displayName}, ${profile.jobTitle} chez Axion-IA. Persona éditoriale transparente — portrait IA disclosed (doctrine v2.1).`,
    alternates: { fr: `/equipe/${slug}` },
  });
}

function renderBioMd(md: string): string {
  // V1 minimal Markdown→HTML : paragraphes + gras + liens. Tiptap renderer V1.5+.
  // Cette page n'expose pas le bio à l'utilisateur final via HTML brut — on
  // découpe simplement en paragraphes pour préserver structure éditoriale.
  return md
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p) => `<p>${p.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}</p>`)
    .join("");
}

export default async function PublicAuthorPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  if (locale !== "fr") notFound();
  setRequestLocale(locale as Locale);

  const profile = await prisma.authorProfile.findUnique({ where: { slug } });
  if (!profile || !profile.isActive) notFound();

  // V1 : JSON-LD Person seulement pour Manon (factory guard slug==='manon').
  // V2 : extension multi-auteurs avec factory générique si Will ajoute un 2ᵉ
  // auteur canonique. Pour les autres slugs on omet le JSON-LD (anti-fuite).
  const personJsonLd = profile.slug === "manon" ? buildPersonManonJsonLd(profile) : null;

  return (
    <>
      {personJsonLd ? <JsonLd data={personJsonLd} /> : null}
      <Section>
        <Container>
          <header style={{ marginBottom: 32 }}>
            <h1>{profile.displayName}</h1>
            <p>
              <strong>{profile.jobTitle}</strong>
            </p>
            {profile.isPersona && profile.aiGenerated ? (
              <p
                style={{
                  marginTop: 16,
                  padding: 12,
                  background: "var(--color-sand)",
                  borderLeft: "4px solid var(--color-terracotta)",
                  fontSize: 14,
                }}
              >
                <strong>Transparence IA</strong> —{" "}
                {profile.personaDisclaimer ??
                  `${profile.displayName} est une persona éditoriale Axion-IA. Le portrait associé est généré par IA. Les contenus signés sont supervisés par l'équipe Axion-IA.`}
              </p>
            ) : null}
          </header>

          <figure style={{ margin: "0 0 32px", maxWidth: 420 }}>
            <img
              src={profile.photoUrl1024}
              srcSet={`${profile.photoUrl256} 256w, ${profile.photoUrl1024} 1024w`}
              sizes="(max-width: 640px) 100vw, 420px"
              alt={profile.photoAlt ?? `${profile.displayName} — portrait éditorial Axion-IA`}
              width={420}
              height={420}
              style={{ width: "100%", height: "auto", borderRadius: 8 }}
            />
          </figure>

          <article dangerouslySetInnerHTML={{ __html: renderBioMd(profile.bioMd) }} />

          {profile.knowsAbout.length > 0 ? (
            <section style={{ marginTop: 32 }}>
              <h2>Domaines d&apos;expertise</h2>
              <ul>
                {profile.knowsAbout.map((domain) => (
                  <li key={domain}>{domain}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </Container>
      </Section>
    </>
  );
}
