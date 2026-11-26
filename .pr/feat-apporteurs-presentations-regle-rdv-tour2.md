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

## Tour 3 (seconde relecture Opus, `VERDICT-PR-2344-tour2`)

1. **Constat 1 (option a)** — `basculeVersRendezVous` exige que le texte signé archivé (`signatureApporteur.texte`) contienne la clause transitoire (`MARQUEUR_CLAUSE_BASCULE` : « Par exception, les présentations encore en attente d'attribution ») ; sans texte archivé ou sans la clause : pas de bascule, motif `"version"`. Tests : « 2.8 signée sans la clause → pas de bascule » (+ sans texte, + 2.9 sans clause). `contrat-v2.ts` non modifié.
2. **Constat 2** — terme minimal = `finDuNiemeJourParis(maintenant, DELAI_MINIMAL_BASCULE_JOURS + 1)` (fin du jour annoncé, minuit Paris). Tests mis à jour (`2026-12-26T22:59:59.999Z`) + test du rendez-vous pris le dernier jour à 20 h → retenu.
3. **Constats 3 et 4** — texte de l'e-mail selon le verdict (signalement facultatif, validation par rendez-vous OU commande signée, « Votre présentation de l'entreprise X »).
4. **Constat 5** — alerte interne par présentation si l'e-mail n'est pas parti (`apporteur-bascule-email-non-parti-<id>`) ; reprise au passage suivant (`reprendreAnnoncesBascule`, lignes `apporteur.presentation_basculee_rendez_vous` des 35 derniers jours, encore non validées ; clé idempotente `apporteur-bascule-regle-<id>`). Test : échec puis reprise, sans doublon.
5. **Constat 6** — test qui fige la clause 13.5 et lie « trente jours » à `DELAI_MINIMAL_BASCULE_JOURS` (`contrat-2-8-reservation-validation-argent.spec.ts`) ; commentaire périmé corrigé ; test `dejaEnvoye` sur deux passages.

Vérifications : `pnpm typecheck` vert ; eslint/prettier sur les fichiers touchés sans erreur ; vitest `src/features/apporteurs-reseau src/lib/email tests/unit/ci src/content` : 450 fichiers, 8465 tests verts. `origin/main` fusionné sans conflit ; `pnpm-lock.yaml` inchangé.

### Texte final complet de l'e-mail `apporteur-presentation-regle-rendez-vous` (pour relecture par Will)

Charge d'exemple : `contactName: "Paul Martin"`, `entreprise: "Acme"`, `dateLimite: "8 janvier 2027"`. Objet : « Nouvelle règle : Acme ». Préheader : « Elle est désormais validée au premier rendez-vous tenu. » Titre : « La règle de validation change pour cette entreprise ».

```
Bonjour Paul,

Votre présentation de l'entreprise Acme était en attente. Depuis l'acceptation de la version 2.8 de votre contrat, elle suit la règle du premier rendez-vous tenu (article 3.2) : elle est validée à votre nom dès qu'un premier rendez-vous avec Axion-IA a eu lieu, ou dès qu'une commande est signée.

Pour cela, ce rendez-vous doit être pris au plus tard le 8 janvier 2027. Passé cette date sans rendez-vous pris ni commande signée, la réservation prend fin.

Si un rendez-vous a déjà été pris avec cette entreprise depuis votre présentation, vous pouvez nous le signaler en répondant à ce message ; vous n'y êtes pas tenu.
```

Variante sans date : « Pour cela, ce rendez-vous doit être pris dans les trente jours. Passé ce délai sans rendez-vous pris ni commande signée, la réservation prend fin. » Objet si l'entreprise est vide : « Nouvelle règle : votre présentation ».
