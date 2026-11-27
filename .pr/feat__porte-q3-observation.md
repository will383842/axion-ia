Porte qualité des contenus : branchement en observation et écran de console en lecture

## Ce que fait la PR

- Le worker de génération note chaque contenu produit avec la porte (Q2) et écrit son verdict dans `content_quality_verdicts` (Q1), en mode « ombre ». Elle ne bloque rien : aucun statut de job, file de revue ou publication n'en dépend, et le branchement ne lève jamais d'erreur (table absente P2021 tolérée).
- Interrupteur `CONTENT_PORTE_OBSERVATION` (lu par le worker, « true » exact, éteint par défaut, déclaré dans `env.ts` et `.env.example`).
- Auteur et date rejoués comme à la publication (B14) ; surface de doctrine complète (FAQ, citation, balises, texte d'image) pour B01.
- Écran « Porte qualité » (lecture seule, sans JavaScript client, réservé aux administrateurs) : onglets Vue d'ensemble et Contenus, entrée de menu, critères lus depuis le registre, `null` affiché « indisponible ».
- Annotations RGPD « technique » sur les deux modèles de Q1.
- Aucune migration, aucune nouvelle valeur d'énumération.

À savoir : les liens et la page propriétaire ne sont pas branchés en observation, et les critères de faits/doublons/intention arrivent plus tard : les verdicts sortent donc « Bloqué » par construction ; l'écran le dit. Lire le détail des critères, pas le compteur.

## Base de la PR

`main`, après fusion de #2456 (Q1) et #2460 (Q2). La branche contient leurs commits par fusion ; une fois ces deux PR fusionnées, seul le travail Q3 apparaît.

## Tests

- vitest : `porte-qualite` (observation, vue, concordance § 12.1), `porte-qualite-io`, `porte-qualite-observation-ne-bloque-rien`, `admin-nav`, `tests/unit/ci` (verts).
- `pnpm typecheck`, `pnpm lint` (0 erreur), `content-gen:isolation-check`, `image-bank:isolation-check`, prettier : verts.

VERDICT OPUS : BON (2 tours)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01E7vxGcJoV5Y9TXXMr6wSzY
