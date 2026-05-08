# 12 — pSEO INDUSTRIALIZATION QUALITY 2026

> Audit qualité contenu après industrialisation 2 150 villes (et au-delà). Anti-doorway HCU à grande échelle.

## Audit en 5 chapitres × 10 critères = 50 points

### 1. Contenu unique par ville

1.1 Chaque ville pilote a copy éditorial unique (pas template-replace)
1.2 Min 800 mots par page indexable
1.3 Données INSEE locales (population, code postal, dépt, géo)
1.4 Demographics enrichies (% PME, secteurs économiques)
1.5 Ecosystem B2B local (clusters, incubateurs, écoles si pertinent)
1.6 FAQ géolocalisée (≥ 3 questions « pourquoi à [ville] »)
1.7 Cas concrets locaux ou régionaux (quand dispos)
1.8 Témoignages locaux (quand dispos)
1.9 Photos / illustrations contextualisées (ou hero-schema géo-thématique)
1.10 Métadonnées title/description uniques

### 2. Anti-doorway HCU compliance

2.1 Villes sans copy éditorial = `noindex` (gating actif)
2.2 Pages auto-générées sans valeur ajoutée = `noindex`
2.3 Pas de near-duplicate content (Jaccard < 0.7 entre villes)
2.4 Pas de keyword stuffing local (« cabinet IA Paris ... cabinet IA Paris ... »)
2.5 Aucune section copiée à l'identique entre villes (variation auto)
2.6 Pas de placeholder content shippé
2.7 lastmod accurate (pas tous lastmod = build time)
2.8 Author / signataire si pertinent
2.9 Date publication + date modification visibles
2.10 Sample manuel 5 villes random : vraie qualité humaine ?

### 3. Schema.org per ville

3.1 LocalBusiness schema valide
3.2 areaServed correct (city + postalCode)
3.3 Geo coordinates accurate (INSEE source)
3.4 Address postale (siège Axion-IA + areaServed)
3.5 Place schema pour entité ville
3.6 PostalAddress correct
3.7 PriceRange si pertinent
3.8 OpeningHours (par défaut 9-18 ou autre)
3.9 PaymentAccepted
3.10 sameAs (LinkedIn, GitHub, etc.)

### 4. Internal linking par ville

4.1 Lien vers région parent
4.2 Lien vers villes proches (3-6 villes département)
4.3 Lien vers services Axion-IA (audit/intervention/implementation)
4.4 Breadcrumbs corrects
4.5 Lien vers cas concrets régionaux
4.6 Lien vers blog articles régionaux (si Sprint 14.6+)
4.7 Mega menu mention possible (si dans Top 30 villes)
4.8 Sitemap categorisée incluse
4.9 Footer site map (si applicable)
4.10 Anchor text varié

### 5. Indexation & monitoring per ville

5.1 Sitemap split correctement (`sitemap-villes.xml`)
5.2 IndexNow ping sur publish ville
5.3 Search Console URL Inspection sample (~30 villes/jour quota 600)
5.4 Indexation rate per region trackée
5.5 Time-to-index per ville mesuré
5.6 Lost villes (indexée puis désindexée) tracking
5.7 Per-ville traffic Search Console (impressions, clicks, CTR, position)
5.8 Anomaly : ville indexée 0 visite à J+90 = audit qualité
5.9 Top performing villes identifiées (cas d'étude)
5.10 Worst performing villes identifiées (refonte ou depublish)

## Méthode

- Phase A : Sample 30 villes random + 10 villes pilotes
- Phase A bis : Crawler quality score per page
- Phase B : Diagnostic /50 + projection à 2 150 villes industrialisées
- Phase C : Plan
- Phase D : STOP & ASK
- Phase E : Application

## STOP & ASK

1. Avant industrialisation massive (validation Will sur sample)
2. Avant changement template ville
3. Avant depublish massif (impact SEO)
4. Avant tout commit

## Anti-patterns à éviter (Pitfalls)

- ❌ Template-replace pur (« cabinet IA à [VILLE] » × 2 150 fois) = doorway HCU garanti
- ❌ Industrialiser sans Paris pilote validé d'abord (déjà retenu memory)
- ❌ Publier toutes villes en `index` d'un coup (Google met du temps à indexer + risque pénalité si qualité faible)
- ❌ Ignorer Search Console alerts indexation (signal majeur)
- ❌ Photos stock identiques par ville (signal IA générique)
- ❌ FAQ identiques copiées-collées (anti-uniqueness)
- ❌ lastmod hardcodé build time (Google détecte l'arnaque fraîcheur)
- ❌ Density keyword > 3 % (« cabinet IA Paris ... cabinet IA Paris ... » = stuffing)
- ❌ Absence cas concrets locaux ou régionaux (signal E-E-A-T faible)

## Cible

> 100 % villes indexables ont contenu unique, 0 doorway HCU, anti-duplicate gate actif, indexation rate ≥ 80 % à J+30.

## Livrables

```
audit-12-pseo-quality-SYNTHESE.md
audit-12-pseo-quality-SAMPLE.md  (30 villes auditées)
audit-12-pseo-quality-PLAN.md
audit-12-pseo-quality-ANTI-HCU.md  (gate template)
```
