# Équipe éditoriale — PR 17 : console de pilotage

## But

Une page console « Équipe éditoriale » (`/[adminPrefix]/content-gen/equipe-editoriale`) pour piloter l'équipe sans passer par Claude. Accès administration (`requireAdmin`, écritures limitées en débit).

- **Marche / arrêt** : réglage `equipe_marche` dans `ContentGenConfig` (absent ou illisible = arrêt). L'équipe tourne seulement si `CONTENT_EQUIPE_EDITORIALE` vaut « true » ET le réglage est sur marche. La page affiche l'état réel et la raison de l'arrêt.
- **Quotas** : `equipe_articles_max_jour` (0 à 10) et `equipe_maj_max_jour` (0 à 5), validés côté serveur. Plafonds en dollars : lien vers le réglage existant (fournisseurs).
- **Articles à relire** (issue `a_relire`) : titre, causes, coût, journal des rôles. « Publier » appelle `approveReview` (chemin existant) ; « Renvoyer en correction » appelle `requestEdits`, 1 fois au plus depuis la console. Chaque action écrit dans `ActivityLog` (qui, quand).
- Aucune migration.

## Fichiers

- `src/server/content-gen/equipe/pilotage.ts` (+ spec) : lecture tolérante, porte `equipeEnMarche`, bornes.
- `src/server/actions/content-gen/equipe-editoriale.ts` : actions serveur.
- `src/app/[locale]/(admin)/[adminPrefix]/content-gen/equipe-editoriale/` : page et composant client.
- `content-gen-worker.ts` (orchestration) et `content-refresh-worker.ts` (tâches d'équipe, mise à jour) : ajout de la porte console.
- Specs existantes adaptées (mock de la porte, regex de garde du source).

## Tests

Non-admin refusé ; bornes des quotas ; arrêt console = aucun rôle de l'équipe lancé (worker) ; variable éteinte = aucune génération même console sur marche (et pas de lecture base) ; Publier réutilise `approveReview` ; action tracée ; renvoi limité à 1 ; filtre de liste. Vitest ciblé, `pnpm typecheck` et eslint verts.

## Risques / limites connues

- **Mise en ligne** : réglage absent = arrêt. Si la variable est déjà « true » en production, l'équipe s'arrête au déploiement jusqu'à un clic « Mettre en marche » (ou à la pose de `equipe_marche`). Fenêtre app/worker : le worker peut tourner avant la console.
- **Portée de l'arrêt console** : coupe l'orchestration de l'équipe et les tâches d'équipe/mise à jour du worker de rafraîchissement. Le fact-check Claude en deux phases, le barème SEO, le plan et le maillage ne lisent que la variable (couper la phase A seule bloquerait les articles en phase B) : non modifiés.
- **Quota « nouveaux articles »** : stocké et borné, mais aucun point de création ne le lit encore (seul le quota de mises à jour est appliqué). Libellé honnête dans la console ; branchement à faire dans une PR dédiée.
- **Renvoi** : « au plus 1 » repose sur le journal d'activité (best-effort) ; course résiduelle entre deux administrateurs simultanés. Après un renvoi la ligne passe en `needs_edits` (visible, boutons grisés) ; elle ne revient pas seule en `pending` (comportement existant de `requestEdits`).
- Le rôle `editor` passe `requireAdmin` (comme les autres actions content-gen) : il peut donc arrêter l'équipe.
- Les dépendances n'étaient pas installées dans l'environnement : `pnpm install --frozen-lockfile` et `prisma generate` lancés (aucun changement de dépôt).

VERDICT OPUS : BON (second tour : seule correction bloquante demandée — porte sur la phase A — appliquée par annulation de cette porte ; point non bloquant « Publier » grisé corrigé)
