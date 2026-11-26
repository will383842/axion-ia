# Barrières de code (sans IA) dans les interdits de publication

## But
Ajouter, dans la source unique `src/lib/contenu/interdits-publication.ts`, quatre refus de code pour les textes publiés :
- `frais-venue` : déplacement, hébergement ou repas facturés, inclus, offerts ou pris en charge. « Le déplacement d'une tâche », « un repas d'équipe », « déplacer un rendez-vous » ne bloquent pas.
- `prix-barre` (code déjà existant, étendu) : balises `<del>` / `<s>` / `<strike>` et `~~` autour d'un montant, « au lieu de X € », « prix normal X € ».
- `multiple-garantie` : tout multiple autre que « 3 fois le prix » à côté de garantie / remboursement (2 fois, 5 fois, x10, double, 500 %…).
- `seuil-garantie-euros` : montant en euros présenté comme seuil de garantie.

Ces barrières s'appliquent toujours, sans interrupteur : elles ne font que refuser des textes.

## Fichiers
- `src/lib/contenu/interdits-publication.ts` : nouveaux codes, `motifInterdit(code)` (motif sans état, pour réutilisation), balises de barré converties en `~~` avant le retrait du HTML (bornées pour éviter un retour arrière coûteux).
- `src/server/content-gen/knowledge/journee-ia-fiche.ts` : réutilise les motifs partagés (frais, prix barré, multiple) au lieu de les dupliquer ; garde ses motifs locaux propres à la Journée IA (seuil exact, « frais kilométriques »…). Les interdits passent de 11 à 10 entrées (deux entrées « frais » fusionnées).
- `src/server/content-gen/quality/doctrine-check.ts` et `audit-blog-existant.ts` : prise en compte des nouveaux codes (nom de motif, classement).
- Tests : `src/lib/contenu/__tests__/interdits-barrieres-code.spec.ts` (nouveau), `journee-ia-fiche.spec.ts` (ajusté).

## Tests
- 60 cas dans le nouveau fichier, dont 35 phrases légitimes (hébergement de données, garantie décennale, seuil de rentabilité, « 100 % du montant », écran 2560 x 1440…), plus un test qui lie le « 3 » à `MULTIPLE_GARANTIE`.
- Specs des autres lecteurs de la source (output-guard du chatbot, crible-stock, filtre-sortie de la méthode, doctrine-check, audit-blog-existant, retrait-financement) : `src/lib/contenu`, `src/server/content-gen`, `methode`, `chatbot`, `crible-stock`, `lib/knowledge` = 258 fichiers, 4 297 tests passés.
- `tsc --noEmit`, eslint et prettier : propres sur les fichiers modifiés.
- Essais de temps sur textes hostiles : sous 500 ms.

## Risques
- Faux positifs assumés (règle absolue du dirigeant) : un texte qui dit « déplacements facturés » dans un autre sens (article sur la facturation d'un artisan) sera refusé.
- `multiple-garantie` : le mot « garantie » près d'un « N fois le prix » sans rapport avec l'offre peut bloquer (extension de garantie…). Rare ; à durcir plus tard si besoin.
- Le « 3 » est écrit dans le motif ; un test échoue si `MULTIPLE_GARANTIE` change.
- Lenteur déjà présente sur `main` (retrait générique des balises sans `>`), non touchée ici : à corriger à part.
- Aucun interrupteur `CONTENT_EQUIPE_EDITORIALE` ici : la consigne demande que ces barrières soient toujours actives. Aucun champ de job, aucune migration.
- Suivi amont de la branche non configuré en local (verrou sur `.git/config`) ; le push explicite suffit.

VERDICT OPUS : BON (3 tours ; tour 3 sans défaut bloquant)
