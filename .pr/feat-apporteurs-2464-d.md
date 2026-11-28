feat(apporteurs): PR D #2464 — RDV annulé : fin de la suspension sans fin, et « annulé par Axion = tenu »

## Ce qui change

Points 7 et 8 de l'issue #2464 (contrat 2.8, art. 3.2).

- **Un rendez-vous annulé ou manqué est constaté** par le passage quotidien (nouvelle étape `annulations-rendez-vous`, placée avant `reservations-sans-rendez-vous`). Une ligne est créée dans la nouvelle table `annulations_rendez_vous_presentation`, et Williams reçoit une alerte **interne** (`apporteur_annulation_a_qualifier`).
- **L'auteur n'est jamais déduit** (Calendly répond `canceler_type: host` quel que soit l'auteur). Un administrateur le qualifie dans la console : « Annulé par Axion IA » ou « Annulé ou manqué par l'entreprise » (motif obligatoire). La qualification ne se pose qu'une fois : un déclencheur en base refuse de la changer.
- **Tant que ce n'est pas qualifié, l'annulation retient la réservation** (art. 1.3). Alerte interne à 5 jours ouvrés, puis alerte critique à 10 jours ouvrés (une alerte par ligne et par seuil).
- **Annulé par l'entreprise, sans report convenu sous 15 jours** : le rendez-vous ne retient plus la réservation (borne incluse, 15e jour à 23:59:59.999 heure de Paris). L'échéance reprend alors son cours normal (`terminee`, alerte interne seule). Un report lié (à la main, ou détecté seul quand une rencontre remplace l'invité annulé) retient sans limite.
- **Annulé par Axion IA = réputé tenu** à la date où il était fixé : une fois la date passée, le passage appelle `validerParRendezVous` (canal `annule_par_axion`, `tenuAt = prevuAt`). Une seule fois. Si une autre déclaration occupe l'entreprise, le refus remonte en alerte interne et rien n'est écrit.
- **Aucun e-mail à l'apporteur.** `ecarterProposition` n'est jamais appelée par cette étape (elle communique un motif à l'apporteur).
- **Console** : page « Rendez-vous annulés à qualifier » (`/apporteurs/entreprises/annulations`) et actions réservées aux administrateurs (`qualifierAnnulationAction`, `lierReportAction`, journalisées).
- `passage-quotidien.ts` : `lirePropositionsOuvertes` et `traiterReservationsEchues` ignorent les clés qui ne retiennent plus ; `rendezVousCle` ajouté au `select` des échéances.

## Tests (nouveaux)

- `annulation-rendez-vous-regles.spec.ts` (chaque branche, borne du 15e jour, J+16)
- `reservation-plus-suspendue-sans-fin.spec.ts` (J+16 → terminee ; J+10 → suspendue ; non qualifiée J+40 → suspendue + alerte critique ; report lié → suspendue ; proposition jamais écartée)
- `annule-par-axion-vaut-tenu.spec.ts` (date passée, date future, deux passages, jamais sans auteur « axion », refus remonté en alerte)
- `annulation-jamais-auteur-automatique.spec.ts` (`canceler_type: host` ne pose jamais `auteur` ; report détecté)
- `annulations-aucun-email-apporteur.spec.ts` (seul `qualiopi-alerte-interne` part, jamais un gabarit `apporteur-*`)
- `migration-annulations-rendez-vous.spec.ts` (CHECK, déclencheur de qualification unique, rollback.sql)
- Base en mémoire partagée : `__tests__/aide/base-annulations.ts`.
- Ajustés : `passage-rendez-vous.spec.ts` et `bascule-ancienne-regle-vers-rendez-vous.spec.ts` (leur base simulée déclare la nouvelle table, vide) ; `releve-mensuel/__tests__/migration-additive.spec.ts` (liste blanche des migrations postérieures).

Vérifié : `pnpm typecheck` vert, eslint sans erreur, vitest vert sur `src/features/apporteurs-reseau`.

## Migration : oui

`20261128020000_apporteurs_annulations_rendez_vous` (postérieure à `20261128000000_chaine_editoriale_tables`, dernière sur `origin/main` à l'écriture). Additive : une table neuve, sans clé étrangère, sans énumération Postgres, sans DROP ; états en `VARCHAR` + `CHECK`. Lecteurs tolérants à la table absente (P2021). `rollback.sql` fourni (sauvegarde `COPY` d'abord, `RENAME` plutôt que `DROP`). Les noms d'index sont fixés par `map:` (les noms par défaut dépassaient 63 caractères).

## Audit argent : oui

Une validation automatique ouvre six mois d'attribution, donc des commissions. Relecture par une deuxième session demandée : rejouer `annule-par-axion-vaut-tenu.spec.ts` et lire chaque écriture. Point à vérifier : aucune validation ne part sans `auteur = 'axion'` posé par un humain (la requête filtre `auteur: "axion"`, `validationFaiteAt: null`, `prevuAt <= maintenant`).

## Dépendances

Aucune. À fusionner **avant F**. Pas de dépendance à une réponse de Will : pas de réglage éteint par défaut ajouté ; la validation reste sous l'interrupteur existant de la validation par rendez-vous (`validerParRendezVous` refuse quand il est éteint, et l'alerte de refus remonte).

## Points laissés ouverts

- Une erreur de qualification se corrige par un geste `super_admin` hors application (le déclencheur l'interdit) : le geste n'est pas encore décrit dans un runbook.
- Le report détecté seul ne couvre que « Calendly annulé → rencontre qui remplace l'invité » ; les autres cas se lient à la main.
- Le bouton « Lier le report » propose les autres propositions connues de la même présentation.
- Aucun changement de `pnpm-lock.yaml` ; la branche existait déjà localement sur le même commit que `origin/main`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
