# Scanner de fausse présence locale — résumé (2026-11-11)

Outil : `scripts/villes/scan-fausse-presence.ts` (lecture seule). Verdicts : FAUTIF / A_VERIFIER (heuristique par ligne ; à relire avant tout nettoyage).

## origin/main

```
Résumé : 2937 détection(s), 1720 FAUTIF, 1217 A_VERIFIER
  depuis <Ville> : FAUTIF 970, A_VERIFIER 762
  à deux pas : FAUTIF 0, A_VERIFIER 49
  à N min de : FAUTIF 77, A_VERIFIER 215
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
Résumé : 2893 détection(s), 1724 FAUTIF, 1169 A_VERIFIER
  depuis <Ville> : FAUTIF 943, A_VERIFIER 747
  à deux pas : FAUTIF 0, A_VERIFIER 49
  à N min de : FAUTIF 76, A_VERIFIER 186
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
