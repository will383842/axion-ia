# R30 — Rotation de la clé de chiffrement PII (`PII_ENCRYPTION_KEY`)

> Chantier #2464, point 27. Script : `scripts/securite/rotation-cle-pii.ts`. Registre : `src/lib/pii-colonnes-chiffrees.ts`.
> Dépôt public : aucune clé, aucune valeur dans ce fichier. Les clés vivent dans Coolify et dans le coffre du fondateur.

## ⛔ À lire en premier : l'ancienne clé ne peut PAS être retirée tant que tout le dépôt n'est pas couvert

`PII_ENCRYPTION_KEY` chiffre **toute** l'application (des dizaines de fichiers), pas seulement les apporteurs.
Le registre ne couvre aujourd'hui que **les tables d'apporteurs** (`apporteurs_reseau`, `presentations_entreprise`,
`apporteur_messages_recus`, `pieces_apporteur_contenus`, `apporteur_changements_iban`, `apporteur_changements_iban_rib`,
`apporteur_iban_historique`). Le reste du dépôt entre dans le même registre dans un lot à part.

Conséquence : le script peut afficher « 0 à traiter » alors que d'autres tables sont encore chiffrées avec l'ancienne
clé. **Retirer l'ancienne clé avant que le registre soit global rend ces données illisibles pour toujours.**
La phase D est interdite tant que le registre n'est pas déclaré global.

## Ce que le trousseau fait

- `PII_ENCRYPTION_KEY` : la clé qui **chiffre** (écriture) et qui est essayée en premier à la lecture.
- `PII_ENCRYPTION_KEYS_LECTURE` : clés hexadécimales de 64 caractères, séparées par des virgules, **déchiffrement seul**.
- Le format des chiffrés (`enc:v1`, `enc:v2`, `AXB1`) ne porte pas d'identifiant de clé : on essaie chaque clé, l'étiquette
  GCM dit laquelle est la bonne.
- Les deux variables sont à poser **identiques sur l'app ET sur le worker**.

## Phase A — Préparer (rien n'est encore écrit avec la nouvelle clé)

1. Sauvegarde de la base, et vérifier qu'elle se restaure (R22).
2. Générer la nouvelle clé, hors du dépôt : `openssl rand -hex 32`. La mettre au coffre.
3. Coolify, **app et worker** : `PII_ENCRYPTION_KEYS_LECTURE` = nouvelle clé (on ajoute ; `PII_ENCRYPTION_KEY` ne change pas).
4. Redémarrer les deux. Chaque conteneur sait maintenant **lire** la nouvelle clé.

## Phase B — Basculer l'écriture, sur les deux à la fois

1. Coolify, app et worker : `PII_ENCRYPTION_KEY` = **nouvelle** clé ; `PII_ENCRYPTION_KEYS_LECTURE` = **ancienne** clé.
2. Redémarrer les deux. Chaque conteneur lit les deux clés : l'ordre de redémarrage n'importe plus.
3. Les nouvelles écritures utilisent la nouvelle clé. Les anciennes lignes restent sous l'ancienne, lisibles.

## Phase C — Réécrire l'existant

Depuis un clone du dépôt, avec `DATABASE_URL` de production, `PII_ENCRYPTION_KEY` = nouvelle et
`PII_ENCRYPTION_KEYS_LECTURE` = ancienne :

1. Essai (par défaut, n'écrit rien) : `pnpm tsx scripts/securite/rotation-cle-pii.ts`
2. Lire le rapport : `lecture` = lignes à réécrire ; `illisibles` = chiffrées par une clé inconnue (listées par
   **identifiant**, jamais modifiées : à instruire une par une, ne jamais forcer) ; `claires` = pas chiffrées (hors rotation).
3. Appliquer table par table : `pnpm tsx scripts/securite/rotation-cle-pii.ts --appliquer --table apporteurReseau`, etc.
   Lots de 200, reprise par curseur. Chaque écriture est conditionnelle sur l'ancienne valeur : une écriture concurrente
   fait échouer la mise à jour, la ligne est relue et reprise. Relançable sans risque (idempotent).
4. Les tables à déclencheur (`apporteur_changements_iban`, `apporteur_changements_iban_rib`, `apporteur_iban_historique`)
   passent par `SET LOCAL axion.reecriture_pii = 'rotation'` posé par le script dans la transaction ; la migration
   `20261128130000_apporteurs_rotation_rib` doit être en ligne (sortie du garde des RIB joints).
   Le script remet `majAt` (`@updatedAt`) tel quel sur `apporteur_reseau` et `presentation_entreprise` : la rotation
   n'est pas une activité de la personne et ne doit pas remettre à zéro le compteur d'inactivité de la purge RGPD.
5. Rejouer l'essai : il doit afficher **0 `lecture` et 0 `illisibles`** pour chaque table du registre.

## Phase D — Retirer l'ancienne clé (SEULEMENT si tout le registre global est à 0)

Conditions, toutes : le registre couvre **tout le dépôt** (voir l'avertissement en tête) ; l'essai affiche 0 `lecture`
et 0 `illisibles` sur **toutes** les tables ; plus aucune ligne n'a été écrite avec l'ancienne clé depuis la phase B.

1. Retirer l'ancienne clé de `PII_ENCRYPTION_KEYS_LECTURE` sur app et worker, redémarrer.
2. Garder l'ancienne clé **hors ligne** (coffre) un an : une sauvegarde antérieure à la phase B n'est lisible qu'avec elle.

## En cas de problème

- Valeurs illisibles : ne rien écraser. Chercher quelle clé les a produites (sauvegarde, ancienne rotation).
- Retour arrière avant la phase D : remettre `PII_ENCRYPTION_KEY` = ancienne et la nouvelle dans `PII_ENCRYPTION_KEYS_LECTURE`
  (le trousseau lit les deux, rien n'est perdu).
- Le script ne journalise jamais une valeur en clair ni une clé : seuls des identifiants et des compteurs apparaissent.
