# 🏛️ PROMPT META-CERTIFICATION FINALE 2026 — Content Generator Axion-IA

> **Méta-audit absolu** post-fixes : vérifie que les 10 audits sectoriels
> précédents + leurs P0/P1 fixés + V1/V2 livrés + Sprints 13-24 + KB V4 +
> pSEO villes + Booking V1 + Cloudflare Phase 5 + Stabilisation prod sont
> RÉELLEMENT À LA PERFECTION pour activer la factory 100/jour sans risque.
>
> **Mode AUDIT-ONLY STRICT ABSOLU**. Aucune écriture code. Aucun commit.
> Aucune mutation prod. Aucun appel API IA externe.
>
> Production : **20 livrables `_AUDIT/META-CERT-2026-XX-XX/`** + 1 verdict
> final global.
>
> Score cible : **≥ 1350 / 1500 (90 %)** pour 🟢 **CERTIFICATION ABSOLUE
> GO PROD**.
>
> Durée estimée : 30-45 h dev (audit + lecture rapports + smoke prod read).
> Doit être lancé dans 1 session fraîche dédiée (contexte propre).

---

```
Skill : axionia-content-generator (mode 🔒 META-CERTIFICATION FINALE 2026)

Tu es l'auditeur certification absolue post-fixes du content generator
Axion-IA. Will a livré : V1 (Sprints 1-6 tag v1.0.1) + V2 (Sprints 7-12)
+ Sprints 13-20 (Booking V1 + KB V4) + Sprints 21-24 (RGPD + OWASP) +
Cloudflare Phase 5 + Stabilisation prod 2026-05-09 + Hetzner CPX42 rescale
+ Tag v1.0.3-content-gen 2026-05-14 + correctifs ad-hoc multiples.

10 audits sectoriels ont été lancés :
1. A1 deps + supply chain (2 rapports : 05-14, 05-15)
2. A2 régression V1→V2 (À LANCER — manquant)
3. A5 runbooks ops (05-15)
4. A7 migration data V1→V2 (05-15)
5. B5 DPA + RGPD sous-processeurs (05-15)
6. D5+D6 DR + backups (05-15)
7. FINAL prod-ready (05-14)
8. Opérationnel flows end-to-end (05-14)
9. Pass B officiel § 22 EXIT V1 (05-14, 354/410 🟢)
10. PERF Web Vitals + crawl bots + AEO/GEO IA (NEW — À LANCER)

Ton job : **NE PAS REFAIRE** les 10 audits sectoriels (gaspillage 80+ h).
**VÉRIFIER** que :
(a) Les P0/P1 identifiés ont été RÉELLEMENT fixés (et bien fixés)
(b) Les fixes n'ont pas créé de régressions cross-domain
(c) La prod live fonctionne end-to-end sans aucune rupture
(d) Tous les critères de perfection 2026 sont respectés
(e) Aucun nouveau risque émergent (changements stack, deps, prod)
(f) Le système est READY pour activer factory 100/jour SANS surveillance
    rapprochée 7j

PHILOSOPHIE :
- Tu es l'auditeur tiers indépendant. Tu ne fais CONFIANCE à AUCUN audit
  précédent : tu re-vérifies sur le code + prod live.
- Tu lis les 10 rapports précédents COMME des hypothèses à valider,
  pas comme des vérités.
- Tu cherches les bugs que les audits précédents ont MANQUÉS.
- Tu cherches les régressions introduites par les fixes.
- Tu cherches les zones non-couvertes par les 10 audits.
- Verdict basé sur PREUVES (commit SHA, mesures live, captures HTTP),
  pas sur affirmations rapports.

⛔ MODE AUDIT-ONLY STRICT ABSOLU :
- Aucune édition code, aucun commit, aucun push, aucun migrate, aucun seed
- Aucun appel API IA externe (OpenAI / Anthropic / Voyage / Perplexity)
- Aucun POST mutant sur prod
- curl / Lighthouse / WebPageTest / PSI API / CrUX API / Rich Results
  Test API en LECTURE-SEULE uniquement
- pnpm typecheck / test / lint en read-only OK
- git log / git diff / git show en read-only OK
- prisma migrate diff en read-only OK
- Si bug détecté → noter avec preuve, NE PAS fix
- 20 livrables `.md` + 1 verdict global

╔═══════════════════════════════════════════════════════════════════════╗
║                  LECTURE OBLIGATOIRE (prerequis)                      ║
╚═══════════════════════════════════════════════════════════════════════╝

**Master prompts référentiels :**
1. `axionia-megapack-skills/.claude/skills/axionia-content-generator/SKILL.md` (master v2.5)
2. `_AUDIT/PROMPT-CONTENT-FACTORY-SPEC.md`
3. `_AUDIT/PROMPT-CONTENT-GENERATOR-MASTER-2026.md`
4. `_AUDIT/PROMPT-PRE-IMPLEMENTATION-VERIFICATION-2026.md`

**Les 10 rapports sectoriels précédents :**
5. `_AUDIT/CONTENT-GEN-AUDIT-A1-DEPS-2026-05-14.md` + `-05-15.md`
6. `_AUDIT/CONTENT-GEN-AUDIT-A5-RUNBOOKS-2026-05-15.md`
7. `_AUDIT/CONTENT-GEN-AUDIT-A7-MIGRATION-2026-05-15.md`
8. `_AUDIT/CONTENT-GEN-AUDIT-B5-DPA-RGPD-2026-05-15.md`
9. `_AUDIT/CONTENT-GEN-AUDIT-D5-D6-DR-2026-05-15.md`
10. `_AUDIT/CONTENT-GEN-AUDIT-FINAL-PROD-READY-2026-05-14.md`
11. `_AUDIT/CONTENT-GEN-AUDIT-OPERATIONNEL-FLOWS-2026-05-14.md`
12. `_AUDIT/CONTENT-GEN-PASS-B-VERDICT-2026-05-14.md`
13. `_AUDIT/CONTENT-GEN-AUDIT-PERF-WEB-VITALS-CRAWL-2026-XX-XX.md` (si dispo)
14. `_AUDIT/CONTENT-GEN-AUDIT-A2-REGRESSION-2026-XX-XX.md` (si dispo)

**Changelogs + sessions sources :**
15. `_AUDIT/CHANGELOG-V1-BOOKING.md`
16. `_AUDIT/CONTENT-GEN-V1-AUTOPILOT-LOG.md`
17. `_AUDIT/SESSION-2026-05-14-CONTENT-GEN-AUDIT-COMPLET.md`
18. `_AUDIT/AUDIT-PARITY-V14-FINAL.md`

**Documentation technique :**
19. `docs/runbooks/*` (si présent)
20. `docs/content-gen/*` (si présent)
21. `docs/ADR/*` (tous ADRs)
22. `axionia/README.md`
23. `axionia/CLAUDE.md`
24. `prisma/schema.prisma` (état complet)
25. `prisma/migrations/*` (toutes migrations livrées)
26. `axionia/.github/workflows/*` (CI)
27. `axionia/next.config.*`
28. `axionia/middleware.ts`
29. `axionia/Dockerfile`
30. `axionia/package.json` + `pnpm-lock.yaml`

**Code stack complet (read-only) :**
31. `axionia/src/app/**/*` (toutes routes)
32. `axionia/src/lib/**/*` (helpers)
33. `axionia/src/server/**/*` (Server Actions)
34. `axionia/src/components/**/*` (composants)
35. `axionia/src/workers/**/*` (BullMQ workers)
36. `axionia/src/jobs/**/*` (cron jobs)

╔═══════════════════════════════════════════════════════════════════════╗
║                  PHASE 0 — PRE-FLIGHT (1 agent)                       ║
╚═══════════════════════════════════════════════════════════════════════╝

═══ AGENT 0 — Validation des rapports + reality check ═══════════════ /80

**0.1 — Sanity check des 10 rapports**
Pour chaque rapport sectoriel (10 total) :
- Le rapport existe-t-il ? (sinon flagger MANQUANT critique)
- Date de production cohérente (< 30 jours sinon stale = ORANGE)
- Verdict explicite (GO / CONDITIONAL / NO-GO) ?
- Top P0/P1 listés ? Combien ?
- Score sur barème ? Compatible avec verdict ?
- Auteur signé ? (agent ou humain ?)

Livrable : tableau 10 rapports × 8 colonnes méta.

**0.2 — Reality check fixes appliqués**
Pour CHAQUE P0 listé dans rapports précédents (consolidation ~30-50 P0) :
- ID P0 + audit source
- Description courte
- Statut affiché dans rapport (FIXÉ / EN COURS / REPORTÉ)
- **Preuve commit** : git log --all --grep + git show pour vérifier
- **Re-test gate** : la condition qui était ROUGE est-elle MAINTENANT
  verte ? (re-mesurer en mode read-only)
- Verdict cellule : 🟢 fixé prouvé / 🟡 fixé sans preuve / 🟠 partiellement
  fixé / 🔴 non fixé / ⚫ régression introduite

Livrable : tableau ~40 P0 × 7 colonnes avec SHA commits + mesures.

**0.3 — Zones non-auditées détectées**
Lister les domaines critiques 2026 qui n'apparaissent dans AUCUN des 10
rapports précédents (gap detection) :
- Booking V1 flow complet (X.2 → X.20) → audit OPÉRATIONNEL flows couvre ?
- KB V4 Sprints 13-20 (auto-publish, ingest_requests, audit hash-chain) ?
- pSEO villes 12 942 routes (anti-doorway HCU 2024) ?
- Cloudflare Phase 5 (5 Cache Rules, Bot Fight, AI Scrapers, HSTS) ?
- Stripe webhooks + refunds + deposit-gated flow ?
- DocuSeal X.3 (NDA Yousign) ?
- BullMQ X.12 admin UI ?
- Email deliverability (DMARC, SPF, DKIM, Zoho Mail) ?
- AI Act EU 2026 obligations (Manon persona disclosure) ?
- WCAG 2.2 AA accessibilité ?
- Cross-browser (Safari, Firefox, Edge) ?
- Mobile responsive sur 12 942 routes pSEO ?

Livrable : liste 15-20 zones non-couvertes avec criticité.

**0.4 — Stack drift detection**
- Versions deps actuelles (`package.json`) vs versions dans rapports
  précédents → tout package mis à jour change la surface d'attaque
- `next.config.*` changes depuis dernier audit ?
- Variables env Coolify changées ?
- Migrations Prisma ajoutées depuis dernier rapport ?

Livrable : diff stack 30 jours.

**0.5 — Backlog actions humaines + P0/P1 techniques en suspens**
LECTURE OBLIGATOIRE : `_AUDIT/BACKLOG-ACTIONS-HUMAINES-2026-05-15.md`
(source unique de vérité TODOs accumulées sessions précédentes).

Pour CHAQUE item du backlog, vérifier statut current avec preuve :

**P0 bloquants activation factory :**
- [ ] **P0-1 Migration SQL prod** : `\dt content_gen_*` côté Postgres OK ?
      Logs Coolify `Migrations applied successfully` présent ?
      `pgvector` extension active ? Snapshot Hetzner pré-migration ?
- [ ] **P0-2 Coolify env vars (9 clés)** : `OPENAI_API_KEY`,
      `ANTHROPIC_API_KEY`, `PERPLEXITY_API_KEY`, `UNSPLASH_ACCESS_KEY`,
      `VOYAGE_API_KEY`, `KB_INGEST_SECRET`, `KB_AUTO_PUBLISH`,
      `INDEXNOW_KEY`, `GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON` ?
      (Vérifier via Coolify API list env vars read-only — ne pas afficher
      les valeurs, juste présence/absence)
- [ ] **P0-3 DPA RGPD 5+3** : Hetzner papier / Cloudflare online /
      OpenAI + ZDR Tier 4+ / Anthropic Commercial / Perplexity + SCC /
      Unsplash / Voyage / Stripe → signés ? `DPA-REGISTER` à jour ?
- [ ] **P0-4 Tests vitest cassants** : `pnpm test` en read-only sur HEAD,
      résultat ? 79 fichiers `__vite_ssr_exportName__` toujours cassés ?
      Push commits 3c5d4b0 et suivants effectivement sur main ?
- [ ] **P0-5 DR Backups 57→85+/100** :
      `BACKUP_ENCRYPTION_PASSPHRASE` documenté ?
      7 secrets CI `_AUDIT/CI-SECRETS-REQUIRED.md` set ?
      Premier drill manuel R22 SSH exécuté ? logs ?
      SSH crontab inventory effectué ?

**P1 importants :**
- [ ] **P1-1 Sprint A7 CI** : `gate-d-migration` job dans `ci.yml` ?
- [ ] **P1-2 ADRs deps** : `@anthropic-ai/sdk` + `react-email v3` ?
- [ ] **P1-3 Kill-switch atomic Redis Sprint 8 V2** : atomic op câblée ?
- [ ] **P1-4 Internal linking cosine** : Article.embedding utilisé pour
      graph similar articles ?
- [ ] **P1-5 Web Vitals sampling client-side** : beacon côté client wiré ?
      `WebVitalSample` DB ingest endpoint OK ? `/admin/web-vitals` câblé ?
- [ ] **P1-6 Google Indexing JWT** : activé prod ?
- [ ] **P1-7 /api/gdpr-erasure** : flow erasure existe ? bouton
      "Supprimer mes données" sur `mes-donnees/page.tsx` ?
- [ ] **P1-8 Audit visuel 3 Articles Manon** : 3 articles factory random
      → disclaimer body visible AI Act ? author + dateModified + JSON-LD
      Person OK ?
- [ ] **P1-9 Q11 sources RSS** : liste finale validée ?
      (LeMondeInformatique / ZDNet FR / Usine Digitale / JournalDuNet / Frenchweb)
- [ ] **P1-10 Q1 plafonds providers** : budgets confirmés ?
      ($200 OpenAI + $100 Anthropic + $80 Perplexity)

**P2 cosmétiques (P2 ne bloque pas activation, mais à tracer) :**
- [ ] sitemap-news.xml dédié quota Google News 1000/48h
- [ ] llms.txt format Jeremy Howard
- [ ] /blog/.md routes multi-format LLM
- [ ] KB many-to-many taxonomies

Livrable section 0.5 : tableau ~25 items × 4 colonnes (Statut / Preuve /
Bloque-t-il quoi ? / Effort restant). Référence backlog complet.

Gate AGENT 0 : ≥ 80 % P0 prouvés fixés = NÉCESSAIRE pour continuer audit.
Gate AGENT 0 bis : si ≥ 2 P0 du backlog non fermés, méta-cert s'arrête
prématurément avec verdict 🟠 NO-GO transitoire + roadmap actions Will.
Sinon → recommander de finir les fixes avant méta-audit complet.

╔═══════════════════════════════════════════════════════════════════════╗
║                  PHASE 1 — RE-AUDIT PROFONDEUR (10 agents //)         ║
╚═══════════════════════════════════════════════════════════════════════╝

Pour chaque audit sectoriel précédent, 1 agent re-vérifie UNIQUEMENT les
findings P0/P1. Pas de re-audit complet (overlap inutile avec rapports).
Focus : preuve concrète que les fixes tiennent en conditions réelles.

═══ AGENT 1 — Deps + supply chain v2 ═════════════════════════════════ /60

- Re-run `pnpm audit --audit-level=high` (read-only)
- Re-run `pnpm outdated` (read-only)
- Vérifier les CVE listées dans rapport A1 sont-elles toujours OPEN ?
- Lock file integrity : `pnpm install --frozen-lockfile` (read-only check)
- Licenses : tout package en MIT/Apache/BSD ? Aucune GPL ?
- Dependabot / Renovate actif ?
- Scripts npm postinstall suspects ?
- Top 20 deps par size dans bundle final
- Comparer rapport 05-14 vs 05-15 (le 2e a-t-il apporté des fixes ?)

Gate : tout CVE high/critical non-fixé = ROUGE.

═══ AGENT 2 — Régression V1→V2 v2 ════════════════════════════════════ /60

- Si audit A2 n'a JAMAIS été lancé (cf. mémoire) → flagger CRITIQUE,
  lancer audit A2 en parallèle
- Tag v1.0.1-content-gen (commit 5cc22ad) vs HEAD : diff inter-tag
- Tests V1 historiques : passent-ils tous sur HEAD ? (pnpm test)
- Schema migrations V1 + V2 : downgrade safe ?
- Routes V1 toutes accessibles + même comportement ?
- Données V1 prod (articles, jobs, queue) intactes ?
- Console admin V1 : tous boutons fonctionnent ?
- API V1 (Server Actions) : signatures inchangées ?
- KB V4 alimentée correctement par factory V2 ?

Gate : régression V1 détectée = ROUGE bloquant.

═══ AGENT 3 — Runbooks ops v2 ════════════════════════════════════════ /50

- Liste runbooks docs/runbooks/*
- Pour chaque incident prévisible (cf. rapport A5) : runbook présent ?
- Runbooks récents (< 30 j) ? Périmés ?
- Procédures testées (preuve d'exécution drill) ?
- Accès partagé Will + DPO + (futur) ops ?
- Runbooks couvrent : Postgres down, Redis down, OOM Coolify,
  factory bloquée, indexation 0, deploy rollback, secret leaked,
  RGPD request reçue, incident IA fact-check viral wrong claim ?
- Mémoire : Will dispose Coolify API auto authorized → runbook
  "redéployer via API" présent ?

Gate : > 30 % incidents sans runbook = ROUGE.

═══ AGENT 4 — Migration data V1→V2 v2 ════════════════════════════════ /60

- Re-run `prisma migrate diff` schema-only (read-only)
- Toutes migrations livrées Sprints 7-20 appliquées prod ? (mémoire
  signale `prisma migrate deploy` partiellement non exécuté pour certains
  sprints)
- Backwards-compat : index sur cols NOT NULL ajoutés ? defaults safe ?
- Data integrity : foreign keys intactes ? cascade rules safe ?
- Backup pre-migration existe ? Restore testé ?
- Hash-chain audit_log (KB V4 Sprint 17) : intégrité vérifiée ?
- Annotations + collections KB V4 : rétention OK ?

Gate : migration non appliquée prod = ROUGE.

═══ AGENT 5 — DPA + RGPD + AI Act EU 2026 v2 ═════════════════════════ /80

- Re-vérifier liste sous-processeurs vs providers actifs dans code :
  - OpenAI, Anthropic, Perplexity, Unsplash, Voyage AI, Stripe,
    Cloudflare, Hetzner, Coolify, Zoho Mail, Sentry, Plausible,
    Microsoft Clarity, Telegram, IndexNow, Google Indexing API,
    Search Console API, Backblaze (retiré code ? confirmer)
- DPA papier signé par fournisseur ? (action Will, vérifier
  `_AUDIT/DPA-REGISTER.md` mis à jour)
- /politique-confidentialite : tous les providers listés ?
- /sous-processeurs FR + EN : sync ?
- PII redaction Telegram (ADR 0010) : 14 sites patchés ? (mémoire)
- Manon persona AI Act disclosure : visible sur 100% pages générées ?
- GDPR erase actions : `/api/gdpr-export` + retention-purge cron OK ?
- /mes-donnees/export 200 OK en prod (mémoire) ?
- Cookie consent (CMP) : bandeau présent ? Tracking gated ?
- Boîte dpo@axion-ia.com active (Zoho Mail) ?
- Sous-processeurs ajoutés par fixes sans MAJ DPA register = ROUGE

Gate : provider actif code mais absent /politique-confidentialite = 🚨 CRITIQUE

═══ AGENT 6 — DR + Backups v2 ════════════════════════════════════════ /60

- Backup Postgres quotidien : automatique + testé restore ?
- Backup Redis : RDB ou AOF ?
- Backup Coolify configs : exporté ?
- Snapshot Hetzner régulier ? (mémoire recommande avant chaque change prod)
- Procédure restore Postgres ≤ RTO 4h documentée ?
- RPO ≤ 24h (perte data max) ?
- Disaster scenarios couverts (cf. rapport D5+D6) :
  Postgres corruption, Redis loss, Hetzner full outage, secrets leak,
  ransomware, factory runaway génère 10k articles spam ?
- Kill-switch factory (cost cap cascade tag v1.0.3 commit ?) opérant ?
- Bouton "rollback last deploy" Coolify accessible Will ?

Gate : restore non testé en réel = ORANGE.
Gate : kill-switch factory absent = ROUGE.

═══ AGENT 7 — Production-ready v2 (final prod-ready re-check) ═══════ /80

Re-vérifier les findings du rapport `FINAL-PROD-READY-2026-05-14.md` :
- Score actuel ? (rapport disait quoi)
- Top 10 P0 fixés ?
- SPEC ↔ CODE alignment toujours OK après nouveaux commits ?
- FRONTEND ↔ BACKEND wire complet ?
- DATA ↔ UX cohérent ?
- Aucune route 404 / 500 sur 50 URLs sample prod live ?

Gate : régression vs FINAL 05-14 = ROUGE.

═══ AGENT 8 — Opérationnel flows v2 ══════════════════════════════════ /80

Re-vérifier 44 scénarios opérationnels (cf. rapport OPÉRATIONNEL) :
- Génération (8 scénarios) : factory tier-1, tier-2, tier-3, manual,
  retry après échec, batch, schedule, force-rerun
- Publication (6 scénarios) : auto, manual, scheduled, draft-only,
  scheduled-with-IndexNow, fallback CDN
- Modification (7 scénarios) : edit title, edit body, edit slug
  (canonical), edit images, edit metadata, edit JSON-LD, revert
- Dépublication (8 scénarios) : unpublish, archive, soft-delete,
  hard-delete, batch unpublish, slug-redirect on unpublish,
  Sitemap update, IndexNow ping URLOmit
- Restauration / retry / rollback (5 scénarios)
- Erreurs + recovery (10 scénarios)

Pour chaque scénario : frontend → Server Action → DB → Worker → DB → UI
feedback. Aucune rupture ?

Gate : ≥ 5 scénarios cassés = ROUGE.

═══ AGENT 9 — Pass B officiel re-check v2 ════════════════════════════ /60

- Score Pass B précédent : 354/410 (rapport 05-14)
- Re-run guards CI : pnpm typecheck + pnpm test + pnpm lint
- Tests count : V2 ≥ V1 (286 → 350 → 818 selon mémoires) ?
- 0 régression test depuis dernier Pass B ?
- Score § 19 master prompt /200 toujours respecté ?
- Tag v1.0.3-content-gen poussé et stable ?

Gate : test failures > 0 = ROUGE.

═══ AGENT 10 — Perf + Web Vitals + AEO/GEO IA v2 ═════════════════════ /90

Si audit PERF-WEB-VITALS-CRAWL a été lancé :
- Score /900 ? (cible ≥ 810)
- Top 30 patches P0-P3 → combien fixés depuis ?
- LCP / INP / CLS p75 prod aujourd'hui vs baseline rapport ?
- 16 bots crawl : statut current (Bot Fight Mode ajusté ?)
- llms.txt + ai.txt déployés ?
- Speakable + Canonical Answers Pattern présents ?
- pSEO villes : aucune route 5xx ?

Si audit PERF non lancé : flagger P0 (refuse certification).

Gate : Web Vitals p75 rouge sur > 20 % URLs = ROUGE.

╔═══════════════════════════════════════════════════════════════════════╗
║                  PHASE 2 — CROSS-DOMAIN CONSISTENCY (5 agents //)     ║
╚═══════════════════════════════════════════════════════════════════════╝

═══ AGENT 11 — Perf vs RGPD vs Sécurité ══════════════════════════════ /70

- Tracking analytics (Plausible + Clarity) : RGPD-compliant ET ne casse
  pas Web Vitals (script async / defer / minimal payload) ?
- Sentry tracesSampleRate : équilibre perf (coût bundle) vs observability ?
- CSP nonce : ne casse pas widgets analytics ? next/font ? Turnstile ?
- HSTS preload 12 mois : pas de breaking change ?
- Speculation Rules : ne prefetch pas /admin/* (fuite) ?
- Cloudflare cache : /api/admin/* en BYPASS confirmé ?
- Cookie consent : tracking conditionné consent ET Web Vitals mesuré
  même sans consent (Web Vitals = anonyme légitimement) ?
- CMP impact LCP : bandeau ne shifte pas le layout (CLS) ?

Gate : un fix perf qui casse RGPD = ROUGE.
Gate : un fix RGPD qui casse perf > 200ms LCP = ORANGE.

═══ AGENT 12 — Sécurité OWASP top 10 2026 ════════════════════════════ /90

Re-vérifier les 10 catégories OWASP top 10 :
1. **A01 Broken Access Control** : /admin protégé ? Server Actions
   vérifient auth ? Role-based ?
2. **A02 Cryptographic Failures** : secrets en env non hardcoded ?
   PII chiffrée at-rest ? TLS 1.3 ?
3. **A03 Injection** : Prisma paramétré ? sanitize HTML user-input ?
   IndexNow / Google Indexing escape keys ?
4. **A04 Insecure Design** : kill-switch factory ? rate-limit ?
5. **A05 Security Misconfiguration** : headers OWASP (CSP, COEP, COOP,
   X-Frame-Options, X-Content-Type-Options, Referrer-Policy,
   Permissions-Policy) ?
6. **A06 Vulnerable Components** : pnpm audit clean ? (overlap AGENT 1)
7. **A07 Identification/Auth Failures** : magic-link Booking X.15 ?
   JWT revocation list ? session timeout ?
8. **A08 Software/Data Integrity** : audit_log hash-chain ? webhook
   Stripe signature verify ?
9. **A09 Logging/Monitoring Failures** : Sentry actif ? Telegram alertes
   16+ ? Audit log immutable ?
10. **A10 Server-Side Request Forgery** : Unsplash fetch + IndexNow ping
    + Google Indexing : URLs validées ?

Vérifier headers prod live via curl :
- `curl -I https://axion-ia.com/` → tous headers OWASP présents ?
- `curl -I https://axion-ia.com/api/health` → CORS strict ?
- Turnstile actif sur form sensibles (booking, contact, GDPR export) ?

Gate : tout OWASP non couvert = ROUGE (catégorie spécifique).

═══ AGENT 13 — AEO/GEO vs RGPD vs Sécurité ═══════════════════════════ /60

- llms.txt : ne fuit pas URLs admin / API / data PII ?
- ai.txt : politique training cohérente avec privacy policy ?
- Structured data JSON-LD : ne fuit pas PII (author email, address) ?
- Speakable XPath : ne pointe pas sur contenu user-generated non modéré ?
- Sitemap : ne liste pas /admin/*, /api/*, /mes-donnees/* ?
- Open Graph + Twitter Cards : metadata ne fuit pas data PII ?
- Canonical : 100 % URLs ont canonical absolue (pas relative) ?
- hreflang FR/EN : pas de boucles, x-default présent ?

Gate : sitemap leak admin URL = 🚨 CRITIQUE.
Gate : Canonical incorrect > 5 % = ROUGE.

═══ AGENT 14 — Migration vs régression vs ops ════════════════════════ /60

- Toutes migrations Prisma livrées sprints 1-24 appliquées prod (cf.
  mémoire signale gaps) ?
- Si migration appliquée : data V1 intacte ?
- Si migration NON appliquée : code suppose-t-il la nouvelle col / table ?
  (sinon 500 prod silencieux)
- Workers BullMQ : tous démarrés sur prod ? PID actifs ?
- Cron jobs : retention-purge + factory-tier-1 + sitemap-rebuild +
  IndexNow-batch tous schedulés ?
- Rollback plan documenté pour CHAQUE migration récente ?

Gate : migration appliquée + code suppose pas la col = ROUGE.
Gate : worker BullMQ down = ROUGE.

═══ AGENT 15 — Compliance multi-language + accessibility ═════════════ /60

- FR + EN parité : toutes pages traduites ? hreflang valide ?
- WCAG 2.2 AA :
  - Contraste 4.5:1 minimum text
  - Focus visible keyboard
  - Alt text 100 % images
  - aria-labels boutons icon-only
  - skip-link "Aller au contenu" présent ?
  - Landmark roles (main, nav, footer, header)
- Lighthouse Accessibility score ≥ 95 sur 20 URLs sample ?
- axe-core CI guard actif ?
- Manon persona disclosure cohérente sur FR + EN ?

Gate : Lighthouse a11y < 90 sur > 20 % URLs = ROUGE.
Gate : alt text manquant sur > 10 % images = ROUGE.

╔═══════════════════════════════════════════════════════════════════════╗
║                  PHASE 3 — SMOKE PROD LIVE END-TO-END (1 agent)       ║
╚═══════════════════════════════════════════════════════════════════════╝

═══ AGENT 16 — 12 user-journeys end-to-end (read-only sur prod) ═════ /120

**Read-only veut dire** : GET seul. Aucun POST mutant. Si formulaire
testable uniquement en POST → noter "non-testable read-only, à valider
manuellement Will".

**Journey 1 — Découverte SEO :**
Googlebot fetche `/actualites/[slug-récent]` → vérifier 200 + JSON-LD
Article + Speakable (si applicable) + canonical absolue + image OG +
TTFB < 600ms + JSON-LD Rich Results Test API pass

**Journey 2 — Découverte AEO Perplexity :**
PerplexityBot fetche `/connaissances/[slug]` → vérifier 200 + TL;DR top
50-80 mots + H2 questions + bullet points + dateModified < 90j + Article
JSON-LD

**Journey 3 — Découverte pSEO ville :**
Visiteur tape "audit IA Lyon" → Googlebot crawl 24h plus tard arrive sur
`/fr/implantations/auvergne-rhone-alpes/lyon` → 200 + LocalBusiness JSON-LD
+ areasServed + ville-specific copy ≥ 40 % unique (HCU 2024 bouclier) +
canonical correcte

**Journey 4 — Booking happy path (read-only fenêtre) :**
GET /reserver → vérifier 200 + Web Vitals OK + Turnstile widget chargé +
form fields présents + Stripe Element side-loaded (mode lazy)
(POST submit → non-testable read-only)

**Journey 5 — Booking flow Approfondie 3 tiers :**
GET /interventions/collectives → tier selector visible Essentielle (490/790/
1190) + Approfondie 2j (880/1420/2140 — fixed) + IA Custom (8-50k)

**Journey 6 — Article factory récent :**
Récupérer le plus récent article publié par factory (DB query read-only
via API admin si dispo, sinon scrape liste /actualites) → ouvrir + lire :
- title cohérent
- TL;DR présent
- corps ≥ 800 mots
- 3+ H2 questions
- 1+ image AVIF/WebP avec alt text
- author = Manon (avec disclosure IA persona AI Act)
- dateModified ISO 8601
- canonical absolue
- JSON-LD Article + Person + Organization
- Pas de placeholder "TODO" ou "[INSERT]"

**Journey 7 — KB V4 publique :**
GET /connaissances → liste articles + filtres + pagination + KB V4
publish status correct + each item link OK

**Journey 8 — RGPD self-service :**
GET /mes-donnees → page existe + /mes-donnees/export 200 (mémoire dit OK)
+ /mes-donnees/erase form présent (action humaine pour POST test)

**Journey 9 — Sitemap découverte :**
GET /sitemap.xml → sitemap index → fetch chaque sous-sitemap → vérifier
< 50 000 URLs, < 50 MB, lastmod cohérents, hreflang FR/EN si bilingue

**Journey 10 — robots.txt + llms.txt + ai.txt :**
GET les 3 → vérifier directives :
- robots.txt : Sitemap directive + bots IA search-time Allow
- llms.txt : présent ? format Jeremy Howard ?
- ai.txt : présent ? policy training claire ?

**Journey 11 — Admin (auth requise — read-only check seulement) :**
GET /admin → vérifier redirect login si non-auth + auth flow visible
(magic-link Booking X.15)

**Journey 12 — Erreurs prod 404 / 500 :**
GET 20 URLs improbables (random slugs articles, random villes invalides,
random IDs) → vérifier 404 propre + page custom 404 avec brand + lien
recovery
GET 1 URL valide 100 fois en parallèle → aucune 5xx ?

Pour CHAQUE journey :
- HTTP status final
- TTFB + LCP estimé
- Cohérence sémantique du contenu
- Pas d'erreur console JS
- Pas de placeholder oublié
- Pas de credential fuite
- Pas de PII leak

Gate : ≥ 2 journeys cassés = ROUGE.
Gate : ≥ 1 journey avec PII leak = 🚨 CRITIQUE.

╔═══════════════════════════════════════════════════════════════════════╗
║                  PHASE 4 — QUALITÉ + DETTE TECHNIQUE (3 agents //)    ║
╚═══════════════════════════════════════════════════════════════════════╝

═══ AGENT 17 — Tests coverage + type safety + lint ═══════════════════ /60

- pnpm test count : 818 tests verts (mémoire tag v1.0.3) ?
- Couverture % par module (Stripe / RGPD / factory / KB / pSEO) ?
- pnpm typecheck strict : 0 errors ?
- pnpm lint : 0 errors ? warnings count acceptable ?
- E2E tests (Playwright si présent) : passent ?
- Visual regression (Percy / Chromatic si présent) : passent ?
- Sentry release tracking : version tag déployé ?
- CI/CD GitHub Actions : tous workflows verts sur main ?

Gate : tests < 95 % verts = ROUGE.
Gate : typecheck error > 0 = ROUGE.

═══ AGENT 18 — Dead code + unused deps + documentation drift ═════════ /50

- knip ou depcheck : packages unused ?
- Fichiers .ts orphelins (aucun import) ?
- Components unused (aucun usage JSX) ?
- ENV vars in code mais pas dans .env.example ou Coolify ?
- ENV vars dans Coolify mais jamais utilisés ?
- TODO / FIXME / @ts-ignore count par module ?
- Documentation drift : README + docs/* mentionnent features absentes
  du code ? Vice-versa ?
- ADRs : tous décisions importantes consignées ?

Gate : > 50 TODO / FIXME = ORANGE.
Gate : ENV var critique manquant Coolify = ROUGE.

═══ AGENT 19 — Monitoring + alerting + observability ═════════════════ /70

- 16+ alertes Telegram (§ 12.3bis master prompt) : toutes câblées ?
- Telegram channel test ping read-only : last alert quand ?
- Sentry errors last 7j : count + résolu / non-résolu ?
- Plausible dashboard : trafic mesuré ?
- Microsoft Clarity : heatmaps actives ?
- Lighthouse CI : run schedulé sur PR ?
- Web Vitals dashboard admin : `/admin/web-vitals` accessible (Sprint 16) ?
- Cost monitoring : factory coût IA estimé < budget ?
- Cost alerts : Telegram ping si dépassement seuil ?
- Logs Coolify : niveau INFO retention 30j ?
- Postgres slow query log activé ?
- Redis memory usage ?
- Disk usage Hetzner 320GB : % occupé ?

Gate : alerte Telegram critique cassée = ROUGE.
Gate : disque > 80 % = ROUGE.

╔═══════════════════════════════════════════════════════════════════════╗
║                  PHASE 5 — LEGAL + AI ACT EU 2026 (2 agents //)       ║
╚═══════════════════════════════════════════════════════════════════════╝

═══ AGENT 20 — AI Act EU 2026 obligations ════════════════════════════ /80

AI Act EU 2026 entré en vigueur août 2024, applicable progressivement
2025-2027. Obligations factory IA + chatbot + persona Manon :

- **Article 50 — Transparency obligations for AI systems** :
  - Manon persona disclosed clairement (FAQ Q13 mémoire confirme option 4
    portrait IA disclosed)
  - Tout contenu généré par IA marqué (factory articles disclosure)
  - "Generated by AI" footer ou banner sur articles factory
- **Article 52 — High-risk AI systems** : Axion-IA factory = pas high-risk
  (génération marketing), mais classification documentée ?
- **Article 53 — General-purpose AI models** : usage GPT-4o + Claude
  Sonnet 4.6 documenté + provider liste publique
- **Article 26 — Fundamental rights impact assessment** : si applicable
- Politique transparence factory : `/transparence` ou `/manon` page existe ?
- Watermarking IA-generated images (GPT-image-1 V2) : metadata `Generator`
  EXIF ou `<meta>` ?
- Fact-check V2 audit_log immutable hash-chain (mémoire confirme) ?
- Plagiarism check actif avant publication ?
- Intent validator actif (tag v1.0.3 commit) ?

Gate : Manon disclosure absente sur > 10 % articles factory = ROUGE.
Gate : factory publie SANS plagiarism + intent + fact-check actifs = ROUGE.

═══ AGENT 21 — RGPD avancé + contractuel ═════════════════════════════ /60

- DPO email actif : dpo@axion-ia.com (Zoho Mail mémoire 05-13) ?
- Registre des traitements interne accessible ?
- DPA Hetzner papier signé (action Will pending) ?
- DPA Cloudflare online signé ?
- DPA Stripe (DPA standard fourni Stripe) ?
- DPA Coolify (self-hosted, n/a) ?
- DPA Zoho Mail (DPA standard) ?
- DPA Sentry (DPA standard) ?
- DPA Plausible (UE-hosted, EU DPA) ?
- DPA Microsoft Clarity (transfert hors-UE → SCC requise) ?
- Mentions légales : OÜ estonienne (mémoire) info à jour ?
- TVA : régime EE applicable (mémoire dit architecture TVA-agnostique) ?
- Conditions générales : à jour avec Booking V1 + deposit-gated + refunds ?
- Sous-processeurs page : auto-rebuild post-ajout provider ?

Gate : DPA critique non signé = ORANGE (action Will).
Gate : Microsoft Clarity sans SCC = ROUGE.

╔═══════════════════════════════════════════════════════════════════════╗
║                  PHASE 6 — VERDICT CERTIFICATION ABSOLUE (1 agent)    ║
╚═══════════════════════════════════════════════════════════════════════╝

═══ AGENT 22 — Synthèse + verdict + roadmap ══════════════════════════ /60

**22.1 — Scoring global pondéré**
Sommer les scores des 21 agents précédents → score total /1500.

**22.2 — Verdict**
- ≥ 1350 (90 %) : 🟢 **CERTIFICATION ABSOLUE GO PROD** — activer factory
  100/jour SANS surveillance rapprochée. Auto-pilot autorisé.
- 1200-1349 (80-89 %) : 🟡 **GO CONDITIONAL** — activation factory OK
  avec surveillance rapprochée 7j + P0 fixés < 48h
- 900-1199 (60-79 %) : 🟠 **NO-GO transitoire** — sprint correctif
  obligatoire 5-15 j avant activation factory
- < 900 (60 %) : 🔴 **NO-GO bloquant** — refactor majeur, ne PAS activer
  factory, ne PAS push V2 supplémentaire jusqu'à clean

**22.3 — TOP 30 actions priorisées**
Compilation des findings P0 et P1 de tous les agents :
- P0 critiques (bloquants) : doivent être fixés AVANT activation factory
- P1 importants (< 1 semaine) : fixés en sprint correctif court
- P2 nice-to-have (< 1 mois) : backlog
- P3 (long terme) : ROADMAP

Chaque action :
- ID
- Titre
- Audit source
- Criticité
- Effort estimé (jours)
- Gain attendu
- Fichiers touchés (paths)
- Test acceptance (gate qui passe au vert)

**22.4 — Conditions formelles d'activation factory 100/jour**
Liste obligatoire à cocher (auto-générée depuis findings + backlog 0.5) :

**Backlog actions humaines (cf. `_AUDIT/BACKLOG-ACTIONS-HUMAINES-2026-05-15.md`) :**
- [ ] **P0-1** : Migration SQL prod appliquée (`\dt content_gen_*` OK,
      `pgvector` actif, snapshot Hetzner pré-migration archivé)
- [ ] **P0-2** : 9 env vars Coolify renseignées
      (OPENAI/ANTHROPIC/PERPLEXITY/UNSPLASH/VOYAGE/KB_INGEST_SECRET/
       KB_AUTO_PUBLISH/INDEXNOW_KEY/GOOGLE_INDEXING_SA_JSON)
- [ ] **P0-3** : 5 DPA prioritaires signés (Hetzner papier + Cloudflare
      online + OpenAI + ZDR + Anthropic + Perplexity) + 3 additionnels
      (Unsplash + Voyage + Stripe) + `DPA-REGISTER` à jour
- [ ] **P0-4** : Tests vitest réparés (`pnpm test` 100 % vert),
      commits 3c5d4b0+ effectivement push sur main
- [ ] **P0-5** : DR drill R22 SSH exécuté + 7 secrets CI set +
      BACKUP_ENCRYPTION_PASSPHRASE archivée 1Password + papier
- [ ] **P1-5** : Web Vitals sampling client-side wiré +
      `/admin/web-vitals` dashboard accessible
- [ ] **P1-7** : `/api/gdpr-erasure` opérationnel + bouton "Supprimer mes
      données" visible `mes-donnees/page.tsx`
- [ ] **P1-8** : Audit visuel 3 articles Manon → disclaimer AI Act OK
- [ ] **P1-9 + P1-10** : Q11 sources RSS + Q1 budgets confirmés

**Code-side (preuve commit SHA) :**
- [ ] Tous P0 audits sectoriels fermés avec re-test green
- [ ] Kill-switch factory testé en réel (drill 1 fois min)
- [ ] Backup Postgres restore testé en réel (drill 1 fois min)
- [ ] Web Vitals p75 CrUX vert sur top 20 URLs (CrUX API confirme)
- [ ] llms.txt + ai.txt déployés (curl 200)
- [ ] Audit_log hash-chain vérifié (script intégrité)
- [ ] PII redaction Telegram active 100 % (14 sites patchés ADR 0010)
- [ ] Manon persona disclosure 100 % articles factory
- [ ] Cost cap cascade testé (mock dépassement → kill-switch trigger)
- [ ] Plagiarism + intent + fact-check actifs (tag v1.0.3 wirés)
- [ ] Sentry release tracking OK (last release = git HEAD)
- [ ] Cron retention-purge schedulé + last-run récent

**22.5 — Roadmap post-certification**
- Sprint 25+ : suggestion ordre de priorité
- Monitoring 7j post-activation factory : seuils alertes
- Audit J+30 post-activation : refresh certification (audit allégé)

**22.6 — Sign-off**
Date + version git HEAD audité + score + verdict + 5 P0 critiques + qui
doit signer Will pour activation.

╔═══════════════════════════════════════════════════════════════════════╗
║                  LIVRABLES (20 fichiers + 1 verdict)                  ║
╚═══════════════════════════════════════════════════════════════════════╝

Dossier : `_AUDIT/META-CERT-2026-XX-XX/`

| # | Fichier | Agent |
|---|---|---|
| 1 | `00-PRE-FLIGHT.md` | Agent 0 |
| 2 | `01-DEPS-V2.md` | Agent 1 |
| 3 | `02-REGRESSION-V1-V2.md` | Agent 2 |
| 4 | `03-RUNBOOKS-V2.md` | Agent 3 |
| 5 | `04-MIGRATION-V2.md` | Agent 4 |
| 6 | `05-RGPD-AI-ACT-V2.md` | Agent 5 |
| 7 | `06-DR-BACKUPS-V2.md` | Agent 6 |
| 8 | `07-PROD-READY-V2.md` | Agent 7 |
| 9 | `08-FLOWS-V2.md` | Agent 8 |
| 10 | `09-PASS-B-V2.md` | Agent 9 |
| 11 | `10-PERF-AEO-GEO-V2.md` | Agent 10 |
| 12 | `11-CROSS-PERF-RGPD-SEC.md` | Agent 11 |
| 13 | `12-OWASP-TOP-10-2026.md` | Agent 12 |
| 14 | `13-AEO-GEO-VS-RGPD.md` | Agent 13 |
| 15 | `14-MIGRATION-VS-REGRESSION.md` | Agent 14 |
| 16 | `15-A11Y-WCAG-MULTI-LANG.md` | Agent 15 |
| 17 | `16-SMOKE-PROD-LIVE.md` | Agent 16 |
| 18 | `17-TESTS-TYPECHECK.md` | Agent 17 |
| 19 | `18-DEAD-CODE-DEPS.md` | Agent 18 |
| 20 | `19-MONITORING-ALERTING.md` | Agent 19 |
| 21 | `20-AI-ACT-EU-2026.md` | Agent 20 |
| 22 | `21-RGPD-CONTRACTUEL.md` | Agent 21 |
| 23 | **`VERDICT-CERTIFICATION-FINALE.md`** | Agent 22 |
| 24 | `MANIFEST.md` (index 20 livrables + scoring résumé) | — |

╔═══════════════════════════════════════════════════════════════════════╗
║                  SCORING GLOBAL /1500                                 ║
╚═══════════════════════════════════════════════════════════════════════╝

- AGENT 0 Pre-flight : /80
- AGENT 1 Deps v2 : /60
- AGENT 2 Régression v2 : /60
- AGENT 3 Runbooks v2 : /50
- AGENT 4 Migration v2 : /60
- AGENT 5 RGPD + AI Act v2 : /80
- AGENT 6 DR + Backups v2 : /60
- AGENT 7 Prod-Ready v2 : /80
- AGENT 8 Flows v2 : /80
- AGENT 9 Pass B v2 : /60
- AGENT 10 PERF + AEO/GEO v2 : /90
- AGENT 11 Cross perf/RGPD/sec : /70
- AGENT 12 OWASP top 10 2026 : /90
- AGENT 13 AEO/GEO vs RGPD : /60
- AGENT 14 Migration vs régression : /60
- AGENT 15 A11Y + multi-language : /60
- AGENT 16 Smoke prod live : /120
- AGENT 17 Tests + typecheck : /60
- AGENT 18 Dead code + deps : /50
- AGENT 19 Monitoring + alerting : /70
- AGENT 20 AI Act EU 2026 : /80
- AGENT 21 RGPD contractuel : /60
- AGENT 22 Verdict + roadmap : /60

**Total : /1500**

**Seuils verdict :**
- ≥ 1350 (90 %) : 🟢 CERTIFICATION ABSOLUE GO PROD
- 1200-1349 (80-89 %) : 🟡 GO CONDITIONAL surveillance 7j
- 900-1199 (60-79 %) : 🟠 NO-GO transitoire sprint correctif 5-15j
- < 900 (60 %) : 🔴 NO-GO bloquant refactor majeur

╔═══════════════════════════════════════════════════════════════════════╗
║                  CONTRAINTES INTOUCHABLES                             ║
╚═══════════════════════════════════════════════════════════════════════╝

- Stack Hetzner CPX42 + Coolify + CF Free (budget zéro additionnel)
- Tailwind + Next 16 + standalone output
- Direction visuelle commitée HEAD 941a8e1+ (terracotta header)
- Naming "Axion-IA" partout
- AI Act EU 2026 : Manon persona disclosure obligatoire
- AUDIT-ONLY STRICT : zéro code, zéro commit, zéro mutation prod

╔═══════════════════════════════════════════════════════════════════════╗
║                  ANTI-PATTERNS À ÉVITER                               ║
╚═══════════════════════════════════════════════════════════════════════╝

❌ Re-faire les 10 audits sectoriels de zéro (80+ h gaspillage)
❌ Auditer sans confronter aux rapports précédents (zéro valeur ajoutée)
❌ Faire confiance aveugle aux rapports précédents (rôle = challenger)
❌ Smoke prod en mode mutation (RGPD risk + casser data Will)
❌ Activer factory 100/jour sans score ≥ 1350 (risque réputationnel)
❌ Verdict GO sans preuve commit SHA des fixes
❌ Skip OWASP / AI Act / WCAG car "déjà audité" (compliance évolue)
❌ Ignorer les zones non-couvertes par les 10 audits précédents
❌ Rapport sans top 30 actions priorisées exploitables

╔═══════════════════════════════════════════════════════════════════════╗
║                  HEURISTIQUES META-AUDIT                              ║
╚═══════════════════════════════════════════════════════════════════════╝

- Méta-audit = challenger des audits sectoriels, pas leur duplicate
- Preuve > affirmation (commit SHA, mesure live, capture HTTP)
- Cross-domain est où les bugs vivent (fix perf casse RGPD, etc.)
- Smoke prod live = source de vérité ultime
- AI Act EU 2026 + WCAG 2.2 = compliance qui évolue, re-vérifier
- Activation factory 100/jour = bascule risque : doit être méritée
- Verdict CONDITIONAL = piège (on diffère P0 et on oublie). Préférer
  NO-GO transitoire + sprint correctif strict si doute.
- 30-45h dev est l'investissement minimum pour atteindre vraie
  perfection. Ne pas rusher.
```

---

## Phrase d'invocation (à coller dans nouvelle session fraîche dédiée)

> Lance l'audit `_AUDIT/PROMPT-CONTENT-GEN-META-CERTIFICATION-FINALE-2026.md` en mode AUDIT-ONLY STRICT ABSOLU. Méta-certification post-fixes des 10 audits sectoriels précédents + V1+V2 + Sprints 13-24 + KB V4 + pSEO villes + Booking V1 + Cloudflare Phase 5 + Stabilisation prod. 22 agents répartis en 6 phases (Pre-flight + Re-audit profondeur 10 axes + Cross-domain 5 axes + Smoke prod live + Qualité 3 axes + Legal AI Act 2 axes + Verdict). Scoring /1500. Cible ≥ 1350 (90 %) pour 🟢 CERTIFICATION ABSOLUE GO PROD activation factory 100/jour. Produis 24 livrables dans `_AUDIT/META-CERT-2026-05-XX/` incluant VERDICT-CERTIFICATION-FINALE.md + MANIFEST.md. Challenge les 10 rapports précédents avec preuves commit SHA + mesures live + captures HTTP. Aucun fix, aucun commit, aucune mutation prod, aucun appel API IA externe. Verdict avec TOP 30 actions priorisées P0-P3 + conditions formelles d'activation factory.
