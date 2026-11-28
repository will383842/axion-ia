feat(apporteurs): PR B #2464 — l'empreinte du contrat signé est revérifiée (point 12)

## Ce qui change

- **Lecture du contrat (console)** : `lireContratPdf` recalcule l'empreinte SHA-256 du PDF lu sur R2 et la compare à celle de la base. Fichier altéré : il n'est jamais servi (les routes rendent déjà leur 404 neutre) et une alerte critique part une seule fois par dossier et par document. Dossier ancien sans empreinte : servi, avec un simple avertissement sans identifiant.
- **Nouveau `integrite-contrat.ts`** : `empreinteConforme` (comparaison en temps constant) et `alerterContratAltere`. Le message ne contient aucune clé R2.
- **Nouvelle étape hebdomadaire `integrite-contrats`** (lundi, heure de Paris, au plus 200 dossiers) : relit les contrats contresignés. Objet absent → alerte `apporteur_contrat_absent` ; altéré → alerte ; conforme → silence. Deux lignes ajoutées dans `passage-quotidien.ts`.
- **Contresignature** : les contrats contresignés à venir sont écrits sous `contrats-signes/apporteurs/<id>/…`. Les clés déjà en base ne bougent pas. Vérifié : `rgpd-erase.ts` ne supprime que les dossiers non contresignés.

## Tests

- `contrat-signe-empreinte-reverifiee.spec.ts` (intact, un octet changé, deux appels = une alerte, empreinte absente, R2 vide)
- `contresignature-cle-sous-prefixe-verrouillable.spec.ts`
- `passage-integrite-contrats.spec.ts` (lundi seulement, plafond 200, absent, altéré, conforme)
- `pnpm typecheck` OK, `pnpm lint` 0 erreur, `pnpm vitest run src/features/apporteurs-reseau` vert.

## Migration

Non (aucun schéma).

## Audit argent

Non (tableau du plan).

## Action manuelle de Will (hors code)

Cloudflare → R2 → bucket privé → _Settings_ → _Bucket lock rules_ → préfixe `contrats-signes/`, rétention **10 ans**. À poser **après** le premier contrat contresigné sous la nouvelle clé.

## Dépendances

Aucune. Aucun réglage éteint par défaut n'a été nécessaire. Fenêtre app/worker : aucun contrat partagé modifié (pas de gabarit, pas d'énumération, pas de colonne).

## Points ouverts

- Plafond de 200 sans curseur : l'étape lit toujours les 200 premiers dossiers (tri par id). Au-delà de 200 contrats contresignés, il faudra une rotation ; non demandée par le plan.
- Les contrats déjà contresignés restent sous l'ancien préfixe `apporteurs/` et ne sont pas couverts par la règle de verrou.
- `pnpm-lock.yaml` : inchangé, pas de réinstallation.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
