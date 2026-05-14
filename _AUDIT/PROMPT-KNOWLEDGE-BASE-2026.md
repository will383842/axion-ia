# PROMPT — KNOWLEDGE BASE AXION-IA 2026 — V4 KNOWLEDGE FACTORY INDUSTRIELLE (100% AUTO)

> **V2 — 2026-05-13** : ajout des dimensions manquantes après audit complétude (accessibilité WCAG 2.2 AA, E-E-A-T, editorial pipeline, pipeline médias, multi-format output, import tooling, quality score, slug history, TOC/readability, templates éditeur, scheduled publish, notifications, annotations, collections, backup/DR, coûts chiffrés). 18 agents (vs 12 V1), 35 critères (vs 20), scoring /300 (vs /200), 22 livrables (vs 16).
>
> **V3 — 2026-05-13 (révision après reality check repo)** : ancrage sur les modèles Prisma **réellement existants** (`Article`, `CaseStudy`, `FAQ`, `HelpArticle`, `Category` — pas `BlogPost`/`FaqEntry` inventés en V1/V2), préservation des routes publiques FR existantes (`/blog/`, `/cas-concrets/`, `/centre-aide/`, `/glossaire/`, `/guide-ia/`, `/faq/`) avec la KB comme **backend unifié** et non remplacement, doctrine linguistique stricte (admin FR `/connaissances/`, public FR-first parity EN), **structure de dossiers cible exhaustive** (§11 nouvelle), **plan d'implémentation de bout en bout** chiffré et séquencé (§13 nouvelle), naming conventions formalisées (§14), risques + mitigations (§15).
>
> **V4 — 2026-05-14 (Knowledge Factory Industrielle 100% automatique)** : pivot scope majeur après confirmation Will. Cible volume = **100 entrées/jour publiées automatiquement** (~36 500/an), production assistée IA via `PROMPT-CONTENT-GENERATOR-MASTER-2026.md`, **zéro review humain V1** (workflow auto avec gates de qualité + dedup pgvector + PII scan + SEO/AEO/GEO auto-générés). Scope élargi écosystème IA en entreprise (12 nouveaux types : `automation_recipe`, `tool_review`, `industry_use_case`, `comparison`, `implementation_playbook`, `prompt_pattern`, `roi_calculator_template`, `intervention_module`, `competence_boost`, `secteur_brief`, `dept_brief`, `metier_brief`). **FR uniquement V1** (architecture multilingue préservée, EN activable V2). pgvector basculé **V1 obligatoire** (dedup + recherche à ce volume). Mot « formation » BANNI partout (doctrine `axionia-core`). Pipeline éditorial humain (KB-13/17/18) refondu en **gates automatiques + monitoring**. Voir nouvelles sections §17 (Knowledge Factory) + §18 (Décisions V4 actées).

> # 🧭 MODE EN DEUX TEMPS — AUDIT-FIRST PUIS BUILD SUR GO
>
> **Phase A (par défaut)** = AUDIT-ONLY. Aucune écriture hors `_AUDIT/KNOWLEDGE-BASE-2026/`. Aucune migration. Aucun `pnpm add`. Aucun commit.
>
> **Phase B (déclenchée explicitement par Will via le mot-clé `GO BUILD KB-SPRINT-N`)** = implémentation d'un sprint précis défini en Phase A. Jamais plus d'un sprint à la fois. Jamais sans GO écrit.
>
> Tu N'ES PAS autorisé à passer de A à B tout seul, même si la cible semble triviale. Tu termines Phase A entièrement, tu poses un STOP & ASK avec le plan de sprints, et tu attends.

---

**Cible** : Axion-IA (`https://axion-ia.com`) — _cabinet IA opérationnel B2B premium_
**Date prompt** : 2026-05-13
**Statut prod** : V2.1 LIVE Hetzner CPX32 + Cloudflare Free + Coolify (auto-deploy GitHub Actions)
**Référence code** : `HEAD` de `main` (origin), worktree `Axion-IA/axionia/`
**Mode** : **AUDIT-FIRST + BUILD INCRÉMENTAL SUR GO EXPLICITE**
**Profondeur** : _extrême_ — chaque type de contenu, chaque flux d'édition, chaque surface de consommation, chaque obligation RGPD
**Output racine audit** : `_AUDIT/KNOWLEDGE-BASE-2026/` (créer si absent)
**Output code (Phase B uniquement)** : sources sous `axionia/src/`, schéma Prisma sous `axionia/prisma/`

---

## 0. CONTRAT D'EXÉCUTION

Tu es **l'architecte produit + tech + UX + contenu + IA** mandaté par le fondateur (Will, `williamsjullin@gmail.com`). Mission : concevoir et planifier (puis livrer sprint par sprint) un **système de Knowledge Base unifié, extrêmement complet, professionnel, scalable, modifiable, intégralement gérable depuis la console d'administration `[adminPrefix]`**, capable de :

1. **Héberger toutes les formes de connaissance** d'Axion-IA (articles, FAQ, glossaire, études de cas, playbooks, méthodologies, doctrine, ADRs, prompts internes, templates email/devis, SOPs, veille IA, terminologie juridique/fiscale, onboarding client, politique commerciale, post-mortems infra, fiches concurrents, fiches outils).
2. **Servir simultanément 4 surfaces** : (a) interne (équipe + Will), (b) client connecté (post-booking), (c) public SEO/AEO/GEO, (d) RAG pour fonctionnalités IA Axion-IA (chatbot futur, autoresponder formulaire, suggestion contextuelle dans l'admin).
3. **Tourner sans douleur sur Hetzner CPX32** (CPU/RAM contraints, pas d'élasticité auto, pas de service externe payant — pgvector OUI, Pinecone NON).
4. **Rester intégralement DB-managé** (jamais de connaissance critique en MDX flat-file gérée hors admin pour V1, sauf décision Will explicite sur un cas particulier).
5. **Supporter une rédaction incrémentale** par Will + équipe (et plus tard agents IA), avec workflow validé, versionning, audit log, RGPD.

### 0.0 Critères de perfection (la cible V1)

1. **Un seul modèle racine** `KnowledgeEntry` polymorphique, extensible par champ `type` enum (et non par tables séparées proliférantes). Les artefacts admin existants (`blog`, `case-studies`, `faq`, `help`, `categories`) sont soit migrés vers le modèle unifié, soit explicitement justifiés comme cas à part (décision Phase A).
2. **Édition WYSIWYG riche** dans l'admin (Tiptap JSON, comme déjà en place pour `blog` et `case-studies`), avec preview live, autosave draft, raccourcis clavier, support markdown collé.
3. **Multilingue FR/EN parity** strict : chaque entrée a un slug racine + 1..N traductions liées. Cible V1 = FR obligatoire, EN optionnel par entrée (pas de mur).
4. **Workflow états** : `draft → review → published → archived` + état spécial `deprecated` (publié mais visiblement remplacé). Transitions tracées dans `ActivityLog`.
5. **Versionning** complet : chaque save crée une version (DB row immutable), diff visuel disponible, rollback en 1 clic.
6. **Taxonomie 3 axes** : `type` (polymorphique), `domain` (commercial / technique / juridique / RH / produit / client / veille / interne), `tags[]` libres modérés. Catégories existantes (blog `categories`) absorbées comme tags ou comme champ `category` selon décision Phase A.
7. **Audience + confidentialité** : `audience` enum (`public`, `client`, `team`, `will-only`) + `confidentiality` enum (`public`, `internal`, `confidential`, `secret`). Le couple détermine la visibilité sur chaque surface.
8. **Cycle de vie** : `reviewedAt`, `reviewDueAt`, `expiresAt`. Cron mensuel surface entrées en retard de revue dans `/alerts`.
9. **Sources & citations** : chaque entrée peut référencer (a) URLs externes, (b) autres `KnowledgeEntry` (graphe interne typé : `replaces`, `relatedTo`, `cites`, `dependsOn`), (c) artefacts repo (`_AUDIT/*.md`, commits, ADRs).
10. **Recherche** : (a) full-text Postgres (FR + EN, déjà présent via migrations `migrations_fts/`), (b) facettes (type, domain, audience, status, tags), (c) sémantique optionnelle via pgvector — V1 minimum = FTS ; sémantique = V1.5 si pgvector déjà installé, sinon V2.
11. **Surface publique préservée + hub agrégateur** : les URLs existantes restent en place (`/fr/blog/[slug]`, `/fr/cas-concrets/[slug]`, `/fr/centre-aide/[slug]`, `/fr/glossaire/[slug]`, `/fr/guide-ia/[slug]`, `/fr/faq/`) et continuent d'être servies, mais alimentées depuis le **backend unifié `KnowledgeEntry`** (zéro perte SEO, zéro 301 sur les anciennes URLs). Nouveau **hub `/fr/ressources/`** créé pour agrégation cross-type, filtre par tags + recherche unifiée + flux RSS global. JSON-LD `Article`/`FAQPage`/`HowTo`/`DefinedTerm`/`TechArticle` selon `type`. Sitemap auto. Parity EN via `/en/resources/`, `/en/blog/`, `/en/case-studies/`, etc. (slugs traduits par `KnowledgeTranslation`).
12. **Surface client** sous `/fr/mes-ressources/` (login NextAuth requis), filtrée par `audience IN ('public', 'client')` et par les tags du booking du client.
13. **Surface interne admin en FRANÇAIS** sous `/fr/<adminPrefix>/connaissances/` (et non `/knowledge/`) avec : liste filtrable + tri + recherche, détail page dédiée (pas drawer pour permettre URL partageable), éditeur Tiptap, onglets latéraux (Contenu, Métadonnées, Relations, Versions, Publication, RGPD, Médias). Sous-routes : `/connaissances/calendrier`, `/connaissances/sante`, `/connaissances/medias`, `/connaissances/imports`, `/connaissances/etiquettes`, `/connaissances/auteurs`. Le reste de l'admin existant (`/blog`, `/faq`, `/help`, `/case-studies`, `/categories`) **n'est PAS supprimé** mais marqué `legacy` et redirigé progressivement vers `/connaissances/?filter=type=...` (décision Phase A : Big Bang ou Strangler).
14. **Bulk operations admin** : import CSV/JSON, export JSON, bulk tag, bulk archive, bulk re-review.
15. **API interne** : `/api/internal/kb/search`, `/api/internal/kb/embed` (Phase A : décider si exposé), `/api/internal/kb/rag` (RAG endpoint pour futur chatbot, cacheable).
16. **RGPD propre** : aucune donnée client identifiable dans une entrée publique. Audit `pii-redaction.ts` étendu pour scanner les entrées avant publication. Retention `expiresAt` honorée par cron `retention-purge`.
17. **Zéro hardcode** : la liste des types KB, la liste des domaines, le mapping type → JSON-LD, le mapping type → template rendu — tout dans `src/content/knowledge-base.ts` SSOT (style `pricing.ts`, `interventions-taxonomy.ts`).
18. **Tests** : ≥ 30 tests unitaires sur les server actions KB, ≥ 10 tests intégration sur l'éditeur, ≥ 5 tests E2E (création → publication → consultation publique → archivage).
19. **Web Vitals** : pages publiques KB respectent les budgets (`LCP ≤ 1800`, `INP ≤ 100`, `CLS = 0`). Pas de JS client lourd sur la consultation publique.
20. **Observabilité** : événement Plausible `kb_view` + `kb_search` + `kb_helpful` (👍/👎 en bas de page publique). Logs structurés Sentry sur erreurs édition.
21. **Accessibilité WCAG 2.2 AA strict** sur toutes surfaces publiques + client : contrast ≥ 4.5:1 body / ≥ 3:1 large text, navigation clavier complète (TOC, éditeur, search), focus visible, headings hiérarchisés sans saut, alt text obligatoire à la publication (bloquant), aria-live sur autosave indicator, `prefers-reduced-motion` respecté, `lang` correct par traduction, skip-links.
22. **E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness)** : chaque entrée publique affiche bio auteur (avatar + 1-2 lignes + lien profil interne), date `publishedAt` + `lastReviewedAt` (jamais cacher), `reviewedBy` distinct de `author` si pair-review, badge `fact-checked` si applicable, citations sources visibles en bas, bouton « comment citer cette page » (BibTeX + APA + lien permanent).
23. **Pipeline médias** : asset library DB-managée (`KnowledgeAsset`), upload via server action vers volume Hetzner persistant (Coolify volume mount), conversion `sharp` AVIF + WebP + fallback JPEG/PNG, génération de variantes responsive (`srcset` 320/640/1024/1920), alt text suggéré par IA (V1.5) éditable, métadonnées EXIF strippées (RGPD), CDN via Cloudflare Cache Rules existantes, hash de contenu pour cache-busting, soft delete + garbage collect après 30 j.
24. **Cover image + hero media** : chaque entrée a un champ `coverImage` (asset reference) + `heroLayout` enum (`schema`, `photo`, `illustration`, `none`). Réutilisation des `HeroSchema` existants (mémoire `axionia_hero_schema_v3_2`) côté rendu type-spécifique.
25. **TOC + reading time + word count + readability** : extraction automatique du TOC depuis headings Tiptap (H2-H4), affichage sticky sidebar desktop / collapsible mobile, anchor links + bouton « copier le lien », reading time calculé (~250 mots/min FR, ~300 EN), word count visible éditeur, score readability (Flesch-Kincaid adapté FR via lib `text-readability` ou équivalent) affiché éditeur uniquement.
26. **Templates éditeur + snippets + slash command** : par `type` KB un template de démarrage (ex. `case-study` = problème → solution → résultats → témoignage), bibliothèque de snippets réutilisables (CTA, callout, FAQ-block), slash command `/` dans Tiptap pour insérer (heading, image, callout, code, FAQ-item, glossary-ref, related-link, citation, divider, embed). Snippets SSOT dans `src/content/knowledge-base.ts`.
27. **Slug history + redirects 301 zéro perte SEO** : table `KnowledgeSlugHistory` qui enregistre tout slug ancien + entry cible. Middleware Next ou route catch-all redirige `301 Permanent`. Couvre rename slug, change de `type` (changement de path), merge d'entrées (déprécation avec redirect).
28. **Editorial pipeline + calendrier** : vue calendrier admin `/fr/<adminPrefix>/connaissances/calendrier` avec entrées planifiées (`scheduledFor`), assignations rédacteur/reviewer, état pipeline (Idée → Brief → Draft → Review → Approved → Scheduled → Published). KPIs éditoriaux : publications/mois par type, time-to-publish moyen, taux d'entrées EN parity, % entrées hors review window.
29. **Health dashboard contenu** : `/fr/<adminPrefix>/connaissances/sante` qui agrège (a) entrées sans `reviewedAt` depuis > 12 mois, (b) entrées sans traduction EN, (c) entrées sans `coverImage`, (d) entrées sans `relations[]`, (e) entrées avec score qualité < seuil, (f) tags orphelins, (g) liens cassés détectés par cron, (h) content coverage matrix `type × domain` (cellules vides = gap éditorial).
30. **Quality score automatique par entrée** : score /100 calculé à partir de (complétude métadonnées, longueur minimale par `type`, présence cover image, présence relations, présence sources, présence traduction EN, alt text complet, lien interne ≥ 2, lien externe ≥ 1 si applicable, fraîcheur). Visible éditeur + filtrable liste admin. Bloque la publication si score < seuil configurable par `type` (SSOT).
31. **Multi-format output** : par entrée publiée, génération automatique de (a) RSS Atom + JSON Feed par `type` et global, (b) ligne dans `llms.txt` + `llms-full.txt` enrichis avec excerpt + URL (helpers existants), (c) export PDF on-demand (lib `@react-pdf/renderer` ou `puppeteer` minimal via worker — décision Phase A coût/footprint), (d) ePub on-demand V1.5, (e) social card opengraph dynamique par entrée via `opengraph-image.tsx`, (f) carrousel LinkedIn / thread X = V2+.
32. **Newsletter auto-pickup** : intégration avec stack email maison Axion-IA (mémoire `axionia_project` mentionne email maison + Zoho Mail). Hook `kb.published` enregistre l'entrée dans une queue digest. Newsletter mensuelle ou hebdo agrégeant les nouvelles entrées par `domain`. Désabonnement RGPD géré centralement.
33. **Import tooling exhaustif** : (a) import `_AUDIT/*.md` via CLI/server action (parse frontmatter YAML, mapping `type`/`domain`/`audience`), (b) import Markdown Git (tag/commit choisi), (c) import Notion via API (token utilisateur, mapping blocks → Tiptap JSON), (d) import Google Docs via OAuth (V1.5), (e) wizard mapping de champs configurable, (f) preview + diff avant import, (g) rollback bulk import via transaction Prisma. Toujours import en `draft`, jamais directement publié.
34. **Scheduled publish + embargo + preview shareable** : champs `scheduledFor` (publication future automatique via cron), `embargoUntil` (visible interne mais public à date X), preview tokenisé `?preview=<jwt-short-lived>` partageable à stakeholder externe sans login (durée 24-72 h configurable), invalidation token sur publication ou explicitement.
35. **Notifications multi-canal + reviewer assignment** : assignation `reviewerId` sur transition `draft → review`, notification email + Telegram (mémoire `axionia_session_2026-05-09_sprint_24_1` PII redacted) + in-app badge, escalade si non répondu sous 48 h, digest hebdo des review pending. Hooks `kb.published`, `kb.expired`, `kb.review_due`, `kb.broken_link_detected`.
36. **Annotations team + bookmarks client + notes privées** : (a) annotations internes par paragraphe Tiptap pour discussion review (résolvables, type Google Docs), (b) bookmarks client sur entrées `audience='client'` (`KnowledgeBookmark` join table), (c) notes privées client par entrée (markdown court, `confidentiality='confidential'` côté client).
37. **Series / Collections / Pinned / Featured** : champ `seriesId` (multi-part guide auto-listé avec nav prev/next), champ `pinned` boolean (épingle en haut de liste publique par type), champ `featured` boolean + `featuredUntil` (mise en avant homepage `/ressources`).
38. **Sécurité contenu renforcée** : sanitization XSS du rendu Tiptap via lib whitelist stricte (jamais `dangerouslySetInnerHTML` sans audit), SSRF protection sur embeds (whitelist domaines YouTube/Vimeo/Loom seulement V1), rate limit feedback `kb_helpful` (1 vote / IP / entrée / 24h), CSP nonce (mémoire `axionia_session_2026-05-09_sprint_24`), HMAC sur endpoint RAG V1.5.
39. **Backup / DR KB-specific** : dump Postgres filtré sur tables `Knowledge*` quotidien dans backup Coolify, restauration KB-seule possible sans toucher booking, test restore mensuel via cron, export GDPR full-KB JSON pour migration future. Estimation taille : ~5 KB Tiptap moyen × N entrées × M versions (chiffré Phase A).
40. **Coût chiffré Hetzner CPX32 + embeddings** : Phase A produit estimation pour 1k / 10k / 100k entrées (taille DB, IOPS, RAM cache, coût embeddings batch et incrémental). Si embeddings Anthropic, prompt caching (skill `claude-api`) mandatory. Budget cible V1 = €0 additionnel/mois (CPX32 existant absorbe), V1.5 embeddings = budget Will explicite (~€5-30/mois selon volume).

### 0.0bis Périmètre temporel — V1 vs V1.5 vs V2+

L'audit produit une **cible V1** lançable, identifie une **vague V1.5** (sémantique + RAG basique), et liste les **hooks V2+** sans les implémenter.

**Dans le scope V1** :

- Modèle Prisma unifié `KnowledgeEntry` + relations.
- Migration des contenus existants (`blog`, `case-studies`, `faq`, `help`) — _décision unifier ou conserver = Phase A_.
- Admin CRUD complet `[adminPrefix]/connaissances/` + sous-écrans FR (`/calendrier`, `/sante`, `/medias`, `/imports`, `/etiquettes`, `/auteurs`, `/files-attente-revue`, `/parametres`).
- Workflow états + versionning + audit log.
- Surface publique `/fr/ressources/` (naming à valider Phase A).
- Surface client `/fr/mes-ressources/`.
- FTS Postgres FR + EN.
- JSON-LD par type.
- Sitemap + indexNow.
- Tests + Web Vitals.
- RGPD review + retention purge.

**Dans le scope V1.5 (post-V1, séparé)** :

- Embeddings pgvector + recherche sémantique (hybride FTS + cosine).
- Endpoint RAG `/api/internal/kb/rag` consommé par un futur chatbot (chatbot lui-même = V2+).
- Suggestions contextuelles dans l'admin (« entrées similaires à celle-ci »).
- Auto-tagging IA (Claude Haiku 4.5 via `@anthropic-ai/sdk` avec prompt caching, voir skill `claude-api`).

**Hors scope V1/V1.5 — listé comme V2+** :

- Chatbot public (UI + flow).
- Auto-génération d'entrées par IA depuis briefs (assistance à la rédaction OK V1.5, génération autonome = V2+).
- Multi-tenant (clients qui rédigent leurs propres entrées dans leur espace).
- Marketplace de prompts payants.
- Versions vidéo / podcast embedées (champs prévus en DB V1, UI rendu V2+).
- Export ePub / PDF du livre Axion-IA.
- Système de commentaires public.
- Notation publique multicritère (V1 = simple 👍/👎 anonymisé).
- Distribution syndicale (Substack / Medium cross-post auto).

L'audit doit **clairement marquer V1 / V1.5 / V2+** dans chaque livrable. Les sprints V2+ apparaissent dans `04-PLAN-EXECUTION.md` mais étiquetés `P3 — REPORTÉ V2+`.

### 0.1 Doctrine non négociable (intouchables)

Tu **n'as pas le droit** de proposer en cible quoi que ce soit qui contredit les points ci-dessous. Si tu identifies un conflit, tu poses un STOP & ASK Will, tu ne tranches pas.

1. **Naming** : « cabinet IA opérationnel » (FR) / « operational AI consultancy » (EN). Jamais « agence », « studio », « atelier ». Le projet et la marque sont **Axion-IA** (graphie unique, partout). Identifiers JS conservent camelCase (`axionIa`).
2. **Hosting** : Hetzner CPX32 Nuremberg + Coolify + Cloudflare Free. Pas de SaaS payant additionnel. **pgvector OUI** (extension Postgres gratuite), Pinecone/Weaviate/Qdrant cloud **NON**.
3. **Stack** : Next.js 16 (canary patché, voir `axionia/AGENTS.md`), Prisma, Postgres, Redis (BullMQ optionnel), Tailwind v4, Tiptap, next-intl, NextAuth. Pas d'ajout de framework UI parallèle.
4. **SSOT contenu** : tout config-like (types KB, domaines, mappings JSON-LD, libellés, sub-tiers) dans `src/content/knowledge-base.ts`. Jamais de string magique dans un composant.
5. **Code = SSOT** : Phase 0.5 reality check avant toute proposition. Le code actuel (notamment `blog`, `case-studies`, `faq`, `help`) prime sur ce prompt en cas de divergence. Tu signales la divergence, tu ne forces pas le prompt.
6. **i18n parity** : pas de feature visible publiquement disponible en FR uniquement (sauf décision Will). Internal admin = FR uniquement OK.
7. **Web Vitals** : seuils `AGENTS.md` respectés sur toute nouvelle page publique. Si une feature ne tient pas le budget → STOP & ASK.
8. **RGPD** : `pii-redaction.ts` (helper existant) reste la passerelle obligatoire avant tout export ou publication. Aucune entrée publique ne peut contenir email/téléphone/RIB d'un client identifiable sans pseudonymisation explicite consentie.
9. **Doctrine éditoriale Axion-IA** (à confirmer Phase A par lecture de `axionia/Design.md` et `_AUDIT/PROMPT-FRONTEND-AUDIT-V14-2026.md`) : ton, typography (Tailwind text-\* géré par `@theme`), hero schemas, palette terracotta — la KB hérite, ne réinvente pas.
10. **Confidentialité par défaut** : toute nouvelle entrée naît en `audience='team'` + `confidentiality='internal'`. La publication publique est un acte explicite, jamais le défaut.
11. **Migrations** : zero-downtime, expand → migrate → contract. Jamais de drop column sans deprecation window.
12. **Tests bloquants** : pas de merge sans suite verte. CI gate `pnpm test` + `pnpm typecheck` + `pnpm lint` + `pnpm e2e:kb` (à créer).

### 0.2 Ce que tu fais (Phase A)

- Tu **lis le code existant** : `prisma/schema.prisma`, `src/app/[locale]/(admin)/[adminPrefix]/{blog,case-studies,faq,help,categories}/`, `src/content/*.ts`, `src/lib/db/`, `src/lib/auth/`, `prisma/migrations_fts/`, et tu produis un état des lieux exhaustif (modèle, gaps, dette).
- Tu **lis la mémoire `_AUDIT/*.md`** pertinente (doctrine, décisions antérieures, ADRs `_AUDIT/adr/` si présent) pour ne pas réinventer.
- Tu **conçois** le modèle cible, l'architecture, le plan de sprints, les livrables admin/public/client, les tests, l'observabilité, la doc.
- Tu **livres ≥ 12 fichiers `.md`** dans `_AUDIT/KNOWLEDGE-BASE-2026/` (voir §6).
- Tu **score** la maturité de chaque dimension /10 (voir §5).
- Tu **poses un STOP & ASK Will** final qui liste les décisions ouvertes et propose un démarrage sprint par sprint.

### 0.3 Ce que tu ne fais PAS (Phase A)

- ❌ Aucune écriture de code applicatif.
- ❌ Aucune migration Prisma écrite.
- ❌ Aucun `pnpm add`, `pnpm install`, `pnpm remove`.
- ❌ Aucun commit, push, tag.
- ❌ Aucun appel API externe (Stripe, Coolify, Cloudflare, Anthropic).
- ❌ Aucune décision unilatérale sur les conflits de doctrine.

---

## 1. PHASE 0.5 — REALITY CHECK (obligatoire, < 30 min, avant tout agent parallèle)

Tu commences **seul, sans parallélisme**, par ce reality check. Tu produis `_AUDIT/KNOWLEDGE-BASE-2026/00-REALITY-CHECK.md`.

### 1.1 Inventaire du code existant — contenu

- `prisma/schema.prisma` : lister **les modèles réels du repo HEAD** (`Article` + `ArticleTranslation` + `ArticleTag` + `ArticleTagOnArticle`, `CaseStudy` + `CaseStudyTranslation`, `FAQ`, `HelpArticle` + `HelpArticleTranslation`, `Category`, et tout autre). Pour chacun :
  - Champs, relations, index, contraintes.
  - Volumétrie en prod (si accès Coolify DB — sinon estimer depuis seeds).
  - Routes publiques associées.
  - Routes admin associées.
  - Dépendances (sitemap, JSON-LD, search).
- `src/content/*.ts` : lister tous les SSOT existants. Identifier ceux qui pourraient devenir des `KnowledgeEntry` (ex : doctrine éditoriale, glossaire technique).
- `_AUDIT/*.md` : repérer les artefacts qui sont en réalité de la connaissance d'entreprise (ADRs, post-mortems, plans, décisions Will documentées). Lister ceux qui mériteraient d'être ingérés dans la KB en V1.5+.

### 1.2 Inventaire du code existant — admin

- Routes sous `src/app/[locale]/(admin)/[adminPrefix]/` qui éditent du contenu. Pour chacune :
  - Composants éditeurs (Tiptap config actuelle, plugins installés).
  - Server actions (`'use server'`) et leur signature.
  - Validation Zod.
  - Permissions (rôle requis).
  - UI patterns (drawer vs page dédiée, autosave, preview).
- Pages admin **manquantes** par rapport à la cible KB unifiée.

### 1.3 Inventaire du code existant — recherche

- État des migrations FTS dans `prisma/migrations_fts/`.
- Existence d'extensions pgvector dans la DB prod (Coolify exec `psql -c '\dx'`).
- Endpoints de recherche existants (`/api/search`, Pagefind si installé).

### 1.4 Décisions ouvertes — à inscrire en haut du fichier

Lister explicitement les questions non tranchées que tu poseras en STOP & ASK final, par exemple :

- Unifier `blog` + `case-studies` + `faq` + `help` sous `KnowledgeEntry` polymorphique, ou conserver tables séparées avec une vue logique ?
- Nom de la surface publique : `/ressources/`, `/savoir/`, `/base-de-connaissance/`, `/kb/` ?
- Tiptap JSON vs MDX vs Markdown sérialisé pour le body ?
- pgvector V1 ou V1.5 ?
- Reprise des `_AUDIT/*.md` doctrine comme entrées KB en V1 ou plus tard ?
- Surface client `/fr/mes-ressources/` requiert-elle login NextAuth, et selon quel rôle ?
- Limite de profondeur du graphe de relations (UI rendable sans dépiler récursivement) ?

### 1.5 Reality check verdict

À la fin du fichier, une section **GO / NO-GO** :

- **GO** = on peut lancer les agents parallèles avec confiance.
- **NO-GO** = le code n'est pas dans un état permettant de concevoir proprement (par ex. `blog` est en cours de refonte sur une branche non mergée). Tu listes ce qu'il faudrait stabiliser d'abord et tu t'arrêtes.

---

## 2. PHASE 1 — AGENTS PARALLÈLES (18 agents, après GO du reality check)

Tu lances **18 agents en parallèle** (12 cœur + 6 V2 perfection extrême), chacun produit un livrable `.md` dédié dans `_AUDIT/KNOWLEDGE-BASE-2026/`. Aucun agent n'écrit de code. Tous reçoivent en contexte le `00-REALITY-CHECK.md`.

Pour chaque agent, tu fournis :

- **Mission** (3-5 lignes).
- **Inputs** (fichiers à lire en priorité).
- **Output** (chemin + structure attendue).
- **Critères de succès** (3-5 bullet points).
- **Anti-patterns** à éviter.

### Agent 1 — Taxonomie & schéma de données

- Output : `_AUDIT/KNOWLEDGE-BASE-2026/01-DATA-MODEL.md`.
- Définit le schéma Prisma cible (`KnowledgeEntry`, `KnowledgeVersion`, `KnowledgeTag`, `KnowledgeRelation`, `KnowledgeTranslation`, `KnowledgeFeedback`, `KnowledgeEmbedding` V1.5).
- Justifie chaque relation (cardinalité, cascade, index).
- Propose les enums (`type`, `domain`, `audience`, `confidentiality`, `status`, `relationKind`).
- Inclut une vue de migration depuis les modèles réels existants (`Article` + `ArticleTranslation` + `ArticleTag` + `ArticleTagOnArticle`, `CaseStudy` + `CaseStudyTranslation`, `FAQ`, `HelpArticle` + `HelpArticleTranslation`, `Category`) avec stratégie zero-downtime (expand → backfill → contract).
- Anti-pattern : multiplier les tables par type (anti-DRY) ; sauver le body en colonne JSON sans index FTS ; oublier `createdById` et `updatedById`.

### Agent 2 — SSOT contenu (`src/content/knowledge-base.ts`)

- Output : `_AUDIT/KNOWLEDGE-BASE-2026/02-SSOT.md`.
- Liste les enums + labels FR/EN + descriptions.
- Liste le mapping `type → JSON-LD type` (`Article`, `FAQPage`, `HowTo`, `DefinedTerm`, `TechArticle`, `CaseStudy` custom etc.).
- Liste le mapping `type → template de rendu` (composant React).
- Liste les helpers (`isPublic`, `canEdit`, `getReviewWindow`, `formatAudienceLabel`).
- Liste les routes publiques générées (`/fr/ressources/[type]/[slug]`).
- Anti-pattern : embarquer des libellés UI dans le fichier (ils vont dans i18n) ; mélanger config et runtime data.

### Agent 3 — Admin UI architecture

- Output : `_AUDIT/KNOWLEDGE-BASE-2026/03-ADMIN-UI.md`.
- Maquette ASCII des écrans :
  - `/fr/<adminPrefix>/connaissances/` (liste filtrable).
  - `/fr/<adminPrefix>/connaissances/nouvelle` (création).
  - `/fr/<adminPrefix>/connaissances/[id]` (édition — onglets : Contenu, Métadonnées, Relations, Versions, Publication, RGPD, Médias).
  - `/fr/<adminPrefix>/connaissances/imports` (bulk import / export / tag).
  - `/fr/<adminPrefix>/connaissances/files-attente-revue` (entrées en retard de revue).
  - `/fr/<adminPrefix>/connaissances/graphe` (visualisation graphe — V1.5).
- Composants Tiptap (extensions à installer si absentes : `@tiptap/extension-link`, `@tiptap/extension-image`, callout custom, code block avec language picker).
- Patterns d'autosave (debounce 2 s, status indicator).
- Raccourcis clavier (`⌘S` save, `⌘P` preview, `⌘⇧P` publish).
- Anti-pattern : iframe preview (CLS) ; éditeur sans autosave ; perte de contenu sur navigation.

### Agent 4 — API & server actions

- Output : `_AUDIT/KNOWLEDGE-BASE-2026/04-API-ACTIONS.md`.
- Liste exhaustive des server actions : `createEntry`, `updateEntry`, `saveDraft`, `submitForReview`, `publish`, `unpublish`, `archive`, `restore`, `deleteEntry`, `addRelation`, `removeRelation`, `addTranslation`, `bulkImport`, `bulkExport`, `bulkTag`.
- Pour chacune : signature TypeScript, validation Zod, permissions, side-effects (audit log, sitemap regen, IndexNow ping, embedding regen).
- Endpoints REST internes : `/api/internal/kb/search`, `/api/internal/kb/[id]`, `/api/internal/kb/feedback`, `/api/internal/kb/rag` (V1.5).
- Politique de rate limit (CRUD admin authentifiée → soft, public search → 60/min/IP).
- Anti-pattern : action serveur sans Zod ; mutation sans audit log ; oubli de revalidatePath.

### Agent 5 — Recherche FTS + sémantique

- Output : `_AUDIT/KNOWLEDGE-BASE-2026/05-SEARCH.md`.
- État FTS Postgres actuel + extension nécessaire (`unaccent`, `pg_trgm`, `tsvector` matérialisé via trigger).
- Cible V1 : recherche `to_tsvector('french', title || body)` + `to_tsvector('english', ...)` selon locale. Index GIN.
- Facettes : `type`, `domain`, `audience`, `tags`, `status`, `dateRange`.
- Ranking : ts_rank_cd + boost par `pinned`, `helpfulCount`, fraîcheur.
- Cible V1.5 : pgvector + embeddings via `@anthropic-ai/sdk` (modèle text-embedding équivalent ; ou OpenAI si Will valide — Phase A note ouverte) + hybrid search (RRF entre FTS et cosine).
- Anti-pattern : recharger toute la table sur search ; oublier `LIMIT` ; FTS sans `unaccent`.

### Agent 6 — Surface publique SEO/AEO/GEO

- Output : `_AUDIT/KNOWLEDGE-BASE-2026/06-PUBLIC-SURFACE.md`.
- Arborescence publique : `/fr/ressources/` (hub) + `/fr/ressources/[type]/` (liste par type) + `/fr/ressources/[type]/[slug]` (entrée) + `/fr/ressources/tag/[tag]` (cross-type).
- Variants `/en/resources/...` strictement parity.
- SEO : title formula, meta description templating, OpenGraph, JSON-LD par type, breadcrumb, canonical, hreflang.
- AEO : FAQ schema, HowTo schema, structured `dateModified`, `author`, `publisher` Organization SSOT.
- GEO : référence aux villes/régions si entrée géocontextualisée (`areasServed`), maillage interne vers pSEO villes.
- Sitemap : intégration dans `sitemap-index.xml` existant via `axionia/src/app/sitemap-knowledge.ts` (à créer).
- IndexNow : ping via helper centralisé existant (mémoire `axionia_session_2026-05-13_seo_email_stack`).
- Anti-pattern : `og:image` dynamique côté client ; multiplier les JSON-LD contradictoires sur la même page.

### Agent 7 — Surface client connectée

- Output : `_AUDIT/KNOWLEDGE-BASE-2026/07-CLIENT-SURFACE.md`.
- Route `/fr/mes-ressources/` (login requis, NextAuth session).
- Filtrage : `audience IN ('public', 'client')` + tags issus du booking client (ex. tag `format:flash-distance` si le client a réservé une flash).
- UX : feed personnalisé, recherche, bookmarks (V1.5), historique consulté.
- Lien depuis l'email post-booking et depuis `/mes-rendez-vous`.
- Anti-pattern : exposer une entrée `audience='team'` par erreur de filtre serveur ; SSR sans `noindex` sur les pages connectées.

### Agent 8 — Workflow, versionning, audit log

- Output : `_AUDIT/KNOWLEDGE-BASE-2026/08-WORKFLOW-VERSIONING.md`.
- Diagramme d'états (Mermaid ASCII) `draft → review → published → archived` + `deprecated` (publié visiblement remplacé) + `scheduled` (publié à date future).
- Politique de version : 1 row immutable par save, diff via lib (proposer `jsondiffpatch` ou `diff` selon taille bundle).
- Audit log : table existante (`ActivityLog`?) à étendre, événements `kb.created`, `kb.updated`, `kb.published`, `kb.archived`, `kb.relation.added`, etc.
- Rétention versions : V1 toutes versions gardées ; V2+ politique de compaction (proposer mais ne pas implémenter).
- Anti-pattern : storing diff seul (impossible à reconstruire si une version manque) ; oublier l'audit trail sur les actions de masse.

### Agent 9 — Gouvernance, RGPD, sécurité

- Output : `_AUDIT/KNOWLEDGE-BASE-2026/09-GOVERNANCE-RGPD.md`.
- Permissions par rôle (`OWNER`, `EDITOR`, `REVIEWER`, `READER`) — confronter à `auth.ts` existant.
- PII scan : intégration de `pii-redaction.ts` dans `publish` (bloquant si match non whitelisté).
- Retention : `expiresAt` honoré par cron `retention-purge` (étendre l'existant).
- Sous-processeurs : si embedding via Anthropic API → mise à jour `legal/sous-processeurs` + `legal.ts`. Si Anthropic non retenu (auto-hébergé via embedding local style `text-embedding-3-small` impossible sans OpenAI) → décision Phase A.
- Audit RGPD : journalisation des consultations clients (consent based) — proposer minimal V1 (compteur de vues anonymisé, pas de tracking individuel sans consentement Cookie).
- Anti-pattern : export CSV sans masquage PII ; embedding qui exfiltre du `confidentiality='secret'` vers un tiers.

### Agent 10 — IA augmentation (V1.5)

- Output : `_AUDIT/KNOWLEDGE-BASE-2026/10-AI-AUGMENTATION.md`.
- Embeddings : modèle retenu, batch size, coût estimé sur volumétrie cible (1k entrées, 10k entrées, 100k entrées), prompt caching (skill `claude-api` doctrine).
- RAG endpoint : signature, top-K, hybrid search RRF, ranking, reranking optionnel, latence cible (< 800 ms p95).
- Auto-suggestions admin : « entrées similaires », « relations probables », « tags suggérés » — UI dans l'éditeur, optionnel, opt-out per-entry.
- Auto-rédaction assistée V1.5 : bouton « générer brouillon à partir de prompt » — strictement assistance, le rédacteur valide ; ne pas publier sans review humaine.
- Auto-traduction FR→EN V1.5 : bouton « traduire ce contenu » via Claude Haiku 4.5 — review humaine obligatoire avant publication EN.
- Anti-pattern : RAG sans citation ; auto-publish sans review ; envoi de contenu `confidentiality='secret'` vers l'API.

### Agent 11 — Performance & Web Vitals

- Output : `_AUDIT/KNOWLEDGE-BASE-2026/11-PERF-VITALS.md`.
- Budget JS par route KB publique (≤ 75 KB gz, comme `AGENTS.md`).
- SSG vs ISR vs SSR par type d'entrée — proposer ISR `revalidate: 3600` pour entrées publiées + on-demand revalidate sur publish/update.
- Hydratation : éditeur Tiptap = client-only en admin, jamais en public. Public rend Tiptap JSON via composant SSR pur (helper `renderTiptapToReact`).
- Images : `<Image>` Next avec `priority` réservé au LCP, sinon lazy.
- Anti-pattern : importer tout Tiptap en public ; charger l'éditeur dans `mes-ressources/` ; absence de `loading.tsx`.

### Agent 12 — Accessibility WCAG 2.2 AA + E-E-A-T

- Output : `_AUDIT/KNOWLEDGE-BASE-2026/12-A11Y-EEAT.md`.
- Checklist WCAG 2.2 AA appliquée à : (a) éditeur admin Tiptap, (b) liste admin filtrable, (c) surface publique entrée, (d) hub publique `/ressources`, (e) surface client `/mes-ressources`.
- Validation contrast palette terracotta (mémoire `axionia_design_pivot`) sur fond clair + sombre. Pointer les cas non conformes.
- Navigation clavier complète : tab order, focus visible, skip-links, escape closes drawer/modal.
- ARIA : `aria-live` polite sur autosave, `aria-current` sur facettes actives, `role` + `aria-label` sur composants custom Tiptap.
- Alt text : bloquer publication si image sans alt, suggestion IA V1.5 (modèle vision Claude), workflow de revue alt.
- E-E-A-T : maquette du bloc auteur (avatar SSR optimisé, bio courte, lien profil interne `KnowledgeAuthor`), bloc `reviewedBy` distinct, badge `fact-checked`, citations visibles bas de page, bouton « citer cette page » avec BibTeX + APA + permalink.
- Trust signals globaux : pages auteur dédiées (`/fr/equipe/[slug]` si existante, sinon proposer création), bio auteur enrichie schema `Person`.
- Anti-pattern : alt text auto-publié sans review humaine ; cacher `lastReviewedAt` derrière un toggle ; auteur fictif/composite ; faux badges fact-checked.

### Agent 13 — Pipeline médias, asset library, image optimization

- Output : `_AUDIT/KNOWLEDGE-BASE-2026/13-MEDIA-PIPELINE.md`.
- Modèle Prisma `KnowledgeAsset` : `id`, `mimeType`, `originalPath`, `width`, `height`, `bytes`, `hash` (SHA-256), `altText`, `caption`, `uploadedById`, `usageCount`, `createdAt`, soft delete.
- Pipeline d'upload : server action → validation type/taille (≤ 10 MB image, ≤ 50 MB doc) → stockage volume Coolify monté (`/data/knowledge-assets/`) → conversion `sharp` background job (AVIF + WebP + JPEG fallback, variantes 320/640/1024/1920/3840) → entry DB.
- Strip EXIF/GPS/PII automatique (RGPD).
- Asset library admin : `/fr/<adminPrefix>/connaissances/medias` avec liste, search, filter par type/auteur/taille, preview, drag-into-editor, garbage collect après 30 j sans usage (avec confirmation).
- Cache : Cache Rules Cloudflare existantes (mémoire `axionia_session_2026-05-09_cloudflare_phase5`), hash filename pour cache-busting.
- Cover image : champ `coverImageId` sur `KnowledgeEntry` + variante `cover` 1200×630 (OpenGraph) générée automatiquement.
- HeroSchema réutilisé : si `heroLayout='schema'`, on pointe vers un composant React SVG (mémoire `axionia_hero_schema_v3_2`), pas un asset.
- Anti-pattern : stocker en base64 dans Tiptap JSON ; serve via Next API route (vs serve via Caddy directement) ; oublier strip EXIF ; conserver originaux ad vitam sans politique.

### Agent 14 — Editorial pipeline, calendrier, health dashboard, quality score

- Output : `_AUDIT/KNOWLEDGE-BASE-2026/14-EDITORIAL-PIPELINE.md`.
- États pipeline éditorial étendus : `Idea → Brief → Draft → Review → Approved → Scheduled → Published → Archived` (différent de `status` workflow technique, complémentaire).
- Champ `pipelineStage` + `briefMarkdown` (court brief auteur) + `targetWordCount` + `targetKeyword` + `scheduledFor` + `assignedAuthorId` + `assignedReviewerId`.
- Calendar view `/fr/<adminPrefix>/connaissances/calendrier` : vue mensuelle, drag-drop pour replanifier, code couleur par `type`/`domain`.
- Health dashboard `/fr/<adminPrefix>/connaissances/sante` : panneaux KPIs (publications mensuelles, time-to-publish moyen, % EN parity, % entrées avec cover, % review-overdue, gap matrix `type × domain`, top entrées par vues/helpful, liens cassés détectés).
- Quality score : formule (10 critères × 10 pts = /100), seuils par `type` SSOT, bloquant publication si < seuil, surface en éditeur comme jauge live.
- Reviewer assignment : algorithme round-robin ou ownership (`domain` → reviewer par défaut), escalade si pas de réponse sous 48h.
- Notifications : email reviewer + Telegram redacté (PII) + badge admin in-app.
- Anti-pattern : pipeline éditorial qui rebond avec workflow technique (cohabitation, pas fusion) ; quality score qui pénalise les entrées courtes par essence (FAQ courte = OK) ; KPIs qui datent du wall-clock client (toujours server time).

### Agent 15 — Multi-format output + RSS + llms.txt + PDF/ePub + Newsletter

- Output : `_AUDIT/KNOWLEDGE-BASE-2026/15-MULTI-FORMAT.md`.
- RSS Atom + JSON Feed : flux par `type`, par `domain`, par `tag`, global. Cachés ISR `revalidate: 600`. Inclus dans `<head>` des pages liste correspondantes.
- llms.txt enrichi : entrée par `KnowledgeEntry` publiée publique avec excerpt + URL + lastModified. Cron quotidien régénère, IndexNow ping.
- PDF export on-demand : décision lib en Phase A (`@react-pdf/renderer` léger mais limité Tiptap rich, `puppeteer` complet mais lourd RAM CPX32). Recommandation Phase A après bench mémoire. Endpoint `/api/internal/kb/[id]/pdf` cacheable 24h.
- ePub V1.5 : lib `epub-gen` ou équivalent, scope V1.5 si besoin.
- Social card OpenGraph dynamique par entrée : `opengraph-image.tsx` par `[type]/[slug]` avec template type-spécifique (citation, méthodologie, FAQ snippet).
- Newsletter auto-pickup : hook `kb.published` enqueue digest (Redis/BullMQ existant), template hebdo ou mensuel par `domain`, opt-in/out RGPD.
- LinkedIn carrousel / X thread / Substack cross-post = V2+.
- Anti-pattern : générer PDF synchronement en request (timeout) ; ne pas cacher RSS ; oublier hreflang sur RSS multilangue ; double-poster en newsletter (idempotency).

### Agent 16 — Import & migration tooling

- Output : `_AUDIT/KNOWLEDGE-BASE-2026/16-IMPORT-TOOLING.md`.
- Importers V1 :
  - `_AUDIT/*.md` : parse frontmatter YAML (`title`, `date`, `tags`, `status`), conversion Markdown → Tiptap JSON via `prosemirror-markdown` ou helper custom, mapping `type`/`domain`/`audience` configurable (table de mapping CSV ou wizard).
  - Markdown Git directory : pointe un dossier (ex. `docs/`), récupère commit ref, parse récursif.
  - Notion : API officielle (`@notionhq/client`), OAuth utilisateur, mapping blocks Notion → Tiptap nodes, gestion images (download + asset pipeline).
- Importers V1.5 :
  - Google Docs : Google Docs API, OAuth, mapping styles → Tiptap.
  - Confluence / Roam / Obsidian : stretch goals V2+.
- Wizard UI `/fr/<adminPrefix>/connaissances/imports` : source picker → preview diff → mapping fields → dry-run → commit (transaction Prisma).
- Toujours `status='draft'` en sortie, jamais publié direct.
- Rollback : transaction Prisma + log batch dans `KnowledgeImportBatch` pour undo bulk.
- Slug strategy : générer depuis title, conflit résolu par suffixe -2/-3, `KnowledgeSlugHistory` non utilisée à l'import (slug neuf).
- Anti-pattern : import qui silently écrase un slug existant ; import sans dry-run ; import depuis source sans audit log auteur original ; PII non scrubée à l'import.

### Agent 17 — Slug history + redirects + sécurité contenu + DR/backup

- Output : `_AUDIT/KNOWLEDGE-BASE-2026/17-SLUG-SECURITY-DR.md`.
- Slug history : modèle `KnowledgeSlugHistory` (`oldSlug`, `oldLocale`, `oldType`, `entryId`, `changedAt`). Middleware Next (ou route catch-all `/[locale]/ressources/[...path]`) résout l'ancien path → 301 vers nouveau. Index sur (`oldLocale`, `oldType`, `oldSlug`).
- Cas couverts : rename slug, change `type` (path change), merge d'entrées (entrée A archivée pointe vers entrée B avec 301).
- Sécurité contenu :
  - Sanitization rendu Tiptap : whitelist nodes/marks stricte côté SSR, jamais `dangerouslySetInnerHTML` brut. Lib candidate : `@tiptap/html` server side avec config readonly + escape custom marks.
  - SSRF : whitelist domaines pour embeds iframe (YouTube, Vimeo, Loom, Codepen V2+).
  - Rate limit : `kb_helpful` 1/IP/entrée/24h via Redis bucket ; FTS public 60/IP/min ; bulk import admin 5/min.
  - CSP : extension du nonce existant pour autoriser embeds whitelistés uniquement.
  - HMAC sur endpoint RAG V1.5 si exposé externalement.
- DR/backup KB-specific :
  - Dump quotidien filtré sur tables `Knowledge*` + `KnowledgeAsset*` dans backup Coolify (déjà existant pour DB globale ; ajouter filtre granulaire).
  - Restauration testée mensuellement via script `scripts/dr-restore-kb.sh` (cron + alerte Telegram échec).
  - Export GDPR full-KB JSON via `/api/internal/kb/export-full` (admin OWNER seulement, rate-limited 1/jour).
  - Estimation taille : Phase A chiffre (1k entrées × 5 KB Tiptap × 10 versions moyennes + assets) pour 3 scénarios (1k / 10k / 100k).
  - Coût embeddings V1.5 chiffré : Phase A produit table coût par modèle Anthropic (avec prompt caching) ou alternative, scénarios mensuels.
- Anti-pattern : redirect chain (301 → 301 → 200) ; cache CDN des anciennes URLs sans purge ; backup non testé ; export GDPR sans masquage PII ; embeddings de secret content envoyés à tiers.

### Agent 18 — Tests, QA, observabilité, runbook

- Output : `_AUDIT/KNOWLEDGE-BASE-2026/18-TESTS-OBSERVABILITY.md`.
- Plan de test unitaire (Vitest) : ≥ 30 tests sur server actions, ≥ 15 sur SSOT helpers, ≥ 10 sur composant rendu Tiptap.
- Plan intégration (Vitest + DB de test) : ≥ 10 tests workflow états.
- Plan E2E (Playwright) : ≥ 5 scénarios (création → publish → consult public → archive ; recherche FTS ; surface client ; bulk import ; permissions).
- Lighthouse CI : route échantillonnée `/fr/ressources/[type]/[slug-pivot]`.
- Sentry : events custom `kb.publish.failed`, `kb.embed.failed`.
- Plausible : goals `kb_view`, `kb_search`, `kb_helpful_up`, `kb_helpful_down`.
- Runbook prod : « comment dépublier en urgence », « comment restaurer une version », « comment purger les embeddings ».
- Anti-pattern : tests qui dépendent du wall-clock ; E2E qui partent en boucle infinie ; absence de runbook.

---

## 3. PHASE 2 — SYNTHÈSE (toi seul, après les 18 agents)

Tu produis 3 livrables de synthèse.

### 3.1 `_AUDIT/KNOWLEDGE-BASE-2026/SYNTHESIS.md`

- TL;DR 1 page max : verdict GO / CONDITIONAL GO / NO-GO sur lancement V1 immédiat.
- Scoring /10 par dimension (voir §5). Score total /200.
- Top 10 risques.
- Top 10 quick wins (< 1 j chacun).
- Décisions ouvertes (questions à Will).

### 3.2 `_AUDIT/KNOWLEDGE-BASE-2026/04-PLAN-EXECUTION.md`

Plan de sprints **chiffré et ordonné** :

- Sprint KB-1 — Schéma + SSOT (effort, dépendances, livrables, tests).
- Sprint KB-2 — Migration contenus existants (`blog`, `case-studies`, `faq`, `help`).
- Sprint KB-3 — Admin CRUD core (liste + éditeur Tiptap + create/update/delete).
- Sprint KB-4 — Workflow + versionning + audit log.
- Sprint KB-5 — Surface publique `/ressources/` + JSON-LD + sitemap.
- Sprint KB-6 — Surface client `/mes-ressources/`.
- Sprint KB-7 — Recherche FTS + facettes.
- Sprint KB-8 — Bulk operations + import/export.
- Sprint KB-9 — Tests E2E + Lighthouse CI + observabilité.
- Sprint KB-10 — Accessibilité WCAG 2.2 AA + E-E-A-T (bloc auteur + reviewed-by + citations + alt text bloquant).
- Sprint KB-11 — Pipeline médias + asset library + sharp AVIF/WebP + EXIF strip.
- Sprint KB-12 — Slug history + redirects 301 + sécurité contenu (XSS/SSRF/CSP).
- Sprint KB-13 — Editorial pipeline + calendrier + health dashboard + quality score.
- Sprint KB-14 — Multi-format output (RSS/JSON Feed/llms.txt enrichi + opengraph dynamique).
- Sprint KB-15 — Import tooling (`_AUDIT/*.md` + Markdown Git + Notion).
- Sprint KB-16 — Templates éditeur + snippets + slash command + TOC + reading time + readability score.
- Sprint KB-17 — Notifications multi-canal + reviewer assignment + scheduled publish + preview tokens.
- Sprint KB-18 — Annotations team + bookmarks client + series/collections + pinned/featured.
- Sprint KB-19 — RGPD review + retention purge intégrée + backup/DR KB-specific + tests DR.
- Sprint KB-20 — PDF export on-demand + newsletter auto-pickup + tests E2E + Lighthouse CI.
- _Bornes V1 ici._
- Sprint KB-21 (V1.5) — pgvector + embeddings + recherche hybride.
- Sprint KB-22 (V1.5) — RAG endpoint + auto-suggestions admin + auto-tagging IA.
- Sprint KB-23 (V1.5) — Auto-traduction FR→EN assistée + alt text IA vision.
- Sprint KB-24 (V1.5) — ePub export + plagiarism check + brand voice check.
- _V2+ listé sans chiffrage (chatbot, multi-tenant, syndication, paywall, etc.)._

Chaque sprint :

- Effort en demi-journées Will-équivalent.
- Pré-requis (autres sprints, validations Will, accès infra).
- Livrables fichiers (chemins exacts).
- Critères d'acceptation (tests à passer, métriques à atteindre).
- STOP & ASK obligatoires.

### 3.3 `_AUDIT/KNOWLEDGE-BASE-2026/ADR-DRAFT.md`

ADR brouillon (style `_AUDIT/adr/` existants) qui propose :

- **ADR XXX — Knowledge Base unifiée** : choix du modèle polymorphique, statut Phase A = `proposed`.

À fusionner dans `_AUDIT/adr/` réel uniquement après GO Will (jamais en Phase A).

---

## 4. PHASE B — BUILD INCRÉMENTAL (déclenchée sprint par sprint)

> Tu n'entres jamais en Phase B tout seul. Will déclenche par message explicite `GO BUILD KB-SPRINT-N` (ex. `GO BUILD KB-SPRINT-1`).

Quand un sprint est déclenché :

1. **Re-lire** le plan `_AUDIT/KNOWLEDGE-BASE-2026/04-PLAN-EXECUTION.md` (et `00-REALITY-CHECK.md` pour le contexte actualisé).
2. **Faire un mini reality check** : le code a-t-il bougé depuis l'audit ? Si oui, ajuster.
3. **Implémenter strictement le périmètre du sprint** — pas un sprint et demi, pas un quart de sprint suivant.
4. **Tests bloquants** : à chaque sprint, livrer les tests associés (unit + intégration + E2E si applicable).
5. **Migration Prisma** : `pnpm db:migrate:dev` localement, jamais en prod (Will déploie via Coolify auto-deploy + `pnpm db:migrate:deploy` post-deploy).
6. **Doc sync** : si le sprint ajoute des SSOT ou des routes, mettre à jour `axionia/Design.md` ou `axionia/AGENTS.md` si nécessaire (mémoire `axionia_prompt_doc_sync`).
7. **Commit atomique** : 1 sprint = 1 PR ou 1 commit cohérent (style Conventional Commits, voir `commitlint.config.mjs`).
8. **Final report** : produire `_AUDIT/KNOWLEDGE-BASE-2026/SPRINT-N-REPORT.md` avec :
   - Fichiers créés / modifiés.
   - Tests ajoutés (nombre + chemins).
   - Migrations Prisma ajoutées.
   - STOP & ASK Will (questions ouvertes).
   - Tâches reportées au sprint suivant.

### 4.1 Garde-fous Phase B

- **Jamais** de `git push --force`.
- **Jamais** de migration destructive (drop column) sans deprecation window documentée.
- **Jamais** de modification de `pricing.ts`, `interventions-taxonomy.ts`, ou autre SSOT non-KB sans validation Will explicite.
- **Toujours** vérifier `pnpm typecheck` + `pnpm test` + `pnpm lint` avant commit.
- **Toujours** documenter `revalidatePath` ou `revalidateTag` appelés.
- **Toujours** ajouter le mapping `type → composant rendu` dans le SSOT, pas dans un switch sauvage.

---

## 5. CRITÈRES DE SCORING (Phase A, fichier `SYNTHESIS.md`)

Score chaque dimension `/10`. Total `/300` (30 dimensions). Verdict :

- **≥ 270** = GO V1 immédiat (lancer Sprint KB-1).
- **225-269** = CONDITIONAL GO (lever les blocages listés).
- **< 225** = NO-GO (refonte de l'audit ou pré-requis à régler).

| #   | Dimension                                                                | Pondération |
| --- | ------------------------------------------------------------------------ | ----------- |
| 1   | Qualité du schéma proposé (cohérence, normalisation, extensibilité)      | /10         |
| 2   | Migration des contenus existants (faisabilité zero-downtime)             | /10         |
| 3   | UX admin (édition fluide, autosave, raccourcis)                          | /10         |
| 4   | UX surface publique (SEO/AEO/GEO, hreflang, sitemap)                     | /10         |
| 5   | UX surface client (filtrage par booking, login intégré)                  | /10         |
| 6   | Recherche FTS V1 (qualité du ranking, facettes)                          | /10         |
| 7   | Plan IA V1.5 (embeddings, RAG, coût Hetzner-friendly)                    | /10         |
| 8   | Workflow états + versionning + audit log                                 | /10         |
| 9   | Permissions + RGPD + PII scan                                            | /10         |
| 10  | Web Vitals & Performance                                                 | /10         |
| 11  | Tests (unit + intégration + E2E)                                         | /10         |
| 12  | Observabilité (Sentry, Plausible, runbook)                               | /10         |
| 13  | Plan de sprints chiffré et ordonné                                       | /10         |
| 14  | Compatibilité doctrine Axion-IA (naming, hosting, SSOT)                  | /10         |
| 15  | i18n FR/EN parity                                                        | /10         |
| 16  | Sécurité (rate limit, CSRF, XSS rendu Tiptap)                            | /10         |
| 17  | Doc sync (`Design.md`, `AGENTS.md`, ADR)                                 | /10         |
| 18  | Maintenance long-terme (review cycles, expiration)                       | /10         |
| 19  | Cost/Hetzner CPX32 footprint (CPU/RAM/disk)                              | /10         |
| 20  | Maturité ADR & décisions tracées                                         | /10         |
| 21  | Accessibilité WCAG 2.2 AA (surfaces publique + client + admin)           | /10         |
| 22  | E-E-A-T (auteur, reviewed-by, fact-checked, citations)                   | /10         |
| 23  | Pipeline médias (asset library, sharp AVIF/WebP, EXIF strip)             | /10         |
| 24  | Editorial pipeline + calendrier + reviewer assignment                    | /10         |
| 25  | Health dashboard + quality score + content gap matrix                    | /10         |
| 26  | Multi-format output (RSS/JSON Feed/llms.txt/PDF/social cards)            | /10         |
| 27  | Import tooling (`_AUDIT/*.md` + Notion + Markdown Git)                   | /10         |
| 28  | Slug history + redirects 301 + sécurité contenu (XSS/SSRF/CSP)           | /10         |
| 29  | Backup/DR KB-specific + estimation taille + coût embeddings chiffré      | /10         |
| 30  | Notifications multi-canal + annotations + bookmarks + series/collections | /10         |

---

## 6. LIVRABLES OBLIGATOIRES (Phase A)

Sous `_AUDIT/KNOWLEDGE-BASE-2026/` :

1. `00-REALITY-CHECK.md`
2. `01-DATA-MODEL.md`
3. `02-SSOT.md`
4. `03-ADMIN-UI.md`
5. `04-API-ACTIONS.md`
6. `05-SEARCH.md`
7. `06-PUBLIC-SURFACE.md`
8. `07-CLIENT-SURFACE.md`
9. `08-WORKFLOW-VERSIONING.md`
10. `09-GOVERNANCE-RGPD.md`
11. `10-AI-AUGMENTATION.md`
12. `11-PERF-VITALS.md`
13. `12-A11Y-EEAT.md`
14. `13-MEDIA-PIPELINE.md`
15. `14-EDITORIAL-PIPELINE.md`
16. `15-MULTI-FORMAT.md`
17. `16-IMPORT-TOOLING.md`
18. `17-SLUG-SECURITY-DR.md`
19. `18-TESTS-OBSERVABILITY.md`
20. `SYNTHESIS.md` (TL;DR + scoring /300 + risques + décisions)
21. `04-PLAN-EXECUTION.md` (plan sprints, écrasement OK si un agent a déjà produit un draft)
22. `ADR-DRAFT.md` (brouillon ADR `proposed`)

Chaque fichier porte un header standard :

```markdown
# [TITRE] — Knowledge Base 2026 — Phase A

> Prompt : `_AUDIT/PROMPT-KNOWLEDGE-BASE-2026.md`
> Agent : N — [nom]
> Date : YYYY-MM-DD
> Statut : DRAFT (Phase A audit-only)
```

---

## 7. ANTI-PATTERNS GLOBAUX (à éviter dans chaque livrable)

1. **Inventer du code qui n'existe pas** dans le repo actuel. Toujours `grep` avant d'affirmer.
2. **Présupposer la migration** des contenus existants : Phase A propose des stratégies, ne tranche pas.
3. **Embarquer du markdown raw dans la DB** sans normalisation. Tiptap JSON ou rien (sauf décision Will).
4. **Recommander un SaaS payant** non-Hetzner-friendly (Pinecone, Algolia, Contentful, Sanity).
5. **Concevoir une feature sans i18n** (FR/EN parity obligatoire pour surfaces publiques).
6. **Ignorer Web Vitals** sur la surface publique.
7. **Confondre `audience` et `confidentiality`** : `audience` = qui peut voir (segmentation public/client/team), `confidentiality` = niveau de sensibilité du contenu (impacte les checks PII et les exports).
8. **Faire un éditeur sans autosave** ni indicator d'état.
9. **Oublier l'audit log** sur publish/unpublish.
10. **Stocker les versions comme diff** seulement (un trou = data perdue).
11. **Recommander Prisma `@@unique` sans index `@@index`** (perf FTS).
12. **Embeddings sur `confidentiality='secret'`** envoyés à un tiers.
13. **Reprendre toute la doctrine `_AUDIT/`** comme entrées KB V1 sans triage Will (charge éditoriale ingérable).
14. **Plan de sprints non chiffré** (« plus tard », « à voir » → reformuler ou retirer).
15. **STOP & ASK absent** sur les décisions ouvertes.
16. **Alt text absent ou auto-publié** sans review humaine — bloquant publication V1.
17. **Cacher `lastReviewedAt`** ou afficher une date fictive — anti E-E-A-T.
18. **Stocker des images en base64 dans Tiptap JSON** — saturation DB, perf horrible.
19. **PDF généré synchronement** dans la request HTTP — timeout assuré sur CPX32.
20. **Slug rename sans entrée `KnowledgeSlugHistory`** — perte SEO immédiate.
21. **Pipeline éditorial fusionné avec workflow technique** (`pipelineStage` doit cohabiter avec `status`, pas remplacer).
22. **Import qui écrase silencieusement** un slug existant — anti-data-loss.
23. **Embeddings de `confidentiality='secret'`** envoyés à un tiers — fuite RGPD critique.
24. **Newsletter qui re-poste** une entrée déjà envoyée — manque idempotency clé `entryId × digestId`.
25. **Health dashboard qui ignore les entrées archivées** — gap analysis biaisée.

---

## 8. PHRASE D'INVOCATION

Pour lancer **Phase A** (audit) :

> Lance le prompt `_AUDIT/PROMPT-KNOWLEDGE-BASE-2026.md` en mode AUDIT-FIRST. Fais d'abord la Phase 0.5 reality check seul, puis lance les 18 agents en parallèle, puis fais la synthèse. Rien d'autre. Stoppe et pose un STOP & ASK final avec le plan de sprints chiffré.

Pour lancer **un sprint Phase B** (build) après validation du plan :

> GO BUILD KB-SPRINT-N — implémente strictement le périmètre du Sprint KB-N défini dans `_AUDIT/KNOWLEDGE-BASE-2026/04-PLAN-EXECUTION.md`. Mini reality check d'abord, puis livraison avec tests, migration, doc, commit atomique. Produis `_AUDIT/KNOWLEDGE-BASE-2026/SPRINT-N-REPORT.md` à la fin.

---

## 9. DOCTRINE LINGUISTIQUE FR/EN — RÈGLES STRICTES

> Le système Knowledge Base est **français-first**. EN est une parité publique, jamais une langue d'admin.

### 9.1 Niveaux de langue par couche

| Couche                          | Langue                                                                                            | Justification                                                                                                                                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **URL publiques**               | FR (slugs FR par défaut) + EN parity (slugs traduits)                                             | Cohérent avec l'existant `/blog/`, `/cas-concrets/`, `/centre-aide/`, `/glossaire/`, `/guide-ia/`. EN via `/en/blog/`, `/en/case-studies/`.                                                                          |
| **URL admin**                   | FR (`/connaissances/`, `/calendrier`, `/sante`, `/medias`, `/imports`, `/etiquettes`, `/auteurs`) | Will dit « le système doit être fait en français ». L'admin existant est mixte (`/calendrier` FR, `/blog` EN) — la KB lance la convention FR cohérente que les autres admin migrent progressivement (hors scope KB). |
| **Libellés UI**                 | FR + EN via `src/messages/{fr,en}/knowledge.json` (next-intl)                                     | Pattern existant respecté. Pas de string en dur dans les composants.                                                                                                                                                 |
| **Identifiants code**           | EN/camelCase (`KnowledgeEntry`, `publishedAt`, `audience`, `confidentiality`)                     | Pattern projet : Prisma + TypeScript en anglais. Lisible par tout dev.                                                                                                                                               |
| **Enums + valeurs DB**          | EN snake_case ou camelCase (`type='case_study'`, `status='published'`, `audience='client'`)       | Stockable, requêtable, indépendant de la langue d'affichage. Mapping → label FR/EN dans `src/content/knowledge-base.ts`.                                                                                             |
| **Commit messages**             | EN (Conventional Commits)                                                                         | Pattern projet, `commitlint.config.mjs`.                                                                                                                                                                             |
| **Documentation `_AUDIT/*.md`** | FR (style des prompts AxionIA existants)                                                          | Cohérent avec la doctrine éditoriale interne.                                                                                                                                                                        |
| **Code comments (rares)**       | FR (uniquement quand le « pourquoi » non évident)                                                 | Conformes aux directives globales (commentaire = pourquoi, jamais le quoi).                                                                                                                                          |

### 9.2 Conventions de slugs publiques

- **FR** : kebab-case sans accents (`ia-pour-pme-bilan-12-mois`, `comparatif-rag-vs-fine-tuning`), sauf entrées historiques préservées telles quelles.
- **EN** : kebab-case ASCII (`ia` reste `ia` ou devient `ai` selon Phase A — décision Will : `ai` recommandé pour SEO anglophone, mapping FR `ia` ↔ EN `ai` dans SSOT).
- **Glossaire** : 1 entrée = 1 terme racine (FR + EN sont des `KnowledgeTranslation` du même `KnowledgeEntry`, pas 2 entrées séparées).

### 9.3 Que faire si une feature contredit la doctrine FR

STOP & ASK Will. Ne pas trancher seul.

---

## 10. STRATÉGIE BACKEND UNIFIÉ vs SURFACES PUBLIQUES EXISTANTES

> Décision V3 (post-reality-check) : la KB est un **backend unifié** qui **alimente** les surfaces publiques existantes ; elle ne les remplace pas.

### 10.1 Surfaces publiques existantes inventoriées (HEAD `main`)

| Route                                                                                             | Type cible KB          | Modèle Prisma actuel                                                    | Action V1                                                                                                |
| ------------------------------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `/fr/blog/[slug]` + facettes `/auteur`, `/categorie`, `/secteur`, `/service`, `/tag` + `feed.xml` | `type='article'`       | `Article` + `ArticleTranslation` + `ArticleTag` + `ArticleTagOnArticle` | Migrer vers `KnowledgeEntry WHERE type='article'`. URLs **conservées**. Facettes alimentées par tags KB. |
| `/fr/cas-concrets/[slug]`                                                                         | `type='case_study'`    | `CaseStudy` + `CaseStudyTranslation`                                    | Migrer vers `KnowledgeEntry WHERE type='case_study'`. URLs **conservées**.                               |
| `/fr/centre-aide/[slug]`                                                                          | `type='help_article'`  | `HelpArticle` + `HelpArticleTranslation`                                | Migrer vers `KnowledgeEntry WHERE type='help_article'`. URLs **conservées**.                             |
| `/fr/faq` (page hub)                                                                              | `type='faq'`           | `FAQ`                                                                   | Migrer vers `KnowledgeEntry WHERE type='faq'`. Page hub **conservée**.                                   |
| `/fr/glossaire` (hub) + `/fr/glossaire/[slug]` (si existe)                                        | `type='glossary_term'` | _aucun_ (content statique ?)                                            | Phase A : auditer la source actuelle (`src/content/` ? hardcodée ?), créer `type='glossary_term'`.       |
| `/fr/guide-ia` (hub) + `[slug]` (si existe)                                                       | `type='guide'`         | _aucun_                                                                 | Phase A : auditer, créer `type='guide'`.                                                                 |
| `/fr/recherche`                                                                                   | _tous types_           | _aucun_                                                                 | Étendre la recherche pour couvrir `KnowledgeEntry` cross-type.                                           |
| `/fr/presse`                                                                                      | _hors scope KB_        | dédié                                                                   | Pas de migration KB.                                                                                     |

### 10.2 Hub agrégateur (NOUVEAU)

- `/fr/ressources/` : hub cross-type avec filtres (type, domain, tag, audience public uniquement), recherche FTS, flux RSS/Atom global, JSON Feed.
- `/fr/ressources/tag/[tag]` : liste cross-type par tag.
- `/fr/ressources/auteur/[slug]` : liste cross-type par auteur (E-E-A-T).
- `/en/resources/` : parity EN.

### 10.3 Surface client (NOUVEAU)

- `/fr/mes-ressources/` : entrées `audience IN ('public', 'client')` + bookmarks personnels + onboarding journey (selon service du client).
- Login NextAuth requis (rôle `CLIENT` + booking confirmé).

### 10.4 Admin (NOUVEAU + LEGACY)

- **Nouveau** : `/fr/<adminPrefix>/connaissances/` (français cohérent) — voir §11 pour arborescence.
- **Legacy** : `/fr/<adminPrefix>/{blog,case-studies,faq,help,categories}/` conservé en V1, marqué `legacy` (badge UI), redirige progressivement vers `/connaissances/?filter=type=...`. Suppression complète = V1.5 ou V2+ après validation Will + zéro friction.

---

## 11. STRUCTURE DE DOSSIERS CIBLE EXHAUSTIVE — SCALABLE + ÉVOLUTIVE

> Cette section est **prescriptive** pour Phase B. La Phase A peut proposer des ajustements mineurs justifiés, mais l'arborescence globale est fixée.

### 11.1 Vue d'ensemble

```
axionia/
├── prisma/
│   ├── schema.prisma                         # ← étendu avec modèles Knowledge*
│   ├── migrations/
│   │   ├── YYYYMMDDHHMMSS_kb_01_init_schema/             # Sprint KB-1
│   │   ├── YYYYMMDDHHMMSS_kb_02_migrate_article/         # Sprint KB-2 (expand)
│   │   ├── YYYYMMDDHHMMSS_kb_02_backfill_article/        # Sprint KB-2 (backfill, séparé)
│   │   ├── YYYYMMDDHHMMSS_kb_02_contract_article/        # Sprint KB-2 (contract, après vérif prod)
│   │   ├── YYYYMMDDHHMMSS_kb_03_versions/                # Sprint KB-4
│   │   ├── YYYYMMDDHHMMSS_kb_04_relations/               # Sprint KB-4
│   │   ├── YYYYMMDDHHMMSS_kb_05_slug_history/            # Sprint KB-12
│   │   ├── YYYYMMDDHHMMSS_kb_06_assets/                  # Sprint KB-11
│   │   ├── YYYYMMDDHHMMSS_kb_07_pipeline_editorial/      # Sprint KB-13
│   │   ├── YYYYMMDDHHMMSS_kb_08_feedback/                # Sprint KB-5
│   │   ├── YYYYMMDDHHMMSS_kb_09_bookmarks/               # Sprint KB-18
│   │   ├── YYYYMMDDHHMMSS_kb_10_pgvector_embeddings/     # Sprint KB-21 (V1.5)
│   │   └── ...
│   ├── migrations_fts/
│   │   ├── kb_fts_french.sql                 # Sprint KB-7
│   │   ├── kb_fts_english.sql                # Sprint KB-7
│   │   └── kb_unaccent_trgm.sql              # Sprint KB-7
│   └── seed-knowledge.ts                     # Sprint KB-2 : seed dev/test après migration legacy
│
├── src/
│   ├── app/
│   │   ├── [locale]/
│   │   │   ├── (admin)/
│   │   │   │   └── [adminPrefix]/
│   │   │   │       └── connaissances/                    # ← admin FR cohérent (NOUVEAU)
│   │   │   │           ├── page.tsx                      # Liste filtrable + tri + recherche
│   │   │   │           ├── loading.tsx
│   │   │   │           ├── ConnaissancesListClient.tsx   # Composant client filtres + pagination
│   │   │   │           ├── nouvelle/
│   │   │   │           │   └── page.tsx                  # Création
│   │   │   │           ├── [id]/
│   │   │   │           │   ├── page.tsx                  # Édition (onglets latéraux)
│   │   │   │           │   ├── EditeurTiptapClient.tsx   # Éditeur riche
│   │   │   │           │   ├── PanneauMetadonnees.tsx
│   │   │   │           │   ├── PanneauVersions.tsx
│   │   │   │           │   ├── PanneauRelations.tsx
│   │   │   │           │   ├── PanneauPublication.tsx
│   │   │   │           │   ├── PanneauMedias.tsx
│   │   │   │           │   ├── PanneauRgpd.tsx
│   │   │   │           │   └── apercu/
│   │   │   │           │       └── page.tsx              # Preview admin
│   │   │   │           ├── calendrier/
│   │   │   │           │   └── page.tsx                  # Vue calendrier éditorial
│   │   │   │           ├── sante/
│   │   │   │           │   └── page.tsx                  # Health dashboard + KPIs
│   │   │   │           ├── medias/
│   │   │   │           │   ├── page.tsx                  # Asset library
│   │   │   │           │   └── [assetId]/
│   │   │   │           │       └── page.tsx
│   │   │   │           ├── imports/
│   │   │   │           │   ├── page.tsx                  # Wizard import (Notion/MD/_AUDIT)
│   │   │   │           │   └── [batchId]/
│   │   │   │           │       └── page.tsx              # Détail batch + rollback
│   │   │   │           ├── etiquettes/
│   │   │   │           │   └── page.tsx                  # CRUD tags + merge tags
│   │   │   │           ├── auteurs/
│   │   │   │           │   ├── page.tsx                  # Liste auteurs (E-E-A-T)
│   │   │   │           │   └── [authorId]/
│   │   │   │           │       └── page.tsx
│   │   │   │           ├── files-attente-revue/
│   │   │   │           │   └── page.tsx                  # Reviewer queue
│   │   │   │           └── parametres/
│   │   │   │               └── page.tsx                  # SSOT runtime overrides (seuils quality, etc.)
│   │   │   │
│   │   │   ├── blog/                                     # ← URLs PUBLIQUES PRÉSERVÉES
│   │   │   │   ├── page.tsx                              # Lit KnowledgeEntry WHERE type='article'
│   │   │   │   ├── [slug]/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── auteur/[slug]/page.tsx
│   │   │   │   ├── categorie/[slug]/page.tsx
│   │   │   │   ├── secteur/[slug]/page.tsx
│   │   │   │   ├── service/[slug]/page.tsx
│   │   │   │   ├── tag/[slug]/page.tsx
│   │   │   │   └── feed.xml/route.ts
│   │   │   │
│   │   │   ├── cas-concrets/[slug]/page.tsx              # ← Lit type='case_study'
│   │   │   ├── centre-aide/[slug]/page.tsx               # ← Lit type='help_article'
│   │   │   ├── faq/page.tsx                              # ← Hub FAQ
│   │   │   ├── glossaire/                                # ← Nouveau type='glossary_term'
│   │   │   │   ├── page.tsx
│   │   │   │   └── [slug]/page.tsx
│   │   │   ├── guide-ia/                                 # ← Nouveau type='guide'
│   │   │   │   ├── page.tsx
│   │   │   │   └── [slug]/page.tsx
│   │   │   │
│   │   │   ├── ressources/                               # ← NOUVEAU hub agrégateur
│   │   │   │   ├── page.tsx                              # Cross-type avec facettes
│   │   │   │   ├── loading.tsx
│   │   │   │   ├── opengraph-image.tsx                   # OG dynamique hub
│   │   │   │   ├── feed.xml/route.ts                     # RSS global
│   │   │   │   ├── feed.json/route.ts                    # JSON Feed global
│   │   │   │   ├── tag/[tag]/page.tsx
│   │   │   │   └── auteur/[slug]/page.tsx
│   │   │   │
│   │   │   ├── mes-ressources/                           # ← NOUVEAU client connecté
│   │   │   │   ├── page.tsx
│   │   │   │   ├── favoris/page.tsx
│   │   │   │   └── [slug]/page.tsx
│   │   │   │
│   │   │   ├── recherche/                                # ← Étendue cross-type KB
│   │   │   │   └── page.tsx
│   │   │   │
│   │   │   └── api/
│   │   │       └── kb-preview/[token]/route.ts           # Preview tokenisé (jwt court)
│   │   │
│   │   └── api/
│   │       └── internal/
│   │           └── kb/                                   # ← NOUVEAU
│   │               ├── search/route.ts                   # FTS + facettes
│   │               ├── feedback/route.ts                 # 👍/👎 anonymisé
│   │               ├── rag/route.ts                      # V1.5
│   │               ├── embed/route.ts                    # V1.5 (admin trigger reindex)
│   │               ├── export-full/route.ts              # Export GDPR full-KB
│   │               ├── [id]/pdf/route.ts                 # PDF on-demand
│   │               └── [id]/route.ts                     # GET single (admin)
│   │
│   ├── components/
│   │   ├── knowledge/                                    # ← NOUVEAU module dédié
│   │   │   ├── admin/
│   │   │   │   ├── EntryListTable.tsx
│   │   │   │   ├── EntryListFilters.tsx
│   │   │   │   ├── EntryEditor.tsx                       # Wrapper Tiptap admin
│   │   │   │   ├── EntryEditorToolbar.tsx
│   │   │   │   ├── EntryEditorSlashMenu.tsx
│   │   │   │   ├── EntryEditorAutosave.tsx
│   │   │   │   ├── MetadataPanel.tsx
│   │   │   │   ├── VersionsPanel.tsx                     # Diff + rollback
│   │   │   │   ├── RelationsPanel.tsx                    # Graphe simple
│   │   │   │   ├── PublicationPanel.tsx                  # Workflow states
│   │   │   │   ├── MediaPicker.tsx                       # Asset library picker
│   │   │   │   ├── RgpdPanel.tsx                         # PII scan inline
│   │   │   │   ├── QualityScoreGauge.tsx
│   │   │   │   ├── ReadabilityScore.tsx
│   │   │   │   ├── CalendarBoard.tsx                     # Vue calendrier éditorial
│   │   │   │   ├── HealthDashboard.tsx
│   │   │   │   ├── ImportWizard.tsx
│   │   │   │   └── TagsMerger.tsx
│   │   │   ├── public/
│   │   │   │   ├── EntryRenderer.tsx                     # Rendu SSR Tiptap → React (PUR)
│   │   │   │   ├── EntryHeader.tsx                       # Title + author bio + reviewed date
│   │   │   │   ├── EntryToc.tsx                          # TOC sticky
│   │   │   │   ├── EntryFooter.tsx                       # Citations + how-to-cite + 👍/👎
│   │   │   │   ├── AuthorByline.tsx
│   │   │   │   ├── FactCheckedBadge.tsx
│   │   │   │   ├── RelatedEntries.tsx                    # Auto + manuel
│   │   │   │   ├── ResourcesHub.tsx                      # Hub /ressources
│   │   │   │   ├── ResourcesFilters.tsx
│   │   │   │   ├── HelpfulVoteButton.tsx
│   │   │   │   └── ShareCitationButton.tsx
│   │   │   ├── client/
│   │   │   │   ├── MyResourcesList.tsx
│   │   │   │   ├── BookmarkButton.tsx
│   │   │   │   └── PrivateNoteEditor.tsx
│   │   │   └── shared/
│   │   │       ├── TiptapRendererTypes.ts
│   │   │       ├── tiptap-extensions.ts                  # Whitelist nodes/marks
│   │   │       └── tiptap-sanitize.ts                    # SSR sanitization
│   │   ├── a11y/ ...                                     # ← composants accessibilité réutilisés
│   │   ├── nav/ ...
│   │   └── ui/ ...
│   │
│   ├── content/
│   │   ├── knowledge-base.ts                             # ← SSOT principal (enums, labels, mappings)
│   │   ├── knowledge/
│   │   │   ├── types.ts                                  # Enum `type` + label FR/EN + JSON-LD type
│   │   │   ├── domains.ts                                # Enum `domain` + label
│   │   │   ├── audiences.ts                              # Enum `audience` + visibility rules
│   │   │   ├── confidentialities.ts                      # Enum + PII rules
│   │   │   ├── statuses.ts                               # Workflow state machine
│   │   │   ├── relation-kinds.ts                         # `replaces`, `cites`, `depends_on`, `related_to`
│   │   │   ├── templates/                                # Templates par type (Tiptap JSON skeleton)
│   │   │   │   ├── article.ts
│   │   │   │   ├── case-study.ts
│   │   │   │   ├── help-article.ts
│   │   │   │   ├── faq.ts
│   │   │   │   ├── glossary-term.ts
│   │   │   │   └── guide.ts
│   │   │   ├── snippets.ts                               # Bibliothèque snippets éditeur
│   │   │   ├── quality-thresholds.ts                     # Seuils quality score par type
│   │   │   ├── review-windows.ts                         # Durée review par type
│   │   │   └── routes.ts                                 # Mapping type → URL pattern
│   │   ├── pricing.ts                                    # ← existant
│   │   ├── interventions-taxonomy.ts                     # ← existant
│   │   └── ...
│   │
│   ├── lib/
│   │   ├── knowledge/                                    # ← NOUVEAU
│   │   │   ├── prisma-helpers.ts                         # Query builders typés
│   │   │   ├── prisma-helpers.test.ts
│   │   │   ├── slug.ts                                   # Génération + collision + history
│   │   │   ├── slug.test.ts
│   │   │   ├── tiptap-render.ts                          # SSR Tiptap JSON → React
│   │   │   ├── tiptap-sanitize.ts                        # XSS whitelist
│   │   │   ├── tiptap-toc.ts                             # Extraction TOC depuis JSON
│   │   │   ├── tiptap-toc.test.ts
│   │   │   ├── tiptap-word-count.ts
│   │   │   ├── reading-time.ts
│   │   │   ├── readability-fr.ts                         # Flesch-Kincaid FR
│   │   │   ├── quality-score.ts                          # Calcul score /100
│   │   │   ├── quality-score.test.ts
│   │   │   ├── pii-scan.ts                               # Wrapper pii-redaction.ts + bloquant
│   │   │   ├── permissions.ts                            # RBAC KB
│   │   │   ├── permissions.test.ts
│   │   │   ├── json-ld.ts                                # Factories JSON-LD par type
│   │   │   ├── json-ld.test.ts
│   │   │   ├── jsondiff.ts                               # Diff de versions
│   │   │   ├── related-entries.ts                        # Algo auto-related
│   │   │   ├── search-fts.ts                             # Builder requêtes FTS
│   │   │   ├── search-fts.test.ts
│   │   │   ├── search-hybrid.ts                          # FTS + cosine (V1.5)
│   │   │   ├── embeddings.ts                             # Wrapper SDK Anthropic (V1.5)
│   │   │   ├── rag.ts                                    # RAG endpoint logic (V1.5)
│   │   │   └── index.ts                                  # Barrel export
│   │   ├── pii-redaction.ts                              # ← existant
│   │   ├── prisma.ts                                     # ← existant
│   │   └── ...
│   │
│   ├── server/
│   │   ├── actions/
│   │   │   └── knowledge/                                # ← NOUVEAU server actions
│   │   │       ├── create-entry.ts
│   │   │       ├── update-entry.ts
│   │   │       ├── save-draft.ts                         # Autosave (throttled)
│   │   │       ├── submit-for-review.ts
│   │   │       ├── publish.ts
│   │   │       ├── unpublish.ts
│   │   │       ├── schedule-publish.ts
│   │   │       ├── archive.ts
│   │   │       ├── restore.ts
│   │   │       ├── delete-entry.ts
│   │   │       ├── add-relation.ts
│   │   │       ├── remove-relation.ts
│   │   │       ├── add-translation.ts
│   │   │       ├── rollback-version.ts
│   │   │       ├── assign-reviewer.ts
│   │   │       ├── bulk-tag.ts
│   │   │       ├── bulk-archive.ts
│   │   │       ├── import-batch.ts
│   │   │       ├── rollback-import-batch.ts
│   │   │       ├── upload-asset.ts
│   │   │       ├── delete-asset.ts
│   │   │       ├── feedback-vote.ts                      # 👍/👎 public
│   │   │       ├── bookmark-toggle.ts                    # Client
│   │   │       └── _zod-schemas.ts                       # Tous les Zod regroupés
│   │   ├── queue/
│   │   │   └── workers/                                  # ← BullMQ existant, on ajoute :
│   │   │       ├── knowledge-image-process.ts            # sharp AVIF/WebP
│   │   │       ├── knowledge-pdf-generate.ts             # PDF on-demand
│   │   │       ├── knowledge-newsletter-digest.ts        # Pickup hebdo/mensuel
│   │   │       ├── knowledge-broken-links.ts             # Cron détection liens cassés
│   │   │       ├── knowledge-review-expiry.ts            # Cron review-due
│   │   │       ├── knowledge-retention-purge.ts          # Cron RGPD
│   │   │       ├── knowledge-asset-gc.ts                 # GC assets orphelins 30j
│   │   │       ├── knowledge-embedding-reindex.ts        # V1.5
│   │   │       └── knowledge-import-process.ts           # Worker import lourd (Notion)
│   │   ├── importers/                                    # ← NOUVEAU
│   │   │   ├── knowledge-audit-md.ts                     # `_AUDIT/*.md`
│   │   │   ├── knowledge-markdown-git.ts                 # Dossier MD
│   │   │   ├── knowledge-notion.ts                       # Notion API
│   │   │   ├── knowledge-google-docs.ts                  # V1.5
│   │   │   ├── prosemirror-from-markdown.ts              # Helper conversion
│   │   │   └── mapping.ts                                # Wizard mapping fields
│   │   └── exporters/                                    # ← NOUVEAU
│   │       ├── knowledge-rss-atom.ts
│   │       ├── knowledge-json-feed.ts
│   │       ├── knowledge-llms-txt.ts                     # Étend helper existant
│   │       ├── knowledge-pdf.ts                          # Lib choisie Phase A
│   │       ├── knowledge-epub.ts                         # V1.5
│   │       └── knowledge-gdpr-json.ts                    # Export GDPR
│   │
│   ├── features/                                         # ← existant (si pattern feature-based adopté)
│   │   └── knowledge/                                    # Optionnel — Phase A tranche selon convention dominante
│   │       └── ... (alternative à src/lib/knowledge + src/components/knowledge)
│   │
│   ├── messages/                                         # ← next-intl
│   │   ├── fr/
│   │   │   ├── knowledge.json                            # ← NOUVEAU
│   │   │   ├── knowledge-admin.json                      # ← NOUVEAU (admin only)
│   │   │   └── ...
│   │   └── en/
│   │       ├── knowledge.json                            # ← NOUVEAU
│   │       └── ...
│   │
│   └── i18n/                                             # ← config existante
│       └── ...
│
├── scripts/                                              # ← pattern existant
│   ├── check-knowledge-schema.ts                         # Vérif cohérence SSOT ↔ Prisma
│   ├── check-knowledge-i18n.ts                           # Vérif parity FR/EN messages
│   ├── check-knowledge-orphan-tags.ts
│   ├── check-knowledge-broken-relations.ts
│   ├── import-knowledge-audit-md.ts                      # CLI manuel
│   ├── import-knowledge-from-legacy.ts                   # Migration Article → KnowledgeEntry
│   ├── reindex-knowledge-fts.ts
│   ├── reindex-knowledge-embeddings.ts                   # V1.5
│   ├── backup-knowledge.sh                               # Dump filtré
│   ├── restore-knowledge-test.sh                         # DR drill
│   └── seed-knowledge-dev.ts
│
├── tests/                                                # ← pattern existant
│   ├── e2e/
│   │   └── knowledge/                                    # ← NOUVEAU
│   │       ├── creation-publication.spec.ts
│   │       ├── workflow-review.spec.ts
│   │       ├── recherche-fts.spec.ts
│   │       ├── surface-client.spec.ts
│   │       ├── import-md.spec.ts
│   │       ├── permissions-rbac.spec.ts
│   │       ├── accessibility-axe.spec.ts
│   │       ├── scheduled-publish.spec.ts
│   │       └── slug-redirect-301.spec.ts
│   ├── integration/
│   │   └── knowledge/                                    # ← NOUVEAU
│   │       ├── workflow-states.test.ts
│   │       ├── versions.test.ts
│   │       ├── relations.test.ts
│   │       ├── slug-history.test.ts
│   │       ├── quality-score.test.ts
│   │       ├── pii-scan-bloquant.test.ts
│   │       ├── tiptap-sanitize.test.ts
│   │       ├── import-batch.test.ts
│   │       └── migration-article-legacy.test.ts
│   └── schemas/
│       └── knowledge/                                    # ← NOUVEAU (Zod schemas)
│           └── ...
│
├── _AUDIT/
│   ├── PROMPT-KNOWLEDGE-BASE-2026.md                     # ← ce prompt
│   ├── KNOWLEDGE-BASE-2026/                              # ← livrables Phase A
│   │   ├── 00-REALITY-CHECK.md
│   │   ├── 01-DATA-MODEL.md
│   │   ├── ... (18 livrables)
│   │   └── SPRINT-N-REPORT.md                            # Phase B, par sprint
│   └── adr/
│       └── ADR-XXXX-knowledge-base.md                    # ADR `proposed` Phase A → `accepted` Phase B
│
└── docs/                                                 # ← si dossier docs existe ; sinon créer
    └── knowledge/
        ├── editorial-style-guide.md                      # Style guide rédacteurs
        ├── runbook-prod.md                               # Runbook ops
        └── api-internal.md                               # Doc endpoints internes
```

### 11.2 Principes d'évolutivité

1. **Co-location** : composants et utilitaires d'une feature vivent ensemble (`src/components/knowledge/{admin,public,client,shared}`).
2. **Barrel exports** : chaque sous-module exporte via `index.ts` pour limiter la profondeur d'import.
3. **Tests à côté du code** (pattern existant) : `slug.ts` + `slug.test.ts` colocalisés. E2E + intégration séparés dans `tests/`.
4. **Migrations Prisma découpées** : 1 sprint = 1+ migration nommée `kb_NN_description`. Pas de mégaSQL.
5. **SSOT = TypeScript** : tout config dans `src/content/knowledge-base.ts` et sous-modules `src/content/knowledge/*.ts`. Aucune string magique dans les composants.
6. **i18n parity script bloquant** : `scripts/check-knowledge-i18n.ts` vérifie FR/EN messages, lance en CI.
7. **Server actions par opération atomique** : 1 fichier par action (pas de "god file" `actions.ts` à 800 lignes).
8. **Workers BullMQ déjà en place** : `src/server/queue/workers/` réutilisé, on ajoute des workers KB en suivant le pattern.
9. **Importers + exporters séparés** dans `src/server/{importers,exporters}/` pour isoler les intégrations externes.
10. **Pas de cross-import lib ↔ components** : composants importent depuis `src/lib/knowledge/*` mais jamais l'inverse.

### 11.3 Conventions de fichiers

| Type                   | Convention                                                    | Exemple                           |
| ---------------------- | ------------------------------------------------------------- | --------------------------------- |
| Composant React server | `PascalCase.tsx`, pas de `'use client'`                       | `EntryListTable.tsx`              |
| Composant React client | `PascalCase.tsx` + `'use client'`, suffixe `Client` si ambigu | `EntryEditorTiptapClient.tsx`     |
| Hook                   | `useXxx.ts`                                                   | `useEntryAutosave.ts`             |
| Util TS                | `kebab-case.ts`                                               | `quality-score.ts`                |
| Test                   | `<nom>.test.ts(x)` colocalisé                                 | `slug.test.ts`                    |
| Server action          | `kebab-case.ts` avec `'use server'`                           | `publish.ts`                      |
| Worker BullMQ          | `knowledge-<verbe>.ts`                                        | `knowledge-image-process.ts`      |
| Page Next              | `page.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`       | _idem repo_                       |
| Migration Prisma       | `YYYYMMDDHHMMSS_kb_NN_description/migration.sql`              | _Prisma natif_                    |
| Script CLI             | `kebab-case.ts` ou `.sh`                                      | `import-knowledge-from-legacy.ts` |

---

## 12. NAMING CONVENTIONS — VALEURS PERSISTANTES ET URLS

### 12.1 Enums `type` (valeurs DB stables, jamais traduites)

```ts
export const KB_TYPES = [
  // Existants migrés depuis modèles legacy
  "article", // Blog
  "case_study", // Cas concret
  "help_article", // Centre d'aide
  "faq", // Question fréquente
  "glossary_term", // Terme glossaire
  "guide", // Guide IA long-form
  // Internes (V1)
  "methodology", // Méthodologie (interne ou publique)
  "doctrine", // Doctrine Axion-IA (interne ou cliente)
  "adr", // Architecture Decision Record (interne)
  "prompt_template", // Template de prompt (interne)
  "sop", // Standard Operating Procedure (interne)
  "post_mortem", // Post-mortem (interne)
  "tool_card", // Fiche outil (interne ou cliente)
  "competitor_card", // Fiche concurrent (interne)
  "commercial_doc", // Document commercial (interne ou client)
  "onboarding_step", // Étape onboarding (client)
  // V4 — Knowledge Factory Industrielle (production 100% automatique IA, FR uniquement V1)
  "automation_recipe", // Recette d'automatisation (N8N/Zapier/Make) — cible ~8000/an
  "tool_review", // Avis sur outil IA pour pros — ~3000/an
  "industry_use_case", // Cas d'usage IA par secteur (santé, retail, BTP, …) — ~6000/an
  "comparison", // Comparatif outil X vs outil Y — ~2000/an
  "implementation_playbook", // Playbook d'implémentation IA — ~1500/an
  "prompt_pattern", // Pattern de prompt pour métier/tâche — ~5000/an
  "roi_calculator_template", // Template calculateur ROI IA — ~500/an
  "intervention_module", // Module d'intervention (montée en compétence). JAMAIS « training »/« formation ». — ~2000/an
  "competence_boost", // Boost compétence court (15-30 min, micro-apprentissage) — ~3000/an
  "secteur_brief", // Brief sectoriel IA (santé / industrie / services / …) — ~500/an
  "dept_brief", // Brief département (DRH / RAF / DSI / Marketing / …) — ~500/an
  "metier_brief", // Brief métier (commercial / juriste / acheteur / …) — ~1500/an
] as const;
```

> **V4 — Doctrine `axionia-core` rappel** : mot « formation » BANNI partout (code, copy, docs, slugs, JSON-LD). `intervention_module` et `competence_boost` couvrent le sujet « montée en compétence équipes » en respectant la doctrine. Lint check `scripts/check-knowledge-banned-words.ts` à créer en KB-1 pour bloquer en CI toute occurrence dans `title`/`excerpt`/`body`/`metaTitle`/`metaDescription`.

### 12.2 Enums `domain`

```ts
export const KB_DOMAINS = [
  "commercial",
  "technical",
  "legal",
  "hr",
  "product",
  "client",
  "watch", // Veille
  "internal",
  "editorial",
  "methodology",
] as const;
```

### 12.3 Enums `audience` + `confidentiality`

```ts
export const KB_AUDIENCES = ["public", "client", "team", "will_only"] as const;
export const KB_CONFIDENTIALITIES = ["public", "internal", "confidential", "secret"] as const;
```

### 12.4 Mapping `type` → URL publique (SSOT `src/content/knowledge/routes.ts`)

```ts
export const KB_PUBLIC_ROUTES: Record<KbType, { fr: string; en: string } | null> = {
  article: { fr: "/blog", en: "/blog" },
  case_study: { fr: "/cas-concrets", en: "/case-studies" },
  help_article: { fr: "/centre-aide", en: "/help-center" },
  faq: { fr: "/faq", en: "/faq" },
  glossary_term: { fr: "/glossaire", en: "/glossary" },
  guide: { fr: "/guide-ia", en: "/ai-guide" },
  methodology: null, // type interne (public visible uniquement via hub /ressources si audience='public')
  doctrine: null,
  adr: null,
  prompt_template: null,
  sop: null,
  post_mortem: null,
  tool_card: null,
  competitor_card: null,
  commercial_doc: null,
  onboarding_step: null,
};
```

Une entrée `methodology` `audience='public'` apparaît dans `/ressources/` hub mais n'a pas d'URL dédiée par type (URL canonique = `/ressources/[id]/[slug]`).

### 12.5 Routes admin (FR cohérent)

- Liste : `/fr/<adminPrefix>/connaissances`
- Création : `/fr/<adminPrefix>/connaissances/nouvelle`
- Édition : `/fr/<adminPrefix>/connaissances/[id]`
- Apercu : `/fr/<adminPrefix>/connaissances/[id]/apercu`
- Calendrier : `/fr/<adminPrefix>/connaissances/calendrier`
- Santé : `/fr/<adminPrefix>/connaissances/sante`
- Médias : `/fr/<adminPrefix>/connaissances/medias`
- Imports : `/fr/<adminPrefix>/connaissances/imports`
- Étiquettes : `/fr/<adminPrefix>/connaissances/etiquettes`
- Auteurs : `/fr/<adminPrefix>/connaissances/auteurs`
- Revue : `/fr/<adminPrefix>/connaissances/files-attente-revue`
- Paramètres : `/fr/<adminPrefix>/connaissances/parametres`

---

## 13. PLAN D'IMPLÉMENTATION DE BOUT EN BOUT (V1 → V1.5)

> Plan opérationnel chiffré et séquencé. Effort en **demi-journées Will-équivalent** (1 dj ≈ 4 h focus). Pré-requis explicites. Tests bloquants par sprint.

### 13.1 Vue d'ensemble (Gantt textuel)

```
PHASE 0 — Audit (Phase A du prompt)              ░░░░░  5 dj
─────────────────────────────────────────────────────────────
PHASE 1 — Fondations (KB-1 à KB-4)               ████  16 dj
PHASE 2 — Migration data (KB-5 à KB-6)           ████  10 dj
PHASE 3 — Surfaces (KB-7 à KB-10)                ████  14 dj
PHASE 4 — Enrichissement (KB-11 à KB-16)         ███████  22 dj
PHASE 5 — Polish + tests prod (KB-17 à KB-20)    ████  14 dj
─── V1 BORNE — production ready ─────────────────────────────
PHASE 6 — IA (V1.5 — KB-21 à KB-24)              █████  18 dj
PHASE 7 — V2+ (chatbot, multi-tenant, etc.)      [non chiffré]
```

**Effort V1 total** : ~81 dj ≈ 4 mois calendaires à 1 dj/jour mixé avec autres priorités.
**Effort V1.5** : ~18 dj.
**Coût additionnel mensuel V1** : 0 € (CPX32 absorbe).
**Coût additionnel mensuel V1.5** : 5-30 €/mois (embeddings Anthropic avec prompt caching).

### 13.2 Phase 0 — Audit (Phase A de ce prompt)

**Livrables** : 22 fichiers `.md` dans `_AUDIT/KNOWLEDGE-BASE-2026/` + scoring /300 + ADR draft + plan exécution.
**Sortie** : verdict GO / CONDITIONAL GO / NO-GO + décisions Will tranchées.
**Effort** : 5 dj (audit lui-même) + 1 dj revue par Will.
**Pré-requis** : aucun.
**Gate** : `GO BUILD KB-SPRINT-1` explicite Will.

### 13.3 Phase 1 — Fondations

| Sprint   | Titre                                                                              | Effort | Pré-requis | Livrables                                                                                                                                                                       | Gate                                                      |
| -------- | ---------------------------------------------------------------------------------- | ------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **KB-1** | Schéma Prisma + SSOT `knowledge-base.ts`                                           | 4 dj   | Phase 0 GO | `prisma/schema.prisma` étendu + migration `kb_01_init_schema/` + `src/content/knowledge-base.ts` + `src/content/knowledge/*.ts` + `src/lib/knowledge/prisma-helpers.ts` + tests | `pnpm db:migrate:dev` OK + `pnpm typecheck` + `pnpm test` |
| **KB-2** | Migration legacy `Article` → `KnowledgeEntry` (expand-backfill-contract)           | 5 dj   | KB-1       | 3 migrations Prisma (expand, backfill via script, contract) + `scripts/import-knowledge-from-legacy.ts` + tests                                                                 | Test sur copie prod DB + rollback testé                   |
| **KB-3** | Admin core CRUD `/connaissances/` (liste + éditeur Tiptap minimal + create/update) | 5 dj   | KB-2       | Pages admin + composants + 5 server actions + Zod + tests                                                                                                                       | E2E `creation-publication.spec.ts`                        |
| **KB-4** | Workflow états + versionning + audit log                                           | 2 dj   | KB-3       | State machine + `KnowledgeVersion` migration + `ActivityLog` étendu + tests intégration                                                                                         | `workflow-states.test.ts` vert                            |

### 13.4 Phase 2 — Migration data + surfaces publiques

| Sprint   | Titre                                                            | Effort | Pré-requis | Livrables                                                                                            | Gate                             |
| -------- | ---------------------------------------------------------------- | ------ | ---------- | ---------------------------------------------------------------------------------------------------- | -------------------------------- |
| **KB-5** | Migration `CaseStudy` + `HelpArticle` + `FAQ` → `KnowledgeEntry` | 5 dj   | KB-4       | 3 cycles expand-backfill-contract + tests                                                            | `migration-*.test.ts` verts      |
| **KB-6** | Routes publiques préservées branchées sur backend unifié         | 5 dj   | KB-5       | Refactor `/blog`, `/cas-concrets`, `/centre-aide`, `/faq` pour lire `KnowledgeEntry` + Lighthouse CI | Web Vitals OK sur 5 routes pivot |

### 13.5 Phase 3 — Surfaces nouvelles

| Sprint    | Titre                                                                     | Effort | Pré-requis        | Livrables                                                                                                              | Gate                                     |
| --------- | ------------------------------------------------------------------------- | ------ | ----------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| **KB-7**  | Recherche FTS Postgres FR + EN + facettes                                 | 4 dj   | KB-6              | `migrations_fts/kb_fts_*.sql` + `src/lib/knowledge/search-fts.ts` + `/api/internal/kb/search` + extension `/recherche` | `recherche-fts.spec.ts` E2E              |
| **KB-8**  | Hub `/ressources/` + RSS/Atom/JSON Feed + llms.txt enrichi                | 4 dj   | KB-7              | Page hub + `/ressources/feed.xml` + `/ressources/feed.json` + helper llms.txt étendu                                   | Validateur RSS/JSON Feed + IndexNow ping |
| **KB-9**  | Surface client `/mes-ressources/` + bookmarks + notes privées             | 3 dj   | KB-8, NextAuth OK | Pages client + `KnowledgeBookmark` migration + tests                                                                   | `surface-client.spec.ts` E2E             |
| **KB-10** | Accessibilité WCAG 2.2 AA + E-E-A-T (bloc auteur, reviewed-by, citations) | 3 dj   | KB-6              | `AuthorByline` + `FactCheckedBadge` + axe-core CI + alt text bloquant publication                                      | `accessibility-axe.spec.ts` E2E          |

### 13.6 Phase 4 — Enrichissement

| Sprint                     | Titre                                                                                | Effort | Pré-requis                           | Livrables                                                                                                                                                                                                                                                                  | Gate                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------ | ------ | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **KB-11**                  | Pipeline médias + asset library + sharp AVIF/WebP + EXIF strip                       | 5 dj   | KB-3                                 | `KnowledgeAsset` migration + worker `knowledge-image-process.ts` + `/connaissances/medias` + asset picker                                                                                                                                                                  | Upload + variantes générées sans bloquer thread                                                       |
| **KB-12**                  | Slug history + redirects 301 + sécurité contenu (sanitization XSS + SSRF)            | 3 dj   | KB-6                                 | `KnowledgeSlugHistory` migration + middleware + `tiptap-sanitize.ts` durci                                                                                                                                                                                                 | `slug-redirect-301.spec.ts`                                                                           |
| **KB-12.5** ⚙️ V4 promu V1 | pgvector + embeddings + recherche hybride (basculé V1.5 → V1 obligatoire à 100/jour) | 5 dj   | KB-7 vert + bench RAM CPX32 OK       | Extension pgvector + migration `kb_10_pgvector_embeddings/` + worker `knowledge-embedding-reindex.ts` + `search-hybrid.ts` FTS + cosine RRF + budget RAM monitoré                                                                                                          | Recherche hybride bench vs FTS pure + dedup-ready pour KB-13                                          |
| **KB-13** ⚙️ V4            | Quality gates automatiques + dedup pgvector + monitoring dashboard                   | 5 dj   | KB-4, KB-11, **KB-12.5 pgvector OK** | Heuristiques + LLM scoring (`quality-gates.ts`) + cosine similarity bloquant (`dedup-pgvector.ts`) + PII scan bloquant + Telegram alertes + `/connaissances/sante` dashboard temps-réel + kill switch `KB_AUTO_PUBLISH`                                                    | Test de charge 100 entrées/jour qualifiées en < 30 min                                                |
| **KB-14** ⚙️ V4            | Auto-génération SEO/AEO/GEO de bout en bout                                          | 5 dj   | KB-13                                | Auto meta title + meta description (LLM cached) + JSON-LD par type + Open Graph image dynamique + hreflang structure (FR seul actif) + AEO bloc 50-80 mots auto-extrait + GEO entités auto-taggées (villes/secteurs/métiers) + auto-injection sitemap + auto-ping IndexNow | Lighthouse SEO 100/100 sur 10 entrées factory échantillonnées                                         |
| **KB-15** ⚙️ V4            | API d'ingestion massive `/api/internal/kb/ingest` + intégration Content Generator    | 5 dj   | KB-13, KB-14                         | Endpoint POST authentifié HMAC + Zod stricte + idempotency key + queue BullMQ `knowledge-ingest` + audit log avec `source.factoryId` + rate limit 200/min + retry policy + circuit breaker                                                                                 | Test E2E ingestion 100 entrées sans perte ni doublon                                                  |
| **KB-16** ⚙️ V4            | Auto-publication + distribution multi-format auto + admin override                   | 4 dj   | KB-14, KB-15                         | Publish auto si quality ≥ seuil sinon `audience='team'` + auto RSS/JSON Feed/llms.txt/newsletter pickup + opengraph auto + sitemap auto + admin viewer minimal `/connaissances/[id]` avec override manuel possible                                                         | Test publication chaîne complète bout-en-bout (ingestion → vérification → publication → distribution) |

### 13.7 Phase 5 — Polish + tests prod

| Sprint          | Titre                                                                     | Effort | Pré-requis   | Livrables                                                                                                                                                                                                                                                                                                                                                                                                | Gate                                                                                                      |
| --------------- | ------------------------------------------------------------------------- | ------ | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **KB-17** ⚙️ V4 | Observabilité factory + alerting + disaster recovery massif               | 4 dj   | KB-13, KB-16 | Sentry custom events `kb.ingest.*` / `kb.publish.*` / `kb.dedup.match` / `kb.quality.fail` + Plausible goals + dashboard `/connaissances/sante` (volume horaire/quotidien, taux quality fail, taux dedup match, latence p95 ingest→publish) + Telegram alertes volume anormal + **bouton « dépublier toutes les entrées créées entre T1 et T2 »** (disaster recovery massif si content factory déraille) | Test scénario : 1 incident simulé (entrée problématique) → détection < 5 min + rollback < 2 min           |
| **KB-18** ⚙️ V4 | Programmatic SEO templates par type + slugs auto + canonicals             | 3 dj   | KB-14, KB-15 | Templates pSEO par type (combinatoire automatique : outil × secteur, métier × tâche, etc.) + slug auto kebab-case avec collision auto-résolue + canonical URL strict + auto-déduplication anti-doorway HCU 2024 (≥40% unique exigé Google)                                                                                                                                                               | Test : 50 entrées générées sur même template, toutes canonicalisées sans cluster cannibale Search Console |
| **KB-19**       | RGPD review + retention purge + backup/DR KB-specific + DR drill          | 3 dj   | KB-11        | Cron `knowledge-retention-purge.ts` + `scripts/backup-knowledge.sh` + `scripts/restore-knowledge-test.sh` + tests DR                                                                                                                                                                                                                                                                                     | DR drill réussi sur staging                                                                               |
| **KB-20**       | Tests E2E complets + Lighthouse CI gate + Sentry events + Plausible goals | 4 dj   | KB-1→KB-19   | Suite E2E complète + LHCI sur 6 routes pivot + Sentry custom events + Plausible goals                                                                                                                                                                                                                                                                                                                    | CI verte, LHCI ≥ budget                                                                                   |

**🚦 BORNE V1 — Production ready** : 81 dj cumulés. Le système peut être lancé en prod publique avec confiance.

### 13.8 Phase 6 — V1.5 (IA)

| Sprint                   | Titre                                                                                  | Effort | Pré-requis                             | Livrables                                                                                                                                                                                 | Gate                                            |
| ------------------------ | -------------------------------------------------------------------------------------- | ------ | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **KB-21** ⚙️ V4 promu V1 | RAG endpoint chatbot + auto-suggestions admin + auto-tagging                           | 5 dj   | KB-13 vert (pgvector déjà installé V1) | `/api/internal/kb/rag` (HMAC, hybrid retrieval RRF, top-K=10, reranking optionnel, latence p95 < 800 ms) + auto-tag avec threshold + suggestions « entrées similaires » dans admin viewer | Bench RAG sur 1k entrées factory simulées       |
| **KB-22**                | Auto-amélioration continue : A/B variants + recyclage low-performers + content scoring | 5 dj   | KB-21, V1 prod ≥ 4 semaines            | Variants par entrée (title alternatif, hero alternatif) + tracking Plausible CTR/scroll/time-on-page + recyclage auto entrées CTR < seuil + score performance par entrée                  | Dashboard `/connaissances/performance`          |
| **KB-23**                | Auto-traduction FR→EN (activation EN parity) + alt text IA vision                      | 4 dj   | KB-21, V1 EN décidé par Will           | Worker `knowledge-translate-fr-en.ts` (Claude Haiku 4.5 cached) + activation routes `/en/*` + bouton « suggérer alt » + review humaine optionnelle                                        | Test traduction 50 entrées + activation EN gate |
| **KB-24**                | Chatbot public Axion-IA propulsé par RAG KB                                            | 5 dj   | KB-21                                  | UI chatbot frontend + endpoint `/api/public/chat` (rate limit IP) + citations obligatoires + filtre `audience='public'` + log analytics conversations                                     | Tests E2E conversation + filtres sécurité PII   |

**🚦 BORNE V1.5** : 99 dj cumulés.

### 13.9 Phase 7 — V2+ (hors chiffrage)

- Chatbot public alimenté par RAG KB.
- Multi-tenant (client rédige dans son espace).
- Syndication (Substack, LinkedIn carrousel, X thread).
- Paywall / monétisation.
- Vidéo / podcast embarqués.

### 13.10 Stratégie de rollout

1. **Migration data Phase 2** = **stratégie expand-backfill-contract** strict (zero downtime). Jamais de migration destructive en une seule étape.
2. **Routes publiques préservées** dès Phase 2 : zéro 301 sur les anciennes URLs, le SEO est intact.
3. **Feature flag** `KB_BACKEND_UNIFIED` (env var booléen) pour basculer route par route entre lecture legacy et lecture unifiée, permettant rollback chirurgical.
4. **Canary** : déployer le hub `/ressources/` derrière `noindex` 7 jours avant indexation publique (sitemap + IndexNow).
5. **Communication interne** : Will + équipe valident chaque sprint via `SPRINT-N-REPORT.md` avant lancement du suivant.
6. **Communication externe** : aucune annonce publique avant V1 borne. À V1 : article `/blog/`, newsletter, page presse update.

### 13.11 Critères de succès V1 (production-ready)

- [ ] Tous les contenus existants (`Article`, `CaseStudy`, `FAQ`, `HelpArticle`) migrés sans perte.
- [ ] Toutes les URLs publiques pré-existantes répondent 200, mêmes contenus.
- [ ] Hub `/ressources/` indexé Google Search Console + sitemap-index étendu.
- [ ] Admin `/connaissances/` permet CRUD complet + workflow + versionning.
- [ ] Pipeline éditorial fonctionnel (calendrier + assignations + health dashboard).
- [ ] Asset library opérationnelle (upload + sharp + EXIF strip).
- [ ] WCAG 2.2 AA validé sur 6 routes pivot (axe-core + manuel).
- [ ] Tests E2E ≥ 9 scénarios verts.
- [ ] LHCI gate vert sur 6 routes (LCP ≤ 1800, INP ≤ 100, CLS = 0).
- [ ] DR drill réussi (restore KB-only).
- [ ] PII scan bloquant publication intégré.
- [ ] Coût mensuel additionnel = 0 €.

---

## 14. RISQUES & MITIGATIONS — TOP 12

| #   | Risque                                                                                                    | Probabilité | Impact                   | Mitigation                                                                                                                                                                    |
| --- | --------------------------------------------------------------------------------------------------------- | ----------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Migration `Article` → `KnowledgeEntry` perd des données ou des relations                                  | Moyenne     | Critique (SEO + contenu) | Stratégie expand-backfill-contract strict. Backfill via script avec `--dry-run`. Test sur copie prod DB avant prod. Feature flag pour rollback.                               |
| 2   | URLs publiques cassées (301 manqué ou contenu vide)                                                       | Moyenne     | Critique (SEO)           | Test E2E `slug-redirect-301.spec.ts` couvrant chaque ancienne URL. Audit Search Console post-migration.                                                                       |
| 3   | Tiptap JSON XSS via rendu SSR non sanitisé                                                                | Faible      | Critique (sécu)          | Whitelist stricte nodes/marks + lib `@tiptap/html` server + tests d'injection systématiques.                                                                                  |
| 4   | pgvector trop lourd pour CPX32 (RAM IOPS)                                                                 | Moyenne     | Sévère                   | Phase V1.5 séparée, bench mémoire avant rollout, fallback FTS-only si KO.                                                                                                     |
| 5   | Éditeur Tiptap perd du contenu (autosave race)                                                            | Moyenne     | Sévère (UX)              | Autosave avec lock + version conflicting + rollback in-place + tests intégration.                                                                                             |
| 6   | Permissions RBAC mal configurées → fuite contenu `secret`                                                 | Faible      | Critique (RGPD)          | Tests permissions exhaustifs, audit log de toute lecture `confidentiality=secret`, default deny.                                                                              |
| 7   | Quality score bloque publications légitimes (faux positifs)                                               | Moyenne     | Modéré (DX)              | Seuils paramétrables par type (SSOT), override admin avec justification, monitoring taux blocage.                                                                             |
| 8   | Imports Notion ratent silencieusement (rate limit, schema drift)                                          | Moyenne     | Modéré                   | Wizard avec preview + dry-run + log batch + rollback transactionnel.                                                                                                          |
| 9   | PDF worker sature CPX32 (puppeteer RAM)                                                                   | Moyenne     | Sévère                   | Décision Phase A `@react-pdf` (léger) vs `puppeteer` (lourd) avec bench. Queue concurrency = 1.                                                                               |
| 10  | Embeddings exfiltrent `confidentiality=secret` à tiers                                                    | Faible      | Critique (RGPD)          | Filtre dans `embeddings.ts` : refus dur si `confidentiality IN ('confidential', 'secret')`. Test bloquant.                                                                    |
| 11  | Search FTS lent (> 500 ms p95) sur volume 10k+ entrées                                                    | Moyenne     | Sévère (UX)              | Index GIN, `tsvector` matérialisé via trigger, `LIMIT` strict, cache court ISR.                                                                                               |
| 12  | Conflit admin existant `/blog`, `/help`, etc. avec nouveau `/connaissances` (deux sources, double vérité) | Élevée      | Modéré                   | Marquer legacy admin dès Phase A, migration progressive en V1.5, mais conserver les deux jusqu'à validation Will. Test cross-cohérence (lectures legacy = lectures unifiées). |

---

## 17. KNOWLEDGE FACTORY INDUSTRIELLE (V4 — architecture 100% automatique)

> **Pivot V4 du 2026-05-14** : Will confirme cible **100 entrées/jour publiées automatiquement** (~36 500/an), FR uniquement V1, écosystème IA en entreprise au-delà du cabinet, production assistée IA via `_AUDIT/PROMPT-CONTENT-GENERATOR-MASTER-2026.md`. **Zéro review humain V1** (workflow auto). Cette section override les sections §0-§16 sur les points spécifiquement V4.

### 17.1 Architecture d'ingestion automatique

```
┌──────────────────────────────────────────────────────────────────────────┐
│  CONTENT GENERATOR MASTER (axionia/_AUDIT/PROMPT-CONTENT-GENERATOR-...)  │
│  - Sources : GPT-4 / Claude / Perplexity / Unsplash / templates pSEO     │
│  - Output : Tiptap JSON + metadata + cover suggestion + tags             │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │ POST /api/internal/kb/ingest
                               │ HMAC-SHA256 signature + Zod stricte
                               │ idempotency-key obligatoire
                               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  QUEUE BullMQ `knowledge-ingest` (concurrency 4, retry 3, dead-letter)   │
│  → Worker `knowledge-ingest-process.ts`                                  │
└──────────────────────────────┬───────────────────────────────────────────┘
                               ▼
                   ┌───────────┴───────────┐
                   │  GATES AUTOMATIQUES   │
                   │  (séquentiel, fail    │
                   │   = audience='team'   │
                   │   + Telegram alerte)  │
                   └───────────┬───────────┘
                               │
   ┌───────────────────────────┼───────────────────────────┐
   ▼                           ▼                           ▼
┌────────────┐         ┌──────────────┐          ┌────────────────┐
│ PII SCAN   │         │ DEDUP        │          │ QUALITY SCORE  │
│ pii-       │         │ pgvector     │          │ heuristiques + │
│ redaction  │         │ cosine ≥ 0.92│          │ LLM scoring    │
│ bloquant   │         │ → bloquant   │          │ → seuil /100   │
└─────┬──────┘         └──────┬───────┘          └───────┬────────┘
      │                       │                          │
      └───────────────────────┼──────────────────────────┘
                              ▼
                   ┌──────────────────────┐
                   │ AUTO-SEO/AEO/GEO     │
                   │ - meta title LLM     │
                   │ - meta desc LLM      │
                   │ - JSON-LD par type   │
                   │ - opengraph image    │
                   │ - AEO bloc 50-80 mots│
                   │ - GEO entités tags   │
                   │ - hreflang structure │
                   └──────────┬───────────┘
                              ▼
                   ┌──────────────────────┐
                   │ AUTO-PUBLISH         │
                   │ status='published'   │
                   │ + revalidatePath     │
                   │ + sitemap update     │
                   │ + IndexNow ping      │
                   │ + RSS regen          │
                   │ + llms.txt regen     │
                   │ + newsletter queue   │
                   └──────────┬───────────┘
                              ▼
                   ┌──────────────────────┐
                   │ AUDIT LOG IMMUABLE   │
                   │ source.factoryId     │
                   │ source.promptId      │
                   │ source.modelUsed     │
                   │ source.cost          │
                   └──────────────────────┘
```

### 17.2 API d'ingestion `/api/internal/kb/ingest`

**Endpoint** : `POST /api/internal/kb/ingest`
**Auth** : HMAC-SHA256 header `X-KB-Signature` (secret `KB_INGEST_SECRET` env var)
**Idempotency** : header `X-Idempotency-Key` obligatoire (UUID v4)
**Rate limit** : 200 req/min/factory (Redis bucket), burst 500/min toléré
**Concurrency worker** : 4
**Retry** : 3 tentatives exponential backoff (1s, 4s, 16s) puis dead-letter queue
**Circuit breaker** : 50% erreurs sur 1 min → bascule mode dégradé (queue uniquement, pas de publish)

**Schema Zod input** :

```ts
const IngestBody = z.object({
  type: KbTypeEnum,
  title: z.string().min(10).max(200),
  body: z.unknown(), // Tiptap JSON, validé par schema séparé
  excerpt: z.string().min(40).max(300).optional(),
  tags: z.array(z.string()).min(1).max(10),
  domain: KbDomainEnum,
  audience: KbAudienceEnum.default("public"),
  confidentiality: KbConfidentialityEnum.default("public"),
  source: z.object({
    factoryId: z.string(),
    promptId: z.string(),
    modelUsed: z.string(),
    cost: z.number().nonnegative(),
    generatedAt: z.string().datetime(),
  }),
  coverImage: z.object({ url: z.string().url(), alt: z.string() }).optional(),
  language: z.literal("fr"), // V1 FR uniquement, EN activable V2
});
```

**Réponses** :

- `202 Accepted` : entry queuée, `Location: /api/internal/kb/[id]/status`
- `409 Conflict` : idempotency-key déjà utilisée (renvoie l'`id` existant)
- `422 Unprocessable` : Zod validation failed
- `429 Too Many Requests` : rate limit
- `503 Service Unavailable` : circuit breaker ouvert

### 17.3 Quality gates automatiques (KB-13)

**Heuristiques bloquantes** (rejet immédiat → `audience='team'` + Telegram alerte) :

- Mot « formation » présent dans `title`/`excerpt`/`body`/`metaTitle`/`metaDescription` → REJECT
- Longueur body Tiptap < 300 mots (sauf `faq`, `glossary_term`) → REJECT
- Aucun H2 dans le body → REJECT
- ≥ 5 fautes d'orthographe FR détectées (lib `nodehun` ou équivalent) → REJECT
- Liens externes non-https → REJECT
- Embed YouTube/Vimeo/Loom non whitelistés → REJECT

**LLM scoring** (`quality-gates.ts`) :

- Claude Haiku 4.5 cached, prompt « note de 0 à 100 pour : pertinence sujet, originalité vs corpus, clarté, structure, valeur ajoutée pro »
- Seuil par type (SSOT `quality-thresholds.ts`) : `article` ≥ 70, `automation_recipe` ≥ 60, `comparison` ≥ 65, etc.
- Échec seuil → `audience='team'` (pas publié) + alerte Telegram + log Sentry

**Dedup pgvector** :

- Embedding du `title + excerpt + 500 premiers mots body` (Voyage AI ou équivalent, cached)
- Cosine similarity contre corpus existant publié
- Si ≥ 0.92 sur ≥ 1 entrée existante → REJECT (dedup match) + log + suggestion merge dans audit log
- Si 0.85-0.92 → publié mais flag `dedup_warning` + revue manuelle ultérieure

**PII scan** :

- `pii-redaction.ts` existant en mode bloquant strict
- Si match non whitelisté (email/téléphone/RIB/IBAN/SIREN clients) → REJECT immédiat
- Whitelist : références publiques (URL site, email contact@axion-ia.com, SIREN Axion-IA si activé V2)

### 17.4 Auto-génération SEO/AEO/GEO (KB-14)

- **Meta title** : LLM cached, template par type (ex. `article` : `<title> — Axion-IA`, `case_study` : `<title> : retour d'expérience — Axion-IA`, `comparison` : `<toolA> vs <toolB> : guide 2026 — Axion-IA`). Longueur 50-60 chars.
- **Meta description** : LLM cached, extrait + bénéfice + CTA implicite. Longueur 140-160 chars.
- **JSON-LD** : factory par type (déjà prévue § Agent 6), strict schema.org.
- **Open Graph image** : généré dynamiquement via `opengraph-image.tsx` par type + variant Axion-IA + titre. Pas d'appel image externe (Hetzner CPX32 OK avec sharp).
- **AEO bloc « Réponse directe »** : 50-80 mots auto-extraits ou résumés par LLM, injectés en haut de la page, encadrés `<aside aria-label="Réponse directe">`.
- **GEO entités** : auto-tagger LLM extrait `villes[]` + `secteurs[]` + `metiers[]` + `outils[]`, stockés en colonnes structurées + `areasServed` JSON-LD.
- **hreflang** : structure prête (champ `language='fr'`) mais sitemap EN désactivé V1.
- **Sitemap** : auto-injection dans `sitemap-knowledge.ts` au publish.
- **IndexNow** : ping auto via helper centralisé existant (mémoire `axionia_session_2026-05-13_seo_email_stack`).

### 17.5 Safeguards anti-dérive (CRITIQUES)

À 100/jour automatique, un bug = catastrophe. **Safeguards obligatoires V1** :

1. **Kill switch global** : env var `KB_AUTO_PUBLISH=false` → publications bloquées immédiatement, queue continue à accepter. Activable via Coolify en < 30s.
2. **Volume gate** : si > 150 publications/heure → alerte Telegram + bascule `audience='team'` automatique (publication suspendue).
3. **Quality fail rate gate** : si > 20% des entrées d'1 batch échouent quality → alerte + bascule queue en revue manuelle.
4. **Dedup match rate gate** : si > 30% match dedup → alerte (content factory probablement déraillée).
5. **Disaster recovery massif** : bouton admin `/connaissances/sante` → « dépublier toutes les entrées créées entre T1 et T2 » (KB-17). Action transactionnelle, log immuable.
6. **Audit log immuable** : chaque publication enregistre `source.factoryId`, `source.promptId`, `source.modelUsed`, `source.cost`. Permet remontée à la source en cas de problème.
7. **Sentry events** : `kb.ingest.received`, `kb.ingest.rejected`, `kb.publish.success`, `kb.dedup.match`, `kb.quality.fail`, `kb.pii.blocked`, `kb.volume.anomaly`.
8. **Plausible goals** : `kb_view`, `kb_search`, `kb_helpful`, `kb_chatbot_query` (V1.5).
9. **Rate limit factory** : 200 req/min/factory + circuit breaker.
10. **Snapshot Hetzner quotidien** + DR drill mensuel (KB-19).

### 17.6 Infrastructure & coûts à 100/jour

| Élément                                                   | Calcul                            | Cible 12 mois    | Cible 24 mois   |
| --------------------------------------------------------- | --------------------------------- | ---------------- | --------------- |
| DB body Tiptap                                            | 100/j × 365 × ~100 KB             | ~3.65 GB         | ~7.3 GB         |
| DB versions                                               | × 3 versions moy                  | ~11 GB           | ~22 GB          |
| DB embeddings pgvector                                    | 1536 dim × 36500 × 4 bytes        | ~225 MB          | ~450 MB         |
| Assets sharp variantes                                    | ~36500 × 200 KB moy × 4 variantes | ~30 GB           | ~60 GB          |
| Postgres total                                            | + index + FTS                     | **~50-60 GB**    | **~100-130 GB** |
| **CPX32 disk** (80 GB nominal)                            |                                   | **~75% saturé**  | **🔴 SATURÉ**   |
| **CPX32 RAM** (8 GB)                                      | + pgvector + Redis + Next + Caddy | **~85% utilisé** | **🔴 SATURÉ**   |
| **Coût Anthropic embeddings** (Voyage AI ~$0.12/M tokens) | 36500 × 1500 tokens × $0.12       | **~$7/mois**     | ~$14/mois       |
| **Coût Anthropic quality scoring** (Haiku 4.5 cached)     | 36500 × 800 tokens × $0.25/M      | **~$8/mois**     | ~$15/mois       |
| **Coût Anthropic auto-SEO** (Haiku cached)                | 36500 × 500 tokens × $0.25/M      | **~$5/mois**     | ~$9/mois        |
| **Coût Anthropic GEO entities**                           | 36500 × 300 tokens × $0.25/M      | **~$3/mois**     | ~$5/mois        |

**TOTAL coût IA V1 ≈ $25/mois (~€25)**. Bien sous le budget Will explicite (~€5-30/mois).

**Recommandation upgrade VPS** :

- À 12 mois : **CPX42** (€11/mois, 16 GB RAM, 160 GB disk) → marge confortable.
- À 24 mois : **CPX52** (€19/mois, 32 GB RAM, 240 GB disk) ou storage box Hetzner dédié pour assets.
- À envisager dès V1 si volume réel dépasse projection.

### 17.7 Intégration Content Generator Master

Le prompt `_AUDIT/PROMPT-CONTENT-GENERATOR-MASTER-2026.md` (mémoire `axionia_prompt_content_generator_master`) est **la source amont** de la factory KB. La KB ne génère pas le contenu — elle le reçoit, le valide, le publie.

**Interface contractuelle** :

- Content Generator produit du Tiptap JSON conforme au schema Zod KB.
- Content Generator appelle `POST /api/internal/kb/ingest` avec HMAC signature + idempotency-key.
- KB renvoie 202 + `Location` header avec lien vers status.
- Content Generator peut poll status ou attendre webhook `kb.publish.success` (V1.5).
- Erreurs de validation → renvoyées en 422 avec détails Zod, Content Generator doit corriger et retenter avec nouvelle idempotency-key.

**SLA** : ingest → publié en < 30 minutes en condition normale, alerte si > 2h.

### 17.8 Effort V4 révisé

| Phase           | Sprints       | Effort V3 | Effort V4  | Delta                                   |
| --------------- | ------------- | --------- | ---------- | --------------------------------------- |
| Fondations      | KB-1 → KB-4   | 16 dj     | 16 dj      | 0                                       |
| Migration data  | KB-5 → KB-6   | 10 dj     | 10 dj      | 0                                       |
| Surfaces        | KB-7 → KB-10  | 14 dj     | 14 dj      | 0                                       |
| Enrichissement  | KB-11 → KB-16 | 22 dj     | **25 dj**  | +3 dj (pgvector promu V1 KB-12.5)       |
| Polish + prod   | KB-17 → KB-20 | 14 dj     | 14 dj      | 0 (sprints refondus, effort équivalent) |
| **🚦 BORNE V1** |               | **81 dj** | **~84 dj** | +3 dj                                   |
| V1.5 IA         | KB-21 → KB-24 | 18 dj     | 19 dj      | +1 dj (chatbot promu)                   |

**Quasi iso-effort.** Le pivot V4 ne rallonge pas — il **réoriente** les sprints.

---

## 18. DÉCISIONS V4 ACTÉES (2026-05-14)

| #   | Décision                                                                                                                         | Source                             | Statut                            |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | --------------------------------- |
| 1   | Volume cible 100 entrées/jour publiées automatiquement (~36 500/an)                                                              | Will 2026-05-14                    | ✅ Acté                           |
| 2   | Production 100% automatique via Content Generator Master, zéro review humain V1                                                  | Will 2026-05-14                    | ✅ Acté                           |
| 3   | FR uniquement V1, architecture multilingue préservée, EN activable V2 (KB-23)                                                    | Will 2026-05-14                    | ✅ Acté                           |
| 4   | Scope élargi écosystème IA en entreprise (12 nouveaux types V4)                                                                  | Will 2026-05-14                    | ✅ Acté                           |
| 5   | pgvector basculé V1.5 → **V1 obligatoire** (dedup à 100/jour)                                                                    | Implication 2026-05-14             | ✅ Acté                           |
| 6   | Pipeline éditorial humain (KB-13/17/18 V3) refondu en **gates automatiques + monitoring + dedup + SEO auto + ingestion API**     | Implication 2026-05-14             | ✅ Acté                           |
| 7   | Mot « formation » BANNI partout (doctrine `axionia-core` rappelée), `intervention_module` + `competence_boost` couvrent le sujet | Doctrine `axionia-core` 2026-05-06 | ✅ Tenu V4                        |
| 8   | Safeguards anti-dérive obligatoires V1 (kill switch + 4 gates volume/quality/dedup + DR massif + audit log immuable)             | Implication 2026-05-14             | ✅ Acté                           |
| 9   | Upgrade VPS CPX42 prévu à 12 mois (effort/coût chiffré §17.6)                                                                    | Implication 2026-05-14             | ⚠️ À valider mois 9               |
| 10  | Coût IA mensuel V1 ≈ €25/mois (embeddings + quality + auto-SEO + GEO)                                                            | Calcul §17.6                       | ✅ Sous budget Will (~€5-30/mois) |
| 11  | Chatbot public Axion-IA promu en V1.5 KB-24 (RAG ready dès V1)                                                                   | Implication 2026-05-14             | ✅ Acté                           |
| 12  | Effort total V1 révisé : 81 dj → **~84 dj** (+3 dj pgvector promu V1)                                                            | Calcul §17.8                       | ✅ Quasi iso-effort               |

---

## 15. ANNEXES — LECTURES OBLIGATOIRES AVANT DÉMARRAGE

L'agent qui lance ce prompt **doit avoir lu** (au minimum les sections pertinentes) :

- `axionia/AGENTS.md` (doctrine Web Vitals + Next.js 16 patché)
- `axionia/Design.md` (doctrine éditoriale + typography v3.2 + hero schemas)
- `axionia/CLAUDE.md` (ce qui pointe vers `AGENTS.md`)
- `axionia/prisma/schema.prisma` (modèles réels : `Article`, `ArticleTranslation`, `ArticleTag`, `ArticleTagOnArticle`, `CaseStudy`, `CaseStudyTranslation`, `FAQ`, `HelpArticle`, `HelpArticleTranslation`, `Category`)
- `axionia/src/content/pricing.ts`, `axionia/src/content/interventions-taxonomy.ts` (pattern SSOT)
- `axionia/src/lib/pii-redaction.ts` (helper RGPD)
- `axionia/src/app/[locale]/(admin)/[adminPrefix]/blog/` (pattern admin Tiptap existant)
- `axionia/src/app/[locale]/(admin)/[adminPrefix]/case-studies/` (pattern admin Tiptap existant)
- `axionia/src/app/[locale]/(admin)/[adminPrefix]/faq/` (pattern admin existant)
- `_AUDIT/PROMPT-FRONTEND-AUDIT-V14-2026.md` (doctrine doctrine-agnostic + HEAD reference)
- `_AUDIT/PROMPT-DOC-SYNC-V14.md` (sync `Design.md`/`AGENTS.md` après ajout SSOT)
- `_AUDIT/PROMPT-SEO-MASTER-2026.md` (chapitres SEO/AEO/GEO 2026)
- `_AUDIT/PROMPT-WEB-VITALS-PERFECTION-2026.md` (budgets perf)
- `_AUDIT/CHANGELOG-V1-BOOKING.md` (pattern de delivery incrémental sprint-par-sprint)

Memo mémoire utile (auto-memory, `~/.claude/projects/.../memory/`) :

- `axionia_doctrine_code_ssot.md`
- `axionia_pricing_zero_hardcode_2026-05-08.md`
- `axionia_interventions_taxonomy_refonte_2026-05-11.md`
- `axionia_prompt_doc_sync.md`
- `axionia_naming_brand_vs_project.md`
- `axionia_hosting_hetzner.md`
- `axionia_session_2026-05-13_seo_email_stack.md` (helper IndexNow centralisé, Clarity component)

---

## 16. SORTIE ATTENDUE — RÉCAPITULATIF TL;DR (à Will, en fin de Phase A)

À la fin de Phase A, ton dernier message à Will doit contenir :

1. **Verdict** : GO / CONDITIONAL GO / NO-GO.
2. **Score** : `XXX/300`.
3. **Liste des 22 fichiers** produits sous `_AUDIT/KNOWLEDGE-BASE-2026/` (chemins cliquables).
4. **Top 5 décisions ouvertes** (numérotées, attendant un mot Will).
5. **Prochaine action recommandée** : `GO BUILD KB-SPRINT-1` (ou pré-requis à débloquer).
6. **Effort total V1** chiffré en demi-journées (somme des sprints KB-1 à KB-20).
7. **Effort V1.5** chiffré séparé (KB-21 à KB-24).
8. **Coût mensuel chiffré** : V1 = €0 additionnel (CPX32 absorbe), V1.5 embeddings = fourchette.
9. **Estimation taille DB** à 1k / 10k / 100k entrées.
10. **Aucune** invitation à lancer Phase B sans GO explicite.

---

**Fin du prompt.** Ce fichier est **lecture seule** côté agent : tu ne le modifies pas pendant son exécution. Si tu as une suggestion d'amélioration, tu la notes dans `SYNTHESIS.md` section « Améliorations du prompt pour V2 ».
