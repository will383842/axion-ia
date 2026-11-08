# Analyse — « J'ai pris connaissance de la devis n° … » (NON corrigé dans cette PR)

## Constat

`mentionAttestationDocument` (`src/server/qualiopi/documents/signature/mentions-document.ts`) construit
`la ${pieceLibelle} n° …` pour toutes les pièces. Le libellé du circuit « devis » est masculin → « la devis ».
Attendu : « du devis » / « le devis ».

## Pourquoi on n'y touche pas ici

- Le texte n'est pas haché tel quel, mais il est **adossé à `MENTION_VERSION_DOCUMENT = "doc-v1"`**, qui entre dans
  le tuple haché (`document-signature-service.ts`, `document-signature-hash.ts`). Les signatures de devis déjà
  scellées ont été présentées avec « la devis » sous `doc-v1`.
- Deux specs figent la version : `releve-queries.spec.ts` et `lettre-mission-queries.spec.ts`
  (`expect(MENTION_VERSION_DOCUMENT).toBe("doc-v1")`) ; vecteurs d'or dans `document-signature-hash.spec.ts`,
  `registre-verification.spec.ts`, `scenarios-signature.spec.ts`.
- La règle écrite dans le fichier : toute modification d'un texte impose d'incrémenter la version.
  Corriger la phrase sans bump ferait pointer des empreintes déjà scellées vers un texte qui n'existe plus.

## Ce qu'il faudrait faire (décision à prendre)

1. Introduire `doc-v2` (nouvelle constante) ; **archiver** le texte `doc-v1` (fonction figée conservant « la devis »)
   pour que le registre puisse toujours dire ce qui a été signé sous `doc-v1`.
2. Rendre l'article dépendant du libellé (`du devis` / `de la convention…`), seulement pour la version `doc-v2`.
3. Basculer `document-signature-service.ts` (deux sites `mentionVersion`) sur `doc-v2`, mettre à jour les deux specs
   qui figent `doc-v1` (sans les affaiblir : ajouter un témoin `doc-v1` archivé inchangé), et les vecteurs d'or
   concernés doivent rester verts pour `doc-v1`.
4. Si le bump doit ne concerner que le devis : versionner par type de pièce, ce qui est un changement de contrat.

## Corrigé dans cette PR (sans toucher au texte scellé)

Numéro : le portail titre le devis avec son n° de **devis** (AXI-DEV-…) et garde le n° de pièce en second plan ;
l'e-mail d'exemplaire signé (complet et copie partielle) porte `numeroDevis` (champ facultatif) et l'utilise en
sujet/référence. Aucun numéro stocké ni sceau modifié. La case d'acceptation continue de citer le n° de pièce
(c'est celui que la signature scelle), d'où la ligne « Référence de la pièce » affichée sous le titre.
