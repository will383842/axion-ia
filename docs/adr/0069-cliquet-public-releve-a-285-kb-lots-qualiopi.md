# ADR 0069 — Cliquet des pages publiques relevé de 280 à 285 KB pour les lots Qualiopi L04, L05, L09

- **Statut** : **ACCEPTÉ** — décision de Will, le 2026-10-17 (« alléger puis relever »)
- **Date** : 2026-10-17
- **Auteur** : Claude, sous mandat de Will
- **Référence** : `package.json` (bucket `size-limit` « SOMME des page chunks PUBLICS »), ADR 0049, ADR 0064, ADR 0068, PR #1571, #1582, #1585, `AGENTS.md` (« Performance budget »)

## 1. Contexte

Après l'audit Qualiopi du 16/10, les lots L04, L05 et L09 ajoutent du code public et
dépassent légèrement le cliquet de 280 KB (brotli) du bucket « SOMME des page chunks
PUBLICS » (`pnpm bundle:check`, Gate B). Will a décidé d'alléger d'abord, puis de relever.

## 2. Mesures (Gate B, somme des page chunks publics, brotli)

| Lot | PR    | Mesure        | Limite | Écart    |
| --- | ----- | ------------- | ------ | -------- |
| L04 | #1571 | 280,03 kB (*) | 280 kB | +0,03 kB |
| L05 | #1582 | 280,01 kB     | 280 kB | +14 B    |
| L09 | #1585 | 283,06 kB     | 280 kB | +3,06 kB |

(*) valeur donnée dans la consigne de Will ; non relue dans les logs.
La mesure de L09 est celle du dernier run Gate B lu (run `39074824580`) ; la consigne
mentionnait 282,88 kB après allègement : on retient le maximum lu, 283,06 kB. Run L05 :
`39043128219`. Les autres buckets (shell 137,5 / 138 kB, admin 559,6 / 600 kB) passent.

## 3. Décision

Relever la limite du bucket PUBLIC de **280 KB à 285 KB** : plus grande mesure (283,06),
arrondie au kB supérieur (284), plus 1 kB de marge. Le contrôle reste **bloquant**.

## 4. Ce qui ne change pas

- Buckets console admin (600 KB), shell partagé (138 KB), `/appel`, `/apporteur`,
  `/galerie`, `/implantations`, widget chatbot : inchangés.
- **Les 15 pages stratégiques gardent leur budget** : LCP ≤ 1 800 ms, INP ≤ 100 ms,
  CLS = 0, First Load JS ≤ 75 kB gz par route. Ce cliquet est une somme anti-croissance,
  pas un budget par route.

## 5. Conséquences et règle de suite

- Les PR #1571, #1582 et #1585 repassent le Gate B après fusion de celle-ci (ou rebase).
- La marge restante est de ~1 kB : la PR #1593 (279,29 kB) n'est pas concernée.
- On continue d'alléger par chargement différé. **Tout nouveau relèvement est une nouvelle
  décision de Will**, chiffres à l'appui ; plafond de cette décision : 286 kB.
