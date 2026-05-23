# 🏛️ PROMPT PLATFORM E2E CERTIFICATION ABSOLUE 2026 — Axion-IA bout-en-bout

> **Audit master orchestrateur** : vérifie que **TOUTE LA PLATEFORME**
> Axion-IA (frontend + backend + content generator + KB V4 + pSEO villes
> + Booking V1 + image-bank + sitemaps + 2 langues FR/EN priorité FR +
> indexation Google/IA + DocuSeal + Stripe + GSC + Google Cloud + secrets
> + Coolify + Cloudflare + Hetzner + CI/CD) est **solide, bien organisée,
> parfaitement fonctionnelle et sans régression** prête pour activation
> commerciale grand-public.
>
> **Mode AUDIT-ONLY STRICT ABSOLU**. Aucune écriture code, aucun commit,
> aucune mutation prod, aucun appel API IA externe payant, aucun envoi
> d'email réel, aucun POST Stripe / DocuSeal / Telegram mutants.
>
> **Stratégie zéro duplication** : ce prompt **DÉLÈGUE** aux 3 prompts
> sectoriels existants (META-CERT content-gen + E2E-ROUTES-HEALTH +
> E2E-NAVIGATION-CTA) pour ne pas refaire 80+ h d'audit déjà spécifiés.
> Il **AJOUTE** 8 agents dédiés pour les **angles morts** non couverts
> par ces 3 prompts.
>
> Production : **dossier `_AUDIT/PLATFORM-E2E-CERT-2026-XX-XX/`** avec
> ~14 livrables `.md` + 1 `VERDICT-PLATFORM-FINAL.md` + 1 `MANIFEST.md`
> + 1 `EXEC-SUMMARY-WILL.md` (top 30 actions priorisées P0→P3).
>
> Score cible global : **≥ 2700 / 3000 (90 %)** pour 🟢 **CERTIFICATION
> PLATEFORME ABSOLUE** = activation commerciale full grand-public OK.
>
> Durée estimée : **40-60 h** dev en mode autopilot lecture-seule
> (orchestration + 8 nouveaux agents + smoke cross-cutting + synthèse).
> Doit être lancé dans **1 session fraîche dédiée** (contexte propre).

---

```
Skill : axionia-content-generator (mode 🔒 PLATFORM E2E CERTIFICATION ABSOLUE 2026)

Tu es l'auditeur tiers indépendant chargé de la **certification absolue
plateforme Axion-IA bout-en-bout** post-fixes session 2026-05-15. Will
demande explicitement : « est-ce que TOUT est OK en prod ? le code n'est-il
pas devenu un bazar fragile ? est-ce que rien ne risque de régresser ? »

CONTEXTE OPÉRATIONNEL EXHAUSTIF :
- Domaine prod : https://axion-ia.com (Cloudflare Free Phase 5 9/11 OK)
- Origin : Hetzner CPX42 178.105.55.15 Nuremberg (rescale 2026-05-14)
- Coolify 4.0.0 + Caddy 2 + Next 16 standalone + Postgres + Redis + BullMQ
- Stripe LIVE V1 (Booking V1 mergé), DocuSeal pending verifyWebhookSignature
  v2.x parser (TODO), Telegram alerts ON (16+ channels)
- Email : Zoho Mail Free EU (contact@axion-ia.com + dpo@axion-ia.com)
- 8 jalons M1-M8 livrés + Sprints 15-24.1 + KB V4 + Content-Gen V1.0.3
  (tag v1.0.3-content-gen 2026-05-14)
- Admin scopé sous `/<locale>/<ADMIN_URL_PREFIX>/*` (prefix random 32 chars)
- Bilingue : FR canonical (priorité business — francophones uniquement
  pour le moment) + EN miroir via segment `[locale]`
- Naming officiel : « Axion-IA » partout (projet + marque)
- pSEO villes : 12 942 routes SSG (industrialisation 2280 villes différée
  pour perfection templates d'abord — décision Will 2026-05-12)
- Image-bank skill v1.1 prêt mais pages publiques `/galerie/*` PAS encore
  déployées (cf. mémoire `axionia_image_bank_skill_v1_1_2026-05-15.md`)
- Tag git le plus récent : `v1.0.3-content-gen`. HEAD main potentiellement
  en avance sur tag (vérifier `git log v1.0.3-content-gen..HEAD --oneline`)

3 PROMPTS SECTORIELS DÉJÀ SPÉCIFIÉS (DÉLÉGUER, NE PAS REFAIRE) :
1. `_AUDIT/PROMPT-CONTENT-GEN-META-CERTIFICATION-FINALE-2026.md`
   → 22 agents × 6 phases × scoring /1500. Couvre content generator,
     RGPD/AI Act, OWASP, Web Vitals, runbooks, DR/backups, flows ops,
     tests + typecheck, monitoring/alerting.
2. `_AUDIT/PROMPT-E2E-ROUTES-HEALTH-2026.md`
   → ~10 agents × scoring /1000. Couvre les ~320 routes (publiques×2
     locales + dynamiques + 101 admin + API + sitemaps + image-bank +
     catchall) en HTTP smoke.
3. `_AUDIT/PROMPT-E2E-NAVIGATION-CTA-PERFECTION-2026.md`
   → ~10 agents × scoring /1000. Couvre crawl graph BFS depth 6 +
     orphans + dead-ends + click depth + headers + footer + breadcrumbs +
     CTAs cohérence pricing.ts SSOT + 10 funnels conversion + locale
     switcher + Pagefind + mobile drawer WCAG + cross-cuttings.

⚠️ ATTENTION CRITIQUE : ces 3 prompts couvrent ~70 % de la demande Will.
Les 30 % manquants sont les **8 angles morts** ci-dessous, qui doivent être
audités par CE prompt master en complément. Sans ces 8 audits, la
certification plateforme est INCOMPLÈTE même si les 3 prompts sectoriels
passent au vert.

⛔ MODE AUDIT-ONLY STRICT ABSOLU :
- Aucune édition code, aucun commit, aucun push, aucun migrate, aucun seed
- Aucun appel API IA externe payant (OpenAI / Anthropic / Voyage / Perplexity)
- Aucun POST mutant sur prod (Stripe / DocuSeal / GSC / Telegram canaux
  publics / Coolify deploy / migrations)
- curl / Lighthouse / WebPageTest / PSI API / CrUX API / Rich Results
  Test API / Coolify API list (read) / GSC search-analytics API en
  LECTURE-SEULE uniquement
- pnpm typecheck / test / lint en read-only OK
- git log / git diff / git show / git blame en read-only OK
- prisma migrate diff en read-only OK (jamais `migrate deploy`)
- depcheck / knip / madge en read-only OK
- Si bug détecté → noter avec preuve, NE PAS fix
- Livrables : 14 .md + verdict + manifest + exec-summary

╔═══════════════════════════════════════════════════════════════════════╗
║         LECTURE OBLIGATOIRE (référentiels prerequis)                  ║
╚═══════════════════════════════════════════════════════════════════════╝

**Master prompts platform :**
1. `axionia-megapack-skills/.claude/skills/axionia-content-generator/SKILL.md` (master v2.5)
2. `_AUDIT/PROMPT-CONTENT-FACTORY-SPEC.md`
3. `_AUDIT/PROMPT-CONTENT-GEN-META-CERTIFICATION-FINALE-2026.md`
4. `_AUDIT/PROMPT-E2E-ROUTES-HEALTH-2026.md`
5. `_AUDIT/PROMPT-E2E-NAVIGATION-CTA-PERFECTION-2026.md`
6. `_AUDIT/PROMPT-PRE-IMPLEMENTATION-VERIFICATION-2026.md`

**Backlog actions humaines (SSOT TODOs accumulés) :**
7. `_AUDIT/BACKLOG-ACTIONS-HUMAINES-2026-05-15.md` (si présent)
8. `_AUDIT/CHANGELOG-V1-BOOKING.md`
9. `_AUDIT/CONTENT-GEN-V1-AUTOPILOT-LOG.md`

**Documentation technique platform :**
10. `axionia/CLAUDE.md` (instructions globales repo)
11. `axionia/README.md`
12. `docs/ADR/*` (toutes décisions architecturales — ADR 0001 à 0011+)
13. `docs/runbooks/*` (procédures incident)
14. `docs/content-gen/*` (KB V4 + factory)
15. `prisma/schema.prisma` (état complet schéma DB)
16. `prisma/migrations/*` (toutes migrations livrées)
17. `axionia/.github/workflows/*` (CI/CD)
18. `axionia/next.config.*`
19. `axionia/middleware.ts`
20. `axionia/Dockerfile`
21. `axionia/Dockerfile.worker`
22. `axionia/package.json` + `pnpm-lock.yaml`
23. `axionia/.env.example`

**Code stack complet (read-only) :**
24. `axionia/src/app/**/*` (~320 routes)
25. `axionia/src/lib/**/*` (helpers)
26. `axionia/src/server/**/*` (Server Actions)
27. `axionia/src/components/**/*` (composants)
28. `axionia/src/workers/**/*` (BullMQ workers)
29. `axionia/src/jobs/**/*` (cron jobs)
30. `axionia/src/content/**/*` (SSOT pricing.ts, taxonomies, copy)

**Mémoire conversationnelle (33+ entries cf. MEMORY.md user) :**
31. Toutes entries `axionia_*` du fichier MEMORY.md user
    (en particulier : axionia_naming_brand_vs_project, axionia_pricing_*,
    axionia_session_*, axionia_infra_*, axionia_will_decisions_*)

╔═══════════════════════════════════════════════════════════════════════╗
║         PHASE 0 — PRE-FLIGHT ORCHESTRATION (1 agent)                  ║
╚═══════════════════════════════════════════════════════════════════════╝

═══ AGENT 0 — Reality check + orchestration des 3 délégations ═══════ /100

**0.1 — Snapshot état git + tags + branches**
- `git rev-parse HEAD` → SHA actuel
- `git log --oneline v1.0.3-content-gen..HEAD` → commits depuis dernier tag
- `git status --short` → modifs en cours (si ≠ vide = ⚠️ working tree dirty
  = audit non reproductible, flagger ROUGE)
- `git branch --show-current` → main attendu
- `git log --oneline -20` → 20 derniers commits
- `git diff --stat origin/main..HEAD` → commits locaux non pushés
- `git stash list` → stashes oubliés ?

**0.2 — Inventaire global plateforme**
Compter en automatique (commandes read-only) :
- Routes app/ : `find axionia/src/app -name 'page.tsx' -o -name 'route.ts' | wc -l`
- Server Actions : `grep -rn '^use server' axionia/src/server | wc -l`
- Components : `find axionia/src/components -name '*.tsx' | wc -l`
- Workers : `find axionia/src/workers -name '*.ts' | wc -l`
- Cron jobs : `find axionia/src/jobs -name '*.ts' | wc -l`
- Migrations Prisma : `ls prisma/migrations/ | wc -l`
- Tables Prisma : `grep -c '^model ' prisma/schema.prisma`
- Tests fichiers : `find axionia -name '*.test.ts' -o -name '*.spec.ts' | wc -l`
- ADRs : `ls docs/ADR/ | wc -l`
- Runbooks : `ls docs/runbooks/ 2>/dev/null | wc -l`
- Sitemaps : `find axionia/src/app -name 'sitemap*.ts' | wc -l`

Livrable : tableau inventaire 12 lignes × 3 colonnes (Item / Count / Cible 2026).

**0.3 — Status de la prod live (smoke ultra-light read-only)**
- `curl -sI https://axion-ia.com/` → HTTP code + headers OWASP
- `curl -sI https://axion-ia.com/sitemap.xml` → 200 attendu
- `curl -sI https://axion-ia.com/robots.txt` → 200 attendu
- `curl -sI https://axion-ia.com/llms.txt` → 200 ou 404 (flag si 404)
- `curl -sI https://axion-ia.com/.well-known/security.txt` → 200 ou 404
- `curl -sI https://axion-ia.com/api/health` → 200 attendu
- `curl -sI https://axion-ia.com/fr/` → 200 attendu
- `curl -sI https://axion-ia.com/en/` → 200 attendu
- DNS check : `dig axion-ia.com` → IP Cloudflare attendue
- TLS : `openssl s_client -connect axion-ia.com:443 -servername axion-ia.com`
  → cert valide, chain OK, TLS 1.3 préféré

Livrable : status 9 endpoints + DNS + TLS.

**0.4 — Déclenchement des 3 délégations sectorielles**
Annoncer dans le rapport :
- ✅ DÉLÉGUÉ Agent META-CERT (22 sub-agents) → produit
  `_AUDIT/META-CERT-2026-XX-XX/` (24 livrables)
- ✅ DÉLÉGUÉ Agent E2E-ROUTES-HEALTH (~10 sub-agents) → produit
  `_AUDIT/E2E-ROUTES-2026-XX-XX/` (11 livrables)
- ✅ DÉLÉGUÉ Agent E2E-NAVIGATION-CTA (~10 sub-agents) → produit
  `_AUDIT/E2E-NAV-CTA-2026-XX-XX/` (~12 livrables)

Note : ces 3 délégations doivent être lancées EN PARALLÈLE via Task tool
(3 sub-agents concurrents indépendants) pour économiser temps. Chacun est
self-contained (autorisé à passer en lecture-seule sur tout le repo).

**Si déjà exécutés récemment (< 7 jours) :** lire les rapports existants
au lieu de relancer (gain ~50h). Vérifier :
- Date de dernier rapport `_AUDIT/META-CERT-2026-*-*/VERDICT-CERTIFICATION-FINALE.md`
- Date de dernier rapport `_AUDIT/E2E-ROUTES-2026-*-*/VERDICT.md`
- Date de dernier rapport `_AUDIT/E2E-NAV-CTA-2026-*-*/VERDICT.md`

Si présents et < 7 jours → consommer leurs verdicts pour Phase 3 synthèse.
Sinon → relancer les 3 en parallèle.

**0.5 — Backlog actions humaines + P0/P1 techniques en suspens**
Si `_AUDIT/BACKLOG-ACTIONS-HUMAINES-2026-05-15.md` présent : lire et
extraire la liste P0/P1/P2 ouverts.
Sinon : reconstituer depuis mémoire + commits + audits récents.

Livrable Agent 0 : `_AUDIT/PLATFORM-E2E-CERT-2026-XX-XX/00-PRE-FLIGHT.md`
contenant :
- Snapshot git
- Inventaire global 12 lignes
- Status prod 9 endpoints + DNS + TLS
- Confirmation 3 délégations lancées (ou rapports consommés)
- Backlog actions humaines actuel (P0/P1/P2)

╔═══════════════════════════════════════════════════════════════════════╗
║   PHASE 1 — 8 AGENTS DÉDIÉS ANGLES MORTS (parallèle)                  ║
╚═══════════════════════════════════════════════════════════════════════╝

═══ AGENT 1 — Code organization & architecture ════════════════════════ /150

**1.1 — Structure folders & separation of concerns**
- Lister la structure top-level `axionia/src/` : doit refléter Next 16 App
  Router + clear separation (app / lib / server / components / workers /
  jobs / content)
- Aucun fichier > 500 lignes dans `src/lib` ou `src/server` (smell god-file) ?
- Aucun dossier > 30 fichiers (smell unstructured) ?
- Pas de cycles d'imports (utiliser `madge --circular axionia/src/`) ?
- `src/components/` organisé par feature (admin/, content-gen/, booking/,
  image-bank/, marketing/, ui/) — pas tout en flat list ?
- `src/server/` Server Actions groupées par domaine ?

**1.2 — Cohérence naming & conventions**
- Naming "Axion-IA" partout (jamais axionia, axion ia, AxionIA dans copy
  user-facing) → `grep -rn 'axionia\|AxionIA\|Axion IA' axionia/src/app
  axionia/src/components` (sauf identifiers JS camelcase OK)
- Naming de fichiers cohérent : kebab-case fichiers / PascalCase
  components / camelCase helpers ?
- Imports : alias `@/` utilisés systématiquement (pas de `../../../`) ?
- Server Actions : suffixe `Action` ou `.action.ts` cohérent ?

**1.3 — Anti-patterns React 19 / Next 16**
- Aucun `"use client"` superflu (composant 100 % statique ne doit pas
  être client) ?
- Aucun `useState`/`useEffect` dans Server Component ?
- Server Actions toutes marquées `"use server"` au top ?
- Aucun `dangerouslySetInnerHTML` non sanitized ?
- Aucun `any` dans signatures publiques (Server Actions, helpers exportés) ?
- Aucun `@ts-ignore` ou `@ts-expect-error` non commenté avec reason ?

**1.4 — Dette technique mesurable**
- TODO / FIXME / HACK / XXX count par module
  (`grep -rn 'TODO\|FIXME\|HACK\|XXX' axionia/src | wc -l`)
- Comments `// TEMP` / `// REMOVE` / `// QUICK FIX` ?
- Imports non utilisés (`pnpm exec tsc --noEmit` warnings) ?
- Variables non utilisées (lint warnings) ?
- Components non utilisés (knip output) ?
- Files orphelins (aucun import vers eux) ?

**1.5 — Modularité & réutilisabilité**
- Helpers communs centralisés dans `src/lib/` (pas dupliqués) ?
- Schemas Zod centralisés dans `src/lib/schemas/` ou similar ?
- Constants (URLs, magic numbers, durées) centralisés ?
- Pas de hardcode (couleurs hex hors design tokens, prix hors pricing.ts,
  villes hors INSEE data, headings hors heading SSOT) — cf. mémoire
  `axionia_pricing_zero_hardcode_2026-05-08`

**1.6 — Documentation interne (commentaires utiles)**
- Server Actions complexes ont JSDoc (params + returns + side effects) ?
- Workers BullMQ ont commentaire intent + retry policy ?
- Schemas Prisma : commentaires sur tables critiques (Booking, Article,
  KbDocument, etc.) ?

**1.7 — Layered architecture cohérente**
- App Router (UI) → Server Actions (orchestration) → lib (logique métier
  pure) → Prisma (data) — flux clair ?
- Aucun import Prisma direct depuis App Router (toujours via Server
  Action) ?
- Aucun fetch Stripe/DocuSeal/OpenAI direct depuis composant ?

Gate /150 :
- 🟢 ≥ 135 : architecture saine, dette < 5 %, cohérence forte
- 🟡 105-134 : dette modérée, refactor mineur Sprint 25 OK
- 🟠 75-104 : dette critique, refactor majeur avant scale
- 🔴 < 75 : code base fragile, NO-GO commercial

Livrable : `01-CODE-ORGANIZATION-ARCHITECTURE.md`

═══ AGENT 2 — Secrets management & rotation ════════════════════════ /120

**2.1 — Inventaire des secrets**
Recenser TOUS les secrets utilisés par la plateforme :
- Database : `DATABASE_URL`, `REDIS_URL`, `REDIS_PASSWORD`
- Auth : `AUTH_SECRET`, `NEXTAUTH_SECRET` (Auth.js)
- IA providers : `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `PERPLEXITY_API_KEY`,
  `VOYAGE_API_KEY`, `UNSPLASH_ACCESS_KEY`
- Stripe : `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`,
  `STRIPE_WEBHOOK_SECRET`
- DocuSeal : `DOCUSEAL_API_KEY`, `DOCUSEAL_WEBHOOK_SECRET`
- Email : `ZOHO_SMTP_USER`, `ZOHO_SMTP_PASSWORD` (ou app password)
- Telegram : `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID_*`
- Google : `GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON`, `GSC_OAUTH_*`
- Cloudflare : `CLOUDFLARE_API_TOKEN` (si rotation auto)
- Hetzner : `HETZNER_API_TOKEN` (si rotation auto)
- Coolify : `COOLIFY_API_TOKEN`, `COOLIFY_APP_UUID`
- KB : `KB_INGEST_SECRET`, `KB_AUTO_PUBLISH`
- Backups : `BACKUP_ENCRYPTION_PASSPHRASE`, `BACKBLAZE_*` (si actif)
- IndexNow : `INDEXNOW_KEY`
- Sentry : `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`
- Plausible : `PLAUSIBLE_API_KEY` (si custom)
- Microsoft Clarity : `CLARITY_PROJECT_ID`
- IP redaction : `IP_HASH_SALT` (cf. ADR 0010)

**2.2 — Stockage des secrets**
- Présence dans `.env.example` (sans valeur, juste clé) — tous les secrets
  doivent être listés
- Absence dans le repo (`grep -rn 'sk-\|whsec_\|ghp_' axionia/src` = 0)
- Coolify env vars : confirmer présence via Coolify API (read-only list,
  ne pas afficher valeurs)
- 1Password / Bitwarden / vault : Will utilise quoi ? (cf. mémoire)
- `.secrets/api-tokens.env` racine repo : gitignored ?

**2.3 — Rotation policy**
- Quels secrets ont été rotés ces 90 jours ? Quels secrets n'ont jamais été
  rotés depuis création ?
- AUTH_SECRET roté après chaque dump prod ?
- Stripe webhook secret roté si fuite suspectée ?
- Telegram bot token roté si Telegram channel public access ?
- DocuSeal webhook secret (set 2026-05-15) — quand prochaine rotation ?
- Procédure de rotation documentée (runbook) pour chaque secret critique ?

**2.4 — Exposition risque**
- Logs Sentry / Coolify / Telegram : aucun secret leaké en clair
  (chercher patterns `sk-`, `whsec_`, `Bearer `, `password:` dans
  logs récents read-only) ?
- PII redaction Telegram active (cf. ADR 0010 + helper `pii-redaction.ts`) ?
- Secrets jamais commités historiquement (`git log --all -p | grep -i
  'AUTH_SECRET\|STRIPE_SECRET' | head` — ⚠️ commande lourde, à utiliser
  avec prudence) ?
- `.env` jamais commité (gitignored vérifié) ?
- Secrets dans Dockerfile / docker-compose / CI workflows (jamais en clair) ?

**2.5 — Accès humain**
- Qui a accès Coolify (Will + ?) ?
- Qui a accès Hetzner (Will only ?) ?
- Qui a accès Cloudflare (Will + futur DPO ?) ?
- Qui a accès Stripe Dashboard (Will + futur compta ?) ?
- Procédure offboarding (rotation immédiate si quitte) documentée ?

Gate /120 :
- 🟢 ≥ 108 : secrets bien gérés, rotation tracée, exposure 0
- 🟡 84-107 : secrets en place, rotation pas systématique
- 🟠 60-83 : exposure modérée ou rotation absente
- 🔴 < 60 : secrets en danger, NO-GO commercial

Livrable : `02-SECRETS-MANAGEMENT.md`

═══ AGENT 3 — CI/CD deployment chain ═════════════════════════════════ /120

**3.1 — GitHub Actions workflows**
- Lister `.github/workflows/*.yml`
- Pour chaque workflow : trigger (push/PR/schedule/manual) + jobs +
  durée moyenne 30 derniers runs
- Workflow `deploy-coolify.yml` actif (cf. mémoire
  `axionia_cicd_github_actions_coolify`) ?
- Workflow CI tests + typecheck + lint sur chaque PR ?
- Workflow Lighthouse CI (lighthouserc.json présent) ?
- Workflow Playwright E2E (si présent) ?
- Workflow scheduled : retention-purge cron, factory tier-1 cron,
  sitemap-rebuild ?

**3.2 — Pipeline deploy Coolify**
- Push main → trigger CI → trigger Coolify webhook OU GitHub Actions →
  Coolify deploy
- Webhook GitHub App vs GitHub Actions : qui est canonical actuellement ?
  (Mémoire dit GitHub Actions remplace webhook cassé)
- Secrets COOLIFY_API_TOKEN / COOLIFY_URL / COOLIFY_APP_UUID set GitHub
  Repository Secrets ?
- Build temps Coolify moyen ?
- Healthcheck post-deploy actif (cf. session 2026-05-08 first deploy
  TODO Healthcheck ON) ?

**3.3 — Rollback procédure**
- Bouton "rollback last deploy" Coolify accessible Will ?
- Procédure rollback documentée (runbook) ?
- Snapshots Hetzner pré-deploy automatiques ou manuels ?
- Tag git de chaque release prod ? (Sentry release tracking confirme ?)

**3.4 — Blue-green / canary / zero-downtime**
- Coolify supporte zero-downtime swap container ?
- Aucune fenêtre 503 pendant deploy (vérifier avec curl pendant deploy) ?
- Migrations Prisma backward-compat (pas breaking schema entre 2 versions
  app) ?

**3.5 — Build artifacts integrity**
- `pnpm-lock.yaml` jamais désynchronisé `package.json` ?
- Build local reproductible (pas de "ça marche chez moi") ?
- Build Docker reproductible (Dockerfile pinned versions) ?
- corepack pinned dans Dockerfile (cf. commit `e71ed43` mémoire) ?

**3.6 — Pre-commit / pre-push hooks**
- Husky / lefthook / pre-commit installé ?
- typecheck + lint + tests sur pre-commit ?
- Aucun bypass `--no-verify` toléré par convention équipe ?

Gate /120 :
- 🟢 ≥ 108 : CI/CD industrialisé, rollback testé, zero-downtime
- 🟡 84-107 : CI/CD opérationnel mais rollback non testé
- 🟠 60-83 : CI/CD partiel, dépend ops manuelles
- 🔴 < 60 : CI/CD fragile, NO-GO commercial

Livrable : `03-CICD-DEPLOYMENT-CHAIN.md`

═══ AGENT 4 — DocuSeal intégration ═════════════════════════════════════ /80

**4.1 — DocuSeal flow X.3 NDA Yousign equivalent**
- Code Server Action qui crée submission DocuSeal présent ?
- Webhook receiver `/api/webhooks/docuseal` (ou similar) implémenté ?
- Verifier signature webhook : helper `verifyWebhookSignature` parser
  v2.x format `<timestamp>.<sha256>` Stripe-like
  (cf. mémoire `axionia_docuseal_webhook_signature_todo` — TODO non
  bloquant V1, fallback Telegram) ?
- Templates DocuSeal référencés par ID dans code (env var ou config) ?
- Retry policy si DocuSeal down ?
- Audit log signature events (audit_log Sprint 17) ?

**4.2 — Booking V1 flow X.15 magic-link auth + X.3 NDA**
- Si Booking V1 mergé (mémoire 05-11 confirme push sur main 4ba60b9) :
  flow magic-link → DocuSeal trigger NDA → signature → callback webhook →
  MAJ Booking status — tout présent ?
- UI utilisateur : page "Signez votre NDA" présente ?
- Email transactionnel "Votre lien de signature" envoyé via Zoho Mail ?
- Fallback humain si DocuSeal down (Telegram alert + manual procedure) ?

**4.3 — Conformité juridique**
- DocuSeal sous-processeur listé /sous-processeurs FR + EN ?
- DPA DocuSeal signé (papier ou en ligne) ?
- Documents signés stockés où ? (DocuSeal cloud, S3 mirror, Postgres ?)
- Rétention juridique : 6 ans minimum (CGV France) ?
- Droit à l'oubli : procédure suppression document signé sur demande RGPD ?

Gate /80 :
- 🟢 ≥ 72 : DocuSeal opérationnel, signature webhook OK, conformité
- 🟡 56-71 : DocuSeal V1 fallback Telegram, signature parser TODO
- 🟠 40-55 : intégration partielle, risque flow
- 🔴 < 40 : intégration cassée ou absente

Livrable : `04-DOCUSEAL-INTEGRATION.md`

═══ AGENT 5 — GSC + Google Indexing API + Bing IndexNow ════════════ /100

**5.1 — Google Search Console (GSC)**
- Domaine vérifié GSC (cf. mémoire `axionia_session_2026-05-13` confirme
  vérif + sitemap soumis) ?
- Sitemap-index soumis et statut current (Indexed / Pending / Error) ?
- Coverage report : nombre URLs valid / excluded / error ?
- Crawl stats : erreurs 5xx récentes ?
- Mobile usability : aucune erreur ?
- Core Web Vitals : champ "Bons URLs" %  ?
- Ownership : comptes admin GSC = qui ?
- Worker GSC keyword sync (cf. mémoire `axionia_gsc_worker_pending`) :
  4 env vars Coolify pushées ? Code worker présent ?

**5.2 — Google Indexing API (JWT)**
- Service account Google Cloud créé ?
- Credentials JSON `GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON` set Coolify ?
- Helper `submitGoogleIndexing(url)` présent dans `src/lib/` ?
- Activé en prod ? (mémoire Sprint 24.1 P1-6 demande activation)
- Quota 200 URLs/jour respecté (rate limiter) ?
- Retry + exponential backoff + Telegram alert si throttle ?

**5.3 — Bing IndexNow**
- `INDEXNOW_KEY` set Coolify + fichier public `/[key].txt` accessible ?
- Helper `pingIndexNow(urls[])` centralisé (cf. mémoire 05-13 commit
  `b7cbfb4` corrige bug urls/urlList) ?
- Trigger automatique sur publish article (factory) + nouveau pSEO ville ?
- Quota IndexNow respecté (10K URLs/jour) ?
- Endpoints multi : Bing + Yandex + Naver + Seznam ?

**5.4 — Sitemaps**
- Sitemap-index splitting < 50K URLs / sitemap (cf. mémoire AEO/GEO 05-07
  acte split fait) ?
- sitemap-articles, sitemap-pseo-villes, sitemap-knowledge,
  sitemap-static, sitemap-images (image-bank pending) ?
- sitemap-news.xml dédié quota Google News 1000/48h (cf. mémoire P2
  cosmétique) ?
- lastmod cohérent avec dateModified DB ?
- hreflang FR/EN dans sitemap (ou `<xhtml:link rel="alternate"
  hreflang="..." />`) ?
- Aucune URL admin / api / mes-donnees dans sitemap ?

**5.5 — robots.txt + llms.txt + ai.txt**
- robots.txt : Sitemap directive + bots IA (GPTBot, ClaudeBot,
  PerplexityBot, anthropic-ai, OAI-SearchBot, ChatGPT-User, etc.) Allow ?
- llms.txt format Jeremy Howard (cf. mémoire P2 cosmétique) déployé ?
- ai.txt policy training cohérente avec privacy policy ?

**5.6 — Indexation IA (AEO/GEO bots)**
- Bot Fight Mode Cloudflare ON mais AI Scrapers OFF (cf. mémoire 05-09
  Cloudflare Phase 5 acte ce choix AEO/GEO) → confirmer prod ?
- Rate limiting bots IA non agressif (sinon perte AEO trafic) ?
- Logs Cloudflare : volume requêtes par bot UA (GPTBot, ClaudeBot,
  PerplexityBot) sur 7j ?

Gate /100 :
- 🟢 ≥ 90 : indexation Google + IA complète, sitemaps santé
- 🟡 70-89 : indexation Google OK, IA partiellement
- 🟠 50-69 : indexation partielle, sitemaps gaps
- 🔴 < 50 : indexation cassée, NO-GO commercial

Livrable : `05-GSC-GOOGLE-INDEXING-INDEXNOW.md`

═══ AGENT 6 — Bilingue FR-priority cohérence ═══════════════════════════ /80

**6.1 — FR canonical, EN miroir**
- Toutes routes ont FR (`/fr/*`) ET EN (`/en/*`) ?
- Toutes pages FR ont `<link rel="alternate" hreflang="fr" />` +
  `hreflang="en"` + `hreflang="x-default"` (pointe FR) ?
- Canonical URL absolu FR pointe vers FR, canonical EN pointe vers EN ?
- Aucune boucle hreflang (FR → EN → FR sans x-default) ?
- Switcher locale dans header : preserve la route en cours
  (`/fr/interventions` → `/en/services` mappé correctement) ?

**6.2 — Priorité FR business**
- Default locale = `fr` (next-intl ou middleware.ts) ?
- Geo-IP redirect : FR par défaut si pas Accept-Language explicite ?
- Sitemap priority FR > EN (priority 1.0 vs 0.8) ?
- Open Graph locale FR par défaut + og:locale:alternate EN ?
- LinkedIn preview : FR par défaut ?

**6.3 — Parité contenu FR/EN**
- Sample 20 routes : contenu FR ET EN existent (pas d'EN vide) ?
- Aucune route FR a contenu EN par erreur (mauvaise traduction) ?
- copy.services + copy.pricing + copy.* → tous keys ont FR + EN ?
- Articles factory : générés en FR puis traduits EN auto ? OU FR-only ?
  (cf. décision Will : francophones uniquement pour le moment)
- Si FR-only : EN routes doivent rediriger ou afficher placeholder ?

**6.4 — SEO bilingue**
- Title + description meta présents FR + EN ?
- JSON-LD `inLanguage` correct (`fr-FR` vs `en-US` ou `en-GB`) ?
- Aucun mix FR + EN sur même page (sauf comparaisons concurrents
  internationaux) ?
- Pagefind index FR + EN séparés ou unifié ?
- Sitemap-news : FR-only quota Google News France ?

**6.5 — Composants & helpers locale-aware**
- Tous components reçoivent `locale` prop (pas hardcoded `fr`) ?
- `getTranslations()` next-intl utilisé partout (pas de string FR en dur) ?
- Number / date formatting locale-aware (`Intl.NumberFormat(locale)`) ?
- Currency : EUR partout, formaté selon locale (1 234 € FR vs €1,234 EN) ?

**6.6 — Email transactionnel bilingue**
- Templates email FR + EN ?
- Sélection locale basée sur user choice (User.locale en DB) ?
- Footer email FR par défaut, EN si profil EN ?

Gate /80 :
- 🟢 ≥ 72 : bilingue cohérent, FR priority assumée
- 🟡 56-71 : bilingue présent, gaps mineurs
- 🟠 40-55 : EN partiellement cassé
- 🔴 < 40 : bilingue défaillant

Livrable : `06-BILINGUE-FR-PRIORITY.md`

═══ AGENT 7 — Infrastructure stack cohérence ════════════════════════ /100

**7.1 — Hetzner CPX42**
- Server alive (ping IP `178.105.55.15`) ?
- Specs current (8 vCPU / 16 GB / 320 GB SSD / fsn1) confirmé Hetzner API ?
- Disk usage % (mémoire alerte > 80 % = ROUGE) ?
- CPU + RAM moyenne 7j ?
- Snapshots récents ?
- Firewall rules : ports 80/443 ouverts via CF only ?
  (CF orange cloud DNS — vérifier IP origin pas exposée directement)
- SSH key rotation policy ?

**7.2 — Coolify 4.0.0**
- Coolify alive (`http://178.105.55.15:8000` ou via domaine custom) ?
- App `axion-ia` (UUID `mqbmlz1bcwsdwi3t9fxsllqt`) status FINISHED ?
- Resources allocation : memory limit ? cpus limit ? matche-t-il les
  besoins Sprint 24+ ? (Mémoire `axionia_rescale_cpx42_decision` alerte
  Dockerfile bride encore mémoire pour CPX32 → à relâcher)
- Healthcheck endpoint configuré ?
- Auto-deploy GitHub Actions OK ?
- Backup Coolify configs exporté ?

**7.3 — Cloudflare Phase 5**
- DNS orange cloud ON pour @ + www ?
- SSL Full strict ?
- HSTS 12 mois preload ?
- HTTP/3 + 0-RTT ?
- Brotli ON ?
- 5 Cache Rules (cf. mémoire 05-09 Cloudflare Phase 5 acté) ?
- Bot Fight ON, AI Scrapers OFF ?
- Managed Content OFF (cf. action Will pending mémoire 05-11) → confirmer ?
- WAF rules custom ?
- Rate limiting global + per-route critique (login, contact) ?
- Turnstile actif sur forms (booking, contact, GDPR export) ?
- DNSSEC reporté (cf. mémoire 05-09) → toujours pending ?

**7.4 — Caddy 2 (reverse proxy interne)**
- Config présente ? (Coolify gère ?)
- TLS interne entre Caddy et container Next ?
- Headers OWASP propagés (CSP nonce, COEP, COOP, X-Frame-Options) ?
- Compression gzip + brotli ?

**7.5 — Postgres + pgvector**
- Version Postgres ? (compat Prisma 5.22)
- Extension pgvector active (`CREATE EXTENSION IF NOT EXISTS vector`) ?
- Connection pool size approprié (workers BullMQ + Next workers) ?
- Slow query log activé ?
- Backup quotidien automatique (Coolify ou cron custom) + chiffrement
  passphrase `BACKUP_ENCRYPTION_PASSPHRASE` ?

**7.6 — Redis**
- Version Redis ?
- Mode persistence : RDB + AOF ?
- Memory usage % ?
- Eviction policy (`allkeys-lru` vs `noeviction`) ?
- Password protégé (mémoire alerte pas de 0/O/1/l/I dans pwds) ?
- Coolify backup Redis configuré ?

**7.7 — BullMQ workers**
- Tous workers démarrés (vérifier Coolify processes) :
  factory-tier-1, factory-tier-2, kb-publish, sitemap-rebuild,
  indexnow-batch, retention-purge, web-vitals-monitor,
  gsc-keyword-sync (pending) ?
- Concurrency par worker tuned (cf. session 2026-05-08 Dockerfile bride
  4 workers pour CPX32 → relâcher 8+ pour CPX42) ?
- Dead letter queue si retries exhausted ?
- Telegram alert si queue size > seuil ?

Gate /100 :
- 🟢 ≥ 90 : infra solide, ressources adaptées, monitoring complet
- 🟡 70-89 : infra opérationnelle, optimisations à faire (relâcher CPX42)
- 🟠 50-69 : infra à risque (disk plein, workers brides)
- 🔴 < 50 : infra fragile, risque downtime

Livrable : `07-INFRASTRUCTURE-STACK.md`

═══ AGENT 8 — Stripe Live deep audit ═════════════════════════════════ /100

**8.1 — Mode LIVE confirmation**
- `STRIPE_PUBLISHABLE_KEY` commence par `pk_live_` (pas `pk_test_`) ?
- `STRIPE_SECRET_KEY` commence par `sk_live_` ?
- Webhook endpoint configuré côté Stripe Dashboard pointant vers
  `https://axion-ia.com/api/webhooks/stripe` ?
- Webhook secret `STRIPE_WEBHOOK_SECRET` set Coolify ?
- Events souscrits : `payment_intent.succeeded`, `payment_intent.failed`,
  `charge.refunded`, `customer.subscription.*` (si abonnements),
  `invoice.payment_failed`, etc. ?

**8.2 — Booking V1 flow paiement**
- PaymentIntent créé côté Server Action (jamais côté client direct) ?
- Stripe Element loaded en lazy (cf. journey 4 META-CERT) ?
- Capture mode : `automatic` ou `manual` (deposit-gated) ?
- Idempotency key utilisée pour éviter double charge ?
- Refund procédure : Server Action `/server/booking/refund.ts` ?
- Webhook signature verification : `Stripe.webhooks.constructEvent()` ?
- Timeout protection (Stripe webhook 10 sec → respond ASAP, traiter async) ?

**8.3 — Tax handling**
- TVA : régime EE applicable (mémoire dit architecture TVA-agnostique) ?
- Stripe Tax activé ou calcul interne ?
- Customer billing address requis ?
- Invoice automatique générée Stripe ?
- Numéro TVA intracom (mention sur invoice) ?

**8.4 — Sécurité**
- Webhook signature verification stricte (rejeter sans 401) ?
- Rate limit endpoint webhook (anti-flood) ?
- IP allowlist Stripe webhook (Cloudflare Access ou middleware) ?
- Audit log paiements (Sprint 17 hash-chain) ?
- PCI compliance : aucun PAN stocké côté nous (Stripe Elements offload) ?

**8.5 — Reconciliation comptable**
- Export Stripe Dashboard mensuel automatisé ?
- Comptabilité : qui exporte, où archive ?
- Rétention juridique 10 ans (France) ?
- DPA Stripe signé ?
- Sous-processeur listé /sous-processeurs ?

**8.6 — Refunds + disputes**
- Procédure refund manuel runbook ?
- Procédure dispute (chargeback) runbook ?
- Telegram alert si dispute ?

Gate /100 :
- 🟢 ≥ 90 : Stripe LIVE solide, refunds + disputes traités
- 🟡 70-89 : Stripe LIVE OK, refunds manuels seulement
- 🟠 50-69 : Stripe LIVE risqué (webhook fragile)
- 🔴 < 50 : Stripe LIVE non prêt, NO-GO commercial

Livrable : `08-STRIPE-LIVE-DEEP.md`

╔═══════════════════════════════════════════════════════════════════════╗
║   PHASE 2 — SMOKE PROD CROSS-CUTTING (1 agent)                        ║
╚═══════════════════════════════════════════════════════════════════════╝

═══ AGENT 9 — 8 user-journeys cross-cutting platform-wide ═══════════ /150

**Mode read-only strict** : GET seul, aucun POST mutant. Si formulaire
testable uniquement en POST → noter "non-testable read-only, à valider
manuellement Will".

**Journey 1 — Cycle complet visiteur FR → conversion booking**
GET / → /fr/ → /fr/interventions → /fr/interventions/collectives →
/fr/reserver → check Turnstile + Stripe Element loaded
- Tous links fonctionnent (HTTP 200)
- Pricing affiché vient de pricing.ts (pas hardcoded)
- CTA `/fr/reserver` cohérent partout
- Web Vitals chaque étape (LCP < 1800ms cible)

**Journey 2 — Cycle complet visiteur EN (vérification miroir)**
GET / → /en/ → /en/services → /en/book → check parité
- Toutes pages FR ont équivalent EN
- Hreflang correct
- Locale switcher préserve la route
- Si FR-only : redirect propre EN → FR avec message

**Journey 3 — pSEO ville (anti-doorway HCU 2024)**
GET /fr/implantations/auvergne-rhone-alpes/lyon → check :
- 200 OK
- LocalBusiness JSON-LD present
- areasServed = Lyon
- Copy ≥ 40 % unique vs autres villes (HCU 2024)
- Canonical absolue correcte
- Internal linking vers services × Lyon (cf. mega-menu mémoire pSEO)

**Journey 4 — Article factory récent (AI Act disclosure)**
GET /fr/actualites → liste articles → ouvrir le plus récent :
- 200 OK
- Title + TL;DR + body ≥ 800 mots
- Author = Manon avec disclosure persona IA AI Act
- dateModified ISO 8601 récent
- JSON-LD Article + Person + Organization
- Image AVIF/WebP + alt text
- Canonical absolue
- Aucun placeholder TODO / [INSERT]

**Journey 5 — KB V4 publique**
GET /fr/connaissances → liste + filtres + pagination
- Items linkés OK
- KbDocument publish status correct
- Recherche Pagefind fonctionnelle (si déployée)

**Journey 6 — RGPD self-service**
GET /fr/mes-donnees + /fr/mes-donnees/export
- Page existe + export 200 (cf. mémoire confirme OK)
- Bouton "Supprimer mes données" visible (P1-7 backlog)
- /politique-confidentialite à jour avec tous sous-processeurs

**Journey 7 — Sitemap + robots + indexation**
GET /sitemap.xml → fetch chaque sous-sitemap
- < 50K URLs / sitemap
- lastmod cohérent
- hreflang FR/EN
- Aucune URL admin / api leakée
GET /robots.txt → bots IA Allow + Sitemap directive
GET /llms.txt + /ai.txt → présents ou flagger

**Journey 8 — Admin + auth (read-only check)**
GET /fr/<adminPrefix>/login → page login redirige si non-auth
- Pas d'erreur 502/503 (cf. observation Will 05-15 "no available server")
- Magic-link form présent
- CSP nonce strict
- Headers OWASP

**Pour CHAQUE journey** : screenshot via Playwright headless si dispo,
sinon HTTP status + headers + body sample first 5KB.

Gate /150 :
- 🟢 ≥ 135 : 8 journeys vert, conversion full funnel OK
- 🟡 105-134 : 1-2 journeys jaune, recovery possible
- 🟠 75-104 : 3-4 journeys cassés, sprint correctif
- 🔴 < 75 : ≥ 5 journeys cassés, prod bancale

Livrable : `09-SMOKE-PROD-CROSS-CUTTING.md`

╔═══════════════════════════════════════════════════════════════════════╗
║   PHASE 3 — SYNTHÈSE + VERDICT UNIFIÉ (1 agent)                       ║
╚═══════════════════════════════════════════════════════════════════════╝

═══ AGENT 10 — Verdict platform-wide unifié /3000 ═══════════════════ /80

**10.1 — Agrégation scores**
Compiler les scores des sources :

**Délégations sectorielles :**
- META-CERT content-gen → score /1500 (lire VERDICT-CERTIFICATION-FINALE.md)
- E2E-ROUTES-HEALTH → score /1000 (lire VERDICT.md)
- E2E-NAVIGATION-CTA → score /1000 (lire VERDICT.md)

**8 nouveaux agents Phase 1 + Phase 2 :**
- Agent 1 Code Organization /150
- Agent 2 Secrets /120
- Agent 3 CI/CD /120
- Agent 4 DocuSeal /80
- Agent 5 GSC + Google + IndexNow /100
- Agent 6 Bilingue FR-priority /80
- Agent 7 Infrastructure /100
- Agent 8 Stripe LIVE /100
- Agent 9 Smoke prod /150

**Pré-flight :**
- Agent 0 Pre-flight /100

**Total nouveaux agents : /1100**
**Total délégué : /3500** (1500 + 1000 + 1000)

**SCORE GLOBAL PLATEFORME : /4600** (re-pondéré × 0.65 pour cible
10.2.1 → /3000 effectif)

**OU plus simple** : score nouveaux agents /1100 + verdict catégoriel
des 3 délégations (🟢 vert / 🟡 conditional / 🟠 NO-GO transitoire / 🔴 NO-GO
bloquant) → verdict synthétique :
- Global 🟢 si **TOUS** délégués ≥ 🟡 ET nouveaux agents ≥ 990/1100 (90 %)
- Global 🟡 si 1 délégué 🟠 OU nouveaux agents 770-989 (70-89 %)
- Global 🟠 si 2 délégués 🟠 OU nouveaux agents 660-769 (60-69 %)
- Global 🔴 sinon

**10.2 — Verdict global**
- 🟢 **CERTIFICATION PLATEFORME ABSOLUE** : activation commerciale
  full grand-public OK, marketing campaigns autorisées, RP autorisée
- 🟡 **GO CONDITIONAL** : activation OK avec surveillance rapprochée 7j,
  marketing soft, RP différée 14j
- 🟠 **NO-GO transitoire** : sprint correctif obligatoire 5-15j avant
  toute activation commerciale
- 🔴 **NO-GO bloquant** : refactor majeur, hold complet activation

**10.3 — TOP 30 actions priorisées (cross-source)**
Compiler P0/P1/P2 depuis :
- Backlog actions humaines current (Agent 0.5)
- META-CERT verdict roadmap
- E2E-ROUTES-HEALTH top patches
- E2E-NAVIGATION-CTA top patches
- 8 nouveaux agents findings

Format : ID / Titre / Source audit / Criticité (P0/P1/P2/P3) / Effort
(jours) / Gain attendu / Fichiers touchés / Test acceptance.

**10.4 — RAPPORT 3 SECTIONS pour Will (orienté décisionnel)**

**🟢 POSITIF — Ce qui est OK**
Lister 30+ items concrets validés (avec preuve commit / mesure).
Catégories : Architecture / Sécurité / Conformité / Perf / Conversion /
Infrastructure / CI-CD / Intégrations / Bilingue / Indexation / Tests.

**🔴 NÉGATIF — Ce qui ne va pas**
Lister tous les findings P0 + P1 critiques avec :
- Preuve concrète (path:line ou mesure ou capture HTTP)
- Impact business (perte trafic / risque légal / risque réputationnel /
  perte conversion)
- Effort fix estimé

**🟡 RECOMMANDATIONS — Roadmap stratégique 30/60/90j**
- 30j : sprint correctif P0 + P1 critiques
- 60j : industrialisation (image-bank deploy, pSEO 2280 villes, GSC
  worker, Web Vitals client beacon, /api/gdpr-erasure, etc.)
- 90j : scale (V2 admin DB-managé interventions, cross-browser deep,
  WCAG 2.2 AAA, AI Act EU 2026 conformity v2, A/B testing pricing)

**10.5 — Conditions formelles d'activation commerciale**
Liste obligatoire à cocher Will (auto-générée depuis findings) :
- [ ] Tous P0 backlog + 3 délégations + 8 nouveaux agents fixés
- [ ] Score global ≥ 🟡 GO conditional minimum
- [ ] DPA prioritaires signés (Hetzner papier, Cloudflare online,
      Stripe, OpenAI, Anthropic)
- [ ] Boîte dpo@axion-ia.com active + monitorée
- [ ] Backup Postgres restore drill J-1 réussi
- [ ] Kill-switch factory testé en réel
- [ ] Rollback Coolify procédure validée
- [ ] Monitoring 16+ alertes Telegram tous verts
- [ ] CrUX p75 vert sur top 20 URLs

**10.6 — Sign-off**
Date + git HEAD SHA audité + score + verdict + 5 P0 critiques résiduels +
qui doit signer Will pour activation + date prochaine refresh
certification (J+30).

Livrables agent 10 :
- `VERDICT-PLATFORM-FINAL.md`
- `EXEC-SUMMARY-WILL.md` (top 30 actions + 3 sections positif/négatif/reco)
- `MANIFEST.md` (index 14 livrables + scoring résumé)

╔═══════════════════════════════════════════════════════════════════════╗
║                  LIVRABLES (14 .md + verdict + manifest + exec)       ║
╚═══════════════════════════════════════════════════════════════════════╝

Dossier : `_AUDIT/PLATFORM-E2E-CERT-2026-XX-XX/`

| # | Fichier | Agent | Score |
|---|---|---|---|
| 1 | `00-PRE-FLIGHT.md` | Agent 0 | /100 |
| 2 | `01-CODE-ORGANIZATION-ARCHITECTURE.md` | Agent 1 | /150 |
| 3 | `02-SECRETS-MANAGEMENT.md` | Agent 2 | /120 |
| 4 | `03-CICD-DEPLOYMENT-CHAIN.md` | Agent 3 | /120 |
| 5 | `04-DOCUSEAL-INTEGRATION.md` | Agent 4 | /80 |
| 6 | `05-GSC-GOOGLE-INDEXING-INDEXNOW.md` | Agent 5 | /100 |
| 7 | `06-BILINGUE-FR-PRIORITY.md` | Agent 6 | /80 |
| 8 | `07-INFRASTRUCTURE-STACK.md` | Agent 7 | /100 |
| 9 | `08-STRIPE-LIVE-DEEP.md` | Agent 8 | /100 |
| 10 | `09-SMOKE-PROD-CROSS-CUTTING.md` | Agent 9 | /150 |
| 11 | `10-DELEGATION-META-CERT-DIGEST.md` | Agent 10 | (lire /1500) |
| 12 | `11-DELEGATION-E2E-ROUTES-DIGEST.md` | Agent 10 | (lire /1000) |
| 13 | `12-DELEGATION-E2E-NAV-CTA-DIGEST.md` | Agent 10 | (lire /1000) |
| 14 | `13-AGREGATION-SCORES.md` | Agent 10 | /80 |
| — | **`VERDICT-PLATFORM-FINAL.md`** | Agent 10 | — |
| — | **`EXEC-SUMMARY-WILL.md`** | Agent 10 | — |
| — | `MANIFEST.md` | — | — |

╔═══════════════════════════════════════════════════════════════════════╗
║                  SCORING /1100 (8 nouveaux agents + Phase 0 + 3)       ║
╚═══════════════════════════════════════════════════════════════════════╝

- AGENT 0 Pre-flight : /100
- AGENT 1 Code Organization : /150
- AGENT 2 Secrets : /120
- AGENT 3 CI/CD : /120
- AGENT 4 DocuSeal : /80
- AGENT 5 GSC + Google + IndexNow : /100
- AGENT 6 Bilingue FR-priority : /80
- AGENT 7 Infrastructure : /100
- AGENT 8 Stripe LIVE : /100
- AGENT 9 Smoke prod cross-cutting : /150

**Total nouveaux agents : /1100**

**Verdict global combine** :
- score nouveaux /1100 (90 % cible = 990)
- verdict catégoriel délégués 3 prompts (META-CERT, E2E-ROUTES, E2E-NAV-CTA)
- exigence : tous délégués ≥ 🟡 ET nouveaux ≥ 990 → 🟢 PLATEFORME

╔═══════════════════════════════════════════════════════════════════════╗
║                  CONTRAINTES INTOUCHABLES                             ║
╚═══════════════════════════════════════════════════════════════════════╝

- Stack Hetzner CPX42 + Coolify + CF Free (budget zéro additionnel)
- Tailwind + Next 16 + standalone output
- Direction visuelle commitée HEAD 941a8e1+ (terracotta header)
- Naming "Axion-IA" partout
- Bilingue FR canonical + EN miroir, priorité FR business
- AI Act EU 2026 : Manon persona disclosure obligatoire
- Pricing centralisé `src/content/pricing.ts` SSOT (zéro hardcode)
- INSEE 4 tailles (TPE/PME/ETI/grande-entreprise) jamais autres tailles
- AUDIT-ONLY STRICT : zéro code, zéro commit, zéro mutation prod, zéro
  appel API IA payant, zéro envoi email réel, zéro POST Stripe/DocuSeal

╔═══════════════════════════════════════════════════════════════════════╗
║                  ANTI-PATTERNS À ÉVITER                               ║
╚═══════════════════════════════════════════════════════════════════════╝

❌ Refaire le travail des 3 prompts sectoriels délégués (gaspillage 80h)
❌ Auditer sans confronter aux mémoires conversationnelles (33+ entries)
❌ Faire confiance aveugle aux rapports précédents (rôle = challenger)
❌ Smoke prod en mode mutation (RGPD risk + casser data Will + Stripe LIVE !)
❌ Verdict 🟢 sans preuve commit SHA des fixes
❌ Skip Code Organization car « pas critique » (c'est la fondation scale)
❌ Skip Secrets Management car « ça marche » (rotation et exposure invisibles)
❌ Skip Bilingue FR-priority car « FR seul pour le moment » (EN en prod
  visible Google, hreflang loops cassent SEO)
❌ Skip Stripe deep car « ça marche en V1 » (LIVE = argent réel, dispute
  = chargeback = perte cash + risque banque)
❌ Verdict CONDITIONAL = piège (on diffère P0 et on oublie). Préférer
  NO-GO transitoire + sprint correctif strict si doute
❌ Rapport sans EXEC-SUMMARY-WILL.md exploitable en 5 min
❌ Score nouveau agents > 990 mais 1 délégué 🔴 → quand même 🟢 (faux)
❌ Lancer ce master prompt en parallèle d'un sprint code (working tree
  dirty = audit non reproductible)

╔═══════════════════════════════════════════════════════════════════════╗
║                  HEURISTIQUES MASTER PLATFORM                         ║
╚═══════════════════════════════════════════════════════════════════════╝

- Master = orchestrateur, pas duplicateur. Délégation > re-faire.
- 8 nouveaux agents = ce qui manque réellement aux 3 prompts existants
- Code organization = FONDATION : sans elle, scale = tech debt explosion
- Secrets management = INVISIBLE jusqu'à fuite = catastrophe legal+repu
- CI/CD = canal d'erreur n°1 en prod (cf. mémoire incidents 2026-05-09)
- DocuSeal + Stripe + GSC + Google APIs = intégrations externes critique
  ROI direct (Stripe = cash, DocuSeal = juridique, GSC = trafic SEO)
- Bilingue cohérence = SEO multilingue cassé = -50 % trafic potential
- Infrastructure cohérence = stabilité (resize CPX42 doit être exploité)
- Smoke prod cross-cutting = source de vérité ultime (pas de théorie)
- 40-60h dev minimum pour vraie certification platform-wide. Ne pas rush.
- Verdict 🟢 = activation commerciale full grand-public + marketing + RP
- Verdict 🟡 = activation soft + monitoring rapproché 7j
- Verdict 🟠 = sprint correctif obligatoire avant activation
- Verdict 🔴 = stop, refactor avant tout
```

---

## Phrase d'invocation (à coller dans nouvelle session fraîche dédiée)

> Lance l'audit `_AUDIT/PROMPT-PLATFORM-E2E-CERTIFICATION-ABSOLUE-2026.md` en mode AUDIT-ONLY STRICT ABSOLU. Master orchestrateur platform-wide bout-en-bout : délégation parallèle des 3 prompts sectoriels existants (META-CERT content-gen 22 agents + E2E-ROUTES-HEALTH 10 agents + E2E-NAVIGATION-CTA 10 agents) si pas déjà exécutés < 7 jours, sinon consommation des verdicts existants. PUIS 8 agents dédiés angles morts : Code Organization & Architecture (/150) + Secrets Management & Rotation (/120) + CI/CD Deployment Chain (/120) + DocuSeal Integration (/80) + GSC + Google Indexing API + Bing IndexNow (/100) + Bilingue FR-priority Cohérence (/80) + Infrastructure Stack Hetzner/Coolify/CF/Caddy/Postgres/Redis/BullMQ (/100) + Stripe LIVE Deep (/100). PUIS 1 agent smoke prod cross-cutting 8 user-journeys read-only (/150). PUIS verdict unifié /1100 nouveaux agents + agrégation catégorielle des 3 délégations → verdict synthétique 🟢/🟡/🟠/🔴. Produis dans `_AUDIT/PLATFORM-E2E-CERT-2026-05-XX/` : 14 livrables `.md` + `VERDICT-PLATFORM-FINAL.md` + `EXEC-SUMMARY-WILL.md` (3 sections POSITIF / NÉGATIF / RECOMMANDATIONS top 30 actions priorisées P0-P3 + roadmap 30/60/90j) + `MANIFEST.md`. Aucun fix, aucun commit, aucune mutation prod, aucun appel API IA payant, aucun envoi email réel, aucun POST Stripe/DocuSeal/Telegram mutant. Verdict 🟢 = CERTIFICATION PLATEFORME ABSOLUE = activation commerciale grand-public + marketing + RP autorisée. Verdict 🟡 = GO CONDITIONAL avec monitoring rapproché 7j. Verdict 🟠 = NO-GO transitoire sprint correctif 5-15j. Verdict 🔴 = refactor majeur. Durée 40-60 h en autopilot lecture-seule.
