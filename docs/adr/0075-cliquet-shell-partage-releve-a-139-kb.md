# ADR 0075 — Cliquet du shell partagé relevé de 138 à 139 KB

- **Statut** : **ACCEPTÉ** — accord de Williams, le 2026-11-11 (« C'est ce qui est nécessaire en fonction de tes recommandations », après recommandation de relever le plafond par une décision écrite)
- **Date** : 2026-11-11
- **Auteur** : Claude, sous mandat de Williams
- **Référence** : `package.json` (bucket `size-limit` « Shell partagé »), ADR 0072, ADR 0074, PR #1913 et #1914

## 1. Contexte

Le bucket « Shell partagé » (framework + main + main-app + webpack + polyfills) porte un
cliquet à 138 KB depuis le 2026-08-24, pour une cible de 100 KB (dette ouverte 35,75 KB).
Sur `main`, il mesure désormais **137,9 à 138,1 kB** : la marge est inférieure à 100 octets.
Des PR sans rapport avec le JavaScript échouent pour quelques octets : la PR #1913 (docs
seule) et la PR #1914 ont dépassé la limite de 12 à 97 octets.

## 2. Décision

Relever la limite du bucket « Shell partagé » de **138 KB à 139 KB**. La **cible de 100 KB
reste inchangée** et écrite dans le nom du bucket. La dette ouverte est recalculée :
**≈ 38 KB** (mesure 137,9-138,1 − 100 ; 35,75 KB le 2026-08-24). Le contrôle reste **bloquant**.

## 3. Conséquences

- Les PR #1913 et #1914 ne sont plus rouges pour ce motif.
- Aucun autre bucket, ni le First Load JS par route, ni `ci.yml` (hors commentaires citant
  138), ne bouge.
- La marge réelle redevient d'environ 1 kB.

## 4. Condition de retour et règle de suite

- Le cliquet ne doit **plus monter sans réduction** : tout nouveau relèvement est une
  nouvelle décision de Williams, chiffres à l'appui.
- Il sera **abaissé APRÈS un travail de réduction du shell**, jamais avant, sous peine de
  rouvrir un rouge que personne ne peut fermer dans sa propre PR.
