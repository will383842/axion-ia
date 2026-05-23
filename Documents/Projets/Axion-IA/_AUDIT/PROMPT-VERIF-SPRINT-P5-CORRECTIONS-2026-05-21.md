# PROMPT VÉRIFICATION SPRINT P5 — CONSOLE ADMIN & SUIVI OPS
## AxionIA Content-Gen Perfection 2026 — Audit post-sprint P5

**Date création** : 2026-05-21
**Sprint vérifié** : `_AUDIT/PROMPT-SPRINT-P5-CORRECTIONS-2026-05-21.md`
**Verdict de référence à valider** : `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-5/VERDICT-SPRINT-P5-CORRECTIONS.md`
**Score baseline pré-sprint** : 315/1000
**Score cible post-sprint** : ≥ 637/1000
**Mode** : **AUDIT-ONLY strict**
**Effort estimé** : 5-7h autopilot (10 sous-agents parallèles + tests UI browser intensifs)

---

## 0. PRINCIPE GÉNÉRAL

P5 est différent : c'est de la **console admin UI**. Les tests fonctionnels sont **navigateur réel obligatoire** (pas juste lecture code).

4 objectifs :
1. **Spec compliance** — chaque P0/P1 du prompt P5 implémenté correctement ?
2. **Décisions Will D-P5-1 à D-P5-6 appliquées** — 6 presets, seuil 60/100, reporting lundi 8h, tableau croisé, MAX_PUBLISH UI, ordre A puis B ?
3. **Tests UI navigateur réels** — démarrer `pnpm dev`, naviguer dans `/content-gen/*`, tester boutons pause/resume, CTA terracotta, presets, tableau croisé, dashboard temps réel.
4. **Cross-sprint impact** — P5 lit configs de P4 (seuil REJECT, itérations) → vérifier que UI affiche les bonnes valeurs.

Verdict scoré `/1000` honnête.

---

## 1. CONTEXTE — À LIRE AVANT

### État repo
- **Remote** : `https://github.com/will383842/axion-ia.git`
- **HEAD origin/main pré-sprint** : `0906722`
- **HEAD origin/main au lancement vérif** : à découvrir

### Fichiers à lire (ordre)
1. `_AUDIT/PROMPT-SPRINT-P5-CORRECTIONS-2026-05-21.md` (spec)
2. `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-5/VERDICT-SPRINT-P5-CORRECTIONS.md` (verdict livré)
3. `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-5/PHASE-5-VERDICT.md` (audit initial 315/1000)
4. `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-5/agents/A5-01.md` à `A5-08.md`
5. Mémoire `axionia_p5_decisions_canoniques_2026-05-21.md` (6 décisions Will)
6. Mémoire `axionia_sprint_p5_corrections_livre_2026-05-21.md`
7. Mémoire `axionia_p4_decisions_canoniques_2026-05-21.md` (D1-D5 que UI P5 doit afficher)

### Mode AUDIT-ONLY
- ❌ Aucun commit, push, modif code
- ✅ `pnpm dev` (démarrage serveur) — autorisé en lecture seule
- ✅ Diagnostics, navigation browser
- ✅ Création de fichiers UNIQUEMENT dans `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-5/verification/`
- ✅ Screenshots browser (optionnel mais recommandé pour preuves)

---

## 2. SPAWN 10 SOUS-AGENTS PARALLÈLES

### V5-01 — Décisions Will D-P5-1 à D-P5-6 appliquées (/150)
**CRITIQUE**.

#### D-P5-1 6 presets validés (/40)
- Modèle Prisma `CampaignTemplate` créé ?
- Migration `20260521150000_add_campaign_template_and_feedback` appliquée ?
- Seed `seed-campaign-templates.ts` exécuté → 6 rows en table `campaign_templates` ?
- Slugs exacts : `pme-audits`, `interventions-weekly`, `tpe-burst`, `eti-pilier`, `cities-paris`, `rss-daily`
- Test SQL : `SELECT slug, name FROM campaign_templates WHERE is_active = true ORDER BY slug;` → doit retourner 6 rows
- Test fonctionnel UI : `/content-gen/templates` affiche les 6 cards

#### D-P5-2 seuil qualité 60/100 (/20)
- `ContentGenConfig.key="quality_reject_threshold"` value `60` en DB ?
- UI affiche-t-elle "60/100" et pas "6.0/10" ?
- Cohérence avec D1 P4 (6.0/10 = 60/100) ?

#### D-P5-3 reporting lundi 8h (/30)
- Cron worker `weekly-quality-report-worker.ts` créé ?
- Schedule cron `0 8 * * 1` (lundi 8h CET) ?
- Destinataire `williamsjullin@gmail.com` (env var ou hardcoded) ?
- Contenu rapport : articles publiés/refusés, qualité moyenne, coût semaine, villes, alertes ?
- Test : déclencher manuellement le worker → vérifier email envoyé (logs)

#### D-P5-4 tableau croisé (pas heatmap) (/30)
- Page `/content-gen/geo/coverage-table` créée ?
- Server Action `getJobsByVilleAndSector()` créée ?
- Tableau filtrable + triable + export CSV ?
- AUCUNE heatmap SVG ajoutée (D-P5-4 explicite : tableau, pas heatmap)

#### D-P5-5 MAX_PUBLISH_PER_DAY UI (/15)
- Input numérique "Cap global articles/jour" dans `BatchesV2` ou dashboard ?
- Range 1-1000 ?
- Stockage `ContentGenConfig.key="MAX_PUBLISH_PER_DAY"` ?
- Audit trail `auditLog()` SOC2 ?

#### D-P5-6 ordre A puis B respecté (/15)
- Phase A (quick wins UX) commits AVANT Phase B (CampaignTemplate) dans git log ?
- Si Phase B commité avant Phase A : -5 pts

### V5-02 — P0-1 boutons pause/resume liste (/80)
- `CoverageListV2.tsx` (ou équivalent) modifié ?
- Pour chaque ligne campagne : bouton Pause si `status="running"`, Resume si `paused` ?
- Server Actions `pauseCampaign`/`resumeCampaign` câblées ?
- Style icon-only + tooltip + couleur neutral ?
- Test UI navigateur : créer 1 campagne test → pause via bouton → vérifier status DB + UI rafraîchi → resume → idem
- Test : pause/resume jamais visible pour `completed`/`failed`

### V5-03 — P0-2 CTA terracotta persistant (/60)
- Bouton "Nouvelle campagne" couleur `#c24a1b` (terracotta) ?
- Présent dans header sticky layout content-gen ?
- Visible sur 22+ sous-pages (pas juste dashboard) ?
- Test UI : naviguer `/content-gen/coverage`, `/quality`, `/geo`, `/costs` → CTA visible et terracotta
- Lien vers `/content-gen/coverage/new` ?

### V5-04 — P0-3 MAX_PUBLISH_PER_DAY UI (/40)
- Couvert par V5-01 D-P5-5 — focus ici sur UX
- Validation refuse < 1 ou > 1000 (erreur inline) ?
- Worker `content-publish-worker.ts` lit-il vraiment depuis DB cette valeur ?
- Test : changer en UI 30 → 50 → vérifier worker respecte le nouveau cap (générer 60 jobs → 50 publiés max le jour J)

### V5-05 — P0-4 qualityImprovementAttempts affiché (/30)
- `ReviewDetailV2.tsx` affiche "Itérations qualité : X/Y" ?
- Y = 2 ou 3 selon contentType (cohérent D2 P4) ?
- Badge couleur : gris X=0, jaune X=1, rouge X=2/3 ?

### V5-06 — P0-5 dashboard regroupé ≤7 liens (/50)
- Dashboard regroupé en 4 sections ?
  - 🎯 Pilotage (Coverage, Costs, Quality, Geo)
  - 🛠️ Sources (RSS, Keywords seeds, KB, Image-bank)
  - 📊 Suivi (Jobs, Articles, Cities, Provenance)
  - ⚙️ Réglages (Providers, Templates, Workers, Settings)
- Compteur badge sur chaque lien ?
- Test UI : screenshot dashboard → 4 sections distinctes visibles

### V5-07 — P1 CampaignTemplate UI complet (/120)
- Page `/content-gen/templates` (liste cards 6 presets) ?
- Preview résumé par card (verticales, types, batchSize, dailyCap) ?
- Bouton "Utiliser ce preset" → `/content-gen/coverage/new?preset=<slug>` ?
- Formulaire création campagne pré-rempli depuis preset ?
- Banner "Démarrage depuis preset : X. Vous pouvez modifier..." ?
- Bouton "Retirer le preset" reset form ?
- Test UI : clic preset → formulaire pré-rempli → modifier 1 champ → soumettre → vérifier création DB

### V5-08 — P1 ArticleFeedback + tableau croisé + progress + dashboard actif (/180)

#### ArticleFeedback (/40)
- Modèle Prisma `ArticleFeedback` créé ?
- Migration appliquée ?
- Endpoint `POST /api/admin/content-gen/articles/[id]/feedback` ?
- UI thumbs up/down dans `ReviewDetailV2` ?
- Test UI : cliquer thumb → vérifier insert DB

#### Tableau croisé géo (/50)
- Server Action `getJobsByVilleAndSector()` retourne `groupBy [anchorVilleSlug, serviceSector, publishStatus]` ?
- Tableau HTML triable, filtrable (ville/verticale/état) ?
- Pagination 50 lignes/page ?
- Export CSV : bouton fonctionnel, fichier généré client-side ?
- Test UI : ouvrir page → trier par ville → filtrer "audits" → export CSV → vérifier contenu fichier

#### Progress bars (/40)
- Progress bar 39/120 villes dans dashboard et CityCoverageV2 ?
- Couleur : <33% rouge, 33-66% orange, >66% vert ?
- Progress bar dans CoverageDetailV2 (articles publiés / target) ?
- Test UI : screenshot — barre visible et colorée

#### Dashboard campagnes actives (/30)
- 3-5 cartes campagne running affichées ?
- Nom + progress + articles aujourd'hui + ETA + statut ?
- ETA = `(target - published) / velocity` ?
- Test UI : créer 2 campagnes running → vérifier visibilité dashboard

#### Anomaly detection batch (/20)
- Worker `content-monitoring-worker.ts` créé/modifié ?
- 3 checks toutes les 15 min ?
- Badge rouge sidebar admin si `alert_count > 0` ?
- Test : simuler 0 articles depuis 4h → vérifier badge

### V5-09 — Cross-sprint impact P3+P4 (/120)
**CRITIQUE**.

#### Croisement P5 ↔ P4
- UI P5 lit-elle `ContentGenConfig.key="quality_reject_threshold"` (D1 P4 = 60) ? Doit afficher 60.
- UI P5 lit-elle `quality_max_iterations_long/short` (D2 P4) ? Doit afficher 3 et 2.
- Si UI hardcode des valeurs différentes : -30 pts (drift configuration)
- P5 ne doit PAS toucher generators, llm-judge, KB (P4 territory) — grep `src/server/content-gen/` non touché par P5 sauf admin/coverage.ts etc.
- ArticleFeedback (P5) ne doit PAS être créé par P4

#### Croisement P5 ↔ P3
- Pas de conflit attendu structurel
- Vérifier que P5 n'a pas modifié `src/components/seo/*.tsx`
- Vérifier que P5 n'a pas modifié `src/lib/seo.ts`
- Si P5 dashboard montre KPIs SEO (impressions, clics) → lit-il bien GSC API préparée par P3 ? Status (peut être encore stub si DW-3-03 Will pas fait)

#### Migrations Prisma cross-sprint
- P5 migration `20260521150000_add_campaign_template_and_feedback` créée et appliquée ?
- P4 migration `20260521160000_add_factcheck_claims_and_kb_sectorielle` créée ?
- Timestamps : P5 (15h) < P4 (16h) ?
- `prisma migrate status` no drift
- `prisma validate` OK

Score : 120 max

### V5-10 — UX simplicité globale (/100)
- Onboarding déclenché à 0 campagnes ? (sans nécessiter commande CLI)
- Navigation ≤ 7 liens niveau 1 (loi de Hick) ?
- Couleurs respectent brand (terracotta CTAs, ivoire fond, bleu pointes seulement) ?
- Responsive mobile (sidebar hamburger) ?
- Accessibility : alt texts, aria-labels, contrastes WCAG AA ?
- Test UI : Lighthouse audit Accessibility → score ≥ 90

### Cross-cutting orchestrateur (/100)
- Cohérence inter-agents (V5-01 à V5-10) : 0 contradiction
- Tests UI navigateur effectués (preuves : screenshots ou logs)
- Recommandations P0/P1/P2 prioritisées
- Score : 100 max

**TOTAL : 1000 pts**

---

## 3. GATES ANTI-RÉGRESSION OBLIGATOIRES

```powershell
pnpm typecheck   # 0 erreur
pnpm lint        # 0 erreur
pnpm test        # vitest XXXX/XXXX — ≥ baseline 1376/1383
pnpm content-gen:isolation-check  # 0 violation
pnpm prisma migrate status  # no drift
pnpm prisma validate  # OK
pnpm build        # 0 erreur build (P5 = UI compile must succeed)
```

**Si régression vs baseline → PÉNALITÉ -100 pts** + détail dans verdict.

---

## 4. TESTS UI NAVIGATEUR RÉELS (OBLIGATOIRES)

### Prérequis
```powershell
pnpm install  # ensure deps
pnpm prisma migrate dev  # apply migrations locally
pnpm content-gen:seed-templates  # seed 6 presets
pnpm dev  # démarrer dev server (port 3000)
```

### Test 1 — Login admin + dashboard
- Naviguer `http://localhost:3000/fr/<ADMIN_PREFIX>/content-gen` (lire `ADMIN_URL_PREFIX` env var pour le chemin réel — secret)
- Login admin via session existante ou créer admin temporaire
- Vérifier : 4 sections regroupées, badges compteurs, CTA "Nouvelle campagne" terracotta visible

### Test 2 — Wizard depuis preset
- Cliquer `/content-gen/templates` → choisir preset `pme-audits` → clic "Utiliser"
- Vérifier : formulaire pré-rempli (verticale `audits`, target `pme`, types `blog_pillar,landing_ville`, batchSize 20, dailyCap 30)
- Banner "Démarrage depuis preset : PME audits..." visible
- Modifier 1 champ (ex: batchSize 20 → 30) → soumettre → vérifier création DB campagne

### Test 3 — Pause/resume liste
- Naviguer `/content-gen/coverage`
- Pour la campagne créée Test 2 (status `running`) : clic bouton Pause → vérifier status DB `paused` + UI rafraîchi
- Clic Resume → vérifier retour `running`
- Logs BullMQ : jobs purged au pause ?

### Test 4 — MAX_PUBLISH_PER_DAY UI
- Dashboard ou `BatchesV2` : trouver input "Cap global articles/jour"
- Changer 30 → 50 → submit
- Vérifier `SELECT value FROM content_gen_config WHERE key = 'MAX_PUBLISH_PER_DAY'` → `50`
- Vérifier audit trail SOC2 event `MAX_PUBLISH_CHANGED`

### Test 5 — Tableau croisé géo
- Naviguer `/content-gen/geo/coverage-table`
- Vérifier tableau affiché avec colonnes Ville × Verticale × État × Count × %
- Trier par ville → ordre alphabétique
- Filtrer verticale `audits` → seuls les jobs `audits` visibles
- Clic "Exporter CSV" → fichier téléchargé, ouvrir → contenu cohérent

### Test 6 — Progress bars
- Dashboard : barre 39/120 villes visible et colorée
- `CityCoverageV2` : barre identique
- Si 39 villes < 33% du target 120 = 32.5% → couleur rouge ?

### Test 7 — Dashboard campagnes actives
- Créer 2 campagnes running (Test 2 + 1 autre)
- Dashboard affiche 2 cartes
- Chaque carte : nom + progress + articles ce jour + ETA + statut

### Test 8 — ArticleFeedback thumbs
- Naviguer `/content-gen/quality/review/[articleId]` (un article existant)
- Clic thumb up + comment "Bon article"
- Vérifier `SELECT * FROM article_feedback WHERE article_id = '<id>'` → row inséré

### Test 9 — Anomaly detection
- Stop tous les workers content-gen pendant 4h (simulé via DB update `last_run`) ou wait réel
- Vérifier badge alerte rouge dans sidebar admin (`alert_count > 0`)
- Si Telegram webhook configuré : vérifier message reçu

### Test 10 — Lighthouse accessibility
```powershell
npx lighthouse http://localhost:3000/fr/<ADMIN_PREFIX>/content-gen --only-categories=accessibility --output=json --output-path=./lighthouse-admin.json --chrome-flags="--headless"
```
Score Accessibility ≥ 90.

### Test 11 — Reporting hebdomadaire manuel
```powershell
# Déclencher manuellement le cron worker
pnpm content-gen:trigger-weekly-report
```
Vérifier logs envoi email à `williamsjullin@gmail.com` (ou Mailhog/Mailtrap test inbox).

---

## 5. DOCTRINE COMPLIANCE

### Couleurs brand
- CTA principal terracotta `#c24a1b` (pas bleu)
- Fond ivoire `#faf8f3`
- Bleu `#1a4dd9` uniquement pour pointes/details (pas dominant)
- Grep CSS : `bg-blue-` ne doit PAS être sur boutons primaires

### Pas d'invention
- Presets seedés respectent spec D-P5-1 exactement (slugs, configs)
- Aucun preset extra inventé

### Manon doctrine
- Aucun profil social fake généré dans P5

### Accessibility
- WCAG AA contrast pour terracotta sur ivoire (vérifier 4.5:1 minimum)
- Boutons icon-only ont aria-label

---

## 6. SÉCURITÉ

- Endpoint `POST /api/admin/content-gen/articles/[id]/feedback` : vérifier auth admin (pas accessible non-loggé)
- Server Actions P5 : vérifier `requireAdmin()` ou équivalent en début
- Pas de SQL injection (Prisma parameterized)
- Audit trail SOC2 pour actions critiques (pause/resume, MAX_PUBLISH change)
- CSRF protection : Server Actions Next.js natif OK

---

## 7. PERFORMANCE & UX

- Dashboard polling 15s (ou SSE) : pas de freeze UI
- Tableau croisé géo : performance OK même avec 1000+ rows (pagination 50/page)
- Bundle size delta : P5 = beaucoup d'UI client → vérifier ≤ +50 KB gz vs baseline (composants admin déjà heavy)
- TTI Time To Interactive sur dashboard ≤ 3s

---

## 8. LIVRABLES

### Structure
```
_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-5/verification/
├── VERDICT-VERIFICATION-SPRINT-P5.md
├── CROSS-CUTTING.md
├── screenshots/   (optionnel, recommandé)
│   ├── dashboard-regrouped.png
│   ├── templates-cards.png
│   ├── coverage-table-filter.png
│   └── ...
└── agents/
    ├── V5-01.md  (Décisions D-P5-1 à D-P5-6)
    ├── V5-02.md  (P0-1 pause/resume)
    ├── V5-03.md  (P0-2 CTA terracotta)
    ├── V5-04.md  (P0-3 MAX_PUBLISH UI)
    ├── V5-05.md  (P0-4 qualityImprovementAttempts)
    ├── V5-06.md  (P0-5 dashboard regroupé)
    ├── V5-07.md  (P1 CampaignTemplate UI)
    ├── V5-08.md  (P1 ArticleFeedback + tableau + progress + dashboard actif + anomaly)
    ├── V5-09.md  (Cross-sprint P3+P4)
    └── V5-10.md  (UX simplicité globale)
```

### Format VERDICT-VERIFICATION-SPRINT-P5.md
```markdown
# VERDICT VÉRIFICATION SPRINT P5 — Console Admin
## Date : YYYY-MM-DD
## HEAD audité : <SHA>
## Score baseline pré-sprint : 315/1000
## Score sprint déclaré : XXX/1000
## **Score vérifié : XXX/1000**

## Verdict global
✅ GO si ≥ 637
🟡 CONDITIONAL si 500-636
🔴 RÉGRESSION si < 315

## Décisions Will D-P5-1 à D-P5-6 — statut
| Décision | Spec | Implémenté ? | Score |

## Scores par agent (V5-01 à V5-10)
| Agent | Score | Max |

## Items OK ✅
## Items partiels ⚠️
## Items manquants 🔴

## Cross-sprint conflicts
| Sprint | Conflit | Sévérité |

## Tests UI navigateur résultats (11 tests)
- Test 1 (login dashboard) : ✅/❌
- ... (preuves : screenshots)

## Gates anti-régression
- typecheck/lint/vitest/isolation/prisma/build : ✅/❌

## Lighthouse Accessibility score
- Dashboard : XX/100
- Templates : XX/100

## Recommandations
## STOP & ASK Will
```

### Mémoire
Slug : `axionia_verif_sprint_p5_corrections_2026-05-21`

### MEMORY.md
```
- [🟢/🟡/🔴 AxionIA Vérif Sprint P5 LIVRÉE 2026-05-21 — score XXX/1000](axionia_verif_sprint_p5_corrections_2026-05-21.md) — Audit post-sprint P5 console admin. D-P5-1 à D-P5-6 X/6. 11 tests UI browser X/11 OK. 6 presets seedés. Cross-sprint P3+P4 OK/conflits.
```

---

## 9. STOP & ASK FINAL

```
✅ Vérification Sprint P5 livrée.
- HEAD : <sha>
- Score vérifié : XXX/1000 (vs déclaré YYY)
- D-P5-1 à D-P5-6 : X/6 appliquées
- Tests UI : X/11 OK
- Cross-sprint conflicts : X items

📋 Régressions UI/UX détectées :

🚀 Suite proposée :
[A] Sprint P5 follow-up (items manquants)
[B] Attendre vérifs P3+P4 → consolider P6
[C] Validation prod
```

---

## 10. PHRASE DE LANCEMENT

```
Lance la vérification décrite dans `_AUDIT/PROMPT-VERIF-SPRINT-P5-CORRECTIONS-2026-05-21.md`. Mode AUDIT-ONLY strict. Lire d'abord VERDICT-SPRINT-P5-CORRECTIONS.md + mémoire axionia_p5_decisions_canoniques_2026-05-21 + axionia_p4_decisions_canoniques_2026-05-21. Spawn 10 sous-agents V5-01 à V5-10. Démarrer pnpm dev + tester UI navigateur réel (11 tests : login dashboard, wizard depuis preset, pause/resume, MAX_PUBLISH UI, tableau croisé géo, progress bars, dashboard campagnes actives, ArticleFeedback thumbs, anomaly detection, Lighthouse accessibility ≥ 90, reporting hebdomadaire manuel). Gates anti-régression vs baseline P1.5 (typecheck/lint/vitest/isolation/prisma/build verts). Cross-sprint impact P4 (UI lit configs DB seuil REJECT 60 + itérations 3/2) + P3 (pas de modif src/components/seo). Termine par VERDICT-VERIFICATION-SPRINT-P5.md scoré /1000 + mémoire + STOP & ASK Will. Go.
```

---

*Vérification Sprint P5 — 5-7h autopilot — AUDIT-ONLY — Tests UI browser réels obligatoires*
