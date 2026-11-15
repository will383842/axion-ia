# R01 — Kill switch d'urgence content-gen

- **Code** : R01
- **Version** : 1.0
- **Date dernière maj** : 2026-05-15
- **Sévérité** : 🔴 **P0 — critique**
- **Impact si non traité** : génération non maîtrisée (provider IA hacké → leak credentials, coût qui explose au-delà du cap, ou doctrine massive violée → publication SIREN/agence/formation interdite à grande échelle).

## Trigger — quand activer ce runbook

- Alerte Telegram `[🔴 COÛT 100 %]` (déclenchée par `cost-tracker.ts` — kill switch auto déjà engagé, valider quand même).
- Alerte Sentry "Provider API key compromised" / leak credentials détecté GitGuardian.
- Audit manuel observe ≥ 5 articles publiés avec SIREN/"agence"/"formation" en < 1h.
- Will reçoit notification facturation provider > $50/h.
- Suspicion de boucle infinie content-quality-improver consommant tokens.

## Prérequis

- Accès Coolify dashboard `http://178.105.55.15:8000` (token dans `.secrets/api-tokens.env`).
- Accès admin Axion-IA `/fr/{ADMIN_URL_PREFIX}/content-gen/settings/kill-switch`.
- Postgres SSH access via `docker exec axion-ia-postgres-prod psql -U axion_ia`.

## Étapes (action immédiate)

### 1. Engager kill switch admin UI (10 secondes)

```
https://axion-ia.com/fr/{ADMIN_URL_PREFIX}/content-gen/settings/kill-switch
→ bouton "Engage kill switch"
→ Server Action `engageKillSwitchAction` (src/server/actions/content-gen/kill-switch.ts)
```

Effet immédiat :

- `ContentGenConfig` clé `kill_switch` → `true`
- Tous workers content-gen-worker checkent ce flag avant chaque job (`assertKillSwitchInactive`)
- Jobs en cours laissés finir (graceful), nouveaux jobs rejetés.

### 2. Si admin UI inaccessible — fallback DB direct

```bash
ssh root@178.105.55.15
docker exec axion-ia-postgres-prod psql -U axion_ia -d axion_ia_prod -c "
  INSERT INTO \"ContentGenConfig\" (key, \"valueJson\", \"createdAt\", \"updatedAt\")
  VALUES ('kill_switch', '{\"engaged\":true,\"reason\":\"R01-manual-$(date +%Y%m%d-%H%M)\"}', NOW(), NOW())
  ON CONFLICT (key) DO UPDATE
  SET \"valueJson\" = EXCLUDED.\"valueJson\", \"updatedAt\" = NOW();
"
```

### 3. Stop workers Coolify (si suspicion compromise > kill switch logique)

```bash
# Via Coolify API (cf. coolify-procedures.md)
curl -X POST "http://178.105.55.15:8000/api/v1/services/{WORKER_UUID}/stop" \
  -H "Authorization: Bearer ${COOLIFY_API_TOKEN}"

# OU SSH direct
ssh root@178.105.55.15 "docker stop axion-ia-worker-prod"
```

### 4. Si provider IA compromis — révoquer clé immédiatement

```
- OpenAI : https://platform.openai.com/api-keys → bouton "Revoke"
- Anthropic : https://console.anthropic.com/settings/keys → "Disable"
- Perplexity : https://www.perplexity.ai/settings/api → "Delete"
- Unsplash : https://unsplash.com/oauth/applications → "Reset secret"
- Voyage AI : https://dash.voyageai.com/api-keys → "Delete"
```

Puis update env var Coolify (cf. `coolify-procedures.md` §4) avec nouvelle clé.

### 5. Notifier Telegram statut

```bash
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d "chat_id=${TELEGRAM_CHAT_ID}" \
  -d "text=🔴 [INCIDENT] Kill switch content-gen ENGAGED ($(date +%H:%M)) — raison : <cost|doctrine|leak>"
```

## Vérifications post-fix

- [ ] `ContentGenConfig.kill_switch.engaged === true` (vérif via admin UI ou `psql`).
- [ ] `/fr/{ADMIN_URL_PREFIX}/content-gen` dashboard affiche bandeau rouge "Kill switch engaged".
- [ ] Worker logs (`docker logs --tail 50 axion-ia-worker-prod`) montrent `[content-gen-worker] kill-switch engaged, skipping job` sur les jobs poppés.
- [ ] BullMQ queue `content-gen` accumule en `waiting` mais aucun `active` ne progresse.
- [ ] Aucun nouvel `Article` créé en DB dans les 5 min suivant l'activation :
  ```sql
  SELECT COUNT(*) FROM "Article" WHERE "createdAt" > NOW() - INTERVAL '5 minutes';
  ```

## Rollback — désactiver kill switch proprement

⚠️ **Seulement après** investigation root cause + correction du problème.

### 1. Désactiver via admin UI

```
/fr/{ADMIN_URL_PREFIX}/content-gen/settings/kill-switch
→ bouton "Release kill switch"
→ champ obligatoire "Reason for release" (audit trail)
```

### 2. Vérifier audit log

```sql
SELECT * FROM "KnowledgeAuditLog"
WHERE "eventKind" IN ('kill_switch_engaged', 'kill_switch_released')
ORDER BY "createdAt" DESC LIMIT 10;
```

### 3. Re-démarrer workers si stoppés

```bash
curl -X POST "http://178.105.55.15:8000/api/v1/services/{WORKER_UUID}/start" \
  -H "Authorization: Bearer ${COOLIFY_API_TOKEN}"
```

### 4. Test smoke (1 job manuel)

```
/fr/{ADMIN_URL_PREFIX}/content-gen → bouton "Générer landing ville…"
→ choisir Lyon (ou ville-test)
→ vérifier que job traverse complet : queued → running → published
```

### 5. Notifier Telegram

```bash
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d "chat_id=${TELEGRAM_CHAT_ID}" \
  -d "text=🟢 [INCIDENT] Kill switch content-gen RELEASED ($(date +%H:%M)) — fix : <résumé>"
```

## Allumer / éteindre le texte du blog via Claude

Interrupteur : variable `CONTENT_GEN_BLOG_CLAUDE`. Éteint = absente ou vide ; seule la valeur exacte `true` allume (lue à chaque appel). Éteint, aucun chemin du blog n'atteint Anthropic. **Geste du fondateur uniquement** : aucune automatisation ni session ne l'allume.

### Allumer (liste Jour J)

1. **Plafonds posés** avec le script (à sec, relire, puis réel). Les valeurs se passent en argument et ne sont jamais écrites dans le dépôt ; le script refuse au-delà des bornes de garde 20 $/jour et 300 $/mois (ce sont des bornes de garde, pas les plafonds réels). ⚠️ L'image du worker **ne contient pas** `scripts/content-gen/` (seuls `node_modules`, `src`, `prisma`, `package.json` et `tsconfig.json` y sont copiés) : copier d'abord le script dans le conteneur, puis le lancer depuis `/app` (l'import `../../prisma/generated/client` s'y résout) :
   ```
   docker exec <conteneur-worker> mkdir -p /app/scripts/content-gen
   docker cp scripts/content-gen/poser-plafonds-blog-claude.ts <conteneur-worker>:/app/scripts/content-gen/
   docker exec -w /app <conteneur-worker> node_modules/.bin/tsx scripts/content-gen/poser-plafonds-blog-claude.ts --jour <usd> --mois <usd> --reserve <usd> --juge-max <n>
   ```
   Relire la sortie (à sec), puis relancer la même commande avec `--reel` : le script relit la base après écriture et échoue si une clé manque. Jamais de SQL à la main en production. Retirer ensuite le script copié du conteneur.
2. **Clé et solde** : vérifier la clé Anthropic du serveur (pas une clé personnelle à échéance), son organisation, son solde, et qu'un appel d'essai répond avec les deux modèles (comparer les jetons de sortie à la longueur du texte).
3. **Avant l'allumage** : kill switch actif, files en pause, aucun job de blog répétable, arriéré de jobs en attente compté, solde OpenAI (embeddings, dédoublonnage) vérifié, registre RGPD à jour (Anthropic pour « contenu du blog »).
4. **Quand** : juste après un créneau de mise en ligne où la prod sert bien la tête de `main` (contrôler l'en-tête `x-axion-build-sha` et le contenu du worker, pas seulement l'étiquette d'image).
5. **Où** : application **WORKER** seulement, jamais l'application web. Variable en **exécution** seulement : case « Build Variable » **décochée**. Valeur `true`, puis redémarrer le worker.
6. **Constater** : `docker exec <conteneur-worker> printenv CONTENT_GEN_BLOG_CLAUDE` rend `true`, et le marqueur de la version attendue est présent dans le code du worker (grep dans `/app/src`).
7. **Lever le kill switch et reprendre les files** (section « Étapes » ci-dessus) : c'est ce qui laisse le job d'essai partir. Sans cette étape, rien ne s'exécute.
8. **Essai** : plafond du jour bas, UN seul job lancé à la main, relecture des articles, puis arrêt avant tout volume. Observer 24 h (dépense, alertes) et refaire le point 3.

### Si le blog est suspendu

Après plusieurs refus de crédit le drapeau de suspension se pose seul et une alerte part. Seul le fondateur le lève, après avoir rechargé ou corrigé la cause : `pnpm tsx scripts/content-gen/poser-plafonds-blog-claude.ts --lever-suspension` (à sec), puis avec `--reel`. Le compteur de refus de crédit (clé Redis `blog-claude:refus-credit`, fenêtre de 24 h) n'est **pas** remis à zéro par le script : le supprimer à la main dans Redis après la levée, sinon un seul refus de plus peut re-suspendre aussitôt.

**Après une recharge de crédit : redémarrer le worker.** Une clé refusée pour crédit est marquée « épuisée » 24 h, en mémoire du processus (état propre à chaque conteneur, et partagé avec la génération Qualiopi et le chatbot qui passent par le même fournisseur) : sans redémarrage, le worker continue d'ignorer une clé pourtant rechargée. La rotation de clés (`ANTHROPIC_API_KEY_2`, `_3`) s'applique donc aussi à Qualiopi et au chatbot, dès la mise en ligne.

### Retour arrière (à tester une fois, hors production sensible)

1. Retirer la variable `CONTENT_GEN_BLOG_CLAUDE` de l'application worker (ou la vider), redémarrer le worker.
2. Constater que `printenv CONTENT_GEN_BLOG_CLAUDE` ne rend rien.
3. Jobs en cours : ils se terminent ou échouent. Un job en échec définitif n'est pas rejoué automatiquement ; en revanche **un job en attente d'un nouvel essai BullMQ sera rejoué, sur OpenAI, une fois la variable retirée**. Relire la liste des jobs en attente et en échec et trancher à la main.
4. En cas de doute sur la dépense : engager le kill switch (section « Étapes » ci-dessus). Le plafond mensuel global se remet à zéro à l'heure du serveur, pas à l'heure de Paris : à garder en tête autour du changement de mois.

## Escalation

| Niveau    | Contact                               | Quand                                                                                         |
| --------- | ------------------------------------- | --------------------------------------------------------------------------------------------- |
| L1        | Will (`williamsjullin@gmail.com`)     | toujours en premier                                                                           |
| L2        | Coolify support `support@coollabs.io` | si worker ne stoppe pas / API token KO                                                        |
| L3        | Provider IA support                   | OpenAI : help.openai.com · Anthropic : support@anthropic.com · Perplexity : api@perplexity.ai |
| L4 (RGPD) | DPO `contact@axion-ia.com`            | si leak credentials touche données utilisateurs → CNIL 72h                                    |

## Liens

- ADR 0021 — Content Generator V1 skeleton vs deep impl
- Master prompt § 12.3bis (alertes Telegram) + § 13.3 (monitoring)
- Mémoire `axionia_coolify_api_authorization` — autorisation API Coolify
- Code : `src/server/content-gen/lib/cost-tracker.ts` (auto-trigger sur cost cap 100 %)
- Code : `src/server/actions/content-gen/kill-switch.ts` (Server Actions admin)
- Code : `src/lib/knowledge/kill-switch.ts` (helper `assertKillSwitchInactive`)
