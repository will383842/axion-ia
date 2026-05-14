# Checklist Rescale Hetzner CPX32 → CPX42 (Axion-IA)

> **Décidé 2026-05-14** suite à saturation CPX32 (cf. mémoire `axionia_rescale_cpx42_decision`).
> **Downtime attendu** : ~15-20 min.
> **Coût** : €6.49 → €12.49 HT/mois (+€72/an HT).

---

## Pré-requis avant de démarrer

- [ ] Prod stable depuis 24-48h (KB ingest 401 sans HMAC + healthz 200 + bookings test OK)
- [ ] Aucun deploy Coolify in_progress (`gh run list --workflow=deploy-coolify.yml --limit 1` = `completed success`)
- [ ] Aucune session Claude Code autopilot active sur main
- [ ] Fenêtre low-traffic choisie : **dimanche soir 22h-23h** ou **lundi matin 6h** (UTC+2 Paris)
- [ ] Téléphone à portée + accès Hetzner Console + accès Coolify UI
- [ ] (Optionnel) Notifier les contacts métier d'une fenêtre de maintenance

---

## Phase 1 — Snapshot de sécurité (5 min, pas de downtime)

```
Hetzner Console (https://console.hetzner.cloud) → Project Axion-IA
  → Server "axion-ia-prod" → Snapshots → Create snapshot
  → Description : "Pre-rescale CPX42 — 2026-XX-XX"
  → Wait jusqu'au statut "Available" (~5 min)
```

- [ ] Snapshot créé et listé comme "Available"
- [ ] Coût stockage : ~€0.02/jour (garde au moins 24h post-migration, supprime ensuite)

**Rollback si problème post-rescale** : Hetzner Console → Rebuild from snapshot → restart.

---

## Phase 2 — Rescale (15-20 min downtime, 5 étapes manuelles)

⚠️ **Procédure Hetzner officielle** : le rescale nécessite que le serveur soit
**Power Off** AVANT, et **Power On** APRÈS. Ce ne sont pas des étapes
automatiques. Tu dois cliquer toi-même chaque bouton.

### 2.1 — Power Off

```
Hetzner Console → Server "axion-ia-prod" → bouton "Power off"
```

- [ ] Bouton Power off cliqué
- [ ] Serveur status passe à "off" (~1 min)
- [ ] Heure début downtime notée : **:**

⚠️ À partir de cet instant, **axion-ia.com est down** (visiteurs voient erreur).
Coolify + tous les containers s'arrêtent automatiquement.

### 2.2 — Onglet Rescale

```
Hetzner Console → Server "axion-ia-prod" → onglet "Rescale" (menu de gauche)
```

- [ ] Onglet Rescale ouvert
- [ ] Liste des types serveur affichée (CX22, CPX31, CPX32, CPX42, CPX52, etc.)

### 2.3 — Sélectionner CPX42

```
Cliquer sur la card "CPX42 — 8 vCPU / 16 GB RAM / 240 GB SSD"
```

- [ ] CPX42 sélectionné (la card devient en surbrillance)
- [ ] Prix nouveau affiché ~€12.49 HT/mois (au lieu de €6.49)

### 2.4 — Confirm Rescale

```
Cliquer sur le bouton "Rescale" en bas de page
Une popup de confirmation peut apparaître → Confirm
```

- [ ] Bouton Rescale cliqué
- [ ] Confirmation envoyée
- [ ] Hetzner indique "Rescaling..." puis "Rescaled" (~3-5 min)

Pendant ce temps :

- IP `178.105.55.15` **inchangée**
- Disque **préservé** (Postgres data, Redis data, Coolify config, env vars)
- DNS, certificats Let's Encrypt, Cloudflare zone : **aucun changement**

### 2.5 — Power On

```
Une fois le rescale terminé → bouton "Power on" du serveur
```

- [ ] Bouton Power on cliqué
- [ ] Serveur status passe à "starting" puis "running" (~1-2 min)
- [ ] Heure fin Power-On notée : **:**

---

## Phase 3 — Vérif post-restart (5-10 min)

### 3.1 — SSH check resources

```bash
ssh root@178.105.55.15
nproc                  # Doit retourner 8 (pas 4)
free -h                # Doit montrer ~16 GB total
df -h                  # Doit montrer ~240 GB sur / ou volume monté
```

- [ ] 8 vCPU détectés
- [ ] 16 GB RAM détectés
- [ ] 240 GB SSD détectés

### 3.2 — Coolify auto-restart containers

```bash
docker ps -a --format "table {{.Names}}\t{{.Status}}"
```

Containers attendus en `Up X seconds/minutes` :

- `coolify` + `coolify-realtime` + `coolify-redis` + `coolify-db`
- App `axion-ia` (UUID `mqbmlz1bcwsdwi3t9fxsllqt`)
- Worker BullMQ (UUID `oqj5ugdxvdsc4lyp4acr6wqd`)
- DocuSeal V2 (UUID `sldtf6oky71nrzx74pwactrq`)
- Postgres `axion-ia-db` (UUID `u7zlql3bpb1xy5t4kg6jnvpm`)
- Redis BullMQ (UUID `hdfknlij6yqebr09p379m9q6`)
- Plausible CE 4 conteneurs (UUID `vl41qwmhr6l26bmrjzet9h02`)

- [ ] Tous les containers `Up` (pas `Exited` ou `Restarting`)

### 3.3 — Si un container ne remonte pas auto

```bash
# Coolify UI → service → Restart
# Ou via API :
curl -X POST "$COOLIFY_URL/api/v1/applications/$COOLIFY_APP_UUID/restart" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN"
```

Tokens dans `/c/Users/willi/Documents/Projets/Axion-IA/.secrets/api-tokens.env`.

---

## Phase 4 — Smoke tests prod (3 min)

### 4.1 — Healthz + routes critiques

```bash
curl -s -o /dev/null -w "HTTP %{http_code} (%{time_total}s)\n" https://axion-ia.com/api/healthz
# Attendu : HTTP 200 < 1s

curl -s -o /dev/null -w "%{http_code}\n" -X POST https://axion-ia.com/api/internal/kb/ingest \
  -H "Content-Type: application/json" -d '{}'
# Attendu : 401 missing_signature (route KB live)

curl -s -o /dev/null -w "%{http_code}\n" https://axion-ia.com/fr/reserver
# Attendu : 200 (parcours booking)

curl -s -o /dev/null -w "%{http_code}\n" https://axion-ia.com/fr/audit
# Attendu : 200 (page audit)
```

- [ ] Tous les endpoints répondent normalement

### 4.2 — Login admin + smoke booking

- [ ] Connexion admin OK
- [ ] Dashboard admin charge avec KPIs
- [ ] Liste réservations charge
- [ ] Calendrier charge

### 4.3 — DB consistency

```bash
ssh root@178.105.55.15
docker exec -it axion-ia-db psql -U postgres -d axion_ia \
  -c "SELECT pg_size_pretty(pg_database_size('axion_ia'));"
docker exec -it axion-ia-db psql -U postgres -d axion_ia \
  -c "SELECT count(*) FROM \"Booking\";"
```

- [ ] DB size cohérente avec la valeur pré-rescale
- [ ] Counts tables critiques inchangés

---

## Phase 5 — Re-deploy test (10-15 min, validation perf)

But : vérifier que le build est bien plus rapide qu'avant.

```bash
# Trigger un re-deploy "no-op" via Coolify API ou push commit vide
git commit --allow-empty -m "chore(infra): post-rescale cpx42 redeploy"
git push origin main

# Watch
gh run watch
```

- [ ] Build webpack < 15 min (vs 25-30 min sur CPX32)
- [ ] Pas d'OOM-kill dans les logs Coolify
- [ ] Healthz vert après deploy

---

## Phase 6 — Update DNS Reverse + monitoring (optionnel)

Si les contrôles `monitoring` Coolify utilisent un check externe (Uptime Robot etc.), vérifier qu'ils continuent de vert.

- [ ] Uptime Robot vert (si configuré)
- [ ] Plausible reçoit les events normalement
- [ ] Sentry pas de spike d'erreurs

---

## Phase 7 — Cleanup post-migration (24-48h après)

- [ ] Snapshot Hetzner pré-rescale supprimé (économie €0.60/mois)
- [ ] Note dans `_AUDIT/CHANGELOG-V1-BOOKING.md` ou ADR dédié
- [ ] Update mémoire `axionia_hosting_hetzner` → CPX42 €12.49/mois HT
- [ ] Update mémoire `axionia_rescale_cpx42_decision` → status "exécuté YYYY-MM-DD"

---

## Rollback (si problème grave)

Si après 30 min de tentatives, prod down :

```
Hetzner Console → Server "axion-ia-prod" → Snapshots
  → Snapshot "Pre-rescale CPX42 — 2026-XX-XX" → Rebuild from snapshot
```

⚠️ **Rebuild from snapshot écrase TOUT le disque** — tu perds les modifs DB depuis le snapshot.
Si la migration a duré 20 min et qu'aucun client réel n'a fait de booking dans cette fenêtre, c'est OK.
Sinon : intervention plus fine via SSH + restore Postgres avec dump granulaire.

---

## Critères de succès final

- [ ] Phase 1-5 toutes cochées
- [ ] Prod stable depuis 30 min post-rescale
- [ ] Build webpack < 15 min mesuré sur deploy test
- [ ] Aucune erreur Sentry nouvelle
- [ ] Mémoire à jour
