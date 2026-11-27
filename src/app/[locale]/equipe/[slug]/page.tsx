/**
 * Route publique équipe — fiche auteur / fiche fondateur.
 *
 * Deux régimes derrière une seule route :
 *
 *  - `slug === "williams"` → fiche d'AUTORITÉ D'ENTITÉ du fondateur, servie
 *    depuis des définitions statiques (`content/equipe/williams.ts` +
 *    `lib/seo/williams-person.ts`), rendue par le gabarit unique
 *    `<ProfilCollaborateur>` (via `ficheDepuisWilliams()`). Elle ne
 *    dépend d'aucun seed : la page et l'entité `Person` fonctionnent dès le
 *    déploiement, y compris quand le build tourne sur la base stub.
 *  - sinon, ordre de résolution (`resoudreFicheEquipe`) : `TeamMember` publié (gabarit
 *    `<ProfilCollaborateur>`, prénom seul, consentements respectés), puis `AuthorProfile`
 *    actif (ex. Manon, persona éditoriale IA, gabarit minimal historique). Sinon 404.
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
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { JsonLd } from "@/components/marketing/JsonLd";
import { JsonLdGraph } from "@/components/marketing/JsonLdGraph";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { SITE_URL, buildProductMetadata } from "@/lib/seo";
import { FOUNDER } from "@/lib/brand";
import { WILLIAMS_FONCTION } from "@/content/equipe/williams";
import { buildPersonManonJsonLd } from "@/lib/seo-content-gen-factories";
import { buildGrapheCollaborateur } from "@/lib/seo/collaborateur-jsonld";
import { ProfilCollaborateur } from "@/components/equipe/ProfilCollaborateur";
import { estIndexable, fichePublique, ficheDepuisWilliams } from "@/lib/equipe";
import { LIBELLE_PLUME_IA, SLUG_PLUME_IA } from "@/lib/seo/plume-ia";
import { resoudreFicheEquipe } from "@/lib/equipe/collaborateurs";
import { ficheDepuisMembre } from "@/lib/equipe/depuis-membre";
import { evaluerIndexabilite } from "@/lib/equipe/donnees/indexabilite";
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
    const { contenu } = ficheDepuisWilliams();
    const meta = await buildProductMetadata({
      locale,
      path: `/equipe/williams`,
      title: contenu.titreSeo,
      description: contenu.metaDescription,
      alternates: { fr: `/equipe/williams` },
      ogEyebrow: WILLIAMS_FONCTION,
    });
    // 🔑 Titre ABSOLU : le titre SEO est écrit tel quel, sans le suffixe « · Axion-IA » du
    // gabarit racine. Image de partage : le portrait (`/api/og/equipe-williams`), pour ce
    // slug seulement ; les autres fiches gardent la carte générique `/api/og`.
    const imageWilliams = {
      url: `${SITE_URL}/api/og/equipe-williams`,
      width: 1200,
      height: 630,
      alt: `${FOUNDER.fullName}, ${WILLIAMS_FONCTION}`,
    };
    return {
      ...meta,
      title: { absolute: contenu.titreSeo },
      openGraph: { ...meta.openGraph, images: [imageWilliams] },
      twitter: { ...meta.twitter, images: [imageWilliams] } as Metadata["twitter"],
    };
  }

  const resolu = await resoudreFicheEquipe(slug);
  if (!resolu || resolu.type === "williams") return { robots: "noindex, nofollow" };

  if (resolu.type === "membre") {
    const { fiche, contenu } = ficheDepuisMembre(resolu.membre);
    const publique = fichePublique(fiche);
    if (!publique || publique.slug !== fiche.slug) return { robots: "noindex, nofollow" };
    const meta = await buildProductMetadata({
      locale,
      path: `/equipe/${publique.slug}`,
      title: contenu.titreSeo,
      description: contenu.metaDescription,
      alternates: { fr: `/equipe/${publique.slug}` },
    });
    // Indexée seulement si la règle d'indexation est satisfaite ; sinon visible mais `noindex, follow`.
    return {
      ...meta,
      robots: evaluerIndexabilite(resolu.membre).indexable
        ? meta.robots
        : { index: false, follow: true },
    };
  }

  const profile = resolu.profil;
  const libelleAuteur = profile.slug === SLUG_PLUME_IA ? LIBELLE_PLUME_IA : profile.jobTitle;
  return buildProductMetadata({
    locale,
    path: `/equipe/${slug}`,
    title: `${profile.displayName} · ${libelleAuteur} · Axion-IA`,
    description:
      profile.personaDisclaimer ??
      `${profile.displayName}, ${libelleAuteur}. Persona éditoriale transparente — portrait IA disclosed (doctrine v2.1).`,
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
  // mélanger les deux gabarits obligeait à le traiter comme un
  // `AuthorProfile` dégradé — c'est ce qui avait fini par lui donner la même
  // page pauvre qu'une persona.
  if (slug === "williams") {
    // Les deux drapeaux, pas un seul : la visibilité des pages OF **et** la
    // certification réelle conditionnent les Q/R de financement de la FAQ.
    const financementPublic =
      isQualiopiPublicDisclosureEnabled() && isQualiopiCertificationObtenue();
    const { fiche, contenu } = ficheDepuisWilliams({ financementPublic });
    const publique = fichePublique(fiche);
    if (!publique) notFound();

    return (
      <>
        {/*
          Un seul `<script>` `@graph` : Person (l'entité, déléguée à
          `williams-person.ts`), ProfilePage, BreadcrumbList (Accueil > Équipe >
          Williams Jullin) et FAQPage. `<Breadcrumbs>` reçoit donc
          `emitJsonLd={false}`. Rendu `inline` : les crawlers de LLM
          n'exécutent pas tous le JS, et c'est eux qu'on vise.
        */}
        <JsonLdGraph
          schemas={buildGrapheCollaborateur(publique, contenu, { indexable: estIndexable(fiche) })}
        />
        <Container className="border-border border-b py-3">
          <Breadcrumbs
            emitJsonLd={false}
            items={[
              { href: "/equipe", label: "Équipe" },
              { href: `/equipe/williams`, label: publique.nom },
            ]}
          />
        </Container>
        <ProfilCollaborateur fiche={publique} contenu={contenu} />
      </>
    );
  }

  const resolu = await resoudreFicheEquipe(slug);
  if (!resolu) notFound();

  // ── Collaborateur publié en base ───────────────────────────────────────
  if (resolu.type === "membre") {
    const { fiche, contenu } = ficheDepuisMembre(resolu.membre);
    const publique = fichePublique(fiche);
    if (!publique || publique.slug !== fiche.slug) notFound();
    const { indexable } = evaluerIndexabilite(resolu.membre);
    return (
      <>
        <JsonLdGraph schemas={buildGrapheCollaborateur(publique, contenu, { indexable })} />
        <Container className="border-border border-b py-3">
          <Breadcrumbs
            emitJsonLd={false}
            items={[
              { href: "/equipe", label: "Équipe" },
              { href: `/equipe/${publique.slug}`, label: publique.nom },
            ]}
          />
        </Container>
        <ProfilCollaborateur fiche={publique} contenu={contenu} />
      </>
    );
  }

  // ── Fiches persona / auteurs en base ───────────────────────────────────
  if (resolu.type !== "auteur") notFound();
  const profile = resolu.profil;

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
              <strong>
                {profile.slug === SLUG_PLUME_IA ? LIBELLE_PLUME_IA : profile.jobTitle}
              </strong>
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
