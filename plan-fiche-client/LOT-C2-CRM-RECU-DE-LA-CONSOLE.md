# LOT C2 — CRM PRO : carte « Reçu de la console » sur la fiche entreprise

Dépôt : `will383842/axion-crm-pro`, branche `feat/fiche-entreprise-recu-console` · Relecture : Opus 1 tour · Taille : ~0,5 j.
Dépend de : PR #379 FUSIONNÉE (stockage `companies.metadata.console` et `contacts.metadata.role_decision`). Peut partir avant le lot console C1 : la carte affiche « Rien reçu pour l'instant » tant que rien n'arrive.

## Objectif (maquette CRM-Pro, décision F11)
En haut de la colonne droite de `frontend/src/features/companies/CompanyDetailPage.tsx`, une carte « Reçu de la console » qui liste EXACTEMENT ce que la console envoie : statut (Client…), numéro AXI-CLI en petit, questionnaire (« 2 sur 5, avant le 5 nov. »), personnes actives avec leur rôle de décision, prochaine action (« à faire dans la console · avant le 30 oct. » : type + date, jamais de texte), tâches ouvertes (« 4 tâches ouvertes dans la console · la plus proche : 29 oct. »), étape et clôture prévue, nombres d'e-mails et de notes ; mention fixe « Aucun montant, aucun texte de note ne passe. » ; si `etape = archive` : « Ce client est archivé dans la console : il l'est aussi ici. » ; bloc texte « À faire dans la console : la relance se valide dans la console d'Axion IA. » (AUCUN lien vers la console : son adresse est secrète).
Les rôles de décision des contacts s'affichent en gris + icône dans `ContactsCard` SEULEMENT si tu peux le faire sans modifier `ContactsCard.tsx` (sinon, liste dans ta carte).

## Ce qui EXISTE
`CompaniesController::show` (`backend/app/Http/Controllers/Api/CompaniesController.php` ~l.733) charge la fiche ; vérifie que `metadata.console` arrive au front (le JSON `metadata` peut être exclu des listes, pas de la fiche) ; si ce n'est pas le cas, ajoute UNIQUEMENT `console` (sous-clé) à la réponse de `show`. `QualityScoreCard` (score de qualité des données) existe et reste.

## Fichiers
- À créer : `frontend/src/features/companies/components/RecuDeLaConsoleCard.tsx`, `frontend/tests/screens/RecuDeLaConsoleCard.test.tsx`, test backend si `show` change.
- À modifier : `CompanyDetailPage.tsx` : UNE ligne juste APRÈS `<aside className="space-y-6">` (ancre réservée à ce lot ; le lot A4 utilise l'ancre après `EvenementsCard`) ; éventuellement `CompaniesController.php` (méthode `show` seule).

## Interdits
Aucune écriture ; aucun montant ; jamais le nom d'une personne partie ; ne touche pas `backend/app/Crm/Ingest/*`.

## Vérifications et commun
`cd frontend && pnpm vitest run tests/screens/RecuDeLaConsoleCard.test.tsx && pnpm tsc --noEmit` ; backend `php artisan test --filter=CompaniesController` si modifié ; `vendor/bin/pint --test`. Rebase sur `origin/main` avant de pousser, une seule PR, pas de fusion ; commit en français avec `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` ; PR terminée par `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

## Texte de la PR
Titre : `feat(fiche-entreprise): carte « Reçu de la console » (lot C2)`.
