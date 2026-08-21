/**
 * Route publique équipe — fiche auteur / fiche fondateur.
 *
 * Deux régimes derrière une seule route :
 *
 *  - `slug === "williams"` → fiche d'AUTORITÉ D'ENTITÉ du fondateur, servie
 *    depuis des définitions statiques (`content/equipe/williams.ts` +
 *    `lib/seo/williams-person.ts`), rendue par `<FounderProfile>`. Elle ne
 *    dépend d'aucun seed : la page et l'entité `Person` fonctionnent dès le
 *    déploiement, y compris quand le build tourne sur la base stub.
 *  - tout autre slug → `AuthorProfile` en DB (ex. Manon, persona éditoriale IA),
 *    rendu par le gabarit minimal historique.
 *
 * Anti-doorway HCU 2024 : la page n'agrège pas de listes — chaque slug = page
 * dédiée avec contenu unique.
 *
 * FR uniquement (doctrine content-gen v1.2). Si locale != fr → 404.
 */

import type { Metadata } from "next";
import Image from "next/image";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { prisma } from "@/lib/prisma";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { JsonLd } from "@/components/marketing/JsonLd";
import { JsonLdGraph } from "@/components/marketing/JsonLdGraph";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { buildProductMetadata, buildFaqJsonLd, buildBreadcrumbJsonLd } from "@/lib/seo";
import { buildPersonManonJsonLd } from "@/lib/seo-content-gen-factories";
import {
  buildPersonWilliamsJsonLd,
  buildProfilePageWilliamsJsonLd,
} from "@/lib/seo/williams-person";
import { FounderProfile } from "@/components/sections/FounderProfile";
import { buildWilliamsFaq, WILLIAMS_REVISION_DATE } from "@/content/equipe/williams";
import { FOUNDER, FOUNDER_PERSON_ID } from "@/lib/brand";
// Doctrine financement : les Q/R OPCO / France Travail ne sont émises que si la
// certification Qualiopi est RÉELLEMENT obtenue. Le drapeau est la garde
// primaire — cf. `server/qualiopi/config/flag.ts`.
import {
  isQualiopiCertificationObtenue,
  isQualiopiPublicDisclosureEnabled,
} from "@/server/qualiopi/config/flag";

// ISR 24h : la fiche fondateur est statique et la bio Manon ne change quasiment
// jamais (édition via admin /content-gen/author/manon) → cache CDN agressif
// justifié. `force-dynamic` retiré (audit Web Vitals 2026-05-15 — annulait
// silencieusement le cache).
export const revalidate = 86400;
export const dynamicParams = true;

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  if (locale !== "fr") return {};

  // Williams = fiche fondateur statique (vraie personne, pas une persona DB).
  if (slug === "williams") {
    return buildProductMetadata({
      locale,
      path: `/equipe/williams`,
      // Le titre porte la marque : `buildProductMetadata` bascule alors en
      // `{ absolute }` et n'appose pas une seconde fois « · Axion-IA ».
      title: `${FOUNDER.fullName} — fondateur d'Axion-IA, expert IA en entreprise`,
      description:
        "Williams Jullin, fondateur et CEO d'Axion-IA, agence IA opérationnelle basée à Grenoble : audit, formation, coaching et implémentation IA partout en France.",
      alternates: { fr: `/equipe/williams` },
      ogEyebrow: "Fondateur & CEO",
    });
  }

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

  // ── Fiche fondateur ────────────────────────────────────────────────────
  //
  // Séparée du chemin DB dès le début : elle n'a aucune requête à faire, et
  // mélanger les deux gabarits obligeait à traiter `WILLIAMS_PROFILE` comme un
  // `AuthorProfile` dégradé — c'est ce qui avait fini par lui donner la même
  // page pauvre qu'une persona.
  if (slug === "williams") {
    // Les deux drapeaux, pas un seul : `/financement-opco-france-travail`
    // exige la visibilité des pages OF **et** la certification réelle pour
    // répondre autre chose qu'un 404.
    const financementPublic =
      isQualiopiPublicDisclosureEnabled() && isQualiopiCertificationObtenue();
    const faq = buildWilliamsFaq({ certificationObtenue: financementPublic });

    return (
      <>
        {/*
          Un seul `<script>` `@graph` plutôt que quatre balises : Person
          (l'entité), ProfilePage (le type qui dit « cette URL EST la page de
          cette personne »), FAQPage et BreadcrumbList — `<Breadcrumbs>` reçoit
          donc `emitJsonLd={false}` plus bas. Rendu `inline` volontairement :
          les crawlers de LLM n'exécutent pas tous le JS, et c'est précisément
          eux qu'on vise ici.
        */}
        <JsonLdGraph
          schemas={[
            buildPersonWilliamsJsonLd(locale),
            buildProfilePageWilliamsJsonLd(),
            buildFaqJsonLd({
              items: faq.map((item) => ({ question: item.question, answer: item.answer })),
              // La FAQ d'une fiche fondateur est signée du fondateur — pas de
              // la persona éditoriale IA, qui est le défaut du helper.
              authorId: FOUNDER_PERSON_ID,
              dateModified: WILLIAMS_REVISION_DATE,
            }) as unknown as Record<string, unknown>,
            buildBreadcrumbJsonLd({
              locale: "fr",
              items: [
                { name: "Accueil", href: "/" },
                { name: FOUNDER.fullName, href: FOUNDER.pagePath },
              ],
            }) as unknown as Record<string, unknown>,
          ]}
        />
        <Container className="border-border border-b py-3">
          {/* `emitJsonLd={false}` : le BreadcrumbList est déjà dans le `@graph`
              unique ci-dessus — deux fois le même fil d'Ariane ne le rend pas
              plus vrai, seulement plus lourd à parser. */}
          <Breadcrumbs
            emitJsonLd={false}
            items={[{ href: `/equipe/williams`, label: FOUNDER.fullName }]}
          />
        </Container>
        <FounderProfile faq={faq} financementPublic={financementPublic} />
      </>
    );
  }

  // ── Fiches persona / auteurs en base ───────────────────────────────────
  const profile = await prisma.authorProfile.findUnique({ where: { slug } });
  if (!profile || !profile.isActive) notFound();

  const personJsonLd = profile.slug === "manon" ? buildPersonManonJsonLd(profile) : null;

  return (
    <>
      {personJsonLd ? <JsonLd data={personJsonLd} /> : null}
      {/* VIS / E-E-A-T — fil d'ariane (+ BreadcrumbList JSON-LD) : la fiche
          auteur était la seule page détail sans breadcrumb. Niveau unique
          (Accueil > Auteur) car il n'existe pas d'index /equipe. */}
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={[{ href: `/equipe/${slug}`, label: profile.displayName }]} />
      </Container>
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
                {/* 🔴 Vérification E2E 2026-07-26 — ce repli promettait que les
                    contenus « sont supervisés par l'équipe », alors que le
                    worker publie automatiquement tous les types de contenu sans
                    relecture humaine. Même correction que sur le bandeau IA,
                    /fr/transparence et la charte éditoriale. */}
                {profile.personaDisclaimer ??
                  `${profile.displayName} est une persona éditoriale Axion-IA. Le portrait associé est généré par IA. Les contenus signés sont produits par IA générative et contrôlés automatiquement avant publication.`}
              </p>
            ) : null}
          </header>

          <figure style={{ margin: "0 0 32px", maxWidth: 420 }}>
            {/* V-04 P2 (Sprint Correctif suite 2026-05-22) — portrait above-the-fold
                = LCP candidate, priority + fetchpriority=high obligatoires. */}
            <Image
              src={profile.photoUrl1024}
              alt={profile.photoAlt ?? `${profile.displayName} — portrait éditorial Axion-IA`}
              width={420}
              height={420}
              sizes="(max-width: 640px) 100vw, 420px"
              priority
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
