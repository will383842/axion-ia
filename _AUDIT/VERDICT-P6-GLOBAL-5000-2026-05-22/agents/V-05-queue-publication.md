# V-05 — Queue publication (re-évaluation post-Sprint Campaign Controls)

- **Repo / HEAD** : `Axion-IA` @ `8031a00` (branche `audit/p6-verdict-global-5000-2026-05-22`)
- **Baseline** : 82/100 (164/200) — Vérif Sprint P5 2026-05-22
- **Périmètre** : `src/server/queue/workers/content-publish-worker.ts`, `content-gen-scheduler-worker.ts`, `content-gen-deadline-checker.ts`, `queues.ts`, `connection.ts`, `src/lib/redis.ts`.

## Score : 178/200 🟢 (+14 vs baseline)

Le bilan post-Sprint Campaign Controls est solide. Les fix b3cb133 (lockDuration) et D-W1 (rampe MAX_PUBLISH) sont câblés correctement, Redis INCR/DECR/EXPIRE remplace l'ex-`prisma.article.count()` race-condition, et les deux nouveaux workers cron (scheduler / deadline-checker) sont implémentés proprement avec purge BullMQ, retrait repeatable et log SOC2.

## Top 3 forces

1. **Rate-limiting atomique Redis INCR + cap dynamique 3 niveaux** — `content-publish-worker.ts:89-100` (rampe DB + env + 30/100/200/500), `:163-191` (INCR + DECR si dépassement + EXPIRE jusqu'à minuit UTC, clé `axion:pub:${YYYY-MM-DD}`). Annulation propre par `redis.decr` quand le seuil est franchi pour ne pas fausser le compteur des jobs concurrents — corrige proprement le bug race-condition `prisma.article.count()` historique (concurrency=3).
2. **`lockDuration: 120_000` consistant sur les 3 workers heavy** — `content-publish-worker.ts:647`, `content-gen-worker.ts:703`, `content-quality-improver-worker.ts:354`. Le fix b3cb133 D-C2 est confirmé déployé partout, plus aucun worker n'utilise le 30s par défaut BullMQ → plus de double-ping IndexNow / double-publish sur lent réseau.
3. **Nouveaux workers Campaign Controls bien typés et idempotents** — scheduler-worker (`content-gen-scheduler-worker.ts:20-47`) cron `*/5 * * * *` scanne `status=scheduled` + `startDate<=NOW()` → bascule en `running`; deadline-checker (`content-gen-deadline-checker.ts:29-132`) cron `5 0 * * *` purge BullMQ + retire repeatable + log SOC2 `CAMPAIGN_AUTO_STOPPED_DEADLINE` via `logActivity`. Tests vitest 4+5 scénarios (`scheduler-worker.test.ts`, `deadline-checker.test.ts`). Concurrency=1, single-instance — pas de risque double-activation.

## Top 3 gaps P1/P2

1. **P1 — Pas de backoff/retry stratégie explicite côté Worker pour publish** (effort 1h). `content-publish-worker.ts:644-654` configure `concurrency`, `lockDuration`, `limiter`, `removeOnComplete/Fail` mais ne définit ni `backoff` ni `attempts` au niveau Worker. Les `defaultJobOptions` du Queue producer (`queues.ts:31-36`) appliquent `attempts:5` + exponential `delay:5000ms` quand un job est `add()`-é via `contentPublishQueue`, mais le code qui enqueue (Server Action `approveReview()`) peut potentiellement override. Ajouter un test d'intégration qui vérifie qu'un publish failed entraîne bien 5 retries avec backoff exponentiel + un commentaire de contrat explicite dans `content-publish-worker.ts`.
2. **P2 — Scheduler/deadline-checker non protégés par lockDuration** (effort 30min). `content-gen-scheduler-worker.ts:55-58` et `content-gen-deadline-checker.ts:140-143` instancient `new Worker(...)` avec uniquement `connection` + `concurrency:1`, sans `lockDuration`. Le processJob fait des `prisma.findMany` + `update` qui peuvent dépasser 30s en cas de DB lente (deadline-checker purge jusqu'à 5000 jobs BullMQ + N `bullJob.remove()` séquentiels — N peut être grand). Le risque est faible (concurrency=1 + repeatable cron mutex), mais aligner sur les autres workers (`lockDuration: 60_000` suffit) prévient les false-positives stalled.
3. **P2 — Redis stub Proxy ne couvre pas `incr` typesafely** (effort 15min). `src/lib/redis.ts:47-64` retourne un Proxy qui résout TOUTES les commandes à `null`. Or `redis.incr(redisKey)` est typé `Promise<number>` côté `ioredis` et `countAfterIncr > maxPublishPerDay` (publish-worker.ts:175) ferait `null > 30` = `false` au runtime build SSG. Sans gravité car `BULLMQ_DISABLED=true` au build → `getBullConnection()=null` → workers jamais démarrés au build, mais le contrat stub mérite un commentaire explicite « les workers ne tournent JAMAIS avec stub.invalid car BULLMQ_DISABLED=true gate l'init Worker en amont ». Ou alternative : faire le Proxy stub-aware retourner `0` pour `incr/decr` (sémantiquement plus juste).

## Verdict : 🟢

Sprint Campaign Controls améliore franchement V-05. Le pipeline publish est désormais : atomic Redis cap + drip window 8h-22h CET + lockDuration 120s + factCheck gate + kill-switch + best-effort indexnow/revalidate + Sentry/Telegram on failed + 2 nouveaux workers cron testés. Les 3 gaps identifiés sont mineurs (durcissement, pas correction de bug). Aucun P0 résiduel. Le worker publish reste le maillon le plus critique du pipeline content-gen — son niveau de durcissement est cohérent avec ce blast radius.
