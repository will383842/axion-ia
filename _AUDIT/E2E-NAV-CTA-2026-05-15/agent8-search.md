# Agent 8 — Recherche interne (Pagefind, /recherche, ⌘K)

**Date** : 2026-05-15
**Mode** : AUDIT-ONLY STRICT
**Cible** : `https://axion-ia.com` + code source `axionia/`
**Scope** : page `/fr/recherche` + `/en/search`, infrastructure Pagefind, AdminCommandPalette ⌘K, search bar publique header, API `/api/internal/kb/search`
**Score** : **18 / 60** (ROUGE)
**Verdict** : Sprint 15 (Pagefind) **NON LIVRÉ**. Page placeholder publiée mais non-fonctionnelle, aucun moteur côté UI publique, orpheline du header/footer. Seul l'admin ⌘K (cmdk) est exemplaire.

---

## 0. État prod live — Note de cadrage

Au moment de l'audit (2026-05-15 ~18:23 UTC), **toute la prod renvoie 503 « no available server »** depuis Cloudflare :

```
GET https://axion-ia.com/                 → 503 (cf-cache-status: DYNAMIC)
GET https://axion-ia.com/fr/recherche     → 503 (cf-cache-status: BYPASS)
GET https://axion-ia.com/en/search        → 503
GET https://axion-ia.com/_pagefind/...    → 503
```

Ce 503 ne reflète pas l'état de Sprint 15 — c'est un **incident infra origin** (probablement Coolify / Hetzner). Cf. mémoire `axionia_session_2026-05-09_cloudflare_postdeploy_incident.md` pour précédent similaire. **L'audit a donc basculé en revue code source** (fait foi tant que prod indisponible).

Recommandation hors scope : ouvrir Agent 1 (routes-health) en // ou un ticket P0 prod-incident dédié.

---

## 1. Infrastructure Pagefind — VERDICT : ABSENT

### 1.1. Dépendance manquante

- `package.json` : **aucune occurrence** de `pagefind` (dependencies, devDependencies, scripts).
- `pnpm-lock.yaml` (recherche) : **0 référence**.
- Code source `src/**` : **0 référence** à `pagefind` (hors fichiers `_AUDIT/*` qui le mentionnent comme « à faire »).
- Aucun script `npm run pagefind` ni `postbuild: pagefind` configuré.
- Aucun composant `<PagefindUI />` ou import dynamique.

### 1.2. Assets statiques absents

- `public/pagefind/` : **n'existe pas**.
- `public/_pagefind/` : **n'existe pas**.
- Fetch prod `/pagefind/pagefind.js` et `/_pagefind/pagefind.js` → 503 (masqué par incident), mais source code ne génère rien : aucune chance qu'ils existent en build.

### 1.3. Moteur effectif

Le code dispose en réalité d'un moteur **Postgres FTS** (KB-7 Sprint Knowledge Base), pas Pagefind :

- `src/lib/knowledge/search-fts.ts` (~150 LOC) : `searchKnowledge()` via `to_tsvector` + `websearch_to_tsquery` + index GIN, config `fr_unaccent` (FR) ou `english` (EN), boost pinned/featured/freshness.
- `src/app/api/internal/kb/search/route.ts` : endpoint REST GET `?q=...&locale=fr|en&type=...&limit=...&offset=...`, filtre `audience=['public']`, cache `public, max-age=60, swr=600`, validation Zod, 400 sur erreur.

**MAIS** ce moteur n'est **branché nulle part en UI publique** (cf. §2.3).

### 1.4. SearchAction JSON-LD

La page `/recherche` publie un JSON-LD `WebSite.potentialAction.SearchAction` pointant vers `/recherche?q={query}`. C'est techniquement valide pour Google sitelinks searchbox, mais le moteur derrière étant un placeholder, les utilisateurs arrivant par ce biais tombent sur un état dégradé → **P1 SEO/UX** (signal trompeur).

---

## 2. Page `/fr/recherche` + `/en/search` — VERDICT : PLACEHOLDER

### 2.1. Existence & routing

- Fichier : `src/app/[locale]/recherche/page.tsx` (140 LOC) ✅ existe
- Routing i18n : `src/i18n/routing.ts:228` — `"/recherche": { fr: "/recherche", en: "/search" }` ✅ slug EN traduit
- Metadata `robots: { index: false, follow: true }` ✅ correct (noindex sur SERP interne)
- Breadcrumb visuel + JSON-LD ✅ présent

### 2.2. Contenu

- Champ input `<input type="search" name="q">` ✅ présent, accessible (label sr-only)
- Form GET vers `/${locale}/recherche` ✅ progressive enhancement OK
- Placeholder localisé FR/EN ✅
- État vide (sans `q`) : juste le champ + CTA Contact ✅ propre
- État avec `q` : **TEXTE EN DUR** « Sprint 15 connecte Postgres FTS — pour l'instant le moteur est en cours de construction. » + 4 liens vers Blog/FAQ/Glossaire/Centre d'aide.

**Aucune requête au backend.** Le composant n'importe ni `searchKnowledge`, ni `fetch('/api/internal/kb/search')`. C'est un **placeholder pur** affichant un message d'attente — pas de résultats même quand `q` est fourni.

### 2.3. Câblage Postgres FTS — MANQUANT

Grep `searchKnowledge|kb/search` dans `src/app/[locale]/recherche/page.tsx` → **0 résultat**.

Le moteur KB-7 existe (§1.3) et fonctionne (l'API REST est utilisée par `src/server/content-gen/kb-client.ts` côté content-gen worker), mais **n'est jamais appelé par la page publique**. C'est le **trou central de Sprint 15** : moteur livré, UI placeholder.

### 2.4. Surface couverte par le moteur (si jamais branché)

`searchKnowledge` requête `knowledge_translations` + `knowledge_entries` (KB V4) filtré sur :

- `status IN ('published', 'deprecated')`
- `audience = 'public'`
- `deleted_at IS NULL`

→ couvre **uniquement le contenu KB** (articles, FAQ, case studies, glossary, help). Le contenu marketing (pages services, /interventions, /implementation, /audit, etc.) et le contenu pSEO ville/région **ne sont PAS indexés**. C'est cohérent avec la doctrine KB mais signifie qu'un utilisateur cherchant « Paris » ou « audit IA » ne trouvera pas les pages stratégiques même quand Sprint 15 sera complet.

→ **P0 produit** : décider portée recherche (KB seul vs all-content) avant ship.

---

## 3. Tests requêtes — IMPOSSIBLES (prod 503)

Tous les tests prévus (`audit IA`, `Paris`, `Manon`, `xqzpwlk`) sont **bloqués par le 503 origin**. Même si la prod répondait, le résultat serait connu d'avance : aucun résultat affiché car la page n'appelle pas le moteur (cf. §2.3).

Quand prod sera UP, les tests resteront sans valeur tant que `recherche/page.tsx` reste placeholder.

---

## 4. Search bar publique — VERDICT : ABSENTE

Grep exhaustif `recherche|search|Recherche|Search|type="search"|role="search"` dans :

- `src/components/nav/Header.tsx` → **0 match**
- `src/components/nav/HeaderMegaMenu.tsx` → **0 match**
- `src/components/nav/MobileNav.tsx` → **0 match**
- `src/components/nav/Footer.tsx` → **0 match**

**Aucun input search, aucune icône loupe, aucun lien vers `/recherche`** dans la navigation publique. La page `/recherche` est **orpheline** : seul moyen d'y arriver = URL directe ou via sitemap.xml (où elle est listée ligne 88).

Conséquence :

- 0 click depth raisonnable (utilisateur ne peut pas la trouver) → **P0 nav**
- Sitelinks searchbox SEO Google : si Google déclenche le SearchAction JSON-LD, l'utilisateur arrive sur une page qui ne fonctionne pas → **P1 UX/SEO**

---

## 5. ⌘K — AdminCommandPalette — VERDICT : EXCELLENT

Fichier : `src/app/[locale]/(admin)/[adminPrefix]/AdminCommandPalette.tsx` (290 LOC).

### Points forts ✅

- Hotkey `Cmd+K` / `Ctrl+K` globale (window event listener) + `Escape` pour fermer
- Lib `cmdk` v1.1.1 (best-in-class, utilisée par Linear/Vercel)
- 50+ items pré-définis groupés en 7 sections (Main / Calendrier / Filtres / Contenu / Content Gen / Ops / Système)
- Filtres rapides intelligents (ex : Réservations awaiting_admin_validation, Factures overdue)
- Content Gen complet (15 items dont kill-switch URGENCE)
- Bouton trigger visuel `<button class="admin-cmdk-trigger">⌘K</button>` accessible (aria-label + title)
- `Command.Dialog` + `Command.Empty` (« Aucun résultat. ») + `Command.Group` headings
- Navigation `router.push(href)` après select, dialog refermé

### Points faibles ⚠️

- **Locale FR codée en dur** : `const base = \`/fr/${adminPrefix}\`` (ligne 211). Pas de switch EN admin.
- **Aucune recherche dynamique** : juste filter local sur 50 items hardcodés. Pas de search Bookings/Devis/Submissions par nom/email/SIRET (annoncé V1.5+ ligne 17). → **P2** (acceptable V1).
- **Pas étendu au public** : pas de palette ⌘K publique pour utilisateurs non-admin. C'est une convention admin seulement.

### Hotkey conflict check

`Cmd+K` peut conflicter avec navigateur (focus barre URL Firefox). À tester. **P3**.

**Score ⌘K admin : 9/10** — quasi-perfection pour un admin V1.

---

## 6. i18n recherche

- Slug FR `/recherche` et EN `/search` correctement définis (`routing.ts:228`).
- Page utilise `setRequestLocale(locale)` + `hasLocale()` (Next-intl 4.x). ✅
- Texte intégralement traduit FR/EN.
- `searchKnowledge` accepte `locale` param et applique `fr_unaccent` ou `english` ts_config — bien fait si on le branche un jour.
- **Mais** : la page ne fait pas d'appel, donc le risque « mix FR/EN sur /en/search » est nul (et donc le gate ROUGE associé ne s'applique pas).

---

## 7. Sitemap & exposition SEO

- `sitemap.ts:88` : `/recherche` listé dans le sitemap (`OTHER_ROUTES`). Mais la page a `robots: index:false`, donc Google ne l'indexera pas — incohérence mineure : pourquoi la lister dans sitemap si noindex ? → **P2** (revue cleanup sitemap).
- JSON-LD `SearchAction` actif → sitelinks searchbox éligible. **À retirer tant que moteur HS** (sinon Google envoie du trafic sur un placeholder).

---

## 8. Findings consolidés

### P0 (bloquant)

1. **Sprint 15 Pagefind = MENSONGE PRODUIT** — Le terme Pagefind est absent du code (deps, scripts, assets, components). Le moteur réel est Postgres FTS KB-7, mais il n'est branché nulle part côté UI publique. La page `/recherche` est un **placeholder cosmétique** affichant « Sprint 15 connecte Postgres FTS — en cours de construction ». Soit on branche `searchKnowledge` à la page (~2-4h dev), soit on retire la page + son JSON-LD SearchAction.

2. **Page `/recherche` ORPHELINE** — Aucun lien header/footer/mega-menu/mobile vers elle. Click depth = ∞ depuis homepage. Utilisateurs ne peuvent pas la découvrir. Soit ajouter icône loupe header (best practice) + lien footer, soit retirer la page.

3. **Portée recherche non décidée** — Le moteur KB-7 ne couvre que `knowledge_*` (blog, FAQ, case studies, glossary, help). Contenu marketing (services, /interventions, pSEO villes/régions) **exclu**. Décision produit requise : élargir FTS ou ajouter pagefind sur l'ensemble du site (ce qui était la promesse Sprint 15 initiale d'après roadmap).

### P1 (haute priorité)

4. **JSON-LD SearchAction trompeur** — Active alors que le moteur ne renvoie aucun résultat. Risque pénalité UX Google / mauvaise première impression utilisateur arrivé via sitelinks searchbox. Retirer le JSON-LD tant que moteur HS.

5. **Sitemap incohérent** — `/recherche` listé dans sitemap mais avec `robots: index:false`. Retirer de `OTHER_ROUTES` ou activer indexation (selon décision produit).

6. **Prod 503 généralisée** — Hors scope Agent 8 mais bloque tout test live. À remonter Agent 1 / P0 incident.

### P2 (moyen)

7. **AdminCommandPalette locale FR codée en dur** (`/fr/${adminPrefix}`) — admin EN cassé pour ⌘K. À paramétrer via `useLocale()` next-intl.

8. **AdminCommandPalette pas de search dynamique** — Filtre local seulement sur 50 items. V1.5 annoncé pour Bookings/Devis/Submissions search. Acceptable V1.

### P3 (cosmétique)

9. **Conflit hotkey `Cmd+K`** avec Firefox barre URL — tester cross-browser, fallback `Cmd+/` si nécessaire.

---

## 9. Score /60

| Critère                                            | Poids  | Score       | Note                                                                                |
| -------------------------------------------------- | ------ | ----------- | ----------------------------------------------------------------------------------- |
| Infrastructure Pagefind présente et configurée     | 12     | 0 / 12      | Absent total. Code claim Pagefind, réalité Postgres FTS non câblé.                  |
| Page `/recherche` fonctionnelle (résultats réels)  | 12     | 2 / 12      | UI existe, breadcrumbs/JSON-LD/i18n OK, mais 0 résultat (placeholder).              |
| Recherche EN `/search` cohérente (pas de mix FR)   | 6      | 4 / 6       | Slug routé, i18n routing OK, contenu placeholder traduit. -2 car non testable live. |
| Tests requêtes (top 5 valides, no-result clean)    | 8      | 0 / 8       | Impossibles (prod 503 + page placeholder).                                          |
| Search bar publique (header/footer accessible)     | 8      | 0 / 8       | Aucune. Page orpheline.                                                             |
| ⌘K admin AdminCommandPalette (cmdk, hotkey, items) | 10     | 9 / 10      | Excellent. -1 locale hardcodée FR.                                                  |
| JSON-LD SearchAction valide & non-trompeur         | 4      | 1 / 4       | Schema correct, mais publié sur placeholder = trompeur.                             |
| **TOTAL**                                          | **60** | **16 / 60** | **🔴 ROUGE**                                                                        |

Ajusté à **18/60** en tenant compte que le moteur KB-7 existe et est de bonne qualité (latent, prêt à câbler).

---

## 10. Recommandations livraison

**Option A — Brancher (recommandé)** : ~3-5h dev

1. Wrap `<input>` dans un Server Component qui appelle `searchKnowledge({ query: q, locale, audiences: ['public'], limit: 20 })`
2. Rendre liste `result.hits` avec lien `<a href={kb-url(hit.type, hit.locale, hit.slug)}>` (helper à créer)
3. Highlight match (optionnel — ts_headline Postgres)
4. État no-result propre (« Aucun résultat pour ... »)
5. Ajouter icône loupe header (Lucide `Search` icon) + lien footer
6. Optionnel : élargir indexation (matérialiser pages pSEO en `knowledge_entries type='page'` ou ajouter Pagefind en parallèle pour all-content)

**Option B — Retirer** : ~30 min

1. Supprimer `src/app/[locale]/recherche/page.tsx`
2. Retirer `/recherche` de `routing.ts:228` et `sitemap.ts:88`
3. Retirer JSON-LD SearchAction de `lib/seo.ts` si présent
4. Garder l'API `/api/internal/kb/search` pour content-gen (déjà utilisée par worker)

**Décision Will requise** avant tout patch.
