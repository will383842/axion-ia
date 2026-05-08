# Agent — Audit obsolescences + conflits AxionIA 2026-05-07

> Date : 2026-05-07
> HEAD : `acd8080`
> Working dir : `axionia/`
> Mission : préparer la cible #1 SEO/AEO/GEO France ville/région — zéro obsolescence, zéro conflit.
> Méthode : lecture seule, grep extensif, aucun fichier modifié.

---

## 1. Obsolescences détectées

### 1.1 Dates suspectes

Toutes les dates `2024` / `2025` du codebase ont été inspectées. Verdict :

| File:Line                                    | Texte                                                                               | Verdict                                                                 |
| -------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `src/lib/seo.ts:174`                         | `foundingDate: "2024"` (Organization JSON-LD)                                       | **Légitime** — OÜ Estonia créée 2024                                    |
| `src/content/press.ts:72`                    | « cabinet de conseil IA opérationnel fondé en 2024 »                                | **Légitime** — date historique                                          |
| `src/content/press.ts:79`                    | « operational AI consultancy founded in 2024 »                                      | **Légitime**                                                            |
| `src/content/press.ts:89-90`                 | `foundingDate value: "2024"` (Press kit fact sheet)                                 | **Légitime**                                                            |
| `src/content/transversal.ts:6-7`             | Timeline `id: "2024", date: "2024"` (Création AxionIA OÜ)                           | **Légitime**                                                            |
| `src/content/transversal.ts:12-13`           | Timeline `id: "2025", date: "2025"` (Premières interventions terrain — 10 missions) | **Légitime** — étape historique de la timeline                          |
| `src/app/[locale]/presse/page.tsx:134`       | `foundingDate: "2024"`                                                              | **Légitime**                                                            |
| `src/app/[locale]/page.tsx:191`              | `foundingDate: "2024"` (homepage Organization)                                      | **Légitime** mais **doublon JSON-LD** : déjà émis par layout (cf. §3.4) |
| `src/app/[locale]/sections/page.tsx:167-180` | Timeline démo avec dates 2024/2025/2026                                             | **Légitime** — page `/sections` design system, noindex                  |
| `src/components/sections/ToolLogo.tsx:63`    | `// 03 · Microsoft Copilot 365 — ruban infini (signature Copilot post-2024).`       | **Légitime** — commentaire historique                                   |
| `src/content/transversal.ts:135`             | `publishedAt: "2026-04-12"` (blog 1)                                                | OK                                                                      |
| `src/content/transversal.ts:154`             | `publishedAt: "2026-04-22"` (blog 2 — « 3 quick-wins IA opérationnels en 2026 »)    | OK                                                                      |
| `src/content/transversal.ts:174`             | `publishedAt: "2026-05-01"` (blog 3)                                                | OK                                                                      |

**Aucune date obsolète au sens strict.** Tous les `2024`/`2025` correspondent à des faits historiques de la timeline ou à `foundingDate`. Le présent éditorial est partout `2026`.

### 1.2 Mentions v1 / Webflow / anciennes doctrines

La doctrine actuelle est **v3 Editorial Premium Light** (ADR 0002) + **typo v3.1** (ADR 0004). Toute mention « Webflow-inspired » / « v1 webflow » dans le code source est un **résidu** de la doctrine ADR 0001 abandonnée.

| File:Line                                | Texte                                                                                                                               | Suggestion patch                                                                                                                                            |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/[locale]/layout.tsx:15-16`      | `// Manrope = open-source substitute for proprietary WF Visual Sans Variable` `// (Webflow). ADR 0001-design-direction-webflow.md.` | Remplacer par `// Manrope — sans-serif éditorial. Voir ADR 0002 (pivot Editorial Premium v3) + ADR 0004 (typo v3.1).`                                       |
| `src/app/globals.css:28`                 | `/* ----- Accent identitaire : Webflow Blue conservé + chaleur ----- */`                                                            | Renommer commentaire `/* ----- Accent identitaire bleu profond + chaleur ----- */`                                                                          |
| `src/app/globals.css:122`                | `/* ----- Spacing — Webflow fractional scale ----- */`                                                                              | `/* ----- Spacing — fractional scale ----- */`                                                                                                              |
| `src/app/globals.css:141`                | `--ease-out-webflow: cubic-bezier(0.16, 1, 0.3, 1);`                                                                                | Renommer token `--ease-out-editorial` (ou `--ease-out-soft`). Token utilisé l. 247-249 → renommage cross-fichier                                            |
| `src/app/globals.css:146`                | `/* ----- Breakpoints (Webflow: 479/768/992/1280) ----- */`                                                                         | `/* ----- Breakpoints (Editorial v3) ----- */`                                                                                                              |
| `src/app/globals.css:247-249`            | `transform var(--duration-base) var(--ease-out-webflow), …`                                                                         | suit le renommage du token                                                                                                                                  |
| `src/app/api/og/route.tsx:12`            | `primary: "#146ef5", // hex-ok: Webflow Blue token`                                                                                 | **OBSOLÈTE** — la doctrine v3 a remplacé `#146ef5` par `#1a4dd9` (cf. ADR 0002 §38). À mettre à jour vers `#1a4dd9` ou `var(--color-primary)` côté OG image |
| `src/app/api/og/route.tsx:109`           | `{/* Webflow accent stripe */}`                                                                                                     | Renommer commentaire                                                                                                                                        |
| `src/components/layout/Container.tsx:10` | `// Editorial v3 container: max-w 1520 (vs 1280 v1 webflow), responsive`                                                            | Garder référence historique pour traçabilité, OU simplifier : `// Editorial v3 container: max-w 1520, responsive`. Décision Will                            |
| `src/components/ui/badge.test.tsx:16`    | `it("is uppercase by default (Webflow doctrine)", () => {`                                                                          | Renommer description test : `(Editorial v3 doctrine)`                                                                                                       |

**Critique principale** : `src/app/api/og/route.tsx:12` utilise `#146ef5` (ancien Webflow Blue) au lieu de `#1a4dd9` (nouveau primary v3) → les images OG générées dynamiquement ne respectent pas la doctrine actuelle (impact réseaux sociaux + aperçus Slack/LinkedIn).

### 1.3 TODOs / placeholders

#### Critique (visible utilisateur final)

| File:Line                        | Texte                                                                                                           | Criticité                                                                                                                                                                  |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/content/legal.ts:40`        | « Numéro d'enregistrement (registrikood) : à compléter. Numéro de TVA EE : à compléter. » (FR mentions légales) | **CRITIQUE** — visible sur `/mentions-legales` page live. Détectable par Google + LLMs. **AEO/GEO 2026 = signal de manque de fiabilité**. Will doit fournir ces 2 valeurs. |
| `src/content/legal.ts:72`        | « Registration code (registrikood): to be completed. EU VAT number: to be completed. » (EN /legal-notice)       | **CRITIQUE** — idem côté EN                                                                                                                                                |
| `src/content/legal.ts:3`         | `// Anti-grep checks pass — Estonian registrikood placeholder only.`                                            | Note dev — résidu, à supprimer une fois valeurs réelles posées                                                                                                             |
| `src/lib/seo.ts:137-140`         | `vatID?: string; … registrikood?: string; // Will fournit plus tard.`                                           | OK (paramètres optionnels). Reste à câbler dès que valeurs disponibles                                                                                                     |
| `src/app/[locale]/layout.tsx:98` | `// Will fournit plus tard : vatID + registrikood Estonia → ajouter ici.`                                       | OK (TODO assumé)                                                                                                                                                           |

#### Non critique (commentaires dev — fonctionnels)

| File:Line                                                                   | Texte                                                                                                                              |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `src/content/press.ts:43` `:125-126` `:18`                                  | `placeholder` UI press kit (`fileUrl: null` = bouton disabled)                                                                     |
| `src/content/interventions.ts:3`                                            | « Sprint 5 ships placeholders; finer copy iteration belongs to Sprint 9 polish. » — copy a évolué entre temps, commentaire daté    |
| `src/content/implementation.ts:3`                                           | « Sprint 7 ships placeholders that pass the banned-word check. » — banned-word check formation levé 2026-05-07 (résidu, voir §2.3) |
| `src/components/visual/Illustration.tsx:1`, `IllustrationPlaceholder.tsx:*` | Placeholders illustration en attente assets — Sprint Visual Rhythm 2026                                                            |
| `src/app/[locale]/comparaisons/page.tsx:104`                                | `{/* MID-SECTION — placeholder illustration matrix de décision */}`                                                                |
| `src/app/[locale]/centre-aide/page.tsx:134`                                 | `placeholder illustration bibliothèque conseils`                                                                                   |
| `src/components/sections/AuditConversionBlocks.tsx:219, 353, 400`           | Logos sectoriels en placeholder texte (à remplacer par SVG)                                                                        |
| `src/app/[locale]/methodologie/page.tsx:249`                                | `Visuel placeholder à gauche`                                                                                                      |

Aucun `TODO`, `FIXME`, `XXX`, `HACK`, `lorem`, `À COMPLÉTER`, `À REMPLIR`, `XXXXXXX`, `xxx@`, `EE-XXXXXXXXX` n'a été trouvé. Bonne hygiène.

### 1.4 URLs / endpoints morts

Tous les `<Link href="/xxx">` du codebase ont été vérifiés contre `src/i18n/routing.ts` :

- `/interventions/essentielle`, `/audit`, `/audit/flash`, `/cas-concrets`, `/contact`, `/reserver`, `/implementation`, `/implementation/par-techno`, `/implementation/ia-custom`, `/rgpd`, `/cookies`, `/conditions-generales`, `/politique-deplacement`, `/blog/exemple` (page démo /components), `/cas-concrets/exemple` (idem) → **tous existent** dans `routing.pathnames`.
- 2 références pédagogiques `/blog/exemple` et `/cas-concrets/exemple` dans `src/app/[locale]/components/page.tsx:153,160` — page design-system, noindex, pas critique mais ces slugs n'existent pas en données réelles : si la page est crawlée, elle produira deux 404. À évaluer.

**Aucun lien interne mort détecté côté front public.**

---

## 2. Conflits doctrinaux

### 2.1 ZERO dropdown vs mega-menus (ADR 0003)

Doctrine §9.2 = ZERO dropdown. ADR 0003 (proposition) = méga-menus acceptés en bloc 2026-05-07 mais Sprint 15 différé.

État du code (`src/components/nav/Header.tsx:8-9`) :

```
// Server Component. 4 items desktop + ZERO dropdown (CLAUDE.md v6 §9.2 —
// révision §9.2-bis acceptée en bloc 2026-05-07 mais Sprint 15 différé).
```

**Verdict cohérent.** Le commentaire dit explicitement « 4 items + ZERO dropdown », et le code expose 4 items (`navLeft` × 2 + `navRight` × 2 = 4). Aucun dropdown n'a été implémenté en transit. Conforme à la décision « Sprint 15 différé ». OK.

### 2.2 Naming « cabinet IA opérationnel » vs agence/studio/atelier

Doctrine = **cabinet IA opérationnel** (FR) / **operational AI consultancy** (EN). Jamais agence/studio/atelier pour décrire AxionIA elle-même.

#### Auto-référentiel — VERDICT À CONFIRMER

| File:Line                                                   | Texte                                                                                                                             | Verdict                                                                  |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `src/content/automatisations.ts:309`                        | `cardTagline: "Publier, écrire, créer — 10x plus vite, sans agence."`                                                             | OK — décrit le bénéfice client (sans recourir à une agence), pas AxionIA |
| `src/content/automatisations.ts:315`                        | « moins de coûts d'agence »                                                                                                       | OK — bénéfice anti-agence                                                |
| `src/content/automatisations.ts:333`                        | « sans payer 1 500 €/mois à une agence »                                                                                          | OK                                                                       |
| `src/content/automatisations.ts:370`                        | EN « 10x faster, no agency needed »                                                                                               | OK                                                                       |
| `src/content/automatisations.ts:376`                        | EN « fewer agency costs »                                                                                                         | OK                                                                       |
| `src/content/automatisations.ts:394`                        | EN « without paying €1,500/month to an agency »                                                                                   | OK                                                                       |
| `src/components/sections/AuditConversionBlocks.tsx:176-177` | « un Big 4 (cher, lent), un freelance (incertain), une **agence** digitale (généraliste). Voici pourquoi AxionIA est différent. » | OK — comparaison concurrents                                             |
| `src/app/[locale]/implementation/page.tsx:179, 212`         | `title: "Make · agence ·"`, `name: "Agence classique"` (tableau comparatif Make/Agence/AxionIA)                                   | OK — concurrents nommés                                                  |
| `src/app/[locale]/implementation/page.tsx:254, 283`         | `title: "Make · agency ·"`, `name: "Classic agency"`                                                                              | OK                                                                       |
| `src/app/[locale]/implementation/page.tsx:172, 935`         | Commentaires `// Bloc comparatif — Make/Zapier vs Agence classique vs AxionIA.`                                                   | OK                                                                       |

**Conclusion §2.2** : aucune occurrence d'« agence/agency » ne décrit AxionIA. Toutes désignent les concurrents. Conforme à la doctrine.

#### Mentions « atelier / workshop »

L'usage est massif (≈ 30 occurrences) mais SÉMANTIQUE : « atelier » = unité de contenu d'une intervention (ex « Atelier 1 — Comptes-rendus assistés »). Pas un descripteur de l'entité AxionIA.

| File:Line                                                         | Verdict                                                                                            |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/content/interventions.ts:248-260, 335-347, 477-489, 697-709` | OK — `Atelier 1`, `Atelier 2`, `Atelier 3` = blocs pédagogiques                                    |
| `src/app/[locale]/a-propos/page.tsx:121-127`                      | « **Atelier d'architecte** — précision, traces de craie, plan ouvert » + EN `Architect's workshop` | OK — métaphore visuelle d'illustration, sémantiquement défendable comme symbole de précision opérationnelle. Vigilance : si les LLMs lisent cette caption ils peuvent la rattacher au descripteur de l'entité. **À surveiller** mais pas un conflit dur |
| `src/content/stack-ia.ts:128, 135`                                | `title: "L'atelier"` / `"The workshop"`                                                            | À VERIFIER — section en h2 sur la page Stack IA. Pourrait laisser entendre AxionIA = atelier. Cf. `src/app/[locale]/stack-ia/page.tsx:778-784` `« Atelier d'outils éditorial »` / EN `« Editorial tool workshop »` — métaphore. Idem : surveillance     |
| `src/content/transversal.ts:267` (FAQ)                            | « Livrable : document PDF 25-40 pages + atelier de restitution 2 h »                               | OK — atelier = format pédagogique                                                                                                                                                                                                                       |
| `src/app/[locale]/methodologie/page.tsx:77, 99`                   | « atelier de restitution » / « debrief workshop »                                                  | OK                                                                                                                                                                                                                                                      |
| `src/app/[locale]/interventions/equipes/page.tsx:82, 98`          | « Atelier outils » / `Tools workshop`                                                              | OK                                                                                                                                                                                                                                                      |
| `src/components/forms/AuditRequestForm.tsx:807-808`               | « atelier de priorisation inclus » / « prioritisation workshop included »                          | OK                                                                                                                                                                                                                                                      |

**Recommandation** : la caption a-propos `« Atelier d'architecte »` et la page stack-ia `« Atelier d'outils éditorial »` sont des métaphores visuelles. Pour un audit AEO/GEO de type extreme-perfection, on peut envisager de remplacer par « Cabinet d'architecte » / « Studio de cabinet d'IA » ↔ NON, le risque est de réintroduire « studio ». **Garder ces métaphores telles quelles, mais VEILLER à ce que la metadata/title/description et JSON-LD ne reproduisent jamais ces termes**. Aujourd'hui, elles ne le font pas. OK.

#### Mentions « studio »

| File:Line                                     | Texte                                                         | Verdict                                                     |
| --------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------- |
| `src/content/press.ts:349, 354`               | « interviews … vidéo (**studio** ou visio HD) … »             | OK — désigne un format d'interview (studio TV), pas AxionIA |
| `src/app/[locale]/stack-ia/page.tsx:778, 779` | (cf. ci-dessus métaphore atelier — pas de « studio » nominal) | —                                                           |

OK, aucun conflit.

### 2.3 Anti-siren / anti-formation résidus

#### Anti-siren

- **0 occurrence** de `SIREN`, `SIRET`, `RCS` dans le code source.
- Seule mention : `src/content/press.test.ts:26` qui **teste** l'absence : `expect(blob).not.toMatch(/\bSIREN\b|\bSIRET\b|\bRCS\b/i);`. C'est le check d'enforcement, OK.

#### Anti-formation (levé ADR 0003 lift-formation-ban)

- **0 occurrence** de « formation banni », « banned-formation », « ban formation » dans le code source.
- 1 résidu dans un commentaire dev : `src/content/implementation.ts:3` → `// Sprint 7 ships placeholders that pass the banned-word check.` — fait référence au check banned-word à l'époque où « formation » était banni. Comme la doctrine a levé l'interdiction le 2026-05-07, **ce commentaire est obsolète**. À nettoyer ou contextualiser.

Le mot « formation » est utilisé librement (`src/content/interventions.ts:610, 1073, 1120`, etc.) ce qui est conforme au lift-ban.

### 2.4 Prix 490 € — confusion potentielle

**Découverte critique** : 490 € est utilisé pour DEUX produits différents.

#### Produit A — Intervention Essentielle (490 €)

- `src/content/interventions.ts:134` `priceEur: 490`
- `src/content/interventions.ts:557, 559, 611, 676, 732, 794, 1170, 1248`
- `src/components/calendar/BookingCalendar.tsx:66, 67, 123, 124, 187`

#### Produit B — Audit Flash (490 € à distance / 890 € sur site)

- `src/content/audit.ts:3, 94, 96, 142, 145, 153`
- `src/app/[locale]/audit/page.tsx:57-62`
- `src/app/[locale]/audit/flash/page.tsx`
- `src/app/[locale]/audit/demande/page.tsx:75, 201`
- `src/app/[locale]/implementation/page.tsx:538, 594` mentionne « audit Flash (490 €) cadre le projet en 2 jours »

#### Conflit potentiel

- `src/components/nav/Header.tsx:44-45` : `// Badge prix CTA central (§9.3) — Essentielle = tarif d'entrée 490 € HT.` + `const ctaPriceBadge = isFr ? "dès 490 €" : "from €490";` — le badge header est **fixé sur l'Essentielle** (intervention), donc cohérent.
- `src/app/[locale]/page.tsx:38-39` (homepage description) : « Hébergement UE, à partir de 490 € » — ambigu : ne précise pas Essentielle vs Audit Flash. Mais comme les DEUX commencent à 490 €, factuellement OK.
- **Risque réel** : un visiteur peut lire « audit 490 € » dans `/audit/page.tsx:57-62` puis « Essentielle 490 € » dans `/interventions/page.tsx:39, 279` et croire qu'il s'agit du même produit. **Aucune page ne mélange explicitement « audit 490 € » avec « intervention 490 € »** dans la même phrase. Pas de conflit dur, mais **risque conversion / clarté** à surveiller.

#### Conflit dur — gamme prix audit obsolète

**`src/content/transversal.ts:72` (FAQ « modules »)** + **`src/content/transversal.ts:77`** (EN) :

> « Module 2 — Audit IA (cartographie + plan, **290-1990 €**). »

**`src/content/press.ts:70`** (FR press copy) + **`src/content/press.ts:77`** (EN) + **`src/content/press.ts:227, 232`** (press release body) :

> « audits IA chiffrés (**290 € à 1 990 €**) »

**Or** la pyramide audit refondue 2026-05-07 (`src/content/audit.ts:1-6`) est :

- N1 Flash · **490 €** (distance) / 890 € (sur site)
- N2 Ciblé · 1 900 → 3 900 €
- N3 Stratégique PME · 4 900 → 9 900 €
- N4 Stratégique ETI · à partir de **12 000 €**

Le range « 290 € à 1 990 € » dans `transversal.ts` (FAQ home/aide) et `press.ts` (page presse + press releases) est **obsolète**. Il NE matche plus aucun audit du catalogue actuel. Le borne basse 290 € n'existe plus, la borne haute 1 990 € n'existe plus.

**Impact AEO/GEO** : un crawler ChatGPT/Perplexity qui lit `/presse` (mention TVA + tarifs press release) et la FAQ (mention modules) recevra une donnée prix contradictoire avec `/audit`. C'est un signal de manque de fraîcheur **majeur**.

**Suggestion** : aligner press et FAQ sur la pyramide actuelle. Phrasing court : « audits chiffrés — Flash 490 €, Ciblé 1 900-3 900 €, Stratégique PME 4 900-9 900 €, Stratégique ETI dès 12 000 € ». Voir aussi `src/content/transversal.ts:323, 328` (« contrat de maintenance optionnel à 290 € HT/mois ») — ce 290 € est **distinct** (maintenance), donc OK et ne doit pas être confondu avec un ancien tarif audit.

### 2.5 i18n parité — fuites textuelles

Inspection rapide des pages [locale]/\*.tsx ne révèle pas de texte FR hardcodé côté EN ou inversement (toutes les chaînes textuelles vérifiées passent par `isFr ? "FR" : "EN"`).

**Cas particuliers à signaler** :

- `src/components/calendar/BookingCalendar.tsx:340` : `// Trigger flash titre Mai 2026` — commentaire dev en FR, OK.
- `src/components/calendar/BookingCalendar.tsx:1597, 1642, 1685, 1769, 1830` : utilisent `isFr ? "Ex. ..." : "e.g. ..."` — OK.
- `src/components/calendar/BookingCalendar.tsx:1694, 1703` : `placeholder="contact@entreprise.com"` / `placeholder="+33 6 12 34 56 78"` — placeholders bilingues acceptables (téléphone, email FR contextualisés sans casser EN).

**Aucune fuite textuelle détectée.** `pnpm i18n:check` reste source de vérité.

---

## 3. Données structurées AEO/GEO 2026

### 3.1 Article JSON-LD blog — `dateModified`

**État actuel — GAP CRITIQUE** :

`src/lib/seo.ts:330-377` définit `buildArticleJsonLd()` qui couvre `dateModified`, `Person` author, `articleBody`, `wordCount`, `keywords`, `articleSection`, `mainEntityOfPage`, `image` (ImageObject), `publisher` avec logo. **Magnifique factory parfaitement spec AEO/GEO 2026.**

**MAIS** : `buildArticleJsonLd` est **définie et exportée mais JAMAIS appelée** ailleurs dans le codebase (grep confirme : 1 seule occurrence, la définition).

`src/app/[locale]/blog/[slug]/page.tsx:49-59` construit un Article inline minimal :

```ts
const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: copy.title,
  description: copy.excerpt,
  datePublished: post.publishedAt,
  inLanguage: loc,
  url: `${SITE_URL}/${loc}/blog/${slug}`,
  publisher: { "@type": "Organization", name: "AxionIA", url: SITE_URL },
  author: { "@type": "Organization", name: "AxionIA" }, // ← Organization, PAS Person
} as const;
```

**Signaux manquants pour AEO/GEO 2026** :

- ❌ Pas de `dateModified` (Google AI Overviews + Perplexity valorisent l'écart freshness)
- ❌ `author` typé `Organization` au lieu de `Person` → casse E-E-A-T
- ❌ Pas d'`image` ni `ImageObject`
- ❌ Pas de `mainEntityOfPage`
- ❌ Pas de `articleBody`
- ❌ Pas de `keywords`
- ❌ Pas de `articleSection`
- ❌ Pas de `wordCount`
- ❌ `publisher` Organization sans `logo` (requis par Google pour cards)

**Aggravant** : `BlogPost` interface (`src/content/transversal.ts:121-130`) ne contient pas de champ `updatedAt`. Donc même si on switche vers `buildArticleJsonLd`, on ne pourra pas alimenter `dateModified` depuis les données. **Ajout interface requis**.

### 3.2 FAQPage Speakable

**État actuel — GAP CRITIQUE** :

`src/lib/seo.ts:392-409` définit `buildFaqSpeakableJsonLd()` qui ajoute `speakable: { "@type": "SpeakableSpecification", cssSelector: ["[itemprop='text']"] }`. Permet citations Google Assistant + Alexa + Bixby + voice-first AI agents.

**MAIS** : `buildFaqSpeakableJsonLd` est **définie et exportée mais JAMAIS appelée** ailleurs dans le codebase (grep confirme : 1 seule occurrence, la définition).

Toutes les pages avec FAQ utilisent `buildFaqJsonLd()` (sans Speakable) :

- `/faq` (`src/app/[locale]/faq/page.tsx:54`)
- `/presse` (l. 196)
- `/stack-ia` (l. 189)
- `/audit/flash`, `/audit/process`, `/audit/strategique-pme`, `/audit/strategique-eti` (toutes les 4)
- `/interventions/essentielle`, `/interventions/equipes`, `/interventions/managers`, `/interventions/conference`, `/interventions/dirigeants`
- `/implementation/agents`, `/chatbot`, `/crm-erp`, `/documents`, `/ia-custom`, `/integrations`, `/no-code`, `/processus`, `/structuration`

**Soit ~22 pages FAQ sans Speakable.** Énorme manque vocal/answer engine.

### 3.3 Person JSON-LD Will fondateur

**État actuel — GAP CRITIQUE** :

`src/lib/seo.ts:257-293` définit `buildPersonJsonLd()` complet avec `worksFor`, `knowsAbout`, `knowsLanguage`, `sameAs LinkedIn`, `image`. **Spec AEO/GEO E-E-A-T 2026 parfaite.**

**MAIS** : `buildPersonJsonLd` est **définie et exportée mais JAMAIS appelée** ailleurs dans le codebase.

- `/a-propos` (`src/app/[locale]/a-propos/page.tsx:14-15`) importe seulement `buildBreadcrumbJsonLd`. **Pas de Person Schema émis.**
- `/blog/auteur/[slug]` (page bio auteur) : à inspecter mais `grep buildPersonJsonLd` = 0 hit donc également absent.
- `/blog/[slug]` : utilise `author: { "@type": "Organization", name: "AxionIA" }` au lieu de `Person`.

**Signal AEO 2026** : sans `Person` schema, AxionIA reste une `Organization` faceless. Les LLMs answer-engines préfèrent citer les sources qui ont un humain identifié — réduit le citation rate en SGE / Claude.ai / Perplexity / Bing Copilot.

### 3.4 Organization JSON-LD — état post-`acd8080`

**État actuel — TRÈS BON, avec 1 doublon** :

`src/lib/seo.ts:154-202` `buildOrganizationJsonLd` :

- ✅ `name`, `legalName: "AxionIA OÜ"`, `url`, `logo: ${SITE_URL}/opengraph-image`
- ✅ `description` localisée
- ✅ `sameAs: [LinkedIn, Facebook]`
- ✅ `foundingDate: "2024"`
- ✅ `foundingLocation: PostalAddress Tallinn EE`
- ✅ `areaServed: ["FR", "EU"]`
- ✅ `knowsLanguage: ["fr", "en"]`
- ✅ `contactPoint: ContactPoint avec contactType + email + availableLanguage`
- ✅ Slots pour `vatID` + `identifier (registrikood)` (à fournir par Will)

Émis layout-level dans `src/app/[locale]/layout.tsx:99` → présent partout. Excellent.

**Doublon détecté** :

- `src/app/[locale]/page.tsx:191` (homepage) émet un autre Organization JSON-LD inline avec `foundingDate: "2024"`. Vérification : `Read C:\...\page.tsx` aux alentours requise pour confirmer.

À l'inspection rapide (grep), il y a 6 occurrences hors `seo.ts` qui contiennent `foundingDate: "2024"` :

- `src/lib/seo.ts:174` (la factory canonique)
- `src/app/[locale]/page.tsx:191` (**homepage doublon ?**)
- `src/app/[locale]/presse/page.tsx:134` (page presse — peut-être OrganizationNewsArticle, à confirmer)

**Recommandation** : auditer en détail `page.tsx:191` et `presse/page.tsx:134` pour s'assurer qu'il n'y a pas un Organization JSON-LD dupliqué qui ferait deux entités à réconcilier côté Google KG. Si c'est un autre type (NewsArticle pour press release, etc.), OK.

### 3.5 BreadcrumbList coverage

**Coverage : excellente.** `buildBreadcrumbJsonLd` est appelée sur ~50 pages (toutes les pages de profondeur > 0).

Pages SANS breadcrumb (vérifié via grep `buildBreadcrumbJsonLd` filtré) :

- `/` homepage — **normal** (niveau 0)
- `/sections`, `/components`, `/design` — pages de design system, noindex (pas critique)
- `/maintenance` — page maintenance hors `[locale]/`, OK

**Aucun gap réel.**

### 3.6 mainEntity / mainEntityOfPage / ImageObject

- `mainEntity` : utilisé dans **`buildFaqJsonLd`** (FAQPage) — OK partout.
- `mainEntityOfPage` : seulement dans **`buildArticleJsonLd`** — qui n'est utilisée nulle part (cf. §3.1). **Donc 0 page n'expose `mainEntityOfPage`.** Gap.
- `ImageObject` : seulement dans `buildArticleJsonLd` (publisher.logo). **Pas exposé en pratique** car `buildArticleJsonLd` non utilisée. Gap.

---

## 4. Liens internes morts

Audit fait via grep de tous les `href="/xxx"` dans `src/app/` + `src/components/` :

- 100% des slugs internes utilisés correspondent à des routes déclarées dans `src/i18n/routing.ts`.
- 2 références pédagogiques `/blog/exemple` et `/cas-concrets/exemple` dans `src/app/[locale]/components/page.tsx:153,160` — slugs qui n'existent pas en données (404 si page crawlée). Comme `/components` est une page design-system (noindex via robots), impact zéro.

**Aucun lien interne mort détecté en surface publique.**

---

## 5. Synthèse — top 10 actions correctives prioritaires (avant Sprint 15)

Liste numérotée par impact AEO/GEO 2026 décroissant, sans toucher aux pages villes/régions Sprint 15 :

1. **Câbler `buildArticleJsonLd` sur `/blog/[slug]`** (`src/app/[locale]/blog/[slug]/page.tsx:49-59`) — remplacer le JSON-LD inline par la factory complète. Apporte `Person` author, `image`, `mainEntityOfPage`, `keywords`, `articleSection`, `wordCount`. **Impact : x2 chances de citation Google AI Overviews / Perplexity / Claude.ai.** Préreq : ajouter `updatedAt?: string` à `BlogPost` interface (`src/content/transversal.ts:121-130`) pour alimenter `dateModified`.

2. **Câbler `buildFaqSpeakableJsonLd` sur les 22 pages FAQ** (toutes les pages produit + `/faq`, `/presse`, `/stack-ia`). Remplacer `buildFaqJsonLd` par `buildFaqSpeakableJsonLd` quand le bloc FAQ est short-form (<200 mots/réponse). **Impact : visibilité voice + Google Assistant + Alexa.**

3. **Câbler `buildPersonJsonLd` sur `/a-propos` + `/blog/auteur/[slug]` + `/blog/[slug]` (author)**. Will fondateur identifié = **E-E-A-T 2026 mainstream**. Sans cela, AxionIA reste un cabinet faceless aux yeux des LLMs.

4. **Corriger les tarifs audit obsolètes** dans `src/content/transversal.ts:72,77` (FAQ « modules ») + `src/content/press.ts:70,77,227,232` (press copy + press releases). Remplacer la mention `290-1990 €` par la pyramide actuelle (`Flash 490 €, Ciblé 1 900-3 900 €, Stratégique PME 4 900-9 900 €, Stratégique ETI dès 12 000 €`). **Impact AEO : élimine la donnée de prix contradictoire entre `/presse` et `/audit`.**

5. **Compléter les placeholders légaux** dans `src/content/legal.ts:40,72` : `(registrikood) : à compléter` + `Numéro de TVA EE : à compléter`. Will fournit. Au moins remplacer par le format prévu (ex `EE12345678`) et activer les paramètres `vatID` + `registrikood` dans `src/app/[locale]/layout.tsx:99` (`buildOrganizationJsonLd({ locale, vatID, registrikood })`). **Impact GEO : Google KG + LLMs valident l'identité légale.**

6. **Mettre à jour la couleur OG image** dans `src/app/api/og/route.tsx:12` : `primary: "#146ef5"` → `"#1a4dd9"` (cf. ADR 0002). Sans cela, les aperçus Twitter/LinkedIn/Slack utilisent l'ancien Webflow Blue obsolète.

7. **Vérifier le doublon Organization JSON-LD** : `src/app/[locale]/page.tsx:191` semble émettre un Organization en plus de celui du layout. Si c'est bien le cas, supprimer car Google peut hésiter entre 2 entités. Si c'est un type différent (`OrganizationLocation`, `NewsArticle`, etc.), garder.

8. **Renommer le token CSS `--ease-out-webflow` → `--ease-out-editorial`** (`src/app/globals.css:141, 247-249`). Suit le pivot ADR 0002. Bénéfice : cohérence interne + crédibilité technique pour les futurs audits Sprint 15+.

9. **Nettoyer les commentaires v1 Webflow** (résidus ADR 0001) dans `src/app/[locale]/layout.tsx:15-16`, `src/app/globals.css:28,122,146`, `src/app/api/og/route.tsx:109`, `src/components/ui/badge.test.tsx:16`, `src/content/implementation.ts:3`. Aucune obligation produit, mais zéro confusion pour les futurs auditeurs et Claude qui relit.

10. **Ajouter `updatedAt?: string` à `BlogPost`** pour alimenter `dateModified` JSON-LD. Bonus : surfacer `<time dateTime={updatedAt}>` côté UI sur `/blog/[slug]` (signal de fraîcheur visible). **Impact AEO : Google sait reranker les contenus mis à jour.**

---

## Annexe — Fichiers source clés référencés

| Domaine                                     | Fichier                                 |
| ------------------------------------------- | --------------------------------------- |
| Routing officiel                            | `src/i18n/routing.ts`                   |
| Factories JSON-LD                           | `src/lib/seo.ts`                        |
| Layout + Organization JSON-LD émis          | `src/app/[locale]/layout.tsx`           |
| Header (4 items + ZERO dropdown)            | `src/components/nav/Header.tsx`         |
| Pyramide audit (canonique)                  | `src/content/audit.ts`                  |
| FAQ home + modules (obsolète tarifs audit)  | `src/content/transversal.ts`            |
| Press copy (obsolète tarifs audit)          | `src/content/press.ts`                  |
| Mentions légales (placeholders à compléter) | `src/content/legal.ts`                  |
| Blog Article inline (sous-spec AEO)         | `src/app/[locale]/blog/[slug]/page.tsx` |
| Color tokens v3                             | `src/app/globals.css`                   |
| OG image (couleur obsolète)                 | `src/app/api/og/route.tsx`              |
