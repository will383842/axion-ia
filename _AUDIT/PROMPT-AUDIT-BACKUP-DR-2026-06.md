# PROMPT — Audit & mise en place d'un système de sauvegarde / DR complet de bout en bout (Axion-IA)

> **Mode d'emploi** : copie-colle l'intégralité de ce fichier comme **premier message** d'une nouvelle conversation Claude Code, à la racine du projet `Axion-IA`. Le prompt est auto-portant : il contient tout le contexte connu au 2026-06-03, mais tu dois **tout re-vérifier sur le terrain** (le contexte peut avoir bougé).

---

## 🎯 Mission

Tu es un ingénieur SRE/plateforme senior spécialisé sauvegarde & disaster recovery, en juin 2026. Ta mission en **3 temps** :

1. **AUDITER** l'état réel et exhaustif de la sauvegarde de TOUTE la plateforme Axion-IA, de bout en bout (code, données, fichiers, secrets, config infra, services tiers self-hosted).
2. **IDENTIFIER les trous** par rapport aux meilleures pratiques de sauvegarde/DR de juin 2026 (détaillées plus bas), avec une matrice composant × couverture.
3. **PROPOSER ET (après validation Will) IMPLÉMENTER** : (a) un vrai système de sauvegarde complet, automatisé, chiffré, multi-destination, à restauration testée ; (b) **un tableau de bord « Sauvegardes » dans la console d'administration** donnant la visibilité et le suivi complet de toutes les sauvegardes.

⚠️ **STOP & ASK obligatoire** : ne lance AUCUNE écriture de code/infra avant d'avoir présenté à Will l'audit + la matrice de trous + le plan, et obtenu son GO. Procède en **mode plan d'abord** (`EnterPlanMode`). Cette tâche touche au build, aux secrets et à la prod — chaque `git push main` = un déploiement (voir doctrine plus bas).

---

## 🗺️ Contexte plateforme connu (à VÉRIFIER, daté 2026-06-03)

**Hébergement** : VPS **Hetzner** (CPX42 / la doc mentionne aussi CPX32 selon docs — à confirmer), orchestré par **Coolify**. Build Docker **externalisé sur GitHub Actions** → image poussée sur **GHCR public** (`ghcr.io/will383842/axion-ia`), Coolify ne fait que `pull` (`Dockerfile.coolify-pull`). CDN/WAF/DNS = **Cloudflare**. Voir `axionia/AGENTS.md` (racine) et ADR 0026.

**Stack applicative (`axionia/docker/docker-compose.production.yml`)** :
- `postgres:16-alpine` — volume `postgres_data_prod` (la DB principale = quasi toute la donnée métier : villes pSEO, knowledge base / content engine, bookings, image-bank, users…)
- `redis:7-alpine` — AOF activé, `noeviction`, volume `redis_data_prod` (BullMQ : 3 workers, jobs de génération de contenu/images/emails/indexnow)
- `app` (Next.js 16 standalone), `worker` (BullMQ), `caddy` (reverse-proxy, volumes `caddy_data`/`caddy_config`)

**Stockage objet / fichiers** :
- **Hetzner Storage Box** (`HETZNER_STORAGE_*`, bucket `axion-ia-prod`, S3-compatible) = **backups DB ET uploads images** (originaux + variants WebP/AVIF/LQIP/thumbnail de l'image-bank / content engine). ⚠️ Donc certaines données vivent là, pas seulement dans Postgres.
- **Cloudflare R2** = destination backup off-Hetzner.

**Services self-hosted annexes (chacun a SA propre donnée à sauvegarder)** :
- **Plausible Analytics** auto-hébergé (`axionia/infra/plausible/docker-compose.yml`) — Postgres + ClickHouse.
- **Docuseal** auto-hébergé (`axionia/deploy/docuseal/docker-compose.yml`) — DB signatures/documents.
- **Sentry** (`sentry.axion-ia.com`) — error tracking (self-hosted ? à confirmer).
- **Stack monitoring** (`axionia/docker/monitoring/docker-compose.monitoring.yml`) — Prometheus/Grafana probable.
- **PowerMTA / MailWizz** (emailing) — données listes/templates éventuelles.

**Secrets & config (sources de vérité multiples — TOUTES à couvrir)** :
- `.env*` locaux : `axionia/.env.production.example`, `.env.example`, `.env.dev`, `.env.local`, `.env.ci.example`.
- Dossiers secrets locaux repérés : `.secrets/api-tokens.env`, `.secrets-coolify/coolify-env-*.env` (à la racine `Axion-IA/`).
- **Coolify env vars** (source de vérité runtime des 8+ secrets prod injectés au container).
- **GitHub Actions secrets** (build-time : `SENTRY_AUTH_TOKEN`, token Coolify, creds GHCR, 7 secrets CI du drill restore — cf. `_AUDIT/CI-SECRETS-REQUIRED.md`).
- **Cloudflare** : DNS records, WAF, page rules, Turnstile keys.
- Coffre humain : 1Password + papier (cf. `_AUDIT/SECRETS-ROTATION-LOG.md`).

**Ce qui existe DÉJÀ en backup (point de départ — NE PAS réinventer, ÉTENDRE)** :
- ADR **0022** `axionia/docs/adr/0022-backup-strategy-scripts-only.md` : décision « scripts custom, pas Coolify integrated ».
- `axionia/scripts/backup-postgres.sh` (189 l.) : `pg_dump` → gzip -9 → openssl AES-256-CBC PBKDF2 100k → rsync SSH Hetzner Storage Box ; rotation 7d/4w/12m ; alertes Telegram (succès/échec/cascading-fail) ; mode `--restore`.
- `axionia/scripts/backup-postgres-r2.sh` : variante destination Cloudflare R2.
- `axionia/scripts/restore-postgres-test.sh` + `restore-postgres-test-r2.sh` : drills restore.
- Runbook `axionia/docs/runbooks/R22-pg-restore-drill.md`.
- Audit DR existant : `axionia/_AUDIT/AUDIT-FINAL-PROD-READY-2026-05-22/agents/prod-readiness/Pr-04-backups-dr.md` (**score 18/25** — gaps connus : drill mensuel non prouvé récurrent, RTO/RPO non chiffrés, monitoring cron VPS manuel).
- Couche Hetzner : **Backups Auto VPS** (image quotidienne ~1,30 €/mois) + snapshots manuels pré-modif risquée.
- Inventaire cron VPS : `_AUDIT/CRON-VPS-INVENTORY.md` ; log drills : `_AUDIT/PG-RESTORE-DRILL-LOG.md`.

---

## ❓ Question Hetzner à trancher dans l'audit

Oui, **Hetzner sauvegarde probablement déjà** à deux niveaux, mais ce n'est PAS suffisant seul — il faut le confirmer et le qualifier :
- **Hetzner Backups Auto** = snapshot quotidien de l'image VPS entière (OS + Docker + DB en bloc). ✅ Recovery whole-VPS rapide MAIS : non atomique pour la DB, rétention limitée (~7 slots), **même fournisseur que la prod** (pas un vrai offsite), et **inclus seulement si activé** (à vérifier dans la console Hetzner).
- **Storage Box** = même fournisseur Hetzner → ne protège pas d'un sinistre/compte Hetzner.

**À déterminer explicitement** : (1) les Backups Auto sont-ils activés sur ce VPS ? quelle rétention ? (2) où sont les vrais backups *off-provider* immuables ? Aujourd'hui R2 (Cloudflare) est la seule couche hors-Hetzner — vérifier qu'elle tourne réellement et qu'elle couvre tout (pas juste Postgres).

---

## 📋 Phase 1 — AUDIT (lecture seule, exhaustif)

Pour CHAQUE catégorie ci-dessous, établis : **(a)** est-ce sauvegardé ? **(b)** par quel mécanisme (fichier/script/cron/service) ? **(c)** où (combien de copies, lesquelles off-site/off-provider/immuables) ? **(d)** chiffré ? **(e)** rotation/rétention ? **(f)** restauration testée et datée ? **(g)** monitoré/alerté ?

Catégories à couvrir **de bout en bout** :

1. **Base Postgres principale** (donnée métier + content engine + image-bank metadata + knowledge base + bookings + users).
2. **Redis / BullMQ** (jobs persistés AOF — déterminer ce qui est critique vs reconstructible).
3. **Fichiers / objets** : uploads & variants image-bank sur Hetzner Storage Box (originaux irremplaçables ?), assets générés par le content engine.
4. **Bases des services self-hosted** : Plausible (PG + ClickHouse), Docuseal, Sentry, Grafana/Prometheus.
5. **Volumes Docker** : `caddy_data` (certs/ACME — reconstructible mais utile), tout volume nommé persistant.
6. **Secrets & .env** : tous les `.env*`, `.secrets/` (contient notamment `gsc-service-account.json`, `gsc-oauth-client.json`, `api-tokens.env` — **creds Google irremplaçables**), `.secrets-coolify/` (`coolify-env-*.env`, `axion-ia-prod-env.txt` = dump env prod complet), Coolify env vars, GitHub Actions secrets, Cloudflare keys, **refresh tokens OAuth Google (GSC / Indexing API)**, 1Password/papier. Sont-ils sauvegardés de façon chiffrée, versionnée, restaurable — et y a-t-il une procédure de rotation/reconstruction documentée ?
7. **Config Coolify** : application config, env vars, `dockerfile_location`, webhooks, serveurs. Coolify a-t-il un export/backup ? est-il sauvegardé ?
8. **GitHub** : code (mirror/backup hors GitHub ?), repo settings, branch protection, Actions secrets (valeurs non exportables → documentées ?), workflows.
9. **Images Docker GHCR** : rétention des tags, reproductibilité du build (l'image est-elle rebuild-able from scratch si GHCR purge ?).
10. **Cloudflare** : DNS records, WAF rules, page rules, redirects, Turnstile — export/IaC (Terraform) en place ?
11. **Infra-as-code / runbooks** : Caddyfile, docker-compose, scripts ops, ADRs — tous dans Git ? Git lui-même sauvegardé ?

**Méthode** : lis les fichiers cités, `axionia/scripts/`, `axionia/docs/adr/`, `axionia/docs/runbooks/`, `_AUDIT/*` pertinents, les `docker-compose*.yml`, les `.env*.example`. Inspecte le crontab VPS via la doc (`CRON-VPS-INVENTORY.md`) — ne te connecte PAS au VPS sans demander à Will. Utilise des sous-agents `Explore` en parallèle pour fan-out la découverte (un par catégorie), puis synthétise.

---

## 📐 Référentiel « meilleures pratiques juin 2026 » (grille d'évaluation)

Évalue chaque composant contre :

- **Règle 3-2-1-1-0** : ≥3 copies, ≥2 supports/medias, ≥1 off-site, **≥1 immuable ou air-gapped**, **0 erreur après vérification de restauration**.
- **Immutabilité anti-ransomware** : object-lock / WORM sur au moins une destination (R2 Object Lock, ou versioning + retention). Un attaquant ayant le VPS ne doit pas pouvoir effacer les backups.
- **Off-provider réel** : au moins une copie hors écosystème Hetzner (R2/Cloudflare ou autre) — sinon un incident compte/fournisseur Hetzner = perte totale.
- **Chiffrement** at-rest (client-side, clé sous contrôle Will) ET in-transit. Clé de chiffrement elle-même sauvegardée hors du système qu'elle protège.
- **RPO / RTO chiffrés et documentés** par classe de donnée (ex. DB métier RPO ≤ 1h cible V2 vs 24h actuel ; RTO whole-platform ≤ Xh). Décider si PITR (WAL : pgBackRest/wal-g) est requis maintenant.
- **GFS / rétention** : grandfather-father-son (daily/weekly/monthly/yearly) cohérente et justifiée légalement (RGPD : pas de rétention illimitée de données perso).
- **Restauration testée et automatisée** : drill récurrent (cron CI mensuel mini), vérifiant l'intégrité (count rows, checksum, restore sur instance éphémère) — pas juste « le backup existe ».
- **Monitoring & alerting** : succès/échec de CHAQUE job, détection de backup manquant (dead-man's-switch / heartbeat type Healthchecks.io), alerte sur échecs consécutifs, taille anormale, âge du dernier backup.
- **Couverture secrets/config** (souvent l'angle mort) : un backup DB sans les secrets pour la redéployer = restauration impossible. Tout doit être reconstructible from cold.
- **Documentation DR exécutable** : runbook step-by-step « VPS perdu → plateforme remontée », testé, avec ordre des dépendances et bascule DNS.
- **RGPD/souveraineté** : données perso chiffrées, localisation UE, droit à l'effacement propagé aux backups (politique de purge documentée).

---

## 🖥️ Phase 3 — Console d'administration : tableau de bord « Sauvegardes »

Conçois (puis, après GO, implémente) un module admin de **suivi complet** des sauvegardes, intégré à la console d'admin existante (route admin sous `src/app/[locale]/(admin)/[adminPrefix]/…`, prefix dynamique `ADMIN_URL_PREFIX`). ⚠️ **Réutilise les conventions existantes** : il y a déjà une page admin **`/infra`** et une page **`/alerts`** — étudie-les et place le dashboard backup en cohérence (sous `/infra/backups` ou onglet dédié), branche l'alerting sur le système `/alerts` existant plutôt que d'en créer un parallèle. Exigences fonctionnelles :

- **Vue d'ensemble** : pour chaque composant (Postgres, Redis, fichiers Storage Box, Plausible, Docuseal, secrets, Coolify, Cloudflare…) → statut dernier backup (✅/⚠️/🔴), horodatage, taille, durée, destination(s), âge vs RPO cible.
- **Historique** : liste paginée des sauvegardes (date, type daily/weekly/monthly, composant, destination, taille, checksum, statut, log).
- **Drills de restauration** : date du dernier test de restore réussi par composant + résultat (rows vérifiées), alerte si > seuil (ex. > 35 j).
- **Alerting** : intégration avec l'alerte Telegram existante + dead-man's-switch (heartbeat). Bandeau rouge si un backup a manqué.
- **Déclenchement manuel** (optionnel, protégé) : bouton « lancer un backup maintenant » par composant, et accès aux logs.
- **Source des données** : décide proprement comment l'admin connaît l'état des backups — table Postgres `BackupRun` alimentée par les scripts (les scripts POSTent un statut à une API interne, ou écrivent en DB en fin de run), OU lecture S3 listing. **Préfère une table d'audit `BackupRun`/`RestoreDrill`** (migration Prisma) écrite par les scripts → l'admin la lit. C'est la source de vérité du suivi.

**Contraintes techniques admin** (NON négociables) :
- Respecter le **budget Web Vitals** (CLAUDE.md) : l'admin n'a pas de seuil public mais reste sobre ; ne pas alourdir le First Load des routes publiques.
- Respecter le **cloisonnement** des modules existants (image-bank a son propre périmètre `src/server/image-bank/**`). Crée un module `src/server/backups/**` propre, ne pollue pas les autres.
- **FR uniquement** (EN désactivé runtime — cf. mémoire projet) : libellés admin en FR, pas d'effort i18n EN.
- Respecter le contrat **`stub.invalid`** (CLAUDE.md/AGENTS.md) : toute nouvelle page SSG faisant un appel DB doit gérer le stub build-time. L'admin est probablement dynamique/non-SSG → vérifier.

---

## 📦 Livrables attendus (dans cet ordre)

1. **`_AUDIT/AUDIT-BACKUP-DR-2026-06-<date>.md`** : rapport d'audit + **matrice composant × (7 critères a–g)** + scoring vs référentiel 2026, avec verdict Hetzner (Backups Auto activés ? off-provider OK ?).
2. **Matrice de trous priorisée** P0/P1/P2 (P0 = perte de donnée possible aujourd'hui).
3. **Plan d'implémentation** par étapes (quick wins → structurel), avec estimation effort et impact, et ce qui nécessite une décision/coût de Will (ex. activer Hetzner Backups Auto, pgBackRest pour PITR, R2 Object Lock, Healthchecks.io).
4. **ADR** (`axionia/docs/adr/00XX-*.md`, via `pnpm tsx scripts/adr-new.ts` si le helper existe) actant la stratégie cible (extension d'ADR 0022).
5. **(Après GO uniquement)** : scripts de backup étendus (fichiers/objets, services annexes, secrets chiffrés), cron CI drill mensuel (`.github/workflows/restore-drill-monthly.yml`), table Prisma `BackupRun`, module admin de suivi, runbook DR chiffré RTO/RPO.

---

## 🚧 Contraintes & garde-fous projet (À RESPECTER ABSOLUMENT)

- **Lis `axionia/AGENTS.md` en entier d'abord** (et `node_modules/next/dist/docs/` avant tout code Next — cette version de Next.js diffère de ton training).
- **Ne casse pas le contrat de build `stub.invalid`** : ne touche pas la magic string sans propager (prisma.ts, redis.ts, knowledge-rss.ts, knowledge-sitemap.ts, Dockerfile, deploy-coolify.yml), ne retire pas `SKIP_ENV_VALIDATION`/`BULLMQ_DISABLED`.
- **`git push main` = déploiement prod** (workflow `deploy-coolify.yml`). Le working tree est **partagé entre plusieurs conversations** sur `main` : `git fetch` + vérifie l'écart avant tout commit/push, et **ne push qu'à la toute fin, sur demande explicite de Will**. Travaille en worktree isolé si tu modifies du code.
- **Ne JAMAIS commiter de secret en clair** dans Git (les `.secrets/` et `.env` ne doivent pas finir versionnés ; vérifie `.gitignore`).
- **Ne te connecte pas au VPS / Coolify / Hetzner / Cloudflare en écriture** sans validation Will. Lecture de doc OK.
- **Prix jamais hardcodés** (SSOT `pricing.ts`) — non pertinent ici mais doctrine générale.
- Gates CI : **Gate A seul bloquant** ; Lighthouse = autorité Web Vitals (cf. mémoire). Tes tests doivent rester verts.
- Convention **ADR** pour toute décision d'architecture ; runbooks dans `docs/runbooks/`.
- Plateforme **FR only** en pratique (EN désactivé runtime).

---

## ▶️ Première action attendue de toi

1. Confirme que tu as lu `axionia/AGENTS.md` + ADR 0022 + l'audit Pr-04 existant.
2. Lance la **Phase 1 (audit lecture seule)** — idéalement via fan-out de sous-agents `Explore` (un par catégorie 1–11), en parallèle.
3. Reviens avec le **rapport d'audit + matrice de trous**, puis passe en **`EnterPlanMode`** pour proposer le plan, et **STOP & ASK Will** avant toute écriture.

N'implémente rien tant que Will n'a pas validé le plan.
