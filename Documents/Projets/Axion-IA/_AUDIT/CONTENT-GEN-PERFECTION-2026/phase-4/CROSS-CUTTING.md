# CROSS-CUTTING — Phase 4 Qualité Éditoriale & Templates
## Date : 2026-05-21 | HEAD : 37ca0147

---

## 1. GAPS SYSTÉMIQUES (détectés par ≥ 3 agents)

### SYS-1 : Générateurs stub — 4/9 types non dédiés [P0]
Détecté par : **A4-01**, **A4-03**, **A4-05**, **A4-07**

`comparison.ts`, `blog-from-rss.ts`, `qa-derived.ts`, `blog-from-title.ts` délèguent intégralement à `landing-ville-generator`. Un `ContentType.comparison` produit du contenu landing-ville avec les critères d'une landing. Conséquence :
- Le grader SEO-score évalue un comparatif comme une landing → critères mal alignés
- Le keyword-selector sélectionne un keyword blog mais le contenu est une landing → mismatch sémantique
- La boucle improve évalue le mauvais template → verdicts sans sens

**Fix** : créer des générateurs dédiés pour comparatif, rss-based (stubs minimum avec prompts distincts). Effort : 2-3j.

---

### SYS-2 : Modules codés mais désactivés en production [P0]
Détecté par : **A4-02**, **A4-04**, **A4-08**, **A4-09**

| Module | Statut code | Statut prod | Impact |
|---|---|---|---|
| `embedding-similarity.ts` (cosine 0.85) | ✅ complet | ❌ `OPENAI_EMBEDDINGS_ENABLED=false` | Déduplication sémantique inactive |
| Voyage AI RAG vectoriel | ✅ câblé | ❌ stub SHA-256 (pas de vraie clé) | RAG tombe en FTS seul |
| Alt text EN (`altEn`) | ✅ champ Prisma | ❌ jamais injecté dans le pipeline | Accessibilité EN inexistante |
| `KB_LOCALE = fr_en` | ✅ toggle prévu | ❌ défaut `fr_only` | 0 article EN généré |
| `alertCampaignDone()` | ✅ signature complète | ❌ jamais appelée | Reporting fin de campagne silencieux |

**Fix commun** : activer ces flags via Coolify + câbler les appels manquants. Effort : 1j config + 0.5j dev.

---

### SYS-3 : Boucle improve sans effet réel [P0]
Détecté par : **A4-07** (principal), confirmé par **A4-02**, **A4-03**

Le worker `content-quality-improver-worker.ts` appelle `reviewArticle()` sur le même `outputJsonRaw` sans modifier le contenu avant re-évaluation. Résultat : deux passes identiques produisent quasi-identiquement les mêmes scores. Le coût tokens est doublé pour zéro amélioration. Simultanément :
- A4-02 : aucune instruction de re-génération ciblée ("rends les phrases plus courtes")
- A4-03 : si le keyword manque dans H1, le re-prompt ne le cible pas explicitement

**Fix** : dans `content-quality-improver-worker.ts`, passer les `issues[]` du premier verdict au prompt de ré-génération avec instructions correctives ciblées. Effort : 4h.

---

### SYS-4 : Mismatch slugs internes → zéro image hero en production [P1]
Détecté par : **A4-08** (principal), cohérent avec **A4-01**, **A4-05**

Le mapping `VERTICAL_TO_IMAGE_MODULE` dans `assign-hero-image.ts` utilise les slugs `"audit"`, `"interventions-formations"`, `"implementation"`, `"coaching-1-to-1"` alors que la DB prod contient `"audits"`, `"interventions"`, `"implementations"`, `"un-a-un"`. La query DB retourne 0 candidats → 0 image hero assignée en production. Les tests ne le détectent pas car ils mockent Prisma avec les valeurs du mapping (non les valeurs DB réelles).

**Fix** : corriger le mapping + ajouter un test d'intégration avec seed réel. Effort : 1h.

---

### SYS-5 : Pipeline de liens internes non fonctionnel [P0]
Détecté par : **A4-05** (principal), cohérent avec **A4-01**, **A4-07**

Trois bugs en cascade :
1. Regex `internalLinkCount` cherche syntaxe Markdown `[text](url)` dans du HTML → retourne systématiquement 0
2. `parseBody()` strip les tags HTML des articles DB → détruit les `<a href>` générés
3. `citationCount` jamais passé à `computeSeoScore()` → critère "sources" toujours 0

Le SEO-score "Internal links" est systématiquement sous-évalué. Un article avec 5 vrais liens internes passe en IMPROVE à cause de ce bug.

**Fix** : corriger la regex (HTML vs Markdown) + patcher parseBody() + passer citationCount. Effort : 2h.

---

### SYS-6 : AI Act compliance incomplète — pages /implantations non couvertes [P0]
Détecté par : **A4-06** (principal), cohérent avec **A4-01** (landing templates)

Les 39 pages `/implantations/[region]/[ville]` avec `isPilot = true` et `/audit/par-ville/[ville]` ne portent aucun `AiContentDisclaimer` malgré un contenu IA-assisté. Les templates `DOCTRINE_INTOUCHABLE` des landings-ville ne l'incluent pas. Deadline légale AI Act art. 50 : août 2026 (dans 3 mois).

**Fix** : injecter `<AiContentDisclaimer />` dans `city-layout.tsx` + landing-ville-templates. Effort : 1h.

---

## 2. CONTRADICTIONS ENTRE AGENTS (arbitrage requis)

### CONTRA-1 : A4-07 vs A4-02 sur la lisibilité
- A4-07 indique que le LLM-judge couvre la lisibilité (dimension `readability`)
- A4-02 indique que la mesure de lisibilité est heuristique/subjective, pas algorithmique

**Résolution** : les deux ont raison — `readability.ts` produit un score Flesch-Kincaid **déterministe** injecté dans le SEO-score, ET le LLM-judge évalue subjectivement la lisibilité comme dimension complémentaire. Pas de contradiction réelle. La faiblesse = le Flesch FR (Kandel-Moles 1958) n'est pas normalisé contre le vocabulaire IA-specific.

### CONTRA-2 : A4-04 vs A4-07 sur le fact-checking
- A4-04 signale que le LLM-judge évalue `factual_accuracy` sans accès à la KB (jugement heuristique)
- A4-07 indique que les 7 dimensions sont bien présentes et structurées

**Résolution** : structurellement correct (7 dimensions présentes), mais `factual_accuracy` du LLM-judge ne vérifie pas les claims contre les sources externes — il évalue la plausibilité textuelle. Le vrai fact-checking post-publication via Perplexity est une couche séparée. Recommandation : documenter cette distinction dans le README du reviewer.

---

## 3. QUICK WINS (< 2h, impact multi-agents)

| Fix | Effort | Agents impactés | Gain score estimé |
|---|---|---|---|
| Fix regex `internalLinkCount` HTML vs Markdown | 30 min | A4-05, A4-07 | +8 pts |
| Fix mismatch slug `VERTICAL_TO_IMAGE_MODULE` | 1h | A4-08 | +8 pts |
| Ajouter instruction "keyword DOIT apparaître en H1" dans system prompts blog/landing | 45 min | A4-03, A4-07 | +8 pts |
| Injecter `AiContentDisclaimer` dans city-layout.tsx | 1h | A4-06, A4-01 | +6 pts |
| Passer `citationCount` à `computeSeoScore()` | 30 min | A4-05 | +5 pts |
| Activer `OPENAI_EMBEDDINGS_ENABLED=true` (staging d'abord) | 1h config | A4-02, A4-04 | +10 pts |
| Fix boucle improve : passer `issues[]` au re-prompt | 4h | A4-07, A4-02, A4-03 | +15 pts |

**Total quick wins : ~9h → +60 pts estimés** → passerait de 438 à ~498/800 (+14%)

---

## 4. DÉPENDANCES ENTRE CORRECTIFS

```
SYS-3 (boucle improve) doit être corrigé AVANT d'évaluer le taux REJECT réel
  └── car actuellement toutes les passes 2 sont identiques à passes 1 → biais résultats

SYS-1 (générateurs stub) doit être corrigé AVANT SYS-2 (activation embeddings)
  └── car activer les embeddings sur des générateurs qui produisent le mauvais type = coût sans valeur

SYS-5 (regex liens) doit être corrigé AVANT de re-calibrer les seuils A4-07
  └── car les seuils GO/IMPROVE actuels sont calibrés sur des scores erronés (liens = 0 systématique)

Quick wins peuvent être traités en parallèle entre eux (indépendants)
```

---

## 5. RÉSUMÉ DÉCISIONS WILL (Section 6 du prompt)

| Décision | Contexte résumé | Options | Urgence |
|---|---|---|---|
| D1 — Seuil LLM-judge | Seuil REJECT à 7.0 trop élevé, taux reject théorique ~30% | A: conserver / B: abaisser à 6.0 / C: abaisser à 5.5 | P1 |
| D2 — Itérations improve | Boucle cassée (SYS-3). D'abord fixer le bug, PUIS décider nb itérations | A: 2 iter après fix / B: 3 iter pilier+landing / C: 3 iter tous | P1 |
| D3 — Persona auteur E-E-A-T | Manon définie mais incohérence blog anonyme vs loader "Manon" | A: "Équipe Axion-IA" / B: persona par verticale / C: Will Jullin nommément | P1 |
| D4 — Wording AI Act disclaimer | Wording actuel conforme art. 50 mais mention modèle Claude absente | A: conserver / B: ajouter "Claude Sonnet 4.6" / C: opt-out training | P0 urgent (août 2026) |
| D5 — Rapport qualité hebdomadaire | `alertCampaignDone()` codée mais jamais appelée | A: email williamsjullin@gmail.com / B: dashboard seul / C: Telegram+dashboard | P2 |
| D6 — Priorité sprint correctif P4 | Score 438/800 = NO-GO, 7 P0 identifiés | A: sprint P4 immédiat / B: Phase B d'abord / C: P0 P4 en parallèle Phase B | **À décider maintenant** |
