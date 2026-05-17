# Runbook — Coolify deploy stuck (queue `queued` ou `in_progress` > 30 min)

> Créé 2026-05-17 — runbook deploy recovery cause #2 §1.5 prompt master.
> Voir aussi `_AUDIT/DEPLOY-RECOVERY-2026-05-17/02-root-cause.md`.

## Symptômes

- Job `Trigger Coolify deploy` du workflow `Build & Deploy · GHCR + Coolify`
  reste en step **"Wait for Coolify deployment to finish (max 60 min)"**.
- Le polling log montre `deploy status: queued` répétitif (60 occurrences
  sur 60 min puis exit 1 timeout).
- Le job `Build & push image to GHCR` a SUCCESS — le problème est côté Coolify.
- Le site reste UP (CF cache + dernier deploy `running:healthy`) mais le
  nouveau SHA n'est pas livré.

## Diagnostic rapide

### Étape 1 — dump-state Coolify

```bash
gh workflow run coolify-diagnose.yml --ref main -f action=dump-state
sleep 5
DIAG=$(gh run list --workflow=coolify-diagnose.yml --limit 1 --json databaseId --jq '.[0].databaseId')
gh run view $DIAG --log | grep -A50 "DEPLOYMENTS"
```

→ Si `deployments: []` est vide ou tous `finished`/`failed` → **queue clean**,
pas de zombie. Cause = autre (env vars manquantes, container crash,
image non publiée). Aller étape 5.

→ Si déploiements `in_progress` ou `queued` > 30 min → **zombie présent**,
aller étape 2.

### Étape 2 — Cancel les zombies

```bash
gh workflow run coolify-diagnose.yml --ref main -f action=cancel-stuck
sleep 10
gh run view $(gh run list --workflow=coolify-diagnose.yml --limit 1 --json databaseId --jq '.[0].databaseId') --log | tail -50
```

Confirme que `POST-CANCEL STATE` n'a plus de stuck.

### Étape 3 — Re-trigger deploy

```bash
gh workflow run deploy-coolify.yml --ref main
NEW=$(gh run list --workflow=deploy-coolify.yml --branch main --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch $NEW
```

### Étape 4 — Validation post-deploy

```bash
# Healthcheck
curl -sI https://axion-ia.com/api/healthz | head -1
# Doit retourner HTTP/1.1 200 OK

# Quelques routes critiques
for url in /fr /fr/galerie /fr/reserver /sitemap.xml; do
  echo "$url : $(curl -sI -o /dev/null -w '%{http_code} %{header.cf-cache-status}\n' https://axion-ia.com$url)"
done
```

### Étape 5 — Si pas de zombie mais deploy fail quand même

Crash possible côté container post-deploy. Diagnostic alternatif :

- Logs Coolify : `coolify-diagnose.yml action=dump-state` permet de voir
  app status (`running:healthy` vs `exited` vs `restarting`).
- Si app `restarting` en boucle → env var manquante probable.
- Comparer `.env.production.example` vs Coolify Application Env vars (UI),
  set les manquantes, restart container, re-verify.

## Pièges fréquents

1. **Zombie créé par disque saturé** : si le pre-cleanup `disk-cleanup-prod.yml`
   (cron 03:00 UTC) a failed la veille, le disque > 90 % peut crash le
   prochain deploy → zombie. Vérifier le run du cron + `coolify-zombie-cleanup.yml`
   (cron 03:30 UTC) en complément.

2. **Concurrency lock GH Actions** : `deploy-coolify.yml` a
   `concurrency: deploy-coolify cancel-in-progress: false`. Si un run
   antérieur est encore en cours (build phase), le nouveau attend.
   Vérifier `gh run list --workflow=deploy-coolify.yml --status in_progress`.

3. **Polling bug `application.status` vs `deployment.status`** : déjà
   fixé 2026-05-14, le polling utilise désormais `jq -r '.status'` qui ne
   lit que le top-level deployment status. Si régression future détectée
   (polling lit `application.status`), restore le `jq -r '.status'`.

4. **`[skip ci]` dans le commit message** évite de trigger deploy-coolify
   sur les commits ops/diagnostic (paths-ignore `coolify-*.yml` + `[skip ci]`
   double protection).

## Scripts associés

- `scripts/ops/hetzner-coolify-health.sh` — diagnostic SSH (nécessite accès SSH manuel).
- `scripts/ops/coolify-cancel-stuck.sh` — cancel via API depuis bash local
  (équivalent du workflow `coolify-diagnose.yml action=cancel-stuck`).

## Anti-récidive

- Cron daily `coolify-zombie-cleanup.yml` (03:30 UTC) cancel les
  `in_progress` > 30 min automatiquement.
- Cron daily `disk-cleanup-prod.yml` (03:00 UTC) libère le disque CPX42.
- Workflow `deploy-coolify.yml` early-fail si queue stuck > 5 min
  (à ajouter — bonus durcissement §7.6, follow-up Sprint).

## Escalade Will

Si la boucle de 5 itérations détecter → fix → vérifier n'aboutit pas à
GREEN, **stopper l'autopilote et alerter Will** avec :

- Snapshots `_AUDIT/DEPLOY-RECOVERY-YYYY-MM-DD/00-snapshot/`
- Log GHA du run failed
- Output dump-state Coolify
- Hypothèses restantes (probable bug Coolify version upgrade, infra
  Hetzner, ou changement Cloudflare).

Doctrine §0 du prompt master deploy recovery : **3 cas justifient
STOP & ASK** — action irrécupérable, tous fallbacks épuisés, preuve de
compromission. Sinon continuer.
