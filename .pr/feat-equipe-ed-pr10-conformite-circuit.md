# Conformité obligatoire du circuit de l'équipe éditoriale (PR 10)

## But

Ajouter l'étape de conformité finale du circuit, derrière `CONTENT_EQUIPE_EDITORIALE` (éteint par défaut, seule la valeur exacte « true » allume). Elle enchaîne : barrières de code (interdits de publication, dont les codes de la #2354), garde de prix, contrôle du vouvoiement, contrôle de fidélité par modèle (rendu obligatoire, même si `CONTENT_FIDELITY_CHECK` est éteint).
Échec fermé : erreur, plafond dépassé ou modèle indisponible → « relecture-humaine », jamais « publier ». `conformiteApresReecriture` rejoue tout sur le texte FINAL.

## Fichiers

- `src/server/content-gen/equipe/conformite.ts` (nouveau) : `controlerConformite`, `conformiteApresReecriture`.
- `src/server/content-gen/equipe/conformite.test.ts` (nouveau, 17 tests).
- Aucun motif dupliqué : réutilise `interdits-publication`, `price-gate`, `vouvoiement`, `fidelite-llm`, `equipe-editoriale-drapeau`.

## Tests

Chaque barrière refuse (interdit, prix, tutoiement, fidélité) ; erreur / plafond / réponse inexploitable du modèle → relecture humaine ; rejeu sur le texte réécrit (le juge ne voit pas l'original) ; interrupteur éteint → « inchange », aucun appel. `tsc --noEmit`, eslint et prettier passent.

## Risques

- Le module n'est pas encore appelé par le circuit (branchement dans un lot suivant) : aucun effet en production.
- Le contrôle de surface existant ne lit que `bodyText` ; on rejoue donc aussi les interdits sur le texte public complet (corps HTML compris).
- Le tutoiement, simple observation ailleurs, devient ici un motif de relecture humaine (seuil existant : 2 occurrences).
- `financementPublicAutorise` vaut faux par défaut (le plus strict).
- La garde de prix refuse tout montant en euros hors source unique, même non tarifaire (ex. une amende RGPD) : choix prudent, plus strict que le circuit actuel (`retainNonSsotPrice`). À valider par Will avant le branchement.
- Le HTML publié prime sur un `bodyText` périmé ; l'ancien `bodyText` est contrôlé en plus. Sortie vide ou non objet → relecture humaine.
- L'appelant devra transmettre `financementPublicAutorise` (faux par défaut ici, strict).
- Pas de changement de charge BullMQ, pas de migration.
