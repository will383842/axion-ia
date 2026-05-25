# B9 — Audit sécurité pages admin : noindex + auth gate
**Date** : 2026-05-25  
**Scope** : 133 pages admin + 5 routes API admin  
**Méthode** : Analyse statique code source (dev server non accessible depuis WSL)

---

## VERDICT GLOBAL : SECURITE ADMIN OK — Aucun P0

Toutes les pages admin sont protégées par un minimum de 2 couches de sécurité.  
Aucune page ne retourne de données admin en clair sans authentification.

---

## Architecture de protection

### 4 couches de défense en profondeur

| Couche | Fichier | Mécanisme |
|--------|---------|-----------|
| **Layer 1 — Edge Middleware** | `src/proxy.ts` + `src/auth.config.ts` | `authorized()` callback intercepte TOUTES les routes `/fr/<adminPrefix>/*` ; redirige vers `/login` si pas de session JWT valide |
| **Layer 2 — App Layout** | `src/app/[locale]/(admin)/[adminPrefix]/layout.tsx` | Valide le segment URL contre `ADMIN_URL_PREFIX` env (→ 404 silencieux si mismatch) ; force locale FR |
| **Layer 3 — Page** | 127/133 pages ont `auth()` + `redirect()` explicites | Double-check session server-side dans la page elle-même |
| **Layer 4 — Server Actions** | `requireAdminRead()` / `requireAdminWrite()` / `requireAdminWriteRateLimited()` | Gate sur chaque mutation et lecture de données, même si la page est atteinte |

---

## Couverture noindex

**Mécanisme principal** : `layout.tsx` ligne 50-52 :
```typescript
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};
```
Ce metadata est propagé à **tous les 133 enfants** par héritage Next.js 16.  
Traduit en header HTTP `X-Robots-Tag: noindex, nofollow` sur chaque réponse.

**Note importante** : Le `robots.txt` bloque `/fr/admin/` (hard-coded) mais PAS  
`/fr/admin-dev-x7k2n9/*` (prefix dynamique). Le layout.tsx compense délibérément  
cette lacune (commentaire ligne 46-49 confirme la décision de conception).

**Confirmation** : 20 pages de l'image-bank + site-explorer ont aussi un metadata  
`robots:{index:false}` au niveau page (redondance saine).

---

## Résultats par catégorie

### Pages avec auth() explicite en page.tsx (127/133) — PASS ✅
- Dashboard, users, content-gen (toutes les sous-pages sauf stubs), reservations,
  calendrier, settings, analytics, blog, connaissances, devis, factures, faq, help,
  alerts, activity-logs, testimonials, newsletter, infra, paiements, echeanciers,
  web-vitals, login, 2fa/setup, image-bank (toutes sous-pages), site-explorer, etc.

### Pages stubs redirect sans auth() explicite (3/133) — PASS ✅ via Middleware
| Page | Type | Risque |
|------|------|--------|
| `content-gen/coverage/new` | `permanentRedirect()` → `/campaigns/new` | Nul (aucun rendu, aucune donnée) |
| `content-gen/geo/batches/[id]` | `redirect()` → `/content-gen/coverage/[id]` | Nul (aucun rendu, aucune donnée) |
| `content-gen/monitoring` | `redirect()` → `/content-gen/jobs?status=failed` | Nul (aucun rendu, aucune donnée) |

Ces 3 pages : Layer 1 (middleware) suffit. Même sans auth, elles n'affichent rien.

### Pages server-component sans auth() page-level (3/133) — PASS ✅ via Middleware + Action
| Page | Composant | Guard Action |
|------|-----------|-------------|
| `options/page.tsx` | `OptionsV2` | `listOptionsAction` → `requireAdminRead()` throw "unauthorized" |
| `submissions/page.tsx` | `SubmissionsV2` | `listSubmissionsAction` → `requireAdminReadSession()` throw "unauthorized" |
| `content-gen/orchestrator/adhoc` | `AdHocDispatchV2` (client) | `dispatchAdHocJob` → `requireAdminWriteRateLimited()` |

Comportement sans auth : le middleware redirige en Layer 1. Si une requête bypasse le middleware  
(ex. direct API call sans cookie), l'action throw "unauthorized" → error boundary affiche une erreur  
générique (AdminErrorBoundary), aucune donnée admin visible.

**Recommandation P2** : Ajouter `auth()` + `redirect()` en page.tsx pour les 3 pages ci-dessus,  
pour une défense en profondeur complète et une consistance de pattern. Effort : ~15 min.

---

## Routes API admin (/api/admin/*)

Ces routes sont **exclues du middleware** (matcher proxy.ts exclut `/api/*` explicitement).

| Route | Auth directe | Comportement sans auth |
|-------|-------------|----------------------|
| `GET /api/admin/newsletter/export` | Via `exportSubscribersCsvAction` → `requireAdminRead()` | 403 JSON |
| `GET /api/admin/submissions/export` | Via `exportSubmissionsCsvAction` → `requireAdminWriteSession()` | 403 JSON |
| `GET /api/admin/articles/[id]/forget` | Vérifié: auth_calls=1 | 403/401 |
| `GET /api/admin/articles/[id]/provenance` | Vérifié: auth_calls=1 | 403/401 |
| `GET /api/admin/content-gen/articles/[id]/feedback` | Vérifié: auth_calls=1 | 403/401 |
| `GET /api/admin/invoices/[id]/pdf` | Vérifié: auth_calls=2 | 403/401 |

---

## robots.txt — gap résiduel

**Observation** : `robots.txt` bloque `/fr/admin/` mais pas `/fr/admin-dev-x7k2n9/`.  
Si un bot trouve l'URL réelle du prefix (ex. via un lien externe), il peut théoriquement  
tenter de crawler la page login (mais recevra noindex + redirect vers login = pas d'indexation).

**Recommandation P3** (optionnel, faible risque) : Ajouter dans `robots.ts` une règle dynamique  
`/fr/${process.env.ADMIN_URL_PREFIX}/` en disallow pour couvrir le prefix réel. Cela dit,  
le noindex metadata suffit — Google ne peut pas indexer une page avec X-Robots-Tag: noindex.

---

## Synthèse

| Critère | Résultat |
|---------|----------|
| Pages admin accessibles sans auth (200 + données) | **0** |
| Pages admin sans noindex | **0** |
| Pages admin avec données admin en clair sans session | **0** |
| Routes API admin sans guard auth | **0** |
| Fuite de tokens/clés dans les réponses 302/error | **Non détectée** |

**Score sécurité admin** : **100% PASS** — Aucun P0, aucun P1 critique.  
**Recommandations** : 1 item P2 (cohérence pattern auth page-level sur 3 pages), 1 item P3 (robots.txt).
