# 99 — SYNTHÈSE PLATFORM PERFECTION (2026-05-16)

> Synthèse exécutive consolidant les 25 livrables Phase 1-5.
> Mode AUDIT-ONLY strict respecté. Aucun code modifié hors `_AUDIT/PLATFORM-PERFECTION-2026-05-16/`.

---

## 0. Tableau exécutif Will (1 page)

| Item                                   | Valeur                                                                                                                                                                                                                |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Périmètre audité**                   | Axion-IA platform end-to-end, 25 axes sur 26 livrables                                                                                                                                                                |
| **SHA HEAD au lancement**              | `98e0b0f` (main)                                                                                                                                                                                                      |
| **SHA effectivement audité Phase 4-5** | `4cdfbe4` (branche `feat/image-bank-v1` — image-bank V1 mergée localement, **non pushée**) — un agent Phase 2 a fait un checkout en cours d'audit. Le périmètre élargi a permis d'inclure image-bank V1 dans la cert. |
| **Score global pondéré**               | **2156.7 / 2750 (78.4%)**                                                                                                                                                                                             |
| **Verdict**                            | 🟠 **SPRINT CORRECTIF** — corriger 22 P0 cross-cuttings avant prod sereine                                                                                                                                            |
| **Tendance vs audit 2026-05-09**       | 96/100 → 78.4 % : régression apparente liée au **périmètre élargi** (image-bank V1 ajouté, audits plus stricts SEO/AEO/GEO + RGPD/secrets + scalabilité). Pas une régression réelle du code.                          |
| **Effort total P0**                    | ~80-100 h autopilote + 8-10 h action humaine (rotation tokens, drill DR, DPA papier)                                                                                                                                  |
| **Délai recommandé Sprint Correctif**  | **S+1 (1 semaine intensive)** focus 6 P0 sécurité/RGPD + S+2 (2-3 semaines) reste                                                                                                                                     |
| **Risque actuel prod**                 | Acceptable (site live, déjà avec garde-fous Telegram/Sentry/CF). Risques résiduels : (a) leaks RGPD via exports incomplets, (b) bots passent honeypot 6/7 forms, (c) restore DR jamais testé.                         |

### 5 forces remarquables

1. **DocuSeal dual-mode HMAC v1 + secret v2** mergé (`src/lib/docuseal.ts:436-474`) — TODO mémoire fermé sans bruit.
2. **pgvector HNSW cosine m=16/ef=64** sur `knowledge_embeddings` — choix V1 sain pour 100K entries Voyage AI 1024 dim.
3. **Build externalisé GHCR (ADR 0026)** robuste — `Dockerfile.coolify-pull`, stub.invalid magic string propagée 10/10 sites.
4. **CSP nonce + COEP credentialless + HSTS preload** prod headers parfaits (snapshot Phase 0).
5. **Pattern Knowledge V4 exemplaire** (Zod + RBAC gradué + audit hash-chain + IndexNow lifecycle) — référence à réutiliser pour fixer les passoires content-gen.

### 5 P0 bloquants (extraits Top 22 cross-cuttings)

| #        | Sujet                                                                                                                                                                                                                                                         | Refs audit | Effort                     |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------- |
| **P0-1** | **6 mutations Sprint KB-18 sans RBAC** — `src/server/actions/knowledge/annotations.ts` + `collections.ts` + `ingest.ts` : publishCollection / create / resolve sans `requireAdmin*` (publication publique possible sans auth, authorId/ownerId spoofables)    | 1.D, 2.B   | **3 h**                    |
| **P0-2** | **RGPD art.15/17 incomplet** : `/api/gdpr-export` ne sélectionne que `bookingDate` (Art.20 partiel) et ne appelle pas `exportKbDataForEmail` (bookmarks/annotations absents) ; `/api/gdpr-erase` n'existe pas (route helper `eraseKbDataForEmail` non câblée) | 4.A, 4.D   | **4 h**                    |
| **P0-3** | **IP stockée en clair** dans `Submission.ipAddress` + `NewsletterSubscriber.ipAddress` (helper `hashIp` IP_HASH_SALT existe mais utilisé uniquement par image-bank) — viole doctrine MEMORY/skill                                                             | 4.F        | **2 h**                    |
| **P0-4** | **Honeypot rendu UNIQUEMENT QuoteRequestForm** — server-check `formData.get("website")` placebo pour 6 autres forms (Contact, Newsletter, Booking, AuditRequest, Implementation, Audit)                                                                       | 3.D, 4.F   | **2 h**                    |
| **P0-5** | **PG restore drill jamais exécuté** : `_AUDIT/PG-RESTORE-DRILL-LOG.md` absent → RTO/RPO inconnus → doctrine §15 violée. Crontab PG backup jamais archivé `_AUDIT/` non plus                                                                                   | 5.B        | **30 min ops + 1 h drill** |

### 5 P1 à planifier

| #    | Sujet                                                                                                                                                                                                                              | Refs     | Effort  |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------- |
| P1-1 | RBAC drift architectural — 4 implémentations distinctes `requireAdmin*` (rank vs whitelist) + 30+ sites dupliqués `src/features/admin-*/actions.ts` × 17, blocage réutilisation `src/server/actions/knowledge/_guards.ts`          | 1.A, 4.G | 4-6 h   |
| P1-2 | FTS raw SQL `prisma/migrations_fts/*.sql` non auto-applied au runtime (entrypoint ne lance que `prisma migrate deploy`) → indices KB FTS + image-bank GIN absents en prod sans action manuelle                                     | 2.A, 5.C | 2 h     |
| P1-3 | Image-bank V1 = 0 test (+8044 LOC, dirs `tests/image-bank/{unit,integration,e2e}/` vides) → prochaine PR pète seuil Vitest 60% bloque main                                                                                         | 1.E      | 12-16 h |
| P1-4 | content-gen `targetKnowledgeEntryId` jamais écrit post-publish (`content-publish-worker.ts`, helper `publishToKB` non câblé) ; Manon `aiGenerated/personaDisclaimer` absent sur blog/actualites/connaissances (`AuthorByline.tsx`) | 4.B      | 3-4 h   |
| P1-5 | `/api/internal/kb/search` public sans rate-limit + `/api/indexnow` open POST sans auth + DocuSeal webhook fallback plaintext (à retirer ou IP-allow-list)                                                                          | 2.D      | 2-3 h   |

---

## 1. Réponses aux 5 questions du contrat d'audit

### Q1 — Le code est-il toujours parfaitement structuré ? (architecture, DRY, scalabilité)

**Réponse : 🟡 PARTIELLEMENT.** Structure modulaire saine (`src/server/{actions,content-gen,queue,image-bank,booking,kb}` propre, isolation par feature en place via `scripts/check-isolation.ts`). Mais 3 drifts architecturaux notables :

- **RBAC drift majeur** : `requireAdmin*` ré-implémenté 4× (rank-based vs whitelist) sur `src/server/actions/knowledge/_guards.ts` vs `src/features/admin-*/actions.ts` (×17) vs `src/features/booking/*-actions.ts` vs `src/features/{contract,invoice,payment}/admin-actions.ts`. Sémantique rôles non-uniforme (`author/viewer` du master prompt ≠ schéma réel `editor/reader`).
- **`formatDate` ré-implémenté ×15** dans `src/app/[locale]/(admin)/[adminPrefix]/{factures,reservations,paiements,devis,calendrier}.tsx` malgré SSOT `src/lib/intl.ts:75 fmtDate`.
- **`middleware.ts` + `proxy.ts` coexistent** alors que Next 16.2 n'autorise qu'un seul fichier proxy/middleware. Risque silencieux : cookies pSEO `axion_ref_city` / `axion_utm` jamais posés → attribution pSEO cassée.

Scalabilité globale OK (pgvector HNSW + sitemap chunked 1000 URLs + size-limit + ISR cohérent), bémol N+1 content-keyword-sync-worker 28K calls DB/run hebdo.

### Q2 — Tous les flows business fonctionnent-ils de bout en bout ?

**Réponse : 🟡 OUI POUR 5/7, NON POUR 2/7.**

| Flow                   | Statut                                                                                                                                                                                                      | Confiance |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Booking V1             | ✅ Câblé end-to-end (devis → DocuSeal → Stripe → email → admin), idempotency UUID v4, TX FOR UPDATE                                                                                                         | 84 %      |
| Content-Gen 3 secteurs | ⚠️ Pipeline OK mais 3 trous : KB link non câblé, Manon byline invisible publics, quality loop sans seuil bas                                                                                                | 78 %      |
| Image-Bank V1          | ✅ Upload → workers Sharp → publish → galerie → JSON-LD ImageObject. Best-of-breed sur cette V1.                                                                                                            | 91 %      |
| KB V4                  | ❌ `generateEmbedding` est un STUB SHA-256 — pas Voyage AI réel ; `/api/gdpr-export` n'inclut pas KB ; `/api/gdpr-erase` absent                                                                             | 73 %      |
| pSEO villes            | ⚠️ 17 284 pages SSG générées, Paris pilote OK, mais 1 ville indexable V1, `classifyCity()` helper absent, sitemap services-villes ne lit pas Article DB tier-1, JSON-LD additionalProperty.inseeCode absent | 81 %      |
| Contact/Presse         | ❌ Honeypot UI absent, IP en clair, `/api/vitals` sans rate-limit                                                                                                                                           | 70 %      |
| Admin (Will daily)     | ✅ 116 pages, ⌘K palette 65 entries, kill-switch content-gen, mais kill-switches image-bank/booking/maintenance manquants et 2FA sans QR                                                                    | 88 %      |

### Q3 — Tout est-il parfaitement raccordé ? (cohérence cross-pages, SSOT)

**Réponse : 🟡 GLOBALEMENT OUI, 4 raccords manquants ou cassés.**

- **pricing.ts SSOT** : 9 slugs prestation cohérents DB ↔ UI ↔ pricing.ts ↔ email. Doctrine "8 prestations" du master prompt corrigée par flow 4.A (Will a tranché 9 slugs au 2026-05-12 ADR 0017).
- **routing.ts SSOT** : 9 pages filesystem **absentes** de `pathnames` (`/guides/[slug]`, `/equipe/[slug]`, 3 landings galerie thématiques, `/transparence`, `/ressources` orphelin sitemap). Discoverabilité Manon (AI Act art. 50) cassée.
- **`<Link href="/galerie">`** dans `src/components/press/PressImageBank.tsx:71` = broken link sitewide page presse (route absente).
- **`<JsonLdGraph>`** factory utilisé sur 2 pages seulement (devrait être consolidé sur top 12 templates) ; Speakable DOM orphelin (sélecteur `[data-faq-q]` 0 hit DOM).

### Q4 — Oublis / régressions / dead code / endpoints non câblés ?

**Réponse : 🟡 INVENTAIRE 15 ITEMS** (détaillés livrables 01/02/04/07/09/16/18) :

- **Helpers orphans** : `alertOps()` / `alertIncident()` (`src/lib/telegram.ts:83-102`) — 0 caller src/ ; `eraseKbDataForEmail` (`src/lib/knowledge/rgpd-export.ts:104`) — aucune route ne l'invoque ; `publishToKB` helper non câblé worker publish.
- **Endpoints non protégés** : `/api/internal/kb/search` (DoS via FTS), `/api/indexnow` (spam URLs Bing avec NOTRE key), `/api/vitals` (saturation ndjson).
- **Mutations sans RBAC** : 6 Sprint KB-18 (collections.ts × 5 + annotations.ts × 2) + 10 lectures content-gen non guardées (drift Pass B P0-4 partiel) + `updateProvider` / `resetProviderSpend` / `updateLlmsTxt` sans `logActivity`.
- **Dead V1 KB** : Feedback, Bookmark write, ImportBatch (3 modèles utilisés 0 fois en code).
- **Pages admin orphelines image-bank** : 4 pages (licensing, seo-audit, sitemap-status, taxonomy) ni sidebar ni cmdk.
- **Modif "uncommit" `.github/workflows/deploy-coolify.yml` Phase 0** : stale — `git diff HEAD` vide après commit `1b452b9` (faux positif Phase 0).

### Q5 — La plateforme est-elle production-ready ?

**Réponse : 🟡 OUI AVEC RÉSERVES.** Site live et fonctionnel depuis 2026-05-09 + recovery 2026-05-16 stable. Restent 5 réserves dures :

1. **Backup DR jamais drillé** → impossible de garantir RTO/RPO.
2. **Workflow deploy zero alerte Telegram fail** → silence radio sur fail build/deploy/lhci.
3. **FTS raw SQL non auto-applied** runtime → si l'op rebuild from scratch, indices KB FTS + image-bank GIN absent prod → full-scan ~30K entries factory.
4. **Drift `.env.example` vs `env.ts`** : 14 vars manquantes (`IP_HASH_SALT`, `PII_ENCRYPTION_KEY`, `BACKUP_ENCRYPTION_PASSPHRASE`, `REVALIDATE_SECRET` lue hors schema Zod = endpoint sans auth si absente) → onboarding contributeur ne peut pas builder local.
5. **18 tokens prod sans calendrier rotation documenté** (Hetzner/CF/Coolify/OpenAI/Anthropic/Stripe/Resend/DocuSeal/Telegram/Voyage/Clarity/Plausible/Sentry/IndexNow/Stripe LIVE keys).

Tout le reste (CSP, headers, Stripe webhook idempotent + outbox, Sentry PII slim, LHCI gate hard-fail, sitemap stub-aware build) est solide.

---

## 2. Matrice par pilier — Scoring pondéré /2750

| #   | Pilier                | Score brut /100 | Poids max | Pondéré    | Verdict    |
| --- | --------------------- | --------------- | --------- | ---------- | ---------- |
| 1   | Architecture & DRY    | 60.5            | 100       | **60.5**   | 🟠         |
| 2   | Scalabilité           | 86.7            | 150       | **130.0**  | 🟢         |
| 3   | Types & Prisma        | 71              | 100       | **71**     | 🟡         |
| 4   | Sécurité & RGPD       | 81.5            | 200       | **163**    | 🟡         |
| 5   | Tests & CI/CD         | 60              | 150       | **90**     | 🟠         |
| 6   | DB schema             | 82              | 100       | **82**     | 🟢         |
| 7   | Server Actions        | 72              | 100       | **72**     | 🟡         |
| 8   | Workers               | 77              | 100       | **77**     | 🟡         |
| 9   | API & Sitemaps        | 84              | 100       | **84**     | 🟢         |
| 10  | Routes inventory      | 82              | 100       | **82**     | 🟢         |
| 11  | Navigation & maillage | 77              | 100       | **77**     | 🟡         |
| 12  | Design system         | 81              | 100       | **81**     | 🟢         |
| 13  | Forms & a11y          | 76              | 100       | **76**     | 🟡         |
| 14  | SEO/AEO/GEO           | 80.5            | 200       | **161**    | 🟡         |
| 15  | Flow Booking          | 84              | 100       | **84**     | 🟢         |
| 16  | Flow Content-Gen      | 78              | 150       | **117**    | 🟡         |
| 17  | Flow Image-Bank       | 91.4            | 50        | **45.7**   | 🟢         |
| 18  | Flow KB               | 73              | 100       | **73**     | 🟡         |
| 19  | Flow pSEO villes      | 81              | 100       | **81**     | 🟢         |
| 20  | Flow Contact/Presse   | 70              | 50        | **35**     | 🟡         |
| 21  | Flow Admin            | 88              | 150       | **132**    | 🟡         |
| 22  | Env & Secrets         | 81              | 100       | **81**     | 🟡         |
| 23  | Monitoring & Alerting | 81              | 100       | **81**     | 🟡         |
| 24  | CI/CD & Deploy        | 88              | 100       | **88**     | 🟢         |
| 25  | Docs & ADRs           | 65              | 50        | **32.5**   | 🟠         |
|     | **TOTAL**             |                 | **2750**  | **2156.7** | **78.4 %** |

**Seuils** : ≥ 92 % 🟢 PROD-READY · 80-91 % 🟡 CONDITIONAL · 65-79 % 🟠 **SPRINT CORRECTIF** · < 65 % 🔴 NO-GO.

**Verdict final** : 🟠 **SPRINT CORRECTIF — 78.4 %**.

### Lecture matrice — 4 piliers tirent le score vers le bas

| Pilier                                    | Cause                                                                                                                                                                  |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Architecture & DRY (60.5)**             | RBAC drift 4 impls × 30+ sites + middleware/proxy coexistence + formatDate ré-implémenté ×15                                                                           |
| **Tests & CI/CD (60)**                    | Image-bank 0 test (+8044 LOC), 4 squelettes E2E content-gen S6.3 skipped, booking-submit + contact-submission E2E skipped                                              |
| **Docs & ADRs (65)**                      | README drift 6 incohérences (CPX32→42, ADRs 0001-4→0001-27), ONBOARDING.md absent, \_AUDIT/ housekeeping (152 entrées top-level)                                       |
| **Architecture remontée si fix appliqué** | Estimation post-P0+P1 : Architecture 60.5 → 82, Tests 60 → 78, Docs 65 → 85 → score global remonte à **~2330 / 2750 = 84.7 % 🟡 CONDITIONAL** sans toucher au business |

---

## 3. Évolutions depuis dernier audit

### Delta vs `_AUDIT/AUDIT-FINAL-VERDICT.md` (2026-05-09 — Sprint 24)

| Pilier       | 2026-05-09         | 2026-05-16                                              | Delta                                                           |
| ------------ | ------------------ | ------------------------------------------------------- | --------------------------------------------------------------- |
| Score global | 96/100             | 78.4/100                                                | -17.6                                                           |
| RGPD         | CONDITIONAL (3 P0) | CONDITIONAL (4 P0 nouveau scope)                        | iso                                                             |
| Sécurité     | 91.4 % ASVS 5.0    | 81.5 %                                                  | -10 (RBAC drift + 3 endpoints non-protégés détectés cette fois) |
| Booking      | GO                 | GO                                                      | iso                                                             |
| Content-Gen  | GO                 | NEAR-GO conditional                                     | -ε (3 nouveaux trous identifiés)                                |
| Web Vitals   | CONDITIONAL        | non re-audité (renvoi `_AUDIT/AUDIT-WEB-VITALS-2026-*`) | n/a                                                             |

**Analyse delta** : la régression apparente vient majoritairement de :

1. **Périmètre élargi** : audit 2026-05-09 ne couvrait pas image-bank (pas encore mergé), pSEO 17K routes, ni les drifts architecturaux (RBAC, middleware/proxy).
2. **Audits plus stricts** : Phase 4.D (KB) a découvert le STUB SHA-256 generateEmbedding qui n'était pas testé avant.
3. **Nouveaux flows** : 3 secteurs content-gen 2026-05-16 + KB V4 mergé `bd0f831` + image-bank V1 = nouveau périmètre.

**Le site n'a pas régressé** — il s'est étendu plus vite que les garde-fous. Sprint Correctif S+1 doit re-aligner.

### Delta vs `_AUDIT/IMAGE-BANK-V1-VERIFICATION-2026-05-16/` (909/1000)

| Item             | 2026-05-16 (verif) | 2026-05-16 (this audit Flow 4.C) | Statut  |
| ---------------- | ------------------ | -------------------------------- | ------- |
| Score image-bank | 909/1000 (91 %)    | 914/1000 (91.4 %)                | +5, iso |
| P0 RGPD art.17   | "bloquant merge"   | **FERMÉ**                        | ✅      |
| Tests Vitest     | 0/0                | reporté Sprint 1.5               | iso     |
| EXIF Copyright   | "manquant"         | manquant                         | iso     |

→ Image-bank V1 **prête à push main** sur P0 critères. P1 = tests Sprint 1.5.

---

## 4. Anti-patterns rouges signalés (red flags §8 du prompt)

| #   | Red flag                                                        | Détecté ?                                                             | Refs     |
| --- | --------------------------------------------------------------- | --------------------------------------------------------------------- | -------- |
| 1   | Server Action mutative sans `requireAdmin*`                     | **OUI** 6 Sprint KB-18 + 3 ingest                                     | 1.D, 2.B |
| 2   | `prisma.X.findMany` dans boucle (N+1)                           | **OUI** content-keyword-sync-worker 28K calls                         | 1.B      |
| 3   | Tarif hardcodé hors `pricing.ts`                                | NON détecté Phase 4.A (9 slugs cohérents)                             | 4.A      |
| 4   | `<a href>` vers page 404/500 prod                               | **OUI** `/galerie` dans PressImageBank                                | 3.B      |
| 5   | `setTimeout`/`setInterval` server sans cleanup                  | non détecté                                                           | —        |
| 6   | JWT secret / API key hardcodé                                   | NON (gitleaks config présente)                                        | 5.A      |
| 7   | `@ts-ignore` sans WHY                                           | 0 trouvé ; 5 `@ts-expect-error` tous légitimes                        | 1.C      |
| 8   | Console.log PII en clair                                        | non détecté (PII redaction Telegram OK ; mais IP en clair DB **OUI**) | 4.F      |
| 9   | `landing_ville` / `blog_from_rss` dans distribution sectorielle | NON détecté (validator OK)                                            | 4.B      |
| 10  | Tests verts qui testent rien                                    | 4 squelettes E2E content-gen skipped (équivalent)                     | 1.E      |
| 11  | Hex en dur CSS-in-JS                                            | 17 fuites `rgba()` inline non détectées par linter actuel             | 3.C      |
| 12  | EN locale sans passer par proxy                                 | NON détecté (proxy.ts:36-43 court-circuite OK)                        | 3.A      |
| 13  | Worker BullMQ sans `removeOnComplete`                           | NON détecté (defaultJobOptions centralisés OK)                        | 2.C      |
| 14  | Migration Prisma sans rollback dry-run testé                    | non vérifiable read-only                                              | —        |
| 15  | CTA externe sans `rel="noopener"`                               | non audité ce tour                                                    | —        |

**8 / 15 red flags présents** (4 confirmés + 4 partiels). Tous mappés sur P0/P1 dans la roadmap.

---

## 5. Sortie format requis

> **Audit Platform Perfection 2026-05-16 terminé. Score 2156.7/2750 (78.4 %). Verdict 🟠 SPRINT CORRECTIF. 22 findings P0, ~35 P1, ~25 P2. Livrables dans `axionia/_AUDIT/PLATFORM-PERFECTION-2026-05-16/` (26 fichiers).**
>
> **Top 3 P0** :
>
> 1. `src/server/actions/knowledge/{annotations,collections,ingest}.ts` — 6 mutations Sprint KB-18 sans `requireAdmin*` (publication publique possible, authorId/ownerId spoofables).
> 2. `/api/gdpr-export` partial + `/api/gdpr-erase` absent — Art.15/17 RGPD incomplet (bookmarks/annotations/bookings full record manquants).
> 3. Honeypot rendu UNIQUEMENT QuoteRequestForm — server-check placebo pour 6 autres forms publics (Contact/Newsletter/Booking/AuditRequest/Implementation/Audit).

---

**Voir `99-ROADMAP-REMEDIATION.md` pour le plan Sprint S+1 / S+2 / S+3 / M+1.**
