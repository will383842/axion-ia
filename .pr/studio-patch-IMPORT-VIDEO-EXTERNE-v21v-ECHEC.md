# ECHEC — IMPORT-VIDEO-EXTERNE-v21v (a3236655) : aucun correctif possible dans le périmètre de la fiche

1. Seul rouge du dernier commit (PR #1776) : job « tests ciblés cas concret », étape « Tests z0 (contrat Zernio) et r1 (envoi) » → `tests/zernio/rap3-retrait.test.ts:60` (« la rapatriée retirée sort du calendrier mais reste en base ») : attendu 0 publication, reçu 1 (`pub-8`). Les 8 autres contrôles sont verts.
2. Cause : `pub-8` est une publication de la démo (`src/donnees/memoire/demo.ts:781`, `dans(4)` = aujourd'hui + 4 jours) ; depuis le 27/11/2026 elle tombe dans la fenêtre 01–31/12/2026 interrogée par le test. Échec dépendant de la date, sans lien avec la branche.
3. Vérifié en local : le même test échoue à l'identique sur `origin/master` (65c62a6d), 1 échec / 3 réussis, et sur la branche. La branche n'a ni conflit ni autre rouge : aucun changement de code, aucun patch produit (`format-patch` serait vide).
4. Réparer exige de modifier `demo.ts` ou `rap3-retrait.test.ts`, deux fichiers hors de ceux de la fiche (interdit par la consigne). À traiter dans une fiche séparée (fenêtre du test relative à la date, ou graine `pub-8`).
