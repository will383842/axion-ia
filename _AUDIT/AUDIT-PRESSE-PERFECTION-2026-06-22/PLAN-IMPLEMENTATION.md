# Plan d'implémentation — Page /presse « perfection » (2026-06-22)

> Worktree dédié : `axionia-wt-presse` · branche `feat/presse-perfection` (base `origin/main` @ `7f0bb8b6`, à jour).
> Audit réalisé en main-loop (les 9 sous-agents ont échoué sur limite de session — reset 22 h Europe/Paris).
> Décisions Will actées : (1) garder sections existantes de valeur + ajouter les nouvelles ; (2) ton **sobre/institutionnel** ; (3) contact = **Williams (fondateur)** + presse@axion-ia.com, aucune donnée inventée ; (4) communiqués PDF → **extraction texte→HTML** ; mobile-first ; Web Vitals stricts.

---

## 1. Synthèse exécutive

La page `/presse` actuelle (`src/app/[locale]/presse/page.tsx`, ~700 lignes) est **déjà riche et techniquement solide** : hero, pitch citable + facts, Observatoire IA, kit média (DB), banque d'images (promo galerie), communiqués (DB+fallback), porte-parole, témoignages vérifiés, couverture médias, formulaire unifié, contact, FAQ, et un bon socle JSON-LD (NewsroomPage, Person, ItemList/NewsArticle, FAQPage, ImageObject graph, Speakable).

**Écart vers « meilleure page presse de France » :**
- Manque les 2 sections demandées par Will : **strip « 5 activités »** compact, et **« Que se passe-t-il VRAIMENT à Axion-IA »** (ton posé).
- Manque une section **« Images presse »** explicite (logos + **nuancier charte couleur visuel** + brand book) — le data-model la supporte déjà (`PressMediaKind.color_charter` / `graphic_charter`) mais la page ne l'expose pas distinctement.
- Banque d'images = chemins `/images/*.webp` **hardcodés** au lieu de vrais visuels tirés de l'image bank (`ImageAsset`).
- Communiqués PDF → landing `/presse/[slug]` **mince** (iframe seul, noindex) → trou SEO/AEO.
- **Données à corriger** (Will : zéro donnée inventée) — voir §2.
- SEO presse non centralisé (JSON-LD inline dans page.tsx) → extractible en builder dédié.

**Bonne nouvelle architecture** : la DB est déjà bien conçue → **migration probablement évitable** pour l'extraction PDF (réutiliser `PressReleaseTranslation.body` qui est déjà `Text?`).

---

## 2. Corrections factuelles OBLIGATOIRES

| # | Donnée actuelle | Problème | Correction | Emplacement |
|---|---|---|---|---|
| F1 | Porte-parole `name: "Will"` (FR+EN) | Doit être « Williams » (jamais « Williams Jullin » en affichage) | `name: "Williams"` | `src/content/press.ts:343,348` |
| F2 | Alt images « L'équipe Axion-IA — **12 collaborateurs** / 12 personnes » | **Effectif inventé** : le seul « 12 personnes » du SSOT est le plafond *taille de groupe* formation (`pricing.ts:350,357`), pas l'effectif. 1 seul porte-parole listé. | Retirer le nombre. Alt neutre : « L'équipe Axion-IA — cabinet IA opérationnel France » (sans compter de têtes). Idem caption. | `page.tsx:311-323` + `imageBankCat2` alt `page.tsx:492-495` |
| F3 | Délai réponse presse : **« 48 h ouvrées »** (press.ts facts + porte-parole + FAQ) vs **« 24 h ouvrées »** (formulaire `page.tsx:642-643`) | Incohérence visible | Harmoniser sur **48 h ouvrées** partout (valeur SSOT facts) OU décider 24 h et propager. Recommandé : 48 h (déjà majoritaire). | `press.ts:173-174,350,403` + `page.tsx:642-643` |
| F4 | FAQ structure juridique : « société française (**[forme juridique à préciser]**) … TVA française (20 %) » | Placeholder visible en prod ; #139 a livré le SSOT identité (SAS) | Remplacer par « société française (**SAS**) ». ⚠️ Vérifier régime TVA réel via `legal-identity.ts` / SSOT #139 avant d'affirmer « TVA 20 % » (cf. mémoire qualiopi : franchise/exonération possibles). Si incertain : « TVA selon régime en vigueur ». | `press.ts:362-369` |
| F5 | `foundingDate: "2024"` + « fondé en 2024 » | À recouper avec `seo.ts`/legal #139 (cohérence). | Vérifier ; aligner sur la source d'identité canonique. Ne pas diverger. | `page.tsx:156`, `press.ts:121,127` |
| F6 | Spokesperson `linkedinUrl` = page **company** LinkedIn | `sameAs` Person devrait pointer le profil **personnel** (`linkedin.com/in/williamsjullin` — cf. mémoire founder) si public, sinon laisser company mais ne pas prétendre profil perso | Mettre le vrai profil perso s'il est public ; sinon documenter le choix. | `press.ts:333` |
| F7 | Copyright image bank « Axion-IA OÜ » (skill image-bank) | Société = SAS française, plus d'OÜ | Si un asset/section presse réutilise ce copyright, forcer « Axion-IA » (sans OÜ). Vérifier au rendu. | image-bank layer |

> ✅ **Non-problèmes confirmés** (ne pas « corriger ») : « Hetzner Frankfurt / UE » est cohérent (`legal.ts`, `subprocessors.ts`) — SAS FR + hébergement UE est correct ; couverture médias & témoignages **vides** = bon (ne jamais fabriquer) ; prix dérivés de `pricing.ts` via helpers = OK.
> ⚠️ Incohérence mineure annexe à signaler : `llms.txt` dit « Hetzner **Nuremberg** » alors que `legal.ts`/press disent « **Frankfurt** ». Hors scope page presse mais à noter.

---

## 3. Architecture cible de la page (ordre narratif)

Ordre repensé pour une page presse de référence (sobre, institutionnel) :

1. **Breadcrumb** (existant).
2. **HERO** — refonte « exceptionnelle » sobre : eyebrow « Espace presse », titre accroche presse parfaite, sous-titre 1 phrase, **2 CTA** : (a) « Télécharger le kit média » → `#images-presse`, (b) « Contacter les relations presse » → `#contact-presse`. Conserver halo/anneaux. (cf. §4 pour la copy.)
3. **HERO visuel** — illustration équipe (alt corrigé F2).
4. **STRIP 5 ACTIVITÉS** *(NOUVEAU)* — bande compacte 5 petits blocs (Formations, 1-to-1, Audit, Implémentations, Sites web), peu de hauteur, liens canoniques. Données SSOT (§4).
5. **PITCH / boilerplate citable** + facts (existant, corrigé F-series). `#press-pitch` + `#press-boilerplate` (speakable).
6. **QUE SE PASSE-T-IL VRAIMENT À AXION-IA** *(NOUVEAU)* — section pont, ton posé, sans plagiat (§4). Invite à feuilleter communiqués + kit + contact RP.
7. **COMMUNIQUÉS avec visuels** *(REFONTE)* — cartes avec visuel/vignette par communiqué (auto-OG ou image éditoriale), tag, date, dek, bouton PDF + lien landing HTML.
8. **IMAGES PRESSE** *(NOUVEAU/EXPLICITE)* — logos (toutes variantes), **nuancier charte couleur** rendu visuellement (pastilles HEX), charte graphique, brand book — tout depuis `PressMediaAsset` (kinds `logo/wordmark/color_charter/graphic_charter/brand_book`). Remplace/spécialise l'actuel `PressKit`.
9. **BANQUE D'IMAGES** *(REFONTE)* — vrais visuels récents tirés de l'image bank (`ImageAsset`) + CTA `/galerie` + licence CC BY.
10. **OBSERVATOIRE IA 2026** (existant, gardé).
11. **PORTE-PAROLE** (existant, corrigé Williams).
12. **TÉMOIGNAGES VÉRIFIÉS** (existant, conditionnel).
13. **COUVERTURE MÉDIAS** (existant, vide = masqué).
14. **FORMULAIRE demande presse** (existant, délai harmonisé F3).
15. **CONTACT presse** `#contact-presse` (existant, Williams + presse@). 
16. **FAQ presse** (existant, corrigé F4).
17. **JSON-LD** (centralisé §6).

---

## 4. Nouveaux composants (fichiers isolés — buildables en parallèle, Vague A)

### A1. `src/components/sections/PressActivitiesStrip.tsx`
- **But** : strip compact 5 activités.
- **Props** : `{ activities: Array<{ id; title; href; blurb; iconKind }>, labels?: {...} }` — données passées par page.tsx (server component, 0 JS client).
- **Données SSOT** : dériver de `offers-catalog.ts` / `pricing.ts` (verticals `formation`, `un-a-un`, `audit`, `implementation`, `sites-web`) — libellés FR/EN exacts, URL via `resolveOfferUrl`/`offer-url.ts`. **PAS** de 6e « maintenance ». Blurbs courts sourcés (1 phrase).
- **Design** : grille `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`, cartes basses, icône lucide, titre, blurb 1 ligne, hover lien. Mobile-first, hauteur fixe → 0 CLS.

### A2. `src/components/sections/PressWhatsReallyHappening.tsx`
- **But** : section pont « Que se passe-t-il VRAIMENT à Axion-IA » (ton sobre).
- **Contenu** (réécriture originale, sans plagiat du modèle Will, sans emojis) : 2-3 phrases qui invitent à parcourir les communiqués, le kit média et à contacter les relations presse. Ex. de direction : *« Vous voulez comprendre ce qui se construit réellement chez Axion-IA ? Tout est sous vos yeux : nos communiqués détaillent chaque étape, notre kit média rassemble logos et visuels prêts à l'emploi, et notre contact presse répond sous 48 h ouvrées. »* (à affiner par l'agent rédaction, FR+EN, via i18n).
- **Props** : labels i18n. Ancres internes vers `#communiques`, `#images-presse`, `#contact-presse`.

### A3. `src/components/sections/PressReleasesVisual.tsx` (refonte de `PressReleases.tsx`)
- **But** : cartes communiqués **avec visuel**.
- **Visuel par communiqué** : priorité à une image éditoriale (si fournie via futur champ) sinon **OG auto** `/api/og?title=...` (déjà utilisé en JSON-LD `page.tsx:230`). Vignette ratio fixe (0 CLS), tag chip, date `<time>`, titre, dek, bouton « Télécharger le PDF » + lien « Lire » → landing HTML.
- **Garder** la shape `PressReleaseCard` (queries.ts) ; étendre proprement si visuel ajouté.

### A4. `src/components/sections/PressImages.tsx`
- **But** : section « Images presse » = identité de marque téléchargeable.
- **Sous-blocs** : (1) Logos/wordmarks (variantes fond clair/sombre/transparent) ; (2) **Nuancier charte couleur** : rendre des pastilles couleur avec HEX (depuis assets `color_charter` ou tokens design `globals.css`/`admin.css`) + bouton télécharger la charte ; (3) Charte graphique / brand book (PDF).
- **Données** : `getPublishedPressMedia()` filtré par `kind`. Pour le nuancier, soit asset `color_charter` (fichier), soit un petit SSOT de couleurs de marque (terracotta/mocha/sand… déjà dans tokens) rendu en pastilles — **vérifier les vrais tokens** avant d'afficher des HEX (pas d'invention).
- **Note** : remplace l'usage actuel de `PressKit` pour cette zone ; `PressKit` peut rester comme fallback ou être absorbé.

### A5. `src/components/sections/PressImageBankGallery.tsx` (refonte de `PressImageBank.tsx`)
- **But** : afficher de **vrais** visuels de l'image bank.
- **Données** : nouvelle query `getPublicPressGalleryImages(locale, limit)` dans `src/server/image-bank/**` (ou réutiliser une query galerie existante) → `ImageAsset` publiés, variants AVIF/WebP + LQIP, alt bilingue. Si query indisponible au build stub → fallback sur les chemins actuels.
- **Design** : grille responsive, `next/image` width/height fixes (0 CLS, lazy sauf 1er), licence CC BY (copyright « Axion-IA » sans OÜ — F7), CTA `/galerie`.

> Toutes les sections = **server components** par défaut, zéro `"use client"` sauf nécessité absolue (budget First Load JS ≤ 75 KB gz).

---

## 5. Travaux fichiers partagés (SÉRIALISÉS — Vague B)

Ordre imposé (dépendances) :

**B1. Backend extraction PDF→HTML** (`src/server/press/`)
- Lib : vérifier `pdf-parse`/`unpdf` dans `package.json` ; sinon ajouter une dépendance légère (`unpdf` recommandé, pur JS). 
- À l'**upload** d'un communiqué PDF (server action admin `communiques/[id]` + `nouveau`) : extraire le texte, le nettoyer en HTML simple (paragraphes/titres), écrire dans `PressReleaseTranslation.body` (champ **déjà existant** `Text?` → **pas de migration**), + set `updatedAt`. Optionnel : `metaDescription` depuis 1ère phrase.
- **Suppression** : déjà soft-delete (`deletedAt`) → landing doit renvoyer **410 Gone** (et retrait sitemap). Vérifier le handler `/presse/[slug]`.
- **Remplacement PDF** : ré-exécuter l'extraction → écraser `body`, bump `updatedAt` (=> `dateModified`). Slug inchangé.
- ⚠️ Respect contrat `stub.invalid` : pas d'appel DB/extraction au build.

**B2. Landing `/presse/[slug]/page.tsx`**
- Si `body` (HTML extrait) présent → rendre le **HTML complet** (H1 titre, dek, corps, `<time>`, JSON-LD `NewsArticle` + `Speakable`, OG). Garder l'iframe PDF + bouton télécharger en complément.
- **Retirer le `noindex` thin-content** dès que `body` non vide ; conserver noindex uniquement si body vide.
- `generateMetadata` : `metaTitle`/`metaDescription` depuis translation.

**B3. i18n messages** (`messages/fr.json` + `messages/en.json`, namespace `press`)
- Ajouter clés : `activitiesEyebrow/Title/Description` + 5 blurbs ; `whatsReallyEyebrow/Title/Body` ; `imagesEyebrow/Title/Description` + libellés nuancier ; refonte labels communiqués/banque si besoin ; nouvelle copy hero (§4 hero). **Parité FR/EN stricte** (test `press.test.ts` + parité i18n). EN = miroir (même si runtime FR-only).

**B4. Assemblage `src/app/[locale]/presse/page.tsx`**
- Insérer les nouvelles sections dans l'ordre §3, brancher données, corriger alt/labels (F-series), harmoniser délai (F3).

**B5. Câblage admin** (`(admin)/[adminPrefix]/presse/**`)
- S'assurer que les pièces nouvellement affichées sont **éditables** : kit média couvre déjà logo/charte/brand book (kinds présents) → vérifier que l'UI upload propose `color_charter`/`graphic_charter`. 
- Décider pour `pitch`/`facts`/`porte-parole`/`FAQ`/`activités`/`whatsReally` : restent en SSOT i18n/`press.ts` (Phase 2 admin possible plus tard) — **documenter** ce qui est éditable vs code. Will veut « tout depuis l'admin » à terme ; livrer au minimum communiqués + kit média + (si raisonnable) une table éditable pour le texte « whatsReally » et le pitch. **Arbitrage** : prioriser communiqués+images presse (déjà DB) ; le reste = SSOT documenté, à migrer en Phase 2 si Will confirme.

**B6. Centralisation SEO** (§6).

---

## 6. SEO / AEO / GEO / Speakable

- **Centraliser** : extraire les JSON-LD presse de `page.tsx` vers `src/lib/seo/press.ts` → `buildPressRoomJsonLd({locale, releases, spokespersons, facts})` (WebPage/NewsroomPage + Speakable + Organization `@id`) et `buildPressReleaseJsonLd({release})` (NewsArticle pour la landing). Réutiliser `SITE_URL`, `buildImageGraphJsonLd`, `buildFaqSpeakableJsonLd`, `speakable-universal`.
- **Speakable** : garder `#press-pitch` + `#press-boilerplate` ; ajouter la section « whatsReally » si concise et citable.
- **Landing /presse/[slug]** : émettre `NewsArticle` complet (headline, datePublished, dateModified, author/publisher `@id`, image OG, articleBody depuis `body`) + Speakable une fois texte extrait. **Lever le noindex**.
- **Sitemap** : vérifier que `/presse/[slug]` publiés sont dans le sitemap (et 410 retirés). 
- **hreflang/canonical** : déjà via `buildProductMetadata` ; conserver alternates `{fr:'/presse', en:'/press'}`.
- **AEO** : pitch direct-answer 40-80 mots (existant) — garder ; facts en `<dl>` (existant).

---

## 7. Plan d'exécution en VAGUES d'agents (hiérarchie)

**Vague A — Composants isolés (parallèle, ~5-6 agents, fichiers neufs sans conflit)** :
- Agent A1 → `PressActivitiesStrip.tsx` (+ helper dérivation 5 activités depuis SSOT, fichier dédié).
- Agent A2 → `PressWhatsReallyHappening.tsx`.
- Agent A3 → `PressReleasesVisual.tsx`.
- Agent A4 → `PressImages.tsx` (+ nuancier).
- Agent A5 → `PressImageBankGallery.tsx` (+ query image bank).
- Agent A6 (rédaction) → produit la **copy FR/EN** (hero, whatsReally, blurbs activités, labels) en JSON prêt pour B3, ton sobre/institutionnel, sans emojis, sans plagiat.

**Vague B — Intégration sérialisée (1 agent à la fois, fichiers partagés)** :
- B1 backend extraction → B2 landing → B3 i18n → B4 page.tsx → B5 admin → B6 SEO central. Chaque étape dépend de la précédente.

**Vague C — Vérification adversariale (parallèle, ~3-4 agents)** :
- C1 : `pnpm typecheck` + `pnpm lint` + tests press (`press.test.ts`, page.spec) → corrige.
- C2 : re-audit **exactitude factuelle** (re-vérifier F1-F7 réellement appliqués, aucun nouveau chiffre inventé).
- C3 : audit SEO/AEO/Speakable (JSON-LD valides, landing HTML, noindex levé, hreflang).
- C4 : audit mobile-first/responsive + Web Vitals (0 `"use client"` superflu, images width/height, First Load JS, 0 CLS).

---

## 8. Risques & garde-fous

- **Migration discipline** : viser **0 migration** (réutiliser `body`). Si une migration s'avère nécessaire (peu probable), additive uniquement, hand-authored, format `2026MMDDHHMMSS_xxx`.
- **Contrat `stub.invalid`** : aucune extraction PDF / appel DB au build SSG ; fallback fixtures conservés.
- **Jonction node_modules worktree** : retirer la jonction (`cmd //c "rmdir node_modules"`) AVANT tout `git worktree remove` (sinon destruction du node_modules principal — cf. mémoire).
- **Parité i18n FR/EN** : tout ajout de clé en double locale ; faire tourner les tests de parité.
- **Web Vitals** : server components par défaut ; `next/image` dimensionné ; pas de gros JS. La page est dans les 15 pages stratégiques → LCP≤1800, INP≤100, CLS=0, First Load≤75 KB gz.
- **Zéro donnée inventée** : règle d'or — tout chiffre/effectif/nom doit venir d'un SSOT vérifiable. En cas de doute → formulation neutre, pas d'invention. STOP & ASK Will si un chiffre manque.
- **Ne pas pousser/merger** sans Will : livrer sur la branche, PR à sa main.

---

### Annexe — Fichiers clés
- Page : `src/app/[locale]/presse/page.tsx`, `.../presse/[slug]/page.tsx`
- Fixtures/SSOT : `src/content/press.ts`, `src/content/offers-catalog.ts`, `src/content/pricing.ts`
- Backend : `src/server/press/queries.ts`, `src/server/image-bank/**`
- Admin : `src/app/[locale]/(admin)/[adminPrefix]/presse/**`, `src/lib/admin-nav.ts`
- Composants : `src/components/sections/Press*.tsx`, `src/components/layout/Section.tsx`, `Container.tsx`, `src/components/ui/button.tsx`, `src/components/visual/Illustration.tsx`
- SEO : `src/lib/seo.ts`, `src/lib/seo/speakable-universal.ts`
- DB : `prisma/schema.prisma` (L7062-7157, modèles press — `body` Text? déjà présent, kinds `color_charter`/`graphic_charter` déjà présents)
- i18n : `messages/fr.json`, `messages/en.json` (namespace `press`)
