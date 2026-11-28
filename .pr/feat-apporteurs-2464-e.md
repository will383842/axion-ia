## PR E #2464 — Gabarit « file d'attente, premier rang » livré au worker (point 1, 1/3)

### Ce qui change

- Nouveau gabarit d'e-mail `apporteur-file-attente-premier-rang` (`src/lib/email/templates/apporteur-file-attente.tsx`), charge `{ prenom, entreprise, jusquAu }`. Texte du plan, **à faire relire par Will**. Aucun nom d'un autre apporteur, aucune mention de celui qui détient l'entreprise, aucun mot de subordination.
- Inscrit comme `apporteur-releve-mensuel` : registre des gabarits, union de `queue/types.ts`, `outbox-policy.ts`, catalogue d'aperçu (+ exemple fictif `entreprise`, `jusquAu`), `envois.ts` (type + les deux listes).
- **Pas** dans `GABARITS_ARGENT` (`retrait.ts`).
- **Aucun émetteur** : le gabarit part seulement quand la PR F l'émettra. Il doit donc être en ligne sur le worker (créneau de mise en ligne) avant F.

### Tests (écrits d'abord, rouges)

- `src/lib/email/templates/__tests__/apporteur-file-attente.spec.tsx` : rendu, objet, aucune formule de `formulesInterdites` (hors « Grenoble » du pied de page commun), aucun des mots objectif/classement/mission/manager, aucun nom d'occupant possible, exemple d'aperçu complet.
- `src/features/apporteurs-reseau/__tests__/file-attente-gabarit-inscriptions.spec.ts` : inscriptions partout, absent de `retrait.ts`.
- Adaptés : `chassis-regles` (via `cliquets/g7.ts`) et `remuneration-indicative.spec.ts` (classement « après signature »).
- Vérifié : `tsc --noEmit`, eslint des fichiers touchés, vitest de `src/lib/email`, `src/server/email`, `src/features/apporteurs-reseau`, `src/content` (verts avec `DATABASE_URL` non défini).

### Migration : non

### Audit argent : non (selon le tableau du plan)

### Dépendances

Aucune. Si #2453 est fusionnée avant, rebaser (`envois.ts`).

### Points ouverts

1. **`gabaritRepli` : aucun gabarit compatible.** Aucun gabarit d'apporteur déjà en ligne ne dit vrai pour « l'entreprise est de nouveau disponible » avec la charge `{ prenom, entreprise }` (lu : `apporteur-presentation-non-retenue` dit l'inverse). Je n'ai donc **pas** créé `GABARIT_REPLI_FILE_ATTENTE` : la PR F attendra que E soit en ligne, comme le plan le prévoit.
2. **Cliquets G7** : le gabarit est inscrit aux dettes `nonMigre` et `salutationHorsOuverture`, comme tous les gabarits du groupe (aucun n'est encore migré vers le châssis ; `data-destinataire` n'est produit nulle part). C'est une inscription, pas une correction : à retirer à la migration du groupe.
3. **Cahier de relecture des textes** : je n'ai trouvé aucun fichier de ce nom dans le dépôt. La vérification du vocabulaire est dans le test du gabarit ; à dire si un cahier existe ailleurs.
4. Réglage éteint par défaut : sans objet (rien n'est émis).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
