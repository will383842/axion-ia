# PR #2344 — tour 2 : corrections de la relecture (VERDICT-PR-2344)

## Constat par constat

1. **Constat 1 (décision de Will du 26/11)** — clause transitoire ajoutée à l'article 13.5 du contrat 2.8 (`contrat-v2.ts`, `CONTRAT_V2_MARKDOWN`) : « Par exception, les présentations encore en attente d'attribution le jour où l'Apporteur accepte la présente version passent à la règle du premier rendez-vous tenu (article 3.2) ; l'Apporteur dispose d'au moins trente jours à compter de ce jour pour obtenir ce rendez-vous, et il en est informé par courrier électronique. » (référence adaptée à la numérotation réelle : 3.2 ; « Apporteur » en majuscule comme dans le reste du contrat). `CONTRAT_VERSION` **inchangée**.
   - **À vérifier par le pilote : aucun apporteur n'a encore signé la 2.8 en production, sinon il faut une 2.9.**
2. **Constat 2** — `termeApresBascule(recueAt, maintenant)` (`regle-attribution.ts`) = max(fin du 60e jour, bascule + 30 jours) ; utilisé par `basculeVersRendezVous`. Un terme court n'est plus possible.
3. **Constat 3** — à la bascule, e-mail transactionnel à l'apporteur : nouveau gabarit `apporteur-presentation-regle-rendez-vous` (nouvelle règle, entreprise, date limite ; vouvoiement, sans prix), émis par `annoncerBascule` (`attribution-annonce.ts`), clé `apporteur-bascule-regle-<id>` (une fois par présentation). Sans `gabaritRepli` (aucun gabarit ancien n'est vrai), comme `apporteur-presentation-non-retenue` : **le worker doit être en ligne sur ce commit avant que l'interrupteur soit allumé** (règle app↔worker d'AGENTS.md). Gabarit enregistré partout (queue types, index des gabarits, catalogue, outbox-policy, envois, cliquets g7, compteur 94, liste anti-barème).
   - **Texte à relire par Will.**
4. **Constat 4** — `jobId` de l'alerte de lot = `apporteur-bascule-lot-<jour Paris>-<hachage sha256 des ids basculés>` ; le jour est calculé à l'heure de Paris.
5. **Constat 5** — une erreur autre que P2002/P2021 est comptée dans `bilan.erreurs`, signalée, et la boucle continue.
6. **Constat 6** — tests ajoutés (`bascule-ancienne-regle-vers-rendez-vous.spec.ts`) : terme court (30 jours garantis, non clos par l'échéance), e-mail à l'apporteur (une fois, contenu, sans repli), apporteur passant en 2.8 après un premier passage, alerte de lot sur deux passages le même jour, jour de Paris, erreur non-P2002 au milieu d'une page, course avec une confirmation manuelle. Le test « déclaration antérieure ne bascule pas » n'est pas écrit : la décision de Will est l'inverse (clause transitoire).

Aucune migration. Interdits respectés (`legal.ts`, `cgv-*`, `journee-ia-commun.ts`, `CONTRAT_VERSION`).

## Résultats

- `pnpm typecheck` : vert (avec `NODE_OPTIONS=--max-old-space-size=8192`, le tas par défaut saturait).
- `pnpm eslint` sur les fichiers touchés : 0 erreur (1 avertissement préexistant, `analyse-2026-10-09-lot-site.spec.ts`).
- `pnpm vitest run src/features/apporteurs-reseau src/lib/email/templates src/server/email src/content/__tests__/remuneration-indicative.spec.ts tests/unit/ci` : 355 fichiers passés, 7541 tests verts.
- `origin/main` fusionné sans conflit ; `pnpm-lock.yaml` inchangé.
