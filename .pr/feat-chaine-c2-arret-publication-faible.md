Chaîne éditoriale C2 et C2c : arrêter la publication faible (relecture humaine d'abord)

## Ce qui change pour le site

Décision de Will : qualité avant volume. Un contenu généré par l'IA n'est plus mis en ligne sans qu'une personne l'ait relu.

- **Articles de blog et actualités RSS** : l'auto-publication est éteinte. Tout contenu généré attend dans la file de relecture (`/review-queue`). Cela vaut aussi quand l'ancienne configuration enregistrée en base disait « publier automatiquement » : il faut maintenant une autorisation explicite en plus (`publicationSansRelectureAutorisee`, absente = relecture obligatoire).
- **Filet à la publication** : si un contenu non relu arrive quand même au worker de publication, il retourne en file de relecture (la fiche repasse « en attente », rien n'est perdu).
- **Plus de `tier_1_indexable` forcé** pour un contenu non relu : seul un contenu validé par une personne naît indexable. Les validations faites dans la console restent indexables. Pas de ping IndexNow/Google pour une page non indexable.
- **Plafond de génération** abaissé à 3 par jour (`ARTICLES_MAX_JOUR_DEFAUT`), actualités RSS comprises (0 = pause RSS conservé), pour ne pas saturer la file de relecture. Un plafond stocké plus bas reste plus bas.
- **C2c, pages villes** (`scripts/regen-villes-complete.ts`) : les copies générées restent « generated » (non rendues) au lieu d'être approuvées automatiquement sur la note. La reprise ne refait pas (et ne repaie pas) une copie déjà bonne en attente.
- **Bug évité** : « Demander des modifications » ne bloque plus une fiche en `needs_edits` : elle repasse en attente.

Rien n'est supprimé ni désindexé : les contenus déjà publiés ne bougent pas. Aucune migration, charge BullMQ inchangée, fichiers interdits non touchés.

## Comment revenir en arrière

- Console, « Règles de publication » : cocher « Autoriser la publication SANS relecture ». Les deux cases historiques (blog, actualités) redeviennent alors effectives telles qu'enregistrées, et le plafond d'avant revient. Un contenu non relu naît alors `noindex,follow` (pas `tier_1`).
- Pages villes : variable d'environnement `VILLES_AUTO_APPROBATION_ACTIVE=true`.
- Ou `git revert` de cette PR.

## À savoir

- Fenêtre app/worker : aucune forme de charge ni valeur d'énumération ne change ; les deux versions coexistent sans risque.
- La charte éditoriale publique dit encore « publié sans validation humaine préalable » : plus pessimiste que la réalité, texte public laissé à la décision de Will (commentaire ajouté dans la page).
- Les copies de villes `generated` n'ont pas d'écran de validation dans la console (mise à jour manuelle du statut).
- La validation groupée de la console (jusqu'à 100 contenus ≥ 75) compte comme une relecture humaine.
- Décision restante de la fiche C2 : le gel de la rotation des 747 mots-clés (non traité ici).
- Tests : `relecture-obligatoire.spec.ts` (écrit avant le module, rouge à l'import, puis vert), `judge-outcome.spec.ts` et l'orchestrateur adaptés. tsc propre, 102 fichiers / 1194 tests verts sur les dossiers touchés.

## Dernière passe (3e relecture)

- Fusion de `origin/main` (sans conflit). `tsc` propre ; vitest sur `content-gen`, `queue` et `actions/content-gen` : tout vert sauf 4 tests de `url-extractor.spec.ts` (fichier non touché, échec réseau du bac à sable).
- **`needs_edits`** : le worker de génération remet aussi la fiche en `pending` (`reviewedBy` vidé) quand le contenu régénéré sort en `needs_review`, comme le fait déjà la boucle qualité. Avant, la fiche restait bloquée.
- **Actualités RSS plafonnées à 2/jour** sous relecture obligatoire (`plafondActualitesEffectif`) : elles comptent dans le budget global de 3, il reste donc une place pour les articles de campagne. 0 = pause conservé ; retour arrière = plafond d'avant.
- **Pages villes, retour arrière** : une copie déjà `generated` et bonne est approuvée à la reprise sans être régénérée (ni repayée).
- Tests ajoutés : plafond RSS, remise `needs_edits` → `pending` (boucle qualité et worker de génération). Le mock du test d'intégration de l'équipe éditoriale gagne `updateMany`.
- Une régénération en place lancée depuis la console passe désormais par la relecture (comportement voulu, non mentionné avant).
- Limite connue : le branchement du plafond RSS dans le worker n'est couvert que par le test de la fonction pure.

Relectures Opus : 1re « à corriger » (8 points, corrigés) ; 2e « à corriger » (3 points, corrigés) ; 3e « à corriger » (points ci-dessus, corrigés) ; 4e relecture, sur le code final (commit 270fd8df8) : rien à corriger.

VERDICT OPUS : BON
