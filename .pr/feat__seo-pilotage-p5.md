Contrôle d'indexation des pages du site, à tour de rôle et sous le quota de Google (pilotage SEO, lot P5)

## Ce que fait cette PR

Chaque jour à 7 h (heure de Paris), le robot demande à Google l'état d'indexation d'une série de pages (outil « Inspection d'URL » de la Search Console) et note le résultat. Il respecte le quota de Google, partagé avec les autres usages.

- **Un seul compteur par jour** (jour du Pacifique, comme Google) : 200 inspections pour le suivi après publication, 1 400 pour la rotation, 400 pour la console, 2 000 au total. Réservation atomique (script Redis), un usage ne mange pas le quota d'un autre.
- **Débit** : au moins 200 ms entre deux appels (≤ 300 par minute, la moitié du plafond de Google).
- **Ordre de priorité** : 1) pages nouvelles ou modifiées depuis moins de 48 h ; 2) impressions qui chutent ou tombées à zéro ; 3) les 15 pages stratégiques, chaque semaine ; 4) jamais inspectées, puis les plus anciennes ; 5) pages en noindex, une fois par mois.
- **Une ligne n'est écrite que si un champ change** (verdict, couverture, canonique Google ou déclarée, dernier passage du robot). La date de dernier passage est tenue à part (Redis) pour qu'une page inchangée ne revienne pas chaque jour.
- **Arrêts propres** : quota Google atteint, identifiants absents, ou 5 erreurs de suite. Une page en erreur est marquée vue : elle ne bloque pas la rotation le lendemain.
- **Suivi après publication existant** (`content-refresh-worker.ts`) : un seul changement, il passe par le compteur partagé (plafond 200 conservé).
- Nouvelle fonction `gscInspecterUrlDetaille` : distingue quota, identifiants absents et erreur (l'ancienne `gscInspectUrl` est inchangée).

## Sécurité

- **ÉTEINT par défaut** : sans `CONTENT_PILOTAGE_SEO="true"`, la tâche saute avant toute lecture de base, tout accès Redis et tout appel Google. Build GitHub (stub) : saut. Table absente : saut sans échec.
- Un ancien worker qui reçoit la tâche `inspection` l'ignore (tâche inconnue journalisée).
- Journaux : des nombres seulement. Aucun schéma, aucune migration.

## Limites connues

- `SiteRoute.lastModifiedAt` n'est écrit par aucun code : la priorité 1 s'appuie sur la création de la route (page nouvelle). Une page seulement modifiée n'est couverte que par le suivi après publication (articles).
- La liste des 15 pages stratégiques est écrite dans `priorites.ts` : à confirmer par Will.
- Le script Redis (Lua) est vérifié par lecture et par un test sur son appel, pas exécuté contre un vrai Redis.
- La tâche dure 30 à 40 min : les rattrapages de la même file attendent derrière elle.

## Base

`main` (ouverte après la fusion de P4 ; cette branche part de la branche de P4).

## Tests

`pnpm prisma generate`, `pnpm typecheck`, vitest (pilotage SEO, queue, content-gen/seo, équipe, `tests/unit/ci`) : OK ; `content-gen:isolation-check`, `image-bank:isolation-check`, lint, prettier : OK.

- Le calage des fenêtres d'impressions sur le dernier jour présent dans `gscPageJour` (aujourd'hui : sur la date du jour, 2 à 3 jours de retard d'ingestion) est à affiner.
- Une coupure réseau passagère marque la page vue (reprise au rang de rappel).
- La liste des 15 pages stratégiques contient 4 chemins qui ne sont pas des routes (`/fr/interventions`, `/fr/interventions/essentielle`, `/fr/audit/flash`, `/fr/reserver` → `/fr/appel/reserver`) : à corriger avec Will.

VERDICT OPUS : BON
