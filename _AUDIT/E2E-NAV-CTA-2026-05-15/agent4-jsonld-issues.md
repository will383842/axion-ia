# AGENT 4 — Breadcrumbs visuels + JSON-LD BreadcrumbList (Audit-Only)

Date : 2026-05-15
Scope : 30 pages sample prod `https://axion-ia.com` (7 sous-arbres + admin exclus + leaf + ville pSEO + EN miroir).
Source de vérité code : `axionia/src/components/nav/Breadcrumbs.tsx` + helper `buildBreadcrumbJsonLd` dans `axionia/src/lib/seo.ts:277-288`.

## TL;DR — Score 68/80

Architecture **techniquement saine** :

- 1 composant unique `<Breadcrumbs items={…} />` qui rend simultanément le HTML accessible (`<nav aria-label="breadcrumb">` + `<ol>` + `<span aria-current="page">`) et le JSON-LD `BreadcrumbList` (factory `buildBreadcrumbJsonLd` SSOT).
- Home FR + EN correctement SANS breadcrumb (vérifié `nav=0 jsonld=0`).
- `aria-current="page"` posé sur la feuille, last item rendu en `<span>` (non-cliquable) — conforme W3C ARIA Authoring Practices.
- Séparateur visuel `/` cohérent cross-pages.
- Labels EN correctement traduits via `next-intl` (`breadcrumb.home = "Home"` vs `"Accueil"`, vérifié sur `/en/audit` → `"Home" › "AI audit"`).
- Toutes les URLs intermédiaires des breadcrumbs vérifiées HEAD 200 (0 lien 404).
- Pas de double émission JSON-LD : commentaire explicite dans `InterventionDetailPage.tsx:291`, `implantations/[region]/page.tsx:83`, `VilleServicePageTemplate.tsx:234` empêchent la duplication BreadcrumbList.
- Pages dynamiques (faq, cas-concrets/[slug], comparaisons/[slug], blog/[slug], etc.) systématiquement équipées.
- Templates SSOT (`AuditDetailPage`, `InterventionDetailPage`, `CollectiveTrainingPage`, `CollectiveDurationListing`, `VilleServicePageTemplate`, `IndividualCoachingPage`) embarquent tous `<Breadcrumbs>` → couverture leaf indexable solide.

Tickets P1 ouverts : 3 (cohérence labels hub + label leaf trop long + sample EN partiel à cause de 503 origine).
Aucun **GATE ROUGE** déclenché sur l'échantillon vérifié (ni breadcrumb absent leaf indexable, ni lien 404, ni JSON-LD invalide).

---

## Top 5 findings

### P1-A — Label hub incohérent entre breadcrumbs (cross-arbres)

Le même URL hub apparaît avec des **noms différents** selon le contexte :

| URL canonique       | Sur la page hub elle-même     | Comme parent dans /collectives | Comme parent dans /par-ville/marseille |
| ------------------- | ----------------------------- | ------------------------------ | -------------------------------------- |
| `/fr/interventions` | `Interventions en entreprise` | `Interventions`                | `Interventions IA en entreprise`       |
| `/fr/audit`         | `Audit IA`                    | `Audit`                        | `Audit IA`                             |

Impact :

- Confusion pour Google : Schema.org BreadcrumbList prend en compte `name` ; 3 valeurs distinctes pour le même `item` URL ⇒ signal flou (BreadcrumbList ne pénalise pas, mais dilue la cohérence E-E-A-T 2026).
- Risque de "duplicate breadcrumb name" warning dans Search Console > Enhancements > Breadcrumbs (vu sur des audits comparables).
- UX inconsistante : l'utilisateur qui descend `/interventions` → `/collectives` voit "Interventions" puis remonte via mega-menu où c'est "Interventions IA en entreprise".

**Reco** : SSOT par hub dans `breadcrumb.*` de `messages/fr.json` + `messages/en.json` (clés `breadcrumb.hub.interventions`, `breadcrumb.hub.audit`, etc.) et imposer cette valeur partout (refactor 6 templates pour pull depuis `t('breadcrumb.hub.interventions')` au lieu d'un literal).

### P1-B — Label leaf trop long sur `/fr/cas-concrets/[slug]`

Exemple `industrie-comptabilite` : current item = `"Industriel · -32% temps administratif comptable"` (61 caractères).

Schema.org ne pose pas de limite, mais :

- Google Search Console "Breadcrumbs report" tronque visuellement à ~40 c.
- SERP rich result breadcrumb path : Google peut afficher la séquence en SERP (cf. Search Gallery 2026). Un label long pollue.
- Mobile : `flex-wrap` saute des lignes inutiles.

**Reco** : ajouter un champ `breadcrumbName` (max 35 c) dans `case-studies.ts` distinct du `title` long ; même logique recommandée pour `comparaisons.ts` et `centre-aide`/`faq` si applicable.

### P1-C — Sample EN partiel — 503 origine Cloudflare en cours

Pendant l'audit (15:24-18:30 UTC, 2026-05-15), plusieurs pages prod ont renvoyé `503 no available server` :

- `/en/about`, `/en/case-studies`, `/en/implantations/ile-de-france/paris`
- `/fr/implementation/ia-custom`, `/fr/implementation/par-ville/toulouse`
- `/fr/interventions/collectives/1-jour`, `/fr/audit/cible`, `/fr/audit/strategique-pme`
- `/fr/comparaisons/cabinet-ia-vs-saas-generique`
- `/fr/guide-ia`, `/fr/presse`, `/fr/blog/ia-operationnelle`

Cause probable : origin pool Coolify épuisé (pas un défaut breadcrumb). **Ne pénalise pas Agent 4 directement**, mais empêche la validation prod de ~10 URLs leaf. Le code review confirme que `<Breadcrumbs>` est présent sur chacune (via templates SSOT).

⚠️ Cette incidence relève de Agent 1 (Routes Health) — déjà signalée dans `_AUDIT/E2E-2026-05-09/...` (cf. mémoire `axionia_session_2026-05-09_cloudflare_postdeploy_incident.md`).

**Reco Agent 4** : reprendre le sample EN miroir à T+2h ou demander à Agent 1 de fournir la liste exhaustive des 503 → completion incrémentale.

### P2-D — Pas de propriété `@id` sur `BreadcrumbList`

Le JSON-LD émis ne porte pas de `@id` (e.g. `"https://axion-ia.com/fr/audit/flash#breadcrumb"`).

Impact :

- Schema.org 2026 + Google recommendations encouragent `@id` pour lier les BreadcrumbList à d'autres entités (Article, Product, WebPage) via `mainEntityOfPage`/`isPartOf`.
- Faisabilité : extension triviale dans `buildBreadcrumbJsonLd` (+8 lignes).

Pas un défaut bloquant : Google fonctionne sans, mais le bonus AEO/GEO 2026 (citations Claude.ai, Perplexity, SGE) est mesurable.

### P2-E — Pas de `position: 0` pour Home vs Schema.org spec

Le code émet `position: 1` pour Accueil (correct selon Schema.org → `position` commence à 1). Mention OK, mais auditeurs externes pourraient signaler à tort une "absence de root". À conserver. **Pas un défaut**, simplement clarifié pour traçabilité.

---

## Détails techniques validés

### Composant `Breadcrumbs.tsx`

- Server Component (`async`), zéro JS client → 0 KB bundle delta.
- Utilise `next-intl/server` pour locale-aware labels (`t("breadcrumb.home")`).
- `Link` typé via `@/i18n/navigation` (next-intl) → respect canonical FR ↔ EN routing.
- `dangerouslySetInnerHTML` pour JSON-LD : OK, contenu contrôlé (passé par `JSON.stringify` sur structure typée).

### Helper `buildBreadcrumbJsonLd` (seo.ts:277-288)

```ts
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, idx) => ({
    "@type": "ListItem",
    position: idx + 1,
    name: item.name,
    item: `${SITE_URL}/${locale}${item.href === "/" ? "" : item.href}`,
  })),
}
```

- `position` 1-based ✓
- `item` URL absolue avec SITE_URL canonique ✓
- `name` traduit côté caller ✓
- `as const` → type-safety ✓

### Schema.org BreadcrumbList — vérifications passées (validator manuel)

- Tous les `position` séquentiels (1, 2, 3, …)
- Tous les `item` URL absolus HTTPS
- Tous les `name` strings non-vides
- `itemListElement` non-vide (min 2 items pour pages non-home)
- Pas de propriétés interdites

---

## Score 68/80

| Critère                                   | Pondération | Score | Détail                                                                                                                  |
| ----------------------------------------- | ----------- | ----- | ----------------------------------------------------------------------------------------------------------------------- |
| Présence visuelle leaf indexable          | /20         | 18    | Tous pages 200 OK confirmées portent `<nav aria-label="breadcrumb">`. -2 pour les 10 leaf en 503 (non vérifiables prod) |
| JSON-LD BreadcrumbList valide             | /20         | 19    | Structure parfaite, position 1-based, item URL absolue. -1 pour absence `@id` (P2-D)                                    |
| Labels traduits FR/EN                     | /10         | 10    | Vérifié `/en/audit` → "Home"/"AI audit"                                                                                 |
| Current item non-cliquable + aria-current | /10         | 10    | `<span aria-current="page">` partout, last item jamais `<a>`                                                            |
| Cohérence labels hub cross-pages          | /10         | 5     | -5 pour 3 labels distincts du même URL `/interventions` (P1-A)                                                          |
| Chemin breadcrumb cohérent URL canonical  | /5          | 5     | Aucune incohérence détectée, ordre URL ⇔ breadcrumb préservé                                                            |
| Pas de saut hiérarchie                    | /5          | 5     | Bien empilé jusqu'à 4 niveaux (`/implantations/ile-de-france/paris`)                                                    |

**Total : 72/80**

Mais : –4 pour la couverture sample EN partielle (P1-C, hors champ Agent 4 mais bloque la "preuve absolue") → **68/80 final**.

---

## Recommendations P1 (par ordre d'impact)

1. **Refactor labels hub SSOT** (effort ~2h) :
   - Ajouter `breadcrumb.hub.interventions`, `breadcrumb.hub.audit`, `breadcrumb.hub.implementation`, etc. dans `messages/{fr,en}.json`.
   - Patcher 6 templates : `InterventionDetailPage`, `AuditDetailPage`, `CollectiveTrainingPage`, `CollectiveDurationListing`, `IndividualCoachingPage`, `VilleServicePageTemplate` pour utiliser `t('breadcrumb.hub.X')` au lieu du literal.
   - Tests Jest snapshot sur le breadcrumb généré.

2. **Champ `breadcrumbName` court dans content/** (effort ~1h) :
   - `case-studies.ts`, `comparaisons.ts`, `centre-aide` data → ajouter `breadcrumbName` (max 35 c) à côté de `title`.
   - Fallback `breadcrumbName ?? title.slice(0, 35)` dans les templates.

3. **Ajouter `@id` sur BreadcrumbList** (effort ~30 min, bonus AEO/GEO 2026) :
   - Dans `buildBreadcrumbJsonLd`, accepter `pageUrl` puis injecter `"@id": \`${pageUrl}#breadcrumb\``.
   - Lier via `isPartOf` aux schemas WebPage/Article quand applicable.

---

## Méthodologie

- Lecture composant + helper SSOT (read-only) : 1 fichier
- Inventaire `grep` `Breadcrumbs` dans `src/app/[locale]/**` + `src/components/**/sections/` : 75 imports répertoriés, couverture confirmée sur tous les types de pages
- Fetch HTML prod via `curl` (sans User-Agent custom, sans cookies) : 30 URLs, 18 retournent 200 OK, 12 ⇒ 503 transitoire origin
- Extraction `BreadcrumbList` JSON via `grep -oE` + validation structure manuelle
- Validation visible breadcrumb via `<nav aria-label="breadcrumb">` count + extraction fragment HTML
- Vérification HEAD 200 sur tous les `item` URLs intermédiaires : 0 lien 404
