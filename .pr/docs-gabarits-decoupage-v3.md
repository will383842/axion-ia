docs(gabarits-articles): découpage des PR aligné sur les maquettes v3 validées

## Ce que fait cette PR

Le fichier `DECOUPAGE.md` décrivait encore l'ancien design. Il décrit maintenant les maquettes v3 validées par Will (dossier `maquettes-v2/`, fusionné dans #2423).

- En-tête : celui du site, déjà en place. Plus d'« en-tête mocha » propre au blog.
- Héros (grand titre) sur fond terracotta.
- Une vraie photo de la banque d'images sous le titre, jamais un dessin.
- Boutons sur le côté : Journée IA, Diagnostic IA 45 min, contact.
- Encart vidéo, selon `CONCEPTION-ENCART-VIDEO.md`.
- Mobile d'abord, typographie soignée.

Fiches mises à jour : S2, G1 à G8, A1 (Actualités), GU1 (Guide pilier). Chaque fiche rappelle le budget Web Vitals d'`AGENTS.md`.
`PLAN.md` et `liens/LIENS.md` sont corrigés aux seuls endroits où ils contredisaient la v3.

⚠️ La branche `feat/gabarits-articles-s2-composants` (ancien design) est abandonnée : ne pas la reprendre, repartir de `main`.

## Points à faire trancher par Will

- Le bleu (`#1a4dd9`) est encore dans les maquettes : bouton « Diagnostic IA », liens, thème « Cadre légal » de la FAQ, et bouton Journée IA dans trois encarts du milieu. Or la marque est terracotta.
- Classes `.v-*` : aucune maquette ne les utilise dans son corps (restes de dessins SVG en bas des feuilles de style). Le document reprend à la place le cadre photo (`.visuel`). Si Will pensait à autre chose, il faut le lui redemander.
- Deux photos de maquette à remplacer : une infographie (Comparatif) et une image dont le nom annonce un chiffre (Chiffres).
- « Réservation directe » : la carte dit « Confirmation immédiate · Annulable en un clic », et l'en-tête réel a « Réserver un appel ». Non modifié.
- L'encart vidéo des maquettes annonce un lecteur YouTube : non repris, la doctrine du site n'a aucun lecteur tiers.
- `maquettes-v2/index.html` est périmé (bouton bleu dans l'en-tête).

Interdits vérifiés : aucun Grenoble, faux témoignage, prix barré, frais de déplacement ni avocat.

Prettier : vert (lancé sans le plugin tailwind, `node_modules` absent ; il ne touche pas au Markdown).

VERDICT OPUS : BON
