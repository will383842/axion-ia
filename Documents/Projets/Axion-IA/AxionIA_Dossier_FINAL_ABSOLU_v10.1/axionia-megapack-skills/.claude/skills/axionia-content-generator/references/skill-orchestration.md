# Skill orchestration — qui fait quoi (v1.0)

> Référence créée 2026-05-14 (Sprint S0bis) pour clarifier quand déléguer aux 9 skills siblings axionia-*. Le content-gen master n'est pas autonome — il consomme/coordonne plusieurs domaines.

## Matrice de délégation

| Tâche content-gen | Skill responsable | Quand le charger |
|---|---|---|
| Migrations Prisma génériques (non content-gen specific) | `axionia-database` | Toute modif `prisma/schema.prisma` hors tables `ContentGen*`, `Coverage*`, `Audience*`, `AuthorProfile`, `BannedPhrase`, `ExternalReference`, `WebVitalSample` |
| Stack Next 16 / BullMQ / Coolify / Hetzner setup | `axionia-stack` | Setup providers, config infra, debug deploy |
| Palette, typo, hero schemas, design system | `axionia-design` | Toute création/modif composant UI public |
| Mot « formation » banni, identité projet, doctrine globale | `axionia-core` | À CHARGER à chaque session avant toute autre tâche |
| Internationalisation FR/EN, hreflang | `axionia-i18n` | next-intl, pathnames, sitemap multilingue |
| Mobile-first absolu, Web Vitals UI patterns | `axionia-mobile-first` | Toute classe Tailwind, layout, viewport test |
| KB CRUD admin, RGPD export, retention, factory ingest API | `axionia-connaissances` | Toute interaction avec `KnowledgeEntry*` au-delà du read+write feeder du content-gen |
| Forms multi-step (audit 5 étapes, intervention) | `axionia-forms` | Formulaires côté users (pas pertinent pour content-gen) |
| SEO/AEO/GEO Schema.org, meta tags | `axionia-seo-aeo` | Pages publiques génériques (le content-gen a sa propre doctrine § 9.7 plus stricte) |

## Frontière content-gen vs siblings — règles de décision

### Quand activer `axionia-content-generator` (ce skill)

✅ Activer si la demande mentionne :
- Pipelines de génération (landing villes, blog, comparison, guide, FAQ, Q/R)
- Cockpit géo France (carte interactive 4 zones, 5 modes coloriage)
- Anti-doublon 4 couches + boucle qualité 40-74
- Manon persona (Person JSON-LD, byline, author card)
- Web Vitals gate pre-publish + RUM aggregator
- Workers `content-gen-*-worker.ts`
- Admin `/[adminPrefix]/content-gen/*`
- Campagnes de couverture territoriale
- Distribution % par type éditable
- Mix audience taille × organisation
- Intention de recherche (5 intents)
- RSS NewsArticle pipeline

### Quand NE PAS activer ce skill

❌ Désactiver et déléguer à :
- **`axionia-connaissances`** : toute logique métier KB hors RAG retrieve + KB feed. Admin `/connaissances/`. Annotations. Ingest API HMAC. RGPD export. DR massif.
- **`axionia-database`** : migrations Prisma sur tables existantes (`Booking`, `Submission`, `Article` legacy). Si vraiment besoin de toucher au schéma hors content-gen → STOP & ASK Will.
- **`axionia-design`** : modif palette, hero schemas, composants UI partagés.
- **`axionia-stack`** : config Next 16, BullMQ, Caddy, Coolify.
- **`axionia-emails`** : templates email post-publish.

## Pipeline cross-skill « content-gen → KB → Public »

```
1. content-gen génère landing-ville         → axionia-content-generator skill
2. content-gen valide quality + web-vitals  → axionia-content-generator skill
3. content-gen écrit dans KnowledgeEntry    → bordure content-gen / KB
4. KB pipeline post-publish (SEO LLM cache) → axionia-connaissances skill
5. Page publique render Next 16             → bordure design / stack
6. RUM Web Vitals collecté                  → axionia-content-generator skill
7. Telegram alerts si dégradation           → axionia-content-generator skill
8. RGPD export user request                 → axionia-connaissances skill
```

## Outils transverses

- **`pii-redaction.ts`** : helper RGPD partagé entre tous les skills, jamais bypassé
- **`adminPath()`** : helper de génération path admin (avec `[adminPrefix]` env)
- **`buildPersonManonJsonLd()`** : helper Person Manon dans `src/lib/seo.ts` (avec garde-fou slug=manon)
- **`alertTelegram()`** : helper notifications partagé (cf. § 12.3bis)
- **`SITE_URL`** : constante prod `https://axion-ia.com` avec fallback `next.config.ts`

## Cas d'usage concrets

### Cas 1 : Will demande « génère 100 landings villes pour Auvergne-Rhône-Alpes »

- ✅ Activer `axionia-content-generator` (campagne couverture territoriale)
- ✅ Charger `axionia-core` (doctrine globale)
- ✅ Charger `axionia-connaissances` (la KB sera alimentée)
- ⚠️ Ne PAS activer `axionia-database` (migrations content-gen suffisantes)
- ⚠️ Ne PAS activer `axionia-forms` (pas de formulaire)

### Cas 2 : Will demande « ajouter un champ `tone` à `KnowledgeEntry` »

- ❌ NE PAS activer `axionia-content-generator` (migration KB hors scope)
- ✅ Activer `axionia-connaissances` (propriétaire du schéma KB)
- ✅ Charger `axionia-database` (migration Prisma)

### Cas 3 : Will demande « pourquoi mes pages /implantations/lyon/paris sont lentes ? »

- ✅ Activer `axionia-content-generator` (Web Vitals + RUM)
- ✅ Charger `axionia-mobile-first` (budgets perf)
- ✅ Charger `axionia-stack` (Next 16 + Caddy + CF cache)

### Cas 4 : Will demande « refondre la palette en charcoal au lieu de terracotta »

- ❌ NE PAS activer `axionia-content-generator` (pas en charge du design system)
- ✅ Activer `axionia-design` (propriétaire palette)
- ⚠️ STOP & ASK Will avant tout patch (contrainte intouchable § 21 master prompt)

## Stratégie de chargement skills par défaut session content-gen

Session Sprint 1 autopilote charge automatiquement :

1. `axionia-core` (doctrine globale obligatoire)
2. `axionia-content-generator` (ce skill, pilote la session)
3. `axionia-connaissances` (KB feeder + bordure)
4. `axionia-database` (à la demande pour migrations content-gen)
5. `axionia-mobile-first` (Web Vitals stricts)
6. `axionia-stack` (Next 16 + BullMQ)

Skills NON chargés par défaut (à la demande uniquement) :
- `axionia-design` (palette stable, intouchable)
- `axionia-forms` (pas de form content-gen côté public)
- `axionia-i18n` (FR-only V1, pas de hreflang à gérer)
- `axionia-emails` (post-publish, sub-feature)
- `axionia-seo-aeo` (doctrine content-gen § 9.7 prime)

## Référence externe

- Master prompt content-gen : `axionia/_AUDIT/PROMPT-CONTENT-GENERATOR-MASTER-2026.md` (v2.4)
- Master prompt KB : `axionia/_AUDIT/PROMPT-KNOWLEDGE-BASE-2026.md` (V4)
- CLAUDE.md projet : `AxionIA_Dossier_FINAL_ABSOLU_v10.1/CLAUDE.md` (v6)
- ADR registry : `axionia/docs/adr/` + `AxionIA_Dossier_FINAL_ABSOLU_v10.1/docs/adr/`
