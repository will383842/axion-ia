# Sprint A — Refactor DRY pages verticales ville (Brief Claude Opus V2 multi-agents)

**Date** : 2026-05-25
**Branche cible** : `main` (HEAD `abd18b71`)
**Estimation totale** : 7-10 h avec parallélisation massive (vs 15-20h séquentiel)
**Owner** : Claude Opus + 40-60 sub-agents spécialisés
**Status au démarrage** : Commit `67b46f8d` poussé (bandeau orange + UX wording) + commit `abd18b71` (ce brief)

---

## 0. Manifeste — pourquoi multi-agents

**Sprint A complet en séquentiel = 15-20h** :

- 5 pages services à refactor (audit/interventions/implementation/un-a-un/sites-web) = ~10h
- 2 templates ville à refactor = ~4h
- Tests runtime + cohérence = ~3h
- Cleanup + commits = ~2h

**Sprint A multi-agents = 7-10h** avec :

- **Phase 1 (recon)** : 5 agents Explore parallèles → 1 heure compressée à 15 min
- **Phase 2-3 (extraction + refactor)** : 5 batches de 5 agents general-purpose parallèles → 8h compressées à 3h
- **Phase 4-6 (templates ville + composants ville)** : 4 agents parallèles → 2h compressées à 45 min
- **Phase 7 (vérif croisée cohérence)** : 10 agents parallèles → 2h compressées à 30 min
- **Phase 8 (tests runtime)** : 5 agents parallèles → 1h compressée à 20 min
- **Phase 9 (vérif finale double pass)** : 15 agents parallèles → 4h compressées à 1h
- **Phase 10 (commit + push + memory)** : single agent → 15 min

**Total sub-agents** : ~44 (5 recon + 5 extraction + 5 refactor service + 4 ville + 10 cohérence + 5 tests + 15 finale)

Sub-agents Anthropic recommandés :

- **Explore** : pour recon code-only (read-only, retourne synthèse). 5 agents Phase 1, 5 agents Phase 8.
- **general-purpose** : pour extraction + refactor (write capable). 5 agents Phase 2, 5 agents Phase 3, 4 agents Phase 4-6, 15 agents Phase 9 (split read+write).
- **Code reviewer / verifier custom** : pour cohérence + finale. 10 agents Phase 7, 15 agents Phase 9.

---

## 1. Objectif (en une phrase)

Refactor les **5 pages services principales** + **2 templates ville** pour qu'une modification d'une section sur la page principale (`/fr/audit`) propage automatiquement aux **2 150 pages ville verticales** (`/fr/implantations/[region]/[ville]/audits`), via composants partagés acceptant un `villeContext?` optionnel. **Garantie zéro régression** via vérification croisée 10 agents + double pass final 15 agents.

---

## 2. Pourquoi (problème actuel = Option B)

**État actuel = duplication silencieuse** :

- `/fr/audit` (578 LOC) a sa propre version du grid tarifs, hero, méthodologie, FAQ.
- `/fr/implantations/paris/audits` (1658 LOC du template `[verticale]/page.tsx`) a sa **copie partielle** de ces sections, parfois divergente.
- Si Will modifie le hero de `/fr/audit`, les 430 pages ville `audits` ne changent pas → **incohérence brand cross-2 150 pages**.

**Cible Option A** : composants partagés. Une modif → tout propage.

```
src/components/services/audit/
  AuditHero.tsx           ← extrait de /fr/audit/page.tsx, accepte villeContext?
  AuditTrustPills.tsx
  AuditTierGrid.tsx       ← grid 4 tiers Flash/Ciblé/PME/ETI
  AuditMethodology.tsx
  AuditFaq.tsx            ← FAQ globale Speakable
  AuditCtaBlock.tsx
```

Puis :

- `/fr/audit/page.tsx` → assemblage des composants `<AuditHero />` etc.
- `/fr/implantations/[region]/[ville]/audits/page.tsx` → mêmes composants `<AuditHero villeContext={...} />` + sections villes uniques (`<VilleEcosysteme />`, `<VilleFaqGeolocalisee />`, `<VilleCommunesProches />`)

---

## 3. État de départ (validations préalables Sonnet 4.6)

### Commits récents stables

```
abd18b71 docs(sprint-a): brief Opus refactor DRY pages verticales ville  ← HEAD
67b46f8d feat(ville): bandeau orange contact + UX wording polish hub+verticales
43927222 fix(ville): retire durée d'audit fixe ("5 jours ouvrés") des landing pages
38ebc885 (commit Sprint Quality 2026)
```

### LOC actuelles (audit avant refactor)

| Fichier                                                                  | LOC      |
| ------------------------------------------------------------------------ | -------- |
| `src/app/[locale]/audit/page.tsx`                                        | 578      |
| `src/app/[locale]/interventions/page.tsx`                                | 986      |
| `src/app/[locale]/implementation/page.tsx`                               | 1 355    |
| `src/app/[locale]/un-a-un/page.tsx`                                      | 357      |
| `src/app/[locale]/sites-web-augmentes/page.tsx`                          | 523      |
| `src/app/[locale]/implantations/[region]/[ville]/[verticale]/page.tsx`   | 1 658    |
| `src/app/[locale]/implantations/[region]/[ville]/page.tsx`               | 1 772    |
| **TOTAL**                                                                | **7 229** |

Cible post-refactor : **~3 500 LOC** (réduction ~50% grâce à la déduplication).

### Composant déjà créé (réutilisable Sprint A)

`src/components/ville/OrangeContactBanner.tsx` (~70 LOC, Server Component, bg-terracotta, 2 CTAs /appel + /contact, props `isFr` + `villeSlug?`). Déjà inséré dans hub + verticale.

### Fichier généré LLM (à NE PAS retoucher dans Sprint A, ça reste propre)

`src/server/content-gen/generators/landing-ville-shared.ts` — pipeline LLM unique (200-380 words). Cap volontairement court pour éviter content duplicate. Le LLM ne génère QUE les sections ville-spécifiques (whyHere/body/faq), pas les composants service partagés.

---

## 4. Plan détaillé — 10 phases, ~44 sub-agents

### Phase 1 — Recon parallèle (5 agents Explore, ~15 min)

**Lancer en 1 seul message avec 5 Agent calls parallèles** (sub-agent type `Explore`) :

| Agent | Mission |
|---|---|
| **Recon-1 audit** | Lire `src/app/[locale]/audit/page.tsx` en entier (578 LOC). Retourner : liste sections (Hero/Trust/TierGrid/Method/FAQ/CTA), props/state utilisés, imports SSOT (`pricing.ts` etc.), JSON-LD présents, generateMetadata pattern, `use client` directives, ISR revalidate, total ~300 mots synthèse. |
| **Recon-2 interventions** | Idem pour `src/app/[locale]/interventions/page.tsx` (986 LOC). |
| **Recon-3 implementation** | Idem pour `src/app/[locale]/implementation/page.tsx` (1 355 LOC). |
| **Recon-4 un-a-un** | Idem pour `src/app/[locale]/un-a-un/page.tsx` (357 LOC). |
| **Recon-5 sites-web** | Idem pour `src/app/[locale]/sites-web-augmentes/page.tsx` (523 LOC). |

**Output Phase 1** : 5 rapports de synthèse → tu (Opus) consolides en un plan d'extraction détaillé pour Phase 2 (mappage section → composant cible).

**Vérification croisée intra-phase** : aucune (chacun lit un fichier différent, pas de risque).

---

### Phase 2 — Extraction composants services (5 agents general-purpose, ~2h)

**Lancer en 1 seul message avec 5 Agent calls parallèles** (sub-agent type `general-purpose`) :

| Agent | Mission | Dossier cible |
|---|---|---|
| **Extract-1 audit** | Extraire 6 composants depuis `/fr/audit/page.tsx` selon rapport Recon-1. Tous Server Components, signature `{ isFr: boolean; villeContext?: VilleContext }`. NE PAS toucher la page principale. Tester `pnpm typecheck` avant fin. | `src/components/services/audit/` |
| **Extract-2 interventions** | Idem 7-8 composants. | `src/components/services/interventions/` |
| **Extract-3 implementation** | Idem 8-10 composants. | `src/components/services/implementation/` |
| **Extract-4 un-a-un** | Idem 4-5 composants. | `src/components/services/un-a-un/` |
| **Extract-5 sites-web** | Idem 5-6 composants. PAS de Tarifs (section "Stack adaptée" à la place). | `src/components/services/sites-web/` |

**Type partagé à créer en prérequis Phase 2** :

```ts
// src/components/services/types.ts
export interface VilleContext {
  readonly name: string;       // "Paris"
  readonly region: string;     // "Île-de-France"
  readonly regionSlug: string; // "ile-de-france"
  readonly villeSlug: string;  // "paris"
  readonly inseeCode?: string; // "75056"
  readonly population?: number;
}
```

**Règles strictes pour chaque agent extract** :

- ❌ NE PAS importer `next/navigation`, `useState`, `useEffect` → tous Server Components
- ❌ NE PAS hardcoder hex (anti-hex check pre-commit bloque)
- ❌ NE PAS hardcoder SIREN (anti-siren check)
- ❌ NE PAS hardcoder prix (toujours `import { getTierById, formatAmount } from "@/content/pricing"`)
- ❌ NE PAS utiliser variants `Cta variant="paper"` ou `"outline-paper"` (inexistants → utiliser `<Link>` avec classes Tailwind)
- ✅ Importer `<Link>` depuis `@/i18n/navigation` (pas `next/link`)
- ✅ Couleurs via tokens (`bg-paper`, `text-ink`, `bg-terracotta`, `text-paper/85`)
- ✅ ARIA + h1/h2/h3 sémantique sans saut de niveau
- ✅ Si `villeContext` présent : H1 inclut `villeContext.name`, FAQ inclut 2-3 Q/R supplémentaires via prop `villeSpecificFaqs?: Array<{ q: string; a: string }>`
- ✅ JSON-LD Speakable inclus dans composants Hero + FAQ (helper `src/lib/seo/jsonld-helpers.ts` si disponible)

**Vérification croisée intra-phase 2** : chaque agent fait `pnpm typecheck` à la fin et reporte le résultat. Si fail, l'agent fix avant de retourner.

---

### Phase 3 — Refactor pages services principales (5 agents general-purpose, ~1h)

**Lancer en parallèle après Phase 2 OK**. Chaque agent refactor sa page service :

| Agent | Mission |
|---|---|
| **Refactor-1 audit** | Réécrire `/fr/audit/page.tsx` en assemblage des 6 composants extraits Phase 2. Garder `generateMetadata` + JSON-LD globaux + ISR. Cible LOC : ~80 lignes. |
| **Refactor-2 interventions** | Idem `/fr/interventions/page.tsx` → ~100 lignes |
| **Refactor-3 implementation** | Idem `/fr/implementation/page.tsx` → ~120 lignes |
| **Refactor-4 un-a-un** | Idem `/fr/un-a-un/page.tsx` → ~60 lignes |
| **Refactor-5 sites-web** | Idem `/fr/sites-web-augmentes/page.tsx` → ~80 lignes |

**Vérification croisée intra-phase 3** : chaque agent fait curl localhost `/fr/{service}` après son refactor et compare structure HTML (titles + sections présentes) avec snapshot pré-refactor. Si divergence → fix avant return.

---

### Phase 4 — Composants ville partagés (4 agents general-purpose, ~45 min)

**Lancer en parallèle après Phase 3 OK** :

| Agent | Mission | Composant |
|---|---|---|
| **Ville-1** | Créer `VilleEcosystemeLocal.tsx` (Server Component). Props `{ ville: Ville; isFr: boolean; verticale?: VerticaleSlug }`. Affiche : population, secteurs économiques principaux, écosystème tech local (mentions Inria/Cap Digital/Station F en tant qu'institutions locales, JAMAIS comme partenaires). | `src/components/ville/VilleEcosystemeLocal.tsx` |
| **Ville-2** | Créer `VilleCommunesProches.tsx` (Server Component). Props `{ ville: Ville; verticale: VerticaleSlug; isFr: boolean }`. Affiche grille 8-12 communes proches avec lien internal `/fr/implantations/{region}/{slug}/{verticale}` chacune. JSON-LD ItemList. | `src/components/ville/VilleCommunesProches.tsx` |
| **Ville-3** | Créer `VilleFaqGeolocalisee.tsx` (Server Component). Props `{ villeContext: VilleContext; faqs: Array<{ q: string; a: string }>; isFr: boolean }`. Affiche FAQ ville-spécifique LLM-générée. JSON-LD FAQPage + Speakable. | `src/components/ville/VilleFaqGeolocalisee.tsx` |
| **Ville-4** | Créer `VilleTissuEconomique.tsx` (Server Component) **OU** réutiliser un composant existant si présent (`Grep -r "TissuEconomique"`). Affiche tableau secteurs + nombre entreprises. | `src/components/ville/VilleTissuEconomique.tsx` |

**Note** : si des composants similaires existent déjà (probable, hub `[ville]/page.tsx` les a peut-être en inline), l'agent doit les extraire au lieu de re-créer (DRY strict).

---

### Phase 5 — Refactor template verticale `[verticale]/page.tsx` (1 agent, ~1h)

**SINGLE AGENT** (cohérence dispatcher critique) :

Mission : réécrire `src/app/[locale]/implantations/[region]/[ville]/[verticale]/page.tsx` (1 658 LOC → cible ~400 LOC).

Pattern :

```tsx
const villeContext: VilleContext = {
  name: ville.nameFr,
  region: region.nameFr,
  regionSlug: region.slug,
  villeSlug: ville.slug,
  inseeCode: ville.insee,
  population: ville.population,
};

const article = await getLandingVilleArticleByVertical({ ville: ville.slug, vertical: verticale });

switch (verticale) {
  case "audits":
    return (
      <>
        <AuditHero isFr={isFr} villeContext={villeContext} />
        <AuditTrustPills isFr={isFr} />
        <VilleEcosystemeLocal ville={ville} isFr={isFr} verticale="audits" />
        <AuditTierGrid isFr={isFr} villeContext={villeContext} />
        <AuditMethodology isFr={isFr} />
        <VilleCommunesProches ville={ville} verticale="audits" isFr={isFr} />
        <AuditFaq isFr={isFr} villeContext={villeContext} villeSpecificFaqs={article?.faq?.slice(0, 3) ?? []} />
        <OrangeContactBanner isFr={isFr} villeSlug={ville.slug} />
        <AuditCtaBlock isFr={isFr} villeContext={villeContext} />
      </>
    );
  case "interventions":
    // assemblage interventions + sections ville
  case "implementations":
    // ...
  case "un-a-un":
    // ...
  case "sites-web-ia":
    // ...
}
```

Garder `generateMetadata`, `generateStaticParams`, ISR `revalidate=86400`, JSON-LD globaux Breadcrumb+Service.

---

### Phase 6 — Refactor template hub `[ville]/page.tsx` (1 agent, ~45 min)

**SINGLE AGENT** (cohérence dispatcher) :

Mission : réécrire `src/app/[locale]/implantations/[region]/[ville]/page.tsx` (1 772 LOC → cible ~300 LOC).

Le hub liste les 5 verticales pour la ville. Réutilise :

- `VilleEcosystemeLocal` (intro ville)
- `VilleTissuEconomique` (secteurs)
- 5 cards "Verticale" linkant vers `[verticale]/page.tsx`
- `OrangeContactBanner`
- `VilleCommunesProches` (verticale: undefined → liens hub villes proches)
- `VilleFaqGeolocalisee` (FAQ générique ville)

---

### Phase 7 — Vérification croisée cohérence (10 agents Explore parallèles, ~30 min)

**Lancer en 1 seul message avec 10 Agent calls parallèles** (sub-agent type `Explore`) :

| Agent | Mission |
|---|---|
| **Coherence-1 audit** | Diff `<AuditHero />` rendu sur `/fr/audit` vs `/fr/implantations/ile-de-france/paris/audits`. Vérifier : mêmes classes Tailwind, mêmes textes hors villeContext, JSON-LD identique. Report divergences. |
| **Coherence-2 interventions** | Idem |
| **Coherence-3 implementation** | Idem |
| **Coherence-4 un-a-un** | Idem |
| **Coherence-5 sites-web** | Idem |
| **Coherence-6 pricing** | Grep tous les composants `src/components/services/*` pour pattern `\d+€` ou `\d+ €`. Doit être ZÉRO (tout via SSOT pricing.ts). |
| **Coherence-7 anti-brand** | Grep composants pour : "NDA", "contact@axion-ia", "Big 4", "LVMH", "BNP Paribas", "Station F", "Cap Digital", "Inria" en contexte partenariat (vs mention locale). Tolérance OK pour `VilleEcosystemeLocal` (mention écosystème). Report fabrications brand. |
| **Coherence-8 TPE inclusion** | Grep composants pour mentions audience : doit inclure TPE (1-10), PME (10-250), ETI (250-4999), GE (5000+). Si juste "PME/ETI", report. |
| **Coherence-9 JSON-LD Speakable** | Grep composants Hero + FAQ pour `SpeakableSpecification`. Tous Hero + tous FAQ doivent l'avoir. Report manquants. |
| **Coherence-10 ISR + metadata** | Vérifier `/fr/audit/page.tsx` etc. ont `generateMetadata` + ISR `revalidate=86400` (ou SSG pur explicite). Vérifier templates ville ont `generateStaticParams` cohérent. |

**Output Phase 7** : 10 rapports. Si N rapports détectent issues, tu (Opus) lance fix batch (1-3 agents general-purpose) AVANT Phase 8.

---

### Phase 8 — Tests runtime (5 agents Explore parallèles + Bash, ~20 min)

**Prérequis** : démarrer `pnpm dev` en background (1 seul, partagé).

**Lancer en 1 seul message avec 5 Agent calls parallèles** :

| Agent | URLs à tester |
|---|---|
| **Runtime-1 audit** | curl `/fr/audit` + `/fr/implantations/ile-de-france/paris/audits`. Vérifier : 200 OK, H1 contient "Paris" sur verticale, sections rendues présentes (Hero/TierGrid/etc.), JSON-LD valide JSON, ISR header. |
| **Runtime-2 interventions** | Idem `/fr/interventions` + `/fr/implantations/ile-de-france/paris/interventions` |
| **Runtime-3 implementation** | Idem `/fr/implementation` + `/fr/implantations/ile-de-france/paris/implementations` |
| **Runtime-4 un-a-un** | Idem `/fr/un-a-un` + `/fr/implantations/ile-de-france/paris/un-a-un` |
| **Runtime-5 sites-web** | Idem `/fr/sites-web-augmentes` + `/fr/implantations/ile-de-france/paris/sites-web-ia` |

**Output Phase 8** : 5 rapports. Si N URLs return 500/404 ou structure cassée, fix puis re-run Phase 8.

---

### Phase 9 — Vérification finale DOUBLE PASS (15 agents parallèles, ~1h)

**Pass A — Fonctionnel & qualité** (lancer 10 agents parallèles en 1 message) :

| Agent | Mission |
|---|---|
| **Final-A1 audit fonctionnel** | Vérifier `/fr/audit` ET `/fr/implantations/ile-de-france/paris/audits` : tous les CTAs cliquent vers les bonnes routes, les prix matchent SSOT, le rendering est cohérent visuellement (curl + parse HTML). |
| **Final-A2 interventions fonctionnel** | Idem |
| **Final-A3 implementation fonctionnel** | Idem |
| **Final-A4 un-a-un fonctionnel** | Idem |
| **Final-A5 sites-web fonctionnel** | Idem |
| **Final-A6 hub ville** | Vérifier `/fr/implantations/ile-de-france/paris` : 5 cards verticales présentes + linkent correctement + intro ville + écosystème + FAQ + bandeau orange. |
| **Final-A7 typecheck + lint** | `pnpm typecheck` ✅ 0 erreur + `pnpm lint` ✅ 0 erreur. Report exact si fail. |
| **Final-A8 tests vitest** | `pnpm test --run` baseline (~1888/1895 selon dernière mesure). Report delta. |
| **Final-A9 bundle size** | `pnpm size-limit` ou `pnpm build && du -sh .next/static` → bundle delta vs `main` ≤ +5 KB gz (AGENTS.md gate). |
| **Final-A10 SEO/AEO** | Pour chacune des 11 pages testées Phase 8 : meta title + description + canonical + hreflang + JSON-LD complet. Report toute régression. |

**Pass B — Production-ready** (lancer 5 agents parallèles en 1 message après Pass A OK) :

| Agent | Mission |
|---|---|
| **Final-B1 build Docker stub.invalid** | Vérifier que le code ne casse pas le build GH Actions avec `DATABASE_URL=postgresql://stub:stub@stub.invalid:5432/stub`. Lire `src/lib/prisma.ts` et confirmer que les nouvelles pages ne font pas d'appels DB direct non-protégés au SSG. |
| **Final-B2 anti-hex check** | `pnpm anti-hex:check` → OK 0 hex. |
| **Final-B3 anti-siren check** | `pnpm anti-siren:check` → OK 0 siren. |
| **Final-B4 use-client check** | `pnpm use-client:check` → every directive justified, aucun nouveau use client ajouté sans justification. |
| **Final-B5 brand voice + cohérence cross-page** | Lire 11 pages testées Phase 8 et vérifier voice cohérente, pas de duplicate content (Jaccard 3-gram check si script dispo), wording brand respecté (équipe d'experts pas restreinte, TPE/PME/ETI/GE inclusion, etc.). |

**Output Phase 9** : 15 rapports. STOP & ASK Will si UN SEUL rapport report ⚠️ critique. Sinon → Phase 10.

---

### Phase 10 — Commit + push + memory (single, ~15 min)

1. Commit final atomique :

```
refactor(ville): Sprint A DRY - 5 services + 2 templates ville unifiés (-50% LOC)

Composants partagés src/components/services/{audit,interventions,
implementation,un-a-un,sites-web}/ acceptant villeContext? optional.
1 modif page service -> 2150 pages ville auto-update.

LOC: 7229 -> ~3500 (-50%).
Verifications: 10 cross-coherence + 15 final double-pass OK.
Tests: typecheck OK, vitest 1888/1895 baseline preserved, bundle delta <+5KB gz.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
```

2. Push `git push origin main --no-verify` (hooks lourds, GH Actions re-checke)
3. Mettre à jour MEMORY.md avec entrée Sprint A LIVRÉ
4. Créer rapport `_AUDIT/SPRINT-A-VILLE-DRY-2026-05-25/RAPPORT-FINAL.md` consolidant les 15 rapports Pass A+B

---

## 5. Pièges à éviter (lessons learned conv précédente)

### A. `Cta` variants n'existent pas

Dans `OrangeContactBanner.tsx`, on a tenté `<Cta variant="paper" />` → erreur runtime "variant paper does not exist". Solution : `<Link>` avec classes Tailwind custom. Pareil dans les nouveaux composants.

### B. Tarification SSOT obligatoire

Toujours importer depuis `src/content/pricing.ts` :

```ts
import { AUDIT_TIERS, getTierById, formatAmount, getEntryPriceEur } from "@/content/pricing";
```

Jamais hardcoder un prix. Risque incohérence cross-pages.

### C. Inclusion TPE/PME/ETI/GE

Toutes les cibles audiences doivent mentionner les 4 tailles, jamais juste PME/ETI :

- TPE (1-10)
- PME (10-250)
- ETI (250-4999)
- Grandes Entreprises (5000+)

### D. Anti-fabrication brand

Bannir des composants TOUTE mention de :

- "NDA disponible" (utiliser "discrétion garantie" générique)
- `contact@axion-ia.com` (utiliser `/contact` ou `/appel`)
- Durée d'audit fixe en jours (utiliser "selon votre périmètre")
- Partenariats LVMH / BNP / Cap Digital / Inria / Station F (ce sont des mentions locales écosystème uniquement, pas des clients/partenaires)
- "équipe restreinte" (utiliser "équipe d'experts")
- "Big 4 certifié" (faux)

### E. Wording sites-web

Bannir "applications" (vendre comme "sites web & plateformes SaaS"). La stack adaptée doit être présentée comme "toujours la meilleure possible selon vos objectifs".

### F. Speakable cross-template

JSON-LD `SpeakableSpecification` doit être présent sur chaque composant Hero + FAQ pour Google AEO. Voir `src/lib/seo/jsonld-helpers.ts` ou équivalent.

### G. ISR `revalidate=86400`

Garder le `export const revalidate = 86400` sur le template ville. La page service principale peut être SSG pure (pas de revalidate explicite).

### H. Commit hooks lourds

`pnpm typecheck` dans pre-commit hook prend ~2-3 min. Si OOM → push avec `--no-verify` (déjà autorisé Will). Le pipeline GH Actions re-checke de toute façon.

### I. Branche

Travailler directement sur `main` (le user pousse depuis cette branche). Pas de feature branch sauf si refactor risqué.

### J. Conv parallèle Manon

Surveiller `git status` au démarrage. Si fichiers étrangers détectés → `git stash push -m "pre-sprint-a-opus"` avant de commencer, puis `git stash pop` à la fin.

### K. Build stub.invalid (AGENTS.md ADR 0026)

Ne JAMAIS faire d'appel Prisma direct sans protection dans une page SSG. Si nouvelle section a besoin de DB :

```ts
if (process.env.DATABASE_URL?.includes("stub.invalid")) return <fallback />;
```

### L. Server Components only

Aucun nouveau `"use client"` directive dans `src/components/services/*` ou `src/components/ville/*`. Si vraiment besoin (rare), justification stricte + check `pnpm use-client:check`.

---

## 6. Critères de succès Sprint A complet

- [ ] 5 dossiers `src/components/services/{audit,interventions,implementation,un-a-un,sites-web}/` créés
- [ ] ~30 composants extraits, tous Server Components, tous avec `villeContext?` optionnel
- [ ] 4 composants ville partagés créés (`VilleEcosystemeLocal`, `VilleCommunesProches`, `VilleFaqGeolocalisee`, `VilleTissuEconomique`)
- [ ] 5 pages services principales (`/fr/audit`, etc.) réduites à des assemblages (~50-100 LOC chacune)
- [ ] Template verticale `[ville]/[verticale]/page.tsx` réduit à un dispatcher (~400 LOC)
- [ ] Template hub `[ville]/page.tsx` réduit à un assemblage (~300 LOC)
- [ ] LOC totale réduite de ~7 229 à ~3 500 (réduction ~50%)
- [ ] `pnpm typecheck` ✅ 0 erreur
- [ ] `pnpm test --run` ✅ baseline préservée (1888/1895)
- [ ] `pnpm anti-hex:check` ✅ 0 hex
- [ ] `pnpm anti-siren:check` ✅ 0 siren
- [ ] `pnpm use-client:check` ✅ OK
- [ ] Bundle size delta vs main ≤ +5 KB gz (size-limit gate)
- [ ] 11 URLs testées runtime (5 services + 5 verticales Paris + 1 hub Paris) → 200 OK + structure cohérente
- [ ] 10 rapports cohérence Phase 7 ✅ (zéro divergence inacceptable)
- [ ] 15 rapports finale Phase 9 ✅ (Pass A fonctionnel + Pass B production-ready)
- [ ] Commit + push final
- [ ] MEMORY.md mis à jour avec entrée Sprint A LIVRÉ
- [ ] Rapport `_AUDIT/SPRINT-A-VILLE-DRY-2026-05-25/RAPPORT-FINAL.md` consolidé

---

## 7. Notes Opus (recommandations méthode multi-agents)

- **Tu es Opus** → tu peux te permettre de lire les 7 fichiers en entier avant de commencer (cumul ~7 229 LOC, ~200 KB, tu encaisses bien). Cela évitera des miss de patterns existants.
- **Parallel sub-agents** : pour chaque phase qui le permet, lance les agents dans **un seul message avec N Agent tool uses**. Anthropic SDK les exécute vraiment en parallèle.
- **Ne PAS refactor 5 verticales en parallèle SANS vérification croisée** : la Phase 7 (10 agents cohérence) est obligatoire entre Phase 6 et Phase 8. Sinon risque divergence non détectée.
- **Commit intermédiaires NON requis** : Sprint A étant un refactor atomique, un seul commit final Phase 10 est OK. Sauf si Phase 5 ou 6 dure > 2h sans output visible, alors commit intermédiaire de sauvegarde.
- **Test runtime obligatoire** après Phase 8. Pas juste typecheck — vraiment `pnpm dev` + curl + visuel structure HTML.
- **Si un agent retourne ⚠️ critique** : STOP immédiat, fix le problème, re-lance l'agent verif avant de continuer. Pas de "on verra à la fin".
- **Double pass Phase 9 = filet de sécurité** : Pass A vérifie le fonctionnel, Pass B vérifie production-ready. Tous les 15 doivent ✅ avant commit final.
- **STOP & ASK Will** si :
  - Bundle delta > +5 KB gz
  - Tests vitest régresses > 5 tests
  - URL runtime 500/404 inattendue
  - Composant nécessite `use client` non prévu

---

## 8. Démarrage

Ouvrir une nouvelle conversation Claude Opus avec ce prompt initial :

```
Lis le brief complet C:\Users\willi\Documents\Projets\Axion-IA\axionia\_AUDIT\SPRINT-A-VILLE-DRY-2026-05-25\SPRINT-A-BRIEF-OPUS.md puis exécute Sprint A complet en suivant le plan 10 phases avec ~44 sub-agents parallèles. Travaille sur main. Pas de validation Will intermédiaire (sauf si STOP & ASK déclenché par tes propres règles). Commit final Phase 10 + push + rapport consolidé.
```

Bon Sprint A. 🚀
