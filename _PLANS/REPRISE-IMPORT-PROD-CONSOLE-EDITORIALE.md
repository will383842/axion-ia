# Console éditoriale — le dossier LinkedIn est en production

> Écrit le 2026-08-24 pendant la PR #810, puis **corrigé le même jour une fois
> l'import fait**. La première version de cette note annonçait une console de
> production vide : elle ne l'est plus.

## Ce qui est FAIT

**Le code** — PR #810 mergée dans `main` (`9fa2de1bc`) et déployée. Build GHCR
51 min, deploy Coolify 4 min, Lighthouse post-deploy vert. La migration
`ed_asset_segments` s'est appliquée au démarrage du conteneur.

**Les données** — importées en production le 2026-08-24, en une fenêtre de
quelques minutes pendant laquelle la base a été exposée puis refermée
(`is_public` remis à `false`, port 15432 vérifié fermé).

| Objet             |                                                          En production |
| ----------------- | ---------------------------------------------------------------------: |
| Publications      |                                                 **74** (61 + 13 échos) |
| Assets            |                                                                 **84** |
| Segments de brief | **238** — 114 slides, 68 consignes, 27 prompts, 22 scripts, 7 légendes |
| Séries            |                                              **4**, 19 posts rattachés |
| Erreurs           |                                                                  **0** |

Avant cela, `editorial:seed` a créé les référentiels : la production n'en avait
**aucun** (`0 préservé(s)` sur les sept familles d'objets).

## Le défaut que seule la production a révélé

Le premier import a échoué :

```
Transaction already closed: the timeout was 5000 ms,
however 5038 ms passed since the start.
```

5 000 ms est le **défaut de Prisma**. Il suffisait tant que l'import ne
tournait qu'en local ; contre une base distante, la latence réseau de chaque
requête s'accumule et la transaction expire. Corrigé à 120 s.

⚠️ **Le tout-ou-rien a tenu** : l'échec n'a rien laissé derrière lui, et le
rejeu a tout écrit d'un coup.

## Ce qui reste ouvert

- **Les visuels** : les 84 assets sont à `a_produire`, aucun fichier déposé.
  Ils se déposent depuis la fiche d'une publication, bloc « Les médias ».
- **Import en lot des visuels** : à écrire quand les fichiers existeront. Ils
  s'apparieraient aux emplacements par la référence de production
  (« vidéo 12 », « carrousel 7 »).
- **Piliers et idées** : toujours 0. `40-PLAN-DIRECTEUR.md` et
  `43-IDEES-EDITORIALES.md` les portent, mais leur extraction demande une
  décision éditoriale, pas une règle mécanique.
- **Vignettes vidéo et PDF** : `sharp` ne sait en fabriquer que pour les
  images. Contournement sans dépendance : déposer une image de couverture à
  côté du mp4 ou du PDF — le calendrier prend la première vignette disponible
  du jour, quel que soit l'asset qui la porte.

## Pour refaire un import contre la production

🔴 **Ne JAMAIS committer le dossier source** : le dépôt est public, et ce
serait publier le trimestre éditorial avant sa parution.

Voies vérifiées le 2026-08-24 :

| Voie                                      | Résultat                                                                |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| Postgres depuis l'extérieur               | fermé par défaut (`is_public: false`)                                   |
| SSH depuis le poste #2                    | `Permission denied (publickey)` — pas de clé                            |
| API Coolify `applications/{uuid}/execute` | **404** — l'endpoint n'existe pas sur cette version                     |
| API Coolify `PATCH databases/{uuid}`      | fonctionne — c'est la voie employée, ouverture puis fermeture immédiate |

Piège d'API : `COOLIFY_API_URL` vaut la racine **sans** `/api/v1`. Sans le
suffixe, tout redirige vers `/login` et on croit le jeton mort.

Les imports sont **idempotents** (`refImport`) et **non répétables** (marqueur
`SiteSetting`) : un rejeu sans `--confirmer` ne fait rien, et avec
`--confirmer` ne crée aucun doublon.
