# PR #2344 — tour 2 : corrections de la relecture (VERDICT-PR-2344)

## Constat par constat

1. **Constat 1 (décision de Will du 26/11)** — clause transitoire ajoutée à l'article 13.5 du contrat 2.8 (`contrat-v2.ts`, `CONTRAT_V2_MARKDOWN`) : « Par exception, les présentations encore en attente d'attribution le jour où l'Apporteur accepte la présente version passent à la règle du premier rendez-vous tenu (article 3.2) ; l'Apporteur dispose d'au moins trente jours à compter de ce jour pour obtenir ce rendez-vous, et il en est informé par courrier électronique. » (référence adaptée à la numérotation réelle : 3.2 ; « Apporteur » en majuscule comme dans le reste du contrat). `CONTRAT_VERSION` **inchangée**.
   - **À vérifier par le pilote : aucun apporteur n'a encore signé la 2.8 en production, sinon il faut une 2.9.**
2. **Constat 2** — `termeApresBascule(recueAt, maintenant)` (`regle-attribution.ts`) = max(fin du 60e jour, bascule + 30 jours) ; utilisé par `basculeVersRendezVous`. Un terme court n'est plus possible.
3. **Constat 3 — retiré (décision du propriétaire, 27/11)** : aucun e-mail aux apporteurs à la bascule. Gabarit `apporteur-presentation-regle-rendez-vous`, `annoncerBascule` et tous leurs enregistrements supprimés ; la bascule (étape `bascule-regle-rendez-vous`, journal `apporteur.presentation_basculee_rendez_vous`, délai minimal de 30 jours) reste.
4. **Constat 4** — `jobId` de l'alerte de lot = `apporteur-bascule-lot-<jour Paris>-<hachage sha256 des ids basculés>` ; le jour est calculé à l'heure de Paris.
5. **Constat 5** — une erreur autre que P2002/P2021 est comptée dans `bilan.erreurs`, signalée, et la boucle continue.
6. **Constat 6** — tests ajoutés (`bascule-ancienne-regle-vers-rendez-vous.spec.ts`) : terme court (30 jours garantis, non clos par l'échéance), e-mail à l'apporteur (une fois, contenu, sans repli), apporteur passant en 2.8 après un premier passage, alerte de lot sur deux passages le même jour, jour de Paris, erreur non-P2002 au milieu d'une page, course avec une confirmation manuelle. Le test « déclaration antérieure ne bascule pas » n'est pas écrit : la décision de Will est l'inverse (clause transitoire).

Aucune migration. Interdits respectés (`legal.ts`, `cgv-*`, `journee-ia-commun.ts`, `CONTRAT_VERSION`).

## Résultats

- `pnpm typecheck` : vert (avec `NODE_OPTIONS=--max-old-space-size=8192`, le tas par défaut saturait).
- `pnpm eslint` sur les fichiers touchés : 0 erreur (1 avertissement préexistant, `analyse-2026-10-09-lot-site.spec.ts`).
- `pnpm vitest run src/features/apporteurs-reseau src/lib/email/templates src/server/email src/content/__tests__/remuneration-indicative.spec.ts tests/unit/ci` : 355 fichiers passés, 7541 tests verts.
- `origin/main` fusionné sans conflit ; `pnpm-lock.yaml` inchangé.

## Tour 3 (seconde relecture Opus, `VERDICT-PR-2344-tour2`)

1. **Constat 1 (option a)** — `basculeVersRendezVous` exige que le texte signé archivé (`signatureApporteur.texte`) contienne la clause transitoire (`MARQUEUR_CLAUSE_BASCULE` : « Par exception, les présentations encore en attente d'attribution ») ; sans texte archivé ou sans la clause : pas de bascule, motif `"version"`. Tests : « 2.8 signée sans la clause → pas de bascule » (+ sans texte, + 2.9 sans clause). `contrat-v2.ts` non modifié.
2. **Constat 2** — terme minimal = `finDuNiemeJourParis(maintenant, DELAI_MINIMAL_BASCULE_JOURS + 1)` (fin du jour annoncé, minuit Paris). Tests mis à jour (`2026-12-26T22:59:59.999Z`) + test du rendez-vous pris le dernier jour à 20 h → retenu.
3. **Constats 3 et 4** — sans objet : l'e-mail est supprimé (décision du 27/11).
4. **Constat 5 — retiré (27/11)** : alerte `apporteur-bascule-email-non-parti` et `reprendreAnnoncesBascule` supprimées avec l'e-mail.
5. **Constat 6** — test qui fige la clause 13.5 et lie « trente jours » à `DELAI_MINIMAL_BASCULE_JOURS` (`contrat-2-8-reservation-validation-argent.spec.ts`) ; commentaire périmé corrigé ; test (test de l'e-mail remplacé : aucun e-mail à la bascule, voir ci-dessous).

Vérifications : `pnpm typecheck` vert ; eslint/prettier sur les fichiers touchés sans erreur ; vitest `src/features/apporteurs-reseau src/lib/email tests/unit/ci src/content` : 450 fichiers, 8465 tests verts. `origin/main` fusionné sans conflit ; `pnpm-lock.yaml` inchangé.

## Décision du propriétaire du 27/11

Aucun e-mail n'est envoyé aux apporteurs au passage à la règle du rendez-vous. Article 13.5 : « et il en est informé par courrier électronique » supprimé (la phrase finit après « pour obtenir ce rendez-vous. »). Le test « bascule sans e-mail » vérifie que `envoyer` n'est jamais appelé, qu'aucune file d'e-mail ne part vers l'apporteur et que la réservation a un terme d'au moins 30 jours. L'alerte de lot reste une alerte INTERNE. Plus aucun gabarit nouveau : pas de risque app↔worker sur ce point.
