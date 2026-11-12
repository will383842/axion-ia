# ADR 0074 — Cliquet des pages publiques relevé de 292 à 294 KB pour la landing La Journée IA

- **Statut** : **ACCEPTÉ** — décision de Will, le 2026-11-09 (« fais selon tes recommandations », après recommandation chiffrée de relever à 294 kB)
- **Date** : 2026-11-09
- **Auteur** : Claude, sous mandat de Will
- **Référence** : `package.json` (bucket `size-limit` « SOMME des page chunks PUBLICS »), ADR 0072, PR #1896 (fondations), #1897 (landing `/fr/journee-ia`), #1898 (accueil)

## 1. Contexte

L'ADR 0072 a relevé le cliquet de 285 à 292 KB (19/10) en posant : « tout nouveau
relèvement est une nouvelle décision de Will, chiffres à l'appui ». Depuis, les lots
Qualiopi, le studio et les pages apporteurs ont été fusionnés et la marge est tombée à
0,42 kB. La landing `/fr/journee-ia` réécrite (#1897, offre phare du site) ne passe plus le
Gate B, alors que l'accueil réécrit (#1898) passe.

## 2. Mesure (Gate B, somme des page chunks publics, brotli)

| État                                                                                 | Mesure    | Limite | Écart    |
| ------------------------------------------------------------------------------------ | --------- | ------ | -------- |
| Fondations seules (#1896, base de #1897/#1898)                                       | 291,58 kB | 292 kB | (passe)  |
| Accueil (#1898)                                                                      | 291,41 kB | 292 kB | (passe)  |
| Landing (#1897) avant allègement                                                     | 293,31 kB | 292 kB | +1,31 kB |
| Landing (#1897) après remplacement de `FadeInOnView` par la classe CSS `.apparition` | 293,03 kB | 292 kB | +1,03 kB |

Les autres buckets passent (shell 137,97 / 138 kB, console admin 581,71 / 600 kB).

## 3. Décision

Relever la limite du bucket PUBLIC de **292 KB à 294 KB** : mesure connue (293,03),
arrondie au kB supérieur (294), sans marge supplémentaire. Le contrôle reste **bloquant**.

Alternative écartée : retirer la barre d'appel collante mobile (`StickyMobileCta`) de la
landing. Elle porte le rendez-vous diagnostic sur la page la plus importante du site ;
1 kB sur l'ensemble des pages publiques ne justifie pas de perdre ce bouton.

## 4. Ce qui ne change pas

- Buckets console admin (600 KB), shell partagé (138 KB), `/appel`, `/apporteur`,
  `/galerie`, `/implantations`, widget chatbot : inchangés.
- Les pages stratégiques gardent leur budget : LCP ≤ 1 800 ms, INP ≤ 100 ms, CLS = 0,
  First Load JS ≤ 75 kB gz par route. Ce cliquet est une somme anti-croissance, pas un
  budget par route.

## 5. Conséquences et règle de suite

- La PR #1897 repasse le Gate B avec ce commit.
- La marge restante est inférieure à 1 kB : la prochaine page publique devra alléger
  (chargement différé, composants serveur) avant d'ajouter du JavaScript client.
- **Tout nouveau relèvement est une nouvelle décision de Will**, chiffres à l'appui ;
  plafond de cette décision : 294 kB.
