# ROADMAP D'EXÉCUTION CHIFFRÉE — AxionIA Content-Gen Perfection 2026
## Date: 2026-05-22 | Score: 3638/5000 | GO estimé: J+270-300

---

## VISION 12 MOIS

Score 3638 → ≥4500 (GO) en ~J+300 (scénario normal) ou ~J+180 (scénario accéléré D-Ops focus)

```
Scénario NORMAL:    3638 → 3764 → 3906 → 3966 → 4084 → 4333 → ≥4500 (6 sprints, J+300)
Scénario ACCÉLÉRÉ: 3638 → 3831 → 4046 → 4246 → ≥4500 (4 sprints, focus D-Ops, J+180)
```

### Scores par dimension — état J0

| Dimension | Score J0 | Max | Gap |
|-----------|----------|-----|-----|
| D-Etat    | 795/1000 | 1000 | -205 |
| D-Archi   | 796/1000 | 1000 | -204 |
| D-Visi    | 778/1000 | 1000 | -222 |
| D-Qual    | 770/1000 | 1000 | -230 |
| D-Ops     | 580/1000 | 1000 | -420 |
| **TOTAL** | **3638/5000** | **5000** | **-862** |

**Focus prioritaire : D-Ops (-420) est le levier principal. +420 pts D-Ops suffiraient seuls au GO si les autres dimensions progressent modérément.**

---

## SPRINT A — J0 à J30 (2026-05-22 → 2026-06-21)
**Score entrant: 3638 | Score sortant estimé: 3764 (+126)**

### A.1 — Actions Will urgentes (J+1 à J+3) — ~3h Will total

| Action | Effort | Gain pts | Dimension |
|--------|--------|----------|-----------|
| git push origin main (commits locaux en attente) | 30 sec | Sécurise le travail | — |
| SMTP env Coolify (WEEKLY_REPORT_EMAIL → rapport hebdo actif) | 15 min | +20 | D-Ops |
| GSC service account JSON → Coolify (impressions dashboard) | 30 min | +10 | D-Visi |
| Sedomicilier.fr souscription (~30€/mois) | 30 min | +0 (effet J+30) | — |
| CampaignTemplate seed: `pnpm content-gen:seed-templates` | 5 min | +15 | D-Ops |
| `pnpm exec prisma migrate deploy` (migrations P5 en attente) | 5 min | +10 | D-Ops |
| **Sous-total A.1** | **~1h30 Will** | **+55** | |

### A.2 — Sprint code Claude (J+3 à J+21) — ~30h Claude

| Item | Effort Claude | Gain pts | Dimension | Prérequis |
|------|--------------|----------|-----------|-----------|
| lockDuration `content-publish-worker.ts` (10 min fix) | 10 min | +5 | D-Archi | — |
| `captureWorkerError` quality-improver manquant | 30 min | +5 | D-Archi | — |
| Alert badge sidebar dynamique (nb anomalies) | 3h | +8 | D-Ops | SMTP A.1 |
| Onboarding guidé 0 campagnes (first-run wizard) | 2h | +10 | D-Ops | — |
| Mobile hamburger menu admin (responsive V2) | 1h | +8 | D-Ops | — |
| KB sectorielle `interventions_formations` (pilote 8h) | 8h | +23 | D-Qual | D9 décidé |
| KB sectorielle `un_a_un` (4h) | 4h | +8 | D-Qual | D9 décidé |
| KB sectorielle `implementations` (2h) | 2h | +8 | D-Qual | D9 décidé |
| KB sectorielle `sites_web_augmentes` (2h) | 2h | +7 | D-Qual | D9 décidé |
| Export CSV tableau croisé ville×articles admin | 2h | +5 | D-Ops | — |
| `seed-kb-facts.ts` (déploiement prod) | 2h | +5 | D-Qual | — |
| **Sous-total A.2** | **~27h Claude** | **+92** | | |

### A.3 — Validation (J+21 à J+30)

| Item | Effort | Impact |
|------|--------|--------|
| Vérification P5 light (2 agents, 2h) | 2h Claude | Certifier score D-Ops réel |
| Test pipeline 30 art/j × 7 jours | Auto | Confirmer uptime + qualité |
| Review GSC impressions J+21 | 15 min Will | Confirmer indexation nouvelle KB |

### Récap Sprint A

| Dimension | Entrant | Gain | Sortant |
|-----------|---------|------|---------|
| D-Etat    | 795 | +0  | 795 |
| D-Archi   | 796 | +10 | 806 |
| D-Visi    | 778 | +10 | 788 |
| D-Qual    | 770 | +51 | 821 |
| D-Ops     | 580 | +55 | 635 |
| **TOTAL** | **3638** | **+126** | **3764** |

**Effort Sprint A:** ~30h Claude + ~3h Will
**Coût LLM génération:** ~$90 (900 articles rampe 0→30/j × $0.10)
**Coût dev Claude Code:** ~$30

---

## SPRINT B — J31 à J60 (2026-06-21 → 2026-07-21)
**Score entrant: 3764 | Score sortant estimé: 3906 (+142)**

### B.1 — Actions Will (J+31 à J+33) — ~2h Will

| Action | Effort | Gain pts | Dimension |
|--------|--------|----------|-----------|
| Validation adresse Sedomicilier.fr (confirmation) | 15 min | Déblocage GBP | — |
| Google Business Profile création + vérification | 1h | +15 | D-Visi |
| Rampe MAX_PUBLISH 30→50 (si J+21 KPIs OK: LLM-judge ≥65, rejet <30%) | 5 min | Volume | — |
| Décision D22 (comparison featured snippets: A=tableaux / B=prose) | 5 min | Déblocage B.2 | — |
| **Sous-total B.1** | **~2h Will** | **+15** | |

### B.2 — Sprint code Claude (~39h)

| Item | Effort Claude | Gain pts | Dimension | Note |
|------|--------------|----------|-----------|------|
| `comparison.ts` Featured Snippets (tableaux HTML si D22=A) | 4h | +20 | D-Visi | Nécessite D22 |
| Prompts partials `_vertical-{v}.ts` ×4 verticales | 8h | +20 | D-Qual | — |
| `ArticleFeedback` model + UI thumbs up/down | 6h | +20 | D-Ops | — |
| Dashboard polling SSE + badge compteurs live | 6h | +20 | D-Ops | — |
| Logs viewer content-gen (filtres par worker/niveau) | 5h | +15 | D-Ops | — |
| Monitoring coût LLM dashboard ($/art × provider) | 4h | +10 | D-Archi | — |
| Structured data FAQ `landing_ville` (JSON-LD FAQPage) | 4h | +10 | D-Visi | — |
| Heatmap France placeholder → données réelles articles | 8h | +15 | D-Ops | — |
| Backlink pitch template presse (JDN/Frenchweb email) | 2h | +5 | D-Visi | — |
| Mini-audit J+45 (3 agents, 2h) — mesure dérive | 2h | mesure | — | — |
| **Sous-total B.2** | **~49h Claude** | **+135** | | |

### Récap Sprint B

| Dimension | Entrant | Gain | Sortant |
|-----------|---------|------|---------|
| D-Etat    | 795 | +0  | 795 |
| D-Archi   | 806 | +10 | 816 |
| D-Visi    | 788 | +50 | 838 |
| D-Qual    | 821 | +27 | 848 |
| D-Ops     | 635 | +55 | 690 |
| **TOTAL** | **3764** | **+142** | **3906** |

**Effort Sprint B:** ~39h Claude + ~2h Will
**Coût LLM génération:** ~$180 (1800 articles rampe 30→100/j moy. 65/j × $0.10)
**Coût dev Claude Code:** ~$40

---

## SPRINT C — J61 à J90 (2026-07-21 → 2026-08-19)
**Score entrant: 3906 | Score sortant estimé: 3966 (+60)**
**⚠️ AI Act deadline: 2026-08-02 (J+71) — vérification compliance OBLIGATOIRE**

### C.1 — Actions Will (J+61 à J+63) — ~3h Will

| Action | Effort | Gain |
|--------|--------|------|
| Rampe MAX_PUBLISH 50→100 (si J+45 KPIs verts) | 5 min | Volume |
| *(Will)* Backlinks trimestriel #1 (email JDN + Frenchweb) | 2h | +20 D-Visi |
| *(Will)* GBP posts x3 (contenu IA, cas client, event) | 1h | +8 D-Visi |

### C.2 — Checklist AI Act compliance J+71 (OBLIGATOIRE)

- [ ] `AiContentDisclaimer` présent sur 100% des pages publiques IA-assistées
- [ ] `aiGenerated: true` dans JSON-LD de tous les articles publiés
- [ ] `GenerationProvenance.promptHash` = hash du prompt réel (non le jobId)
- [ ] `schema.prisma` : `onDelete: Restrict` vérifié (✅ 2026-05-22)
- [ ] Route RGPD `/forget` opérationnelle (RESTRICT compatible via soft-delete)
- [ ] Nom modèle IA exact dans `AI_MODEL_DISCLOSURE_NAME` env var (ex: `claude-sonnet-4-6`)

### C.3 — Sprint code Claude (~25h)

| Item | Effort Claude | Gain pts | Dimension |
|------|--------------|----------|-----------|
| Vérif + correctifs compliance AI Act J+71 | 2h | +10 | D-Archi |
| `correlationId`/`traceId` workers (traçabilité logs) | 2h | +8 | D-Archi |
| Circuit breakers partagés inter-process | 3h | +8 | D-Archi |
| Monitoring tonalité brand-voice auto | 6h | +10 | D-Ops |
| Script analytics attribution leads/contenu | 4h | +10 | D-Ops |
| Featured Snippets optimisation structurée (FAQ + HowTo) | 4h | +10 | D-Visi |
| P0-10 saga post-publish (retry séparé, DLQ) | 3h | +8 | D-Archi |
| **Sous-total C.3** | **~24h Claude** | **+64** | |

### Récap Sprint C

| Dimension | Entrant | Gain | Sortant |
|-----------|---------|------|---------|
| D-Etat    | 795 | +0  | 795 |
| D-Archi   | 816 | +34 | 850 |
| D-Visi    | 838 | +10 | 848 |
| D-Qual    | 848 | +5  | 853 |
| D-Ops     | 690 | +20 | 710 |
| **TOTAL** | **3906** | **+69** | **3975** |

**Effort Sprint C:** ~24h Claude + ~3h Will
**Coût LLM génération:** ~$200 (2000 articles rampe 100→200/j moy. ~150/j × $0.10)
**Coût dev Claude Code:** ~$25

---

## SPRINT D — J91 à J180 (2026-08-19 → 2026-11-16)
**Score entrant: ~3975 | Score sortant estimé: ~4084 (+109)**

### D.1 — Actions Will (tranche 90 jours)

| Action | J-cible | Gain pts | Dimension |
|--------|---------|----------|-----------|
| Rampe MAX_PUBLISH 100→200 | J+120 (si KPIs verts J+90) | +15 | D-Etat |
| Backlinks presse #2 (JDN/Frenchweb follow-up) | J+120 | +15 | D-Visi |
| Conférences IA (1-2 events Q4 2026) | J+150-180 | +10 | D-Visi |
| GBP posts réguliers (3/mois minimum) | Mensuel | +10 | D-Visi |

### D.2 — Sprint code Claude (~52h)

| Item | Effort Claude | Gain pts | Dimension | Condition |
|------|--------------|----------|-----------|-----------|
| Audit qualité intermédiaire (gate trajectory) | 8h | mesure | D-Qual | — |
| GSC `SearchAnalytics` → dashboard interne | 4h | +20 | D-Visi | GSC JSON A.1 |
| Bilingue EN Sprint complet (si D14=B validé) | 20h | +15 | D-Etat | D14 Will |
| Prompt caching Anthropic (économie LLM ~35%) | 4h | +0 pts / -$1500 coûts | Infra | — |
| Optimisation prompts post-mini-audit J+90 | 8h | +25 | D-Qual | Audit C3 |
| Audit qualité #3 (200 articles sampling) | 6h | +20 | D-Qual | — |
| Monitoring automatique qualité (alertes dérive) | 8h | +10 | D-Ops | — |
| KB refinement secteurs (post-production data) | 10h | +15 | D-Qual | 3 mois data |
| Page `/transparence-ia` métriques live (D20) | 4h | +10 | D-Etat | D20 Will |
| **Sous-total D.2** | **~52h Claude** | **+115** | | |

### Récap Sprint D

| Dimension | Entrant | Gain | Sortant |
|-----------|---------|------|---------|
| D-Etat    | 795 | +25 | 820 |
| D-Archi   | 850 | +5  | 855 |
| D-Visi    | 848 | +50 | 898 |
| D-Qual    | 853 | +60 | 913 |
| D-Ops     | 710 | +15 | 725 |
| **TOTAL** | **3975** | **+155** | **4130** |

**Effort Sprint D:** ~52h Claude + ~5h Will
**Coût LLM génération:** ~$2700 (27 000 articles sur 90j rampe 200→300/j × $0.10)
**Coût dev Claude Code:** ~$60

---

## SPRINT E — J181 à J270 (2026-11-16 → 2027-02-13)
**Score entrant: ~4130 | Score sortant estimé: ~4333 (+203)**

| Item | Effort Claude | Effort Will | Gain pts | Dimension |
|------|--------------|-------------|----------|-----------|
| Scale 300→500/j progressive | — | 5 min | +30 | D-Etat |
| Migration Claude 5 (si disponible + budget) | 8h | — | +25 | D-Qual |
| Backlinks trimestriel #3 + autoritaires (CNRS, inria) | — | 3h | +30 | D-Visi |
| CampaignTemplate avancé (personnalisation persona) | 8h | — | +25 | D-Ops |
| Monitoring tonalité automatisé (alertes brand-voice) | 4h | — | +15 | D-Ops |
| Featured Snippets scale (10+ comparatifs publiés) | 4h | — | +20 | D-Visi |
| Audit qualité #4 (500 articles sampling) | 8h | — | +25 | D-Qual |
| Page `/transparence-ia` métriques live (si D20=A) | 4h | 1h | +20 | D-Etat |
| `SIREN`/`SIRET` dans JSON-LD Organisation (D21) | 2h | société créée | +15 | D-Archi |
| Mini-sprints correctifs résiduels post-audit #4 | 16h | — | +35 | Toutes |
| **Sous-total Sprint E** | **~54h Claude** | **~9h Will** | **+240** | |

### Récap Sprint E

| Dimension | Entrant | Gain | Sortant |
|-----------|---------|------|---------|
| D-Etat    | 820 | +55 | 875 |
| D-Archi   | 855 | +15 | 870 |
| D-Visi    | 898 | +50 | 948 |
| D-Qual    | 913 | +50 | 963 |
| D-Ops     | 725 | +40 | 765 |
| **TOTAL** | **4130** | **+210** | **4340** |

**Effort Sprint E:** ~54h Claude + ~9h Will
**Coût LLM génération:** ~$4500+ (45 000 articles à $0.10)

---

## SPRINT F — J271+ → GO ≥4500 (~2027-03-17)
**Score entrant: ~4340 | Score sortant cible: ≥4500 (+160)**

| Item | Gain estimé | Dimension |
|------|-------------|-----------|
| Scale 500→700/j si CA justifie | +20 | D-Etat |
| Backlinks autoritaires x10 cumulés | +25 | D-Visi |
| D-Ops hardening final (SSE + circuit breakers prod) | +30 | D-Ops |
| Audit content-gen perfection 2027 (méthode P1-P6) | mesure | — |
| Mini-sprints correctifs audit 2027 | +80 | Toutes |

**GO ≥ 4500/5000 estimé: J+300 (~2027-03-17)**
**Score maturité J+365 estimé: ~4551-4650/5000**

---

## TABLEAU COÛTS CUMULÉS PAR SPRINT

| Sprint | J0 | J+30 | J+60 | J+90 | J+180 | J+270 | J+365 |
|--------|----|------|------|------|-------|-------|-------|
| Dev Claude Code ($) | 0 | 30 | 70 | 95 | 155 | 209 | 269 |
| Génération LLM ($) | 0 | 90 | 270 | 470 | 3170 | 7670 | 12170 |
| Infra Hetzner ($) | 0 | 17 | 33 | 50 | 100 | 150 | 200 |
| Adresse FR Sedomicilier ($) | 0 | 0 | 33 | 66 | 166 | 266 | 400 |
| **TOTAL cumulé** | **$0** | **$137** | **$406** | **$681** | **$3 591** | **$8 295** | **$13 039** |

*(Scénario BASE: rampe 0→30→100→200→500/j. Sans Ahrefs. Prompt caching Anthropic activé J+120 réduit génération ~35%.)*

---

## TABLEAU DE BORD GO/STOP — Critères d'escalade

| Critère | Seuil STOP | Action |
|---------|-----------|--------|
| Impressions GSC chute > 20% après scale | En 2 semaines | Réduire MAX_PUBLISH à N-1 palier |
| Score LLM-judge moyen < 65/100 | Hebdo | Review SYSTEM_PROMPT + `brand-voice.ts` |
| Taux rejet > 30% | Hebdo | Ajuster seuil qualité ou prompt |
| Coût LLM > 120% budget prévu | Mensuel | Cap Anthropic + review prompts + activer caching |
| 0 article indexé Google sur 100 publiés | J+30 | Audit indexation urgent (GSC + Search Console API) |
| D-Ops < 650 à J+60 | J+60 | Sprint correctif D-Ops prioritaire (dépasse B.2) |
| AI Act compliance < 100% | J+71 | STOP publication + correctif immédiat |

---

## DÉCISIONS BLOQUANTES PAR SPRINT

| Décision | Par qui | Sprint impacté | Délai max |
|----------|---------|---------------|-----------|
| D9: KB sectorielle périmètre exact | Will | Sprint A (KB volume) | J+7 |
| D14: Bilingue EN ou non | Will | Sprint D (20h dev) | J+60 |
| D20: Page /transparence-ia publique | Will | Sprint D ou E | J+90 |
| D21: SIREN/SIRET société constituée | Will | Sprint E | J+180 |
| D22: comparison.ts tableaux (A) ou prose (B) | Will | Sprint B | J+31 |
| Rampe 30→100 J+30 | Will (KPIs) | Sprint B volume | J+30 |
| Rampe 100→200 J+90 | Will (KPIs) | Sprint D volume | J+90 |
| Rampe 200→500 J+180 | Will (CA justifié) | Sprint E volume | J+180 |

---

## HORIZON 365j — MATURITÉ AVANCÉE

- **Score estimé J+365:** ~4551-4650/5000
- **Articles publiés cumulés:** ~85 000
- **Audit content-gen perfection 2027:** mai 2027 (méthode P1-P6 répétée)
- **Évolution modèles IA:** `AI_MODEL_DISCLOSURE_NAME` env var prêt pour migration Claude 5
- **Backlinks cumulés estimés:** 12-18 référents de qualité (presse spécialisée IA)
- **GBP:** 50+ posts, fiche mature, note Google ≥ 4.5 visée

---

*Roadmap générée le 2026-05-22 — Claude Sonnet 4.6 — AUDIT-ONLY*
*Score de départ RÉEL: 3638/5000 (score 3805 était CONDITIONNEL, avant corrections P6)*
*Décisions figées: D-W1→D-W5, D-P5-1→D-P5-6, D1-D5, D7 (société française pure)*
*Exclusions: Wikidata, DPA Anthropic, CF WAF*
*Prochaine mise à jour recommandée: J+45 (mini-audit) puis J+90 (Sprint C clôture)*
*Détails par sprint: `agents/A6-03.md` à `agents/A6-07.md`*
