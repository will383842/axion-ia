# Guides par réseau — interrupteurs et secrets

Les routes internes signées du Studio (HMAC + horodatage + nonce) ont chacune leur interrupteur.
Tous sont lus **à l'exécution** (`process.env`, scope RUN, conteneur **app** seulement — jamais un
build-arg) et valent « éteint » sauf si la valeur est exactement `true`.

| Variable                     | Route                                     | Défaut |
| ---------------------------- | ----------------------------------------- | ------ |
| `GUIDES_RESEAU_ENABLED`      | `POST /api/interne/demandes-guide-reseau` | éteint |
| `OPPOSITIONS_RESEAU_ENABLED` | `POST /api/interne/oppositions-reseau`    | éteint |

Éteint → `503 reception_eteinte` ; rien n'est lu ni écrit.

## `OPPOSITIONS_RESEAU_ENABLED`

Reçoit le « stop » écrit par une personne en message privé d'un réseau. L'adresse est mise à
l'écart des envois (table `email_oppositions`, empreinte seulement, CRM prévenu, envois
programmés retirés). **Aucune suppression**, jamais le chemin d'effacement. Pas de table, pas de
migration : l'opération est idempotente par nature.

- **L'allumer AVANT `GUIDES_RESEAU_ENABLED`** : on doit pouvoir enregistrer un « stop » avant
  d'envoyer le premier guide.
- **Ne jamais l'éteindre pendant que le Studio tourne** : un « stop » refusé (503) serait perdu
  pour une personne qui a demandé à ne plus être contactée.
- Éteint par défaut.

## Secret

`GUIDES_RESEAU_HMAC_SECRET` (≥ 32 caractères, + `GUIDES_RESEAU_HMAC_SECRET_PRECEDENT` pendant
une rotation). La route des oppositions n'a **aucun repli** sur `VIDEOS_STUDIO_HMAC_SECRET`
(la route des demandes de guide, elle, en garde un historique). Secret absent ou trop court →
`503 reception_non_configuree`.

## Corps de la requête (oppositions)

```json
{
  "schemaVersion": 1,
  "cleIdempotence": "run_xxx",
  "email": "a@b.fr",
  "motif": "stop",
  "reseau": "instagram",
  "occurredAt": "2026-11-06T10:00:00.000Z"
}
```

Tout autre champ → `422` (seuls les noms de champs sont rendus). Réponse : toujours
`200 {"ok":true,"type":"opposition","recue":true}`, que l'adresse soit nouvelle, déjà écartée ou
inconnue. Plafond du corps : 4 Ko.
