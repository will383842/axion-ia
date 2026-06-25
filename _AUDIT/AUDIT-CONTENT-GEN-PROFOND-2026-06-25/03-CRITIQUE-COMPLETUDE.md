Deux contradictions inter-agents tranchées par le code :

1. **Seuil auto-pub = 75, PAS 60.** `QUALITY_LOOP_THRESHOLD_DEFAULT = 75` (ligne 104), et l'auto-pub utilise ce même `qualityThreshold` (ligne 899). L'agent qui affirmait « seuil générateur 60 vs auto-pub 75 » a raison sur le conflit ; les agents qui répétaient « auto-pub si score≥60 » se trompaient. **Sauf si la DB seed `minScoreThreshold` override** — c'est exactement le point à vérifier en prod (la valeur effective dépend de `ContentGenConfig.quality_loop` en base).

2. **Le citationCount bug est DÉJÀ corrigé** (ligne 622-625, correctif 2026-06-20 = `Math.max(citations, liens externes du body)`). L'agent qui listait « citationCount jamais incrémenté → intent hardFail systématique » comme root cause P0 active **se trompe** : le correctif est en place et committé. Cet agent a halluciné une cause déjà résolue.

J'ai assez de preuves. Voici mon verdict de complétude.

---

# CRITIQUE DE COMPLÉTUDE — Ce qui MANQUE avant toute décision

## A. AFFIRMATION CENTRALE NON VÉRIFIÉE EMPIRIQUEMENT (bloquant)

L'audit entier repose sur **une hypothèse jamais mesurée** : « le mono-appel JSON compresse bodyHtml à 400-600 mots ». C'est plausible et le code confirme l'architecture mono-appel — mais **personne n'a lu un seul `outputJsonRaw` réel** pour vérifier :

1. **Quel est le `tokensOutput` réel observé ?** Si gpt-4o renvoie 1800 tokens et le body fait 600 mots, c'est de la compression. **Si gpt-4o renvoie ~700 tokens output et s'arrête (`finish_reason: stop`)**, alors le problème n'est PAS le budget tokens (8000 non atteint) mais le modèle qui « décide » d'être court → la solution n'est pas l'architecture mais le prompt/le modèle. **Aucun agent n'a distingué ces deux cas.** Le calcul « ~5100 tokens disponibles donc le modèle compresse » est une **inférence, pas une mesure**. À faire : lire 5-10 `ContentGenJob.outputJsonRaw` récents + leurs `GenerationLog` (tokensOutput par pass).

2. **Le `finish_reason` n'est jamais inspecté.** Si les passes se terminent en `length` (troncature), c'est un vrai plafond tokens. Si `stop`, le modèle finit volontairement court. **C'est LA donnée qui tranche Option A (refonte 2-step) vs Option B (prompt).** `anthropic.ts:227-238` logge `stop_reason` mais on ne l'a jamais corrélé.

3. **Aucune mesure n'isole le provider.** L'agent provider recommande un A/B OpenAI vs Claude mais **personne n'a vérifié quel provider a réellement servi les 18 articles courts locaux**. Si c'est le fallback Claude (OpenAI down/cost-cap), le diagnostic change.

## B. CONTRADICTIONS INTER-AGENTS NON RÉSOLUES (je tranche, mais à confirmer en prod)

4. **Seuil auto-pub : 60 ou 75 ?** Le code dit `QUALITY_LOOP_THRESHOLD_DEFAULT = 75` (vérifié ligne 104) ET l'auto-pub l'utilise (ligne 899). Plusieurs analyses affirment « auto-pub à 60 ». **FAUX au niveau code-default.** MAIS la valeur effective = `ContentGenConfig.quality_loop.minScoreThreshold` lue en DB (seed dit 75 selon un agent). **À VÉRIFIER : la valeur réelle en prod DB.** Si elle est à 75, alors même un article de 1500 mots scoré 64 part en needs_review (boucle puis review) — **le problème n'est pas que la longueur, c'est le seuil**. Décision « 2 vs 3 passes » est secondaire face à ça.

5. **citationCount « jamais incrémenté »** : contredit par le code (ligne 622-625, correctif 2026-06-20 actif). L'analyse « needs_review » qui en fait une root cause P0 a **halluciné un bug déjà résolu**. Ne pas agir dessus.

6. **MIN_WORD_COUNT bloque-t-il ou non l'output ?** Un agent dit « pas de hard-fail, l'article court sort quand même » ; un autre dit « gate bloquant ». Le code (ligne 276-296) montre que ce n'est PAS un hard-fail : si budget/itérations épuisés, **l'article court est retourné tel quel** avec son `qualityScore`. Le `MIN_WORD_COUNT` n'empêche que le `break` anticipé, il ne rejette jamais. **Donc ajouter MIN_WORD_COUNT=1500 ne produit PAS d'articles longs — il garantit juste que la boucle tourne 3 fois puis abandonne.** Cette nuance est sous-estimée dans les recommandations.

## C. ANGLES MORTS — non couverts du tout

7. **quality-improver-worker** : cité partout comme « relance », **jamais audité**. Quand un job part en `quality_improving`, que fait CE worker exactement ? Re-génère-t-il avec le même mono-appel (donc même plafond) ? Passe-t-il `improvementFeedback` ? S'il réutilise le même générateur, **la boucle quality_improving est un no-op coûteux** (même architecture → même résultat court → needs_review). C'est un coût caché majeur non chiffré.

8. **Tests / régression** : les modifs non-committées touchent 7 fichiers + un nouveau helper `keyword-match.ts`. **Aucun agent n'a vérifié si les tests existants passent encore** ni si `keyword-match.ts` a des tests. Le registry test (`registry-phase8.spec.ts`) et les content-tests sont mentionnés mais leur état post-modif est inconnu. Risque : MIN_WORD_COUNT casse des fixtures de test attendant des articles courts.

9. **Impact prod du refactor 2-step (Option A/E)** : Le coût en **appels LLM ×9-13** a un effet non analysé sur :
   - Le **rate-limiter BullMQ** (`limiter 10/min` content-gen) — 12 sections séquentielles par article peuvent saturer.
   - Le **circuit breaker in-memory** (5 erreurs/30s) — plus d'appels = plus de surface de panne.
   - Le **keyword lock TTL 30min** — un 2-step long peut expirer le lock mid-génération (un agent l'a noté pour guide-pilier mais pas extrapolé au refactor blog).
   - La **latence par article** (×10) impacte le throughput de la file et le `lockDuration: 120s` du worker (risque de job repris comme stalled).

10. **Coût mensuel réel non fiable** : tous les chiffres ($48/mois, $260/mois) dérivent du même « ~$0.05/article » **non sourcé d'une mesure**. Le `CostLedger` existe (cost-tracker.ts) — **personne n'a requêté les coûts réels par contentType sur 30j**. Décision économique sur données inventées.

11. **Web Vitals du rendu long-form** : un agent affirme « 1500-2500 mots = 8-12 KB gz, safe ». **Non mesuré.** Mais surtout : l'audit du **rendu** signale une divergence wordCount critique (page render compte ~400-600 mots sur `view.body` seul, JSON-LD émet cette valeur sous-évaluée). **Question non posée : si les blocs AEO (FAQ/directAnswer/expertQuote) sont déjà comptés par site-inspector à 1500+, est-ce que le « problème de longueur » est partiellement un problème de MESURE ?** Le `MIN_WORD_COUNT` du générateur mesure `bodyText` seul (sans FAQ). Un article avec 600 mots de body + 8 FAQ denses + directAnswer peut faire 1400 mots rendus mais être rejeté à 600. **Cet angle réconcilie « courts » et « pas si courts » et n'est pas creusé.**

12. **Grounding réellement utilisé ?** Affirmation « KB context ~600 tokens pour 1500 mots = ratio 1:3 hallucination-prone » : inférence non vérifiée. **Personne n'a vérifié si les kbChunks retournés sont réellement cités dans le body généré** (un agent le note comme gap mais ne le mesure pas). Si le KB est ignoré, augmenter k de 8→12 ne sert à rien.

13. **Sécurité / injection** : le `templateOverride.systemPrompt` vient de la DB (éditable console admin). **Aucun audit du fait qu'un systemPrompt malveillant/cassé en DB pourrait dégrader silencieusement tous les articles.** Si quelqu'un a édité un template actif, c'est une cause alternative jamais considérée. **À vérifier : y a-t-il un `ContentTemplate` actif en prod qui override le prompt code ?**

14. **`blog-from-title` H1 gate bug** : un agent affirme que `blog-from-title.ts:200` utilise `includes(slice(0,30))` (fragile) alors que `blog-from-keywords` utilise `keywordPresentInText()`. **Non re-vérifié** — si vrai, blog-from-title a un bug de gate différent qui boucle inutilement. À confirmer par lecture directe.

## D. CE QU'IL FAUT VÉRIFIER AVANT TOUTE DÉCISION (checklist actionnable)

| # | Vérification | Tranche quoi |
|---|---|---|
| 1 | Lire 5-10 `outputJsonRaw` + `GenerationLog` récents : tokensOutput/pass + `finish_reason` | Compression réelle vs modèle court → Option A vs B |
| 2 | Requêter `ContentGenConfig.quality_loop.minScoreThreshold` en prod | Seuil effectif 60 ou 75 → la vraie cause needs_review |
| 3 | Requêter `CostLedger` GROUP BY contentType sur 30j | Données économiques réelles (pas inventées) |
| 4 | Auditer `content-quality-improver-worker.ts` | Boucle quality_improving = no-op coûteux ? |
| 5 | Vérifier si un `ContentTemplate` actif override le prompt en prod | Cause alternative silencieuse |
| 6 | Mesurer wordCount RENDU (body+FAQ+directAnswer) d'un article « court » | « Court » = réel ou artefact de mesure du gate ? |
| 7 | Lancer la suite de tests avec les modifs non-committées | Régression fixtures / keyword-match.ts non testé |
| 8 | Lire blog-from-title.ts:200 | Confirmer/infirmer le bug de gate divergent |
| 9 | Vérifier quel provider a servi les 18 articles courts locaux | Isoler variable OpenAI vs Claude fallback |
| 10 | Confirmer comportement rate-limiter/lock sur 2-step ×12 appels | Faisabilité prod Option A |

## E. RECOMMANDATION DE MÉTHODE

**Ne pas implémenter Option A/E (refonte 2-step, 3-4 j) avant la vérif #1 et #2.** Si #1 montre `finish_reason: stop` à 700 tokens (modèle court volontaire) ET #2 montre seuil=75, alors **la cause dominante de needs_review n'est pas l'architecture mono-appel mais (a) le seuil 75 trop haut et (b) un prompt qui n'oblige pas la longueur** — corrigeables en heures, pas en jours. L'audit a sur-investi sur l'élégante hypothèse architecturale et sous-investi sur les deux mesures triviales qui la valideraient ou la réfuteraient. Le risque est de dépenser 4 jours de refonte pour un problème qui se règle avec un seuil DB + 3 lignes de prompt.