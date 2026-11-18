# Audit présentiel : réception des événements (PR2)

Code : `src/server/audit-terrain/`, routes `src/app/api/audit-terrain/v1/`, actions `src/features/admin-audit-terrain/`.

## Réponse 200 de `POST /evenements`

    { acceptes: string[], dejaRecus: string[], conflits: string[],
      rejetes: [{ eventId, motif }], dernierSeqRecu: number, trous: number[] }

- `rejetes` : événements refusés un par un. Motifs : `trop_gros` (donnees > 64 Ko en octets), `source_inconnue` (rapport sans source valide). L'outil PC ne doit pas les renvoyer.
- Lot entier refusé (422) seulement pour un schéma invalide ou un SHA-256 recalculé différent. 409 : plafond de 5 000 événements par session.
- `trous` : au plus 200 numéros, calculés en SQL.

## Conflits

Un même `eventId` avec un contenu différent n'écrase rien : la ligne d'origine reste, un journal d'accès `audit-terrain.conflit` consigne l'eventId et le seq (jamais le contenu). Le contenu divergent reste sur le PC (il n'est pas stocké côté console). `audit_terrain_rapports.event_id` est unique pour toute la table : le même eventId de rapport rejoué dans une autre session finit en conflit.

## Conservation

Durée de conservation : 24 mois. Au terme, la console PROPOSE la suppression ; elle n'est jamais automatique (règle de Will : aucune destruction de données clients sans décision). Avant ce terme, une demande d'effacement déclenche une alerte (PR1, `rgpd-erase.ts`), jamais une suppression. Après l'audit, on révoque le jeton au lieu de supprimer.

## Clé `PII_ENCRYPTION_KEY`

Elle chiffre le contenu (`chiffrerParole`) et sert à dériver la clé HMAC des empreintes stockées.

- Sauvegarde : une copie hors du VPS (gestionnaire de mots de passe de Will, hors dépôt), prise AVANT toute rotation ; jamais dans Git ni dans une PR.
- Perte : le contenu chiffré devient illisible, définitivement. Sans clé, la route refuse d'écrire (500).
- Changement de clé : le contenu déjà écrit ne se déchiffre plus avec la nouvelle, et les empreintes stockées ne correspondent plus : tout rejeu d'un événement existant serait classé en FAUX conflit. Ne pas changer la clé sans migration planifiée (re-chiffrement et recalcul des empreintes).

## Bornes et rotation du jeton

- `seq` est borné à 10 000 (2 x le plafond de session) dans le schéma ; la série de recherche des trous est bornée à `nombre + 200` (mesuré : 3 ms ; l'ancienne série jusqu'à 2 milliards ne finissait pas en 3 s). Le plafond de 5 000 événements est recompté dans la transaction, sous `pg_advisory_xact_lock` par session ; un événement refusé pour cette raison sort en `rejetes` avec le motif `limite_session`.
- `regenererJetonAudit({ sessionId, joursValidite? })` (super_admin) : nouveau jeton pour la MÊME session (même client, mêmes données), l'ancien est refusé (401), une session révoquée est rouverte, l'expiration repart de maintenant (J+2 par défaut, 10 jours au plus). Une session `close` n'est pas rouverte.
