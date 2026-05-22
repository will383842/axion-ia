# Review Will — External Links Database 2026-05-22

## État du catalogue (bootstrap initial)

| Scope               | Fichier                                       | Count bootstrap | Cible post-seed |
| ------------------- | --------------------------------------------- | --------------: | --------------: |
| National FR         | `src/data/external-links/national-fr.ts`      |              24 |            ~200 |
| International       | `src/data/external-links/international.ts`    |              12 |             ~50 |
| Régions FR          | `src/data/external-links/regions.ts`          |              13 |            ~130 |
| Villes top 200      | `src/data/external-links/cities.ts`           |              12 |            ~200 |
| Verticales (5)      | `src/data/external-links/verticales.ts`       |              18 |            ~400 |
| Topics IA           | `src/data/external-links/topics.ts`           |               8 |            ~150 |
| Presse FR           | `src/data/external-links/press-fr.ts`         |               7 |             ~50 |
| Manual additions    | `src/data/external-links/manual-additions.ts` |               0 |               — |
| **TOTAL bootstrap** | —                                             |          **94** |      **~2 400** |

Auto-seeded (via Perplexity) viendra dans `src/data/external-links/auto-seeded.ts`.

## Process complet de remplissage

```bash
# 1. Confirmer la clé Perplexity
grep PERPLEXITY_API_KEY .env.local

# 2. Lancer le seed batch (~$1.62, ~45 min)
pnpm tsx src/scripts/seed-external-links-from-perplexity.ts

# 3. Ajouter l'import dans master.ts (UN AJOUT)
#    Ouvrir src/data/external-links/master.ts et ajouter :
#    + import { LINKS_AUTO_SEEDED } from "./auto-seeded";
#    + ...LINKS_AUTO_SEEDED, dans le spread ALL_EXTERNAL_LINKS

# 4. Vérifier HEAD + paywall + robots.txt (~30-45 min)
pnpm tsx src/scripts/verify-external-links-head.ts

# 5. Review verification-report.md (top 100 problématiques)
cat _AUDIT/EXTERNAL-LINKS-2026-05-22/verification-report.md

# 6. Edits manuels :
#    - Virer les liens 404 / deprecated / paywall non acceptable
#    - Patcher URLs si redirect_acceptable
#    - Accepter paywall pour HBR/MIT Sloan/etc. si tu veux (note: les filtres durs
#      du selectExternalLinks() les excluront de la sélection mais ils restent
#      visibles en admin pour transparence)

# 7. Commit + push
git add src/data/external-links/
git commit -m "feat(external-links): seed Perplexity + verification — base ~2400 liens"
git push
```

## Distribution attendue par autorité

| Autorité | Description                                         | % cible |
| -------: | --------------------------------------------------- | ------: |
|      5/5 | Gouv FR, EU, Standards ISO, Academic top            |    ~50% |
|      4/5 | OPCO, CCI, Research Industry, Académique secondaire |    ~35% |
|      3/5 | Presse top, Industry associations                   |    ~15% |

## Distribution attendue par catégorie

| Catégorie                                         | % cible |
| ------------------------------------------------- | ------: |
| gov_fr                                            |     35% |
| research_industry                                 |     20% |
| gov_eu                                            |     10% |
| academic                                          |     10% |
| official_doc                                      |      8% |
| mairie                                            |      8% |
| press_top                                         |      5% |
| autres (industry_assoc, opco, international, cci) |      4% |

## Filtres durs appliqués automatiquement

Tous les liens sélectionnés par `selectExternalLinks()` passent OBLIGATOIREMENT :

- `status` ∈ {`active`, `redirect_acceptable`}
- `isCompetitor === false`
- `paywall === false`
- `indexable === true` (robots.txt destination)
- `isHttps === true`
- `authority >= minAuthority` (default 3, configurable par generator)

## COMPETITOR_DOMAINS hardcoded

Filtre dur sur (rejet si match) :

- axionai.fr (concurrent homonyme direct)
- kpmg.fr / kpmg.com (sauf research.kpmg.com en exception)
- mckinsey.com (sauf publications McKinsey Quantum Black research)
- wavestone.com, siapartners.com, onepoint.com, devoteam.com
- cegos.fr, demos.fr, openclassrooms.com, lewagon.com, simplon.co, datacamp.com, ib-formation.com
- dust.tt, crisp.chat, akkodis.com

COMPETITOR_EXCEPTIONS (autorisés malgré domaine concurrent) :

- capgemini-research-institute.com
- research.kpmg.com

## Rotation équitable (DB ExternalLinkUsage)

Tracker `usageCount` + `lastUsedAt` par lien :

- Sélection scoring : bonus de +100 - 2×usageCount → privilégie les liens peu utilisés
- Filtre rotation : refuse les liens utilisés < 24 h (configurable `maxRecentUsageHours`)
- Modes : `round_robin` (default), `weighted_authority`, `random`

Page admin `/content-gen/external-links` montrera la distribution d'usage (top
liens cités, équité de distribution).

## Top 30 liens bootstrap attendus dans les premiers articles

Les sources les plus citées seront probablement :

1. https://www.insee.fr/fr/statistiques (INSEE)
2. https://dares.travail-emploi.gouv.fr/ (DARES)
3. https://www.bpifrance.fr/ (Bpifrance)
4. https://www.francenum.gouv.fr/ (France Num)
5. https://www.francecompetences.fr/ (France Compétences)
6. https://www.francetravail.fr/ (France Travail)
7. https://www.cnil.fr/fr/intelligence-artificielle (CNIL IA)
8. https://www.ssi.gouv.fr/ (ANSSI)
9. https://cyber.gouv.fr/
10. https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32024R1689 (EU AI Act)
11. https://www.afnor.org/ (AFNOR)
12. https://www.iso.org/standard/81230.html (ISO/IEC 42001)
13. https://www.nist.gov/itl/ai-risk-management-framework (NIST AI RMF)
14. https://oecd.ai/ (OECD AI)
15. https://aiindex.stanford.edu/ (Stanford AI Index)
16. https://owasp.org/www-project-top-10-for-large-language-model-applications/
17. https://www.legifrance.gouv.fr/
18. https://www.data.gouv.fr/
19. https://www.cnam.fr/
20. https://syntec-numerique.fr/
    ... etc.

## Actions Will à valider post-livraison

1. **PERPLEXITY_API_KEY** : valoriser dans `.env.local` ET Coolify production
   (sinon le seed ne tournera pas et les workers ne verront que les 94 liens
   bootstrap).
2. **Activer worker monthly** : env var Coolify `EXTERNAL_LINKS_MONITOR_ENABLED=true`
   après le premier seed complet.
3. **Review verification-report.md** post-seed (30-45 min de revue).
4. **Optionnel** : ajouter manuellement des sources spécifiques au métier
   via `src/data/external-links/manual-additions.ts`.
