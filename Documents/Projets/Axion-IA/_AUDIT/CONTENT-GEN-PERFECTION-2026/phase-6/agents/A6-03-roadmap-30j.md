# A6-03 — Roadmap Sprint A (30 jours)

**Agent** : A6-03 (Roadmap & Execution Planning)
**Date** : 2026-05-22 (mise a jour — version P6.1)
**HEAD origin/main** : e573da64
**Score prod entrant** : 3638/5000 (72.8 %)
**Score local entrant** : 3805/5000 (commits non pushes)
**Score attendu post-Sprint A** : +113 → ~3751-3918/5000 (fourchette selon D8-D11)
**Seuil GO** : 4500/5000 — Gap : 695 pts (base score local) / 862 pts (base prod)

---

## Fenetre : 2026-05-22 → 2026-06-21

---

## Preambule — Etat reel du code (2026-05-22)

### Deja LIVRE — ne pas re-faire (NO-OP)

| Item | Preuve |
|------|--------|
| P0-3 promptHash reel 9/9 generators | commit e0b1973 — grep confirme hashPrompt dans blog-article.ts |
| P0-2 lockDuration quality-improver (120 000 ms) | commit e0b1973 — L346 content-quality-improver-worker.ts |
| P0-7 Telegram REJECT-P0 | commit 023266f9 (local) — quarantined_critical + Telegram alert |
| getGlossaryContext 8/8 generators | commit 4516f39 — tous generators incluant blog-article.ts |
| injectInternalLinks 8/8 generators | commit 4516f39 — idem |
| H1 gate 8/8 generators | commit 4516f39 — validation post-LLM |
| schema.prisma RESTRICT | commit 023266f9 (local) — GenerationLog + ReviewQueue |
| Weekly-report worker code | commit 023266f9 (local) — manque env var Coolify WEEKLY_REPORT_EMAIL |
| Wizard 5 etapes | commit 7236dfd0 (local) — 5 personas brand-voice.ts |

### OUVERT pour Sprint A (vrais items)

| Item | Etat | Effort | Gain |
|------|------|--------|------|
| git push origin main (commits locaux) | ⚠️ CRITIQUE — 3 commits non pushes | 30 sec Will | +167 pts D-securisation |
| lockDuration absent content-PUBLISH-worker.ts | Manquant (distinct du quality-improver) | 10 min Claude | +5 pts D-Archi |
| WEEKLY_REPORT_EMAIL env var Coolify | Code livre, env var manquante | 15 min Will | +20 pts D-Ops |
| captureWorkerError 3 workers restants | fact-check + keyword-sync + monitoring | 1h Claude | +5 pts D-Ops |
| factCheckScore gate publish-worker | Verifier et completer gate < 50 | 1h Claude | +8 pts D-Qual |
| CampaignTemplate 6 presets seed DB | Schema a creer + UI cards | 10h Claude | +40 pts D-Ops |
| KB seed 4 verticales x 50 facts | Nouveau developpement | 16h Claude | +46 pts D-Qual |
| Tableau croise ville x articles | groupBy anchorVilleSlug | 3h Claude | +12 pts D-Ops |
| Dashboard SSE polling 15s | BullMQ compteurs temps reel | 5h Claude | +20 pts D-Ops |
| Export CSV tableau croise | Apres tableau croise | 2h Claude | +8 pts D-Ops |
| CTA terracotta persistant sidebar | CSS admin-v2 | 1h Claude | +8 pts D-Ops |
| Progress bars CoverageDetailV2 | Compteurs DB deja disponibles | 2h Claude | +17 pts D-Ops |
| Structured data FAQ landing_ville | FAQ schema + Speakable | 4h Claude | +15 pts D-Visi |
| ArticleFeedback likes/dislikes | Schema Prisma + UI | 6h Claude | +20 pts D-Ops |
| Adresse FR domiciliation | Will - Sedomicilier ~30euro/mois | 1h Will | +7 pts D-Visi (debloque GBP) |
| GSC service account JSON Coolify | Will - D11=A recommande | 30 min Will | +7 pts D-Visi |

---

## 1. Priorites sprint A (ordonnees par ROI)

### Bloc 1 — Actions Will urgentes (< 1h chacune, J+1 a J+3)

| Action | Effort Will | Gain pts | Dimension | Deadline |
|--------|-------------|----------|-----------|----------|
| `git push origin main` (commits 023266f9 + 5d8e8b6f + 7236dfd0) | 30 sec | +167 (securisation) | D-Etat/D-Archi/D-Ops | **IMMEDIAT — risque perte si machine defaillante** |
| Env var Coolify `WEEKLY_REPORT_EMAIL=williamsjullin@gmail.com` | 15 min | +20 | D-Ops | J+1 |
| Env var Coolify `SMTP_HOST` + `SMTP_USER` + `SMTP_PASS` (si non presentes) | 15 min | +3 | D-Ops | J+1 |
| GSC service account JSON dans Coolify (D11=A) | 30 min | +7 | D-Visi | J+3 |
| Adresse FR domiciliation Sedomicilier ~30euro/mois (D10=A) | 1h admin | +7 (debloque GBP +15 pts ulter.) | D-Visi | J+7 |

**Sous-total Bloc 1 : +204 pts (dont +167 securisation commits) — ~2h Will**

### Bloc 2 — Quick wins code (< 2h par item, J+1 a J+7)

| Item | Effort Claude | Gain pts | Dimension | ROI |
|------|---------------|----------|-----------|-----|
| lockDuration dans content-publish-worker.ts (10 min) | 10 min | +5 | D-Archi | 30 pts/h |
| CTA terracotta persistant sur toutes sous-pages admin | 1h | +8 | D-Ops | 8 pts/h |
| Progress bars CoverageDetailV2 (publie / cap + ETA velocity) | 2h | +17 | D-Ops | 8.5 pts/h |
| captureWorkerError dans fact-check + keyword-sync + monitoring workers | 1h | +5 | D-Ops | 5 pts/h |
| factCheckScore gate dans content-publish-worker (< 50 → needs_review) | 1h | +8 | D-Qual | 8 pts/h |

**Sous-total Bloc 2 : +43 pts — ~5.2h Claude**

### Bloc 3 — Sprint code principal (2-16h, J+7 a J+21)

| Item | Effort Claude | Gain pts | Dimension | ROI | Prerequis |
|------|---------------|----------|-----------|-----|-----------|
| Tableau croise ville x articles x verticale | 3h | +12 | D-Ops | 4 pts/h | Campagnes actives DB |
| Export CSV tableau croise | 2h | +8 | D-Ops | 4 pts/h | Tableau croise (ci-dessus) |
| Dashboard SSE polling 15s (compteurs BullMQ temps reel) | 5h | +20 | D-Ops | 4 pts/h | Aucun |
| Structured data FAQ landing_ville (FAQ schema + Speakable markup) | 4h | +15 | D-Visi | 3.75 pts/h | Aucun |
| ArticleFeedback model : schema Prisma + endpoint + UI thumbs | 6h | +20 | D-Ops | 3.3 pts/h | Aucun |
| CampaignTemplate 6 presets : schema + seed + UI cards | 10h | +40 | D-Ops | 4 pts/h | schema.prisma CampaignTemplate |
| KB seed script — 4 verticales x 50 facts minimum | 16h | +46 | D-Qual | 2.9 pts/h | Validation Will ~1h relecture |

**Sous-total Bloc 3 : +161 pts — ~46h Claude**

### Bloc 4 — Validation + tests (J+21 a J+30)

| Item | Effort | Notes |
|------|--------|-------|
| Vitest specs workers corriges (fact-check, keyword-sync, monitoring) | 1h Claude | Gate : ≥ 1376/1383 maintenu |
| Test reception email weekly-report (2 lundis consecutifs) | 1h Will | Validation prod |
| Typecheck global post-sprint (`pnpm tsc --noEmit`) | 30 min CI | Seuil : 0 erreur |
| Mini-audit D-Ops : verif presets DB + SSE + tableau croise | 1h Claude | Score partiel auto-check |
| Buffer bugs et corrections | 3h Claude | Risques CampaignTemplate schema |

**Sous-total Bloc 4 : ~6h Claude + ~2h Will**

---

## 2. Gain attendu sprint A

| Dimension | Score entrant (prod) | Gain sprint A | Score sortant |
|-----------|---------------------|---------------|---------------|
| D-Etat | 795 | +0 (items P2 differés S+7 non dans scope ici) | 795 |
| D-Archi | 796 | +5 (lockDuration publish-worker) | 801 |
| D-Visi | 778 | +15 (FAQ landing_ville + GSC JSON Will + adresse FR debloquee) | 793 |
| D-Qual | 712 | +54 (KB seed 4 verticales +46 + factCheckScore gate +8) | 766 |
| D-Ops | 560 | +161 (WEEKLY_REPORT email +20 + tableau croise +12 + CSV +8 + SSE +20 + CampaignTemplate +40 + ArticleFeedback +20 + CTA +8 + progress bars +17 + captureWorkerError +5 + SMTP env +3 + CTA +8) | 721 |
| TOTAL prod | 3638 | **+235** | **~3873/5000** |
| TOTAL local (base 3805) | 3805 | **+113** (hors commits deja comptes) | **~3918/5000** |

> Note methodologique : le gain "+167 securisation git push" n'est pas un gain de score scoring — il securise les 167 pts deja acquis localement. Le score prod passe de 3638 a 3805 en 30 secondes. Les +235 pts du sprint A s'appliquent ensuite au score securise (3805 → ~3918 fourchette basse, ~3950 fourchette haute selon calibration KB).

---

## 3. Effort chiffre

| Ressource | Heures | Cout |
|-----------|--------|------|
| Claude Sonnet 4.6 (code) | ~57h | ~$45 tokens |
| Will (decisions + actions) | ~3.5h | $0 (interne) |
| LLM content-gen (30j x 30 art/j) | — | ~$16 Anthropic |
| **Total sprint A** | | **~$61** |

> Detail tokens Claude code : 57h x ~5K tokens/min x 60 min = ~17M tokens input. Au taux $3/M = ~$51 input + ~$15 output = ~$66 brut. Avec cache hit 30 % estime = ~$45 net.

> LLM generation : 30 articles/j x 30j = 900 articles x $0.018/article = $16.

---

## 4. Jalons mesurables sprint A

- **J+0** : `git push origin main` confirme — score origin/main saute a ~3805 (verifier via A6-01 spot-check)
- **J+1** : WEEKLY_REPORT_EMAIL + SMTP injectes Coolify — worker peut envoyer
- **J+3** : GSC service account JSON Coolify (D11=A)
- **J+5** : lockDuration publish-worker + CTA terracotta + captureWorkerError + factCheckScore gate — Bloc 2 complet — `pnpm tsc --noEmit` 0 erreur, vitest ≥ 1376
- **J+7** : Adresse FR souscrite (D10=A) — debloque GBP (+15 pts en Q3)
- **J+10** : Tableau croise ville x articles + Export CSV livres
- **J+14** : Dashboard SSE polling + FAQ structured data landing_ville livres
- **J+18** : ArticleFeedback model complet (schema migre + UI)
- **J+21** : CampaignTemplate 6 presets seeds en prod DB + UI cards
- **J+25** : KB seed script 4 verticales x 50 facts — validation Will relecture
- **J+27** : Premier lundi avec rapport weekly-report recu email williamsjullin@gmail.com
- **J+30** : Verification independante score — spot-check 5 dimensions — cible ~3873-3918/5000

---

## 5. Gates obligatoires chaque PR

- `pnpm tsc --noEmit` : 0 erreur (seuil actuel maintenu)
- `pnpm vitest run` : >= 1376/1383 passes (baseline e573da6)
- `pnpm lint` : 0 erreur
- Bundle delta size-limit : pas de degradation > +5 KB gz vs main
- Pas de modification string `"stub.invalid"` sans propagation completes (voir AGENTS.md)

---

## 6. Risques sprint A

| Risque | Probabilite | Impact | Mitigation |
|--------|-------------|--------|------------|
| Commits locaux perdus avant push | FAIBLE (machine stable) | CRITIQUE (+167 pts) | Push immediat J+0 — action prioritaire absolue |
| CampaignTemplate schema migration en prod | MOYEN | MOYEN | Via `prisma migrate deploy` entrypoint Coolify — pattern existant |
| KB seed 4 verticales : facts inventes | HAUT | HAUT (qualite) | Doctrine ZERO INVENTION — seules sources verifiables INSEE/INSEE/INPI/sectorielles |
| SMTP non configure Coolify | BAS (si deja fait) | MOYEN | Verifier vars existantes avant d'en creer de nouvelles |
| D22 no-table vs Featured Snippets comparison.ts | HAUT (conflict confirme) | MOYEN | Trancher D22 avant J+14 si scope Sprint A (sinon differ Sprint B) |
| AI Act art. 50 deadline 2026-08-02 (J+72) | N/A Sprint A | CRITIQUE | Conforme a 100 % — promptHash reel 9/9, AiContentDisclaimer 100 % pages IA |

---

## 7. Connexions sprints suivants

Sprint A livre le socle operationnel qui debloque :

- **Sprint B (J31-J60)** : comparison.ts Featured Snippets (si D22 tranchee), ArticleFeedback analytics, heatmap France SVG, Logs viewer, GBP activation (apres adresse FR J+7)
- **Sprint C (J61-J90)** : vérif compliance AI Act J+72 (2026-08-02), scale 30→100 articles/j, correlationId, mini-audit qualite
- **Sprint D/E** : GO ≥ 4500 estime J+250 (~2027-01-27)

---

## 8. Decomposition sous-sprints detaillee

### S+8a : Securisation + Quick Wins (J1-J7) — 5.2h Claude + 2h Will

```
J0 (MAINTENANT) : git push origin main (commits 023266f9 + 5d8e8b6f + 7236dfd0)   [Will — 30 sec]
J1              : Coolify env WEEKLY_REPORT_EMAIL + SMTP                            [Will — 30 min]
J1              : lockDuration content-publish-worker.ts                            [Claude — 10 min]
J2              : CTA terracotta persistant sidebar admin                           [Claude — 1h]
J2              : captureWorkerError 3 workers restants                             [Claude — 1h]
J3              : GSC service account JSON Coolify (D11)                            [Will — 30 min]
J3              : factCheckScore gate publish-worker                                [Claude — 1h]
J4-J5           : Progress bars CoverageDetailV2                                    [Claude — 2h]
J5              : Validation gates (tsc + vitest + lint)                            [CI — auto]
J7              : Adresse FR souscription Sedomicilier (D10)                        [Will — 1h]
```

### S+8b : Dashboard + FAQ (J8-J14) — 12h Claude

```
J8-J10  : Tableau croise ville x articles x verticale + Export CSV                  [Claude — 5h]
J11-J13 : Dashboard SSE polling 15s compteurs BullMQ                                [Claude — 5h]
J14     : Structured data FAQ landing_ville (FAQ schema + Speakable)                [Claude — 2h + vitest]
```

### S+8c : Console Admin (J15-J25) — 32h Claude + 1h Will

```
J15-J16 : ArticleFeedback schema Prisma + migration + endpoint + UI thumbs          [Claude — 6h]
J17-J21 : CampaignTemplate 6 presets schema + seed + UI cards                       [Claude — 10h]
J22-J25 : KB seed script 4 verticales x 50 facts minimum                            [Claude — 16h]
J25     : Relecture facts KB par Will (~1h)                                          [Will — 1h]
```

### S+8d : Stabilisation (J26-J30) — 5h Claude + 1h Will

```
J26-J27 : Vitest specs supplementaires workers + KB                                  [Claude — 2h]
J27     : Premier rapport email lundi recu et verifie (Will)                         [Will — 30 min]
J28-J29 : Fix bugs eventuels Bloc 3 + typecheck global                               [Claude — 2h]
J30     : Spot-check score 5 dimensions par agent verification                       [Claude — 1h]
```

---

## 9. Synthese executive

Sprint A se concentre sur **3 objectifs** :

1. **Securiser les 167 pts locaux** : `git push origin main` immediatement — risque zero tolerance.
2. **Activer l'operations quotidienne** : weekly-report email Will (15 min Coolify) + tableau croise + CampaignTemplate presets → D-Ops de 560 vers ~720 (+161 pts).
3. **Renforcer la qualite editoriale** : KB seed 4 verticales + factCheckScore gate → D-Qual de 712 vers ~766 (+54 pts).

**Score prod entrant** : 3638/5000 (72.8 %)
**Score prod sortant cible** : ~3873/5000 (77.5 %) — delta **+235 pts**
**Score local post-push** : ~3918/5000 (78.4 %) — delta **+113 pts** depuis 3805
**Verdict post-Sprint A** : 🟡 CONDITIONNEL — seuil GO (4500) toujours a 582-627 pts
**Coût Sprint A** : ~$61 (tokens Claude $45 + generation content $16)

> Le vrai levier score vers GO est le contenu genere en production (Sprint B+C). Sprint A livre l'outillage operationnel qui rend Will autonome (tableau croise, rapport hebdo, presets campagnes) et permet le suivi qualite reel sans intervention Claude.

---

*A6-03 — AUDIT-ONLY — version P6.1 — 2026-05-22*
*Agent : Claude Sonnet 4.6 — Axion-IA Content-Gen Perfection 2026*
*Zéro commit — Zéro modif code — Document seul*
