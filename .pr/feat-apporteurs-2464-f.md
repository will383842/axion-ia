## PR F #2464 — La file d'attente de l'article 3.5 (point 1, 2/3)

### Ce qui change

Quand on répond « Pas disponible » à une déclaration, elle n'est plus perdue : elle est **conservée en attente**.

- **Deux déclarations au plus** par entreprise, dans l'ordre d'horodatage. La troisième est refusée (art. 3.3 bis c) : l'e-mail « pas disponible » le dit.
- **Un e-mail au premier rang seulement**, quand l'entreprise est libre : tout de suite si l'attribution est échue ou la prise en charge terminée, **après les 30 jours de repos** si la réservation a pris fin sans validation (c'est `perimetreOccupe` qui en tient compte).
- **15 jours** pour lui. S'il redéclare l'entreprise, sa ligne passe à `redeclaree`. Sinon elle est **effacée** (`effacee`) : la présentation reste, rien n'est supprimé.
- Pendant ces 15 jours, « Bien reçu » sur la déclaration d'un tiers est **refusé** (message de console, jamais montré à l'apporteur). Il reste accepté pour le premier rang.
- **Extinction à 12 mois** après l'enregistrement, sans e-mail.
- « Déjà connue » (art. 3.3) n'entre jamais en file.

Fichiers :

- `occupation.ts` (nouveau) : la lecture d'occupation extraite de `refusBienRecu`, sans changer son résultat ; `perimetreOccupe(db, périmètre, maintenant, { saufApporteurId? })`.
- `file-attente-regles.ts` (nouveau, pur) : constantes, `cleFile`, `ordreDeFile`, `peutEntrerEnFile`, `finFenetre`, `eteinteLe`.
- `file-attente.ts` (nouveau, sans `server-only`) : `mettreEnAttente`, `passerFileAttente`, `consommerSiRedeclaration`, `fenetreOuverteParUnAutre`, `lireIdsEnAttente`.
- `presentations.ts` : « Pas disponible » = prise de la ligne **et** mise en attente dans une transaction sérialisable (même gestion `P2034` que « Bien reçu ») ; nouveau refus de fenêtre dans `refusBienRecu` ; champ **facultatif** `attente: "conservee" | "file_complete"` dans la charge de l'e-mail « pas disponible » (un worker plus ancien l'ignore).
- `apporteur-demarrage.tsx` : le gabarit « présentation refusée » écrit une phrase de plus si `attente` est présent (motif « pas-disponible » seulement, jamais dans un texte réécrit à la main).
- `declaration-regles.ts` / `declaration-entreprise.ts` : état `en_attente` côté apporteur (« En attente (l'entreprise n'est pas disponible pour le moment) », sans rang ni occupant) ; `declarerEntreprise` consomme la ligne du premier rang après `creerPresentation`.
- `passage-quotidien.ts` : étape `"file-attente"` juste après `"reservations-echues"` (type `NomEtape` + une entrée du tableau, plus trois compteurs facultatifs au bilan).
- Console : page de lecture seule `apporteurs/entreprises/file-attente` (rangs 1 et 2, tri par horodatage seulement).
- Aucun e-mail sur la bascule des présentations. `contrat-v2.ts` et `CONTRAT_VERSION` ne sont pas touchés.

### Migration : oui — `20261128170000_apporteurs_file_attente`

Additive, avec `rollback.sql` (sauvegarde `COPY` d'abord, `RENAME … _retire_20261128`). Table neuve `declarations_en_attente`, sans clé étrangère, états en `VARCHAR` + 3 `CHECK`, index unique partiel `(cle_file) WHERE statut = 'informee'`, déclencheur `BEFORE UPDATE` (transitions permises, colonnes d'identité figées) et `BEFORE DELETE` (aucune suppression). Tout lecteur tolère la table absente (`P2021`). L'écriture « Pas disponible » ne la tolère pas (une transaction Postgres ne survit pas à une table absente) ; l'entrypoint migre avant de servir.

`ls prisma/migrations | cut -c1-14 | sort | uniq -d` : **non vide, mais pas à cause de cette PR** — 11 horodatages en double d'avant (de `20260516200000` à `20261126130000`), aucun n'est `20261128170000`.

### Tests (écrits d'abord)

`src/features/apporteurs-reseau/__tests__/` : `file-attente-regles`, `file-attente-deux-au-plus`, `file-attente-simultane` (P2034, « déjà connue » n'entre pas en file), `file-attente-passage` (repos de 30 jours, fin d'attribution immédiate, seul le premier rang informé, charge de l'e-mail = `prenom`, `entreprise`, `jusquAu`, `informee` posé seulement si l'e-mail est parti, J+16 → `effacee` et second rang sans e-mail, extinction 12 mois), `file-attente-redeclaration` (+ lecture de fenêtre), `file-attente-fenetre-bloque-les-autres`, `occupation-extraction-sans-changement`, `migration-file-attente`. Tous sur une base en mémoire (`file-attente-faux.ts`).

Tests existants adaptés : les mocks de Prisma de six fichiers ne connaissent pas le nouveau modèle, donc ils mockent `../file-attente` ; quatre gardes de migration qui comptent les migrations suivantes (annulations, annexes, contrôle du registre, relevé mensuel, contacts guide) listent la nouvelle.

### Audit argent : oui (attribution)

À rejouer par une deuxième session : `file-attente-fenetre-bloque-les-autres`, `file-attente-passage`, `reponse-deja-attribuee`, `occupation-extraction-sans-changement`, et lire chaque écriture de `file-attente.ts`. Points à vérifier : (1) deux « Bien reçu » simultanés restent exclus par la transaction sérialisable de `refusBienRecu` ; la file n'attribue rien, elle n'envoie qu'un e-mail et ouvre un délai ; (2) la fenêtre de 15 jours est lue **hors transaction** (via le client global, pour tolérer la table absente) : elle porte une priorité, pas l'exclusivité ; (3) l'e-mail part **avant** que `informee` soit posé (le plan l'exige) : en cas d'échec de l'écriture, le passage suivant renvoie avec le même `jobId` (idempotent).

### Points à confirmer (Will)

1. **Q-F1** : le premier rang qui laisse passer ses 15 jours est effacé ; le second **reste en attente** sans fenêtre ni e-mail. Pour qu'il ne soit pas informé dès le passage suivant (l'entreprise est libre), il n'est informé que si une présentation du même SIREN est née depuis l'effacement (« prochaine fin d'occupation »). La lecture est approximative : elle compte toute présentation du SIREN, pas seulement celle du périmètre. Le changement tient à `RANG_2_PROMU_AVEC_FENETRE`.
2. **Q-F2** : « par entreprise » = périmètre déclaré (SIRET ; une déclaration à tout le SIREN compte pour tous ses établissements).
3. **Q-F3** : la suspension de l'art. 3.7 n'existe pas dans le code ; `fenetre_suspendue_jours` est prévue, nulle, non branchée.
4. **`gabaritRepli` absent** : E a constaté qu'aucun gabarit ancien n'est vrai pour « l'entreprise est de nouveau disponible » ; le gabarit est donc émis sans repli (comme `refus-annonce.ts`). E est en ligne sur le worker, comme le plan l'exige.
5. **Priorité résiduelle** : si un tiers a déclaré pendant la fenêtre une entreprise plus tôt que la nouvelle déclaration du premier rang, « Bien reçu » du premier rang est bloqué par « déclaration plus ancienne » ; le message de la console invite à répondre « Pas disponible » au tiers. Aucun double occupant n'est possible, mais la priorité du premier rang n'est pas garantie dans ce cas.
6. **Textes à relire** : la phrase ajoutée à l'e-mail « pas disponible » (`conservee` / `file_complete`).

### Dépendances

E en ligne sur le worker (créneau précédent) ; D fusionnée. `passage-quotidien.ts` : conflit d'une ligne possible avec une autre PR qui ajoute une étape. `pnpm-lock.yaml` : inchangé (aucune dépendance, aucun `pnpm install`).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
