# R12 — Mettre la console éditoriale en ligne

> Trois gestes, dans cet ordre. Le premier AVANT le déploiement, les deux
> autres après. Aucun n'est réversible sans perte si on le saute.
>
> Référence : PR #783, ADR 0045, `docs/runbooks/coolify-procedures.md` pour les
> variables Coolify transverses.

---

## Ce qui se fait tout seul, et ce qui ne se fait pas

|                                           | Automatique ?                                                     |
| ----------------------------------------- | ----------------------------------------------------------------- |
| Les 24 tables `ed_*` (migration Prisma)   | ✅ `docker-entrypoint.sh` lance `prisma migrate deploy` au boot   |
| L'index de recherche plein texte          | ✅ l'entrypoint applique `prisma/migrations_fts/*.sql` par boucle |
| **Le volume de stockage des médias**      | ❌ **geste 1**                                                    |
| **L'amorçage des règles et référentiels** | ❌ **geste 2**                                                    |
| **L'import du dossier LinkedIn**          | ❌ **geste 3**, et il dépend de vos fichiers                      |

🔑 Sans les gestes 2 et 3, la console démarre et **fonctionne** — elle affiche
simplement ses états vides, qui expliquent quoi lancer. Rien ne casse. Le
geste 1, lui, ne se rattrape pas : voir l'avertissement ci-dessous.

---

## Geste 1 — Le volume de stockage · **AVANT le premier déploiement**

### Pourquoi il ne se rattrape pas

`EDITORIAL_STORAGE_PATH` vaut `/var/data/editorial-media` par défaut. Sans
volume monté à ce chemin, les fichiers déposés vivent dans la **couche
éphémère du conteneur** et disparaissent au redéploiement suivant —

- sans erreur,
- sans trace dans les journaux,
- et la fiche continue d'afficher un asset qui pointe vers un fichier absent.

C'est un mode d'échec silencieux et différé : on ne le découvre qu'en cherchant
un rush trois semaines plus tard.

### ⚠️ Volume DÉDIÉ, pas celui de la banque d'images

Les deux stockent des fichiers utilisateur, mais leurs cycles de vie n'ont
aucun rapport : **une variante d'image se régénère, un rush de tournage ne se
régénère pas.** Les mélanger ferait qu'un nettoyage de l'un emporterait
l'autre.

### La procédure

Dans Coolify → application `axion-ia` → **Storages** → _Add_ :

| Champ            | Valeur                      |
| ---------------- | --------------------------- |
| Name             | `editorial-media`           |
| Destination Path | `/var/data/editorial-media` |

Puis → **Environment Variables** → _New_ :

| Clé                      | Valeur                      | Scope |
| ------------------------ | --------------------------- | ----- |
| `EDITORIAL_STORAGE_PATH` | `/var/data/editorial-media` | RUN   |

> La variable est facultative — le défaut du code est le même chemin. On la
> pose quand même : une configuration explicite se lit, un défaut implicite se
> découvre.

### 🔴 Le propriétaire du dossier — l'étape que ce runbook avait oubliée

> Trouvé le 2026-08-23, en appliquant ce runbook pour de vrai. Il n'y était
> pas, et sans lui les deux premières étapes ne servent à rien.

Docker crée un volume neuf appartenant à **root**. Le conteneur, lui, tourne
sous un utilisateur non privilégié. Le dossier existe donc, il est monté, il
survit aux redéploiements — **et l'application ne peut pas y écrire.**

⚠️ **En SSH sur l'hôte, pas dans le terminal Coolify.** Celui-ci s'ouvre DANS
le conteneur, sous l'utilisateur qui n'a justement pas le droit de faire un
`chown`. La commande y échouera.

Deux valeurs sont nécessaires, à relever avant :

```bash
# 1. Le chemin RÉEL du volume sur l'hôte (pas /var/data/... qui est la vue
#    de l'intérieur du conteneur) :
docker inspect <conteneur> --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{"\n"}}{{end}}'

# 2. L'UID sous lequel tourne l'application :
docker exec <conteneur> id

# 3. Puis, en root sur l'hôte :
chown -R <uid>:<gid> <chemin hôte du volume>
```

### Vérifier

```bash
# Depuis le conteneur applicatif — le `touch` échoue si le chown manque :
ls -la /var/data/editorial-media && touch /var/data/editorial-media/.probe
# Puis redéployer et vérifier que .probe a SURVÉCU :
ls -la /var/data/editorial-media/.probe   # doit exister
rm /var/data/editorial-media/.probe
```

🔴 Si `.probe` a disparu après redéploiement, le volume n'est pas monté et
**tout dépôt de fichier sera perdu**. Ne pas continuer.

---

## Geste 2 — L'amorçage des référentiels · après le déploiement

Il crée les 2 marques, 11 comptes, 9 familles d'assets, 9 spécifications de
plateforme, **12 règles de conformité**, **11 règles d'alerte** et
**3 recettes de dérivation**.

Sans lui, aucune validation ne bloquera jamais rien : les règles vivent en
base, et une base vide ne refuse rien.

🔴 **CE RUNBOOK DISAIT DE LE LANCER DANS LE CONTENEUR. C'ÉTAIT FAUX.**

> Trouvé le 2026-08-23, en essayant. `editorial:seed` est
> `tsx prisma/seeds/editorial/index.ts`, et **`tsx` est une devDependency** :
> l'image de production est un standalone allégé qui ne la contient pas, et
> qui ne porte pas non plus les sources TypeScript à compiler.
>
> Je l'avais supposé parce que la commande marche en local. Elle ne peut pas
> marcher là-bas.

**Ni `npx tsx` ni l'ajout de `tsx` à l'image.** Le premier télécharge du code
non vérifié dans un conteneur en production ; le second embarque un
compilateur TypeScript à demeure pour une commande jouée une fois — dans un
Dockerfile qui porte déjà l'historique de plusieurs OOM à l'export des
layers.

**Le seed se lance depuis une machine qui a le dépôt, en pointant sur la base
de production :**

```bash
DATABASE_URL="<url de la base de production>" pnpm editorial:seed
```

L'URL se lit dans Coolify → application → Environment Variables →
`DATABASE_URL`.

⚠️ **Cette commande écrit dans la production depuis un poste de travail.** Une
erreur de copier-coller dans l'URL et c'est une autre base qui reçoit les
écritures. La relire avant de valider est le seul garde-fou.

🔑 Ce qui rassure : le seed n'écrit que des lignes NEUVES, dans des tables
créées le jour même et vides. Il ne modifie ni ne supprime rien d'existant.

### Ce que la sortie doit dire

```
   marques                    2 créé(s),   0 préservé(s)  (total 2)
   comptes                   11 créé(s),   0 préservé(s)  (total 11)
   familles d'assets          9 créé(s),   0 préservé(s)  (total 9)
   specs de plateforme        9 créé(s),   0 préservé(s)  (total 9)
   recettes de dérivation     3 créé(s),   0 préservé(s)  (total 3) (7 dérivés au total)
   règles de conformité      12 créé(s),   0 préservé(s)  (total 12)
   règles d'alerte           11 créé(s),   0 préservé(s)  (total 11)
✅ [editorial:seed] terminé.
```

**Idempotent** : le rejouer affiche `0 créé(s), N préservé(s)` et ne duplique
rien. On peut donc le relancer sans risque en cas de doute.

### Vérifier depuis la console

Ouvrir **Réglages** : le compteur doit dire `12 active(s) sur 12` et
`11 active(s) sur 11`.

---

## Geste 3 — L'import du dossier LinkedIn · quand les fichiers existent

⚠️ **Ce geste attend des fichiers que personne n'a encore fournis.** L'import
a été construit et testé contre une reconstitution fidèle du format ; il n'a
jamais vu les vrais fichiers.

Le dossier attendu contient :

- `02-calendrier-publication.csv` — le calendrier (BOM UTF-8, CRLF, `;`)
- `10-LES-61-POSTS.md` — les textes

```bash
# Lecture seule, ne touche à RIEN — à faire en premier :
pnpm editorial:import --source <dossier> --dry-run

# Puis, si le rapport est conforme :
pnpm editorial:import --source <dossier>
```

### Les trois protections

1. **`--dry-run` d'abord.** Il lit, compte, signale les lignes fautives, et
   n'écrit pas une ligne.
2. **Un marqueur en base** empêche un second import accidentel : le rejeu
   affiche « déjà effectué le … — RIEN n'a été créé ».
3. **Idempotence par référence** : même forcé avec `--confirmer`, une
   publication déjà importée n'est pas dupliquée.

### Ce que le rapport doit dire

```
Publications créées : 61 / Reprises (échos) : 13 / Ignorées : 0 / En erreur : 0
```

🔴 **Si les chiffres diffèrent, ARRÊTER et lire les avertissements.** Les
critères 2, 3 et 4 du lot 0 sont à rejouer sur ces vrais fichiers — ils n'ont
jamais été validés que sur la reconstitution.

---

## Rollback

Le travail est **entièrement additif** : 24 tables neuves, 13 énumérations
neuves, deux colonnes ajoutées à `ed_journal`. Aucune table existante n'est
modifiée, aucune migration ne contient de `DROP`.

| Si…                                   | Alors                                                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Les écrans posent problème            | Supprimer `src/app/**/console-editoriale/`. Rien d'autre n'en dépend                                                      |
| La migration doit être annulée        | `DROP TABLE ed_*` (24) puis `DROP TYPE "Ed*"` (13). Aucune perte hors console éditoriale                                  |
| L'import a versé de mauvaises données | `DELETE FROM ed_publications WHERE ref_import LIKE 'linkedin-2026-q4-%'`, puis supprimer le marqueur dans `site_settings` |

**Un déploiement inachevé ne casse rien.** Sans amorçage, chaque écran affiche
son état vide, qui explique quoi lancer.

---

## Ce qui restera après les trois gestes

Deux choses, qui ne se déploient pas :

- **`ffprobe`** dans l'image, pour extraire la durée des vidéos déposées. Sans
  lui, la règle de spécification de plateforme rend « non évaluée » plutôt que
  de déclarer conforme sans avoir mesuré.
- **Les accès aux plateformes** (lot 5). 🔴 Sans l'audit TikTok, une vidéo
  envoyée par l'API partirait **en privé** — statut « publié », référence
  rendue, aucune erreur, et personne ne verrait jamais rien. Un test vérifie
  qu'aucune porte n'est marquée ouverte, pour que l'ouvrir reste un geste
  délibéré.
