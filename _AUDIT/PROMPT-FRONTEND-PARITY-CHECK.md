# 🎨 PROMPT FRONTEND PARITY CHECK — Axion-IA · Audit cohérence cross-pages

> 📌 **Lire d'abord [`_AUDIT/SYNC-NOTICE-2026-05-07.md`](./SYNC-NOTICE-2026-05-07.md)** pour les évolutions HEAD `fd91518` (64 routes, doctrine v3 commitée, refactor Module Audit).
>
> **Version 1.0 · 2026-05-07**
> Working directory : `C:\Users\willi\Documents\Projets\Axion-IA\axionia`.
> Sortie : `_AUDIT/AUDIT-PARITY-V14.md` + `parity-deltas.json` + recommandations refontes.
> Durée estimée : 60-90 min (3 agents parallèles + agent principal).

---

## 🎯 OBJECTIF

`/interventions` vient d'être refondue 2026-05-07 (commit `feat(interventions): redesign listing...`) avec un niveau qualité UX nettement supérieur :

- Hero 2 cols (titleEm éditorial + schéma SVG illustratif)
- 5 GROS blocs cliquables détaillés (audience pill + pricing italics + 3 outcomes + 3 phases + CTA + KPI aside)
- Section anti-fear (3 cartes maturité)
- CTA final dark
- Doctrine v3 (titleEm terracotta italique, halos, accents par module)

**Mission** : identifier toutes les pages qui n'atteignent pas ce niveau et **prioriser** les refontes nécessaires pour cohérence pré-launch. Pas de refonte ici — diagnostic uniquement.

---

## 🧠 RÔLE & POSTURE

Tu es **lead UX reviewer** indépendant. Tu compares chaque page candidate à la **référence qualité `/interventions` HEAD** sur 12 dimensions UX/structure/densité contenu/doctrine. Tu produis une matrice page × dimension avec scores, écarts, priorités refonte.

**Posture** : exigeant pour cohérence (toutes les pages d'un même type doivent avoir la même densité UX), pragmatique sur effort (P0 = écart majeur visible / P1 = écart UX significatif / P2 = polish).

**Lecture seule strict** — aucune modif code.

---

## 📚 SOURCES DE VÉRITÉ

### Référence qualité (gold standard)

1. `axionia/src/app/[locale]/interventions/page.tsx` HEAD — listing module 1 refondu.
2. `axionia/src/components/sections/InterventionsHeroSchema.tsx` HEAD — SVG schema satellites.
3. `axionia/src/content/interventions.ts` HEAD — content enrichi avec `summary` + `accent`.

### Pages à auditer (par catégorie)

#### A. Listings modules (priorité haute)

- `/audit` — listing module 2 (Sprint 6).
- `/implementation` — listing module 3 (Sprint 7).

#### B. Listings transversaux (priorité moyenne)

- `/cas-concrets` — listing avec filtres (Sprint 8) — refondu hero 2-cols + `CaseStudiesHeroSchema` (commit `47d4db1`).
- `/blog` — listing articles (Sprint 9).

#### C. Pages éditoriales transversales (priorité moyenne)

- `/a-propos` — Timeline + Team + Values (Sprint 9).
- `/contact` — 3 channels + ContactPage JSON-LD (Sprint 9).
- `/faq` — Section H1 standard halo-warm + 5 entries + FAQPage + `/faq/[slug]` indexable + RSS découvrable (Sprint 9 + commit `f708440`).
- `/centre-aide` — refondu hero 2-cols + `HelpHeroSchema` (constellation 6 thématiques) + `/centre-aide/[slug]` + `/centre-aide/categorie/[slug]` indexables (Sprint 9 + commit local).

#### D. Pages utilitaires (priorité basse)

- `/reserver` (FR) / `/book` (EN) — BookingFlow (Sprint 11).
- `/roi` — RoiSimulator (Sprint 12).

#### E. Pages produit individuelles (échantillon)

- `/interventions/essentielle` — page phare 490€.
- `/audit/flash`, `/audit/strategique-pme` (2 sur 5 — pyramide 2026-05-07 : flash · process · strategique-pme · strategique-eti · demande).
- `/implementation/ia-custom`, `/implementation/chatbot` (2 sur 10).

#### F. Cas concrets individuels (échantillon)

- 2 pages `/cas-concrets/[slug]` SSG.

#### G. Articles blog individuels (échantillon)

- 2 pages `/blog/[slug]` SSG.

#### H. Légales (priorité basse, structure simple acceptable)

- `/mentions-legales`, `/conditions-generales`, `/politique-confidentialite`, `/cookies`, `/rgpd`, `/politique-deplacement`, `/accessibilite` (7 légales/utilitaires, Sprint 10).

---

## ⚖️ RÈGLES DU JEU

1. **Mode auto** — exécute, ne demande pas. STOP & ASK final uniquement.
2. **Lecture seule strict** — aucune modif. Outils : `git`, `Read`, `Grep`, `Glob`.
3. **Citations obligatoires** : `file_path:line_number` pour chaque écart.
4. **Priorisation** :
   - **P0** — écart majeur de cohérence (page semble appartenir à un autre site).
   - **P1** — écart UX significatif (densité contenu insuffisante, structure différente, CTA manquants).
   - **P2** — polish (espacements, typo, micro-interactions).
   - **P3** — cosmétique.
5. **Effort estimé** par finding : XS (≤30 min) / S (30 min-2h) / M (2-6h) / L (6-12h) / XL (> 12h).

---

## 🤖 DISPATCH MULTI-AGENTS (3 agents en parallèle)

| Agent            | Subagent | Mission                                                                                  |
| ---------------- | -------- | ---------------------------------------------------------------------------------------- |
| **AGT-LISTINGS** | Explore  | Catégories A + B + C — listings modules + transversaux + pages éditoriales transversales |
| **AGT-PRODUCT**  | Explore  | Catégories D + E + F + G — utilitaires, pages produit, cas, articles                     |
| **AGT-LEGAL**    | Explore  | Catégorie H — 6 légales (audit léger, structure simple OK)                               |

L'agent principal pendant ce temps : matrice de scoring + recommandations effort/priorité + agrégation finale.

---

## 📐 12 DIMENSIONS À ÉVALUER (par page)

Pour chaque page, scorer chaque dimension sur 0-3 :

- **0** = absent / cassé
- **1** = présent mais bien en-dessous de `/interventions`
- **2** = présent au niveau acceptable
- **3** = au niveau de `/interventions` ou supérieur

### Dimension 1 — Hero éditorial

- Eyebrow uppercase + dot indicator couleur module ?
- Titre avec `titleEm` italique terracotta ou primary ?
- Description 1-2 phrases value-prop ?
- 2 CTAs (primaire + secondaire) ?
- Layout 2 cols ou full-width selon contexte ?

### Dimension 2 — Schéma/illustration hero

- Présence d'une illustration / schema / SVG ou photo ?
- Server Component ?
- Cohérent avec le module (couleurs, accents) ?
- Accessible (`role="img"` + `aria-label`) ?

### Dimension 3 — Bandeau réassurance / différenciateurs

- Pills audience / différenciateurs / preuves ?
- 3-5 items max ?
- Icônes lucide-react ou emojis discrets ?

### Dimension 4 — Densité de contenu

- Body text ≥ 800 mots pour pillar / listing module ?
- Body text ≥ 500 mots pour transversales ?
- Pas de pages "vides" (juste 1 hero + 1 CTA) ?

### Dimension 5 — Blocs/cards détaillés

- Pour les listings : un bloc par item avec ≥ 3 niveaux d'info (titre + tagline + outcomes + CTA + KPI) ?
- Pour les pages produit : sections ≥ 5 (hero + bénéfices + déroulé + livrables + témoignages + FAQ + CTA) ?
- Cards avec accent module-color ?

### Dimension 6 — Sections de proof

- Témoignages présents ? (sauf transversales/légales)
- Cas concrets liés ? (sauf transversales/légales)
- Métriques chiffrées en `<Stat>` ou `<MetricsRow>` ?
- KPIs aside dans cards ?

### Dimension 7 — Anti-objection / anti-fear

- Section ou bloc qui adresse les objections potentielles ?
- Accessible aux différents niveaux de maturité (cf. /interventions) ?
- Tone reassuring sans être condescendant ?

### Dimension 8 — CTA structure

- Multi-CTAs (primaire + secondaire) ?
- CTA dark final en sortie ?
- CTAs cohérents (réservation, contact, calendrier) ?
- Animation `translate-x-[6px]` au hover ?

### Dimension 9 — Doctrine v3 cohérence

- `bg-bg` / `bg-paper` / `bg-sand` / `bg-mocha` utilisés correctement ?
- `bg-halo-warm` / `bg-halo-cool` sur sections appropriées ?
- Couleur module respectée (primary/orange/purple/sage) ?
- Typographies Manrope + Fraunces + Inconsolata correctes ?

### Dimension 10 — JSON-LD complet

- `BreadcrumbList` présent ?
- Schema spécifique au type de page (`Service` / `Article` / `FAQPage` / `Offer` / `Person` / etc.) ?
- `inLanguage` correct ?
- `Offer` avec prix si applicable ?

### Dimension 11 — i18n parité

- Toutes les chaînes via `useTranslations` ou `getTranslations` ?
- 0 string hardcodée ?
- Traduction EN sémantique (pas mot-à-mot) ?

### Dimension 12 — Accessibilité & responsive

- Mobile-first vérifié (hero stack, cards full-width, CTA centrés) ?
- Touch targets ≥ 44×44 ?
- Keyboard nav fluide ?
- Hierarchie h1→h6 cohérente ?

---

## 📊 MATRICE DE SORTIE — `_AUDIT/AUDIT-PARITY-V14.md`

```markdown
# AUDIT PARITY V14 — Axion-IA

- Date : 2026-MM-DD
- Référence qualité : `/interventions` HEAD post-refonte (`feat(interventions): redesign listing`)
- Pages auditées : N
- Auditeur : Claude Opus 4.7 + 3 agents

## 1. Verdict global

- [ ] PARITÉ EXCELLENTE ✅ (≥ 85 % des pages au niveau /interventions)
- [ ] PARITÉ BONNE ⚠️ (60-85 %)
- [ ] PARITÉ INSUFFISANTE ❌ (< 60 %) — refontes majeures requises

## 2. Score global parité

N % (moyenne pondérée des 12 dimensions × N pages)

## 3. Top P0 (refontes urgentes)

| Page | Score | Effort | Priorité | Action |
| ---- | ----- | ------ | -------- | ------ |

## 4. Top P1

| Page | Score | Effort | Priorité | Action |
| ---- | ----- | ------ | -------- | ------ |

## 5. Matrice complète (page × 12 dimensions × score 0-3)

### A. Listings modules

| Page                 | D1 Hero | D2 Schema | D3 Pills | D4 Densité | D5 Blocks | D6 Proof | D7 Anti-fear | D8 CTAs | D9 Doctrine | D10 JSON-LD | D11 i18n | D12 A11y | Score |
| -------------------- | ------- | --------- | -------- | ---------- | --------- | -------- | ------------ | ------- | ----------- | ----------- | -------- | -------- | ----- |
| /interventions (réf) | 3       | 3         | 3        | 3          | 3         | 3        | 3            | 3       | 3           | 3           | 3        | 3        | 36/36 |
| /audit               | ?       | ?         | ?        | ?          | ?         | ?        | ?            | ?       | ?           | ?           | ?        | ?        | ?/36  |
| /implementation      | ?       | ?         | ?        | ?          | ?         | ?        | ?            | ?       | ?           | ?           | ?        | ?        | ?/36  |

### B. Listings transversaux

[idem]

### C. Pages éditoriales transversales

[idem]

### D-H. [autres catégories]

## 6. Recommandations refontes (par effort)

### Sprint correctif XS (≤ 1 jour)

[Liste]

### Sprint correctif S (1-3 jours)

[Liste]

### Sprint correctif M (3-7 jours)

[Liste]

### Sprint correctif L (7-14 jours, à reporter Phase 2 ?)

[Liste]

## 7. Pages déjà au niveau (à conserver telles quelles)

[Liste]

## 8. Patterns réutilisables identifiés depuis /interventions

- `InterventionsHeroSchema` → adapter pour autres modules ?
- 5 GROS blocs structure → réutiliser sur /audit (5 audits) et /implementation (10 implem) ?
- Section anti-fear maturité → adapter pour autres listings ?
- CTA dark final pattern → généraliser ?

## 9. JSON deltas

`parity-deltas.json` machine-readable.

## 10. Question fermée pour Will

- OUI on enchaîne les refontes P0+P1 dans cet ordre
- CONTINUE on refait juste les 2-3 plus critiques
- STOP scope refontes — laisser tel quel et passer à Sprint 15
```

---

## ▶️ DÉMARRAGE

Confirme en 5 lignes. Charge :

1. `/interventions/page.tsx` HEAD (référence qualité gold standard).
2. `InterventionsHeroSchema.tsx` HEAD.
3. `interventions.ts` HEAD.
4. Liste des pages à auditer (catégories A→H ci-dessus).

Lance les **3 agents en parallèle** (AGT-LISTINGS / AGT-PRODUCT / AGT-LEGAL).

Pendant ce temps, agent principal prépare la matrice 12 dimensions × N pages + identifie patterns réutilisables.

À la fin, **renvoie à Will (≤ 250 mots)** :

- Verdict parité globale.
- Top 3 pages refontes urgentes (P0) + effort estimé.
- Top 5 patterns réutilisables (extraire de `/interventions` pour les autres pages).
- Question fermée : « OUI refontes P0+P1 / CONTINUE 2-3 plus critiques / STOP passer à Sprint 15 ».
