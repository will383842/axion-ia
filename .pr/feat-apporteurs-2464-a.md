feat(apporteurs): PR A #2464 — la Journée IA suit la grille signée (point 17)

## Ce qui change

- Pour un apporteur dont le contrat signé est en grille v2 (2.3 à 2.6, sans avenant), la Journée IA n'est pas dans l'annexe 1 : c'est une prestation hors grille (A1.5 et A1.7). Elle ne donne **ni 500 € automatiques, ni 0 € silencieux** : la commission naît « à qualifier », palier `hors-grille`, et entre dans le circuit A1.7 déjà en place (60 jours après l'encaissement, alertes à J-10 et à J).
- Grille v3 : calcul inchangé (500 € par journée, au prorata).
- Nouveau module pur `journee-ia-grille.ts` (`commissionJourneeIaSelonGrille`, `MESSAGE_JOURNEE_IA_GRILLE_V2`).
- `passage-quotidien.ts` (`etapeCommissions`) l'utilise ; le palier `hors-grille` est posé sur la ligne « à qualifier » (code de règle `null`).
- `qualifierCommission(id, "journee-ia")` refuse pour un apporteur en grille v2 avec le message ci-dessus.
- Aucune ligne « Journée IA » n'est publiée dans la grille de référence (décision de Will). Aucun e-mail à un apporteur.

## Tests

- `__tests__/journee-ia-suit-la-grille-signee.spec.ts` : v3 à 1 490 € → 500 € ; v3 prix réduit → prorata ; v2 → `a_qualifier` + `hors-grille` ; refus de qualification en 2.6 ; montant en 2.8 ; égalité du repère avec `PALIER_HORS_GRILLE`.
- `__tests__/annexe-2-6-sans-journee-ia.spec.ts` + fixture figée `__tests__/fixtures/annexe1-contrat-2-6.txt` : pas de « Journée IA » ni « 1 490 », A1.5 renvoie à A1.7, 2.6 = v2.
- Dossier `src/features/apporteurs-reseau` entier : 151 fichiers, 2 207 tests verts ; `pnpm typecheck` et eslint verts.
- Le cas « grille inconnue → à qualifier » reste couvert par les tests existants (inchangé).

## Migration

Non (aucun schéma).

## Audit argent

Oui. À vérifier : aucune commission v3 ne change de montant ; la ligne v2 naît `a_qualifier` avec palier `hors-grille` ; `alerterHorsGrille` la prend.

## Dépendances

#2433 (déjà fusionnée sur `main`). Rien d'autre. Pas de réglage : aucune réponse de Will en attente n'est nécessaire.

## Points laissés ouverts

- **Script d'audit livré, hors de `scripts/`** : le dossier `scripts/` est en lecture seule dans cette session. Logique pure et testée : `src/features/apporteurs-reseau/audit-journee-ia-v2.ts` ; point d'entrée lecture seule : `src/features/apporteurs-reseau/audit-journee-ia-v2-cli.ts` (`pnpm tsx …`). Sortie : identifiant, statut, montant, n° d'autofacture, sans nom. Le plan le place dans `scripts/apporteurs/audit-journee-ia-grille-v2.ts` : `git mv` + ajustement des imports, dans une session qui peut y écrire.
- Console (non bloquant a de la relecture) : le bouton « Constater non commissionné » d'une Journée IA v2 hors activité formation est à traiter dans une PR suivante. Consigne en attendant : ne pas qualifier de Journée IA v2 tant que `x-axion-build-sha` ne montre pas cette PR.
- Module de repère : `journee-ia-grille.ts` recopie la valeur `"hors-grille"` au lieu d'importer `hors-grille.ts` (qui importe `commissions`, ce qui ferait un cycle et cassait des tests). Un test verrouille l'égalité.
- Les commissions Journée IA déjà versées en grille v2 avant ce correctif ne sont pas touchées (reprise éventuelle : décision de Will, art. 4.5).
- `pnpm lint` complet non lancé (trop long ici) : eslint lancé sur les fichiers touchés.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
