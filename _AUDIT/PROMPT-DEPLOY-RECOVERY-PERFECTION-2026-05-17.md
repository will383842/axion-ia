# PROMPT MASTER — DEPLOY RECOVERY PERFECTION ABSOLUE (Axion-IA · axion-ia.com)

**Date** : 2026-05-17
**Auteur** : Will (via Claude Opus 4.7)
**Mode** : 🚨 **AUTOPILOTE TOTAL — AUTORISATION EXPLICITE WILL 2026-05-17** 🚨
**Cible** : Site `https://axion-ia.com` redéployé en prod avec la `HEAD` de `main`, smoke 100 % vert (30+ routes), zéro intervention humaine, en moins de 3 heures.
**Doctrine** : Code = SSOT. Root cause only — pas de contournement, pas de --no-verify, pas de force-push main.

---

## ⚡ 0 · MODE AUTOPILOTE TOTAL — RÈGLES D'ENGAGEMENT

Will a **explicitement autorisé** l'autopilote total le 2026-05-17 dans ce contexte précis (déploiement bloqué depuis plusieurs heures). **Tu ne dois PAS faire de STOP & ASK** sauf dans 3 situations strictement définies :

### 3 SEULES situations qui justifient un STOP & ASK
1. **Une action irrécupérable** est sur le point d'être prise (drop database prod, rm -rf /, force-push sur main, suppression d'un secret sans backup). Dans ce cas seulement, demande confirmation avant.
2. **Tous les fallbacks ont échoué** (Coolify API down + SSH down + GH workflow_dispatch down + manual deploy down) — rapporter et attendre Will.
3. **Une preuve forte de compromission/sécurité** (clé exposée, accès non autorisé détecté) — geler et alerter.

### TOUT le reste est PRÉ-APPROUVÉ
✅ Kill un déploiement Coolify hung — GO
✅ Restart container Coolify — GO
✅ `docker system prune -af --volumes` sur Hetzner — GO
✅ Rebuild + republish image GHCR — GO
✅ Régénérer un secret GH Actions si expiré (Will a accès aux UI Coolify/GitHub pour rotation post-fix) — proposer la régénération + l'appliquer si secret testé manquant/invalide
✅ Commit + push main (Conventional) sans demander — GO
✅ Créer workflows GH Actions de diagnostic/rotation — GO
✅ Modifier `deploy-coolify.yml` (concurrency, timeouts, healthchecks) — GO
✅ Créer ADR si décision archi prise — GO
✅ Stash des fichiers non commités si pas pertinents au déploiement — GO (avec log)
✅ Annuler des runs GH Actions en cours qui interférent — GO
✅ Purge CF cache via API — GO

### Boucle "détecter → fix → vérifier" jusqu'à GREEN
Tu **ne t'arrêtes PAS** au premier fix. Tu vérifies, et si pas GREEN, tu re-triages (catégorie suivante) et tu re-fixes. Maximum **5 itérations**, puis tu escalades à Will avec rapport complet.

### Reporting continu
À chaque transition de phase, **un message ≤ 5 lignes** à Will avec : où tu en es, ce qui vient d'être fait, prochaine étape, ETA. Pas plus, pas moins. Will lit en passant, il ne valide pas chaque étape.

---

## 1 · TL;DR du problème observé (point de départ — vérifier puis dépasser)

Au moment où ce prompt est écrit, voici ce qui a été observé en boîte noire :

- Le pipeline GitHub Actions `Build & Deploy · GHCR + Coolify (axion-ia.com)` (workflow `.github/workflows/deploy-coolify.yml`) **échoue systématiquement** depuis ≥ 4 runs consécutifs sur `main` (depuis ~2026-05-16T12:21Z).
- Le job **`Build & push image to GHCR` RÉUSSIT** (image construite + poussée sur GHCR en ~40 min).
- Le job **`Trigger Coolify deploy` ÉCHOUE** : le `POST /api/v1/deploy` renvoie bien un `DEPLOYMENT_UUID` (ex : `vp6k93j229m3feyt8oaiebmj`), mais le polling du statut renvoie **`queued` pendant 60 minutes consécutives** puis le step `Wait for Coolify deployment to finish (max 60 min)` time out.
- Le step `Purge Cloudflare cache` et le job `Lighthouse CI post-deploy gate` sont donc skipped.
- Le workflow `Disk Cleanup Prod (Hetzner CPX42)` a tourné en succès à `2026-05-17T03:03:27Z` (donc le disque n'est probablement plus saturé maintenant — à reconfirmer en SSH).
- Le workflow `Nightly · Gate D` a échoué à `2026-05-17T04:28:07Z` (hors-scope si non bloquant pour le déploiement, mais à investiguer en parallèle).
- Le **sous-repo `axionia/` a beaucoup de fichiers modifiés non commités** (CHANGELOG.md, audits, pages admin image-bank, sitemaps, etc.).
- Le **super-repo Axion-IA** a aussi 2 fichiers non commités dans `_AUDIT/`.
- PR #14 (image-bank V1) a été **mergée** sur main mais Gate C (Docker smoke test) avait échoué.

**Hypothèse principale à challenger** : la file Coolify est gelée (worker mort, déploiement précédent hung, lock DB, disque qui re-sature après pull image neuve ~2-4 GB).

---

## 1.5 · 🚨 ANALYSE CROSS-SESSION CLAUDE — 5 CAUSES EMPILÉES (PRÉ-EXISTANTES) 🚨

**Une autre session Claude a passé ~10h sur ce problème et a identifié 5 causes empilées, pas une seule.** Tu DOIS partir de cette base et la **vérifier + compléter** :

### Cause #1 — 🔧 Dette technique CI/CD du repo (CAUSE PROFONDE)
Les workflows GitHub Actions ont 9 mois de gates strictes ajoutées par couches successives (Pass B, Sprint S6.3, méta-cert, audit V14...) **sans jamais être testées toutes ensemble** :
- Coverage 60% threshold irréaliste après +5000 LOC sans tests
- `bundle:check` requiert Chrome installé via Playwright **placé APRÈS** dans le workflow → fail systémique
- Build exige toutes les env vars production (`IP_HASH_SALT`, `PII_ENCRYPTION_KEY`) ajoutées récemment **sans les fournir au CI**
- Playwright `webServer` configuré seulement en mode local, pas CI
- Gitleaks veut comparer `commit^..HEAD` avec shallow clone par défaut

**13 fix CI ont été appliqués hier soir** pour patcher chaque couche (visibles dans `git log axionia/.github/workflows/` recent). Ce n'est PAS le code image-bank qui était cassé — c'est le workflow qui n'avait jamais été éprouvé sur une PR sérieuse depuis longtemps.

→ **À vérifier en Phase 0** : `git log --oneline --since="2026-05-16" -- .github/workflows/ axionia/.github/workflows/` doit montrer ces 13 fix.

### Cause #2 — 🧟 Zombie deploy Coolify (CAUSE BLOQUANTE — déjà cancelée par Agent 1)
Un deploy de **2026-05-16 15:08** avait crashé sur **containerd snapshotter write error** (probablement saturation disque temporaire). Coolify a marqué `finished_at` mais a laissé `status="in_progress"` → état inconsistant.

Le **Horizon queue dispatcher** ne pickup qu'**UN seul `in_progress` par app** → tous les deploys suivants restaient `queued` indéfiniment.

C'est un **bug Coolify upstream**, pas le tien. **Agent 1 (autre session Claude) l'a déjà cancelé.**

→ **À vérifier en Phase 0** : confirmer qu'il n'y a plus de zombie `in_progress` dans `/api/v1/deployments`. Si un NOUVEAU zombie est apparu depuis → re-canceler.

### Cause #3 — 🤖 Sessions Claude parallèles non coordonnées
Une autre conversation Claude (Manon) travaillait sur la même branche `feat/image-bank-v1` pendant que la session 1 faisait audit + patches :
- Switches HEAD automatiques (perdu des edits 2-3 fois)
- Commits interleaved (`8433bba`, `fde9fa7`) qui ont écrasé certains patches
- Commit fantôme `6d51bb7` (titre trompeur, contenu pas du primaire)
- Branche devenue multi-thématique (image-bank V1 + S+1 securite-rgpd Manon)

→ **Action obligatoire** : créer un garde-fou repo (`.claude/coordination.md` + CONTRIBUTING.md section "multi-agent" + CODEOWNERS si applicable) pour qu'AUCUNE autre session Claude ne touche `main` ou `feat/image-bank-v1` pendant cette session.

### Cause #4 — 🏗️ Setup deploy pas prêt avant push
Le merge PR #14 a été déclenché **sans que les env vars Coolify nécessaires** (`INDEXNOW_INTERNAL_HMAC_SECRET`, `DOCUSEAL_STRICT_HMAC`, peut-être d'autres) soient set d'abord. Si elles l'avaient été, le `prisma migrate deploy` + container start aurait été straight-forward.

→ **À vérifier en Phase 0.4** : lister TOUTES les env vars de l'app Coolify et comparer avec `.env.example` du repo. Toute absence = P0 à set AVANT redeploy.

### Cause #5 — ⏱️ Build local impossible (ADR 0026)
Build Docker externalisé sur GitHub Actions car trop lourd pour CPX42. Donc **impossible de tester un fix CI en local rapidement** — chaque cycle = 5-25 min CI feedback. Un debug qui aurait pris 5 min en local prend 30 min en CI.

→ **À optimiser** : matrix CI avec fail-fast, parallelisation des Gates, cache layers Docker Buildx agressif, séparer le job "image build" du job "deploy" (déjà fait), peut-être un mode "dev fast build" qui skip certaines étapes lourdes.

### 📋 Sprint CI/CD cleanup obligatoire (POST-deploy GREEN)
**Cause racine globale** : repo avec beaucoup de code récent ajouté **sans que les pipelines CI/CD ne soient maintenus en parallèle**. Dette CI/CD accumulée qui aurait dû être réglée avant la première grosse PR.

Sprint « CI/CD cleanup » à exécuter **dans cette même session autopilote** (Phase 8.bis) :
1. ✅ Aligner coverage threshold sur réalité avec ratchet (déjà fait — vérifier)
2. ⚙️ Réordonner steps Gate B (**Playwright install AVANT bundle:check**)
3. ⚙️ Migrer `size-limit` vers `preset-app` sans plugin Chrome
4. ⚙️ Configurer `webServer` Playwright **pour CI** (pas just local)
5. ⚙️ Documenter env vars CI vs prod (`.env.ci` séparé)
6. ⚙️ Auto-cleanup zombie deploys Coolify (cron daily qui cancel les `in_progress` > 30 min sans heartbeat)

Ces 6 points couvrent 100% des 13 fix CI appliqués hier — les remplacent par des fix propres et durables.

### 🚫 2 faux ennemis à ne PAS chasser
- ❌ **Le code image-bank V1** : tests Vitest 887/887 verts, typecheck OK, lint OK, prisma migrate diff OK — innocent
- ❌ **Les décisions tactiques des autres agents** : ils ont juste découvert + patché les 13 problèmes successifs cachés

### ✅ 2 vrais ennemis à éliminer durablement
- ✅ **Workflows CI obsolètes** → Sprint cleanup Phase 8.bis
- ✅ **Coolify queue fragile** (zombies non cleanup auto, bug upstream) → cron auto-cleanup Phase 7.5 cause A

---

## 2 · Stack & doctrine de référence (rappel pour toi)

### Infra prod
- **Domaine** : `axion-ia.com` (Namecheap)
- **Cloudflare Free** : DNS orange, SSL Full strict, HSTS 12mo preload, HTTP/3, Brotli, 5 Cache Rules, Bot Fight ON + AI Scrapers OFF (AEO/GEO)
- **Hetzner CPX42** Nuremberg, IP `178.105.55.15` (8 vCPU / 16 GB RAM / 320 GB NVMe)
- **Coolify v4** auto-hébergé (URL stockée en secret GitHub `COOLIFY_URL`)
- **Pattern build** : `push main` → GH Actions build image → push GHCR public → Coolify `POST /api/v1/deploy` (avec `COOLIFY_API_TOKEN` + `DEPLOYMENT_UUID` côté secrets repo) → Coolify pull image → restart container → CF purge cache
- **Caddy 2** reverse proxy géré par Coolify
- **Postgres + Redis** managés par Coolify (services séparés)
- **Image registry** : `ghcr.io/will383842/axion-ia:<sha>` + tag `:main` (image PUBLIQUE pour permettre pull sans auth Coolify)

### Repos
- **Super-repo** : `C:\Users\willi\Documents\Projets\Axion-IA` (contient `_AUDIT/` racine + sous-modules de docs)
- **Sous-repo applicatif** : `C:\Users\willi\Documents\Projets\Axion-IA\axionia` (= repo GitHub `will383842/axion-ia`)
- **Branche prod** : `main` (déploiement auto sur push main)
- **Local user** : `Votre Nom` / git config OK

### Doctrine immuable (NE PAS VIOLER même en autopilot)
- ✅ Commits Conventional ; pas de `--no-verify` ; pas de force-push sur `main`
- ✅ Hetzner CPX42 + Coolify + Caddy + CF Free figés (ADR 0009 + ADR 0026)
- ✅ Build externalisé GH Actions (ADR 0026) — **interdit** de réactiver le build Coolify in-place
- ✅ `NEXT_PUBLIC_SITE_URL=https://axion-ia.com` doit être présent en env Coolify
- ✅ Image GHCR doit rester **publique** (pas d'auth pull côté Coolify)
- ✅ Doctrine code = SSOT — si docs et code divergent, code gagne (sauf décision Will explicite)
- ✅ Naming = **Axion-IA** partout (avec tiret)

---

## 3 · Mission (5 livrables non-négociables)

1. **Diagnostic root cause certifié** — preuve, pas hypothèse. Avec logs Coolify, état Docker Hetzner, état file de déploiement, état disque/RAM/CPU/réseau au moment du blocage, état Postgres Coolify (lock + queue), état GHCR (visibilité + manifest).
2. **Fix appliqué + commit(s) Conventional pushé(s) main** — si fix code/config. Si fix opérationnel (SSH), documenter avec procédure scriptée reproductible dans un runbook scripté (`.sh` commité).
3. **Déploiement prod réussi de la `HEAD main` actuelle** — vérifié par : (a) workflow `deploy-coolify.yml` vert end-to-end, (b) image GHCR servie, (c) `https://axion-ia.com` répond 200 sur smoke 30+ routes (FR+EN+sitemaps+API+admin+galerie+villes), (d) CF cache purgé, (e) Lighthouse post-deploy passé, (f) SHA prod = HEAD main.
4. **Audit profond infra + workflow + sécurité post-fix** — voir Phase 8. Pas juste "ça marche", mais "tout est sain".
5. **Runbook post-mortem + entrée memory + ADR si nécessaire** — anti-récidive durable.

---

## 4 · Phase 0 — Snapshot état initial AUTOPILOTE (≤ 20 min, parallélisé max)

Lance ces commandes **en parallèle** (multi tool-calls dans une seule réponse) et capture les outputs dans `_AUDIT/DEPLOY-RECOVERY-2026-05-17/00-snapshot/` :

### 4.1 Snapshot Git (super-repo + sous-repo)
- `git status -uno --short` sur les 2 repos
- `git log --oneline -20` sur main des 2 repos
- `git branch -vv` sur les 2 repos
- `git diff main --stat` pour quantifier les modifs non commitées
- Identifier les fichiers modifiés/non commités → catégoriser (audit-only / code / config / secrets)

### 4.2 Snapshot GitHub Actions (sous-repo `axionia`)
- `gh run list --limit 30 --branch main --json conclusion,name,status,createdAt,displayTitle,databaseId,event,headSha`
- `gh run view <ID_DERNIER_BUILD_DEPLOY_FAILED> --log-failed | tail -200`
- `gh run view <ID_DERNIER_BUILD_DEPLOY_FAILED> --log | grep -E "(error|fail|timeout|queued|ECONN|status:)" | tail -50`
- `gh workflow list --all` — vérifier qu'aucun workflow critique n'est désactivé
- `gh secret list` — confirmer présence des secrets : `COOLIFY_API_TOKEN`, `COOLIFY_URL`, `DEPLOYMENT_UUID`, `GHCR_*`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, `HETZNER_SSH_KEY` (si existe)
- `gh variable list` — vérifier les vars d'environnement repo
- Récupérer le SHA du dernier commit main + le SHA du dernier build GHCR réussi (doivent matcher)
- Récupérer aussi : SHA + timestamp du dernier déploiement Coolify **réussi** (= dernière référence de bon état)

### 4.3 Snapshot GHCR
- `gh api /users/will383842/packages/container/axion-ia/versions --jq '.[0:10] | .[] | {id, name, created_at, tags: .metadata.container.tags}'`
- Confirmer image dernier commit main publiée + publique
- `gh api /users/will383842/packages/container/axion-ia` → vérifier `visibility: public`
- Tester manifest accessible sans auth : `curl -sI "https://ghcr.io/v2/will383842/axion-ia/manifests/main"` (devrait renvoyer 401 sans token mais avec un `Www-Authenticate` qui pointe vers le bon realm)

### 4.4 Snapshot Coolify (via API en autopilot)
Utiliser un workflow `workflow_dispatch` temporaire (voir 4.4bis) ou si tu as accès aux secrets en local via `gh secret`, tester depuis ta machine en passant par l'API.

**Endpoints à interroger** (avec `Authorization: Bearer $COOLIFY_API_TOKEN`) :
- `GET /api/v1/deployments` — liste 10 derniers déploiements + statuts + timestamps + UUID app
- `GET /api/v1/applications` — état app axion-ia (running / stopped / restarting / error)
- `GET /api/v1/applications/<uuid>` — config détaillée : image, env vars, healthcheck
- `GET /api/v1/applications/<uuid>/logs` — derniers logs container (si exposé)
- `GET /api/v1/servers` — état serveur Hetzner CPX42 vu de Coolify
- `GET /api/v1/teams` — vérifier permissions du token

### 4.4bis Workflow diagnostic Coolify (créer si secrets non accessibles localement)
Créer `.github/workflows/coolify-diagnose.yml` :
```yaml
name: Coolify Diagnose (autopilot)
on:
  workflow_dispatch:
    inputs:
      action:
        description: 'list-deployments | kill-stuck | restart-app | dump-state'
        required: true
        default: 'dump-state'
      target_uuid:
        description: 'UUID to target (optional)'
        required: false
jobs:
  diagnose:
    runs-on: ubuntu-latest
    steps:
      - name: Run diagnose
        env:
          COOLIFY_API_TOKEN: ${{ secrets.COOLIFY_API_TOKEN }}
          COOLIFY_URL: ${{ secrets.COOLIFY_URL }}
          ACTION: ${{ inputs.action }}
          TARGET: ${{ inputs.target_uuid }}
        run: |
          set -e
          case "$ACTION" in
            list-deployments)
              curl -s -H "Authorization: Bearer $COOLIFY_API_TOKEN" "$COOLIFY_URL/api/v1/deployments" | jq '.'
              ;;
            kill-stuck)
              # cancel deployment by UUID
              curl -s -X POST -H "Authorization: Bearer $COOLIFY_API_TOKEN" "$COOLIFY_URL/api/v1/deployments/$TARGET/cancel" | jq '.'
              ;;
            restart-app)
              curl -s -X POST -H "Authorization: Bearer $COOLIFY_API_TOKEN" "$COOLIFY_URL/api/v1/applications/$TARGET/restart" | jq '.'
              ;;
            dump-state)
              echo "=== APPLICATIONS ===" ; curl -s -H "Authorization: Bearer $COOLIFY_API_TOKEN" "$COOLIFY_URL/api/v1/applications" | jq '.[] | {uuid, name, status, fqdn}'
              echo "=== DEPLOYMENTS (10 last) ===" ; curl -s -H "Authorization: Bearer $COOLIFY_API_TOKEN" "$COOLIFY_URL/api/v1/deployments" | jq '.[0:10]'
              echo "=== SERVERS ===" ; curl -s -H "Authorization: Bearer $COOLIFY_API_TOKEN" "$COOLIFY_URL/api/v1/servers" | jq '.'
              ;;
          esac
```
Commit + push, puis `gh workflow run coolify-diagnose.yml -f action=dump-state` et `gh run watch <id>`. **Tous les outputs sont masqués automatiquement si touchés au secret. Pas de leak.**

### 4.5 Snapshot site prod (lecture seule, parallélisé)
- `curl -sI https://axion-ia.com/` → status + `cf-cache-status` + `cf-ray` + `server` + `x-served-by`
- Idem pour : `/fr/`, `/en/`, `/fr/reserver`, `/fr/galerie`, `/sitemap.xml`, `/sitemap-index.xml`, `/robots.txt`, `/manifest.webmanifest`, `/fr/audits`, `/fr/interventions`, `/fr/implementations`
- Vérifier le SHA du build via header custom OU `<meta name="build-sha">` OU footer dans HTML — comparer avec dernier déploiement Coolify connu

### 4.6 Snapshot Hetzner SSH AUTOPILOTE
**Test d'accès SSH en autopilot** (3 méthodes en cascade) :

**Méthode A — SSH local depuis Claude Code (préféré si clé disponible)** :
```bash
ssh -o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=accept-new root@178.105.55.15 'echo SSH_OK'
```
Si retourne `SSH_OK` → autopilote SSH GO. Sinon → méthode B.

**Méthode B — Workflow GH Actions SSH** :
Si `gh secret list | grep -i HETZNER_SSH_KEY` montre une clé déjà stockée → créer `.github/workflows/hetzner-diagnose.yml` :
```yaml
name: Hetzner Diagnose (autopilot)
on:
  workflow_dispatch:
    inputs:
      command:
        description: 'Bash command to run as root@178.105.55.15'
        required: true
        default: 'df -h / && free -h && docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Image}}" | head -30'
jobs:
  ssh:
    runs-on: ubuntu-latest
    steps:
      - name: Setup SSH
        run: |
          mkdir -p ~/.ssh
          echo "${{ secrets.HETZNER_SSH_KEY }}" > ~/.ssh/id_rsa
          chmod 600 ~/.ssh/id_rsa
          ssh-keyscan -H 178.105.55.15 >> ~/.ssh/known_hosts
      - name: Run command
        env:
          CMD: ${{ inputs.command }}
        run: ssh root@178.105.55.15 "$CMD"
```
Commit + push + `gh workflow run hetzner-diagnose.yml -f command='df -h /'` puis `gh run view <id> --log`.

**Méthode C — Hetzner Cloud API (rescue mode + console)** :
Si A et B échouent, utiliser `hcloud` CLI ou API Hetzner directe pour ouvrir une console série/VNC. **Last resort** car pas autopilotable, demanderait Will.

**Commandes à exécuter sur Hetzner** (peu importe la méthode) :
```bash
df -h /                                           # disque libre
free -h                                           # RAM libre
uptime                                            # load average
docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}\t{{.RunningFor}}' | head -40
docker stats --no-stream                          # CPU/mem par container
docker logs --tail 300 coolify 2>&1 | tail -200   # logs Coolify (nom container à confirmer via docker ps)
docker exec coolify-db psql -U coolify -c "SELECT id, status, created_at, server_id FROM application_deployment_queues ORDER BY created_at DESC LIMIT 15;" 2>/dev/null || echo "DB query failed - check container name"
docker exec coolify-db psql -U coolify -c "SELECT pid, state, query_start, query FROM pg_stat_activity WHERE state != 'idle';" 2>/dev/null
systemctl status docker --no-pager
ip route get 1.1.1.1                              # network OK ?
curl -sI https://ghcr.io/v2/                      # Hetzner → GHCR atteignable ?
cat /etc/coolify/.env 2>/dev/null | grep -v -E '^(PASSWORD|TOKEN|SECRET)='   # config publique
ls -la /var/lib/docker/volumes/ | head -20
du -sh /var/lib/docker/{containers,volumes,overlay2} 2>/dev/null
```
Output → `_AUDIT/DEPLOY-RECOVERY-2026-05-17/00-snapshot/hetzner-state.txt`

### 4.7 Snapshot Cloudflare (lecture seule)
- `curl -sH "Authorization: Bearer $CF_API_TOKEN" "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/settings/cache_level" | jq '.'`
- Lister les Cache Rules actuelles
- État du Bot Fight Mode + AI Scrapers
- Récents events analytics (last 1h) — si trafic effondré = corrobore site down

---

## 5 · Phase 1 — Triage AUTOPILOTE (≤ 15 min après snapshot)

**⚠️ RAPPEL §1.5 : le problème est COMPOSITE (5 couches). Ne pas s'arrêter à 1 catégorie.** Identifier TOUTES les causes actives, puis prioriser.

| # | Catégorie | Symptômes (à confirmer) | État connu §1.5 | Fix Phase 3 |
|---|-----------|---------------------------|------------------|-------------|
| **A** | **File Coolify gelée par déploiement précédent hung (zombie)** | ≥ 1 déploiement `in_progress` depuis > 30 min dans `/api/v1/deployments`. Bug Coolify upstream : `finished_at` set mais `status="in_progress"`. Horizon dispatcher pickup 1 max par app → reste bloque. | **Cause #2 — déjà cancelée par Agent 1.** Vérifier qu'aucun NOUVEAU zombie n'est apparu. | Cancel via API + restart Coolify + cron auto-cleanup |
| **B** | **Coolify worker mort / scheduler stoppé** | `docker logs coolify` montre exception/crash loop. `docker ps` montre coolify `Restarting` ou `Exited`. | À vérifier post-cancel zombie. | `docker restart coolify` + verify |
| **C** | **Disque Hetzner re-saturé** (causa du containerd snapshotter error qui a créé zombie) | `df -h /` ≥ 85 %. Logs Docker : `no space left on device`. `containerd snapshotter write error`. | **Probablement nettoyé par disk-cleanup-prod.yml 03:03Z.** Confirmer en SSH. | `docker system prune -af --volumes` + retention 24h |
| **D** | **Lock DB Coolify (Postgres deadlock / long-running query)** | Logs : `lock`/`deadlock`. `pg_stat_activity` montre query bloquée > 10 min | À vérifier. | `pg_terminate_backend(pid)` |
| **E** | **Image GHCR introuvable/inaccessible côté Coolify** | Logs Coolify : `manifest unknown` / `unauthorized`. Image GHCR pas publique. | Builds GHCR success constatés → image existe. Vérifier visibility. | Re-rendre publique via `gh api` |
| **F** | **Secrets `COOLIFY_API_TOKEN` / `COOLIFY_URL` invalides ou expirés** | `POST /api/v1/deploy` retourne 401/403/404 dans logs GHA | POST renvoie UUID valide → secrets OK. | Régénérer token Coolify + `gh secret set` |
| **G** | **Network Hetzner → GHCR coupé (firewall / DNS / rate-limit)** | Sur Hetzner : `curl -I https://ghcr.io/v2/` timeout. `ip route` anormal. | À vérifier en SSH. | Fix réseau (DNS, route, firewall) |
| **H** | **App Coolify mal configurée post-merge PR #14 (env vars manquantes)** | Env vars manquantes : `INDEXNOW_INTERNAL_HMAC_SECRET`, `DOCUSEAL_STRICT_HMAC`, peut-être autres (`IP_HASH_SALT`, `PII_ENCRYPTION_KEY`). Healthcheck failing, container restart loop. | **Cause #4 forte probabilité.** Lister env vars Coolify vs `.env.example`. | Set env vars via API Coolify + restart |
| **I** | **Dette CI/CD (workflows obsolètes) — cause profonde non bloquante deploy mais P0 cleanup** | 13 fix CI hier soir. Coverage threshold irréaliste. Bundle:check sans Chrome préinstallé. Playwright webServer local-only. Gitleaks shallow clone. | **Cause #1 — confirmée par Agent 1.** À traiter Phase 8.bis. | Sprint CI/CD cleanup 6 points (Phase 8.bis) |
| **J** | **Coordination multi-agents Claude (sessions parallèles non coordonnées)** | Switches HEAD inopinés, commits interleaved, branche multi-thématique | **Cause #3 — historique constaté.** Mettre garde-fou repo. | `.claude/coordination.md` + CONTRIBUTING.md section multi-agent |

**Délivrable** : `01-triage.md` avec :
- ✅ Liste des catégories ACTIVES MAINTENANT (à T=Phase 0)
- ✅ Liste des catégories HISTORIQUES déjà fixées (preuve : commit/action)
- ✅ Catégorie BLOQUANTE actuelle (celle qui empêche le prochain deploy de réussir)
- ✅ Catégories à traiter durablement Phase 7.5 + Phase 8.bis

---

## 6 · Phase 2 — Investigation forensique AUTOPILOTE (≤ 30 min)

Selon catégorie identifiée en Phase 1, exécuter le run d'investigation correspondant. Documenter dans `02-forensic-<categorie>.md`. Capturer **toujours** :

- Timestamp UTC précis du dernier état "OK" connu (dernier déploiement succès) vs premier état "KO"
- Diff entre les 2 commits encadrants le passage OK → KO (`git log <last_ok_sha>..<first_ko_sha> --oneline --stat`)
- Tout fichier de config Coolify, workflow GH Actions ou env var qui a changé dans cette fenêtre
- Logs bruts (pas de paraphrase) : `docker logs` Coolify ≥ 500 lignes autour de l'incident
- Si A : `SELECT * FROM application_deployment_queues WHERE status NOT IN ('finished','failed','cancelled') ORDER BY created_at LIMIT 20;`
- Si B : stacktrace complète du crash Coolify + `docker inspect coolify` (restart count + exit code)
- Si C : `du -sh /var/lib/docker/* | sort -h | tail -20` + `docker system df` + `docker images --format '{{.Repository}}:{{.Tag}} {{.Size}}' | sort -k2 -h | tail -30`
- Si D : `pg_stat_activity` + `pg_locks` + identification des PIDs bloquants
- Si E : `docker pull ghcr.io/will383842/axion-ia:main` depuis Hetzner SSH (devrait marcher sans auth)
- Si F : `curl -v -H "Authorization: Bearer $TOKEN" "$URL/api/v1/teams"` → vérifier 200
- Si G : `dig ghcr.io`, `traceroute ghcr.io`, `iptables -L -n -v | head -50`
- Si H : `curl ... /api/v1/applications/<uuid>` + diff env vars vs `.env.example` repo

**Délivrable** : `02-root-cause.md` avec :
- ✅ Cause technique exacte (1 phrase)
- ✅ Mécanisme de la panne (3-5 phrases)
- ✅ Pourquoi ça n'a pas été détecté avant (1-2 phrases)
- ✅ Preuves attachées (logs bruts, queries, screenshots si applicable)
- ✅ Estimation impact business (combien d'heures de prod down, combien de visiteurs perdus si CF cache servait encore)

---

## 7 · Phase 3 — Fix AUTOPILOTE + ré-armement (≤ 30 min)

### 7.1 Fix immédiat (déblocage)
Selon catégorie, appliquer l'action de la table Phase 1. **Tracer chaque commande** dans `03-fix-actions.md` avec timestamp + résultat.

**Tu es autorisé à enchaîner les fix de plusieurs catégories** si la cause est composite. Ex : C (disque saturé) + A (queue gelée) → prune disque d'abord, puis kill queue, puis redeploy.

### 7.2 Snapshot post-fix immédiat
Avant de relancer un déploiement, **re-snapshotter** l'état Coolify + Hetzner pour confirmer que le fix a bien levé le blocage :
- `/api/v1/deployments` : plus de déploiement `in_progress` antérieur
- `docker ps` : Coolify en `Up X minutes` (pas restarting)
- `df -h /` : disque > 50 % libre

Si snapshot post-fix montre que le blocage persiste → **rollback** (restart Coolify à nouveau) → ré-investigation Phase 2 catégorie suivante (boucle, max 5 itérations).

### 7.3 Re-trigger déploiement
Une fois le blocage levé :
```bash
cd axionia/
gh workflow run deploy-coolify.yml --ref main
NEW_RUN=$(gh run list --workflow=deploy-coolify.yml --branch main --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch $NEW_RUN
```

### 7.4 Surveillance live multi-fenêtres
En parallèle pendant le `gh run watch` :
- Polling manuel `/api/v1/deployments/$DEPLOYMENT_UUID` toutes les 30s → confirmer transition `queued → in_progress → finished`
- Logs Hetzner SSH `docker logs -f coolify` en streaming pour voir le pull GHCR + restart container
- `docker ps -a` sur Hetzner pour voir le nouveau container app démarrer

### 7.5 Fix durable (anti-récidive) — OBLIGATOIRE même si fix immédiat suffit

Selon root cause, **au moins un** durcissement commité Conventional sur main :

- **Si A (queue hung)** : ajouter step "purge stuck deployments" en début de `deploy-coolify.yml` (curl API Coolify pour cancel tout déploiement `in_progress` > 30 min en début de job)
- **Si B (worker mort)** : ajouter healthcheck container Coolify (compose ou systemd timer) + auto-restart
- **Si C (disque)** : (a) baisser retention des images Docker locales via `cron` : `docker image prune -af --filter "until=24h"`, (b) faire tourner `disk-cleanup-prod.yml` **avant** chaque déploiement (job dépendance), (c) augmenter le slack disque min de 5 GB → 15 GB
- **Si D (lock DB)** : monitoring `pg_stat_activity` via cron + alerte (Telegram bot existant)
- **Si E (image)** : ajouter step "verify GHCR image manifest accessible publicly" avant `POST /deploy` (curl HEAD sur manifest URL)
- **Si F (secrets)** : ajouter step "test API Coolify token validity" en pre-flight (`GET /api/v1/teams`) + alerte 30 jours avant expiration
- **Si G (network)** : monitorer `curl ghcr.io` depuis Hetzner via cron + alerte
- **Si H (env vars)** : ajouter step "compare Coolify env vars vs .env.example" en pre-flight (warning si manquantes)

### 7.6 Bonus durcissement (à appliquer dans tous les cas)
- **Réduire timeout polling Coolify** : 60 min → 15 min
- **Early-fail** : exit 1 si status reste `queued` > 5 min consécutives (signe certain de queue gelée)
- **Concurrency lock** : `concurrency: { group: deploy-main, cancel-in-progress: true }` sur le workflow
- **Notification fail** : webhook Telegram (bot existant) sur failure deploy-coolify.yml
- **Healthcheck post-deploy strict** : 5 endpoints (`/`, `/fr/`, `/en/`, `/sitemap.xml`, `/api/healthz`) doivent retourner 200 en < 30s après deploy avant de marquer succès
- **Skip Lighthouse si déjà en CrUX vert depuis < 7 jours** : économie CI

---

## 8 · Phase 4 — Audit profond infra + workflow + sécurité (≤ 45 min)

**Cette phase est cruciale** : le déploiement peut marcher mais l'infra peut être en état dégradé. Audit profond OBLIGATOIRE pour passer en GREEN final.

### 8.1 Audit workflow `deploy-coolify.yml` (lecture + score)
Critères (chaque ✅/❌) :
- [ ] Concurrency lock présent
- [ ] Timeouts raisonnables (< 30 min total)
- [ ] Retry avec backoff sur appels API Coolify (3 tentatives)
- [ ] Validation pre-flight : token Coolify, image GHCR accessible, env vars Coolify présentes
- [ ] Step healthcheck post-deploy bloquant
- [ ] Step purge CF cache conditionnel sur succès deploy
- [ ] Notification fail (Telegram/email/Slack)
- [ ] Pas de log de secrets (audit grep)
- [ ] `actions/checkout` + autres actions pinnées à des SHA (pas `@v4` mais SHA)
- [ ] Permissions GH minimales (`permissions:` au job level)

Score /10 → si < 8/10, patcher en Phase 3.6.

### 8.2 Audit tous les workflows critiques
Idem 8.1 pour : `ci.yml`, `staging.yml`, `nightly.yml`, `disk-cleanup-prod.yml`, `release.yml`, `gsc-crawl-stats-weekly.yml`. Détecter :
- Workflows désactivés (`if: false`) qui devraient être réactivés
- Workflows en doublon
- Workflows qui exposent des secrets en logs
- Workflows sans timeout (boucle infinie possible)

### 8.3 Audit secrets et rotation
- `gh secret list` : tous les secrets présents
- Pour chaque secret, vérifier dans la doc/code qu'il est encore utilisé (`grep -r "secrets.NOM" .github/`)
- Secrets orphelins (non référencés) → proposer suppression
- Secrets qui ressemblent à des passwords ou tokens longue durée → recommander rotation

### 8.4 Audit GHCR
- Liste des packages du user `will383842`
- Visibilité (public/private)
- Retention policy (combien de versions gardées)
- Total taille (impact quota GitHub Free 500 MB → upgrade nécessaire si dépassé)

### 8.5 Audit Coolify (post-fix)
- Liste applications + statut
- Pour chaque app : config (image, env vars, healthcheck, volumes, network)
- Backups Postgres Coolify (existent ? automatisés ? rétention ?)
- Version Coolify (à jour ?)
- Updates dispo ?

### 8.6 Audit Hetzner CPX42
- Uptime
- Load avg
- Disk usage par mount
- RAM / swap
- Snapshots Hetzner Cloud (backups infra)
- Firewall règles (Hetzner Cloud + iptables host)
- Updates système (`apt list --upgradable | head -20` si Debian/Ubuntu)
- Certificats SSL (Caddy auto-renew → vérifier dernière date renew)

### 8.7 Audit Cloudflare
- Toutes les Cache Rules
- Page Rules legacy résiduelles ?
- WAF rules actives
- Analytics last 24h : trafic, errors 5xx, errors 4xx
- Bot Fight Mode + AI Scrapers state
- Workers actifs ?
- DNS records : tous orange ?

### 8.8 Audit code applicatif vs prod
- Lire `axionia/package.json` → version applicative
- Comparer avec version visible en prod (header / footer / build-info endpoint)
- Si divergence → confirmer que le bon SHA est servi

### 8.9 Audit sécurité minimal
- Pas de secret commité dans le repo (`git log -p | grep -iE "(BEGIN PRIVATE KEY|api_key|password.*=)"` quick scan)
- `.env*` bien dans `.gitignore`
- Pas de fichier `.env` commité par erreur
- `gitleaks` doit avoir tourné récemment

### 8.10 Audit Web Vitals + SEO post-deploy (sample)
- Lighthouse sur `/`, `/fr/`, `/fr/galerie`, `/fr/reserver` (mobile + desktop)
- LCP, INP, CLS doivent matcher thresholds `lighthouserc.json`
- JSON-LD validé sur 3 pages (curl + jq)
- Sitemap XML valide (xmllint)
- robots.txt cohérent

**Délivrable** : `04-audit-profond.md` avec scores /10 par sous-section + 04-action-items.md (P0/P1/P2/P3).

---

## 8.bis · Phase 4.bis — 🛠️ SPRINT CI/CD CLEANUP OBLIGATOIRE (≤ 60 min) 🛠️

**Cette phase est NON-NÉGOCIABLE et fait partie du contrat autopilote.** Sans ce sprint, les 13 fix appliqués hier resteront fragiles et le prochain push cassera tout à nouveau.

### 8.bis.1 — Pré-requis
- Audit Phase 8 terminé
- Liste des 13 fix CI récents identifiés via `git log --oneline --since="2026-05-16" -- .github/workflows/`
- Comprendre chaque fix : était-ce un patch ou un workaround ?

### 8.bis.2 — Les 6 points obligatoires (1 commit par point ou batch logique)

#### Point 1 — Coverage threshold ratchet
- Vérifier que coverage threshold est aligné sur réalité actuelle (probablement ~30-40% pas 60%)
- Mettre en place un **ratchet** : le seuil monte automatiquement quand coverage s'améliore, ne baisse jamais
- Outil : `vitest --coverage` config + un script `scripts/ci/coverage-ratchet.ts` qui compare avec baseline et fail si baisse
- Commit : `fix(ci): coverage threshold ratchet aligned with reality (was 60% unrealistic)`

#### Point 2 — Réordonner steps Gate B
- Lire `.github/workflows/ci.yml` job Gate B
- Repositionner `pnpm exec playwright install --with-deps chromium` AVANT `bundle:check`
- Vérifier que toutes les étapes qui requièrent Chrome (Playwright, Lighthouse local, bundle:check) sont après l'install
- Commit : `fix(ci): gate B reorder — Playwright install AVANT bundle:check`

#### Point 3 — Migrer size-limit vers preset-app
- Lire `package.json` config `size-limit`
- Si plugin Puppeteer/Chrome utilisé → migrer vers `@size-limit/preset-app` qui n'a pas besoin de browser
- Tester localement que la mesure est cohérente
- Commit : `fix(ci): size-limit migrate preset-app — no more Chrome dep`

#### Point 4 — Playwright webServer CI-aware
- Lire `playwright.config.ts`
- Modifier `webServer` pour gérer 2 modes :
  - Local dev : démarre `pnpm dev`
  - CI : utilise `pnpm start` après build, avec env vars CI fournies
- Ajouter step CI `Build for E2E` AVANT `Run Playwright`
- Commit : `fix(ci): playwright webServer CI-aware (build + start, not dev)`

#### Point 5 — `.env.ci` séparé documenté
- Créer `.env.ci.example` avec TOUTES les env vars requises pour CI (stubs/dummy values)
- Documenter dans `docs/ci/ENV-VARS.md` : 3 colonnes (Variable / Prod source / CI value / Required for)
- Workflow `ci.yml` consomme `.env.ci.example` comme source via `cp .env.ci.example .env`
- Lister les env vars manquantes actuelles : `IP_HASH_SALT`, `PII_ENCRYPTION_KEY`, `INDEXNOW_INTERNAL_HMAC_SECRET`, `DOCUSEAL_STRICT_HMAC`, +autres détectées Phase 8
- Commit : `docs(ci): env-vars CI vs prod separated + .env.ci.example`

#### Point 6 — Auto-cleanup zombie deploys Coolify
- Créer `.github/workflows/coolify-zombie-cleanup.yml` (cron daily 03:30 UTC, juste après disk-cleanup) :
```yaml
name: Coolify Zombie Deploy Cleanup
on:
  schedule: [{ cron: '30 3 * * *' }]
  workflow_dispatch:
jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Cancel stuck in_progress deployments > 30 min
        env:
          COOLIFY_API_TOKEN: ${{ secrets.COOLIFY_API_TOKEN }}
          COOLIFY_URL: ${{ secrets.COOLIFY_URL }}
        run: |
          set -e
          NOW=$(date -u +%s)
          THRESHOLD=$((NOW - 1800))  # 30 min
          STUCK=$(curl -s -H "Authorization: Bearer $COOLIFY_API_TOKEN" "$COOLIFY_URL/api/v1/deployments" \
            | jq -r --argjson th "$THRESHOLD" '.[] | select(.status == "in_progress" and (.created_at | fromdateiso8601) < $th) | .uuid')
          if [ -z "$STUCK" ]; then echo "No zombies found"; exit 0; fi
          for uuid in $STUCK; do
            echo "::warning::Cancelling zombie $uuid"
            curl -s -X POST -H "Authorization: Bearer $COOLIFY_API_TOKEN" "$COOLIFY_URL/api/v1/deployments/$uuid/cancel"
          done
```
- Commit : `feat(ci): coolify zombie deploy auto-cleanup cron daily (anti-Cause-#2)`

### 8.bis.3 — Garde-fou coordination multi-agents (Cause #3)
- Créer `axionia/.claude/coordination.md` :
```markdown
# Multi-agent Claude coordination

Si plusieurs sessions Claude travaillent sur le repo en parallèle :

## Règles obligatoires
1. **Une session = une branche feature**. Jamais 2 sessions sur la même branche.
2. **Main est lock** : aucune session ne push directement sur main sans confirmation Will explicite hors PR.
3. **Coordination via fichier** : avant de start, écrire dans `.claude/active-sessions.md` (locked file) :
   ```
   - session-<uuid> | branch=<name> | started=<ts> | scope=<short desc> | owner=<conv-id>
   ```
4. **Au démarrage**, lire `.claude/active-sessions.md` et SI une autre session est sur la même branche → STOP & ASK Will (override autopilote autorisé).
5. **À la fin** (ou crash), nettoyer son entrée dans `.claude/active-sessions.md`.

## En cas de conflit constaté
- Switches HEAD inopinés → vérifier `.claude/active-sessions.md`
- Commits interleaved → `git log --oneline -20` et identifier qui a écrit quoi (committer)
- Si overwrite détecté → `git reflog` pour récupérer
```
- Créer `axionia/.claude/active-sessions.md` vide initial (template avec format clair)
- Mettre à jour `CONTRIBUTING.md` avec section "Working with multiple Claude sessions"
- Commit : `docs(repo): multi-agent Claude coordination guardrails (anti-Cause-#3)`

### 8.bis.4 — Validation post-Sprint
- Re-run `gh workflow run ci.yml --ref main` (PR de validation OU push direct si Sprint déjà commité)
- Tous les Gates A + B + C + D doivent passer en < 30 min total
- Si fail → identifier quel Point a régressé → fix → re-run (max 3 itérations)

### 8.bis.5 — Documentation des 13 fix CI hier
- Lister dans `_AUDIT/DEPLOY-RECOVERY-2026-05-17/06-ci-debt-history.md` les 13 commits avec :
  - SHA + message + date
  - Quelle des 5 Causes empilées il patche
  - Si le Sprint cleanup le rend obsolète → marquer "OBSOLETED by Sprint cleanup point N"
- Cette doc sert au prochain audit pour comprendre pourquoi ces fix sont dans l'historique

---

## 9 · Phase 5 — Recommit + push HEAD finale AUTOPILOTE (≤ 25 min)

### 9.1 Décider du sort des fichiers non commités
Au moment T0 de ce prompt, fichiers `M` détectés :
- `axionia/`: CHANGELOG.md, audits image-bank, pages admin image-bank, sitemaps, lighthouserc.json, package.json, schema.prisma, components, etc. (≥ 60 fichiers)
- super-repo: `_AUDIT/CHANGELOG-v10.2.md` (deleted), `_AUDIT/CONTENT-GEN-V1-AUTOPILOT-LOG.md` (modified)

**Stratégie autopilote** (pas d'attente Will) :
1. **Audits seuls** (`_AUDIT/**`) → commit unique `docs(audit): batch audits image-bank + post-fix deploy 2026-05-17`
2. **Code applicatif** (pages admin, sitemaps, components, scripts) → analyser le diff
   - Si lié à PR #14 patches → commit `fix(image-bank): patches post-merge cleanup`
   - Si lié à autre chose → commits séparés par domaine
3. **Config repo** (lighthouserc.json, package.json) → `chore(config): align thresholds + deps post-audit`
4. **Schema/migrations Prisma** → SI changement → `feat(db)` ou `fix(db)` avec migration nommée
5. **Fichiers temporaires/debug** → si pertinents, commit ; sinon `git checkout --` (avec log)
6. **Generated files** (généralement à exclure) → vérifier .gitignore, si oubli → fix .gitignore + commit

### 9.2 Avant push : sanity checks bloquants
Dans `axionia/` :
- `pnpm install` (idempotent)
- `pnpm typecheck` → doit passer
- `pnpm lint` → doit passer (warnings OK, errors KO)
- `pnpm test --run` (Vitest) → tests verts (au moins ceux du module touché)
- `pnpm prisma migrate diff` → propre (pas de drift)
- `pnpm isolation:check` (script repo) → propre
- `git diff --staged --stat` → review final

Si un check fail → fixer le check (ne pas push avec fail) → max 3 itérations sinon stash + escalade.

### 9.3 Push + suivi
- `git push origin main` (sous-repo d'abord) + (super-repo ensuite si pertinent)
- **Jamais force**. Si push refused (non-fast-forward) → `git pull --rebase` + résoudre conflits + retest + push
- Surveiller le nouveau run `deploy-coolify.yml` en live (gh run watch)

### 9.4 Vérifier que le nouveau commit triggere bien le pipeline
- Si pas de trigger auto (rare) → `gh workflow run deploy-coolify.yml --ref main`
- Confirmer SHA déployé = HEAD main après deploy success

---

## 10 · Phase 6 — Smoke prod profond 30+ routes AUTOPILOTE (≤ 15 min)

Une fois pipeline vert + CF cache purgé, vérifier en HTTP (Bash boucle) :

```bash
ROUTES=(
  # Home
  "/" "/fr/" "/en/"
  # Pages produit principales
  "/fr/interventions" "/fr/audits" "/fr/implementations"
  "/en/interventions" "/en/audits" "/en/implementations"
  # Pages méthodologie/marque
  "/fr/methodologie" "/en/methodology"
  "/fr/comparaisons" "/en/comparisons"
  "/fr/guide-ia" "/en/ai-guide"
  "/fr/stack-ia" "/en/ai-stack"
  # Booking
  "/fr/reserver" "/en/book"
  # Galerie image-bank
  "/fr/galerie" "/en/gallery"
  "/fr/galerie/audits" "/fr/galerie/interventions-formations" "/fr/galerie/implementations"
  # Contact & legal
  "/fr/contact" "/en/contact"
  "/fr/mentions-legales" "/en/legal-notice"
  "/fr/politique-confidentialite" "/en/privacy-policy"
  # SEO files
  "/sitemap.xml" "/sitemap-index.xml" "/robots.txt" "/manifest.webmanifest"
  # Sitemaps secondaires
  "/sitemaps/images-fr.xml" "/sitemaps/images-en.xml"
  # API publiques (HEAD ou GET safe)
  "/api/healthz"
  # Page ville pilote
  "/fr/audit/par-ville/paris" "/fr/interventions/par-ville/paris" "/fr/implementation/par-ville/paris"
  # Admin (doit retourner 401 ou redirect, pas 500)
  "/admin/login"
)

PASS=0; FAIL=0
for r in "${ROUTES[@]}"; do
  read code time_total < <(curl -sIL -o /dev/null -w "%{http_code} %{time_total}" "https://axion-ia.com$r")
  cache=$(curl -sIL "https://axion-ia.com$r" | grep -i cf-cache-status | awk '{print $2}' | tr -d '\r\n')
  if [[ "$code" =~ ^(200|301|308|401|403)$ ]]; then
    echo "✅ $code [$cache] ${time_total}s  $r"
    PASS=$((PASS+1))
  else
    echo "❌ $code [$cache] ${time_total}s  $r"
    FAIL=$((FAIL+1))
  fi
done
echo "RESULT: $PASS pass / $FAIL fail / $((PASS+FAIL)) total"
```

**Critères d'acceptation GREEN** :
- ✅ **100 % des routes ≠ 500/502/503/504**
- ✅ Pages publiques : 200 ou 308 (redir trailing slash)
- ✅ Sitemaps : 200 + content-type `application/xml`
- ✅ `cf-cache-status` : majoritairement `HIT`/`MISS` (pas `DYNAMIC` partout)
- ✅ `time_total` médian < 500ms
- ✅ Admin login : 200 ou redirect (pas 500)

**Si FAIL > 0** → identifier les routes KO + investigation focalisée + fix (potentiellement Phase 2 re-bouclée pour cause spécifique route).

### 10.1 Smoke avancé
- POST `/api/contact` avec body de test minimal → 200/202 ou validation error attendue (pas 500)
- GET `/api/healthz` → 200 + JSON `{status: "ok"}`
- Download image bank `/fr/galerie/<slug>/telecharger` (premier slug du sitemap-images) → 200 + content-type image
- Vérifier IndexNow fonctionne via test ping
- JSON-LD valide sur `/`, `/fr/reserver`, `/fr/galerie/paris` (curl + jq)

### 10.2 Build SHA assertion
- Récupérer le SHA visible en prod (header `x-axion-build-sha` ou meta tag ou footer)
- Doit ÉGALER `git rev-parse HEAD` du repo `axionia` post-Phase 5
- Si différent → le déploiement n'a pas vraiment livré la dernière version → retour Phase 2

### 10.3 Workers BullMQ (background jobs)
- Si endpoint admin existe : vérifier que les workers image-bank (variants, watermark, OCR, AI translation) + content-gen sont `running`
- Sinon : SSH Hetzner → `docker ps | grep worker` → tous `Up`

---

## 11 · Phase 7 — Post-mortem + memory AUTOPILOTE (≤ 20 min)

### 11.1 Livrables
Créer ces fichiers dans `_AUDIT/DEPLOY-RECOVERY-2026-05-17/` :
- `00-snapshot/` — outputs Phase 0 (raws)
- `01-triage.md` — catégorie + preuves
- `02-root-cause.md` — analyse forensique
- `03-fix-actions.md` — log horodaté des commandes exécutées
- `04-audit-profond.md` — Phase 4 (scores + action items)
- `04-action-items.md` — P0/P1/P2/P3 priorisés
- `05-verdict.md` — verdict final (🟢 GREEN / 🟡 PARTIAL / 🔴 RED) + temps total
- `06-post-mortem.md` — timeline incident + 5 whys + action items
- `99-RAPPORT-WILL.md` — rapport ≤ 30 lignes pour Will
- `RUNBOOK-DEPLOY-STUCK.md` (recopié dans `docs/ops/`)

### 11.2 Commit final
```
docs(ops): deploy recovery 2026-05-17 — runbook + post-mortem + ADR XXXX

Root cause: <X>
Fix immédiat: <Y> (commit <SHA>)
Fix durable: <Z> (commit <SHA>)
Smoke prod: 30/30 routes OK
```

### 11.3 Memory entries à écrire (super-repo `C:\Users\willi\.claude\projects\C--Users-willi\memory\`)
Créer fichier `axionia_deploy_recovery_2026-05-17.md` :
```markdown
---
name: axionia-deploy-recovery-2026-05-17
description: Pipeline GHCR+Coolify restauré 2026-05-17 après blocage queue Coolify
metadata:
  type: project
---

# AxionIA deploy recovery 2026-05-17 — root cause <X>

Pipeline GHCR+Coolify restauré. Cause : <X en 1 phrase>.
Fix durable : <Y en 1 phrase>.
Runbook : `docs/ops/RUNBOOK-DEPLOY-STUCK.md` (axionia repo).
Smoke 30/30 routes OK. SHA prod = HEAD main.

Voir aussi [[axionia_session_2026-05-16_deploy_recovery_resolved]].

**Why:** Ne plus reperdre 4 heures sur ce mode de panne.
**How to apply:** Si "Trigger Coolify deploy" reste en queued > 5 min, suivre le runbook.
```

Ajouter ligne dans `MEMORY.md` :
```
- [✅ AxionIA deploy recovery 2026-05-17 — root cause <X>](axionia_deploy_recovery_2026-05-17.md) — Pipeline GHCR+Coolify restauré. Fix durable runbook + workflow durci. Smoke 30/30.
```

Mettre à jour memories existantes si état d'infra a changé :
- `axionia_session_2026-05-16_deploy_recovery_resolved` (état précédent)
- `axionia_domain_hosting` (si URL Coolify, IP, ou config a bougé)

### 11.4 ADR si décision archi durable prise
Créer `axionia/docs/adr/00XX-coolify-deploy-monitoring.md` (numéro suivant disponible) avec :
- Contexte (incident)
- Décision (durcissements appliqués)
- Conséquences (positives + négatives)
- Alternatives rejetées

### 11.5 Cleanup repo
- Supprimer workflows diagnostic temporaires (`coolify-diagnose.yml`, `hetzner-diagnose.yml`) **OU** les garder en `workflow_dispatch` only avec doc claire (recommandé pour récidive future)
- Si gardés : ajouter README dans `docs/ops/` qui documente leur usage

---

## 12 · Contraintes & garde-fous (RAPPEL CRITIQUE même en autopilot)

- ❌ **JAMAIS `git push --force` sur main**
- ❌ **JAMAIS `--no-verify` sur commits**
- ❌ **JAMAIS skip hooks**
- ❌ **JAMAIS réactiver le build in-place Coolify** (ADR 0026)
- ❌ **JAMAIS modifier la stack** (Hetzner CPX42 + Coolify + Caddy + CF Free)
- ❌ **JAMAIS log brut des secrets** dans fichiers commités/logs publics — utiliser `::add-mask::`
- ❌ **JAMAIS commit de `.env*` réels** (gitignore strict)
- ❌ **JAMAIS supprimer un secret GH Actions sans backup confirmé**
- ❌ **JAMAIS drop/truncate la DB Coolify** (queue purge OK, drop NON)
- ✅ **En cas de doute entre 2 actions, prendre la moins destructive** (lire avant kill)
- ✅ **Boucle "détecter→fix→vérifier" max 5 itérations** puis escalade Will
- ✅ **Snapshots avant chaque action destructive** (état pre-fix sauvé dans `00-snapshot/`)
- ✅ **Tous les commands `docker ... prune ... -f` doivent passer par confirm logique** (vérifier que df > 90 % avant prune par exemple)

---

## 13 · Critères de succès finaux (Gate de fin GREEN)

Le travail est terminé **uniquement** si **TOUS** ces points sont ✅ :

### Catégorie A — Déploiement opérationnel
- [ ] Root cause(s) composite(s) documentée(s) avec preuves dans `02-root-cause.md` (les 5 causes empilées identifiées + état actuel de chacune)
- [ ] Fix immédiat appliqué et validé (déploiement vert end-to-end)
- [ ] Fix durable commité Conventional + pushé main
- [ ] Workflow `deploy-coolify.yml` vert sur le dernier commit de main
- [ ] Image GHCR du dernier SHA main publiée et servie en prod
- [ ] **30+/30+ routes smoke OK** sur `https://axion-ia.com`
- [ ] `cf-cache-status` confirme CF actif (majorité HIT/MISS)
- [ ] **SHA de build visible en prod = `HEAD main`**
- [ ] Lighthouse post-deploy gate vert (ou justifié)

### Catégorie B — Anti-récidive durable (Phase 8.bis Sprint CI/CD)
- [ ] **Point 1** : Coverage threshold ratchet en place + commité
- [ ] **Point 2** : Gate B steps réordonnés (Playwright AVANT bundle:check) + commité
- [ ] **Point 3** : size-limit migré preset-app + commité
- [ ] **Point 4** : Playwright webServer CI-aware + commité
- [ ] **Point 5** : `.env.ci.example` + `docs/ci/ENV-VARS.md` créés + commités
- [ ] **Point 6** : Workflow `coolify-zombie-cleanup.yml` (cron) créé + commité
- [ ] **Garde-fou multi-agents** : `.claude/coordination.md` + `.claude/active-sessions.md` + CONTRIBUTING.md section créés

### Catégorie C — Audit profond + livrables
- [ ] Audit profond Phase 4 livré, scores ≥ 8/10 par section (ou action items P0 traités dans Sprint cleanup)
- [ ] `06-ci-debt-history.md` : les 13 fix CI mappés aux 5 Causes + état OBSOLETED post-cleanup
- [ ] Runbook `docs/ops/RUNBOOK-DEPLOY-STUCK.md` commité + scripté (`.sh` exécutable)
- [ ] Post-mortem `_AUDIT/DEPLOY-RECOVERY-2026-05-17/07-post-mortem.md` commité (renumérotation : était 06)
- [ ] Entry memory ajoutée (`axionia_deploy_recovery_2026-05-17.md` + ligne dans `MEMORY.md`)
- [ ] ADR créée si décision archi durable (cron zombie cleanup, .env.ci structure)

### Catégorie D — Cleanup & non-régression
- [ ] Tous les fichiers `M` de Phase 0 sont soit commités soit explicitement stashés/discardés (zéro oubli)
- [ ] Workflows diagnostic temporaires : nettoyés ou documentés
- [ ] **Aucune régression** détectée : autres workflows (ci.yml, staging.yml, nightly.yml) toujours verts après Sprint cleanup
- [ ] `gh run list --limit 5 --branch main` montre Build & Deploy + CI = success

### Catégorie E — Communication
- [ ] **Rapport final à Will** : 1 message ≤ 30 lignes (format §14) avec **les 5 causes adressées** + récap Sprint cleanup

Si UN seul critère manque → relancer la boucle "détecter→fix→vérifier" jusqu'à GREEN total ou plafond 5 itérations.

---

## 14 · Format du rapport final à Will (≤ 40 lignes)

```
🟢 DEPLOY RESTAURÉ + DETTE CI/CD RÉSORBÉE — axion-ia.com EN LIGNE
Durée totale : <X>h <Y>min — <N> itérations

## 5 causes empilées identifiées + traitées
1. 🔧 Dette CI/CD     → Sprint cleanup 6 points ✅ (commits <SHA1>..<SHA6>)
2. 🧟 Zombie Coolify  → cancelé + cron auto-cleanup ✅ (commit <SHA>)
3. 🤖 Multi-agents    → garde-fou .claude/coordination.md ✅ (commit <SHA>)
4. 🏗️  Env vars       → set <N> vars Coolify + .env.ci.example ✅ (commit <SHA>)
5. ⏱️  Build local    → optimisé (matrix CI, cache layers) ✅ (commit <SHA>)

## Smoke prod
30+/30+ routes ✅ — SHA déployé : <sha> — Lighthouse <score>/100/100/100

## Audit profond
- Workflows score: <X>/10 (avant: <Y>/10)
- Coolify: <état> — zombies: 0 — queue: clean
- Hetzner CPX42: disque <X>% — RAM <Y>% — uptime <Z>j
- Cloudflare: <N> cache rules OK — WAF OK — DNSSEC <état>
- Sécurité: 0 secret leak — gitleaks ✅ — secrets rotation: <date prochaine>

## Action items P0 restants
- <action 1> (ou "aucune")

## Action items P1-P3 backloggés
- <count> items dans `_AUDIT/DEPLOY-RECOVERY-2026-05-17/04-action-items.md`

## Livrables
- _AUDIT/DEPLOY-RECOVERY-2026-05-17/ (<N> fichiers : snapshot, triage, root-cause, fix-actions, audit-profond, ci-debt-history, post-mortem, RAPPORT-WILL)
- docs/ops/RUNBOOK-DEPLOY-STUCK.md + scripts/ops/*.sh
- docs/ci/ENV-VARS.md + .env.ci.example
- .github/workflows/coolify-zombie-cleanup.yml
- .claude/coordination.md + .claude/active-sessions.md + CONTRIBUTING.md (section multi-agent)
- ADR <NNNN>-coolify-deploy-monitoring.md
- Memory: axionia_deploy_recovery_2026-05-17.md

## Itérations exécutées
1. <résumé itération 1>
2. <résumé itération 2>
...

## Recommandations post-session (humaines)
- <recommandation 1> (ex: rotation token Coolify dans 30j)
- <recommandation 2> (ex: vérifier que monitoring zombie cron a tourné dans 24h)
```

---

## 15 · Annexes utiles pour l'autopilote

### 15.1 Scripts SSH réutilisables (à commit dans `scripts/ops/`)

**`scripts/ops/hetzner-coolify-health.sh`** :
```bash
#!/usr/bin/env bash
set -euo pipefail
echo "=== DISK ===" ; df -h /
echo "=== RAM ===" ; free -h
echo "=== UPTIME ===" ; uptime
echo "=== DOCKER PS ===" ; docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' | head -30
echo "=== DOCKER STATS ===" ; docker stats --no-stream | head -15
echo "=== COOLIFY LOGS (last 100) ===" ; docker logs --tail 100 $(docker ps --format '{{.Names}}' | grep -i coolify | head -1) 2>&1 | tail -100
echo "=== DEPLOYMENT QUEUE ===" ; docker exec $(docker ps --format '{{.Names}}' | grep -i coolify-db | head -1) psql -U coolify -c "SELECT id, status, created_at FROM application_deployment_queues ORDER BY created_at DESC LIMIT 10;" 2>/dev/null || echo "(query failed)"
echo "=== NET CHECK GHCR ===" ; curl -sIL https://ghcr.io/v2/ | head -5
```

**`scripts/ops/coolify-cancel-stuck.sh`** :
```bash
#!/usr/bin/env bash
set -euo pipefail
: "${COOLIFY_API_TOKEN:?required}"
: "${COOLIFY_URL:?required}"
STUCK=$(curl -s -H "Authorization: Bearer $COOLIFY_API_TOKEN" "$COOLIFY_URL/api/v1/deployments" | jq -r '.[] | select(.status == "in_progress" or .status == "queued") | .uuid')
for uuid in $STUCK; do
  echo "Cancelling $uuid"
  curl -s -X POST -H "Authorization: Bearer $COOLIFY_API_TOKEN" "$COOLIFY_URL/api/v1/deployments/$uuid/cancel" | jq '.'
done
```

### 15.2 Healthcheck endpoint à créer si absent
Si `/api/healthz` n'existe pas dans axionia/, le créer (Next.js App Router) :
```typescript
// src/app/api/healthz/route.ts
import { NextResponse } from 'next/server';
export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    sha: process.env.NEXT_PUBLIC_BUILD_SHA ?? 'unknown',
    ts: new Date().toISOString(),
  });
}
```

### 15.3 Header build SHA si absent
Vérifier dans `next.config.ts` qu'un header `x-axion-build-sha` est posé :
```typescript
async headers() {
  return [{ source: '/(.*)', headers: [{ key: 'x-axion-build-sha', value: process.env.BUILD_SHA ?? 'dev' }] }];
}
```

### 15.4 Phrase d'invocation à coller dans une session Claude fraîche

> Exécute le prompt master `axionia/_AUDIT/PROMPT-DEPLOY-RECOVERY-PERFECTION-2026-05-17.md`. **MODE AUTOPILOTE TOTAL — autorisation Will explicite 2026-05-17.** Suis les phases 0 → 7 dans l'ordre, **Phase 8.bis Sprint CI/CD cleanup obligatoire**. Boucle "détecter→fix→vérifier" max 5 itérations. **AUCUN STOP & ASK** sauf les 3 cas du §0. Pars de l'**analyse cross-session §1.5 (5 causes empilées)** comme base et traite les 5 + Sprint cleanup 6 points + garde-fou multi-agents. Livrables dans `_AUDIT/DEPLOY-RECOVERY-2026-05-17/`. Rapport final format §14.

---

## 16 · Récapitulatif des sections (table des matières)

| § | Section | Phase | Durée cible |
|---|---------|-------|-------------|
| 0 | Mode autopilote total — règles d'engagement | — | — |
| 1 | TL;DR problème observé | — | — |
| **1.5** | **🚨 Analyse cross-session — 5 causes empilées** | — | — |
| 2 | Stack & doctrine | — | — |
| 3 | Mission — 5 livrables | — | — |
| 4 | Phase 0 — Snapshot initial | Phase 0 | 20 min |
| 5 | Phase 1 — Triage composite (10 catégories) | Phase 1 | 15 min |
| 6 | Phase 2 — Investigation forensique | Phase 2 | 30 min |
| 7 | Phase 3 — Fix + ré-armement | Phase 3 | 30 min |
| 8 | Phase 4 — Audit profond infra+sécu | Phase 4 | 45 min |
| **8.bis** | **🛠️ Phase 4.bis — Sprint CI/CD cleanup (6 points + garde-fou)** | **Phase 4.bis** | **60 min** |
| 9 | Phase 5 — Recommit + push HEAD finale | Phase 5 | 25 min |
| 10 | Phase 6 — Smoke prod profond 30+ routes | Phase 6 | 15 min |
| 11 | Phase 7 — Post-mortem + memory + ADR | Phase 7 | 20 min |
| 12 | Contraintes & garde-fous | — | — |
| 13 | Critères de succès finaux (Gate GREEN) — 5 catégories | — | — |
| 14 | Format rapport final Will | — | — |
| 15 | Annexes (scripts, healthcheck, header SHA, phrase invocation) | — | — |
| 16 | Récapitulatif | — | — |

**Durée totale cible** : ~4h30 (1 itération clean) → 6h30 max (avec 2-3 itérations sur fix composites)

---

**FIN DU PROMPT MASTER — AUTOPILOTE TOTAL v2 (intègre les 5 causes empilées).**
