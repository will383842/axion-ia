feat(apporteurs): PR M #2464 — Journal des autofactures et export pour l'expert-comptable

## Ce qui change

- Une page « Journal des autofactures » (`/apporteurs/commissions/journal`) : filtres « du / au » (jours de Paris, bornes incluses), tableau trié par numéro, totaux nets des avoirs, encadré « trous de numérotation » de la série AXI-APP (affichage seulement).
- Un export CSV (`;`, UTF-8 avec BOM, montants `1234,56`, dates `JJ/MM/AAAA`, avoir en positif avec son genre).
- Un export FEC (18 colonnes, journal `APP` « Autofactures apporteurs ») : débit 6222 du HT, débit 44566 de la TVA si assujetti, crédit 401 (auxiliaire `APP<SIREN>`) du TTC ; un avoir donne les écritures inverses.
- Une pièce aux totaux absents (pièce reprise) : le CSV écrit « Totaux absents (pièce reprise) » ; le FEC refuse (400) avec la liste des numéros. Il refuse aussi une pièce dont HT + TVA ≠ TTC. Jamais d'écriture inventée.
- Lecture seule : aucune écriture en base. Même garde d'accès que l'export DAS2 (session + droit « facturer »).

## Corrections de relecture

- Route : 400 du FEC avec la liste des numéros, `du > au` et dates de calendrier inexistantes (`2026-13-01`, 400 et non 500 ; la page ne plante plus) testés.
- `lireJournal` testé : jours de Paris, bornes incluses, virement propre à chaque pièce.
- FEC : refus d'un total négatif, d'une TVA non nulle en franchise, d'un SIREN absent.
- Libellé « Totaux absents (pièce reprise) » aussi vrai pour `rattrapage` : à signaler à l'expert-comptable. « Virée le » ne lit que `ApporteurVirementCompte` (depuis le lot 7 de #2453) : les virements plus anciens sont vides.

## Tests

- `journal-autofactures-csv.spec.ts`
- `journal-autofactures-fec.spec.ts`
- `journal-autofactures-trous.spec.ts`
- `journal-autofactures-route-protegee.spec.ts`
- `journal-autofactures-lecture.spec.ts`
- `journal-autofactures-jour-valide.spec.ts`

## Migration

Non (aucun changement de schéma).

## Audit argent

Oui, en lecture comptable : une deuxième session doit rejouer les tests nommés et relire les écritures produites.

## Dépendances

Aucune.

## Points laissés ouverts

- **Comptes à valider par l'expert-comptable avant la première utilisation** (point 25 du plan, section 4) : 6222, 44566 et 401/`APP<SIREN>`. Ils sont regroupés dans la constante unique `COMPTES_FEC` (`journal-autofactures-fec.ts`) ; le bouton de la page dit « comptes à confirmer ».
- Le lien vers le journal depuis la page « Commissions » n'est PAS ajouté ici : #2453 est fusionnée dans `main`, mais cette branche part d'avant sa fusion et toucher la même page ferait un conflit. Le lien s'ajoutera dans une PR suivante ; le journal reste joignable par son adresse.
- Hypothèses à confirmer à la relecture : les avoirs sont numérotés dans la même série AXI-APP ; le signe des totaux d'un avoir est neutralisé (valeur absolue) dans le CSV et le FEC.
- Fichier FEC en `.txt` séparé par tabulations.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
