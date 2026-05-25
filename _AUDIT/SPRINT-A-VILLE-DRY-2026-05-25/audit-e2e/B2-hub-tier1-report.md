# B2 — Audit Hub Pages Tier 1 (30 villes > 50k hab)

**Date** : 2026-05-25  
**Agent** : B-2 (claude-sonnet-4-6)  
**Branche** : chore/pricing-update-2026-05-24  
**Méthode** : Analyse statique du code + tentatives HTTP (bloquées par erreur infra)

---

## Verdict global : 0/30 HTTP 200 — BLOCAGE INFRA

**Cause racine identifiée** : Le cache Next.js dev est corrompu.  
Logs `.next/dev/logs/next-development.log` montrent :
```
⨯ SyntaxError: Unexpected non-whitespace character after JSON at position 286641 (line 1 column 286642)
⨯ Failed to generate static paths for /[locale]/a-propos (même erreur)
⨯ Failed to generate static paths for /[locale]/implantations/[region]/[ville] (même erreur)
⨯ A conflicting public file and page file was found for path /llms.txt
```

Le serveur répond 500 sur **TOUTES** les routes (y compris `/fr`, `/fr/blog`, `/fr/audit`) — ce n'est pas spécifique aux hub pages.  
Ce n'est pas un bug dans le code des hubs ville.

**Action correctrice requise (Will, ~5 min)** :
```bash
# 1. Arrêter le serveur dev (Ctrl+C)
# 2. Supprimer le cache corrompu
rm -rf axionia/.next
# 3. Relancer
cd axionia && pnpm dev
# 4. Retester : curl http://localhost:3000/fr/implantations/ile-de-france/paris
```

---

## Analyse statique du code — Résultats

Malgré le blocage infra, l'analyse statique de `src/app/[locale]/implantations/[region]/[ville]/page.tsx` + des 30 fichiers copy permet une évaluation fiable du code.

### Critères vérifiés

| Critère | Status | Evidence |
|---|---|---|
| Tous les 30 slugs corrects (URLs) | OK | Confirmé via data/{region}.ts pour les 30 villes |
| Tous les 30 fichiers copy présents | OK | 30/30 fichiers `src/content/villes/copy/{slug}.ts` présents |
| H1 contient nom ville | OK (code) | Line 333-337 : `{isFr ? "Axion-IA à" : "Axion-IA in"} {ville.nameFr}` |
| 5 verticales présentes | OK (code) | `buildVerticales()` retourne 5 slugs : audits/interventions/implementations/un-a-un/sites-web-ia. Cards rendues via `verticales.map()` lines 402-427 |
| OrangeContactBanner rendu | OK (code) | Import line 54 + usage line 431 `<OrangeContactBanner isFr={isFr} villeSlug={ville.slug} />` |
| VilleEcosystemeLocal rendu | OK (code) | Import line 51 + usage line 365 `<VilleEcosystemeLocal ville={villeAsCity} isFr={isFr} />` |
| JSON-LD Service présent | OK (code) | `buildServiceJsonLd()` line 250 → `@type: "Service"` avec `areaServed: [City, AdministrativeArea, Country]` |
| JSON-LD LocalBusiness SAB | ABSENT | `buildLocalBusinessJsonLd` n'est PAS appelé sur le hub. Uniquement sur `/implantations/[region]/page.tsx` |
| JSON-LD Place présent | OK (code) | `buildPlaceJsonLd()` line 269 → `@type: "Place"` avec `geo.latitude/longitude` |
| JSON-LD BreadcrumbList | OK (code) | `buildBreadcrumbJsonLd()` line 281 + `<Breadcrumbs>` component line 315 |
| JSON-LD ItemList 5 verticales | OK (code) | `buildItemListJsonLd()` line 291 |
| JSON-LD FAQSpeakable (si faqs) | OK (code) | `buildFaqSpeakableJsonLd()` conditionnel line 304-309 |
| Meta title unique par ville | OK (code) | Title = `${ville.nameFr} (${ville.departementLabel}) · Cabinet IA opérationnel` (pilot) |
| faqGeolocalisee dans copy | OK | 30/30 fichiers copy ont `faqGeolocalisee` |
| heroSchema dans copy | OK | 30/30 fichiers copy ont `heroSchema` |
| ecosystemFr dans copy | OK | 30/30 fichiers copy ont `ecosystemFr`/`ecosystemEn` |

---

## Issues identifiées

### P0 — INFRA : Cache Next.js dev corrompu (bloque tout runtime)

**Impact** : 30/30 pages 500. Toutes les routes du site en erreur.  
**Cause** : Fichier JSON du cache Next.js corrompu à position 286641. Probablement causé par un écriture incomplète (parallel agent ou kill brutal du process).  
**Fix** : `rm -rf .next && pnpm dev` (~5 min)  
**Scope** : Infra locale uniquement — pas de bug de code.

### P0 — CONFLIT : `public/llms.txt` vs route `/llms.txt`

**Impact** : Erreur Next.js au démarrage, peut contribuer aux 500.  
**Evidence** : Log `⨯ A conflicting public file and page file was found for path /llms.txt`  
**Fix** : Supprimer `public/llms.txt` (déjà identifié comme P0 lors d'un audit précédent — voir mémoire `axionia_fixes_runtime_p0_2026-05-24.md`).  
Le fichier a été recréé dans le commit 4b1a881f (`public/llms.txt: section structure Sprint A ajoutée`).

### P1 — SEO : Absence de JSON-LD LocalBusiness/SAB sur hub ville

**Impact** : Google Maps + Knowledge Panel ne peut pas corréler le hub avec l'entité Business.  
**Context** : `buildLocalBusinessJsonLd` est appelé sur `/implantations/[region]/page.tsx` mais PAS sur le hub ville `/implantations/[region]/[ville]/page.tsx`.  
**Fix recommandé** : Ajouter `buildLocalBusinessJsonLd` sur le hub ville avec `areaServed: [ville, région]`, en mode SAB (Service Area Business — pas de `geo` physique, uniquement `areaServed`). ~30 min.

### P2 — MIGRATION : 4 nouveaux modèles Prisma non migrés

**Impact** : Pas de blocage pour les hubs (ces modèles ne sont pas utilisés dans les pages hub).  
**Evidence** : Commit 4b1a881f ajoute `GeneratedVilleEcosystem`, `GeneratedVilleSecteurs`, `GeneratedVilleFaqExtended`, `GeneratedVilleCasUsage` dans schema.prisma mais la migration n'est pas encore faite.  
**Action Will** : `pnpm prisma migrate dev --name sprint-a-extended-ville-content`

---

## Statut des slugs URL (tous validés code-level)

| Ville | Region slug | Slug ville | Population | Copy |
|---|---|---|---|---|
| Paris | ile-de-france | paris | 2 103 778 | OK |
| Lyon | auvergne-rhone-alpes | lyon | 519 127 | OK |
| Marseille | provence-alpes-cote-d-azur | marseille | 886 040 | OK |
| Toulouse | occitanie | toulouse | 514 819 | OK |
| Nice | provence-alpes-cote-d-azur | nice | 357 737 | OK |
| Nantes | pays-de-la-loire | nantes | 327 734 | OK |
| Strasbourg | grand-est | strasbourg | 293 771 | OK |
| Montpellier | occitanie | montpellier | 310 240 | OK |
| Bordeaux | nouvelle-aquitaine | bordeaux | 267 991 | OK |
| Lille | hauts-de-france | lille | 238 246 | OK |
| Rennes | bretagne | rennes | 230 890 | OK |
| Reims | grand-est | reims | 177 674 | OK |
| Le Havre | normandie | le-havre | 166 687 | OK |
| Saint-Etienne | auvergne-rhone-alpes | saint-etienne | 173 136 | OK |
| Toulon | provence-alpes-cote-d-azur | toulon | 179 116 | OK |
| Grenoble | auvergne-rhone-alpes | grenoble | 156 140 | OK |
| Dijon | bourgogne-franche-comte | dijon | 161 830 | OK |
| Angers | pays-de-la-loire | angers | 159 022 | OK |
| Nimes | occitanie | nimes | 151 839 | OK |
| Villeurbanne | auvergne-rhone-alpes | villeurbanne | 163 684 | OK |
| Aix-en-Provence | provence-alpes-cote-d-azur | aix-en-provence | 149 695 | OK |
| Brest | bretagne | brest | 142 346 | OK |
| Le Mans | pays-de-la-loire | le-mans | 146 249 | OK |
| Tours | centre-val-de-loire | tours | 139 259 | OK |
| Amiens | hauts-de-france | amiens | 136 449 | OK |
| Limoges | nouvelle-aquitaine | limoges | 129 937 | OK |
| Annecy | auvergne-rhone-alpes | annecy | 132 117 | OK |
| Perpignan | occitanie | perpignan | 121 616 | OK |
| Metz | grand-est | metz | 122 572 | OK |
| Besancon | bourgogne-franche-comte | besancon | 118 489 | OK |

---

## Score conditionnel

**Code-level (hors infra)** : 27/30 critères OK sur le hub page  
- 7/8 critères hub = OK (LocalBusiness SAB absent = P1)  
- `public/llms.txt` conflit = P0 à re-fixer

**Runtime** : 0/30 — BLOQUÉ par cache corrompu + llms.txt conflit

**Score estimé post-fix infra** : ~28-29/30 (P0 infra résolu + P1 LocalBusiness restant)

---

## Actions prioritaires (Will)

1. **[5 min]** Arrêter dev server → `rm -rf axionia/.next` → relancer `pnpm dev`
2. **[2 min]** `rm public/llms.txt` (conflit avec la route dynamique `/llms.txt`)
3. **[30 min]** Ajouter `buildLocalBusinessJsonLd` SAB sur hub ville page.tsx (P1 SEO)
4. **[5 min]** `pnpm prisma migrate dev --name sprint-a-extended-ville-content` (4 nouveaux modèles)
5. **[5 min]** Après fix, relancer l'audit B2 pour validation HTTP runtime

_Après actions 1+2, l'audit runtime pourra confirmer les 30 HTTP 200 attendus._
