# Architecte du plan bloquant (équipe éditoriale, PR 5)

Dépend de #2357.

## But

Poser le contrat de plan de l'équipe éditoriale et rendre le contrôle de structure BLOQUANT, dans ce circuit seulement, derrière `CONTENT_EQUIPE_EDITORIALE` (valeur exacte `"true"`).

Contrat : H1 = la question ; réponse directe de 40 à 60 mots avec le mot-clé principal ; 5 à 8 H2 répondant chacun à une question du brief (`questionCouverte`, `preuve` facultative) ; H3 seulement si un H2 en a au moins deux ; jamais de saut de niveau ; 100 % des questions du brief couvertes par un H2 ou la FAQ, sans répétition.

## Fichiers

- `src/server/content-gen/equipe/plan.ts` (nouveau) : schéma du plan, `planVersHtml`, `verifierPlan`.
- `src/server/content-gen/equipe/plan.test.ts` (nouveau).
- `src/server/content-gen/quality/outline-validator.ts` : option `bloquant` (défaut faux), contrôle de couverture, codes d'anomalie neufs, résultat `bloque`. Défaut inchangé pour les autres appelants.
- `src/server/content-gen/generators/blog-from-title.ts` : champs `questionCouverte` / `preuve` facultatifs dans l'outline ; consigne du plan ajoutée au prompt seulement si l'interrupteur est allumé.

## Tests

Saut de niveau, réponse hors 40-60 mots, mot-clé absent (limite de mot), couverture incomplète, répétition H2/FAQ (et FAQ répétée), nombre de H2, H3 isolé, question hors brief, interrupteur éteint (ou `"1"`) = avertissements d'avant, jamais bloquant. `pnpm vitest run` sur content-gen/equipe, quality, generators : OK. `tsc --noEmit` et eslint : OK (le typecheck demande `NODE_OPTIONS=--max-old-space-size=12000` ici).

## Risques et limites assumées

- `verifierPlan` n'est PAS encore branché sur le job `blog-from-title` : le brief n'est pas encore dans la charge du job (champ facultatif à ajouter dans la PR suivante). Aujourd'hui, interrupteur allumé = seulement la consigne dans le prompt ; le blocage est livré, testé, mais pas appelé.
- Le gabarit « Output attendu » du prompt demande encore `outline:[{h2,brief}×8]` ; à adapter au branchement, avec l'envoi des questions du brief au modèle.
- Non vérifiés : « H1 = question » (forme interrogative), équivalence « IA » / « intelligence artificielle » pour le mot-clé, minimum de mots du corps (850) avec 5 sections.
- Les briefs importés du plan éditorial n'ont qu'une question : ils ne peuvent pas passer le contrôle de couverture sans questions dérivées.
- Aucun changement de `pnpm-lock.yaml`, aucune migration, charge BullMQ inchangée (champs facultatifs).

VERDICT OPUS : BON
