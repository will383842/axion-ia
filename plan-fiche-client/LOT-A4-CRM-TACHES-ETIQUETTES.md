# LOT A4 — CRM PRO : tâches propres au CRM et étiquettes sur la fiche entreprise

Dépôt : `will383842/axion-crm-pro` (Laravel + React), branche `feat/fiche-entreprise-taches-etiquettes` · Relecture : Opus 1 tour · Taille : ~1 j. · Part MAINTENANT.

## Objectif (maquette CRM-Pro)
Sur `frontend/src/features/companies/CompanyDetailPage.tsx` : (1) une carte « Tâches du CRM » : liste des tâches CRM de l'entreprise (intitulé, avant le…, faite ou non), bouton plein UNIQUE de l'écran « Ajouter une tâche CRM » (le bouton actuel « Enrichir maintenant » passe en `variant="secondary"`), « Marquer comme faite » ; (2) une carte « Étiquettes (propres au CRM, non synchronisées) » : étiquettes de l'entreprise, ajout et retrait.
Ces tâches et étiquettes restent DANS le CRM : rien ne part vers la console.

## Ce qui EXISTE (vérifie et RÉUTILISE, ne recrée pas)
- Tâches par personne : `PersonnesController::storeTache` et `terminerTache` (`backend/routes/api.php` ~l.539-544 : `/personnes/{personneId}/taches`), stockées comme `activities` (voir `backend/app/Crm/ActivitesEtMotifs.php`, migration `2026_08_19_000002_crm_activites_et_motifs.php`, `2026_08_14_000004_crm_socle_tags_optout_timeline.php`). Lis-les d'abord : si une activité « tâche » peut porter une entreprise (`company_id`), crée les routes entreprise sur le MÊME modèle et le même service ; sinon ARRÊTE et écris-le dans la PR (pas de migration dans ce lot).
- Étiquettes : `TagsController` (`/tags`), `CompanyTagsBulkController` (`/companies/tags/bulk`), modèle `Tag`, table pivot entreprise-étiquette. Réutilise l'ajout/retrait existant (bulk à un seul élément) plutôt qu'une nouvelle route, si ses droits conviennent.
- Fiche : `CompanyDetailPage.tsx` (colonne droite `aside` : `RelationCard`, `ContactsCard`, `EvenementsCard`, `ListesDeLaFiche`, `QualityScoreCard`, carte « Workflow »).

## Fichiers
- À créer : `frontend/src/features/companies/components/TachesCrmCard.tsx`, `frontend/src/features/companies/components/EtiquettesCard.tsx` ; backend : contrôleur ou méthodes NEUVES dans un fichier NEUF `backend/app/Http/Controllers/Api/CompanyTachesController.php` ; tests `backend/tests/Feature/CompanyTachesTest.php`, `frontend/tests/screens/TachesCrmCard.test.tsx`.
- À modifier : `backend/routes/api.php` (2 ou 3 routes, groupées, juste APRÈS la ligne `Route::get('/companies/{company}/evenements', …)`) ; `CompanyDetailPage.tsx` : DEUX lignes JSX, juste APRÈS `<EvenementsCard companyId={c.id} />` (ancre réservée à ce lot ; le lot C2 utilise une autre ancre en haut de l'`aside`), et `variant="secondary"` sur « Enrichir maintenant ».

## Interdits
Aucune suppression (une tâche se marque faite, jamais supprimée ; retirer une étiquette d'une entreprise retire le lien, pas l'étiquette) ; ne touche ni `backend/app/Crm/Ingest/*` (contrat de synchro, PR #379), ni `CRM_PURGE_ENABLED`, ni aux campagnes ; aucun e-mail ; mode sombre : suivre l'existant du CRM.

## Vérifications
`cd backend && php artisan test --filter=CompanyTaches` ; `cd frontend && pnpm vitest run tests/screens/TachesCrmCard.test.tsx` ; `vendor/bin/pint --test` sur tes fichiers PHP ; typecheck front (`pnpm tsc --noEmit` dans `frontend`).

## Commun
Rebase sur `origin/main` avant de pousser ; une seule PR ; ne fusionne pas ; commit en français avec `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` ; description terminée par `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Tout en français.

## Texte de la PR
Titre : `feat(fiche-entreprise): tâches propres au CRM et étiquettes visibles (lot A4)`.
