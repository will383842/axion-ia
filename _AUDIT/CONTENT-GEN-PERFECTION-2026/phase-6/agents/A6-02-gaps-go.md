# A6-02 — TOP 30 GAPS : Chemin vers GO 4500/5000

## Agent : A6-02 (Gaps & ROI analysis)

## Date : 2026-05-22

## HEAD local : 7236dfd0 | origin/main : e573da6

---

## 0. Rappel du score de départ (source : A6-01)

| Dimension     | Score actuel  | Max  | Potentiel résiduel |
| ------------- | ------------- | ---- | ------------------ |
| D-Etat (P1.5) | 822/1000      | 1000 | 178 pts            |
| D-Archi (P2)  | 816/1000      | 1000 | 184 pts            |
| D-Visi (P3)   | 778/1000      | 1000 | 222 pts            |
| D-Qual (P4)   | 770/1000      | 1000 | 230 pts            |
| D-Ops (P5)    | 619/1000      | 1000 | 381 pts            |
| **TOTAL**     | **3805/5000** | 5000 | **1195 pts**       |

**Gap vers GO ≥ 4500 : 695 pts**

> Note : le score de départ de la mission est 3715/5000 (estimé dans le brief P6). A6-01 a
> recalibré le score réel à 3805/5000 en intégrant les commits locaux non pushés. Ce rapport
> utilise 3805 comme baseline honnête — le gap réel est donc 695 pts (non 785 pts).

---

## 1. TOP 30 items — Tableau trié par ROI (gain pts / heure effort)

> **Méthode ROI** : gain_pts / effort_h. Un item à 20 pts / 1h = ROI 20.0. Un item à 30 pts / 10h = ROI 3.0.
> Pour les items "Will only" (actions humaines hors code), effort = 0.5h (démarche admin).
> Les gains sont conservateurs (−20 % si dépendance externe ou incertitude prod).

| #   | Item                                                                                                                                                           | Dimension | Gain pts | Effort h | ROI  | Dépendances                                                                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | -------- | -------- | ---- | --------------------------------------------------------------------------------------- |
| 1   | **Validation SMTP prod weekly-report** (env var `SMTP_*` Coolify + test email réel)                                                                            | D-Ops     | 20       | 0.5      | 40.0 | worker déjà codé ; env vars seules                                                      |
| 2   | **Badge alerte sidebar dynamique** (`alert_count` ContentGenConfig → Server Component badge Lucide)                                                            | D-Ops     | 12       | 1.5      | 8.0  | composant client léger ; CSS déjà en place                                              |
| 3   | **seed-kb-facts.ts pour verticale `audits`** (déjà écrit, juste `pnpm exec ts-node` en prod)                                                                   | D-Qual    | 10       | 0.5      | 20.0 | seed déjà présent — action opérationnelle                                               |
| 4   | **Export CSV tableau croisé ville × statut** (papaparse côté client, bouton déjà prévu)                                                                        | D-Ops     | 12       | 2.0      | 6.0  | papaparse à ajouter ; tableau croisé déjà livré                                         |
| 5   | **Telegram bot token configuré prod** (env var `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` Coolify)                                                              | D-Ops     | 10       | 0.5      | 20.0 | worker déjà codé ; env vars seules                                                      |
| 6   | **GSC service account JSON** (OAuth service account → workflow `gsc-crawl-stats-weekly.yml` opérationnel)                                                      | D-Visi    | 7        | 1.0      | 7.0  | Compte GCP Will ; `googleapis` SDK déjà stub en analytics-clients.ts                    |
| 7   | **Adresse FR domiciliation** (Sedomicilier ~30 €/mois → Local SEO signal + JSON-LD `PostalAddress` réel)                                                       | D-Visi    | 10       | 0.5      | 20.0 | Décision Will ; code JSON-LD seo.ts à mettre à jour (30 min)                            |
| 8   | **KB sectorielle `interventions_formations`** (20 facts vérifiés sur cible 5 ans → KbFact[] + seed)                                                            | D-Qual    | 12       | 3.0      | 4.0  | Aucune (copier pattern audits.ts)                                                       |
| 9   | **KB sectorielle `implementations`** (20 facts : coût projet, ROI, périmètre type, durée)                                                                      | D-Qual    | 12       | 3.0      | 4.0  | Aucune                                                                                  |
| 10  | **correlationId / traceId inter-workers** (champ `correlationId` dans ContentGenJob → propagé orchestrator → gen → publish)                                    | D-Archi   | 8        | 2.0      | 4.0  | Schema Prisma migration + wiring 3 workers                                              |
| 11  | **Gate factCheckScore < 50 complet** (actuellement partial : condition présente mais `factCheckScore` null sur articles sans FactCheckClaim)                   | D-Qual    | 15       | 2.5      | 6.0  | Lecture `factCheckScore` dans publish-worker ; migration 0 (champ existe)               |
| 12  | **Prompts partials modulaires `_vertical-{v}`** (8 fichiers partials TS par verticale, injectés dans SYSTEM_PROMPT des generators)                             | D-Qual    | 20       | 8.0      | 2.5  | Pattern : string template injection dans generators                                     |
| 13  | **KB sectorielle `un_a_un`** (coaching individuel, formats 1-to-1, pricing range, livrables)                                                                   | D-Qual    | 10       | 3.0      | 3.3  | Aucune                                                                                  |
| 14  | **KB sectorielle `sites_web_augmentes`** (facts SEO/IA : Core Web Vitals + IA inject + ROI client)                                                             | D-Qual    | 10       | 3.0      | 3.3  | Stub VerticalKbMetadata déjà présent                                                    |
| 15  | **P0-10 Saga post-publish actions** (webhook interne + reindex Algolia/IndexNow après publish, pattern Saga BullMQ)                                            | D-Archi   | 15       | 3.0      | 5.0  | Orchestrator worker ; IndexNow déjà câblé                                               |
| 16  | **Dashboard SSE temps réel** (EventSource → `GET /api/admin/content-gen/jobs/stream` → push status changes)                                                    | D-Ops     | 20       | 6.0      | 3.3  | Route SSE + composant client (signal SSE déjà placé dans code commenté)                 |
| 17  | **Reporting email hebdo lundi 8h configuré** (env `WEEKLY_REPORT_EMAIL` + cron BullMQ actif en prod)                                                           | D-Ops     | 15       | 1.0      | 15.0 | worker codé ; cron BullMQ à enregistrer au démarrage                                    |
| 18  | **Backlinks autorité FR — 1 article invité JDN ou Frenchweb** (guest post avec lien dofollow axion-ia.com)                                                     | D-Visi    | 20       | 4.0      | 5.0  | Will uniquement (rédaction + outreach) ; impact SEO réel mais lent (2-4 sem indexation) |
| 19  | **P1-3 captureWorkerError dans quality-improver** (déjà présent — vérifier que les champs `jobId`+`campaignId` sont passés)                                    | D-Archi   | 5        | 0.5      | 10.0 | Lecture worker — selon A6-01 déjà câblé ; confirmer                                     |
| 20  | **P1-2 Circuit breakers partagés inter-process** (Redis-backed counter vs in-memory — `provider-router.ts` circuit en mémoire = reset à chaque restart worker) | D-Archi   | 5        | 2.5      | 2.0  | Redis ; pattern existant à migrer                                                       |
| 21  | **Logs viewer admin `/content-gen/jobs/[id]/logs`** (affichage `generationLog` JSON de ContentGenJob en UI lisible timeline)                                   | D-Ops     | 15       | 5.0      | 3.0  | generationLog JSONB déjà en base                                                        |
| 22  | **GBP (Google Business Profile) créé** (après adresse FR — fiche GBP = +15 pts Local SEO)                                                                      | D-Visi    | 15       | 1.0      | 15.0 | Adresse FR (#7) prérequis                                                               |
| 23  | **P1-5 correlationId visible dans Jobs UI** (afficher traceId dans liste jobs + filtre par correlationId)                                                      | D-Ops     | 8        | 1.5      | 5.3  | Dépend #10 (correlationId en base)                                                      |
| 24  | **Onboarding guidé 0 campagnes** (page `/content-gen/onboarding` redirige si 0 campagne active — existe mais logique redirect absente)                         | D-Ops     | 10       | 2.0      | 5.0  | Page route présente ; redirect manquante dans dashboard page.tsx                        |
| 25  | **Filtres tableau croisé ville × statut** (select ville + select status + bouton reset — stateless côté client)                                                | D-Ops     | 8        | 1.5      | 5.3  | Tableau croisé livré ; composant filtre à ajouter                                       |
| 26  | **Mobile hamburger menu admin** (AdminSidebar → état open/closed via cookie ou localStorage, breakpoint md:)                                                   | D-Ops     | 8        | 1.0      | 8.0  | CSS/layout admin déjà responsive-ready                                                  |
| 27  | **Featured Snippets prompt tableau comparison.ts** (comparatif avec `<table>` HTML explicite demandée — actuellement bloqué par hard gate no-table)            | D-Qual    | 20       | 6.0      | 3.3  | Décision : revert no-table gate OU deux modes selon `snippetMode` flag                  |
| 28  | **Integration tests E2E workers** (Vitest + Docker Compose Redis+PG → test orchestrator → gen-worker → publish-worker bout en bout)                            | D-Archi   | 20       | 12.0     | 1.7  | Docker Compose local ; 3-4 tests scenarii                                               |
| 29  | **Bilingue EN qualité si re-activé** (generator guard `locale !== 'fr'` → skip quality loop EN ; worker EN dédié)                                              | D-Qual    | 15       | 8.0      | 1.9  | EN locale désactivée (bug next-intl) — différé                                          |
| 30  | **P1-8 filtrage keywords par vertical pool inter-campagnes** (éviter 2 campagnes de la même verticale sur le même keyword-set)                                 | D-Archi   | 5        | 1.0      | 5.0  | keyword-catalog.ts déjà par verticale                                                   |

---

## 2. Analyse des 5 dimensions

### D-Ops (619/1000) — La plus rentable à attaquer

C'est la dimension avec le plus grand potentiel résiduel (381 pts) et le plus d'items quick-win.
5 items dans le TOP 30 ont un ROI > 5.0 (badge sidebar, reporting email, SMTP prod, logs viewer, filtres).
Le weekly-report worker est entièrement codé — seules des env vars Coolify manquent (ROI 15.0-40.0).
**Recommandation : attaquer D-Ops en priorité. 6 items représentent +83 pts pour ~13.5h d'effort.**

### D-Qual (770/1000) — Gains solides et autonomes

4 KB sectorielles à écrire (interventions, implementations, un_a_un, sites_web_augmentes) = +44 pts pour ~12h.
Le gate factCheckScore complet (+15) est 2.5h. Les prompts partials (+20) sont 8h.
Ces items ne dépendent ni de Will ni de services externes — **livrable autonome en sprint dédié.**

### D-Visi (778/1000) — Dépend majoritairement de Will

3 des 4 meilleurs items D-Visi sont des actions Will (adresse FR, GBP, GSC service account).
Le code est minimal (<30 min chacun) mais la décision/démarche admin bloque.
Backlinks JDN/Frenchweb = effort rédaction 4h mais ROI SEO élevé et différé dans le temps.
**Sans action Will, le plafond D-Visi est ~800 (les 22 pts restants sont tous Will).**

### D-Archi (816/1000) — Solide, gaps mineurs

Dimension la mieux servie. Les 5 items résiduels (correlationId, circuit breakers Redis, Saga post-publish, integration tests, captureWorkerError vérification) représentent +53 pts pour ~21h.
P0-10 Saga (ROI 5.0) est le plus impactant.
**Recommandation : correlationId + Saga en même sprint (schema Prisma à migrer une seule fois).**

### D-Etat (822/1000) — Presque complète, gains marginaux

Peu d'items résiduels dans le TOP 30. Les 178 pts manquants correspondent à des fonctionnalités de maturité avancée non priorisées (tests de charge, monitoring Lighthouse ISR, etc.).
**Recommandation : ne pas sur-investir — D-Etat approche de son plafond pratique.**

---

## 3. Projections de score

### Si TOP 10 livrés (items #1 à #10)

| #                     | Item                        | Gain         |
| --------------------- | --------------------------- | ------------ |
| 1                     | SMTP prod validation        | +20          |
| 2                     | Badge sidebar dynamique     | +12          |
| 3                     | seed-kb-facts prod          | +10          |
| 4                     | Export CSV tableau croisé   | +12          |
| 5                     | Telegram token configuré    | +10          |
| 6                     | GSC service account JSON    | +7           |
| 7                     | Adresse FR domiciliation    | +10          |
| 8                     | KB interventions_formations | +12          |
| 9                     | KB implementations          | +12          |
| 10                    | correlationId / traceId     | +8           |
| **Sous-total TOP 10** |                             | **+113 pts** |

**Score estimé après TOP 10 : 3805 + 113 = 3918/5000**
Écart au GO : 582 pts. Toujours CONDITIONNEL.

### Si TOP 20 livrés (items #1 à #20)

| Items #11 à #20                | Gain cumulé  |
| ------------------------------ | ------------ |
| #11 gate factCheckScore        | +15          |
| #12 prompts partials           | +20          |
| #13 KB un_a_un                 | +10          |
| #14 KB sites_web_augmentes     | +10          |
| #15 Saga post-publish          | +15          |
| #16 Dashboard SSE              | +20          |
| #17 Reporting email actif      | +15          |
| #18 Backlinks JDN/Frenchweb    | +20          |
| #19 captureWorkerError vérifié | +5           |
| #20 Circuit breakers Redis     | +5           |
| **Sous-total #11→#20**         | **+135 pts** |

**Score estimé après TOP 20 : 3918 + 135 = 4053/5000**
Écart au GO : 447 pts. Toujours CONDITIONNEL mais franchit le seuil 4000 (milestone psychologique).

### Si TOP 30 livrés (items #1 à #30)

| Items #21 à #30                  | Gain cumulé  |
| -------------------------------- | ------------ |
| #21 Logs viewer admin            | +15          |
| #22 GBP créé                     | +15          |
| #23 correlationId visible UI     | +8           |
| #24 Onboarding redirect          | +10          |
| #25 Filtres tableau croisé       | +8           |
| #26 Mobile hamburger             | +8           |
| #27 Featured Snippets comparison | +20          |
| #28 Integration tests E2E        | +20          |
| #29 Bilingue EN qualité          | +15          |
| #30 Keywords inter-campagnes     | +5           |
| **Sous-total #21→#30**           | **+124 pts** |

**Score estimé après TOP 30 : 4053 + 124 = 4177/5000**
Écart au GO : 323 pts. Encore CONDITIONNEL (seuil GO = 4500).

---

## 4. Chemin minimal vers GO 4500/5000

Le TOP 30 ne suffit pas à atteindre 4500. Gap résiduel : 323 pts.

### Items supplémentaires nécessaires au-delà du TOP 30

Ces items n'apparaissent pas dans le TOP 30 (ROI < 1.7 ou hors périmètre code) mais
constituent le potentiel restant :

| Item additionnel                                                     | Dimension | Gain pts    | Effort h | Notes                                             |
| -------------------------------------------------------------------- | --------- | ----------- | -------- | ------------------------------------------------- |
| Tests de charge workers (Gatling/k6 scénario 1000 jobs/h)            | D-Archi   | 15          | 8        | Maturité production                               |
| ISR revalidation monitoring (alertes quand ISR > 3600s)              | D-Etat    | 10          | 3        | Observabilité                                     |
| Backlinks #2 (deuxième article invité +6 mois)                       | D-Visi    | 15          | 4        | SEO long terme                                    |
| Sitemap news articles content-gen (flux `/sitemap-news.xml` enrichi) | D-Visi    | 10          | 2        | Déjà partiel — enrichir avec content-gen articles |
| RGPD AI Act audit annuel procédure (doc + script auto)               | D-Archi   | 10          | 4        | Conformité                                        |
| Admin mobile full responsive (3 pages critiques)                     | D-Ops     | 12          | 4        | UX                                                |
| Keyword tracking automatique GSC → ContentGenJob feedback            | D-Qual    | 15          | 6        | Boucle data                                       |
| Scores LLM-judge affichés sur liste publications                     | D-Ops     | 10          | 2        | Observabilité qualité                             |
| Alertes anomalies email en temps réel (≠ weekly)                     | D-Ops     | 12          | 3        | Distinct du weekly-report                         |
| KB pilote glossaire IA 60 termes → KnowledgeEntry seed               | D-Qual    | 10          | 4        | KB richesse                                       |
| **Sous-total additionnels**                                          |           | **119 pts** |          |                                                   |

**Score estimé après TOP 30 + additionnels : 4177 + 119 = 4296/5000**

> **Conclusion** : même avec TOP 30 + items additionnels réalistes, le score serait ~4296/5000,
> soit 204 pts sous le GO. Le seuil 4500 représente un niveau de maturité industrielle élevé.

### Chemin minimal GO — items qui "suffisent" combinés

Pour atteindre exactement 4500 à partir de 3805, il faut 695 pts. Le chemin le plus court :

**Bloc A — Quick wins actions Will (non-code) : ~52 pts, 2h**

- #1 SMTP prod (+20)
- #5 Telegram token (+10)
- #3 seed-kb-facts prod (+10)
- #7 Adresse FR (+10)
- #6 GSC service account (+7) → sous-total = 57 pts (dépasse 52 — garder tous)

**Bloc B — Sprint D-Ops (3 jours) : ~75 pts, 17h**

- #2 Badge sidebar (+12)
- #4 Export CSV (+12)
- #16 Dashboard SSE (+20)
- #17 Reporting email actif (+15)
- #21 Logs viewer (+15)
- #25 Filtres tableau (+8)
- #26 Mobile hamburger (+8) → sous-total = 90 pts

**Bloc C — Sprint D-Qual KB (2 jours) : ~69 pts, 12h**

- #8 KB interventions (+12)
- #9 KB implementations (+12)
- #11 Gate factCheckScore (+15)
- #12 Prompts partials (+20)
- #13 KB un_a_un (+10) → sous-total = 69 pts

**Bloc D — Sprint D-Archi (1 jour) : ~33 pts, 6h**

- #10 correlationId (+8)
- #15 Saga post-publish (+15)
- #30 Keywords inter-campagnes (+5)
- #19 captureWorkerError vérifié (+5) → sous-total = 33 pts

**Bloc E — Sprint D-Visi (externe) : ~50 pts**

- #18 Backlinks JDN (+20)
- #22 GBP (+15)
- #27 Featured Snippets (+20) → sous-total = 55 pts (1 backlink suffit)

**Bloc F — Items complémentaires : ~61 pts**

- #14 KB sites_web_augmentes (+10)
- #24 Onboarding redirect (+10)
- #28 Integration tests E2E (+20)
- #29 Bilingue EN (+15) [si locale réactivée]
- Alertes email temps réel (+12) [additionnel] → sous-total = 67 pts

**Total Blocs A+B+C+D+E+F : 57+90+69+33+55+67 = 371 pts**

**Score projeté : 3805 + 371 = 4176 pts** → encore 324 pts manquants.

> **Constat honnête** : le seuil GO 4500/5000 est atteignable sur un horizon 3-6 mois avec
> des sprints dédiés + actions Will, mais PAS en un seul sprint. Le score actuel 3805 est
> solide (76.1%). Les 695 pts manquants nécessitent :
>
> - ~40h de développement (D-Ops + D-Qual + D-Archi)
> - ~5h d'actions Will (SMTP, Telegram, adresse FR, GBP, GSC)
> - ~4h outreach externe (backlinks)
> - Temps de maturation SEO (2-4 semaines indexation backlinks)
> - Potentiellement : réactivation locale EN pour +15 D-Qual

---

## 5. Synthèse exécutive

| Priorité                  | Items                      | Dimension    | Gain total | Effort total | ROI moyen |
| ------------------------- | -------------------------- | ------------ | ---------- | ------------ | --------- |
| SPRINT-NOW (actions Will) | #1, #3, #5, #6, #7         | D-Ops/D-Visi | +57 pts    | 3h           | 19.0      |
| SPRINT-1 (D-Ops UX)       | #2, #4, #16, #17, #25, #26 | D-Ops        | +75 pts    | 12h          | 6.3       |
| SPRINT-2 (D-Qual KB)      | #8, #9, #11, #12, #13, #14 | D-Qual       | +79 pts    | 19.5h        | 4.1       |
| SPRINT-3 (D-Archi)        | #10, #15, #19, #30         | D-Archi      | +33 pts    | 7h           | 4.7       |
| BACKLOG (D-Visi ext.)     | #18, #22, #27              | D-Visi       | +55 pts    | 11h          | 5.0       |

**Score atteignable en 6 semaines (2 sprints × 2 sem + actions Will) : ~4050/5000**

**Score atteignable en 12 semaines (4 sprints + backlinks indexés) : ~4200-4300/5000**

**GO 4500 : horizon réaliste 5-6 mois** avec P7 dédié aux tests E2E, maturité opérationnelle complète, et backlinks indexés.

---

_Agent A6-02 — Gaps & ROI analysis — 2026-05-22_
_Audit-only, 0 commit, 0 modif code_
_Score de départ : 3805/5000 (source A6-01) | Gap GO : 695 pts_
