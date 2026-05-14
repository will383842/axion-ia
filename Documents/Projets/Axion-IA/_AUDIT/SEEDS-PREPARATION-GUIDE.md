# Guide de préparation des seeds — Content Generator V1

> 9 fichiers seeds à ingérer en Sprint 1 (Sprint 2 pour image prompts, Sprint 5 pour RSS auto-fetch).
> Tous pré-remplis à 70-90 % par Claude. Will valide et ajuste avant ingest.

## Vue d'ensemble

| # | Fichier | Format | Volume V1 | Sprint | Status |
|---|---|---|---|---|---|
| 1 | `seeds-templates/manon-profile.md` | Markdown + photo | 1 personne | S1 | 🟡 à compléter Will (Q13) |
| 2 | `seeds-templates/rss-sources.json` | JSON | 15 sources | S5 | ✅ pré-rempli, à valider |
| 3 | `seeds-templates/coverage-distribution-profiles.json` | JSON | 3 profils | S1 | ✅ pré-rempli |
| 4 | `seeds-templates/audience-mix-profiles.json` | JSON | 4 profils | S1 | ✅ pré-rempli |
| 5 | `seeds-templates/banned-phrases.json` | JSON | 50 phrases | S1 | ✅ pré-rempli depuis doctrine |
| 6 | `seeds-templates/keyword-templates.csv` *(v2.1 — refonte)* | CSV | ~80 templates × variables (équivalent ~30 000 keywords runtime dynamiques) | S1 | ✅ refondu v2.1 — égalité villes |
| 7 | `seeds-templates/blog-titles.csv` | CSV | 250 titres | S1 | ✅ pré-rempli depuis frontend |
| 8 | `seeds-templates/unsplash-search-queries.json` *(v2.0)* | JSON | 18 templates | S2 | ✅ pré-rempli |
| 9 | `seeds-templates/synonym-groups.json` | JSON | 100 groupes | S1 | ✅ pré-rempli depuis frontend |
| 10 | `seeds-templates/external-references.json` *(v2.2 nouveau)* | JSON | 56 sources curées | S1 | ✅ pré-rempli — table `ExternalReference` |

## Comment utiliser ce guide

1. **Maintenant** : ouvrir chaque fichier dans `_AUDIT/seeds-templates/` et **valider / ajuster** le contenu pré-rempli
2. **Avant Sprint 1** : finaliser au moins fichiers 1-5 (critiques)
3. **Avant Sprint 2** : finaliser 6-8 (matière première gen blog + images)
4. **Avant Sprint 5** : valider 2 (RSS auto-fetch démarre Sprint 5)
5. **Pendant Sprint 1** : l'autopilote ingère ces fichiers via `pnpm content-gen:seed`

## Architecture d'ingest

```
_AUDIT/seeds-templates/*.{md,json,csv}    ← Will édite ici
              │
              ▼ (après finalisation)
prisma/seeds/content-gen/*.ts             ← scripts ingest TS
              │
              ▼ pnpm content-gen:seed
DB Prisma                                  ← tables peuplées
              │
              ▼ utilisé par
src/server/content-gen/                    ← generators consomment
```

## Validation après ingest

`pnpm content-gen:seeds-check` (script à créer Sprint 1) vérifie :
- Aucun champ critique vide
- Toutes les FK valides
- Sommes % = 100 % pour profils distribution et audience-mix
- Slugs uniques (keywords, titres)
- Pas de duplicate (titres ≈ titres → bloque)

## Que se passe-t-il si Will ne remplit pas certains fichiers ?

- **#1 Manon manquant** → Sprint 1 STOP & ASK obligatoire (gate humain)
- **#2 RSS manquant** → Sprint 5 utilise les 5 sources hardcodées par défaut (LeMondeInfo, ZDNet, UsineDigi, JDN, Frenchweb)
- **#3-#4 Profils** → défauts Claude utilisés (acceptable)
- **#5 Banned phrases** → doctrine § 21 du master utilisée (acceptable)
- **#6-#7 Keywords + titres vides** → l'autopilote `blog_from_*` ne peut générer que sur input manuel pendant V1 (campagnes utilisent default profile)
- **#8 Image prompts** → templates internes utilisés (acceptable mais qualité < perfection)
- **#9 Synonymes vides** → V2 (pas bloquant V1)

## Ordre de priorité finalisation

🔥 **Critique (avant Sprint 1)** :
1. Manon (#1) — sans ça, gate humain bloque
2. Profils distribution + audience mix (#3 + #4) — utilisés dès Sprint 1
3. Phrases interdites (#5) — utilisées par doctrine-check Sprint 1

💼 **Important (avant ou pendant Sprint 2)** :
6. Keywords + Titres (#6 + #7) — alimentent generators blog
7. Image prompts (#8) — utilisé pour générer visuels

📚 **Confort (peut attendre)** :
2. RSS sources (#2) — Sprint 5
9. Synonymes (#9) — V2 ou Sprint 6

## Pourquoi maintenant ?

- Tu attends que la KB atteigne son gate (≥ 300 chunks) avant Sprint 1 content-gen
- Pendant ce temps, préparer les seeds = ZÉRO conflit code + énorme gain temps Sprint 1
- Sprint 1 démarrera 30 % plus vite si seeds prêtes
- Ces données sont indépendantes du knowledge ET du code content-gen
