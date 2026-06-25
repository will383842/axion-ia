# 08 — SYNTHÈSE EXÉCUTIVE — Audit Content Engine Axion-IA

**Date** : 2026-06-25 · **Périmètre** : génération → qualité → backend → frontend → console → publication → cohérence · **Méthode** : audit READ-ONLY, 6 agents d'exploration + lecture directe codebase + **échantillon de 8 articles tirés de la vraie base** (33 publiés) + vérification adversariale des contradictions inter-agents. **Stack réelle : Next.js 16 + Prisma + BullMQ + React + next-intl.** _(Laravel/PHP/Eloquent/Blade : ABSENTS — équivalents audités.)_

> ⚠️ Cet audit n'a **rien corrigé** (règle 1 du prompt). Tout ci-dessous est constat + reco.

## Scores par dimension (/10)

| Dimension                 |  Score  | Verdict synthétique                                                                                                                                                     |
| ------------------------- | :-----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Pipeline de génération | **8.0** | Robuste, mature (orchestrateur, verrous, cost-cap, circuit-breaker, 3-appels). Faiblesses : `finish_reason` non vérifié, température figée, hero non re-validé.         |
| 2. Qualité du contenu     | **6.3** | Answer-first/JSON-LD/FAQ ✅ mais **meta chroniquement courtes**, **directAnswer court**, 1 article thin, H2 peu question-form.                                          |
| 3. Backend                | **7.5** | Sécurité saine (0 secret hardcodé, 0 SQLi, auth+role). Manques : gate qualité OFF, observabilité jobs/logs, RGPD audit-log, prompt-injection template.                  |
| 4. Frontend               | **9.0** | **La couche la plus saine.** ISR, sanitize defense-in-depth, JSON-LD head, CWV budget-friendly, a11y. 1 MAJEUR (double BreadcrumbList à confirmer).                     |
| 5. Console admin          | **8.0** | Très riche (wizard, 14 settings, CRUD templates, stats). Manques : versionnage prompts, logs non exposés en UI, pas de scheduling.                                      |
| 6. Publication            | **7.0** | Idempotence/drip/ISR/IndexNow/slug-history solides. Risque : **auto-publish fail-open** + slug-history au refresh.                                                      |
| 7. Cohérence transversale | **6.5** | Couches saines isolément ; défauts aux **jointures** (chaîne qualité fail-open, garanties meta absentes, og:image double source, hreflang EN résiduel).                 |
| **GLOBAL**                | **7.3** | **Système mature et bien architecturé**, freiné par une **chaîne qualité fail-open** et des **patterns de qualité contenu récurrents**, pas par des failles techniques. |

## TOP 10 des problèmes (priorisés)

|  #  |       Sév.        | Problème                                                                                                                                 | Localisation                                       | Pourquoi ça compte                                                                  |
| :-: | :---------------: | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------- |
|  1  |    **MAJEUR**     | **Chaîne qualité fail-open** : auto-publish ON par défaut (`!== false`) × seuil 70 × gate data-quality OFF → contenu thin auto-publiable | content-gen-worker.ts:923-929 ; 03.1 ; 06.1 ; 07.4 | Défaut le plus structurant : aucun filet qualité actif par défaut → risque HCU/SERP |
|  2  |    **MAJEUR**     | Meta **systématiquement trop courtes** (metaTitle 33-50 / metaDesc 107-144) sans re-try ni clamp au rendu                                | prompts + lib/seo.ts ; 02.2 ; 07.1                 | CTR SERP perdu sur 100 % du catalogue                                               |
|  3  |    **MAJEUR**     | `directAnswer` trop court (24-31 mots vs 40-80)                                                                                          | générateurs ; 02.5                                 | Capte moins la Position 0 / AI Overview (cœur AEO)                                  |
|  4  |    **MAJEUR**     | Observabilité jobs/logs **absente en UI** (GenerationLog non exposé, pas de dashboard failed-jobs)                                       | 03.3 ; 03.5 ; 05.4                                 | Diagnostic d'erreur = accès DB direct ; alertes Telegram = SPOF                     |
|  5  |    **MAJEUR**     | `finish_reason` LLM non inspecté → troncatures silencieuses persistées                                                                   | providers/openai.ts, anthropic.ts ; 01.4           | Corps incomplets publiables                                                         |
|  6  |    **MAJEUR**     | Prompt-injection via `ContentTemplate.systemPrompt` éditable, injecté brut                                                               | template-resolver.ts:~71 ; 03.6                    | Compte admin/editor compromis → détournement LLM                                    |
|  7  |    **MAJEUR**     | RGPD : suppression `forget` sans ActivityLog + `/revalidate` sans rate-limit                                                             | 03.2                                               | Non-conformité CNIL art. 17 + surface d'abus cache                                  |
|  8  |    **MAJEUR**     | Slug-history pas garanti au **refresh** + tier_3 orphelin sans alerte                                                                    | 06.3 ; 06.5 ; 07.3                                 | URLs indexées → 404 ; contenu généré/coûté mais invisible                           |
|  9  |    **MAJEUR**     | Hero image non re-validé + colonnes og:image dormantes (double source)                                                                   | content-publish-worker.ts:~300 ; 07.1              | Images héro mortes possibles ; modèle de données trompeur                           |
| 10  | **MINEUR→MAJEUR** | Pas de versionnage des prompts (édition écrase) + pas de timeout de queue                                                                | 05.4 ; 03.3                                        | Pas de revert si un prompt dégrade ; job bloqué → OOM worker                        |

## Patterns récurrents

1. **Fail-open par défaut** : les filets (gate qualité, auto-publish opt-out, seuil) sont configurés pour _laisser passer_ en l'absence de config. Le défaut devrait être conservateur.
2. **Pas de garantie entre génération et rendu** : longueur meta, validité hero, slug-history — les invariants ne sont garantis par aucune couche de jointure.
3. **Observabilité = angle mort** : tout est loggé en DB/Telegram, rien n'est requêtable en console → diagnostic lent.
4. **Qualité « presque bonne » répétée** : meta/directAnswer juste sous les cibles, partout — un problème de _contrainte non re-tentée_, pas de capacité.
5. **Faux positifs de sévérité** (corrigés ici) : XSS (réfuté, defense-in-depth), clés env (pratique standard), unicité slug (déterministe). L'audit a éliminé 3 « CRITIQUES » fantômes par vérification adversariale.

## Ce qui fonctionne (à préserver)

- ✅ **Architecture pipeline** : orchestrateur + verrous Redis + idempotence SHA256 + cost-cap atomique + circuit-breaker + 3-appels plan→expand.
- ✅ **Sécurité de génération** : sanitisation DOMPurify **defense-in-depth** (génération ET rendu), 0 secret hardcodé, 0 SQLi, auth+role.
- ✅ **Frontend** : ISR, JSON-LD en `<head>` (déterministe, pas dans le body), CWV budget-friendly, a11y, composants `null`-guardés (CLS=0).
- ✅ **AEO/GEO** : answer-first (`data-aeo`), FAQPage alimenté, Speakable, entités/dfn, Sources déterministes.
- ✅ **Console** : wizard campagne, 14 settings, CRUD templates avec test inline, stats coût/qualité/couverture.
- ✅ **Publication** : drip 8h-22h, cap rampé, IndexNow, slug-history 301, tier-aware robots/sitemap cohérents.

## Prérequis avant industrialisation (ordre conseillé)

1. **Fermer la chaîne qualité fail-open** (#1) : activer la gate data-quality pour les types courts OU relever le plancher auto-publish — _avant_ tout scale-up de volume.
2. **Garantir les meta** (#2,#3) : clamp/fallback longueur metaTitle/metaDesc + plancher directAnswer (re-try si court).
3. **Exposer l'observabilité** (#4) : dashboard jobs/logs + `@@index([level, timestamp])` + endpoint `/api/admin/logs`.
4. **Détecter les troncatures** (#5) : vérifier `finish_reason==='length'` → retry.
5. **Durcir** (#6,#7) : borner/filtrer systemPrompt, ActivityLog sur `forget`, rate-limit `/revalidate`.
6. **Fiabiliser publication** (#8,#9) : helper slug-history unique pour tous les chemins, re-validation hero, peupler ou supprimer og:image.
7. **Outillage** (#10) : versionnage prompts + timeout de queue.

> **Conclusion** : le Content Engine est **mature, bien architecturé et techniquement sain** (note 7.3/10). Il n'a **aucun CRITIQUE réel** (les 3 signalés par les agents ont été réfutés par vérification). Le vrai chantier n'est pas de réparer mais de **fermer les défauts de jointure** — au premier rang la chaîne qualité fail-open — et de **resserrer la qualité éditoriale** (meta, directAnswer) avant de monter en volume.

---

_9 fichiers : 00_CARTOGRAPHIE · 01_GENERATION · 02_QUALITE_CONTENU · 03_BACKEND · 04_FRONTEND · 05_CONSOLE · 06_PUBLICATION · 07_COHERENCE · 08_SYNTHESE._
