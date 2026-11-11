# Scanner de fausse présence locale — résumé (2026-11-11)

Outil : `scripts/villes/scan-fausse-presence.ts` (lecture seule). Verdicts : FAUTIF / A_VERIFIER (heuristique par ligne ; à relire avant tout nettoyage).

## origin/main

```
Résumé : 3058 détection(s), 1768 FAUTIF, 1290 A_VERIFIER
  depuis <Ville> : FAUTIF 970, A_VERIFIER 762
  à N min de : FAUTIF 125, A_VERIFIER 288
  à deux pas : FAUTIF 0, A_VERIFIER 49
  sur place à <Ville> : FAUTIF 0, A_VERIFIER 126
  nos consultants sont/viennent : FAUTIF 280, A_VERIFIER 0
  notre base : FAUTIF 5, A_VERIFIER 0
  Williams se déplace : FAUTIF 240, A_VERIFIER 0
  notre agence/bureau/antenne : FAUTIF 10, A_VERIFIER 0
  base(e)(s) à <Ville> : FAUTIF 15, A_VERIFIER 0
  en métro/RER/tram/bus ligne : FAUTIF 123, A_VERIFIER 65
```

CSV : `docs/_AUDIT/scan-fausse-presence-main-2026-11-11.csv`

## origin/feat/v3-villes-lot-2

```
Résumé : 3019 détection(s), 1780 FAUTIF, 1239 A_VERIFIER
  depuis <Ville> : FAUTIF 943, A_VERIFIER 747
  à N min de : FAUTIF 132, A_VERIFIER 256
  à deux pas : FAUTIF 0, A_VERIFIER 49
  sur place à <Ville> : FAUTIF 0, A_VERIFIER 126
  nos consultants sont/viennent : FAUTIF 296, A_VERIFIER 0
  notre base : FAUTIF 2, A_VERIFIER 0
  Williams se déplace : FAUTIF 247, A_VERIFIER 0
  notre agence/bureau/antenne : FAUTIF 10, A_VERIFIER 0
  base(e)(s) à <Ville> : FAUTIF 14, A_VERIFIER 0
  en métro/RER/tram/bus ligne : FAUTIF 134, A_VERIFIER 61
  sur place à <Ville> en N min : FAUTIF 2, A_VERIFIER 0
```

CSV : `docs/_AUDIT/scan-fausse-presence-feat-v3-villes-lot-2-2026-11-11.csv`

## Relecture RO1 (2026-11-11)

Motifs élargis puis CSV régénérés : « à N min » suivi de « du », « des » ou « d’ » et les distances en heures (« à 1 h 30 de Paris ») n’étaient pas vus (+121 détections sur main, +126 sur lot-2) ; « basées à » est couvert.
