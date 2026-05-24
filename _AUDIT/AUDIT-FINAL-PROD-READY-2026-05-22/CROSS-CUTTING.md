# Cross-Cutting Analysis — Audit final pré-prod AxionIA 2026-05-22

Analyses transverses qui traversent plusieurs blocs.

---

## C1 — Boucle content-gen E2E intégrité

**Constat** : la chaîne `orchestrator → keyword-selector → content-gen-worker → llm-judge → quality-improver → content-publish-worker → content-indexnow-worker` est **structurellement complète et testée** (Fl-07 24/25). Décisions Will (D1=6.0, D2 3/2 itér, D4 wording) toutes retrouvées EXACT dans le code.

**Risques croisés** :

- P0-1 (catalog liens) impacte 100% des articles publiés via `injectInternalLinks()` appelé par tous generators
- P0-2 (resetMonthlyCostCounters absent) interrompt toute la chaîne à J+30
- P0-4 (fact-check Sentry-aveugle) masque outages Perplexity = gating publish invisible si Perplexity down

**Conclusion** : 3 P0 distincts mais qui convergent sur le même chemin critique (publish). Sprint Final doit traiter les 3 ensemble — pas de cherry-pick.

---

## C2 — AI Act art. 50 (deadline 2026-08-02)

**Constat** : conformité **anticipée 2,5 mois avant échéance** sur 4 piliers indépendants :

1. AiContentDisclaimer (composant + wording D4 bilingue)
2. JSON-LD `aiGenerated:true` + `additionalType:AIGeneratedContent`
3. GenerationProvenance 16 champs + hash chain SHA-256 + rétention 6 ans
4. FK `Restrict` empêchant suppression cascade Article (audit trail immuable)

**Risque résiduel** : P0-4 (fact-check Sentry-aveugle) crée une zone d'ombre dans le pipeline gating. Si Perplexity down silencieusement et que `factCheckQueue.add()` ne déclenche pas (P1-15 à confirmer), des articles pourraient être publiés sans claims vérifiés en violation de l'esprit AI Act art. 50.

**Action** : P0-4 + P1-15 doivent être traités avant rampe MAX_PUBLISH >100.

---

## C3 — Cost tracker ↔ rampe MAX_PUBLISH

**Constat** : trois mécanismes redondants empêchent dépassement budget :

1. Cap quotidien `MAX_PUBLISH_PER_DAY` (Redis INCR atomique, P2 P0-4)
2. Cost cap mensuel par provider (`assertCostCapAvailable` + `trackCost`)
3. Kill-switch global si tous providers role=text en cap (`handleCostCapHit`)

**Risque P0-2** : si `resetMonthlyCostCounters()` n'est PAS câblé dans `bootRepeatableJobs()`, le mécanisme #2 va lock-up après J+30 et le mécanisme #3 va déclencher kill-switch permanent. Tout le système content-gen s'arrête silencieusement.

**Action** : P0-2 est le risque le plus dissimulé (visible seulement à J+30). À confirmer en priorité absolue avant activation rampe.

---

## C4 — Observability gap (Sentry coverage 17/33 workers)

**Constat** : Sentry server + edge + client configurés correctement (tracesSampleRate 0.02 prod), mais **16 workers (48 %) n'ont pas de captureException ou captureWorkerError**.

**Workers Sentry-aveugles identifiés** :

- booking-crons-worker
- content-fact-check-worker ⚠️ P0-4
- content-google-indexing-worker
- content-keyword-sync-worker
- content-monitoring-worker
- content-news-lifecycle-worker
- content-psi-monitor-worker
- content-qa-extract-worker
- content-rss-fetch-worker
- content-similarity-monitor-worker
- content-tier-lifecycle-worker
- content-web-vitals-monitor-worker
- email-worker
- option-expiration-worker
- option-reminder-worker
- retention-purge-worker

**Action** : ratchet 17/33 → 33/33 en P1 (~2h, helper `captureWorkerError` existe `src/server/queue/lib/sentry-worker.ts`).

---

## C5 — Décisions Will canoniques : conformité 100 %

Toutes les décisions Will figées (D-W1-5, D-P5-1-6, D1-D5, D7) ont été **retrouvées EXACT dans le code** :

| Décision                                   | Code retrouvé                            | Statut                                     |
| ------------------------------------------ | ---------------------------------------- | ------------------------------------------ |
| D-W1 MAX_PUBLISH=30 ramp 30→500            | Redis INCR `MAX_PUBLISH_PER_DAY`         | ✅ EXACT                                   |
| D-W3 factoryAutoPublishAllBlogTypes ACTIVÉ | Flag présent                             | ✅ EXACT                                   |
| D-W4 OpenAI text-embedding-3-large         | Provider câblé                           | ✅ EXACT                                   |
| D-P5-1 6 presets CampaignTemplate          | Model Prisma + FALLBACK_PRESETS          | ⚠️ Seed prod manquant P0-5                 |
| D-P5-2 Seuil qualité 60/100                | LLM-judge threshold                      | ✅ EXACT                                   |
| D-P5-3 Reporting email lundi 8h            | weekly-report-worker                     | ✅ retrouvé                                |
| D-P5-4 Tableau croisé (pas heatmap)        | Dashboard UI                             | ✅ retrouvé                                |
| D-P5-5 MAX_PUBLISH rampe manuelle UI       | Admin settings                           | ✅ retrouvé                                |
| D-P5-6 Ordre Phase A puis B                | Roadmap respectée                        | ✅ retrouvé                                |
| D-P5-6 4 sections dashboard                | Pilotage/Sources/Suivi/Réglages          | ✅ EXACT                                   |
| D1 Seuil REJECT 6.0/10                     | llm-judge.ts threshold                   | ✅ EXACT                                   |
| D2 3 itér pilier+landing, 2 autres         | quality-improver config                  | ✅ EXACT                                   |
| D3 Persona Manon                           | `buildPersonJsonLd`                      | ✅ EXACT                                   |
| D4 Wording AiContentDisclaimer             | Composant + wording Claude Sonnet 4.6    | ✅ EXACT                                   |
| D5 Reporting email lundi 8h                | weekly-report-worker                     | ✅ EXACT                                   |
| D7 Société française pure                  | `BRAND.legalName="Axion-IA"` placeholder | ⚠️ raison sociale officielle pendante P1-4 |

**Conclusion** : zéro régression sur les décisions Will. 2 partiels (D-P5-1 seed prod, D7 raison sociale).

---

## C6 — Sécurité ↔ RGPD ↔ AI Act : convergence

**Constat** : les trois domaines partagent des composants communs solides :

- IP hashing SHA-256 → RGPD (anonymisation) + Sécurité (pas d'IP en clair logs)
- `regulationVersion="AI-Act-2024/1689"` dans GenerationProvenance → AI Act art. 50 + audit trail
- Argon2id + 2FA TOTP → Sécurité + RGPD art. 32 (mesures techniques)
- CSP nonce per-request → Sécurité OWASP A05 + COEP credentialless
- Audit trail SOC2 ActivityLog → RGPD art. 30 (traçabilité)

**Gap résiduel** : registre RGPD art. 30 narratif (P1-10) demandé par CNIL en format PDF/MD signé DPO — ActivityLog DB technique mais pas livrable narratif.

---

## C7 — Web Vitals 2026 : zone à surveiller

**Constat** : doctrine AGENTS.md affiche cibles strictes (LCP ≤1800ms, INP ≤80ms, CLS ≤0.05, JS ≤75KB gz) mais :

- `lighthouserc.json` cibles relâchées (CLS 0.1, TBT 200ms — vs doctrine 0.05/150ms)
- INP non lab-testé (pas dans LHCI config)
- LHCI gate `continue-on-error: true` en CI (P1-8) — donc régressions Web Vitals NE BLOQUENT PAS les PR
- Lighthouse mobile non gated séparément (P1-17)
- `AuthorByline.tsx:49` utilise `<img>` HTML brut (P1-6) → CLS sur 100% articles

**Action** : ratchet cibles LHCI + gates strict + mobile gate + Image conversion = **5 P1 cumulés** à traiter avant rampe MAX_PUBLISH >200.

---

## C8 — Build externalisé GH Actions ↔ stub.invalid : intégrité

**Constat** : ADR 0026 (build externalisé GHCR) bien documenté + magic string `"stub.invalid"` correctement propagée :

- `src/lib/prisma.ts` : Proxy si stub
- `src/lib/redis.ts` : Proxy si stub
- `knowledge-rss.ts` + `knowledge-sitemap.ts` : early-exit explicite
- Dockerfile : SKIP_ENV_VALIDATION=true + BULLMQ_DISABLED=true

**Risque résiduel** : si une **nouvelle page SSG** fait un appel DB direct au build, le stub Proxy doit couvrir la méthode utilisée OU la page doit early-exit. Pas de garde-fou test automatique. À surveiller via ADR check pre-merge si nouvelle page SSG ajoutée.

**Action** : pas de P0/P1 sur cet axe (ADR mature). Préventif : ajouter en P2 un test CI qui mock `process.env.DATABASE_URL="stub.invalid"` et tente un `pnpm build` pour valider.

---

## C9 — Synergie image-bank ↔ content-gen ↔ AI Act

**Constat** : pipeline image-bank parfaitement isolé (B-10 23/25) + cloisonnement strict acquis (skill `axionia-image-bank`).

- Doctrine "0 image AI-générée" (`feedback_no_dalle_images.md`) appliquée via flag + migration cleanup
- License CC BY 4.0 par défaut (Copyright Axion-IA OÜ — à updater post-D7 société française)
- JSON-LD ImageObject + 4 sub-sitemaps Google 1.1

**Gap croisé** : si D7 société française tranchée définitivement, le `Copyright Axion-IA OÜ` dans les EXIF/XMP/IPTC embed des images existantes devra être migré. Effort ~1h script Sharp + tests. À ajouter P1 si Will tranche raison sociale dans Sprint Final.

---

## C10 — Verdict cross-cutting

**Le système est cohérent et bien architecturé**. Pas de bug d'intégration entre features. Les 5 P0 et 22 P1 sont **localisés et chirurgicaux** — pas de refonte requise.

La **chaîne content-gen E2E** (Fl-07 + cost tracker + AI Act provenance + image-bank) est la zone la plus mature du système et la plus solidement testée.

La **périphérie observabilité** (workers Sentry coverage 17/33) est la zone la plus fragile mais réparable en 2h.

L'**axe DR/backups** (Pr-04 18/25) est le moins bien noté du bloc Prod readiness — restore mensuel non chronométré, RTO/RPO non chiffrés. **Recommandation** : exécuter un restore drill manuel dans le Sprint Final pour valider RTO réel avant GO.
