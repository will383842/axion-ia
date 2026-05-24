# A4-07 : LLM-as-Judge Calibration
## Score : 56/80

**Date** : 2026-05-21  
**Agent** : Claude Sonnet 4.6 (audit-only, zéro modification)  
**Fichiers audités** :
- `axionia/src/server/content-gen/reviewer/llm-judge.ts` (fichier principal)
- `axionia/src/server/content-gen/reviewer/__tests__/llm-judge.spec.ts`
- `axionia/src/server/queue/workers/content-quality-improver-worker.ts`
- `axionia/src/server/queue/workers/content-gen-worker.ts`
- `axionia/src/server/content-gen/shared/generation-log.ts`
- `axionia/prisma/schema.prisma` (tables ContentGenJob, Article, GenerationLog)
- `axionia/src/app/.../content-gen/quality/_v2/QualityV2.tsx`

---

## Architecture du reviewer

### Modèle et configuration

Le reviewer utilise **Claude Sonnet 4.6** (`claude-sonnet-4-6`) — identique au générateur. La constante est :

```typescript
export const JUDGE_MODEL = "claude-sonnet-4-6" as const;
```

Température : **0.2** (non 0). Un écart par rapport au recommandé 0.0 pour un reviewer de cohérence maximale (voir section Recommandations).

### Les 7 dimensions (rubric)

Les 7 dimensions sont toutes présentes dans le prompt système :

| # | Dimension code | Libellé prompt | Focus |
|---|---|---|---|
| 1 | `factual_accuracy` | Affirmations chiffrées défendables ? Citations réelles ? RGPD/AI Act ? | Fiabilité factuelle |
| 2 | `depth` | Va au-delà des généralités ? Exemples concrets, étapes précises, cas terrain ? | Profondeur |
| 3 | `originality` | Pas du copy-paste ChatGPT ? Point de vue cabinet IA distinct ? | Originalité |
| 4 | `readability` | Phrases courtes, structure h2/h3, paragraphes < 4 lignes, jargon expliqué ? | Lisibilité |
| 5 | `seo_completeness` | title ≤ 60 chars, meta 140-160, keyword h1+2h2, FAQ longue traîne ? | SEO structurel |
| 6 | `value_to_reader` | Le lecteur PME/ETI repart avec actions concrètes ? | Valeur pratique |
| 7 | `tone_axionia_alignment` | Ton consultatif sans sur-promesses, cabinet opérationnel pas usine | Alignement brand |

**Verdict** : Les 7 dimensions correspondent globalement au périmètre annoncé. MAIS le mapping entre le brief du périmètre de l'audit et les dimensions réelles présente des **divergences importantes** (voir Tableau des écarts section suivante).

### Correspondance dimensions demandées vs implémentées

| Dimension demandée dans le brief | Dimension implémentée | Verdict |
|---|---|---|
| Originalité | `originality` ✅ | OK |
| Pertinence keyword | `seo_completeness` (partiel) | GAP — keyword vérifié dans titre/h2 mais pas corps |
| Lisibilité | `readability` ✅ | OK |
| Densité liens | Absent | **MANQUANT** — aucune dimension dédiée |
| Brand voice | `tone_axionia_alignment` ✅ | OK |
| AI Act disclaimer | `factual_accuracy` (partiel) | GAP — mentionné mais pas dimension dédiée |
| Longueur | Absent | **MANQUANT** — aucune dimension dédiée |

**2 dimensions du brief sont absentes** du reviewer : `densité liens` et `longueur`. Elles sont évaluées par d'autres modules en amont (SEO score deterministe côté `quality/seo-score.ts`) mais pas par le LLM-judge lui-même.

### Poids des dimensions

**Aucun poids relatif explicite.** Le score global est calculé comme **moyenne arithmétique simple** des 7 dimensions :

```typescript
const sum = DIMENSION_KEYS.reduce((s, k) => s + dimensions[k].score, 0);
const globalScore = Math.round((sum / DIMENSION_KEYS.length) * 10) / 10;
```

C'est une décision de design volontaire (anti-hallucination : le LLM ne peut pas truquer le score global en trichant sur une dimension pondérée). **Mais** l'égalité de poids pose un problème de calibration : `tone_axionia_alignment` pèse autant que `factual_accuracy` alors que l'impact SEO/légal est très différent.

### Prompt du reviewer (extrait exact)

```
Tu es un editeur senior B2B specialise dans le contenu IA conformite (RGPD, AI Act, Google HCU).
Tu evalues des articles generes pour le site axion-ia.com (cabinet IA operationnel : interventions,
audits, implementations, coaching 1-to-1, sites-web augmentes).

Ton job : noter l'article sur 7 dimensions (0-10 chacune) et donner un verdict ferme 
(publish / improve / reject). Tu ne diluies pas tes scores. Un score de 7 est correct 
mais perfectible. Un 9+ est exceptionnel.
```

Le prompt contient une **instruction anti-complaisance explicite** : *"Tu ne diluies pas tes scores"*. C'est une bonne pratique. L'ancrage "Un 9+ est exceptionnel" est aussi un signal fort pour éviter l'inflation des scores.

### Format de sortie

JSON brut demandé (pas de markdown). Structure :
```json
{
  "verdict": "publish" | "improve" | "reject",
  "globalScore": number,
  "dimensions": { "factualAccuracy": { "score": number, "comment": "string" }, ... },
  "issues": [{ "severity": "P0|P1|P2", "section": "...", "issue": "...", "suggestedFix": "..." }],
  "reasoning": "1-3 phrases"
}
```

**Anti-hallucination fort** : le verdict LLM est ignoré et recalculé déterministiquement depuis `globalScore + issues`. Test présent (`"ignores LLM-provided verdict"`).

---

## Seuils GO/IMPROVE/REJECT

### Tableau des seuils

| Verdict | Condition seuil actuel | Seuil recommandé | Verdict audit |
|---|---|---|---|
| **publish** | globalScore ≥ 8.5 ET 0 P0/P1 | ≥ 7.5 (standard) ou ≥ 8.5 (premium B2B) | Seuil élevé mais cohérent B2B |
| **improve** | globalScore 7.0-8.49 OU ≥ 1 P1 | 5.0-7.5 | Zone improve trop étroite (seulement 1.5 pts) |
| **reject** | globalScore < 7.0 OU ≥ 1 P0 | < 5.0 (seuil standard) | Seuil TROP ÉLEVÉ — risque rejet excessif |

### Analyse critique des seuils

**Seuil PUBLISH ≥ 8.5** : Strict. Sur une moyenne de 7 dimensions notées 0-10 par un LLM, atteindre 8.5 nécessite une performance homogène ≥ 8 sur toutes les dimensions. Cohérent avec l'exigence premium B2B axion-ia.com. Risque : si le LLM est calibré "généreux" (inflation scores), 8.5 peut être trivial à atteindre.

**Seuil REJECT < 7.0** : C'est le point critique. Un seuil de rejet à 7/10 signifie que tout article "correct" (7 = correct mais perfectible selon le prompt) est rejeté ou amélioré. La zone "improve" est [7.0, 8.5[ soit **1.5 pts** seulement, très étroite. En pratique :
- Score moyen 7/10 → verdict "improve" (même si l'article est publiable sur un blog moyen)
- Score moyen 6.9/10 → verdict "reject" (un seul article légèrement faible fait passer en dessous)
- Le seuil de 7.0 est **trop élevé** pour un `reject` en contexte factory (500 art/jour) : il va créer une accumulation anormale de `needs_review`

**Calcul du taux de reject théorique** : Si l'on suppose une distribution normale des scores LLM centrée sur 7.5 (σ=1.0), environ 30% des articles tomberont sous 7.0 → taux de reject 30%. Avec le fallback `judge?.verdict ?? "improve"` quand le juge échoue (API timeout, JSON invalide), les jobs ignorent le reject et passent en `needs_review`. Ce fallback `"improve"` par défaut est un **risque qualité silencieux**.

### Boucle improve : maxAttemptsAuto = 2

Configuré via `ContentGenConfig.quality_loop.maxAttemptsAuto`, défaut 2. Valeur DB-managed donc modifiable en runtime.

**Comportement de la boucle** (analysé dans `content-quality-improver-worker.ts`) :

```
Itération 1 :
  → reviewArticle() → verdict=improve → re-queue "quality_improving" (si attempts < 2)
Itération 2 :
  → reviewArticle() → quel que soit le verdict → needs_review (car reachedCap=true)
```

**Problème critique** : à la 2e itération, même un verdict "reject" bascule en `needs_review` :
```typescript
const nextStatus = verdict === "improve" && !reachedCap ? "quality_improving" : "needs_review";
```
Les verdicts "publish" et "reject" sont traités identiquement → **le "reject" est silencieusement absorbé après la 2e itération**. Un article avec P0 issue (ex : SIREN hardcodé) après 2 itérations atterrit en `needs_review` sans escalade distincte.

**Deuxième problème** : la boucle improve actuelle est **sans re-prompt** (V1 skeleton). Le worker appelle `reviewArticle()` sur le même `outputJsonRaw` que le premier passage, sans modification du contenu. Il re-évalue donc un article identique deux fois :
- Si verdict=improve iter 1 → re-queue → iter 2 → même contenu → résultat quasi-identique → needs_review
- La boucle ne fait pas ce qu'elle promet (améliorer le contenu)

---

## Logs historiques

### Disponibilité des logs

La table `GenerationLog` (schéma Prisma ligne 2988) stocke tous les steps de pipeline dont `quality_loop_pass`. Le log contient :

```typescript
// Extrait content-quality-improver-worker.ts ligne 210-224
await logStep(contentGenJobId, "quality_loop_pass",
  `Judge verdict=${verdict} globalScore=${judge?.globalScore} ...`,
  {
    verdict: judge.verdict,
    global_score: judge.globalScore,
    dimensions: judge.dimensions,
    issues_count: judge.issues.length,
    p0_issues: judge.issues.filter((i) => i.severity === "P0").length,
    previous_score: previousScore,
  }
);
```

**Données disponibles en DB** : verdict (publish/improve/reject), globalScore, dimensions complètes, issues_count, p0_issues count, previous_score.

**Requête SQL pour calculer le taux GO/IMPROVE/REJECT** :
```sql
SELECT
  metadata->>'verdict' as verdict,
  COUNT(*) as total,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) as pct
FROM generation_logs
WHERE step = 'quality_loop_pass'
  AND timestamp > NOW() - INTERVAL '30 days'
GROUP BY metadata->>'verdict'
ORDER BY total DESC;
```

### Absence d'interface de monitoring des verdicts

**Le dashboard Quality (`QualityV2.tsx`)** affiche `avgEditorial` (moyenne des scores 0-100 des articles publiés) mais **ne montre pas** :
- La distribution des verdicts (publish/improve/reject)
- Le taux de P0/P1 issues par dimension
- L'évolution du taux de reject dans le temps
- Le comparatif score avant/après boucle improve

**C'est le gap d'observabilité principal** : il est impossible de détecter un reviewer trop permissif (inflation scores) ou trop strict (accumulation rejects) sans requête SQL manuelle.

### Taux GO/IMPROVE/REJECT (estimation théorique)

Aucune donnée historique disponible (feature B.8 livrée 2026-05-21, pipeline non encore en production à grande échelle). Estimation basée sur la calibration des seuils :

| Scénario | Taux publish | Taux improve | Taux reject | Risque |
|---|---|---|---|---|
| Reviewer calibré (seuils actuels) | ~35-40% | ~30-35% | ~25-30% | Trop de rejects si LLM sévère |
| Reviewer permissif (inflation +1pt) | ~60-70% | ~20-25% | ~5-10% | Qualité dégradée en publication |
| Reviewer strict (déflation -1pt) | ~15-20% | ~35-40% | ~40-50% | Coût ×3, queue surchargée |

Seuil de santé recommandé : taux reject 10-20%, taux publish 40-60%, taux improve 25-35%.

---

## Détection complaisance

### Mécanismes anti-complaisance présents

**Forces :**
1. **Instruction explicite** dans le prompt : *"Tu ne diluies pas tes scores. Un score de 7 est correct mais perfectible."* — bonne ancre calibration.
2. **Anti-hallucination verdict** : le verdict LLM est systématiquement recalculé depuis les scores (non accepté tel quel). Test de régression `"ignores LLM-provided verdict"` présent.
3. **Clamp scores** : scores hors [0, 10] ramenés dans la plage.
4. **Strip fences** : le JSON avec markdown fences est nettoyé.
5. **Modèle distinct** : Claude Sonnet 4.6 reviewer vs Claude Sonnet 4.6 générateur — même modèle mais invocation distincte. Note : un vrai modèle distinct (ex: Claude Haiku pour reviewer) réduirait le biais self-judge mais augmenterait les coûts.

### Risques de complaisance identifiés

**Risque 1 — Biais self-judge (non résolu) [P1]** : Le reviewer est le même modèle que le générateur (Claude Sonnet 4.6 dans les deux cas). Le reviewer peut inconsciemment sur-noter un contenu qu'il aurait lui-même généré ("ce texte me semble bon car il ressemble à ce que je produirais"). Mitigation partielle par le prompt role ("editeur senior... tu ne diluies pas").

**Risque 2 — Fallback "improve" silencieux [P1]** : Quand `reviewArticle()` lance une exception (timeout API, JSON invalide), le worker fait `judge?.verdict ?? "improve"`. Un article qui a causé une erreur est traité comme `improve` au lieu de `reject`. Si l'erreur est systématique sur un type de contenu, tous ces articles passent en `needs_review` sans signal P0.

**Risque 3 — Sans données historiques, impossible de détecter dérive [P0]** : Si dans 1 mois 95% des articles reçoivent `publish`, il n'y a pas d'alerte automatique. Le reviewer pourrait s'être "dérèglé" (variation comportementale Claude API) sans que le système le détecte.

**Risque 4 — Température 0.2 non déterministe [P2]** : Pour un reviewer de qualité, la température recommandée est 0.0 (sortie déterministe pour le même article). À 0.2, le même article peut recevoir des scores légèrement différents à chaque évaluation (non-reproductibilité).

**Risque 5 — Originalité non mesurable par LLM seul [P2]** : La dimension `originality` demande au LLM de détecter "pas du copy-paste ChatGPT". Or le modèle n'a pas accès au corpus réel des articles publiés ni à des outils de détection plagiat externa. L'évaluation est subjective, pas comparative.

---

## Dimension-level analysis

### Analyse par dimension

| Dimension | Méthode de mesure | Qualité mesure | Observations |
|---|---|---|---|
| `factualAccuracy` | LLM apprécie si affirmations "défendables" + RGPD/AI Act | Subjective | Pas de fact-check externe. Le LLM ne peut pas vérifier des chiffres ISO. Risque hallucination inverse |
| `depth` | LLM apprécie si au-delà des généralités | Subjective | Difficilement calibrable — "généralité" dépend du contexte secteur |
| `originality` | LLM apprécie si "pas ChatGPT générique" | Faible | Pas de comparaison corpus. Biais évident self-judge |
| `readability` | LLM apprécie structure h2/h3, phrases courtes | Correcte | Redondant avec `computeReadabilityFr()` déterministe déjà en amont — double évaluation |
| `seoCompleteness` | LLM vérifie title ≤ 60, meta 140-160, keyword h1+2h2, FAQ | Partielle | title/meta longueurs sont vérifiables deterministe. Keyword dans H1 oui mais dans corps non. Pas de densité liens |
| `valueToReader` | LLM apprécie si "actions concrètes pour PME/ETI" | Subjective | La plus subjective des 7. Dépend beaucoup de la calibration du modèle |
| `toneAxioniaAlignment` | LLM apprécie ton consultatif, pas "magique/révolutionnaire" | Correcte | Rubric précis avec mots interdits. Plus calibrable que d'autres |

### Critères mesurables vs subjectifs

- **Mesurables deterministe** (mais délégués au LLM) : `seoCompleteness` (longueurs, keyword presence), `readability` (structure HTML)
- **Subjectifs LLM nécessaires** : `factualAccuracy`, `depth`, `originality`, `valueToReader`, `toneAxioniaAlignment`

**Recommandation** : séparer les critères déterministes (déjà calculés par `computeSeoScore()`) du LLM. Le LLM-judge devrait se concentrer sur les 5 dimensions purement qualitatives.

---

## Recommandations calibration

### P0 — Critique (bloquer ou corriger avant scale)

**P0-1 : Absence d'observabilité verdicts (aucune alerte si 100% GO)**
- **Risque** : Dérive permissive non détectée sur des centaines d'articles
- **Fix** : Ajouter une query admin dans `QualityV2.tsx` pour afficher la distribution des verdicts sur 30j depuis `GenerationLog` (step='quality_loop_pass', metadata->>'verdict')
- **Alerte seuil** : Si taux `publish` > 80% sur 7j → Telegram alert Will

**P0-2 : Boucle improve sans re-prompt = re-évaluation article identique**
- **Risque** : Le worker quality-improver V1 appelle `reviewArticle()` sur le même `outputJsonRaw` sans modification → verdict identique garanti → inutile
- **Fix V2** : Implémenter le re-prompt ciblé (`judge.issues` → system prompt enrichi avec les P1 sections à améliorer → nouveau `generate()` → nouveau `reviewArticle()`)
- **Priorité** : Bloquant pour que la boucle ait une valeur réelle

**P0-3 : Reject silencieux après cap (reject → needs_review sans distinction)**
- **Risque** : Article avec P0 issue (SIREN, AI Act) après 2 itérations atterrit silencieusement en needs_review sans flag d'escalade
- **Fix** : Dans le worker, si `verdict === "reject"`, bascule un status distinct (`rejected` ou `failed`) et logge les P0 issues avec niveau `error`

### P1 — Important (corriger dans sprint suivant)

**P1-1 : Température reviewer 0.2 → recommandé 0.0**
- Changer `temperature: 0.2` → `temperature: 0.0` dans `reviewArticle()`
- Impact : cohérence parfaite pour le même article évalué deux fois
- Coût : nul (changement 1 ligne)
- Fichier : `axionia/src/server/content-gen/reviewer/llm-judge.ts` ligne 284

**P1-2 : Seuil REJECT 7.0 trop élevé pour factory scale**
- Seuil actuel : `IMPROVE_MIN: 7.0` → reject si < 7.0
- Recommandé pour scale 500 art/jour : `IMPROVE_MIN: 6.0` (zone improve étendue à [6.0, 8.5[)
- Ou mieux : `DB-managed` via `ContentGenConfig.editorial_review` (déjà mentionné dans le JSDoc mais non implémenté)
- Impact : réduction du taux de reject de ~30% estimé à ~15%

**P1-3 : Fallback "improve" sur exception API reviewer**
- Code actuel : `judge?.verdict ?? "improve"` — un article qui cause une erreur API est traité comme "improve"
- Recommandé : distinguer `judge_failed` (erreur technique) de `improve` (verdict qualité). Logger le judge_failed avec `level: "error"` et bascule `needs_review` distinct
- Filtre admin possible sur jobs avec `judge_skipped: true` dans metadata

**P1-4 : 2 dimensions du brief absentes (densité liens + longueur)**
- `densité liens` : évaluée par `computeSeoScore()` mais pas par le LLM-judge → incohérence avec le brief périmètre
- `longueur` : idem, calculée deterministe (wordCount readability) mais absente du judge
- Options : (A) ajouter ces dimensions au rubric LLM, (B) documenter explicitement qu'elles sont couvertes par le score SEO déterministe et non par le LLM-judge

**P1-5 : Self-judge bias (même modèle générateur/reviewer)**
- Option A : Changer le reviewer model vers `claude-haiku-4-5` (moins cher, perspective différente, ~$0.005 vs $0.05)
- Option B : Garder Sonnet mais ajouter dans le prompt : *"Tu n'as pas généré cet article. Tu es un éditeur externe."*
- Option C (implémentée partiellement) : Le JSDoc mentionne "distinct du generator pour eviter self-judge bias" mais le modèle est identique

### P2 — Amélioration (backlog)

**P2-1 : Poids relatifs par dimension**
- Proposition : `factualAccuracy×1.5 + depth×1.2 + toneAxioniaAlignment×1.2 + readability×0.8 + seoCompleteness×0.8 + originality×0.8 + valueToReader×0.7`
- Normaliser la somme à 7 pour maintenir l'échelle 0-10
- Avantage : erreur factuelle pèse davantage qu'un titre légèrement trop long

**P2-2 : Tests de calibration sur articles fictifs**
- Actuellement 11 tests dans `llm-judge.spec.ts` mais tous testent le parsing/dérivation, zéro test de calibration réelle
- Ajouter 3 snapshots de `parseJudgeResponse` avec articles réels annotés "bon/moyen/mauvais"

**P2-3 : Instructions improve ciblées par dimension sous-performante**
- Quand `verdict=improve`, les issues P1 sont loggées mais le re-prompt (quand V2 sera implémenté) devrait utiliser `judge.issues` pour construire un prompt ciblé : *"Revoir section X car Y. Améliorer structure readability car score 6/10."*

---

## Jeu de tests de calibration (3 articles fictifs)

### Article A — Bon (attendu : publish)

```
Title: "Audit IA RGPD pour PME françaises : méthode en 5 étapes et budget chiffré 2026"
Meta: "Découvrez la méthode Axion-IA pour auditer votre conformité IA RGPD en 5 étapes : 
       cartographie des modèles, DPA fournisseurs, AI Act art. 50, plan correctif chiffré 
       dès 490 € HT. 47 PME auditées depuis 2024."
Body: 1200 mots, 3 h2, 5 h3, 4 liens internes, 3 citations CNIL/EDPB, disclaimer AI Act présent
FAQ: 6 questions longue traîne
```
Score attendu : factualAccuracy 8.5, depth 8.5, originality 7.5, readability 8.5, 
seoCompleteness 9, valueToReader 8.5, toneAxioniaAlignment 9 → globalScore ~8.6 → PUBLISH

### Article B — Moyen (attendu : improve)

```
Title: "L'IA pour votre entreprise"
Meta: "L'intelligence artificielle peut aider votre entreprise à être plus efficace."
Body: 600 mots génériques, 1 h2 seulement, 0 lien interne, pas de chiffres, 
      pas de disclaimer AI Act
FAQ: 2 questions génériques
```
Score attendu : factualAccuracy 6, depth 5.5, originality 5, readability 7, 
seoCompleteness 5, valueToReader 5.5, toneAxioniaAlignment 7 → globalScore ~5.9 → REJECT
(Note : cet article illustre le problème du seuil reject à 7.0 — il serait rejeté alors 
qu'un re-prompt ciblé pourrait l'améliorer vers 7.5)

### Article C — Mauvais (attendu : reject)

```
Title: "Formation IA magique révolutionnaire ! SIREN: 123456789"
Body: 300 mots. "Notre IA révolutionnaire va transformer magiquement votre business. 
      Inscrivez-vous à notre formation certifiée N° Datadock 123-456. Résultats garantis 
      à 200% ou remboursé." Aucune structure. Pas de FAQ. Pas de disclaimer.
```
Score attendu : factualAccuracy 2 (P0 SIREN+claims), depth 2, originality 3, 
readability 4, seoCompleteness 2, valueToReader 2, toneAxioniaAlignment 1 → globalScore ~2.3 
+ P0 issues → REJECT ✅

---

## Résumé des scores par section

| Section | Score obtenu | Score max | Commentaire |
|---|---|---|---|
| Lecture du reviewer — Architecture | 20/25 | 25 | 7 dim présentes ✅, poids absents ⚠️, prompt précis ✅, JSON structuré ✅, température 0.2 non-0 ⚠️ |
| Calibration des seuils | 15/25 | 25 | PUBLISH 8.5 cohérent ✅, REJECT 7.0 trop élevé ⚠️, boucle sans re-prompt P0 ❌, fallback "improve" risqué ⚠️ |
| Détection complaisance | 14/20 | 20 | Anti-hallucination verdict ✅, instruction anti-dilution ✅, pas d'alerte drift ❌, self-judge bias non résolu ⚠️, historique non queryable depuis admin ⚠️ |
| Dimension-level analysis | 7/10 | 10 | 5/7 dim analysables ✅, 2 dim brief absentes (liens, longueur) ⚠️, originalité non comparable corpus ⚠️ |
| **TOTAL** | **56/80** | **80** | |

---

## Verdict global

**Le LLM-judge est architecturalement solide** (anti-hallucination, prompt précis, 7 dimensions, JSON structuré, tests de dérivation) mais présente **3 défauts fonctionnels bloquants** pour une utilisation en production à grande échelle :

1. **Boucle improve V1 = re-évaluation sans amélioration** (P0) — la boucle ne re-prompte pas le générateur, elle rejoue le reviewer sur le même contenu. Valeur nulle.
2. **Absence d'observabilité taux verdicts** (P0) — impossible de détecter dérive reviewer sans SQL manuel.
3. **Reject silencieux après cap** (P0) — articles P0 (AI Act violation) absorbés dans needs_review après 2 itérations, sans escalade distincte.

**Score 56/80** — Implémentation correcte du reviewer, calibration des seuils à ajuster, boucle improve à compléter en V2.
