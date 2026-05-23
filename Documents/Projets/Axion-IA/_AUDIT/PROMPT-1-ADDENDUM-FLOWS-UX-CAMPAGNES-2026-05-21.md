# 🔧 ADDENDUM PROMPT 1 — Flows par type + UX admin + Programmation campagnes

> **Fichier** : `_AUDIT/PROMPT-1-ADDENDUM-FLOWS-UX-CAMPAGNES-2026-05-21.md`
> **Parent** : `_AUDIT/PROMPT-1-AUDIT-EXISTANT-FORENSIQUE.md`
> **Date création** : 2026-05-21 (post-lancement P1 dans autre conversation)
> **Raison** : Will identifie 3 dimensions sous-couvertes par P1 v1.2. Cet addendum les explicite SANS modifier le P1 en cours d'exécution.
> **Durée** : 3-4h autopilot supplémentaires (3 mini-audits ciblés)
> **Comment l'utiliser** : à coller en fin de conversation P1 (avant le verdict final) OU à lancer en run séparée si P1 déjà terminé.

---

## 0. CONTEXTE & DOCTRINE

Le PROMPT-1-AUDIT-EXISTANT-FORENSIQUE.md (parent) audite 22 dimensions du système content-gen AxionIA. Cet addendum **ajoute 3 mini-audits ciblés** qui complètent :

1. **A02 enrichi — 7 flows distincts par type contenu** : tracer + auditer chaque variation (article_titre_manuel, article_keywords, longue_traine, comparatif, pilier, qr_auto, RSS)
2. **A12 enrichi — UX simplicité console admin** : user journeys + clicks count + heuristiques Nielsen/Norman + presets/bulk ops
3. **A13 enrichi — Programmation campagnes avancée** : cron scheduling, recurring, triggers événementiels, templates presets

**Doctrine identique au parent** :
- Mode AUDIT-ONLY strict
- 0 commit, 0 modification fichier prod
- Lecture seule sur le code
- Output dans `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-1/addendum/`
- Format standardisé (Mission / Méthode / Findings P0/P1/P2 / Score / Délégations / Références)

**Convergence parent** : si P1 parent a déjà livré les rapports A02, A12, A13 → cet addendum **complète** (ne réécrit pas) ces rapports. Producer 3 fichiers complémentaires :
- `addendum/A02-flows-by-type.md`
- `addendum/A12-ux-simplicite-admin.md`
- `addendum/A13-programmation-campagnes-avancee.md`

---

## 1. AGENT A02-ADDENDUM — 7 flows distincts par type contenu

### Mission
Auditer **explicitement** les variations de pipeline génération pour les 7 types de contenus canoniques. Identifier les étapes spécifiques, les coûts différentiels, les workers dédiés vs partagés, et les gaps actuels.

### Périmètre
- Services `src/server/content-gen/generators/*` (1 fichier par type contenu attendu)
- Workers BullMQ : 1 worker générique configurable OU 1 par type ?
- Schemas Zod par type (validation runtime)
- Snapshot tests Vitest par type
- Sample 1 article récent par type → mesure latence + cost réel

### Questions à investiguer (par flow type)

#### Flow `article_titre_manuel`

1. Will saisit un titre → quelle UI ? (Champ libre / suggestion auto-complete ?)
2. Étape skip sélection keyword : implémenté ? OU re-pick keyword + valider qu'il match le titre saisi ?
3. Extraction keyword principal depuis titre : helper NER FR (`fr_core_news_lg`) ou regex ?
4. Validation : si Will saisit titre **sans** keyword DB matché, on continue (Will assume) ou on refuse ?
5. Cost estimé observé /article : tracker existe ?
6. Cas d'usage Will : opportunité ad hoc (e.g. actualité métier) → ce flow doit être rapide (<3 min de la saisie au draft prêt) ?

#### Flow `article_keywords`

7. Flow standard. Lock SELECT FOR UPDATE sur Keyword pour atomicité ?
8. Algorithme priorité keyword : ordre alphabétique / score difficulty / lastUsedAt asc / random pondéré ?
9. Validation keyword-in-title runtime : enforce strict ou warning soft ?
10. Cost estimé observé : baseline du système.

#### Flow `longue_traine_intention`

11. Filtre keyword : `isLongTail=true` AND `intent IN (informational, transactional)` AND `searchVolume < N` AND `difficulty < M` ?
12. Génération titre orienté question (« Comment / Pourquoi / Combien / Quel ») : prompt dédié ou réutilisation prompt standard ?
13. Pattern AEO renforcé : abstract <300 chars early + speakable selector ciblé + h2 question directe + tableau synthèse + FAQ ≥10 ?
14. Différenciation vs article_keywords : observable dans code OU même pipeline avec config différente ?

#### Flow `comparatif`

15. Input source : Will saisit options à comparer (« ChatGPT vs Claude ») OU détection auto depuis keyword (« comparatif outils IA PME ») ?
16. Recherche infos chaque option : KB interne ? Web search via tools ? Crawl ?
17. Outline tableau comparatif : structure imposée (cols : option / pricing / features / pros / cons / verdict) ?
18. JSON-LD `ClaimReview` : présent pour chaque comparaison ?
19. Image par option comparée : assignment depuis image-bank tagged ?
20. Cost estimé /article (recherche multi-objets) : observable ?
21. Fact-check renforcé : pricing/features cités vérifiés vs sources externes officielles ?
22. Anti-bias éditorial : comparatif doit conclure objectivement (pas systématiquement « notre service est meilleur ») ?

#### Flow `pilier` (skyscraper)

23. Input topic cluster : Will définit ou auto-suggestion depuis gaps GSC ?
24. Outline étendu 10-15 h2 : généré 1-shot ou multi-shot ?
25. **Étape outline review humain** : workflow `pending_human_outline_review` existe ? Will reçoit notif (email/Slack) avec lien admin pour valider/éditer outline avant body ?
26. Si Will absent >24h, escalation ? Auto-approve avec watermark « auto-approved » ?
27. Body 3000-6000 mots : génération streaming (tokens live) ?
28. Table of contents auto : composant React `<TableOfContents>` qui parse h2 ?
29. Cost estimé /pilier : observable ? Justifié vs valeur long-term asset ?
30. Re-review humain post-body (avant publish) : optionnel ou obligatoire pour piliers ?

#### Flow `qr_auto_genere`

31. Crawl interne corpus AxionIA : helper qui parse articles publiés et extrait questions implicites ?
32. Extraction questions : depuis h2 ouvrant interrogatif + intro paragraph + FAQ existantes ?
33. Matching keyword associé à la question : algorithme ?
34. Génération réponse 600-800 mots : prompt dédié orienté AEO ?
35. Cross-link vers article source (`isBasedOn` JSON-LD + `<a rel="prev">`) : implémenté ?
36. **Anti-cannibalisation** : check que la nouvelle Q/R ne va pas voler le rank de l'article parent ? Mesure : cosine similarity Q/R vs parent < 0.7 ?
37. Cost estimé /article : recyclage donc faible cost ?
38. Cadence : combien de Q/R générées max par article parent ? 3 / 5 / illimité ?

#### Flow `article_rss`

39. RSS feed parser : lib `fast-xml-parser` (cf. Sprint S+4 P1) supporte RSS 2.0 + Atom 1.0 + RDF ?
40. Quels feeds actuellement parsés ? Liste DB `RssSource` (cf. Sprint S+5 P2).
41. Curation top N items : algorithme (score `freshness × relevance × source authority`) ?
42. Vérification originalité externe : Copyscape ou équivalent ?
43. Angle éditorial original : prompt instruit explicitement « notre prise sur X, pas paraphrase » ?
44. **Délai 48h après publication source** : enforced ? Anti-scrape Google signal.
45. JSON-LD `isBasedOn` cite source originale : implémenté ?
46. Cost estimé /article : observable ?
47. Failure modes : si feed RSS down / 404 / malformed → DLQ + retry ?

### Cross-flow metrics (pour TOUS les flows)

48. **Latence p50 / p95 / p99 par flow** : trace observable per flow ?
49. **Cost moyen Claude par flow** : tagging job metadata pour analyse Anthropic Console ?
50. **Success rate par flow** : nb publish / nb attempted ?
51. **Refusal reasons distribution par flow** : pilier rejet pour thin ? Comparatif rejet fact-check ? Tableau cross-tab.
52. **Réutilisabilité workers** : 1 worker par flow OU 1 worker générique avec config ? Recommandation architecture : générique paramétré.
53. **Tests Vitest par flow** : snapshot test 1 article par flow ?
54. **Documentation interne flows** : doc `_AUDIT/CONTENT-GEN-FLOWS.md` existe-t-elle ?

### Output

Fichier `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-1/addendum/A02-flows-by-type.md` avec :
- Tableau récap 7 flows × {existe ? / étapes spécifiques / cost / latence / success rate / tests}
- Top 10 P0 (flows manquants ou cassés)
- Top 15 P1 (variations à implémenter)
- Délégations P2 (architecture cible) + P5 (admin UX pour piloter chaque flow)

### Scoring `/35`
- 7 flows distincts existence + spec `/15`
- Métriques cross-flow (latence + cost + success rate par flow) `/8`
- Réutilisabilité workers `/4`
- Tests + doc `/4`
- Failure modes per-flow `/4`

---

## 2. AGENT A12-ADDENDUM — UX simplicité console admin

### Mission
Auditer la **simplicité d'utilisation** de la console admin. Will exigence explicite : « simple et pas complexe ». Mesurer objectivement clicks count, cognitive load, et appliquer heuristiques UX 2026.

### Périmètre
- Pages admin `/content-gen/**` (V2)
- User journeys actions clés
- Composants UI (formulaires, modales, tables, dashboards)
- Helpers UI (onboarding, tooltips, empty states)

### Questions à investiguer (≥20)

#### User journeys mesurés

1. **« Créer une campagne »** depuis dashboard root : combien de clicks ? Cible ≤8 (wizard 4 étapes). Si actuel = formulaire monolithique 30 champs → **P0 redesign UX**.
2. **« Lancer une campagne créée »** : 1 click cible. Confirmation modale OUI/NON première fois, pas suivantes.
3. **« Monitor campagne en cours »** : ≤2 clicks pour voir progression + funnel + cost burn rate.
4. **« Pauser campagne »** : 1 click + confirmation modale.
5. **« Modifier campagne en cours »** : modification mix / volume / cost cap autorisée. Verticale non modifiable post-création (sinon incohérence keywords).
6. **« Archiver / cloner campagne »** : 1 click chacun.
7. **« Voir détail 1 article généré »** : depuis dashboard root, combien de clicks ?
8. **« Re-générer 1 article »** : 1 click depuis détail article.
9. **« Forcer re-review article »** : 1 click.
10. **« Discard / kill 1 article »** : 2 clicks (anti-erreur destructive).

#### Heuristiques UX

11. **Hick's Law** : nb d'actions disponibles per écran ≤ 7 ? Si écran avec 15 boutons → cognitive overload.
12. **Fitts's Law** : boutons primaires ≥44×44 px, placés zones accessibles (bas droite mobile, top right desktop).
13. **Nielsen 10 heuristiques** : scoring `/10` chaque :
    - Visibilité statut (loading states, progress bars)
    - Correspondance monde réel (vocabulaire FR métier, pas jargon dev)
    - Contrôle utilisateur (undo, cancel partout)
    - Cohérence + standards (couleurs terracotta, pas surprises)
    - Prévention erreurs (warnings avant destructif)
    - Reconnaissance > rappel (presets visibles)
    - Flexibilité (shortcuts experts + simple débutants)
    - Esthétique minimaliste (whitespace)
    - Récupération erreurs (messages clairs)
    - Aide + doc (tooltips contextuels)
14. **Don Norman patterns** : visibilité / affordances / signifiers / mappings naturels / constraints / feedback.

#### One-click + presets + bulk ops

15. **Campaign templates presets** : existe-t-il (« PME audits standard 100/jour ») ? 1 click crée campagne pré-remplie. Si NON → P1.
16. **Bulk operations** : lancer 5 campagnes similaires variantes verticales en 1 batch ? Si NON → P2.
17. **Keyboard shortcuts mode expert** : `Cmd+K` palette commandes ?

#### Onboarding + empty states + erreur states

18. **Premier login** : tour guidé (Will skip, important si futur user externe) ? Sinon empty state CTA clair ?
19. **Liste vide « aucune campagne »** : CTA « Créer ma première campagne » bouton primaire ?
20. **Claude API down** : admin reste utilisable lecture seule + warning bannière jaune ?
21. **Campagne stuck** : action « Force unstuck » accessible 1 click + confirmation ?

#### Mobile + TTFV + tests Will

22. **Mobile UX** : Will check prod en déplacement → mobile dashboard fonctionnel ?
23. **Time to first value (TTFV)** : nouvel admin user, combien de temps avant publication 1er article ? Cible <15 min.
24. **Test Will réel** : Will chronomètre lui-même 1 campagne fictive création → métrique baseline.
25. **5-second test** : screenshot dashboard root → Will couvre 5 sec, debrief « qu'as-tu compris ? ». Si confusion → P0 simplification.
26. **System Usability Scale (SUS)** : questionnaire 10 questions → score `/100` → cible ≥80.

### Output

Fichier `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-1/addendum/A12-ux-simplicite-admin.md` avec :
- Tableau user journeys × clicks count × verdict
- Scoring Nielsen 10 heuristiques (`/100`)
- Liste écrans avec >7 actions (Hick violation)
- Recommandations P0/P1/P2 simplification
- Wireframes ASCII des 3 écrans les plus complexes actuellement → version simplifiée proposée
- Délégations P5 (Console Admin Ops perfection)

### Scoring `/30`
- User journeys clicks count mesurés `/10`
- Hick + Fitts + Nielsen + Don Norman `/8`
- One-click + presets + bulk ops `/4`
- Onboarding + empty + erreur + mobile + TTFV `/4`
- Test Will réel + 5-sec + SUS `/4`

---

## 3. AGENT A13-ADDENDUM — Programmation campagnes avancée

### Mission
Auditer le **scheduling avancé** des campagnes : cron daily/weekly/monthly, recurring vs one-shot, triggers événementiels, templates presets, bulk operations. Will exigence : « simple programmation depuis admin ».

### Périmètre
- Model `Campaign` Prisma (champs `schedule`, `cron`, `triggers`)
- Service `campaign-scheduler.ts`, `cron-runner.ts`
- BullMQ scheduled jobs / repeatable jobs
- UI admin programmation

### Questions à investiguer (≥15)

#### Cron scheduling

1. **Modèle `Campaign` a-t-il champ `cronExpression: String?`** ? Si NON → P1.
2. **Lib cron** : `node-cron` / `cronstrue` (humanize) / BullMQ repeatable jobs natifs ?
3. **Granularité** : minute / heure / jour / semaine / mois ?
4. **Patterns recommandés** :
   - Daily (e.g. `0 9 * * *` = 9h CET tous jours)
   - Weekdays only (`0 9 * * 1-5`)
   - Weekly (`0 9 * * 1` lundi 9h)
   - Monthly (`0 9 1 * *` 1er du mois 9h)
   - Custom
5. **UI saisie cron** : champ raw `* * * * *` (expert) + humanize « tous les jours à 9h » + dropdown patterns courants (preset) ?
6. **Validation cron** : lib `cron-parser` valide syntaxe runtime + preview prochaines 3 exécutions ?
7. **Timezone** : UTC ou Europe/Paris ? Si France-only, CET (été CEST handling) ?
8. **DST handling** : changement heure été/hiver, cron 9h reste 9h locale ?

#### Recurring vs one-shot

9. **Campaign type enum** : `oneShot | recurring | triggered` ?
10. **One-shot** : startDate + dailyTarget + auto-stop à totalTarget atteint ? Status `completed` final.
11. **Recurring** : daily run 50 articles, indefinite ou jusqu'à `endDate` ?
12. **Triggered** : déclenché par événement externe (e.g. nouveau RssSource update → run mini-campagne « digest hebdo ») ?

#### Auto-start / auto-stop conditions

13. **Auto-start** : campagne créée draft, démarre automatiquement à `scheduledStart: DateTime` ?
14. **Auto-stop conditions** : `endDate atteint` / `totalTarget atteint` / `costCap dépassé` / `qualityScore moyen drop >0.5pt`  / `manual pause` ?
15. **Resume after pause** : workflow pause → resume reprend là où s'était arrêté (lock sur job_id last processed) ?

#### Triggers événementiels

16. **Trigger types** :
    - `on_rss_new_item` : nouveau item dans RSS feed configuré → générer 1 article curation
    - `on_keyword_trend_spike` : keyword passe top trends (Google Trends API ?) → générer article opportuniste
    - `on_gsc_query_uncovered` : GSC query reçoit >100 impressions sans article AxionIA → générer article gap
    - `on_competitor_publish` : axionai.fr publie nouveau article → générer réponse rapide
    - `on_manual_event` : Will déclenche manuellement via webhook ou button
17. **Trigger UI** : configuration depuis admin (dropdown event + paramètres) ?
18. **Trigger rate limit** : max N triggers/jour pour éviter cascade incontrôlée ?

#### Templates presets (CRITIQUE Will simplicité)

19. **Campaign templates** : table `CampaignTemplate` avec presets pré-configurés ? Exemples :
    - « Domination PME audits standard 100/jour 30j »
    - « Recurring weekly Paris pilier 5/sem »
    - « One-shot trigger RSS curation daily »
    - « Burst launch comparatif top 20 outils IA »
20. **Création campagne depuis template** : 1 click → wizard pré-rempli → 2 clicks ajuster → 1 click lancer = **4 clicks total** ?
21. **Marketplace templates** : Will peut sauver ses propres templates pour réutilisation future ?

#### Bulk operations

22. **Bulk create campagnes** : créer 5 campagnes similaires (1 par verticale) en 1 batch wizard ?
23. **Bulk pause / resume** : sélectionner N campagnes table + action group ?
24. **Bulk delete archived** : nettoyer archive >90j en 1 action ?

#### Coexistence multi-campagnes parallèles

25. **Quotas Claude API partagés** : si 3 campagnes recurring tournent simultanément, comment cost cap global dispatché ? Round-robin pondéré priorité ?
26. **Locks keywords** : campagne A pick keyword X → campagne B ne peut pas (lock SELECT FOR UPDATE) ?
27. **Priorité campagnes** : champ `priority: Int (1-10)` ? Higher = first served ?
28. **Burst protection** : si 5 campagnes voudraient publier 200 articles same-day → cap journalier dur dispatché ?

#### UI admin programmation

29. **Vue calendrier campagnes** : drag-drop reschedule ?
30. **Timeline next 7d / 30d** : visualisation campagnes scheduled ?
31. **Notification next run** : « campagne X démarre dans 2h » badge admin ?

### Output

Fichier `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-1/addendum/A13-programmation-campagnes-avancee.md` avec :
- Tableau capabilities scheduling actuelles vs cible
- Top 10 P0 (cron + auto-start + recurring + templates)
- Top 15 P1 (triggers + bulk + UI calendrier)
- Wireframes ASCII UI programmation campagne
- Délégations P2 (data model Campaign extended) + P5 (UI programmation)

### Scoring `/30`
- Cron scheduling implémenté + validation + DST `/8`
- Recurring vs one-shot vs triggered (types) `/6`
- Auto-start / auto-stop conditions `/4`
- Triggers événementiels (5 types min) `/4`
- **Templates presets (CRITIQUE simplicité Will)** `/5`
- Bulk operations `/2`
- UI calendrier + timeline `/1`

---

## 4. SYNTHÈSE ADDENDUM — Score global complémentaire `/95`

| Agent | Score `/poids` | Statut |
|---|---|---|
| A02-Addendum Flows par type | XX/35 | 🟢/🟡/🟠/🔴 |
| A12-Addendum UX simplicité | XX/30 | ... |
| A13-Addendum Programmation campagnes | XX/30 | ... |
| **TOTAL Addendum** | **XX/95** | **Verdict** |

### Intégration avec score parent P1

Le score parent P1 (`/1000`) + score addendum (`/95`) = **score étendu P1 `/1095`** normalisé en `/1000` pour cohérence avec le scoring global Master `/5000`.

Recommandation : repondérer A02/A12/A13 dans parent P1 vers les valeurs reflétées par addendum (A02=45→55, A12=45→55, A13=45→55, somme parent passe de 1000 à 1030 normalisée), OU traiter addendum comme bonus complémentaire `/95` qui s'additionne à P1 `/1000` → P1+addendum `/1095` → normalisé `/1000`.

**Choix techniquement le plus propre** : addendum complémentaire `/95` reporté dans la synthèse P1 finale, sans repondération du scoring parent (le scoring parent reste tel quel, mais le PHASE-1-VERDICT.md mentionne le bonus addendum).

---

## 5. STOP & ASK Will — Addendum (3 décisions supplémentaires)

À la fin du mini-audit addendum, Master propose à Will :

- **D-Add-1** — Flow `pilier` : étape outline review humain obligatoire ou skippable si quality score outline ≥9.0 ?
- **D-Add-2** — UX wizard campagne : 4 étapes (recommandé) ou 1 page monolithique optimisée (1 seul scroll) ?
- **D-Add-3** — Templates presets initiaux : combien à seeder en P0 ? Liste recommandée :
  1. PME audits standard 100/jour 30j
  2. PME interventions_formations recurring weekly 5/sem
  3. TPE audits one-shot 50 articles 14j
  4. ETI implementations pilier monthly 2/mois
  5. Cities domination Paris top 20 keywords burst
  6. RSS curation daily 10/jour

---

## 6. DÉCLENCHEMENT — Comment lancer cet addendum

### Si P1 parent encore en cours

Coller en fin de la conversation P1 actuelle (avant le verdict final) :

> En complément du P1 que tu finis, lance aussi `_AUDIT/PROMPT-1-ADDENDUM-FLOWS-UX-CAMPAGNES-2026-05-21.md` qui contient 3 mini-audits ciblés (A02-Add flows par type, A12-Add UX simplicité, A13-Add programmation campagnes avancée). Spawn 3 sous-agents supplémentaires en parallèle. Output dans `phase-1/addendum/`. Intègre les scores dans PHASE-1-VERDICT.md. Estimation 3-4h.

### Si P1 parent déjà terminé

Lancer en run séparée dans une nouvelle conversation :

> Lance `_AUDIT/PROMPT-1-ADDENDUM-FLOWS-UX-CAMPAGNES-2026-05-21.md`. Mode AUDIT-ONLY strict. Spawn 3 sous-agents en parallèle. Estimation 3-4h. Pré-requis : avoir lu PHASE-1-VERDICT.md du parent pour contextualiser. Output `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-1/addendum/`. Termine par mise à jour PHASE-1-VERDICT.md avec score addendum complémentaire `/95`.

---

## 7. DÉLÉGATIONS DOWNSTREAM (P2-P6)

Les findings addendum alimentent les phases suivantes :

- **→ P2 Architecture** : data model Campaign étendu (cronExpression + triggers + templates) + workers par flow + ScheduledRun
- **→ P3 SEO/AEO/GEO** : pattern AEO renforcé pour longue_traine_intention + comparatif ClaimReview
- **→ P4 Editorial Quality** : doctrines par flow (pilier review humain, qr_auto anti-cannibalisation, RSS valeur ajoutée 48h délai)
- **→ P5 Console Admin Ops** : wireframes admin wizard 4 étapes + UI calendrier + presets seedés + bulk ops
- **→ P6 Roadmap** : items P0/P1 prioritaires intégrés au plan chiffré

---

*Fin de l'addendum. P1 parent reste inchangé. Will copie le déclenchement §6 quand prêt.*
