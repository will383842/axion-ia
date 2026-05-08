# 📰 PROMPT PAGE PRESSE — AxionIA · Mini-sprint correctif

> **Version 1.0 · 2026-05-07** (statut : **base livrée** au commit `38879bc` `feat(press): add press room (FR+EN) + site-wide copy purge`. Reste à dérouler : page détail communiqué `/presse/[slug]`, assets `public/press-kit/`, alias `presse@axion-ia.com`, releases réelles, photo porte-parole.)
> Working directory : `C:\Users\willi\Documents\Projets\Axion-IA\axionia` (sous-repo Next.js 16).
> À lancer **après** `PROMPT-FRONTEND-AUDIT-V14-2026.md` (verdict reçu) et **avant** `PROMPT-SEO-AEO-GEO-2026.md` (la page presse renforce GEO E-E-A-T → mieux qu'elle existe avant l'audit SEO/AEO/GEO).
> Durée estimée : 45-75 min (1 page éditoriale + footer link + i18n + JSON-LD + tests + commit).

---

## 🎯 OBJECTIF

Ajouter une **page presse** complète FR + EN qui renforce massivement les signaux **GEO E-E-A-T** (page autorité médias + porte-parole + communiqués + press kit) et donne un point d'entrée pour les médias/journalistes.

---

## 🧠 RÔLE & CONTRAINTES

- **Mode auto** + **Conventional Commits**.
- **Doctrine visuelle = HEAD** (post-pivot v3 commité par Will entre 2026-05-06 et 2026-05-07). Lire `globals.css` + `Hero.tsx` + `Footer.tsx` + `LegalPageTemplate.tsx` pour repérer les patterns actuels (titleEm serif italique, accents terracotta, halo warm sur Hero, etc.) et les **réutiliser à l'identique** — ne pas réinventer.
- **i18n strict** : parité FR/EN, pathnames typés, namespaces propres.
- **JSON-LD complet** pour signal GEO maximal.
- **Tests Vitest** pour fixtures + composants nouveaux.
- **CI gates verts** (typecheck, lint, ~~anti-formation~~ (retiré ADR 0003 2026-05-07), anti-siren, anti-hex, use-client, i18n:check, zod:check, contrast:check, radius:check).

---

## 📐 STRUCTURE DE LA PAGE

### Routes

- FR : `/presse`
- EN : `/press`
- Pathnames typés via `next-intl` `routing.ts` (`pathnames: { '/presse': { fr: '/presse', en: '/press' } }`).

### Composition (cohérente avec doctrine commitée)

1. **Hero** (variant `transverse` avec `accent="terracotta"`, halo warm)
   - Eyebrow : « Espace presse · OÜ Estonie » (FR) / « Press room · Estonian OÜ » (EN)
   - Title avec `titleEm` serif italique sur mot identitaire (ex : « Ressources <em>presse</em> AxionIA »)
   - Description courte : pitch presse en 1-2 phrases
   - CTA primaire : « Télécharger le press kit » → ancre `#press-kit`
   - CTA secondaire : « Contacter la presse » → ancre `#contact`

2. **Section Pitch presse** (`bg-paper` ou `bg-bg`)
   - Bloc direct-answer 40-80 mots citable par LLMs (signal AEO)
   - Statistiques clés AxionIA en `<dl>` ou `<MetricsRow>` :
     - Année de fondation OÜ
     - Nombre d'interventions livrées (à remplir, fixture)
     - Pays opérés (FR + EU)
     - ROI moyen mesuré

3. **Section Press kit** (id `press-kit`, `bg-sand` ou `bg-halo-cool`)
   - Logos AxionIA (PNG haute déf + SVG + clear space rules)
   - Photos officielles (porte-parole + équipe, format 1:1 + 16:9)
   - Brand book PDF (synthétique : palette + typo + ton)
   - Wordmark variations (couleur, monochrome, dark, light)
   - Boilerplate FR + EN (paragraphe descriptif copy-paste pour journalistes)
   - **Boutons téléchargement** avec icônes (`Download` from `lucide-react`)
   - Si fichiers pas encore prêts → placeholders `coming-soon` + `disabled` UI + note interne dans `content/press.ts`.

4. **Section Communiqués de presse** (id `communiques`, `bg-bg`)
   - 3-5 fixtures de releases (peuvent être placeholders éditoriaux pour Phase 1)
   - Chaque release = card avec : date, titre, dek, tag (Lancement / Partenariat / Étude / Annonce produit), lien « Lire le communiqué » → page détail `[slug]`
   - Page détail : `/presse/[slug]` FR + `/press/[slug]` EN avec template `<NewsArticle>` schema
   - **Au minimum 1 release réelle** : annonce du lancement AxionIA (date à définir avec Will)

5. **Section Couverture médias** (id `couverture`, `bg-paper`)
   - Logos médias qui ont parlé d'AxionIA (placeholders Phase 1, à remplacer dès premières mentions)
   - 3-5 articles externes en cards (logo média + date + titre article + lien externe `rel="noopener noreferrer"`)
   - Si aucun encore → message « Premières interventions médias à venir — contactez-nous pour interviews exclusives »

6. **Section Porte-parole** (id `porte-parole`, `bg-bg`)
   - Photo + nom + role (`<TeamGrid>` ou variant simplifié 1-2 personnes)
   - Bio courte (2-3 phrases)
   - Domaines d'expertise (`knowsAbout` JSON-LD)
   - LinkedIn pro (`sameAs`)
   - Disponibilité interview (« réponses sous 48h ouvrées »)
   - Will = porte-parole principal probablement.

7. **Section Contact presse** (id `contact`, `bg-mocha` ou `bg-halo-warm`)
   - Email dédié `presse@axion-ia.com` (à confirmer / créer)
   - Téléphone (heures ouvrées Tallinn)
   - Délai de réponse annoncé : 48h ouvrées
   - Languages : FR + EN
   - Bouton « Envoyer un message » → `mailto:` ou form Contact existant prérempli `?type=presse`
   - **Pas de form séparé** (Sprint 17 backend pas encore fait) — réutiliser `ContactForm` existant avec param `type=presse`

8. **Section FAQ presse** (id `faq`, `bg-bg`)
   - 5-8 questions fréquentes journalistes (FAQPage schema)
   - Ex : « Quelle est la juridiction d'AxionIA ? », « Qui sont vos clients types ? », « Pouvez-vous fournir des cas concrets pour articles ? », « Acceptez-vous les interviews vidéo ? »
   - Réutiliser `<FaqAccordion>` avec auto JSON-LD FAQPage.

---

## 🏷️ JSON-LD (signal GEO maximal)

### Page principale `/presse` et `/press`

```typescript
const pressJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "@id": `${SITE_URL}/${locale === "fr" ? "presse" : "press"}`,
  url: `${SITE_URL}/${locale === "fr" ? "presse" : "press"}`,
  name: locale === "fr" ? "Espace presse AxionIA" : "AxionIA press room",
  inLanguage: locale === "fr" ? "fr-FR" : "en-US",
  isPartOf: { "@type": "WebSite", "@id": `${SITE_URL}/#website` },
  about: {
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: "AxionIA OÜ",
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: `${SITE_URL}/og/logo-axionia.png`,
      width: 1200,
      height: 630,
    },
    address: {
      "@type": "PostalAddress",
      addressLocality: "Tallinn",
      addressCountry: "EE",
      streetAddress: "<adresse OÜ>",
    },
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer service",
        email: "contact@axion-ia.com",
        availableLanguage: ["French", "English"],
      },
      {
        "@type": "ContactPoint",
        contactType: "media inquiry",
        email: "presse@axion-ia.com",
        availableLanguage: ["French", "English"],
      },
    ],
    sameAs: [
      "https://www.linkedin.com/company/axion-ia",
      "https://www.youtube.com/@axion-ia",
      // + Wikidata si créé, GitHub, etc.
    ],
    identifier: "<registrikood estonien>",
    taxID: "EE<numero TVA>",
    foundingDate: "<YYYY-MM-DD>",
    founder: {
      "@type": "Person",
      name: "<nom Will ou raison sociale>",
      jobTitle: "Founder",
      sameAs: "<linkedin URL>",
    },
    numberOfEmployees: { "@type": "QuantitativeValue", value: "<N>" },
  },
};
```

### Page détail communiqué `/presse/[slug]`

```typescript
const releaseJsonLd = {
  "@context": "https://schema.org",
  "@type": "NewsArticle",
  headline: release.title,
  datePublished: release.date,
  dateModified: release.dateModified ?? release.date,
  author: { "@type": "Organization", name: "AxionIA OÜ" },
  publisher: {
    "@type": "Organization",
    name: "AxionIA OÜ",
    logo: { "@type": "ImageObject", url: `${SITE_URL}/og/logo-axionia.png` },
  },
  image: [`${SITE_URL}/api/og?title=${encodeURIComponent(release.title)}`],
  description: release.dek,
  articleBody: release.body,
  inLanguage: locale === "fr" ? "fr-FR" : "en-US",
  isPartOf: { "@type": "WebPage", "@id": `${SITE_URL}/${locale === "fr" ? "presse" : "press"}` },
};
```

### Speakable markup

```typescript
"speakable": {
  "@type": "SpeakableSpecification",
  "cssSelector": [".aeo-direct-answer", ".press-pitch-paragraph"]
}
```

---

## 📁 FICHIERS À CRÉER / MODIFIER

### Nouveaux

1. `src/app/[locale]/presse/page.tsx` ✅ livré (commit `38879bc`)
2. `src/app/[locale]/presse/[slug]/page.tsx` — **TODO Sprint 14.6** (page détail communiqué pas encore implémentée)
3. `src/components/sections/PressKit.tsx` ✅ livré
4. `src/components/sections/PressReleases.tsx` ✅ livré
5. `src/components/sections/MediaCoverage.tsx` ✅ livré
6. `src/components/sections/PressContact.tsx` ✅ livré
7. `src/components/sections/PressSpokesperson.tsx` ✅ livré
8. `src/components/sections/PressFacts.tsx` ✅ livré (factsheet stats clés, ajout HEAD non listé v1)
9. `src/content/press.ts` ✅ livré (PRESS_PITCH, PRESS_FACTS, PRESS_KIT_ASSETS, PRESS_RELEASES, PRESS_MEDIA_COVERAGE, PRESS_SPOKESPERSONS, PRESS_FAQ)
10. `src/content/press.test.ts` ✅ livré (le fichier de test est colocalisé `src/content/press.test.ts`, pas `tests/content/`)
11. `public/press-kit/` — **TODO** (assets logos PNG/SVG + brand book PDF + photos à fournir par Will)

### Modifiés

12. `src/i18n/routing.ts` ✅ pathname `/presse: { fr: "/presse", en: "/press" }` ligne 91
13. `src/messages/fr.json` + `src/messages/en.json` ✅ namespace `press` ajouté
14. `src/components/nav/Footer.tsx` ✅ lien Presse ajouté
15. `src/app/sitemap.ts` ✅ `/presse` capturé automatiquement par `buildPagesSitemap` (entry dans `routing.pathnames`). `/presse/[slug]` à ajouter à `buildDynamic` quand pages détail arriveront.
16. `src/app/robots.ts` ✅ `/presse/*` est allow (aucune règle `Disallow` ne le couvre).
17. `src/app/llms.txt/route.ts` — vérifier section presse, à enrichir si absente.
18. `_AUDIT/02b-mapping-pages.md` — confirmer ligne `Presse` listing + ligne `Communiqué [slug]` détail (75 → 77 templates).
19. `axionia/SESSION_LOG.md` — entrée Sprint correctif 14.6 « Page presse + footer link » (commit `38879bc`).

---

## ✅ DEFINITION OF DONE

- [ ] `/presse` FR + `/press` EN HTTP 200 build local.
- [ ] `/presse/[slug]` + `/press/[slug]` HTTP 200 build local sur 3+ fixtures.
- [ ] Footer lien Presse présent FR + EN, accessible clavier, cohérent avec autres liens.
- [ ] Doctrine HEAD respectée : titleEm serif sur Hero, accents terracotta, halo warm, patterns Footer mocha, eyebrow dot indicator, 0 hex hardcodé.
- [ ] JSON-LD `WebPage` + `Organization` enrichi + `ContactPoint` media inquiry + `Person` porte-parole + `NewsArticle` (releases) + `FAQPage` (FAQ presse) + `speakable`.
- [ ] Validés Schema.org Validator API (WebFetch).
- [ ] OG image dynamique sur `/presse` + `/press` + chaque release.
- [ ] Hreflang FR ↔ EN + x-default sur toutes les pages presse.
- [ ] Bloc direct-answer 40-80 mots en haut (citable LLMs, signal AEO).
- [ ] `pnpm i18n:check` 0 erreur (parité FR/EN namespace `press`).
- [ ] `pnpm typecheck` 0 erreur.
- [ ] `pnpm lint` 0 erreur, 0 warning.
- [ ] ~~`pnpm anti-formation:check`~~ (retiré ADR 0003 2026-05-07) + `anti-siren:check` + `anti-hex:check` + `use-client:check` verts.
- [ ] `pnpm test` : tests fixtures `tests/content/press.test.ts` verts + 71+ tests existants maintenus.
- [ ] `pnpm build` succès, 64+2 routes SSG ou ISR (cf. SYNC-NOTICE-2026-05-07).
- [ ] Lighthouse mobile ≥ 95 sur `/presse` + `/press`.
- [ ] axe-core 0 violation AA sur `/presse` + `/press`.
- [ ] Visual regression baselines créées et stables.
- [ ] `_AUDIT/02b-mapping-pages.md` v2 reflète déjà l'inclusion de `/presse` (Sprint 14.6 livré commit `38879bc`).
- [ ] `axionia/SESSION_LOG.md` Sprint 14.6 entrée ajoutée.
- [ ] Commit `feat(press): add press room (FR+EN) with kit + releases + spokesperson + contact + FAQ`.

---

## ⚠️ POINTS DE VIGILANCE

1. **Email `presse@axion-ia.com`** : à créer côté DNS/MX (peut être alias vers `contact@axion-ia.com` Phase 1, alias dédié Phase 2).
2. **Press kit assets** (`public/press-kit/`) : si Will n'a pas encore les fichiers (logos haute déf, brand book PDF, photos), créer les placeholders avec note `TODO: Will à fournir` dans `content/press.ts` et désactiver les boutons download via `disabled` UI. Ne pas inventer des fichiers.
3. **Communiqués fixtures** : peuvent être éditoriaux Phase 1 (ex : « AxionIA lance son cabinet IA opérationnel à Tallinn »). Au moins **1 release réelle** datée pour signal authentique.
4. **Couverture médias** : si aucun article encore, message transparent « Premières interventions médias à venir — contactez-nous pour exclusivités » plutôt que de fabriquer de la couverture inexistante (anti-pattern E-E-A-T).
5. **Porte-parole** : nom + photo réels indispensables (E-E-A-T trust). Si Will n'a pas encore défini, demander avant de coder.
6. **Tonalité presse** : factuelle, pas marketing. Pas de superlatifs (« le meilleur cabinet », « leader »). Faits + chiffres + sources.
7. **Mots bannis** : « formation »/« formateur »/« former » (sauf intent SEO whitelisted), « SIREN »/« SIRET »/« RCS ». Anti-grep CI bloque sinon.
8. **Doctrine** : respecter HEAD à 100 %. Si tu détectes une incohérence dans HEAD entre fichiers, **NE PAS** corriger dans ce sprint — log finding et continuer avec le pattern majoritaire.

---

## ▶️ DÉMARRAGE

1. Confirme en 5 lignes le scope.
2. **Avant de coder** : lire les patterns HEAD pour ne pas réinventer.
   - `git show HEAD:src/app/globals.css` (tokens)
   - `git show HEAD:src/components/sections/Hero.tsx` (pattern Hero + titleEm)
   - `git show HEAD:src/components/nav/Footer.tsx` (pattern Footer mocha + zones)
   - `git show HEAD:src/components/sections/LegalPageTemplate.tsx` (pattern page éditoriale)
   - `git show HEAD:src/i18n/routing.ts` (pathnames typés)
3. **Demander à Will** (STOP & ASK) :
   - Nom + photo + bio porte-parole(s).
   - Au moins 1 release réelle (titre + date + dek).
   - Email presse dédié ou alias contact ?
   - Press kit assets disponibles ou placeholders ?
4. Une fois validé → coder en suivant la DoD ci-dessus.
5. Tests + commit + push (push à demander à Will explicitement).
6. STOP & ASK final : verdict + question fermée OUI/NEXT.
