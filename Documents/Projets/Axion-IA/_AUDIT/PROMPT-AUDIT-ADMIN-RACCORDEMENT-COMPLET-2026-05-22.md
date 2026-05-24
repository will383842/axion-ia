# PROMPT AUDIT ADMIN RACCORDEMENT COMPLET
## AxionIA Console Admin — Vérification exhaustive frontend ↔ backend bouton-par-bouton

**Date création** : 2026-05-22
**Type** : Audit complémentaire du mega-audit final pré-prod (focus 100% console admin)
**Mode** : **AUDIT-ONLY strict**
**Effort estimé** : 6-8h autopilot
**Modèle recommandé** : Sonnet 4.6 (suffisant, focus technique)
**À lancer APRÈS** : `PROMPT-AUDIT-FINAL-PROD-READY-2026-05-22.md` livré
**Demandé par Will explicitement le 2026-05-22** : "as tu vérifié aussi si la console d'administration pour la génération de contenu était bien raccordée au frontend backend et que tous les flows fonctionnaient à la perfection ?"

---

## 0. MISSION

Vérifier en profondeur que la **console admin content-gen V2** est **parfaitement raccordée frontend ↔ backend**, que **tous les flows fonctionnent**, qu'**aucune donnée mockée ne traîne**, et qu'**aucun bouton n'est sans action**.

Différence avec le mega-audit final pré-prod :
- Le mega-audit final = vue globale (40 sous-agents sur tout l'outil)
- **Ce prompt = ZOOM 100% admin** (bouton-par-bouton, page-par-page, action-par-action)

**Sortie principale** : `VERDICT-ADMIN-RACCORDEMENT.md` + liste des liens morts / boutons sans action / données mockées détectées.

---

## 1. CONTEXTE PROJET

### Console admin content-gen V2
- Routes : `/[locale]/(admin)/[adminPrefix]/content-gen/**`
- `ADMIN_URL_PREFIX` env var (secret) défini par Will
- Auth NextAuth.js (login email/password ou magic link)
- Composants V2 : `src/components/admin/content-gen/`
- Server Actions : `src/server/content-gen/admin/`
- Design : terracotta `#c24a1b` CTAs + ivoire `#faf8f3` fond + bleu `#1a4dd9` pointes

### Sections attendues (D-P5-6 ordre A puis B livré)
- 🎯 **Pilotage** : Coverage (campagnes), Costs, Quality, Geo
- 🛠️ **Sources** : RSS, Keywords seeds, KB, Image-bank
- 📊 **Suivi** : Jobs, Articles, Cities, Provenance
- ⚙️ **Réglages** : Providers, Templates, Workers, Settings

### Décisions Will figées (ne pas re-demander)
- D-W1-5, D-P5-1-6, D1-D5, D7 société française pure
- Exclusions : Wikidata, DPA, CF WAF, toggle auto/manuel publication

### Mode AUDIT-ONLY
- ❌ Zéro modification code, zéro commit
- ✅ Lecture + diagnostics (`curl`, queries DB lecture, observation UI navigateur, screenshots Playwright)
- ✅ Création fichiers UNIQUEMENT dans `_AUDIT/AUDIT-ADMIN-RACCORDEMENT-2026-05-22/`

---

## 2. FICHIERS À LIRE EN PREMIER

### Code admin V2 complet
1. `src/app/[locale]/(admin)/[adminPrefix]/content-gen/layout.tsx` (layout admin)
2. `src/app/[locale]/(admin)/[adminPrefix]/content-gen/page.tsx` (dashboard)
3. **TOUTES** les pages sous `src/app/[locale]/(admin)/[adminPrefix]/content-gen/` (~25-30 pages)
4. **TOUS** les composants sous `src/components/admin/content-gen/`
5. **TOUTES** les server actions sous `src/server/content-gen/admin/`
6. `src/components/admin/AdminSidebar.tsx` ou équivalent (sidebar globale)
7. `auth.ts` + `auth.config.ts` (auth admin)
8. `proxy.ts` (Edge middleware admin path detection)

### Mémoires Claude
- `axionia_p5_decisions_canoniques_2026-05-21.md` (D-P5-1 à D-P5-6)
- `axionia_sprint_p5_corrections_livre_2026-05-21.md` (Sprint P5 livré 593/1000)
- `axionia_decisions_will_final_2026-05-21.md` (D7 + exclusions)

### Audits référents
- `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-5/PHASE-5-VERDICT.md` (audit initial 315/1000)
- `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-5/agents/A5-01.md` à `A5-08.md`
- `_AUDIT/AUDIT-FINAL-PROD-READY-2026-05-22/agents/frontend/F-02-routes-admin.md` (si livré)

---

## 3. SPAWN 15 SOUS-AGENTS PARALLÈLES

Chaque agent produit un rapport `agents/A-XX-<nom>.md`. Score `/100` honnête.

### A-01 — Sidebar admin + navigation (/100)

**Vérifications** :
- Lister tous les liens du sidebar admin
- Pour chaque lien : cible URL valide ? page existe physiquement (Glob `src/app/.../page.tsx`) ?
- Liens dans les 4 sections cohérents (D-P5-6) ?
- Badge compteurs présents (ex : "Coverage (3)" = 3 campagnes actives) ? Données réelles ou hardcodées 0 ?
- Tests : navigation manuelle 25+ liens — aucun 404, aucun crash
- Cohérence visuelle : indentation, icons `lucide-react`, hover states
- Mobile responsive : sidebar collapse hamburger ?

### A-02 — Dashboard principal (/100)

Page `/content-gen/page.tsx` :
- 4 sections regroupées affichées (D-P5-6) ?
- Cards campagnes actives running (3-5 max, D-P5 sprint P5 P1-4) ?
- Progress bar 39/120 villes ou cible élargie (D-P5 sprint P5 P1-7) ?
- Anomaly badge sidebar si > 0 alerts (D-P5 sprint P5 P1-8) ?
- CTA terracotta "Nouvelle campagne" sticky header (D-P5-1) ?
- Compteurs cohérents avec DB (pas hardcodés) ?

Test :
```sql
SELECT COUNT(*) FROM coverage_campaigns WHERE status='running';
-- Comparer avec count affiché UI
```

### A-03 — Pages liste (coverage, articles, jobs, ...) (/100)

Vérifier 5+ pages liste admin :
- `/content-gen/coverage/` (liste campagnes)
- `/content-gen/articles/` (liste articles)
- `/content-gen/jobs/` (liste jobs BullMQ)
- `/content-gen/quality/` (liste review queue)
- `/content-gen/templates/` (liste 6 presets)
- `/content-gen/cities-coverage/` (si Sprint Perfection 2026 livré)

Pour chaque page :
- Query Prisma réelle (pas mock) — vérifier dans code source
- Filtres fonctionnels : valeurs sélectionnables agissent vraiment sur la query
- Tri colonnes : ordonne vraiment les résultats
- Pagination : nextPage / prevPage / page X de Y
- Lignes cliquables → page détail
- Compteur total cohérent
- État vide (empty state) si 0 résultats

Test fonctionnel : aller sur `/content-gen/coverage/` → filtrer par status `running` → trier par date desc → naviguer page 2 → vérifier URL params synchronisés.

### A-04 — Pages détail (campaign, article, job) (/100)

Vérifier 3+ pages détail :
- `/content-gen/coverage/[id]` (détail campagne)
- `/content-gen/articles/[id]` ou `/content-gen/quality/review/[id]` (détail article)
- `/content-gen/jobs/[id]` (détail job)

Pour chaque :
- Tous les champs affichés correspondent DB (lire query Prisma)
- Actions disponibles raccordées (boutons Edit / Delete / Pause / Resume / Approve / Reject)
- Boutons icon-only ont `aria-label`
- Server Actions associées existent (grep dans `src/server/content-gen/admin/`)
- Logs / historique affichés (audit trail SOC2)
- Liens vers entités liées (campagne → jobs, article → keyword, etc.)

### A-05 — Formulaires + validation (/100)

Pour chaque formulaire admin (5+) :
- `CoverageNewV2` (création campagne)
- `BatchesV2` (config batches)
- `QualityLoopV2` (config qualité)
- `ProviderConfig` (config providers)
- Formulaire feedback article

Vérifier :
- Validation côté client (react-hook-form / Zod resolver)
- Validation côté serveur (Server Action Zod parse)
- Error handling : messages erreur visibles UI si validation échoue
- Success feedback : toast / message confirmation après submit OK
- Empty states (pas de champ pré-rempli avec "TODO" / placeholder de dev)
- Required fields marqués (asterisk)
- Inputs accessibles (label associé, aria-describedby pour erreurs)

Test fonctionnel : remplir formulaire création campagne avec valeurs incorrectes → vérifier erreurs UI claires.

### A-06 — Wizard multi-étapes (création campagne) (/100)

Le wizard `/content-gen/coverage/new` :
- Combien d'étapes ? (acquis P5 = 4 étapes)
- Navigation : Précédent / Suivant fonctionnel
- État préservé entre étapes (pas de reset si on revient)
- Validation par étape (ne peut pas passer suivant si invalide)
- Progress indicator visible
- Submit final fonctionne (DB row + BullMQ enqueue)
- Pré-remplissage depuis preset si `?preset=<slug>` (acquis P5 P1-2)
- Banner "Démarrage depuis preset : X" si applicable
- Bouton "Retirer le preset" reset form

Test : ouvrir `/content-gen/coverage/new?preset=pme-audits` → wizard pré-rempli → naviguer étape 2 → revenir étape 1 → état préservé → finaliser → DB INSERT + BullMQ jobs créés.

### A-07 — Server Actions raccordées 100% (/100)

Pour chaque bouton/formulaire/action UI, vérifier la Server Action correspondante :
- Lister toutes les Server Actions dans `src/server/content-gen/admin/`
- Pour chaque : vérifier qu'au moins 1 composant UI l'utilise (`<form action={...}>`)
- Inverse : pour chaque `<form action={...}>` UI, vérifier que l'action existe côté serveur
- Boutons icon-only (Pause, Resume, Delete) : tous ont leur Server Action ?
- Server Actions ont :
  - `requireAdmin()` ou équivalent auth check
  - Validation Zod inputs
  - `revalidatePath` / `revalidateTag` pour rafraîchir UI
  - Try/catch + error response standardisé
  - Audit log SOC2 si action critique
  - `redirect()` si nécessaire post-action

Liste expected Server Actions :
- `createCampaign(input)`, `updateCampaign(id, input)`, `pauseCampaign(id)`, `resumeCampaign(id)`, `deleteCampaign(id)`
- `approveArticle(id)`, `rejectArticle(id)`, `submitArticleFeedback(id, type, comment)`
- `requeueJob(id)`, `cancelJob(id)`
- `updateContentGenConfig(key, value)`, `updateProviderConfig(...)`, `updateQualityLoop(...)`
- `seedCampaignTemplates()` (manuel)
- `listCities(filters)` (si Sprint Perfection 2026 livré)
- `createCampaignForCities(citySlugs)` (idem)
- `listExternalLinks(filters)` (si External Links sprint livré)
- `triggerManualVerification()` (idem)
- `recalibrateBrandVoice(articleIds)` (si Sprint Perfection 2026 livré)

### A-08 — Données réelles vs mockées (/100)

**Détection mocks/stubs/données fake** :
- Grep dans tous les composants admin :
  ```bash
  grep -rn "mockData\|fakeData\|TODO.*stub\|placeholder.*data\|sample.*data\|hardcoded" src/components/admin/ src/app/.../admin/
  ```
- Grep pour valeurs "magiques" suspectes :
  ```bash
  grep -rn "= 42\|return \[\]\|return null //.*stub" src/server/content-gen/admin/
  ```
- Vérifier chaque page liste : query Prisma vraie, pas `const items = [{ name: 'Test', ... }]`
- Vérifier chaque compteur dashboard : query DB vraie, pas hardcoded
- Vérifier alertes anomaly : viennent vraiment de DB `ContentGenConfig.key="alert_count"` (acquis P5 P1-8)
- Vérifier images preview : vraies images de l'image-bank, pas placeholders

Si mocks trouvés : P0 dans verdict.

### A-09 — Export CSV (/100)

Vérifier les exports CSV présents dans admin :
- Articles published export
- Coverage table géo export (Sprint P5 D-P5-4)
- KeywordTracking export
- External links export (si sprint livré)
- Cities coverage export (si Sprint Perfection 2026 livré)

Pour chaque :
- Bouton "Exporter CSV" présent
- Click déclenche download fichier
- Fichier contient toutes les colonnes attendues
- Format CSV propre (escape de virgules, quotes, encoding UTF-8 BOM)
- Filtres appliqués respectés dans export
- Test fonctionnel : exporter, ouvrir le fichier dans Excel/LibreOffice, vérifier intégrité

### A-10 — Realtime updates + polling (/100)

Sur les pages avec données dynamiques :
- Dashboard compteurs queue depth : refresh automatique ?
  - Polling 15s (acquis P5 P2 backlog) ?
  - SSE (Server-Sent Events) ?
  - Refetch on focus ?
- Liste campagnes : si campagne progresse, UI rafraîchi sans F5 manuel ?
- Quality queue : si nouvel article needs_review, badge sidebar incrémenté ?
- Telegram alerts : visibles dans UI (notification panel) ou seulement Telegram ?

Si tout est force-dynamic + F5 manuel obligatoire (état initial P5) : P2 à documenter.

### A-11 — Search + autocomplete (/100)

Vérifier les recherches admin :
- Search bar articles / campagnes / keywords / villes
- Autocomplete suggestions (FTS Postgres + pg_trgm) ?
- Performance < 200ms p95 ?
- Debounce input (300ms typiquement) ?
- Highlight matched terms dans résultats ?
- Empty state si 0 résultats avec suggestion alternative ?

Test : taper "audit IA Pari" → autocomplete suggère "audit IA Paris" + 5 articles + ville Paris.

### A-12 — Notifications + alertes UI (/100)

Vérifier que les events backend remontent en UI :
- Alertes anomaly detection (acquis P5 P1-8) : badge rouge sidebar
- Cost tracker > 80% cap : toast / alert banner ?
- Worker errors Sentry : visibles admin (ex : page `/content-gen/observability`) ?
- Telegram alerts : doublonnés UI ou seulement Telegram ?
- Articles quarantained_critical : alerte immédiate UI ?

Test : forcer une erreur worker → vérifier que Sentry capture + UI admin affiche notification.

### A-13 — Permissions / RBAC (si livré) (/100)

Si RBAC livré dans le sprint :
- Rôles définis (admin / editor / viewer) ?
- Pour chaque rôle, quelles actions disponibles ?
- Tester avec user de chaque rôle : accès / refus cohérent
- Audit log qui a fait quoi

Si non livré : noter "RBAC non implémenté, single-admin Will" — pas un P0 mais P2 backlog.

### A-14 — Tests Playwright E2E (si livrés) (/100)

Si tests Playwright admin présents :
- Lister `tests/e2e/admin/**`
- Coverage : 80%+ flows critiques ?
- CI configuré pour les exécuter ?
- Tests passent (`pnpm test:e2e`) ?

Si pas de tests Playwright admin : P1 backlog (recommander création).

### A-15 — Cross-cutting orchestrateur (/100)

- Cohérence inter-agents A-01 à A-14 (0 contradiction)
- Score global `/1500` honnête
- Top 5 forces console admin
- Top 5 P0 bloquants production (boutons cassés, données mockées, etc.)
- Roadmap correctif si gaps

**TOTAL : 1500 pts → normalisé `/1000`**

---

## 4. TESTS FONCTIONNELS RÉELS OBLIGATOIRES

### Test 1 — Navigation menu complet
- Cliquer sur **chaque lien** du sidebar admin (25+ liens)
- Attendu : 0 page 404, 0 page crash, 0 lien mort
- Documenter dans `test-01-navigation-complete.md`

### Test 2 — Création campagne wizard 4 étapes
- Aller sur `/content-gen/coverage/new?preset=pme-audits`
- Naviguer 4 étapes, modifier 2 champs, revenir, vérifier état préservé
- Submit final
- Vérifier DB : `SELECT * FROM coverage_campaigns ORDER BY created_at DESC LIMIT 1;` → row créée
- Vérifier BullMQ : jobs enqueued correspondant `campaignId`

### Test 3 — Pause/resume campagne (acquis P5)
- Sur liste campagnes, click "Pause" sur 1 campagne running
- Vérifier UI updated immédiat (status badge "paused")
- Vérifier DB : `SELECT status FROM coverage_campaigns WHERE id='...'` → 'paused'
- Vérifier BullMQ : jobs purgés (queue depth diminuée)
- Click "Resume" → reverse

### Test 4 — Review article + thumbs feedback (acquis P5 P1-4)
- Aller sur `/content-gen/quality/review/[articleId]` d'un article en `needs_review`
- Click thumbs up + comment "Bon article"
- Vérifier DB : `SELECT * FROM article_feedback WHERE article_id='...'` → row insérée
- Vérifier UI : success toast + bouton désactivé après vote

### Test 5 — Filtres + tri + pagination
- Aller sur `/content-gen/coverage/`
- Filtrer par status `running`
- Trier par `created_at DESC`
- Naviguer page 2 (si > 10 campagnes)
- Vérifier URL params : `?status=running&sort=-created_at&page=2`
- Vérifier données réellement filtrées (count cohérent SQL)

### Test 6 — Tableau croisé géo + export CSV (acquis P5 D-P5-4)
- Aller sur `/content-gen/geo/coverage-table` (ou équivalent livré)
- Filtrer verticale `audits`
- Click "Exporter CSV"
- Download fichier `coverage-table-export-YYYY-MM-DD.csv`
- Ouvrir : vérifier headers + données + encoding UTF-8

### Test 7 — Detection mocks / stubs
- Grep code admin :
  ```bash
  grep -rn "mockData\|fakeData\|sampleData\|TODO.*stub\|placeholder" src/components/admin/ src/app/.../admin/ src/server/content-gen/admin/
  ```
- Documenter chaque occurrence avec contexte
- Vérifier que pas de données fake en prod

### Test 8 — Realtime updates dashboard
- Ouvrir `/content-gen/page.tsx` (dashboard)
- Trigger 1 nouveau job content-gen (depuis worker test)
- Observer 60s : compteur articles aujourd'hui s'incrémente automatiquement ?
- Si non : noter besoin polling/SSE (P2 backlog)

### Test 9 — Search autocomplete
- Aller sur `/content-gen/articles/` ou page avec search
- Taper "audit"
- Vérifier suggestions apparaissent < 500ms
- Vérifier highlighting du terme matché

### Test 10 — Anomaly detection badge (acquis P5 P1-8)
- Simuler 0 articles générés pendant 4h (update `last_run` worker)
- Recharger admin
- Vérifier badge rouge sidebar avec count
- Vérifier message d'alerte dans page dédiée

---

## 5. ZONES INTERDITES

- ❌ Aucun `git commit`, `git push`, modification source
- ❌ Aucune installation dépendance
- ❌ Aucune modification env vars
- ❌ Décisions Will Wikidata, DPA, CF WAF (exclusions)
- ❌ Ne pas casser BDD avec des INSERT/DELETE/UPDATE intempestifs (lecture seule, sauf tests fonctionnels qui créent des données test clairement marquées)
- ✅ Création fichiers UNIQUEMENT dans `_AUDIT/AUDIT-ADMIN-RACCORDEMENT-2026-05-22/`

---

## 6. LIVRABLES OBLIGATOIRES

### Structure
```
_AUDIT/AUDIT-ADMIN-RACCORDEMENT-2026-05-22/
├── VERDICT-ADMIN-RACCORDEMENT.md           (livrable principal)
├── ADMIN-LIENS-MORTS.md                    (liste boutons / liens sans action)
├── ADMIN-DONNEES-MOCKEES.md                (liste mocks détectés en prod)
├── ADMIN-FLOWS-TESTED.md                   (10 flows admin testés)
├── CROSS-CUTTING.md                        (analyses transverses)
├── screenshots/                            (Playwright si disponible)
│   ├── dashboard.png
│   ├── coverage-list.png
│   ├── wizard-step-1.png
│   └── ...
├── tests-results/
│   ├── test-01-navigation-complete.md
│   ├── test-02-wizard-4-etapes.md
│   ├── test-03-pause-resume.md
│   ├── test-04-thumbs-feedback.md
│   ├── test-05-filtres-tri-pagination.md
│   ├── test-06-export-csv.md
│   ├── test-07-detection-mocks.md
│   ├── test-08-realtime.md
│   ├── test-09-autocomplete.md
│   └── test-10-anomaly-badge.md
└── agents/
    ├── A-01-sidebar-navigation.md
    ├── A-02-dashboard.md
    ├── A-03-pages-liste.md
    ├── A-04-pages-detail.md
    ├── A-05-formulaires.md
    ├── A-06-wizard.md
    ├── A-07-server-actions.md
    ├── A-08-donnees-reelles.md
    ├── A-09-export-csv.md
    ├── A-10-realtime.md
    ├── A-11-search.md
    ├── A-12-notifications.md
    ├── A-13-rbac.md
    ├── A-14-tests-playwright.md
    └── A-15-cross-cutting.md
```

### Format `VERDICT-ADMIN-RACCORDEMENT.md`

```markdown
# VERDICT AUDIT ADMIN RACCORDEMENT
## Date : YYYY-MM-DD
## HEAD audité : <SHA>
## Score global : XXX/1000

---

## RÉSUMÉ EXÉCUTIF

**Score : XXX/1000** — 🟢 RACCORDEMENT PARFAIT | 🟡 BOUTONS À CONNECTER | 🔴 MOCKS PRÉSENTS

### Top 5 forces admin
1. ...

### Top 5 P0 bloquants
1. ... (ex : "Bouton X dans Coverage liste mène vers route 404")
2. ... (ex : "Page CitiesCoverage utilise mockData hardcoded au lieu de query Prisma")
3. ...

### Action recommandée
<1 ligne>

---

## SCORE DÉTAILLÉ PAR AGENT
| # | Agent | Score | Verdict |

---

## ITEMS OK ✅
- ...

## BOUTONS / LIENS SANS ACTION 🔴
| Page | Élément UI | Action attendue | Statut |
|------|-----------|------------------|--------|
| /content-gen/coverage/ | Bouton "Archiver" | archiveCampaign() | ❌ Server Action absente |
| ... |

## DONNÉES MOCKÉES DÉTECTÉES 🔴
| Page | Composant | Type données fake | Action |
|------|-----------|-------------------|--------|
| ... |

## FLOWS TESTÉS (10)
- Test 1 navigation : ✅ 25/25 liens valides
- Test 2 wizard : ⚠️ étape 3 perd l'état si revient
- ...

## RECOMMANDATIONS PRIORITAIRES
1. P0 ... (effort X h)
2. P1 ...
3. P2 ...

## STOP & ASK WILL
- Verdict raccordement : 🟢/🟡/🔴
- Console admin production-ready : OUI / CONDITIONNEL / NON
- Action immédiate : ...
```

### Mémoire à créer
Slug : `axionia_audit_admin_raccordement_2026-05-22`
Type : project

### MEMORY.md
```
- [🟢/🟡/🔴 AxionIA Audit admin raccordement LIVRÉ 2026-05-22 — score XXX/1000](axionia_audit_admin_raccordement_2026-05-22.md) — 15 sous-agents focus console admin. X boutons sans action, X mocks détectés, X liens morts. 10 flows admin testés. Verdict raccordement parfait/à connecter/mocks présents.
```

---

## 7. STOP & ASK FINAL

```
✅ Audit admin raccordement livré.

📊 Score : XXX/1000 — 🟢 RACCORDEMENT PARFAIT | 🟡 BOUTONS À CONNECTER | 🔴 MOCKS PRÉSENTS

🔍 Vérifications :
- Sidebar : X/Y liens valides
- Server Actions raccordées : X/Y boutons
- Données mockées détectées : X occurrences
- Flows testés : X/10 OK
- Export CSV : OK / Cassé

📋 ROADMAP correctif :
- P0 : X items
- P1 : X items
- P2 : X items

🚀 Choix Will :
[A] Console admin OK production → activer scale
[B] Sprint correctif raccordement (~Xh) avant prod
[C] Refonte ciblée X pages avec mocks
```

---

## 8. PHRASE DE LANCEMENT (AUTOPILOT TOTAL)

```
AUTOPILOT TOTAL. Ne pose AUCUNE question intermédiaire. Lance l'audit admin raccordement décrit dans `_AUDIT/PROMPT-AUDIT-ADMIN-RACCORDEMENT-COMPLET-2026-05-22.md`. Mode AUDIT-ONLY strict : zéro commit, zéro modif code. Décisions Will canoniques figées (D-W1-5 + D-P5-1-6 + D1-D5 + D7 société française pure) — NE PAS re-demander. Exclusions absolues : Wikidata, DPA, CF WAF, toggle auto/manuel publication. Lire EN PREMIER les mémoires Bloc Mémoires + audits référents Bloc Audits Référents + code admin V2 complet (toutes pages sous src/app/[locale]/(admin)/[adminPrefix]/content-gen/ + tous composants src/components/admin/content-gen/ + toutes server actions src/server/content-gen/admin/). Spawn 15 sous-agents parallèles A-01 à A-15 (sidebar navigation, dashboard, pages liste, pages détail, formulaires validation, wizard 4 étapes, server actions raccordées 100%, données réelles vs mockées, export CSV, realtime updates, search autocomplete, notifications, RBAC, tests Playwright E2E, cross-cutting). Exécuter TOUS les 10 tests fonctionnels réels obligatoires (navigation 25+ liens, wizard 4 étapes état préservé, pause/resume BullMQ effet, thumbs feedback DB insert, filtres+tri+pagination URL params, tableau croisé export CSV, detection mocks/stubs grep, realtime polling/SSE, autocomplete FTS, anomaly badge sidebar). Connexion DB en lecture seule autorisée. Self-troubleshoot toutes erreurs. Score `/1000` HONNÊTE pas gonflé. Produis VERDICT-ADMIN-RACCORDEMENT.md + ADMIN-LIENS-MORTS.md + ADMIN-DONNEES-MOCKEES.md + ADMIN-FLOWS-TESTED.md + 15 rapports agents + 10 tests-results dans `_AUDIT/AUDIT-ADMIN-RACCORDEMENT-2026-05-22/`. Mémoire axionia_audit_admin_raccordement_2026-05-22 + MEMORY.md update. STOP & ASK Will UNIQUEMENT à la livraison finale avec verdict 🟢/🟡/🔴 + 3 options [A/B/C]. Go.
```

---

## 9. QUAND LANCER

⏳ **APRÈS** que le mega-audit final pré-prod soit livré (`PROMPT-AUDIT-FINAL-PROD-READY-2026-05-22.md`).

Pourquoi cet ordre :
1. Mega-audit final donne vue globale 1000 points (40 axes)
2. CE prompt complète avec focus admin profond 1000 points (15 axes spécialisés)
3. Les 2 audits combinés = couverture exhaustive

Si tu trouves trop d'audits : lance UNIQUEMENT le mega-audit final, et lance CE prompt seulement si verdict mega-audit suggère problèmes admin spécifiques.

---

*Audit admin raccordement complet — 6-8h Sonnet 4.6 autopilot — AUDIT-ONLY — Console admin bouton-par-bouton*
