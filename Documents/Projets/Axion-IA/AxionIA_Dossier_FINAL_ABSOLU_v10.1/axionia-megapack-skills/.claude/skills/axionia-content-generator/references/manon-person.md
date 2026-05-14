# Manon — Person JSON-LD canonique (v2.1 — persona transparente + portrait IA disclosed + zéro réseau social)

> Auteur de chaque contenu généré. Cf. § 9.8 master prompt pour détails complets.
> **Doctrine v2.1 (Will 2026-05-14) :**
> - **v2.0** : Manon = persona éditoriale fictive transparente, pas de fake profil
> - **v2.1** : Photo retenue = **Option 4 « Portrait IA disclosed »** (visage féminin synthétique, transparence IA forte). **AUCUN réseau social** : `linkedinUrl: null`, `twitterHandle: null`, balise `twitter:creator` TOUJOURS omise. Q13 résolu : photo `/auteurs/manon.png` + bio validée OK tel quel.

## URL canonique

`https://axion-ia.com/fr/equipe/manon` (page indexable tier-1, à créer Sprint 3)

## Template JSON-LD Person v2.1

```jsonld
{
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": "https://axion-ia.com/fr/equipe/manon#person",
  "name": "Manon",
  "givenName": "Manon",
  "jobTitle": "Plume éditoriale d'Axion-IA",
  "url": "https://axion-ia.com/fr/equipe/manon",
  "image": {
    "@type": "ImageObject",
    "url": "https://axion-ia.com/auteurs/manon.png",
    "width": 1024,
    "height": 1024,
    "caption": "Manon — portrait synthétique généré par IA, plume éditoriale fictive d'Axion-IA"
  },
  "description": "Manon est la plume éditoriale d'Axion-IA — persona éditoriale fictive transparente sous laquelle signe notre équipe de rédaction et notre processus de production IA supervisé. Son portrait visuel est une illustration générée par IA. Tous les contenus tier-1 sont validés par notre relecture humaine avant publication.",
  "knowsAbout": [
    "Intelligence artificielle opérationnelle",
    "Audit IA en entreprise",
    "Transformation digitale TPE PME ETI",
    "Implémentation IA custom",
    "AEO et SEO 2026",
    "Automatisation des processus métiers",
    "Méthodologie Axion-IA",
    "Conduite du changement IA"
  ],
  "knowsLanguage": ["fr-FR"],
  "worksFor": {
    "@id": "https://axion-ia.com/#organization"
  }
}
```

**Doctrine v2.1 — Ce qui est exclu** :
- ❌ Pas de `sameAs[]` (aucun LinkedIn, Twitter, Bluesky, Wikidata — Manon n'a AUCUN réseau social)
- ❌ Pas de `alumniOf`, `award[]` (persona fictive)
- ❌ Pas de balise `<meta name="twitter:creator">` dans le HTML (TOUJOURS omise)
- ✅ `description` inclut le disclaimer transparent + mention IA
- ✅ `worksFor` pointe vers Organization Axion-IA (vraie entité estonienne — signal d'autorité collectif)
- ✅ `image.caption` mentionne explicitement « portrait synthétique généré par IA »

## Photo — Option 4 « Portrait IA disclosed » (Will 2026-05-14)

- **Source unique** : `axionia/public/auteurs/manon.png` (1.5 MB, 1024×1024 PNG, IA générée)
- **Variantes runtime** : Next/image génère AVIF/WebP au runtime via `<Image>` (config `next.config.ts` `images.formats: ['image/avif', 'image/webp']`)
- **`aiGenerated: true`** dans `AuthorProfile` (nouvelle colonne v2.1)
- **`photoAlt`** canonique : `« Manon — portrait synthétique généré par IA, plume éditoriale fictive d'Axion-IA »`

### Disclaimers IA OBLIGATOIRES (à appliquer partout côté code)

1. **Alt text** sur chaque `<img>` ou `<Image>` Manon : `« Manon — portrait synthétique généré par IA, plume éditoriale fictive d'Axion-IA »`
2. **Caption visible** sous la photo sur `/fr/equipe/manon` : `« Illustration générée par IA. Manon est une persona éditoriale ; sous ce nom signe notre équipe + processus IA supervisé. »`
3. **Person JSON-LD `description`** : reprend disclaimer + mention IA (cf. template ci-dessus)
4. **AuthorByline tooltip** : `« Voir notre processus éditorial »` → menu déroulant disclaimer
5. **Meta optionnelle** : `<meta name="ai-generated-image" content="true">` sur la page auteur (proposé spec 2026, non standard)

## Byline HTML (haut article)

```html
<header class="article-byline">
  <a href="/fr/equipe/manon" rel="author" class="byline-link">
    <img
      src="/auteurs/manon.png"
      width="40"
      height="40"
      alt="Manon — portrait synthétique généré par IA, plume éditoriale fictive d'Axion-IA"
      class="byline-avatar"
      loading="lazy"
    />
    <span class="byline-name">Par <strong>Manon</strong></span>
  </a>
  <span class="byline-sep">·</span>
  <time datetime="{ISO8601}" class="byline-date">{date FR}</time>
  <span class="byline-sep">·</span>
  <span class="byline-reading">{N} min de lecture</span>
  <button type="button" class="byline-info" aria-label="À propos de cette signature" data-tooltip="Manon est notre persona éditoriale — sous ce nom signent notre équipe + processus IA supervisé. Le portrait est une illustration générée par IA.">ⓘ</button>
</header>
```

## Author card HTML (bas article)

```html
<aside class="author-card" aria-labelledby="author-card-title">
  <figure>
    <img
      src="/auteurs/manon.png"
      width="128"
      height="128"
      alt="Manon — portrait synthétique généré par IA, plume éditoriale fictive d'Axion-IA"
      loading="lazy"
      decoding="async"
    />
    <figcaption class="ai-disclosure">Illustration générée par IA</figcaption>
  </figure>
  <div>
    <h2 id="author-card-title" class="author-card-name">À propos de Manon</h2>
    <p class="author-card-bio">
      Manon est la plume éditoriale d'Axion-IA. Sous ce nom signent notre équipe
      éditoriale et notre processus de production IA supervisé. Son portrait
      visuel est une illustration générée par IA. Tous nos contenus tier-1 sont
      validés par notre relecture humaine avant publication.
    </p>
    <ul class="author-card-links">
      <li><a href="/fr/equipe/manon">Tous ses articles</a></li>
      <li><a href="/fr/methodologie">Notre méthodologie éditoriale</a></li>
    </ul>
  </div>
</aside>
```

⚠️ **Aucun lien LinkedIn / Twitter / réseau social** dans la card (v2.1 doctrine).

## Référence `Article.author` JSON-LD

```jsonld
"author": { "@id": "https://axion-ia.com/fr/equipe/manon#person" }
```

(référence par `@id`, pas duplication — hygiène DRY).

## Schéma Prisma AuthorProfile (extension v2.1)

```prisma
model AuthorProfile {
  id                   String   @id @default(cuid())
  slug                 String   @unique  // "manon"
  displayName          String              // "Manon"
  jobTitle             String              // "Plume éditoriale d'Axion-IA"
  bioMd                String   @db.Text
  photoUrl80           String              // "/auteurs/manon.png" (Next/image resize)
  photoUrl256          String              // "/auteurs/manon.png"
  photoUrl1024         String              // "/auteurs/manon.png"
  photoAlt             String?             // 🆕 v2.1 — alt text canonique
  aiGenerated          Boolean  @default(false) // 🆕 v2.1 — flag transparence IA
  linkedinUrl          String?             // null systématique pour Manon (v2.1)
  twitterHandle        String?             // null systématique pour Manon (v2.1 — balise twitter:creator TOUJOURS omise)
  alumniOf             String?             // null (persona fictive)
  awards               String[] @default([])
  knowsAbout           String[] @default([])
  isPersona            Boolean  @default(false) // v2.0
  personaDisclaimer    String?              // v2.0+v2.1 — enrichi mention IA
  isActive             Boolean  @default(true)
  updatedAt            DateTime @updatedAt
}
```

## Will fournit avant Sprint 1 — ✅ TOUT COMPLET 2026-05-14

- [x] **Choix Option visuelle** → Option 4 « Portrait IA disclosed » (RETENUE)
- [x] **Photo source** → `axionia/public/auteurs/manon.png` (placée 2026-05-14, commit `7ab27b5`)
- [x] **Validation bio** → OK tel quel (cf. seed `_AUDIT/seeds-templates/manon-profile.md` § 3)
- [x] **Validation expertises** → 8 items inchangées
- [x] **LinkedIn / Twitter** → null (aucun réseau social)

→ **Q13 RÉSOLU. Autopilote Sprint 1 débloqué.**

## Helper TypeScript `buildPersonManonJsonLd()` (Sprint 1 Day 2)

```ts
// axionia/src/lib/seo.ts (étendre fonction existante)
export function buildPersonManonJsonLd(profile: AuthorProfile, siteUrl: string) {
  if (profile.slug !== "manon") {
    throw new Error("buildPersonManonJsonLd called with non-manon profile");
  }
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${siteUrl}/fr/equipe/manon#person`,
    name: profile.displayName,
    givenName: profile.displayName,
    jobTitle: profile.jobTitle,
    url: `${siteUrl}/fr/equipe/manon`,
    image: {
      "@type": "ImageObject",
      url: `${siteUrl}${profile.photoUrl1024}`,
      width: 1024,
      height: 1024,
      caption: profile.photoAlt ?? `${profile.displayName} — portrait éditorial`,
    },
    description: profile.personaDisclaimer ?? `${profile.displayName} est la plume éditoriale d'Axion-IA.`,
    knowsAbout: profile.knowsAbout,
    knowsLanguage: ["fr-FR"],
    worksFor: { "@id": `${siteUrl}/#organization` },
    // GARDE-FOU v2.1 : pas de sameAs pour Manon (slug guard)
    // pas de alumniOf, pas de award, pas de affiliation externe
  };
}
```

**Garde-fou explicite** : la fonction valide `slug === "manon"` et n'émet JAMAIS `sameAs[]` (cf. AGT-VC4 post-S0 finding INFO-1).
