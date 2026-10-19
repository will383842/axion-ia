# ADR 0072 — Cliquet des pages publiques relevé de 285 à 292 KB pour la fin des lots Qualiopi (L09, L05)

- **Statut** : **ACCEPTÉ** — décision de Will, le 2026-10-19 (« Relever le plafond à 292 kB »)
- **Date** : 2026-10-19
- **Auteur** : Claude, sous mandat de Will
- **Référence** : `package.json` (bucket `size-limit` « SOMME des page chunks PUBLICS »), ADR 0069, PR #1585, #1582, `AGENTS.md` (« Performance budget »)

## 1. Contexte

L'ADR 0069 avait relevé le cliquet de 280 à 285 KB en prévoyant 1 kB de marge et en
posant : « tout nouveau relèvement est une nouvelle décision de Will, chiffres à
l'appui ». Depuis, L04 (#1571) et L12 (#1587) ont été fusionnés, ainsi que les lots du
studio (vidéos du site). La PR L09 (#1585), rebasée sur `main`, ne passe plus le Gate B.

## 2. Mesure (Gate B, somme des page chunks publics, brotli)

| PR    | Mesure    | Limite | Écart    |
| ----- | --------- | ------ | -------- |
| #1585 | 288,77 kB | 285 kB | +3,77 kB |
| #1587 | 279,24 kB | 285 kB | (passe)  |

Les autres buckets passent (shell 137,6 / 138 kB, console admin 559,85 / 600 kB).
La mesure de L05 (#1582), rebasée sur `main`, n'était pas encore connue à la rédaction.

## 3. Décision

Relever la limite du bucket PUBLIC de **285 KB à 292 KB** : plus grande mesure connue
(288,77), arrondie au kB supérieur (289), plus une marge de 3 kB pour L05. Le contrôle
reste **bloquant**.

## 4. Ce qui ne change pas

- Buckets console admin (600 KB), shell partagé (138 KB), `/appel`, `/apporteur`,
  `/galerie`, `/implantations`, widget chatbot : inchangés.
- **Les 15 pages stratégiques gardent leur budget** : LCP ≤ 1 800 ms, INP ≤ 100 ms,
  CLS = 0, First Load JS ≤ 75 kB gz par route. Ce cliquet est une somme anti-croissance,
  pas un budget par route (et le First Load JS par route n'est mesuré par aucune gate).

## 5. Conséquences et règle de suite

- Les PR #1585 et #1582 repassent le Gate B après fusion de celle-ci (ou rebase).
- La marge restante est d'environ 3 kB.
- On continue d'alléger par chargement différé. **Tout nouveau relèvement est une nouvelle
  décision de Will**, chiffres à l'appui ; plafond de cette décision : 292 kB.
