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

VERDICT OPUS : BON
