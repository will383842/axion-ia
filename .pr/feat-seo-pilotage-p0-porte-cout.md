# P0 · Porte de coût pour les appels hors génération, et deux défauts de l'équipe éditoriale

## But

Permettre au pilotage SEO et à l'équipe éditoriale d'appeler Claude sans passer par un job de génération, sans sortir des plafonds de coût. Corrige aussi deux défauts constatés sur `main`. Aucune migration, aucun nouvel interrupteur : le comportement reste derrière `CONTENT_EQUIPE_EDITORIALE`.

## Ce qui change

- **Job porteur** (`providers/job-porteur.ts`, nouveau) : `creerJobPorteur({ origine, plafondJobUsd })` crée une ligne `content_gen_jobs` d'un type existant et autorisé, au statut `cancelled`, avec `inputPayload.origine`. Pas de nouvelle valeur d'énumération. Le statut `cancelled` est le seul qui échappe à la relance du recovery, à la clôture « bloqué » et aux comptages de l'orchestrateur.
- **Invisibilité** : les comptages sans filtre de statut excluent les porteurs (`whereHorsPorteurs`) : moniteur « chaîne à l'arrêt » (2 comptages), rapport hebdo, tableau de bord, panneau de santé. « Relancer » refuse un porteur.
- **Sous-plafonds** (`blog-claude-plafonds.ts`, `blog-claude-ledger.ts`) : `pilotage_cout_max_jour_usd` (2 $) et `pilotage_cout_max_mois_usd` (30 $), lus dans `ContentGenConfig` et appliqués par `reserverCout`, sous le verrou, pour l'origine `pilotage`. Ils s'ajoutent au cumul commun 10 $/200 $. Lecture en erreur = refus ; valeur illisible = défaut ; 0 explicite = tout refusé. Modèle imposé : Sonnet 5.5 ou Opus 5.5 (Haiku refusé).
- **Mise à jour réelle** : `mise-a-jour-reel.ts` crée un porteur (origine `equipe_maj`, 3 $ par article, créé au premier appel payant) au lieu de `maj-<id>`, qui n'existait pas en base et faisait refuser chaque appel.
- **Éditeur SEO** : `edition-seo.ts` n'envoie plus `blog_edition_seo` (absent de l'énumération). Il reprend le type du job appelant (le worker le passe), sinon `blog_from_keywords`. La PR 12 (fusionnée) branche `editerSeo` dans le worker mais ne traitait pas ce type : c'est corrigé ici.

## Fichiers

`providers/job-porteur.ts` (nouveau), `providers/blog-claude-ledger.ts`, `providers/blog-claude-plafonds.ts`, `equipe/mise-a-jour-reel.ts`, `equipe/edition-seo.ts`, `queue/workers/content-gen-worker.ts` (une ligne), `content-monitoring-worker.ts`, `content-weekly-report-worker.ts`, `actions/content-gen/{jobs,dashboard,health}.ts`, et les tests.

## Tests

- Nouveaux : `job-porteur.spec.ts`, `blog-claude-ledger-pilotage.spec.ts` (réservation avec/sans porteur, cumul commun, sous-plafonds jour/mois, config en erreur, modèle), `blog-claude-plafonds-pilotage.spec.ts`.
- Étendus : `edition-seo.test.ts` (type dans `Object.values(ContentType)` et autorisé), `mise-a-jour-reel.test.ts` (porteur créé une fois, paresseux, refus propagé).
- `pnpm typecheck` et `pnpm lint` (fichiers modifiés) passent ; specs `content-gen/providers`, `content-gen/equipe`, `queue/workers`, `actions/content-gen` : toutes vertes.
- Note d'environnement : les dépendances n'étaient pas installées dans le clone ; `pnpm install --frozen-lockfile --ignore-scripts` puis `prisma generate` ont été lancés (lockfile inchangé).

## Risques et points à connaître

- **Changement de comportement** : la mise à jour réelle, refusée à 100 % jusqu'ici, va désormais dépenser (si l'équipe, `CONTENT_REFRESH_ENABLED` et la tâche `mise-a-jour` sont actifs) : au plus 3 $ par article, 1 par jour par défaut, pris sur le budget commun.
- Les porteurs apparaissent en « annulés » dans la liste des jobs et l'export CSV, et dans la carte « Jobs 24 h » de l'orchestrateur (`actions/content-gen/geo.ts:194`, non filtré). Ils ne sont ni relançables ni supprimables par la console (la suppression ferait disparaître leur coût du cumul).
- Les sous-plafonds ne s'appliquent que si le job porte `origine: "pilotage"` : le futur code du pilotage devra utiliser `creerJobPorteur`.
- Une valeur texte (`"1.5"`) dans la clé de sous-plafond est ignorée au profit du défaut ; poser un nombre JSON.
- Le cumul du pilotage filtre sur `inputPayload->>'origine'` sans index : acceptable au volume actuel.
- Non traité (hors périmètre, même famille) : `gardien.ts` utilise `jobId: gardien-<mot-clé>`, inexistant en base, donc refusé par la porte.
- Fenêtre app/worker : aucun contrat BullMQ modifié ; la charge des jobs n'a aucun champ obligatoire nouveau.

VERDICT OPUS : BON
