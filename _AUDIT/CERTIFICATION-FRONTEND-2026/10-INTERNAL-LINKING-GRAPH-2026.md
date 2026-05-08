# 10 — INTERNAL LINKING GRAPH 2026

> Audit graphe liens internes : 0 orphan, click depth ≤ 3, anchor diversity, hub-and-spoke pSEO.

## Audit en 5 chapitres × 10 critères = 50 points

### 1. Graphe & topologie

1.1 0 page orpheline (vérifier sitemap vs internal links)
1.2 Click depth max 3 depuis home pour 95 % des pages indexables
1.3 Click depth max 4 pour 100 % (incluant villes les plus profondes)
1.4 Hub-and-spoke clair (`/implantations` → 13 régions → 2 157 villes)
1.5 Pillar content (services audit/intervention/implementation) ⇄ cluster pages
1.6 Cross-linking inter-services (audit ↔ intervention ↔ implementation)
1.7 Service ↔ ville/région (L2-L4 SEO local)
1.8 Glossary linking (concepts techniques → pages dédiées)
1.9 Blog → service linking systématique
1.10 Cas-concrets → service + ville linking

### 2. Anchor text

2.1 Anchor descriptif (jamais « cliquez ici », « en savoir plus »)
2.2 Anchor diversity (pas 100× le même texte vers une même page)
2.3 Anchor ratio : exact match < 30 % d'une cible
2.4 Anchor naturel (lecture humaine)
2.5 Anchor i18n (FR/EN cohérent)
2.6 Anchor avec contexte sémantique (mot-clé + verbe + entité)
2.7 Pas d'anchor générique (`Plus d'infos`)
2.8 Image alt comme anchor si lien sur image
2.9 ARIA-label si anchor non-explicite
2.10 Anchor test : extract + analyse répartition

### 3. Liens cassés & redirects

3.1 0 lien interne 404
3.2 0 redirect chain (max 1 hop)
3.3 0 mixed-content (http vers https interne)
3.4 0 lien vers page noindex (signal contradictoire)
3.5 Redirects 301 propres (pas 302 sauf temporaire)
3.6 410 Gone pour pages supprimées (pas 404)
3.7 Slugs FR/EN différents si naming local (`/audit` ≠ `/en/audit-en` cohérent)
3.8 Trailing slash cohérent (toujours ou jamais — `next.config` setting)
3.9 Lowercase URLs (jamais mixed case)
3.10 Lien checker CI (`broken-link-checker` ou custom)

### 4. Maillage thématique

4.1 Topical clusters identifiés (audit / intervention / implementation / glossaire)
4.2 Hub page par cluster
4.3 Spokes vers hub + cross-spokes
4.4 Related content sections en bas de page
4.5 Footer site map structuré
4.6 Mega menu hierarchical (déjà ✅)
4.7 Breadcrumbs partout (déjà ✅)
4.8 Pagination canonicalisée si applicable
4.9 Tags / catégories blog (Sprint 14.6) cohérent
4.10 Knowledge graph entities reliées (Person → Organization → Place)

### 5. Internal link automation à scale

5.1 Helper auto-link (mention `Paris` → link `/implantations/.../paris` si page existe)
5.2 Configurable (whitelist/blacklist)
5.3 Évite over-linking (max N occurrences même URL par page)
5.4 nofollow sur liens user-generated (formulaire, comments si jamais)
5.5 Sitemap interne footer pour grosses sections (villes/régions)
5.6 Related cities widget par template ville
5.7 Related services widget par template service
5.8 Recently published widget (blog Sprint 14.6+)
5.9 Anchor diversity auto-rotation (pas le même anchor à chaque mention)
5.10 Audit auto periodic (mensuel) du graphe

## Méthode

- Phase A : Crawler interne (Cypress, Playwright ou OSS comme `linkinator`)
- Phase A bis : Build internal link graph (matrice from→to)
- Phase B : Diagnostic /50 (orphans + click depth + anchor analysis)
- Phase C : Plan correctifs
- Phase D : STOP & ASK
- Phase E : Application

## STOP & ASK

1. Avant changement structure URL (impact SEO massif)
2. Avant ajout outil crawl (deps)
3. Avant tout commit

## Anti-patterns à éviter (Pitfalls)

- ❌ Over-linking (15× lien vers même URL sur même page = pénalité Google)
- ❌ Anchor exact-match répété (ratio max 30 % sur cible)
- ❌ « Cliquez ici », « En savoir plus » comme anchor (anti-A11y + SEO)
- ❌ Liens vers pages noindex (signal contradictoire à Google)
- ❌ Redirect chains internes (ralentit + dilue PageRank)
- ❌ Pages orphelines découvertes 6 mois après (audit régulier obligatoire)
- ❌ Auto-link sans whitelist (risque liens vers pages disparues)
- ❌ Ignorer les liens depuis sitemap interne (footer site map dilue)

## Cible

> 0 orphan, click depth ≤ 3 sur 95 %+ pages, anchor diversity OK, 0 lien cassé, helper auto-link déployé pour scale.

## Livrables

```
audit-10-linking-SYNTHESE.md
audit-10-linking-DIAGNOSTIC.md
audit-10-linking-GRAPH.md  (matrice + ASCII visualization)
audit-10-linking-ORPHANS.md  (liste pages orphelines)
audit-10-linking-PLAN.md
```
