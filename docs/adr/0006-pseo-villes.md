# ADR 0006 — pSEO villes & régions FR : engagement scale + pipeline éditorial

- **Statut** : proposed
- **Date** : 2026-05-07
- **Auteur** : Agent principal (audit Header & Navigation 2026) + Agent D (stratégie pSEO) — formalisation Claude Opus 4.7
- **Validation Will** : Acceptée en bloc 2026-05-07 (Q1-Q8) + amendement périmètre 2026-05-07 (volume V1 ramené à TOUTES villes >5 000 hab France = ~2 150 communes, pas 1 160 >10 000 hab — décision Will « TOUT ou rien sur le SEO »).
- **Implémentation** : différée — Will finit le frontend en cours avant Sprint 15. Sprint 15 backend (Prisma) reste un chantier distinct.
- **ADRs liées** : `0005-navigation-mega-menu.md` (mega-menus rendent les pages pSEO atterrissables depuis le header).

---

## Contexte

Expansion de surface de visibilité SEO majeure pour AxionIA :

1. **Pages régions** FR (~13-18 régions selon décision DROM-COM).
2. **Pages villes** FR > 5 000 habitants (volume corrigé ~2 150 communes — sources INSEE COG + populations légales).
3. **Page « Toutes les IA »** déjà livrée sous `/stack-ia` (HEAD).

`CLAUDE.md` v6 ne couvre pas le pSEO programmatique à cette échelle. Cet ADR engage AxionIA sur le volume cible, profondeur URL, périmètre géographique, pipeline éditorial, rollout et gouvernance.

## Décisions (Q1-Q8 validées Will 2026-05-07)

| #   | Question                              | Décision                                                                            | Rationale                                                                                                              |
| --- | ------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Q1  | Conserver les 11 outils `/stack-ia` ? | **Oui — 11 outils conservés**                                                       | `content/stack-ia.ts` HEAD = 5 catégories + 11 outils + 5 FAQ. Stable.                                                 |
| Q2  | Profondeur URL                        | **Hiérarchique : `/implantations/[region]/[ville]`**                                | SEO + UX (vs flat `/villes/lyon`).                                                                                     |
| Q3  | Périmètre géographique                | **Métropole + 5 DROM (Guadeloupe/Martinique/Guyane/Réunion/Mayotte) — exclure COM** | COM = volume marginal + complexité juridique.                                                                          |
| Q4  | Mega-menus header                     | **Voie 2 — mega-menus avec garde-fous** (cf. ADR 0005)                              | Atterrissage pages pSEO.                                                                                               |
| Q5  | Pipeline éditorial                    | **80/20 LLM/Will**                                                                  | LLM (Claude Sonnet 4.6 via prompt caching) génère le contenu de base, Will revue 20% (top métropoles + cas critiques). |
| Q6  | Phase 1 (rollout)                     | **Top 50 villes** d'abord                                                           | Mesure traction + ajustement ton avant scale.                                                                          |
| Q7  | Sitemap                               | **Split sitemap-index** (`sitemap-implantations.xml`)                               | Cohérent avec sitemap-index Next 16 HEAD (cf. ADR via Sprint 14.8).                                                    |
| Q8  | Recherche `⌘K`                        | **Reportable Sprint 16+**                                                           | Pas bloquant pour pSEO.                                                                                                |

### Volume V1 final

**~2 150 villes >5 000 hab France métropolitaine + 5 DROM = ~2 155 pages villes** + 13 régions (12 métropole + 1 DROM groupé) = **~2 168 pages pSEO**.

### Budget V1 estimé

- Temps Will : ~28 h sur 12 semaines (revue 20% + arbitrages).
- LLM : ~65 € one-shot (Claude Sonnet 4.6 + prompt caching) + 60 €/an refresh INSEE.
- **Total : ~2 800-9 000 €** (dominant = temps Will).

### Gouvernance

- Refresh annuel données INSEE (population légale + COG).
- Indexation conditionnelle « thin content » : page noindex si < N caractères (seuil à fixer).
- Monitoring : Search Console + Plausible self-hosted.

## Conséquences

### Positives

- ~2 168 pages SEO actionables vers les requêtes long-tail régionales.
- Cohérence avec stratégie cabinet IA opérationnel B2B (« Cabinet IA opérationnel à Lyon », « audit IA Bordeaux », etc.).
- Atterrissage depuis mega-menus header (ADR 0005).

### Négatives / À surveiller

- **Risque thin-content** Google : exiger ≥ 600 mots/page + données locales spécifiques (INSEE entreprises, secteurs dominants).
- **Charge Crawl** : sitemap split + IndexNow obligatoires.
- **Maintenance** : refresh annuel INSEE doit être automatisable (script `scripts/refresh-insee.ts` Sprint 17).

## Source détaillée

Voir `_AUDIT/adr-0004-pseo-villes-PROPOSITION.md` pour la justification complète, sources INSEE, analyse stack-fit (`_AUDIT/stack-fit-analysis.md`), stratégie pipeline éditorial (`_AUDIT/pseo-strategy.md`), et les 8 STOP & ASK validés.
