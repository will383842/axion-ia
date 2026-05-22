# A17 — Conformité AI Act art. 50 + RGPD + DPA Providers
## Audit forensique — Phase 1 Content-Gen Perfection 2026

**Date** : 2026-05-21  
**HEAD audité** : `2b98a7067d7eae701dec42a2c5d6e859364e0e64`  
**Auditeur** : Agent A17 (sous-agent autopilote)  
**Mode** : AUDIT-ONLY STRICT — citations fichier:ligne, 0 invention  
**Deadline critique** : AI Act art. 50 applicable **2026-08-02** (73 jours)

---

## 1. Mission

Auditer la conformité du système content-gen aux obligations légales : AI Act art. 50 (transparence contenu IA), RGPD art. 17 (droit à l'oubli), DPA signés avec providers IA, audit logs immuables.

---

## 2. Méthode

Recherches Grep exhaustives sur :
- `prisma/schema.prisma` — modèles de données
- `src/lib/seo.ts` et `src/lib/seo-content-gen-factories.ts` — JSON-LD factories
- `src/app/[locale]/blog/[slug]/page.tsx`, `actualites/[slug]`, `centre-aide/[slug]`, `guides/[slug]`, `cas-concrets/[slug]`, `methodologie/`
- `src/components/marketing/AiContentDisclaimer.tsx`
- `src/server/queue/workers/retention-purge-worker.ts`
- `src/app/api/gdpr-erase/route.ts`
- `src/content/legal.ts`
- `_AUDIT/DPA-REGISTER.md`
- `docs/runbooks/R28-dpa-renewal.md`, `R29-rgpd-subprocessor-audit.md`

---

## 3. État observé

### 3.1 JSON-LD `aiGenerated: true` — ÉTAT PAR ROUTE

| Route | Factory utilisée | `aiGenerated` émis | Source |
|---|---|---|---|
| `/actualites/[slug]` | `buildNewsArticleJsonLd` — `seo-content-gen-factories.ts` | **OUI** | `actualites/[slug]/page.tsx:35,210` |
| `/centre-aide/[slug]` | `buildArticleJsonLd` — `seo-content-gen-factories.ts` | **OUI** | `centre-aide/[slug]/page.tsx:22,88` |
| `/guides/[slug]` | `buildArticleJsonLd` — `seo-content-gen-factories.ts` | **OUI** | `guides/[slug]/page.tsx:29,86` |
| `/blog/[slug]` | `buildArticleJsonLd` — **`src/lib/seo.ts`** | **NON** | `blog/[slug]/page.tsx:18,216` |
| `/cas-concrets/[slug]` | `buildArticleJsonLd` — **`src/lib/seo.ts`** | **NON** | `cas-concrets/[slug]/page.tsx:17,77` |
| `/methodologie` | `buildArticleJsonLd` — **`src/lib/seo.ts`** | **NON** | `methodologie/page.tsx:15,50` |

**Constat critique** : La factory `seo.ts:buildArticleJsonLd` (L604-685) n'émet **ni `aiGenerated: true`**, **ni `additionalType: "https://schema.org/AIGeneratedContent"`**. La factory `seo-content-gen-factories.ts:buildArticleBase` (L163-170) les émet correctement. Les routes `/blog/[slug]` et `/cas-concrets/[slug]` utilisent la mauvaise factory.

### 3.2 Format `additionalType: "https://schema.org/AIGeneratedContent"`

Présent dans `seo-content-gen-factories.ts:77` et `seo-content-gen-factories.ts:170`. Absent de `seo.ts:buildArticleJsonLd`. Même gap que 3.1.

### 3.3 `AiContentDisclaimer` — mention humaine visible

Composant `src/components/marketing/AiContentDisclaimer.tsx` :
- Wording exact : *"Cet article a été rédigé avec l'assistance de modèles d'IA générative (OpenAI GPT-4o, Anthropic Claude, Perplexity Sonar) puis supervisé par l'équipe Axion-IA avant publication. Conformément à l'article 50 du Règlement européen sur l'IA (AI Act 2024/1689)."* (L37-38)
- Lien vers `/transparence` présent (L66-72)
- Positionnement : **bas d'article** (`my-8` = 2rem haut/bas), après le body, avant CtaBlock — **PAS above the fold**

Routes couvertes (`AiContentDisclaimer` importé et rendu) :
- `/blog/[slug]` : OUI — `blog/[slug]/page.tsx:13,354`
- `/actualites/[slug]` : OUI — `actualites/[slug]/page.tsx:30,336`
- `/centre-aide/[slug]` : OUI — `centre-aide/[slug]/page.tsx:13,199`
- `/guides/[slug]` : OUI — `guides/[slug]/page.tsx:25,156`
- `/glossaire/[slug]` : OUI — `glossaire/[slug]/page.tsx:36,331`

Routes non couvertes par `AiContentDisclaimer` :
- `/cas-concrets/[slug]` : **NON** — aucun import dans la page, bien que la factory `seo.ts` soit utilisée
- `/methodologie` : **NON** — non confirmé par les imports

La page presse exclut explicitement le disclaimer : `presse/[slug]/page.tsx:24` — justification documentée ("communiqués humains").

### 3.4 Modèle `GenerationProvenance` en schema Prisma

**ABSENT** de `prisma/schema.prisma`. Ce modèle n'existe pas.

Existant à la place :
- `GenerationLog` (L2945-2957) : fields `id, jobId, level, step, message, metadata, timestamp`. Pas de `provider`, `model`, `promptHash`, `inputTokens`, `outputTokens`, `cost`, `regulationVersion`. C'est un log d'étape pipeline, pas un log de provenance IA réglementaire.
- `ContentGenJob` (L2856-2941) : contient `primaryProvider`, `modelUsed`, `tokensInput`, `tokensOutput`, `costUsd` mais pas de `promptHash` ni `regulationVersion`.
- `KnowledgeAuditLog` (L2381-2401) : log KB immuable hash-chaîné, mais pas lié aux articles publiés.
- `ContentGenAuditLog` (L2643-2670) : log settings admin append-only, pas de provenance article.

**Conclusion** : Il n'existe pas de table `GenerationProvenance` ni de champ `promptHash`/`regulationVersion`. La provenance est fragmentée entre `ContentGenJob` (cost + tokens) et `GenerationLog` (logs étape). Retention : `generationLogs` purgés à 12 mois par défaut (`retention-purge-worker.ts:166-169`). **AI Act recommande 6 ans minimum pour audit trail réglementaire.**

### 3.5 Immutabilité audit logs

- `KnowledgeAuditLog` : hash-chaîné SHA-256 (prevHash + selfHash, L2392-2394), documenté "append-only" (L2378-2380). Pas d'UPDATE/DELETE exposés. **Conforme.**
- `ContentGenAuditLog` : append-only documenté (L2636-2640), pas d'UPDATE/DELETE exposés. **Conforme.**
- `GenerationLog` : `onDelete: Cascade` (L2948) — **se supprime si le ContentGenJob parent est supprimé**. Non immuable.
- `ActivityLog` : commenté "immuable, art. 30 RGPD register" dans `gdpr-erase/route.ts:23`. **Conforme.**

### 3.6 DPA Providers IA

Source : `_AUDIT/DPA-REGISTER.md`

| Provider | Statut | Date signature |
|---|---|---|
| Anthropic PBC | 🟡 **À SIGNER** | _(à compléter)_ |
| OpenAI, LLC | 🟡 **À SIGNER** | _(à compléter)_ |
| Perplexity AI | 🟡 **À SIGNER** | _(à compléter)_ |
| Unsplash Inc. | 🟡 **À SIGNER** | _(à compléter)_ |
| Voyage AI | 🟡 **À SIGNER** | _(à compléter)_ |
| Hetzner | 🟡 **À SIGNER** | _(à compléter)_ |
| Cloudflare | 🟡 **À ACCEPTER** | _(à compléter)_ (online accepté 2026-05-09 selon R28 ?) |
| Zoho | ✅ | 2026-05-13 |

**Constat** : Les 3 providers IA actifs en content-gen (Anthropic, OpenAI, Perplexity) ont leurs DPA documentés dans le registre mais **aucun n'est signé** à la date d'audit. Les cases `Date signature` dans le DPA-REGISTER sont toutes `_(à compléter)_`. Les clés API (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `PERPLEXITY_API_KEY`) sont documentées comme "à ne pas activer avant DPA signé" mais leur statut Coolify actuel est **UNKNOWN** (non vérifiable en audit statique).

Le CHANGELOG `2026-05-15 Will signe 5+3 DPA` (Hetzner papier, CF online, OpenAI ZDR, Anthropic, Perplexity, Unsplash, Voyage, Stripe) est référencé dans `axionia/CHANGELOG.md:158` mais **le DPA-REGISTER ne reflète pas ces signatures** (toutes les dates restent `_(à compléter)_`). Contradiction entre CHANGELOG et registre officiel : le DPA-REGISTER est la source de vérité réglementaire.

### 3.7 RGPD art. 17 — Droit à l'oubli

**Endpoint self-service** : `src/app/api/gdpr-erase/route.ts` — `POST /api/gdpr-erase`
- Token HMAC + anti-replay rate limit 1/jour (L57-65)
- Efface : submissions (anonymisation in-place), newsletter (hard delete), KB bookmarks (hard delete)
- ActivityLog forensique créé (L78-92)
- Alerte Telegram DPO (L96-102)

**Périmètre de l'effacement** — tables **NON touchées** (legal hold documenté L21-23) :
- `generation_logs` / `cost_ledger` / `web_vital_samples` / `content_gen_jobs` — justifié "logs techniques sans PII visiteur"
- Pas d'embeddings suppression (Voyage AI — stub en V1, pas de données réelles)
- Pas de suppression sitemap / IndexNow remove — **lacune non documentée**

**Contenu articles IA publiés** : si un article contient un cas client nommé, aucun mécanisme de suppression du contenu de l'article lui-même n'est présent dans l'endpoint RGPD. **Lacune P1** si cas clients nommés existent.

**Purge automatique** : `retention-purge-worker.ts` — cron 03h00 UTC purge :
- `activityLog` : 12 mois
- `generationLogs` : 12 mois
- `costLedger` : 24 mois (obligation comptable)
- `webVitalSamples` : 6 mois

### 3.8 Page mentions légales — mention IA générative

- `/mentions-legales` (`legal.ts:33-68`) : **AUCUNE mention IA générative** dans les sections définies (Éditeur, Directeur de publication, Hébergeur, Propriété intellectuelle, Loi applicable). La mention IA est dans `/politique-confidentialite` uniquement.
- SIREN : `[SIREN à compléter]` — **placeholder non rempli** (L44, L77). Problème légal indépendant.
- `/politique-confidentialite` : section "IA générative et transparence (AI Act EU)" présente (L233-235), complète, bien rédigée.
- `/transparence` : page dédiée, CNIL mentionnée, droits RGPD art. 21 listés.

### 3.9 Person JSON-LD — exposition email

`buildPersonManonJsonLd` (`seo-content-gen-factories.ts:31-83`) : n'émet **aucun email**. Doctrine v2.1 zéro réseau social, zéro `sameAs`. **Conforme.**

### 3.10 CNIL déclaration

Axion-IA OÜ est une société estonienne. La CNIL est l'autorité de contrôle déclarée dans la politique de confidentialité (`legal.ts:202`, `transparence/page.tsx:116`). L'autorité compétente réelle est l'AKI (Estonie) en tant que DPA du siège de l'OÜ. Cependant, comme la cible commerciale est FR et que le traitement de données de résidents FR est effectué depuis le site, la CNIL peut également exercer sa compétence (guichet unique RGPD). **Risque mineur** : déclarer exclusivement la CNIL alors que l'AKI est l'autorité principale.

---

## 4. Findings

### Tableau P0/P1/P2

| # | Priorité | Fichier:ligne | Constat | Impact | Action |
|---|---|---|---|---|---|
| F-01 | **P0 BLOQUANT** | `src/app/[locale]/blog/[slug]/page.tsx:18,216` | `/blog/[slug]` utilise `buildArticleJsonLd` de `src/lib/seo.ts` qui n'émet PAS `aiGenerated:true` ni `additionalType: AIGeneratedContent` | AI Act art. 50 non conforme sur la route principale du blog | Migrer vers `buildBlogPostingJsonLd` de `seo-content-gen-factories.ts` |
| F-02 | **P0 BLOQUANT** | `src/app/[locale]/cas-concrets/[slug]/page.tsx:17,77` | `/cas-concrets/[slug]` même problème — factory `seo.ts`, pas `seo-content-gen-factories.ts` | AI Act art. 50 non conforme + pas de `AiContentDisclaimer` | Migrer factory + ajouter `AiContentDisclaimer` |
| F-03 | **P0 BLOQUANT** | `_AUDIT/DPA-REGISTER.md` lignes 24-26 | DPA Anthropic, OpenAI, Perplexity tous `🟡 À SIGNER` — aucune date de signature renseignée dans le registre officiel | Si les clés API sont actives en prod = traitement sans DPA RGPD art. 28 = amende CNIL/AKI | Will doit vérifier statut Coolify des clés et confirmer ou signer DPA avant activation |
| F-04 | **P0 BLOQUANT** | `prisma/schema.prisma` — absent | Modèle `GenerationProvenance` absent. Champs `promptHash`, `regulationVersion`, `inputTokens per article`, `outputTokens per article` non traçables de façon structurée par article publié | Traçabilité réglementaire AI Act fragmentée ; audit régulateur impossible par article | Créer table `GenerationProvenance` liée à `Article` (ou enrichir `ContentGenJob` + Article FK) |
| F-05 | **P0 CRITIQUE** | `src/server/queue/workers/retention-purge-worker.ts:166-169` | `GenerationLog` purgé à 12 mois. AI Act art. 50 + recommendations EDPB = conservation minimale 6 ans pour l'audit trail de contenu IA | Si régulateur demande l'historique de génération d'un article >1 an : IMPOSSIBLE | Augmenter `RETENTION_GENERATION_LOGS_MONTHS` à 72 (6 ans) OU migrer vers `GenerationProvenance` legal-hold sans purge |
| F-06 | P1 | `src/app/[locale]/blog/[slug]/page.tsx` | `AiContentDisclaimer` est rendu en bas d'article — pas above the fold. AI Act art. 50 §4 exige divulgation "claire et reconnaissable" à la "première interaction" | Risque interprétation stricte : le bandeau bas de page ne satisfait pas "first interaction" | Envisager mention condensée en haut d'article + bandeau complet en bas |
| F-07 | P1 | `_AUDIT/DPA-REGISTER.md:158 vs CHANGELOG.md:158` | CHANGELOG mentionne "Will signe 5+3 DPA" le 2026-05-15 mais DPA-REGISTER toutes dates = `_(à compléter)_`. Incohérence registre officiel | En cas d'audit CNIL/AKI, le registre art. 30 est la pièce juridique — les dates manquantes = non-conformité documentaire | Mettre à jour le DPA-REGISTER avec les dates réelles et références de confirmation |
| F-08 | P1 | `src/app/[locale]/mentions-legales` (`legal.ts:33-68`) | Mentions légales n'incluent pas la mention "contenus IA générés" — seulement dans politique-confidentialite | L'art. 50 AI Act requiert que l'information soit accessible. Les mentions légales sont le point d'entrée légal standard | Ajouter section courte "IA générative" dans les mentions légales |
| F-09 | P1 | `src/app/api/gdpr-erase/route.ts:21-23` | Endpoint RGPD art. 17 ne supprime pas : embeddings (stub V1 — OK), sitemap references, IndexNow remove. Si un article cité un cas client nominatif, le contenu de l'article n'est pas purgé | Droit à l'oubli incomplet pour contenu éditorial | Documenter le scope + process manuel de dépublication article si demande nominative |
| F-10 | P1 | `prisma/schema.prisma:2948` | `GenerationLog` a `onDelete: Cascade` — se supprime si `ContentGenJob` supprimé | Perte audit trail si job administrateur supprimé | Changer en `onDelete: Restrict` ou `SetNull` + conserver log |
| F-11 | P1 | `src/app/[locale]/methodologie/page.tsx:15,50` | `/methodologie` utilise `buildArticleJsonLd` de `seo.ts` sans `aiGenerated` | Cohérence AI Act si page éditoriale IA-assistée | Vérifier si page est IA-assistée ; si oui, migrer factory |
| F-12 | P2 | `src/content/legal.ts:44,77` | SIREN `[SIREN à compléter]`, forme juridique `[à préciser]` dans mentions légales | Obligations légales FR (art. 6 LCEN) non satisfaites | Will complète les informations légales |
| F-13 | P2 | `src/content/legal.ts:202` | CNIL déclarée comme autorité compétente principale, mais siège OÜ = Estonie (AKI compétent art. 55 RGPD) | Risque si plainte déposée auprès d'une des deux autorités | Mentionner "CNIL (France) et AKI (Estonie)" |
| F-14 | P2 | `_AUDIT/DPA-REGISTER.md` ligne 15 | Microsoft Clarity `🟡 à signer` — analytics qualitatifs UX avec consentement | Secondaire (Clarity gaté consent CMP) | Will signe DPA Microsoft |

---

## 5. Criticité absolue — Section spéciale

### Situation au 2026-05-21 (73 jours avant deadline)

```
DEADLINE AI Act art. 50 = 2026-08-02
JOURS RESTANTS = 73
AMENDES ENCOURUES = jusqu'à 7,5M€ ou 1,5% CA mondial
```

### Points verts (respectés)
- `/actualites`, `/centre-aide`, `/guides`, `/glossaire` : `aiGenerated:true` + `additionalType` + `AiContentDisclaimer` = **CONFORMES**
- `AiContentDisclaimer.tsx` wording : explicite, complet, conforme AI Act art. 50
- `/transparence` page : sous-processeurs IA listés, droits RGPD art. 21 documentés
- `/politique-confidentialite` : section IA générative présente et complète
- Endpoint RGPD art. 17 `/api/gdpr-erase` : opérationnel avec audit trail
- `KnowledgeAuditLog` : append-only, hash-chaîné SHA-256
- `retention-purge-worker` : purges automatiques opérationnelles
- `buildPersonManonJsonLd` : pas d'email exposé

### Points rouges (non conformes avant deadline)

**F-01 + F-02 : GAP JSON-LD sur `/blog` et `/cas-concrets`**
- Ces 2 routes utilisent `src/lib/seo.ts:buildArticleJsonLd` qui n'émet pas `aiGenerated:true`
- **Estimation articles concernés** : tous les articles blog publiés via content-gen
- Correctif : 30 min de code (changer import + adapter interface)

**F-03 : DPA providers IA — statut incertain**
- Si `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `PERPLEXITY_API_KEY` sont actifs en Coolify prod sans DPA signé = **violation RGPD art. 28 immédiate**
- Le CHANGELOG suggère signature en mai 2026 mais le registre n'est pas mis à jour

**F-04 + F-05 : Absence `GenerationProvenance` + retention 12 mois**
- Table de provenance structurée absente : ne permet pas l'audit art. 50 par article
- Logs purgés à 12 mois : insuffisant pour obligation 6 ans

---

## 6. Scoring /45

| Critère | Points max | Score | Justification |
|---|---|---|---|
| JSON-LD `aiGenerated:true` partout | /10 | **5/10** | OK sur 4/6 types de routes (actualites, centre-aide, guides, glossaire). NON sur blog et cas-concrets (routes à plus fort volume). Moitié du stock d'articles. |
| Mention humaine wording + visibilité | /8 | **6/8** | Wording excellent (AI Act art. 50 explicitement cité). Couvre blog/actualites/guides/glossaire/centre-aide. Manque: bas d'article seulement (pas above-the-fold strict), cas-concrets absent. |
| GenerationProvenance table + immutabilité | /8 | **2/8** | Table absente. ContentGenJob a cost+tokens mais pas promptHash ni regulationVersion. GenerationLog a onDelete:Cascade (non immuable). KnowledgeAuditLog immuable mais hors scope articles. Retention 12 mois < 6 ans AI Act. |
| DPA providers signés (Anthropic + Perplexity + OpenAI/Voyage) | /8 | **3/8** | Registre documenté avec URLs et procédures détaillées (+3). Mais aucune date de signature officielle dans le registre. Contradictions CHANGELOG vs DPA-REGISTER. Statut Coolify non vérifiable statiquement. |
| RGPD art. 17 droit à l'oubli endpoint | /6 | **4/6** | Endpoint opérationnel avec token HMAC, rate limit, audit trail (+4). Scope limité (pas sitemap remove, pas purge contenu article nominatif, GenerationLog en cascade). |
| Page mentions légales + CNIL | /5 | **2/5** | Politique-confidentialite complète (+2). Mentions légales sans section IA (-1). SIREN placeholder (-1). Autorité compétente CNIL seule (AKI Estonie absent) (-0.5). |
| **TOTAL** | **/45** | **22/45** | |

---

## 7. Verdict

> **SCORE : 22/45 — INFÉRIEUR AU SEUIL DE 25/45**
>
> **HOLD PUBLICATION 200+/JOUR**
>
> La conformité AI Act art. 50 est partielle : les routes `/blog/[slug]` et `/cas-concrets/[slug]` (routes à plus fort volume de publication content-gen) n'émettent pas `aiGenerated:true` dans leur JSON-LD. La table `GenerationProvenance` est absente. Les DPA providers IA n'ont pas de dates de signature dans le registre officiel.
>
> **Le site ne doit pas augmenter sa cadence de publication IA au-delà de son niveau actuel tant que F-01 + F-02 ne sont pas corrigés (estimé : 1-2h de code).**

---

## 8. Délégations suggérées

| Agent | Tâche recommandée |
|---|---|
| Sprint correctif P0 | Migrer `/blog/[slug]` et `/cas-concrets/[slug]` vers `buildBlogPostingJsonLd` + `buildArticleJsonLd` de `seo-content-gen-factories.ts`. Ajouter `AiContentDisclaimer` à `cas-concrets/[slug]`. |
| Sprint correctif P1 | Créer migration Prisma `GenerationProvenance` (articleId + provider + model + modelVersion + promptHash + inputTokens + outputTokens + cost + timestamp + regulationVersion). |
| Action Will | Vérifier statut Coolify des clés API (ANTHROPIC/OPENAI/PERPLEXITY) et mettre à jour DPA-REGISTER avec dates réelles de signature. |
| Action Will | Ajouter section IA générative dans `/mentions-legales`. Compléter SIREN + forme juridique. |

---

## 9. UNKNOWNs

| # | Inconnue | Impact |
|---|---|---|
| U-01 | Statut Coolify des clés API providers IA (actives ou non en prod) | Si actives sans DPA signé = F-03 devient violation immédiate |
| U-02 | Volume d'articles `/blog` publiés via content-gen (vs articles statiques FS) | Détermine l'urgence réelle de F-01 |
| U-03 | Les "5+3 DPA signés" du CHANGELOG 2026-05-15 ont-ils été effectivement réalisés ? | Si oui, seule mise à jour registre manque (P1). Si non, P0 confirmé. |
| U-04 | `/methodologie` — contenu généré IA ou éditorial humain ? | Détermine si F-11 est réel |
| U-05 | Articles `/cas-concrets` — citent-ils des clients nominatifs non anonymisés ? | Détermine l'urgence de F-09 |

---

## 10. Références

| Fichier | Usage |
|---|---|
| `axionia/src/lib/seo-content-gen-factories.ts` | Factory conforme AI Act (L163-170 : aiGenerated + additionalType) |
| `axionia/src/lib/seo.ts:604-685` | Factory NON conforme — absente aiGenerated |
| `axionia/src/app/[locale]/blog/[slug]/page.tsx:18` | Import mauvaise factory |
| `axionia/src/app/[locale]/cas-concrets/[slug]/page.tsx:17` | Import mauvaise factory |
| `axionia/src/components/marketing/AiContentDisclaimer.tsx` | Composant disclaimer humain — conforme wording |
| `axionia/prisma/schema.prisma:2945-2957` | GenerationLog — non immuable (Cascade), fields insuffisants |
| `axionia/prisma/schema.prisma:2381-2401` | KnowledgeAuditLog — immuable hash-chaîné |
| `axionia/src/server/queue/workers/retention-purge-worker.ts:166-169` | Purge GenerationLog 12 mois — insuffisant AI Act |
| `axionia/src/app/api/gdpr-erase/route.ts` | Endpoint art. 17 — opérationnel mais scope limité |
| `axionia/_AUDIT/DPA-REGISTER.md` | Registre DPA — complet en procédures, vide en dates signatures |
| `axionia/src/content/legal.ts:233-235` | Section IA générative — dans politique-confidentialite (OK) |
| `axionia/src/content/legal.ts:44` | SIREN placeholder — mentions légales incomplètes |
| `axionia/docs/runbooks/R28-dpa-renewal.md` | Procédure renouvellement DPA |
| `axionia/docs/runbooks/R29-rgpd-subprocessor-audit.md` | Audit sous-processeurs |
