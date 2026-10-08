# ADR 0058 — Plafond de poids de la console pendant le chantier visio

- **Statut** : **ACCEPTÉ** le 2026-10-08 (relèvement à 560 KB, voir « Décision de Will du 08/10/2026 » en fin de document). Initialement PROPOSÉ. Rédigé maintenant, avant le premier écran, pour que la règle soit connue avant d'être utile. Tout relèvement du plafond est une **décision de Will**.
- **Date** : 2026-09-29
- **Auteur** : Will + Claude (chantier « enregistrement des visios »)
- **Référence** : ADR 0049 (budgets public et console séparés) ; `package.json` (bucket « CONSOLE ADMIN », 470 KB) ; `.github/workflows/ci.yml` (étape « Poids du bundle », bloquante) ; `tests/unit/ci/poids-du-bundle-garde-vraiment.spec.ts` ; ADR 0053.

## Contexte

La console pèse 462,68 KB pour un plafond de 470 KB (mesuré sur la PR #1202), soit une **marge de 7,32 KB**. La ligne « Shell partagé » a une marge de 1,81 KB. Le chantier ajoute environ six écrans (fiche client enrichie, « Après l'appel », page de la rencontre, enregistreur, état du circuit, questionnaire). Même rendu côté serveur, chaque écran produit un `page-*.js`, et un îlot client partagé part dans un bloc commun qui alourdit le shell.

L'étape « Poids du bundle » de Gate B est **bloquante** : un dépassement ferme la PR.

## Décision

1. **Tenir dans la marge de 7,32 KB.** Écrans du chantier **en composants serveur par défaut**, sans aucune bibliothèque cliente nouvelle (ni lecteur audio, ni éditeur riche). Un seul îlot client par écran au plus, mesuré.
2. **Chaque PR du chantier relève** dans sa description les lignes « CONSOLE ADMIN » et « Shell partagé » du journal de Gate B, avant et après, et le First Load JS de ses routes (aucune gate ne le mesure).
3. **Tout relèvement du plafond est une décision de Will** : si un écran ne tient pas, la PR s'arrête et pose la question, chiffres à l'appui ; elle ne relève jamais un cliquet en silence. Si Will accepte, cet ADR passe **ACCEPTÉ** avec la nouvelle valeur et sa justification.
4. Aucune page publique n'est ajoutée par ce chantier ; le budget public (265 KB) n'est pas touché.

## Conséquences

- **Positives** : le contrôle reste bloquant ; la règle est connue avant le premier écran ; un dépassement se voit et se décide.
- **Négatives** : la marge s'use aussi pour les autres chantiers de la console ; un écran riche peut devoir attendre une décision de Will.

## Alternatives écartées

- Relever le plafond d'avance, « pour ne pas tomber en rouge » : un cliquet relevé sans mesure ne protège plus rien.
- Rendre l'étape non bloquante pendant le chantier : c'est ce qui avait laissé la console grossir sans que personne ne le voie.

## Ce que cet ADR ne décide pas

Le budget des Web Vitals publics, qui n'est pas touché. Le seuil du shell, qu'on ne relève que sur une mesure.

## Décision de Will du 08/10/2026 — plafond relevé à 560 KB

Le 08/10/2026, la console pesait environ 499,5 à 499,8 KB pour un plafond de 500 KB, mesuré sur les runs verts de Gate B. Une PR du chantier « candidatures unifiées » (paquet 2) le dépassait déjà de 1,28 KB (501,28 KB), et d'autres écrans des chantiers apporteurs et candidatures sont prévus.

Williams a tranché, par écrit dans la session de coordination : « relève la limite tant que nécessaire ». Le plafond du bucket « SOMME des page chunks de la CONSOLE ADMIN » passe de **500 KB à 560 KB** (+ 12 %).

- **Ce qui ne change pas** : le budget public (Web Vitals, AGENTS.md) et le seuil du shell partagé ne sont pas touchés. Le contrôle reste **bloquant**.
- **Règle maintenue** : chaque PR qui ajoute de la console continue de relever, dans sa description, la ligne « CONSOLE ADMIN » avant et après. Les écrans restent en composants serveur par défaut.
- **Prochain relèvement** : à décider de nouveau par Williams, chiffres à l'appui, quand la marge restante passera sous 10 KB.