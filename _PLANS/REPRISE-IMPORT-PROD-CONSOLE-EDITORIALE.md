# Reprise — importer le dossier LinkedIn en PRODUCTION

> Écrit le 2026-08-24, à la fin de la PR #810. À lire depuis n'importe quelle
> machine : c'est la seule trace qui voyage.

## Ce qui est FAIT, définitivement

**PR #810 mergée dans `main` (`9fa2de1bc`) et déployée.** Build GHCR 51 min,
deploy Coolify 4 min, Lighthouse post-deploy vert, `axion-ia.com` répond en 200. La migration `ed_asset_segments` s'est appliquée au démarrage du
conteneur.

Rien de tout cela ne dépend d'une machine. C'est acquis.

## Ce qui RESTE, et ne se fera pas tout seul

⚠️ **La console éditoriale de production est VIDE.** Le code y est, les
données non. Aucun cron, aucun hook ne les y mettra : il faut lancer l'import
à la main.

Ce qui existe uniquement dans la base de **dev locale** du poste #2 :

| Objet             |             Compte |
| ----------------- | -----------------: |
| Publications      | 74 (61 + 13 échos) |
| Assets            |                 84 |
| Segments de brief |                238 |
| Séries            |                  4 |

## Les deux prérequis

1. **Le dossier source**, cinq fichiers, aujourd'hui dans
   `C:\Users\Will\Downloads\AXION-IA_Dispositif_LinkedIn` du **poste #2** :
   - `02-calendrier-publication.csv`
   - `10-LES-61-POSTS.md`
   - `20-PRODUCTION-VIDEOS.md`
   - `21-PRODUCTION-CARROUSELS.md`
   - `22-PRODUCTION-IMAGES-ET-PROMPTS.md`
   - `23-PRODUCTION-PHOTOS-DE-WILL.md`

   🔴 **Ne PAS committer ce dossier** : le dépôt est public, et ce serait
   publier le trimestre éditorial avant sa parution.

2. **Un accès à la base de production.** Le tunnel SSH depuis le poste #1 est
   la voie propre :

   ```bash
   ssh -L 15432:localhost:5432 root@<vps>    # laisser ouvert
   ```

## La séquence

```bash
export DATABASE_URL='postgresql://<user>:<pass>@localhost:15432/<db>'
export DIRECT_URL="$DATABASE_URL"

pnpm editorial:seed                  # référentiels — idempotent, non destructif

pnpm editorial:import --source "<dossier>" --dry-run   # LIRE le rapport
pnpm editorial:import --source "<dossier>"

pnpm editorial:import-production --source "<dossier>" --dry-run
pnpm editorial:import-production --source "<dossier>"
```

Les identifiants Postgres sont dans `.secrets/api-tokens.env`
(`COOLIFY_PG_USER`, `COOLIFY_PG_PASSWORD`, `COOLIFY_PG_DATABASE`).

**Attendu** : 74 publications, 84 assets, 238 segments, 4 séries, 0 erreur.

## Ce qui NE marche pas — vérifié, ne pas réessayer

| Voie                                                  | Résultat                                                                      |
| ----------------------------------------------------- | ----------------------------------------------------------------------------- |
| Postgres depuis l'extérieur                           | port filtré, `is_public: false`                                               |
| SSH depuis le poste #2                                | `Permission denied (publickey)` — pas de clé                                  |
| API Coolify `applications/{uuid}/execute`             | **404** — l'endpoint n'existe pas sur cette version                           |
| API Coolify `PATCH databases/{uuid}` `is_public:true` | fonctionne, mais expose la base sur Internet — refusé sans décision explicite |

Piège d'API : `COOLIFY_API_URL` vaut la racine **sans** `/api/v1`. Sans le
suffixe, tout redirige vers `/login` et on croit le jeton mort.

## Après l'import — deux points ouverts

- **Piliers et idées** : toujours 0 en base. `40-PLAN-DIRECTEUR.md` et
  `43-IDEES-EDITORIALES.md` les portent, mais leur extraction demande une
  décision éditoriale, pas une règle mécanique.
- **Import en lot des visuels** : à écrire quand les 84 fichiers existeront.
  Ils s'apparieraient aux emplacements par la référence de production
  (« vidéo 12 », « carrousel 7 »).
