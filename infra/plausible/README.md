# Plausible Analytics CE — self-hosted

Stack analytics privacy-first, RGPD/CNIL-exempté (sans cookies, sans PII).
Déployé sur Hetzner CPX32 via Coolify (service `plausible-ce`).

- **Domaine** : `https://plausible.axion-ia.com`
- **UUID service Coolify** : `vl41qwmhr6l26bmrjzet9h02`
- **Image** : `ghcr.io/plausible/community-edition:v3.0.1`
- **Coût** : 0 € (auto-hébergé, partage le VPS axionia-web)

## Stack 4 conteneurs

| Conteneur          | Image                         | Rôle                                 | RAM approx |
| ------------------ | ----------------------------- | ------------------------------------ | ---------- |
| `plausible_db`     | postgres:16-alpine            | Métadonnées (users, sites, settings) | ~150 MB    |
| `plausible_events` | clickhouse-server:24.3-alpine | Events DB columnar                   | ~2 GB      |
| `plausible`        | community-edition:v3.0.1      | App Elixir Phoenix port 8000         | ~500 MB    |
| `mail`             | bytemark/smtp                 | Relay SMTP pour reset password admin | ~30 MB     |

Total ~2.7 GB RAM. Sur CPX32 (8 GB), il reste ~3 GB libre pour l'app Next.js +
Postgres axion-ia + Redis. Marge suffisante mais à surveiller via `/admin/infra`.

## Setup initial (après déploiement Coolify)

### 1. Créer le compte admin (1ère visite)

L'image officielle n'a pas d'admin par défaut. La première personne qui s'inscrit
devient admin. Mais le compose force `DISABLE_REGISTRATION=invite_only` pour
éviter qu'un visiteur aléatoire ne crée un compte.

**Workflow** :

1. Aller sur `https://plausible.axion-ia.com/register` (accessible une fois car
   pas encore d'admin).
2. Créer le compte Will (email + mot de passe fort).
3. Plausible promeut automatiquement le premier user comme admin.

Si la page `/register` est bloquée, temporairement basculer `DISABLE_REGISTRATION`
sur `false` dans Coolify env vars → restart → register → revenir à `invite_only`.

### 2. Ajouter le site `axion-ia.com`

Dans Plausible UI :

1. **+ Add Website**
2. Domain : `axion-ia.com` (sans `https://`, sans `www.`)
3. Timezone : `Europe/Paris`
4. Cliquer **Add Snippet**.

Plausible affichera un snippet `<script>` à coller. **NE PAS le copier** — il est
déjà câblé côté code via `src/components/analytics/Plausible.tsx`.

### 3. Activer les variables côté Coolify app axion-ia

Sur Coolify, projet Axion-IA, app `axion-ia` → **Environment Variables** :

```env
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=axion-ia.com
NEXT_PUBLIC_PLAUSIBLE_API_URL=https://plausible.axion-ia.com
```

Puis redéployer l'app (GitHub Actions ou bouton manual Coolify).

### 4. Générer le Shared Link pour embed admin

Dans Plausible UI :

1. Site `axion-ia.com` → **Site Settings**
2. Section **Visibility** → **Add a shared link**
3. Name : `axion-ia-admin-embed`
4. Password : laisser vide (l'admin Coolify est déjà auth-gated)
5. Copier l'URL générée (format `https://plausible.axion-ia.com/share/axion-ia.com?auth=TOKEN`)

Ajouter en Coolify env vars app axion-ia :

```env
PLAUSIBLE_SHARED_LINK=https://plausible.axion-ia.com/share/axion-ia.com?auth=TOKEN&embed=true&theme=light
```

Redéployer. Le dashboard sera intégré dans `/fr/<prefix>/analytics`.

## Goals à configurer (funnel booking)

Code envoie déjà 2 events via `trackEvent()` dans `BookingForm.tsx` :

- `Booking Submitted` (succès)
- `Booking Failed` (échec)

Dans Plausible UI → Site Settings → **Goals** → **+ Add Goal** :

| Goal name         | Type         | Event name          |
| ----------------- | ------------ | ------------------- |
| Booking Submitted | Custom event | `Booking Submitted` |
| Booking Failed    | Custom event | `Booking Failed`    |

Funnel = Submitted / (Submitted + Failed) = taux conversion serveur.

## Maintenance

### Backups

ClickHouse data dans volume Docker `vl41qwmhr6l26bmrjzet9h02_plausible-events-data`.
Postgres data dans `vl41qwmhr6l26bmrjzet9h02_plausible-db-data`. **Inclus dans
le snapshot Hetzner natif quotidien** (option Backups VPS).

Pas de dump SQL programmé spécifique — analytics = perte acceptable, ré-injecter
le tag suffit pour repartir.

### Mise à jour version

```bash
# Coolify UI > service plausible-ce > Edit Compose
# Changer la version :
#   image: ghcr.io/plausible/community-edition:v3.0.1 → v3.X.Y
# Save + Restart.
```

Voir release notes https://github.com/plausible/community-edition/releases avant
d'upgrader — migrations DB automatiques mais breaking changes possibles.

### Désactiver mail container (optionnel V2)

Le relay `bytemark/smtp` n'est utilisé que pour les emails de reset password
admin. Si on bascule vers le SMTP maison (PMTA / MailWizz), on peut supprimer
le service `mail` et pointer `SMTP_HOST_ADDR=mail.axion-ia.com:587`.

## Troubleshooting

| Symptôme                             | Cause probable                 | Fix                                                         |
| ------------------------------------ | ------------------------------ | ----------------------------------------------------------- |
| `https://plausible.axion-ia.com` 502 | App pas encore up              | Attendre 1-2 min après déploiement (ClickHouse boot lent)   |
| Cert TLS Let's Encrypt fail          | Cloudflare proxy ON            | Mettre DNS en grey cloud (proxy OFF) le temps de l'émission |
| ClickHouse OOM                       | RAM pressure CPX32             | Vérifier `docker stats`, killer un container moins critique |
| `/register` accessible publiquement  | `DISABLE_REGISTRATION` mal set | Vérifier env vars Coolify, doit être `invite_only`          |

## Rollback complet

Si Plausible cause des problèmes :

```bash
# Via Coolify UI : service plausible-ce > Stop > Delete (avec volumes)
# Via DNS : supprimer record plausible.axion-ia.com via Cloudflare API
# Côté app axion-ia : retirer NEXT_PUBLIC_PLAUSIBLE_* + redeploy
```

Le composant `<Plausible />` retourne `null` automatiquement si
`NEXT_PUBLIC_PLAUSIBLE_DOMAIN` est absent — pas de leak, pas de breakage.

## Liens externes

- Plausible Community Edition : https://github.com/plausible/community-edition
- Plausible self-host docs : https://plausible.io/docs/self-hosting
- Image officielle GHCR : https://ghcr.io/plausible/community-edition
- Coolify docs Services : https://coolify.io/docs/services/overview
