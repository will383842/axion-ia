# Agent 10 — Synthèse cross-cuttings (E2E nav/CTA Axion-IA)

> Audit AUDIT-ONLY STRICT. Pas de write code, pas de patch.
> Période : 2026-05-15. Prod `https://axion-ia.com`. Branche main HEAD.

## TL;DR

**Score Agent 10 : 92 / 160 — 🟡 PARTIAL GO** (60-70 % de couverture cross-cuttings effective).

Les 4 templates pSEO villes sont **solidement câblés** (CTAs OK, anti-doorway HCU respecté). Les zones rouges sont 3 silos déclarés mais non câblés en navigation publique : **/actualites n'a pas de hub**, **/connaissances n'existe pas publiquement** (code KB V4 admin-only), **/galerie n'existe pas mais le footer y pointe**. **/reserver tourne en V0** sur main (V1 sur branche non mergée).

## Scoring /160 détaillé

| Étape                        | Pondération | Score               | Justification                                                                                                                                                                                                                                                                |
| ---------------------------- | ----------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **10.1 pSEO maillage**       | /40         | 33/40               | 4 templates SSG correctement câblés (50 villes sample, 100 % avec ≥2 CTAs conversion). Anti-doorway HCU strict (cap 6-8 nearbyVilles). Stubs noindex propres. **-7** : stubs pas de cross-services ni nearbyVilles → maillage 0 pour 98 % des villes.                        |
| **10.2 Content-Gen factory** | /30         | 14/30               | Article slug template OK (CTA bas + JSON-LD + tombstone + slug history). **-16** : hub `/actualites` MANQUANT (P0), 0 référence dans Header/Footer, pas de section « Articles similaires », tags pas clickable, dateModified pas affiché.                                    |
| **10.3 KB V4 connaissances** | /30         | 5/30                | KB V4 admin-only — pas de fuite DRAFT (✅ critique). **-25** : aucune route publique `/connaissances` → 0 valeur SEO/AEO/visiteur. Décision Will requise (différée intentionnelle ou régression ?).                                                                          |
| **10.4 Booking /reserver**   | /30         | 18/30               | V0 calendrier social proof fonctionne (488 lignes, 9 formats, magic-link cancel/reschedule OK). **-12** : V1 Stripe + DocuSeal + BullMQ pas mergés depuis `feature/booking-v1`, pas de FAQ booking, pas de lien retour `/interventions`, prod 503 actuel à reconfirmer.      |
| **10.5 Image-bank /galerie** | /15         | 3/15                | **-12** : route publique inexistante MAIS lien `/galerie` cliquable dans Footer → dead link prod. Routing.ts déclare pathnames mais les fichiers `page.tsx` manquent.                                                                                                        |
| **10.6 Admin internal nav**  | /15         | 14/15               | 101 pages confirmées, AdminCommandPalette ⌘K avec 49 items + filtres rapides, signOut présent. **-1** : pas de composant AdminSidebar/Topbar/Breadcrumbs séparé (inliné dans layout), logout pas dans topbar persistante, preview button limité à 2 sections content-gen+KB. |
| **Total**                    | **/160**    | **92/160 = 57.5 %** | 🟡 PARTIAL — 4 P0 à arbitrer Will avant GO complet.                                                                                                                                                                                                                          |

## Top 5 findings (par criticité)

### 🚨 P0-1 — Hub `/actualites` manquant + 0 référence Header/Footer

**Symptôme** : Le pipeline content-gen factory publie articles dans `/fr/actualites/<slug>`, mais aucun hub liste, aucun lien dans Header/Footer. Les articles sont des silos orphelins SEO accessibles uniquement via Google + IndexNow + sitemap.
**Impact** : pipeline content-gen V1.0.3 (tag pushé) tourne mais ROI navigation humaine = 0.
**Fix** : créer `src/app/[locale]/actualites/page.tsx` (hub paginé tier-1) + ajouter `/actualites` dans `Footer.tsx` resources column ET Header mega-menu. ~3-4h.

### 🚨 P0-2 — Dead link `/galerie` dans Footer (image-bank non déployé)

**Symptôme** : `Footer.tsx:43-45` rend un `<Link href="/galerie">Banque d'images</Link>` mais aucune route `src/app/[locale]/galerie/` n'existe. Tous les visiteurs cliquant → 404.
**Impact** : trust signal négatif, mauvais UX.
**Fix rapide** (5 min) : retirer les 3 lignes du Footer jusqu'au déploiement réel.
**Fix complet** : implémenter le skill axionia-image-bank v1.1 (9 tables Prisma + variants Sharp + sitemap-images + IndexNow).

### 🚨 P0-3 — KB V4 publique inexistante (mémoire vs code)

**Symptôme** : la mémoire `axionia_session_2026-05-14_sprint_s0bis` mentionne « KB V4 totalement codée ». Code-side, KB V4 est complet **côté admin** (4 pages, server actions, types, statuses) mais **aucune route publique** `/connaissances`.
**Impact** : ✅ pas de fuite DRAFT (gate critique passé), mais valeur SEO/AEO = 0.
**Fix** : décision Will. Soit publier `/connaissances` lecture-seule des `KnowledgeEntry` `status=published`, soit actualiser mémoire pour préciser que KB reste interne.

### 🚨 P0-4 — `/reserver` V1 incomplet sur main (Stripe + DocuSeal + BullMQ + admin manquants)

**Symptôme** : `feature/booking-v1` HEAD `3d839d0` non mergée. Main = V0 calendrier social proof + magic-link self-service. Aucun parcours Stripe/paiement opérationnel côté front public.
**Impact** : revenu funnel direct conversion calendrier → paiement IMPOSSIBLE actuellement. À chaque visiteur réservant, c'est encore le flux humain « call de cadrage + acompte 50 % manuel ».
**Fix** : décision Will sur Option A (merger full V1 après finition X.3 DocuSeal + X.12 BullMQ + admin X.8-X.11) ou Option B (cherry-pick Stripe + state-machine + cadrage minimal).
**Action complémentaire** : valider que `/fr/reserver` reprend HTTP 200 sur prod (503 actuel = origin throttled).

### ⚠️ P1-5 — Stubs villes (2156/2157) sans maillage cross-services ni nearbyVilles

**Symptôme** : 98 % des pages villes sont des `VilleStub` minimal (2 CTAs : back-region + /reserver?ville=<slug>). Pas de nearbyVilles, pas de cross-services. Anti-doorway respecté (noindex robots) MAIS valeur maillage interne = 0.
**Impact** : Google ne suivra pas (noindex follow), mais un visiteur qui atterrit dessus via lien externe n'a aucun rebond contextuel.
**Fix** : enrichir progressivement copy/<slug>.ts (industrialisation pSEO décidée 2026-05-08 mais DIFFÉRÉE par Will pour perfectionner templates d'abord). Pas urgent côté SEO mais P1 UX.

## Findings P1+P2 secondaires

- P1 — `/actualites/<slug>` : pas de section « Articles similaires », pas de cross-link inter-articles, tags non clickables.
- P1 — `/reserver` : pas de FAQ booking, pas de lien retour `/interventions`.
- P1 — Admin sidebar : extraire `AdminSidebar.tsx` / `AdminTopbar.tsx` / `AdminBreadcrumbs.tsx` séparés. Logout dans topbar persistant. Preview button généralisé.
- P2 — `/actualites` : catégorie/tag clickable (suppose hub paginé existant).
- P2 — pSEO stubs : exposer 3-5 nearbyVilles même en mode stub pour offrir rebond humain (sans changer noindex).
- P2 — AdminCommandPalette ⌘P / ⌘L raccourcis preview / logout.

## Gates ROUGE rencontrés

| Gate                               | Status                                                                      |
| ---------------------------------- | --------------------------------------------------------------------------- |
| pSEO ville sans CTA conversion     | ✅ Aucun — 100 % des 50 villes ont ≥2 CTAs                                  |
| Article factory sans CTA bas       | ✅ CtaBlock `/interventions/essentielle` présent                            |
| KB article DRAFT exposé public     | ✅ **Aucune fuite — pas de route publique du tout**                         |
| `/reserver` CTAs cassés            | 🟡 V0 partiel sur main + 503 prod actuel — pas full cassé mais V1 pas mergé |
| Image-bank déployé mais nav cassée | 🚨 **ROUGE INVERSE** — pas déployé mais lien Footer actif → dead link       |
| pSEO ville > 10 voisines liées     | ✅ Cap=6 (template par-ville) et cap=8 (page mère) — anti-doorway HCU OK    |

## Note méthodologique

- **Tests prod live ont rencontré HTTP 503 répétés** sur routes dynamiques (origin Coolify throttled au moment de l'audit) → résultat audit code-first, à reconfirmer en fenêtre prod stable.
- **Pas de sample 50 villes fetchées HTTP** car 503 systématique. Verdict CTAs/cap-voisines repose sur l'analyse code partagée (templates SSG = même rendu pour 100 % des villes).
- **Échantillon 5 articles + 5 KB non auditables** car hubs publics inexistants (`/actualites` + `/connaissances`).
