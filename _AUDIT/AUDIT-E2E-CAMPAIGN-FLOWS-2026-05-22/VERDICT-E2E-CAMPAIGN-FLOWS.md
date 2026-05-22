# VERDICT AUDIT E2E CAMPAIGN FLOWS

**Date** : 2026-05-22
**HEAD audité** : `e7c40004`
**Score** : **22/30 OK (73 %) + 8/30 PARTIAL + 0/30 KO** — 🟡 **CODE-LEVEL VALIDÉ, RUNTIME À EXÉCUTER**

---

## ⚠️ Mode d'exécution (à lire en premier)

Cet audit a été **mené en mode code-level forensique uniquement**. Les **30 scénarios n'ont PAS été exécutés en runtime réel** parce que les pré-requis infra ne sont pas satisfaits dans l'environnement actuel :

| Pré-requis                                               | Détecté              |
| -------------------------------------------------------- | -------------------- |
| Docker daemon (Postgres + Redis)                         | ❌ npipe down        |
| Next dev server `localhost:3000`                         | ❌ OFF               |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` dans `.env.local` | ❌ absents           |
| `BULLMQ_DISABLED` en `.env.local`                        | `true` (workers OFF) |

**Décision prise** : pivoter vers un audit **forensique code-level E2E** plutôt qu'attendre intervention manuelle Will (cohérent avec consigne autopilot + "self-troubleshoot toutes erreurs"). Pour chaque scénario, j'ai :

1. Tracé le chemin code complet (Server Action → Worker → Generator → Publisher → Indexer)
2. Vérifié la présence des invariants (Redis atomic, Prisma transactions, kill-switch checks, audit logs SOC2)
3. Identifié les tests vitest couvrant le chemin
4. Détecté les gaps statiques

Verdict par scénario : 🟢 OK (code) | 🟡 PARTIAL (code) | 🔴 KO (code) | ⚪ N/A runtime.

**Pour exécution runtime réelle** : démarrer Docker Desktop → `pnpm db:up` → ajouter clés LLM en `.env.local` → `BULLMQ_DISABLED=false` → `pnpm dev` → relancer ce prompt.

---

## RÉSUMÉ EXÉCUTIF

**22/30 scénarios OK (code-level)** — 🟡 **CODE-LEVEL VALIDÉ, RUNTIME À EXÉCUTER**

### Top 3 forces du pipeline E2E

1. **Sprint Campaign Controls livré** (SC-08/09/10/11/12) : startDate/endDate/recurring/sequential/parallel câblés complètement, validations Zod strictes, audit log SOC2, tests vitest présents.
2. **Sécurité / quarantaine robuste** (SC-21/22/29) : REJECT-P0 + fact-check < 50 + cost-cap-hit en cascade idempotente avec Telegram MONITORING/INCIDENT et audit trail 50 events.
3. **Multi-targets V-01 P1 mergé 2026-05-22** (SC-25) : revalidate cascade hubs ville (5 routes × villes mentionnées) opérationnelle.

### Top 3 scénarios qui présentent des gaps (P0)

1. **SC-26 / SC-27 (P0 SEO)** : `sitemap-news.xml` route handler **manquant** + `usageCount` external links **jamais incrémenté** (rotation perd son feedback)
2. **SC-14 (P1 SEO local)** : landing-ville generator n'émet pas LocalBusiness JSON-LD + section "villes proches" extraite mais pas rendue HTML
3. **SC-07 / SC-17 / SC-19 (P2 brand)** : Persona Manon D3 absente intentionnellement de RSS + comparison (neutralité journalistique) — à valider Will pour cohérence brand voice

### Action recommandée

**Démarrer infra locale + relancer ce prompt en mode runtime pour valider comportement effectif** (Option C ci-dessous), tout en lançant un sprint correctif sur les 2 P0 SEO en parallèle (Option B partielle).

---

## MATRICE DES SCÉNARIOS (extrait)

Voir `SCENARIOS-MATRIX.md` pour le tableau complet 30 lignes.

| #        | Scénario                            | Verdict code          | Notes clés                                                      |
| -------- | ----------------------------------- | --------------------- | --------------------------------------------------------------- |
| SC-01    | Création basique                    | 🟢 OK                 | Câblage complet                                                 |
| SC-02-07 | 6 presets D-P5-1                    | 🟢 OK × 6 (SC-07 🟡)  | Seed + UI + defaults                                            |
| SC-08-10 | Scheduling/recurring                | 🟢 OK × 3             | Sprint Campaign Controls livré                                  |
| SC-11-12 | Séquentiel/parallèle                | 🟢 OK × 2             | currentCityIndex + sampling uniforme                            |
| SC-13-19 | 7 generators                        | 4🟢 + 3🟡             | SC-15/16 gold standard ; landing/rss/qa/comparison drift byline |
| SC-20-25 | Quality/quarantaine/cap/pause/multi | 🟢 OK × 6             | Solid cascade                                                   |
| SC-26-27 | IndexNow + external links           | 🟡 × 2                | 🔴 sitemap-news manquant + usageCount inactif                   |
| SC-28-29 | Image + cost cap                    | 🟢 OK × 2             | Zéro DALL-E strict + cascade kill-switch                        |
| SC-30    | Cleanup                             | 🟢 OK (code) + ⚪ N/A | Aucune donnée créée                                             |

---

## BOTTLENECKS DÉTECTÉS

Voir `BOTTLENECKS-DETECTED.md` pour analyse complète.

**Top inférés (statiques)** :

1. Génération article LLM 15-45 s/appel × 2-3 iter qualité = **45-135 s/article quality_improving**
2. Drip window 8h-22h CET → 30 articles/jour = ~28 min entre 2 publish (uniforme)
3. Multi-targets revalidate cascade jusqu'à 100 paths/article (mitigé max 20 villes)

**À mesurer runtime** : latence réelle via Sentry monitoring déjà câblé S+4 P1 commit `dbac155`.

---

## GAPS À CORRIGER

### 🔴 P0 (bloquant SEO)

| ID   | Description                                                              | Effort fix | Fichiers                                                                                           |
| ---- | ------------------------------------------------------------------------ | ---------- | -------------------------------------------------------------------------------------------------- |
| P0-1 | `sitemap-news.xml` route handler manquant → Googlebot News aveugle       | 2-3 h      | `axionia/src/app/sitemap-news.xml/route.ts` (à créer)                                              |
| P0-2 | `usageCount` external links jamais incrémenté → rotation pas de feedback | 3-4 h      | Ajouter `trackExternalLinksUsage()` dans `external-links-injector.ts` + appel par les 9 generators |

### 🟡 P1 (gap fonctionnel)

| ID   | Description                                                                      | Effort fix                             |
| ---- | -------------------------------------------------------------------------------- | -------------------------------------- |
| P1-1 | landing-ville generator : LocalBusiness JSON-LD non émis (SC-14)                 | 2-3 h                                  |
| P1-2 | landing-ville : "villes proches" extrait mais pas rendu HTML                     | 1-2 h                                  |
| P1-3 | `content-gen-deadline-checker` cron quotidien (5h UTC) — granularité 24h (SC-09) | 30 min (changer cron à `*/15 * * * *`) |
| P1-4 | FK `ExternalLinkUsage.externalLinkId` manquante (SC-27)                          | 30 min migration                       |

### 🟢 P2 (drift brand / polish — à valider Will)

| ID   | Description                                                                                   |
| ---- | --------------------------------------------------------------------------------------------- |
| P2-1 | Persona Manon D3 absente RSS (SC-07/17) + comparison (SC-19) — intentionnel pour neutralité ? |
| P2-2 | AuthorByline absent landing/actualites/faq/comparison (SC-14/17/18/19)                        |
| P2-3 | Status `awaiting_publish_slot` implicite (SC-23) à formaliser                                 |
| P2-4 | 2 seuils fact-check : 50 (quarantine) vs 40 (publish) (SC-22) à documenter                    |
| P2-5 | Pas de transaction 2-phase Prisma+BullMQ pause/cleanup (SC-24) split-brain edge case          |

### ℹ️ P3 (couverture tests)

- 19/30 scénarios sans test vitest dédié — couverts implicitement par tests transversaux ou E2E shared
- Renforcement coverage : generators 13/14/17/18/19, workers boucle improve / IndexNow / cost-cap / multi-targets revalidate

---

## CLEANUP CONFIRMATION

| Action                        | Statut                   |
| ----------------------------- | ------------------------ |
| Campagnes TEST_E2E supprimées | ✅ N/A (0 créée)         |
| Articles TEST_E2E supprimés   | ✅ N/A (0 créé)          |
| Jobs orphelins                | ✅ N/A (0 créé)          |
| DB state cohérent             | ✅ aucun INSERT effectué |
| Env vars restaurées           | ✅ aucune modifiée       |

Voir `CLEANUP-LOG.md` détail + procédure cleanup si Will exécute runtime ultérieurement.

---

## ENVELOPPE DE CONFIANCE

| Dimension                                         | Niveau                     |
| ------------------------------------------------- | -------------------------- |
| Câblage architecturé (présence chemin code)       | 🟢 95 %                    |
| Invariants critiques (atomic, kill-switch, audit) | 🟢 90 %                    |
| Couverture tests automatisés                      | 🟡 60 % (19/30 sans dédié) |
| Validation comportementale runtime                | 🔴 0 % (non exécutée)      |
| **Confiance pré-prod après cet audit**            | **🟡 75 %**                |

Pour passer 🟢 95 % : exécuter ce prompt en mode runtime (Docker up + LLM keys) — score 22/30 OK devrait se confirmer ou révéler 1-2 KO inattendus.

---

## DÉCISIONS WILL CANONIQUES RESPECTÉES

- ✅ D-W1 `MAX_PUBLISH_PER_DAY=30` initial (SC-23 vérifié)
- ✅ D-W3 `factoryAutoPublishAllBlogTypes` ACTIVÉ
- ✅ D-W4 OpenAI embeddings text-embedding-3-large
- ✅ D-P5-1 6 presets CampaignTemplate (SC-02-07 vérifiés)
- ✅ D-P5-2 Seuil qualité 60/100
- ✅ D-P5-5 MAX_PUBLISH rampe manuelle UI
- ✅ D1 Seuil REJECT 6.0/10 (SC-21 vérifié)
- ✅ D2 Itérations boucle qualité (SC-20 vérifié)
- ✅ D3 Persona Manon (SC-13/15/16/18 vérifiés ; SC-07/17/19 drift signalé)
- ✅ D4 Wording AI Act exact (SC-13-19 vérifiés)
- ✅ D7 Société française pure

**Exclusions Will respectées** : aucune mention Wikidata, DPA, CF WAF, toggle auto/manuel publication.
