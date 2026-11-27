## Résumé

Audit en lecture seule : les écrans de la console admin (génération de contenus, campagnes,
équipe éditoriale, modèles d'articles, réglages, plafonds de coût, encart vidéo) disent-ils la
vérité au back-end ?

**Réponse : non, il y a des écarts graves.** 40 écarts confirmés dans le code : 14 graves,
14 moyens, 12 mineurs. Exemples : « Bloquer la publication » ne bloque pas, l'édition de
`llms.txt` n'est jamais publiée, la date de début d'une campagne est ignorée, le plafond réel
de 15 à 20 contenus par jour n'apparaît nulle part, et l'encart vidéo n'a aucun écran (avec un
bug : jamais d'encart sur les articles « Implémentations IA »).

## Ce qui est ajouté

- `docs/pilotage-seo-geo/AUDIT-ADEQUATION-ECRANS-BACKEND.md` :
  1. la réponse courte à Will ;
  2. le tableau des écarts, avec une preuve `chemin:ligne` pour chacun ;
  3. l'encart vidéo : ce qui bloque un réglage propre et ce qu'il faut pour le rendre réglable ;
  4. les réglages conformes ;
  5. un découpage en 20 petites PR de correction (P0, P1, P2), avec le rappel de la règle
     app ↔ worker ;
  6. les limites de l'audit.

Le document fusionne deux audits croisés (écran → back-end, back-end → écran) et les
contre-vérifie dans le code. Deux affirmations « conforme » de l'un d'eux étaient fausses
(`llms_txt`, règles d'alerte éditoriales) : elles sont corrigées.

## Comment relire

- Lire d'abord le §1 (verdict) et le §5 (ordre des corrections).
- Pour vérifier un écart : ouvrir le fichier et la ligne de la colonne « Preuve » (base
  `686f6b62`).
- Points à trancher par Will : llms.txt (retirer l'écran ou brancher la route), profils
  d'audience (brancher ou retirer), lien médiathèque ↔ vidéos du site.

## Aucun code touché

Documentation seulement. Aucun fichier source, aucun schéma, aucune migration, aucun test
modifié. Aucune valeur de secret ni variable d'environnement de production n'a été lue.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01E7vxGfc29swGLyDPhTm5tL

VERDICT OPUS : BON
