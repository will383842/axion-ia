# R-10 — pSEO VILLES CHAIN

## Diagramme ASCII

```
┌──────────────────────────────────────┐
│ scripts/import-insee-villes.ts       │  ← ⛔ NE PAS LANCER
│ (INSEE data → DB ou data/ ?)         │      réécrit la table
└────────────┬─────────────────────────┘
             │ écrit
             ▼
┌──────────────────────────────────────┐
│ src/content/villes/data/             │
│ 13 régions + 1 villes-export         │
│ ile-de-france.ts + ... +             │
│ corse.ts (2 157 villes total)        │
└────────────┬─────────────────────────┘
             │ lu par
             ▼
┌──────────────────────────────────────┐
│ Pages SSG (4 templates)              │
│ /implantations              (parent) │
│ /implantations/[region]              │
│ /implantations/[region]/[ville]      │  ← page mère doctrine
│ /audit/par-ville/[ville]             │
│ /interventions/par-ville/[ville]     │
│ /implementation/par-ville/[ville]    │
└────────────┬─────────────────────────┘
             │ generateStaticParams
             ▼
┌──────────────────────────────────────┐
│ 2157 villes × 4 templates × 2 locales│
│ ≈ 17 256 routes SSG prerendered      │
│ + tier classification AGT-04         │
│   tier-1 : pages avec copy.services  │
│   noindex follow sinon (HCU 2024)    │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│ src/content/villes/copy/             │
│ paris.ts (page mère pilote ~5000 mots│
│ 10 sections, 5+ schemas JSON-LD)     │
│ ⚠️ AGT-05 ratio mesuré 76/24         │
│   sous cible doctrine 95/5           │
│ + types.ts                           │
│ → 2 fichiers SEULEMENT (1 ville pilote│
│   sur 2 157 — AGT-05 P1)             │
└──────────────────────────────────────┘

Maillage :
  Footer Implantations émet pilotVilles × ≤3 services
  ⚠️ AGT-02 R-08 : bombe à retardement quand Will industrialise
  (Auvergne ~280 villes → footer >1000 entrées)
```

## Findings clés

1. **AGT-05 P1** 1 seule ville pilote (Paris) sur 2 157 → industrialisation Auvergne-Rhône-Alpes EN ATTENTE Will (mémoire `axionia_pseo_industrialisation_decision`).
2. **AGT-05 P0** ratio AxionIA-centric Paris pilote **76/24** mesuré (sous cible 95/5) — section 9 data INSEE trop dense. **Risque doorway HCU 2024 si ratio reproduit sur 2150 villes**.
3. **AGT-02 R-08 P1** Footer Implantations émet `pilotVilles × ≤3 services` en flatMap → bombe à retardement footer >1000 entrées quand industrialisation.
4. **AGT-04** Tier blog 1/2/3 propage en `robots` meta + sitemap conditional → bouclier HCU OK pour villes sans copy.
5. **AGT-04** Anti-doorway HCU 2024 propre : villes sans `copy` → `noindex follow` (cf. mémoire `axionia_pseo_villes_livre_2026-05-08`).
6. **URL canonique respectée** : `/fr/implantations/<region>/<ville>` (AGT-02 R-01). **Pas de `/par-region/`** dans le code (doctrine § 0.1 respectée).

## Cohérence chaîne

✅ 4 templates pSEO existants + SSG 17 256 routes prerendered.
✅ URL doctrine `/fr/implantations/<region>/<ville>` partout.
✅ Tier classification + noindex automatic anti-doorway.
✅ Maillage interne services × villes pilotes.
⚠️ 1 ville pilote / 2 157 → industrialisation à lancer mais ratio doctrine 95/5 à corriger AVANT scale-out (P0 AGT-05).
⚠️ Footer scale-out non bridé → flag avant industrialisation.
