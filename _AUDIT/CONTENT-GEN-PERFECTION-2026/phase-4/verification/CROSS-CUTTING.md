# CROSS-CUTTING — Vérification Sprint P4

**Date : 2026-05-21 | HEAD : b523f5a4 | Mode : AUDIT-ONLY**

---

## Cohérence inter-agents (10 agents)

| Agent       | Findings                                  | Contradictions |
| ----------- | ----------------------------------------- | -------------- |
| V4-01 D1-D5 | D3 faq-standalone résiduel                | 0              |
| V4-02 P0-2  | boucle improve ✅ complet                 | 0              |
| V4-03 P0-3  | citationCount ✅ complet                  | 0              |
| V4-04 P0-4  | image hero slugs ✅ complet               | 0              |
| V4-05 P0-5  | AiContentDisclaimer ABSENT /implantations | 0              |
| V4-06 P0-6  | gate dur absent, claims non persistés     | 0              |
| V4-07 P0-7  | REJECT-P0 distinction ✅, pas Telegram    | 0              |
| V4-08 P1s   | P1-7/P1-12 non câblés                     | 0              |
| V4-09 KB    | seed manquant, RAG non câblé              | 0              |
| V4-10 cross | threshold hardcodé = gap P5               | 0              |

**0 contradiction inter-agents détectée.** Findings consistants.

---

## Discordance Sprint Verdict vs Réalité

**2 écarts critiques entre le VERDICT sprint et la réalité du code :**

### 1. P0-5 AiContentDisclaimer /implantations

- **Verdict déclarait :** "✅ pré-fait (Manon)" → FAUX
- **Réalité :** Composant absent de `/implantations/[region]/[ville]/page.tsx` (0 match grep)
- **Cause :** Revert stash accidentel lors de la gestion des fichiers de conversations parallèles
- **Sévérité :** P0 (AI Act deadline août 2026)

### 2. D3 faq-standalone.ts

- **Verdict déclarait :** "D3 persona Manon — 7 generators ✅"
- **Réalité :** `faq-standalone.ts` ligne 24 : `"Tu es l'expert contenu d'Axion-IA"` — non migré
- **Cause :** Generator `faq-standalone` omis lors de la mise à jour des 7 generators
- **Sévérité :** P1 (cohérence brand voice)

---

## Tests fonctionnels exécutés (mode code-based AUDIT-ONLY)

| Test                                  | Résultat                    | Méthode                                 |
| ------------------------------------- | --------------------------- | --------------------------------------- |
| T1 SYSTEM_PROMPT persona grep         | ✅ 7/8 generators Manon     | grep src/server/content-gen/generators/ |
| T2 D1 seuil 6.0                       | ✅ llm-judge.ts exact       | lecture source                          |
| T3 D2 itérations 3/2                  | ✅ HIGH_ITERATION_TYPES set | lecture source                          |
| T4 AiContentDisclaimer /implantations | ❌ ABSENT                   | grep page.tsx 935 lignes                |
| T5 citationCount câblé 4 generators   | ✅                          | grep computeSeoScore args               |
| T6 FactCheckClaim schema              | ✅                          | lecture schema.prisma                   |
| T7 Migration SQL                      | ✅                          | lecture migration.sql                   |
| T8 KB audits.ts chemin                | ✅                          | ls src/server/content-gen/kb/           |
| T9 isolation-check                    | ✅ 0 violation              | pnpm content-gen:isolation-check        |
| T10 vitest baseline                   | ✅ 1376/1383                | pnpm test                               |

**Tests LLM génération réels** : Non exécutables en AUDIT-ONLY (pas d'accès DB/API prod).

---

## Doctrine Compliance

| Règle                         | Statut                                                           |
| ----------------------------- | ---------------------------------------------------------------- |
| Zero invention KB facts       | ✅ sources réelles vérifiées                                     |
| Zero DALL-E images            | ✅ aucune image IA créée                                         |
| Manon persona (doctrine v2.1) | ✅ pas de réseau social, pas de vrai nom Will                    |
| AI Act art. 50 wording        | ⚠️ correctement dans composant mais ABSENT des 39 /implantations |
| RGPD                          | ✅ pas de PII dans KB facts                                      |

---

## Sécurité

| Critère                | Statut                                 |
| ---------------------- | -------------------------------------- |
| Clés API server-only   | ✅ reviewArticle() server-only         |
| KB facts SQL injection | ✅ Prisma parameterized                |
| LLM-judge pas de PII   | ✅ contexte = body article uniquement  |
| Webhook Telegram       | ⚠️ absent — P0-7 alerte non configurée |

---

## Performance & Coût projeté

Avec D2 (3 itérations guide_pilier + landing_ville) :

- Environ 30% des articles utilisent ces types
- Coût moyen par article : +30% pour ces types
- **Impact global : +9% coût mensuel total LLM estimé**
- Reste dans le budget mensuel défini (monthlyBudgetCapUsd = 100 USD)

---

## Recommandations Prioritaires (urgence décroissante)

### P0 — Bloquants déadline AI Act (avant août 2026)

1. **AiContentDisclaimer /implantations** : ajouter import+usage dans page.tsx (~15 min)

### P1 — Importantes (S+6)

2. **D3 faq-standalone.ts** : migrer persona + injectBrandVoice (~5 min)
3. **P0-6 gate dur factCheckScore < 50** : ajouter logic quarantaine dans fact-check-worker
4. **P0-6 claims DB** : upsert `factcheck_claims` rows en DB

### P2 — Améliorations (S+7)

5. **P1-7 glossary context wiring** : appeler getGlossaryContext() dans generators (+10 pts)
6. **P1-12 internal links wiring** : appeler injectInternalLinks() post-LLM (+10 pts)
7. **KB seed script** : créer seed-kb-facts.ts
8. **P0-7 Telegram alert** : webhook configurable pour hard rejects
9. **P1-2 validation post-LLM** : gate H1 keyword obligatoire

---

## Score Cross-cutting estimé : 65/100

- Cohérence inter-agents : 25/25 (0 contradiction)
- Tests fonctionnels exécutés : 30/50 (partiels, mode code AUDIT-ONLY)
- Recommandations P0/P1/P2 : 10/25 (2 discordances verdict trouvées)
