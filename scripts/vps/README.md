# Scripts de sauvegarde VPS (`/opt/axion-ia/`)

Copie **versionnée** des scripts d'orchestration de sauvegarde qui tournent sur le VPS
de production (`178.105.55.15`), déployés manuellement dans `/opt/axion-ia/` et déclenchés
par le crontab `root`. Avant ce dossier, ces scripts n'existaient **que** sur le serveur :
en cas de reconstruction du VPS, ils étaient perdus. Ils sont ici pour la traçabilité et
la reprise après sinistre. Voir `docs/adr/0032-backup-dr-extension-pitr-immutability.md`.

> ⚠️ **Ces fichiers ne sont pas exécutés depuis le repo.** Ils sont la source de vérité
> versionnée ; la copie qui tourne est dans `/opt/axion-ia/` sur le VPS. Toute modif doit
> être appliquée **aux deux endroits** (voir « Redéploiement » plus bas).

## Contenu

| Fichier                         | Rôle                                                                                                                                                                                                                | Cron (UTC)                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `run-pg-hourly-backup.sh`       | Dump Postgres applicatif → R2 `postgres/hourly/` (RPO ~1 h)                                                                                                                                                         | `20 * * * *`                               |
| `run-r2-backup.sh`              | Dump Postgres daily/weekly/monthly → R2 (auto-pull `backup-postgres-r2.sh`)                                                                                                                                         | `0 3` / `0 4 dim` / `0 5 1er`              |
| `run-files-backup.sh`           | tar chiffré des volumes fichiers (CV, console-docs, avis) → R2 `files/{daily,weekly,monthly}/`                                                                                                                      | `15 4 * * *` · `30 4 * * 0` · `30 5 1 * *` |
| `run-secrets-backup.sh`         | Archive chiffrée des secrets/env de **toute l'instance** Coolify → R2 `secrets/` (rétention 30)                                                                                                                     | `0 2 * * *`                                |
| `run-storagebox-mirror.sh`      | **Seconde destination hors serveur** : recopie R2 → Hetzner Storage Box (Axion-IA + Axion Audit). Le mot de passe est LU dans `/opt/axion-ia/.storagebox-password` (600), jamais interpolé.                         | `30 5 * * *`                               |
| `verifier-miroir-storagebox.sh` | **Controle** du miroir : fichiers presents hors site, plus gros >= 10 Mo, dernier passage < 30 h. Lu par le workflow `surveillance-miroir-storagebox.yml`, qui tourne DEPUIS GITHUB et ouvre une issue si ca casse. | appele, pas planifie                       |
| `run-docuseal-backup.sh`        | Dump Docuseal → R2 `docuseal/{daily,weekly,monthly}/`                                                                                                                                                               | `45 2 * * *` · `50 4 * * 0` · `50 5 1 * *` |
| `run-plausible-backup.sh`       | Dump Plausible PG + ClickHouse → R2 `plausible/pg/daily/` + `plausible/ch/daily/`                                                                                                                                   | `30 3 * * *`                               |
| `run-backup-digest.sh`          | **Bilan quotidien Telegram unique** : lit R2, vérifie fraîcheur par composant                                                                                                                                       | `30 6 * * *`                               |
| `crontab.snapshot.txt`          | Snapshot du crontab `root` (référence)                                                                                                                                                                              | —                                          |

## Notifications Telegram (2026-07-11)

Historiquement chaque run envoyait un ping Telegram « OK » → ~28 messages/jour (dont 24 du
backup horaire). Réduit à **1 seul message par jour** :

- Les 4 wrappers « inline » (`pg-hourly`, `files`, `secrets`, `docuseal`) ont leur ligne
  de succès `notify_telegram "OK…"` commentée (`#DIGEST-SILENCED`). Ils **gardent** les
  variables `TELEGRAM_*` → les **alertes d'échec** (`record_fail` 🔴) restent en temps réel.
- `run-r2-backup.sh` et `run-plausible-backup.sh` notifient via des sous-scripts tirés de
  GitHub (non éditables sur le VPS) → leurs 2 lignes `-e TELEGRAM_*` ont été retirées
  (silence total ; leur état est couvert par le digest + le dashboard + Healthchecks).
- `run-backup-digest.sh` envoie le bilan à 08 h 30 Paris (06 h 30 UTC).

> ⚠️ **Piège prefixes R2 Plausible** : la sauvegarde atterrit dans `plausible/pg/daily/`
> **et** `plausible/ch/daily/`, jamais `plausible/daily/`. Le digest vérifie les deux.

## Ce qui a changé le 2026-09-03 (reprise à froid)

Trois défauts mesurés en auditant le scénario « Coolify tombe » :

1. **`run-secrets-backup.sh` ne sauvegardait que le site.** Il n'interrogeait que
   `/applications/$COOLIFY_APP_UUID/envs`. Manquaient le `SECRET_KEY_BASE` de Docuseal —
   sans lui la base Docuseal restaurée est illisible —, les variables propres au worker,
   les identifiants des bases et ceux de Plausible. Il énumère désormais les trois familles
   de ressources Coolify et joint le `printenv` de chaque conteneur vivant. Il **refuse
   d'envoyer** une archive amputée, et **se relit depuis R2** après chaque envoi : la
   restauration des secrets est prouvée tous les jours, et remontée comme `RestoreDrill`.
2. **Aucune profondeur au-delà de 14 jours pour les fichiers.** `files/` n'avait qu'un
   palier quotidien (14 objets) et `docuseal/` qu'un quotidien (24). Or Hetzner ne conserve
   que **7** emplacements de snapshot — nombre non réglable. Une suppression repérée après
   trois semaines n'était donc plus récupérable nulle part, pour des pièces dont la
   rétention légale est de cinq ans. D'où les paliers hebdo et mensuel ajoutés ci-dessus.
3. **L'alerte « CASCADING FAIL » ne pouvait pas se déclencher.** Elle n'escalade qu'à
   partir de **deux** échecs consécutifs, mais le compteur vivait dans le conteneur
   éphémère : il repartait de zéro à chaque exécution et valait donc 1 pour l'éternité.
   Une sauvegarde pouvait échouer toutes les nuits sans qu'aucune escalade ne parte.
   Les **six** wrappers montent désormais `/var/lib/axion-backup` et passent
   `FAIL_COUNT_DIR` (ou `FAIL_COUNT_FILE` pour `run-r2-backup.sh`, qui redéfinit
   `record_fail`). Au passage, `backup-lib.sh` calcule le chemin **à l'appel** et non au
   `source` : `backup-plausible.sh` bascule sur `plausible_clickhouse` après avoir sourcé,
   si bien que ses échecs ClickHouse comptaient dans le compteur de Postgres.
   Verrouillé par `tests/unit/ci/compteur-de-fails-survit-au-conteneur.spec.ts`.

> ⚠️ **Ordre de déploiement.** Les wrappers tirent `backup-lib.sh` depuis `main` à chaque
> exécution. `FAIL_COUNT_DIR` n'existe donc qu'une fois la PR fusionnée : déployer les
> wrappers sur le VPS **après** la fusion, pas avant.

## Sécurité

Aucun secret n'est en dur : chaque script lit les variables (`R2_*`, `DATABASE_URL`,
`BACKUP_ENCRYPTION_PASSPHRASE`, `TELEGRAM_*`) **au runtime** via
`docker exec <app> printenv …`. Les noms de conteneurs Coolify ne sont pas des secrets.

## Redéploiement (VPS)

```bash
# depuis un checkout du repo, copier vers le VPS puis rendre exécutable
scp scripts/vps/run-*.sh axion-prod:/opt/axion-ia/
ssh axion-prod 'chmod +x /opt/axion-ia/run-*.sh'
# le crontab root reste géré à la main : cf. crontab.snapshot.txt (crontab -e)
```

Restauration / drill : voir `docs/runbooks/` (R33 disaster recovery) et
`_AUDIT/RUNBOOK-PG-RESTORE-DRILL-2026-05-16.md`.

## Le miroir Storage Box — deux pieges deja payes

Ce script a ete depose sur le VPS le **2026-09-03** et n'a **jamais tourne une
seule fois** avant le 2026-09-14. Il n'etait ni versionne, ni planifie, et il
portait un defaut qui l'empechait de s'authentifier. Trois absences pour un
seul resultat : la seconde destination hors serveur n'existait pas, alors que
tout laissait croire le contraire.

### 1. `-b -` desactive l'authentification par mot de passe

`sftp -b -` implique le mode batch, qui refuse toute saisie de mot de passe —
y compris celle que `sshpass` fournit. Le script ne pouvait donc PAS fonctionner,
quel que soit le secret. Mesure du 2026-09-14, meme mot de passe, trois formes :

| Forme                                                            | Resultat  |
| ---------------------------------------------------------------- | --------- |
| document en ligne (methode de `verifier-sauvegarde.sh` cote CRM) | ✅ OK     |
| `-b -` seul                                                      | 🔴 refuse |
| `-b -` + `-o BatchMode=no`                                       | ✅ OK     |

🔑 Le symptome est un **« Permission denied »**, c'est-a-dire exactement ce
qu'affiche un mauvais mot de passe. On peut donc y perdre des heures a chercher
du cote du secret ou du fournisseur. C'est arrive deux fois : l'en-tete du
script raconte deja une demi-heure perdue a croire a un blocage Hetzner.

### 2. Lire un secret d'un `.env` en le DECOUPANT le corrompt

Le `.env` du CRM est en fins de ligne Windows et la valeur est entre guillemets.
`grep | cut | tr -d '"'` rend **15 caracteres** la ou la valeur en fait **13**.
La bonne facon est celle des scripts du CRM :

```sh
set -a; source <(grep -E '^SB_' /opt/axion-crm-pro/.env); set +a
```

⚠️ Un mot de passe corrompu et un mot de passe faux rendent le meme message.
Un controle de LONGUEUR avant usage distingue les deux en une seconde.

### Pourquoi l'echec serait SILENCIEUX

`run-backup-digest.sh` n'interroge que R2 (`aws s3 ls`) : un miroir mort laisse
le bilan quotidien tout vert. Le tableau de bord est indexe par COMPOSANT et ne
connait aucune entree `storagebox`. **Tant qu'une garde externe n'existe pas,
seul le journal `/var/log/storagebox-mirror.log` dit la verite** — le relire
apres tout changement touchant la Storage Box.

### La surveillance — et pourquoi elle ne tourne PAS sur le VPS

`.github/workflows/surveillance-miroir-storagebox.yml` s'execute **depuis
GitHub**, chaque jour a 07:00 UTC, 1 h 30 apres le miroir. Il ouvre une issue
quand le controle echoue.

🔑 Une surveillance hebergee sur la machine qu'elle surveille meurt avec elle :
serveur eteint, disque plein, SSH casse — et la garde se tait exactement quand
elle devrait crier. Ici un VPS injoignable fait **echouer** le job (`ssh` sort
en 255, distingue du code du script), donc ouvre une issue. **L'absence de
signal est traitee comme un signal.**

Le controle a ete **prouve rouge dans quatre directions** avant d'etre branche,
le 2026-09-14 : trop vieux, trop petit, rien hors site, secret absent. Les deux
seuils sont surchargeables pour pouvoir rejouer ces preuves :

```sh
bash /opt/axion-ia/verifier-miroir-storagebox.sh              # doit passer
SEUIL_AGE_H=0        bash /opt/axion-ia/verifier-...sh        # doit echouer
SEUIL_TAILLE_MO=9999 bash /opt/axion-ia/verifier-...sh        # doit echouer
```

⚠️ La premiere version comparait des HEURES ENTIERES : `SEUIL_AGE_H=0` ne
pouvait donc jamais etre depasse par un age de 0 h, et la branche « trop
vieux » etait **indemontrable** — elle rendait vert. Corrige en comparant des
secondes. Une garde qu'on ne peut pas voir rouge ne garde rien.
