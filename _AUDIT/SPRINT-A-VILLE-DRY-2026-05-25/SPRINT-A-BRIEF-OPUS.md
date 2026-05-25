# Sprint A — Refactor DRY pages verticales ville (Brief Claude Opus)

**Date** : 2026-05-25
**Branche cible** : `main` (HEAD `67b46f8d`)
**Estimation totale** : 5-9 h
**Owner** : Claude Opus (nouvelle conversation)

---

## 1. Objectif (en une phrase)

Refactor les **5 pages services principales** + **2 templates ville** pour qu'une modification d'une section sur la page principale (`/fr/audit`) propage automatiquement aux **2 150 pages ville verticales** (`/fr/implantations/[region]/[ville]/audits`), via composants partagés acceptant un `villeContext?` optionnel.

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
67b46f8d feat(ville): bandeau orange contact + UX wording polish hub+verticales  ← HEAD
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

## 4. Plan détaillé (3 sous-sprints)

### Sous-sprint 2A — Verticale `audits` (proof of concept, 2-3 h)

**Pourquoi commencer par audits** : 578 LOC = la page service la plus courte → refactor moins risqué.

#### Étape 1 — Audit structure `/fr/audit/page.tsx` (~20 min)

Identifier les sections distinctes du fichier. Lire le fichier en entier (`Read` avec offset 0/limit 578) et lister :

- Hero (titre H1 + CTA)
- Pills trust (chiffres clés)
- Grid 4 tiers tarifs (Flash/Ciblé/PME/ETI)
- Méthodologie (étapes process)
- FAQ globale
- CTA final

#### Étape 2 — Extraction composants (~1h30)

Créer dans `src/components/services/audit/` (nouveau dossier) :

1. `AuditHero.tsx` — accepte `{ isFr: boolean; villeContext?: { name: string; region: string; regionSlug: string; villeSlug: string } }`. Si `villeContext` présent, H1 devient `Audit IA à {villeContext.name}` au lieu de `Audit IA pour entreprises françaises`.
2. `AuditTrustPills.tsx` — props minimales `{ isFr }`, contenu hardcodé.
3. `AuditTierGrid.tsx` — props `{ isFr, villeContext? }`, lit `AUDIT_TIERS` depuis `src/content/pricing.ts` (SSOT). Si `villeContext`, ajouter mention `Tarifs valides pour {ville} et toute la France métropolitaine` en dessous.
4. `AuditMethodology.tsx` — props `{ isFr }`, étapes hardcodées avec icônes Lucide.
5. `AuditFaq.tsx` — props `{ isFr, villeContext? }`. Si `villeContext`, ajouter 2-3 Q/R LLM-générées via prop optionnelle `villeSpecificFaqs?: Array<{ q: string; a: string }>`.
6. `AuditCtaBlock.tsx` — props `{ isFr, villeContext? }`. CTA principal vers `/audit/demande?ville={villeContext.villeSlug}` si villeContext.

**Règles strictes** :

- ❌ NE PAS importer `next/navigation`, `useState`, etc. → tous Server Components.
- ✅ Importer depuis `@/i18n/navigation` pour `<Link>` (pas `next/link`).
- ✅ Couleurs via Tailwind tokens (`bg-paper`, `text-ink`, `bg-terracotta`) jamais hex hardcodé (anti-hex check pre-commit).
- ✅ Aria + h1/h2/h3 sémantique sans saut.

#### Étape 3 — Refactor `/fr/audit/page.tsx` (~30 min)

Remplacer le contenu inline par assemblage de composants :

```tsx
export default async function AuditPage({ params }) {
  const { locale } = await params;
  const isFr = locale === "fr";
  return (
    <>
      <AuditHero isFr={isFr} />
      <AuditTrustPills isFr={isFr} />
      <AuditTierGrid isFr={isFr} />
      <AuditMethodology isFr={isFr} />
      <AuditFaq isFr={isFr} />
      <AuditCtaBlock isFr={isFr} />
    </>
  );
}
```

Garder le `generateMetadata` + JSON-LD existants. Test : visite `/fr/audit` → zéro changement visuel ni perte de section.

#### Étape 4 — Template verticale ville `audits` (~45 min)

Dans `/fr/implantations/[region]/[ville]/[verticale]/page.tsx`, remplacer le bloc actuel (case `verticale === "audits"`) par :

```tsx
const villeContext = {
  name: ville.nameFr,
  region: region.nameFr,
  regionSlug: region.slug,
  villeSlug: ville.slug,
};

return (
  <>
    <AuditHero isFr={isFr} villeContext={villeContext} />
    <AuditTrustPills isFr={isFr} />
    <VilleEcosystemeLocal ville={ville} /> {/* section ville unique */}
    <AuditTierGrid isFr={isFr} villeContext={villeContext} />
    <AuditMethodology isFr={isFr} />
    <VilleCommunesProches ville={ville} verticale="audits" />
    <AuditFaq isFr={isFr} villeContext={villeContext} villeSpecificFaqs={article.faq?.slice(0, 3)} />
    <OrangeContactBanner isFr={isFr} villeSlug={ville.slug} />
    <AuditCtaBlock isFr={isFr} villeContext={villeContext} />
  </>
);
```

Les composants `VilleEcosystemeLocal` et `VilleCommunesProches` peuvent rester dans `src/components/ville/` (ils n'existent peut-être pas encore — créer si besoin).

#### Étape 5 — Test runtime Paris (~15 min)

```powershell
pnpm dev
```

Curl 2 URLs et valide visuellement :

- `http://localhost:3000/fr/audit` → page service principale inchangée
- `http://localhost:3000/fr/implantations/ile-de-france/paris/audits` → page ville utilise mêmes composants + sections villes en plus

Si OK → commit + push, demander validation Will avant de continuer Sous-sprint 2B.

---

### Sous-sprint 2B — 4 autres verticales (3-4 h, si 2A validé Will)

Appliquer le même pattern aux 4 autres :

| Verticale | Page principale | Composants à extraire dans | Notes spécifiques |
|---|---|---|---|
| `interventions` | `/fr/interventions/page.tsx` (986 LOC) | `src/components/services/interventions/` | Plus de sections (catalogue formations) → ~7-8 composants |
| `implementations` | `/fr/implementation/page.tsx` (1355 LOC) | `src/components/services/implementation/` | Page la plus grosse → ~8-10 composants. **Attention slug** : verticale = `implementations` (pluriel) mais URL service = `/implementation` (singulier). |
| `un-a-un` | `/fr/un-a-un/page.tsx` (357 LOC) | `src/components/services/un-a-un/` | Page la plus courte → ~4-5 composants. Doit inclure cible élargie TPE + cadres décisionnaires PME/ETI (déjà dans `verticale-meta.ts` mais à propager). |
| `sites-web-ia` | `/fr/sites-web-augmentes/page.tsx` (523 LOC) | `src/components/services/sites-web/` | **PAS de tarifs** (sur devis). Section "Stack adaptée" emphasant adaptation par projet. |

Pour chaque verticale, répéter Étapes 1→5 du Sous-sprint 2A.

---

### Sous-sprint 2C — Cleanup + tests (~1 h)

1. `pnpm typecheck` → 0 erreur
2. `pnpm test --run` → baseline préservée (~1888/1895 selon dernière mesure)
3. Vérifier qu'aucune section n'est dupliquée entre page principale et template ville
4. Commit final + push
5. Mettre à jour MEMORY.md avec nouveau pattern + LOC réduction

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

---

## 6. Critères de succès Sprint A complet

- [ ] 5 dossiers `src/components/services/{audit,interventions,implementation,un-a-un,sites-web}/` créés
- [ ] ~30 composants extraits, tous Server Components, tous avec `villeContext?` optionnel
- [ ] 5 pages services principales (`/fr/audit`, etc.) réduites à des assemblages (~50-100 LOC chacune)
- [ ] Template verticale `[ville]/[verticale]/page.tsx` réduit à un dispatcher selon `verticale` slug, chaque branche assemblant les composants service + composants ville
- [ ] LOC totale réduite de ~7 229 à ~3 500 (réduction ~50%)
- [ ] `pnpm typecheck` ✅ 0 erreur
- [ ] `pnpm test --run` ✅ baseline préservée
- [ ] Visite live `/fr/audit` ET `/fr/implantations/ile-de-france/paris/audits` → cohérence visuelle parfaite, sections ville en plus dans verticale
- [ ] Commit + push final
- [ ] MEMORY.md mis à jour avec entrée Sprint A LIVRÉ

---

## 7. Notes Opus (recommandations méthode)

- **Tu es Opus** → tu peux te permettre de lire les 7 fichiers en entier avant de commencer (cumul ~7 229 LOC, ~200 KB, tu encaisses bien). Cela évitera des miss de patterns existants.
- **Parallel sub-agents Explore** : pour identifier doublons section-by-section entre page service et template ville, lance 5 Explore en parallèle (un par verticale).
- **Ne PAS refactor 5 verticales en parallèle**. Faire **séquentiel** (audits d'abord, validation Will, puis les 4 autres). Risque régression cumulé sinon.
- **Commit fréquemment** (1 commit par étape majeure du Sous-sprint 2A). Permettra rollback granulaire si bug détecté.
- **Test runtime obligatoire** après chaque verticale refactorée. Pas juste typecheck — vraiment `pnpm dev` + curl + visuel.

---

## 8. Démarrage

Ouvrir une nouvelle conversation Claude Opus avec ce prompt initial :

```
Lis le brief complet C:\Users\willi\Documents\Projets\Axion-IA\axionia\_AUDIT\SPRINT-A-VILLE-DRY-2026-05-25\SPRINT-A-BRIEF-OPUS.md puis démarre le Sous-sprint 2A (verticale audits, proof of concept). Travaille sur main, commit après chaque étape majeure. Demande validation Will avant de passer au Sous-sprint 2B.
```

Bon Sprint A. 🚀
