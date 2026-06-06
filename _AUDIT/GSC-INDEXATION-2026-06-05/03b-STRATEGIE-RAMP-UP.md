# 03b — STRATÉGIE RAMP-UP (Phases 3-BIS + 3-TER) — 2026-06-05

> **L'objectif de Will** : « Ne pas donner trop de pages à Google d'un coup, MAIS être un peu agressif pour aller vite sur la visibilité — tout en publiant 100+ URLs/jour, en accélération. »
> Ces objectifs ne sont contradictoires qu'en apparence : sur un domaine neuf à faible autorité, **la vitesse vient de la concentration, pas du volume**. Montrer MOINS → indexer PLUS VITE → élargir au rythme **prouvé** par l'indexation réelle.
> Deux volets : **A — Stock (ramp-up de l'existant)** · **B — Flux (régime permanent 100+/jour)**.

---

# VOLET A — STOCK : ramp-up par cohortes (Phase 3-BIS)

## A.0 — Principe chiffré

- **Débit de crawl observé** (Phase 3-TER §B.1) ≈ **1-2 pages indexées/jour**.
- **Donc** : exposer 47 pages bien maillées et les faire indexer est réaliste ; exposer 6 000 dilue tout. **On expose par cohortes, on débloque la suivante quand la précédente est ≥70-80 % indexée.**

## A.1 — Tier 0 — Noyau premium (~120 URLs) à pousser AGRESSIVEMENT maintenant

**Critère d'admission objectif** (les 4 doivent être vrais) :
1. Contenu **unique & substantiel** (≥ ~600 mots utiles, pas de template ville).
2. **Intention commerciale ou pilier d'autorité** (service, hub, page de conversion, cornerstone éditorial).
3. **Profondeur ≤ 2 clics** depuis l'accueil (ou le devenir via P0-4).
4. **Livrable/CTA réel** (formulaire, prix, contact) OU forte valeur informationnelle.

**Composition nominative (~120 URLs)** :

| Bloc | URLs (FR) | n |
|---|---|---:|
| Accueil + conversion | `/fr`, `/fr/contact`, `/fr/appel`, `/fr/tarifs`, `/fr/roi` | 5 |
| Hubs services | `/fr/audit`, `/fr/audit-ia`, `/fr/interventions/essentielle`, `/fr/interventions/collectives`, `/fr/implementation`, `/fr/un-a-un`, `/fr/sites-web-augmentes`, `/fr/formations-ia`, `/fr/solutions-ia`, `/fr/codage-developpement` | 10 |
| Autorité / méthode | `/fr/methodologie`, `/fr/a-propos`, `/fr/guide-ia`, `/fr/stack-ia`, `/fr/presse`, `/fr/demande-devis` | 6 |
| Hubs contenu | `/fr/blog`, `/fr/cas-concrets`, `/fr/comparaisons`, `/fr/glossaire`, `/fr/faq`, `/fr/centre-aide`, `/fr/ressources`, `/fr/guides`, `/fr/galerie` | 9 |
| Top éditorial | ~10 meilleurs posts blog + ~6 cas-concrets + ~5 comparaisons + ~15 termes glossaire densifiés | ~36 |
| Implantations | `/fr/implantations` (hub) + 5-6 régions à plus fort PIB | 7 |
| Villes gold-standard | les ~40 hubs villes « gold » déjà rédigés à la main (Paris, Lyon, Marseille, Toulouse, Nice…) | 40 |
| Légal (confiance E-E-A-T) | mentions, CGV, confidentialité, accessibilité (sélection) | ~4 |
| **TOTAL** | | **~120** |

**Action Tier 0** : sitemap réduit à Tier 0 + déjà-indexé ; maillage ≤2 clics ; IndexNow ; URL Inspection manuelle 10-20/j (P0-4).

## A.2 — Tier 1 — Cohorte secondaire (centaines) — débloquée quand Tier 0 ≥ 80 % indexé

- Reste du blog éditorial réel, FAQ substantielles, glossaire complet, centre-aide, stack-ia complet, cas-concrets/comparaisons restants, ~150 images galerie, régions restantes.
- **Exposée par paquets** (cf. règle de cadence A.4), pas d'un coup.

## A.3 — Tier 2 — Villes & templaté (milliers) — **NE PAS exposer tant que thin**

- ~1 100 villes hors `UNIQUE_VILLE_SLUGS` / hors cohorte : **rester noindex + hors sitemap**.
- Ne les drip-er qu'au rythme où **chaque ville reçoit une copy réellement unique** (gate doorway, P2-3, run LLM facturable explicite).
- **Le drip +50/jour calendaire est suspendu** (P0-1) : remplacé par un drip **piloté par l'indexation** (A.4).

## A.4 — Règle de cadence (garde-fou anti-sur-exposition)

```
Débloquer cohorte N+1 SEULEMENT si :
   taux_indexation(cohorte_N) ≥ 75 %      (mesuré GSC : indexées / soumises)
   ET dette_globale("Détectée non indexée") stable ou en baisse sur 7 j
   ET débit_crawl_7j ≥ taille(cohorte_N+1) / 14     (le crawl peut absorber en 2 sem)

Taille d'un paquet d'élargissement = min(150, débit_crawl_7j × 14)
Signal d'ARRÊT (re-geler) : si "Détectée non indexée" +200 sur 7 j → stopper tout ajout, diagnostiquer.
```

## A.5 — Leviers « agressifs mais légitimes »

- ✅ **Maillage interne fort** accueil/header/footer → tout le Tier 0 (≤2 clics, ancres descriptives).
- ✅ **`lastmod` honnêtes et frais** (jamais falsifiés).
- ✅ **IndexNow** (Bing/Yandex) — déjà dans la stack image-bank, étendre au Tier 0/news.
- ✅ **GSC URL Inspection → Demander l'indexation** : ~10-20 URLs Tier 0/jour (quota manuel).
- ✅ **Backlinks / PR** (blueprint relations-presse) : 5-10 liens de qualité = accélérateur d'autorité n°1, supérieur à tout réglage technique.
- ✅ **Sitemap propre et petit** : chaque URL crawlée compte.

## A.6 — Anti-patterns à NE PAS recommander

- 🔴 **Google Indexing API** : officiellement réservée à `JobPosting` / `BroadcastEvent`. L'utiliser pour des pages normales est **hors-guidelines et risqué** → interdit.
- 🔴 Cloaking, `lastmod` gonflé artificiellement, spam de demandes d'indexation, doorway pages.

## A.7 — Objectif chiffré stock : **47 → 120-200 indexées sous 4-6 semaines**

- Hypothèses : P0 appliqué (sitemap cohorte + og-image + EN), maillage Tier 0, IndexNow + 10-20 URL Inspection/j, **sans** backlinks. Avec 5-10 backlinks PR : **150-250**.
- Plan semaine par semaine en A.8.

## A.8 — Plan semaine par semaine

| Semaine | Actions | Mesure / déblocage |
|---|---|---|
| **S1** | Fixes P0 (sitemap→Tier 0, og-image 502, EN 301-unique) + maillage Tier 0 + IndexNow Tier 0 + re-soumettre sitemap GSC | baseline 47 |
| **S2** | URL Inspection 10-20/j sur Tier 0 ; démarrer 2-3 backlinks PR | suivi taux index Tier 0 |
| **S3** | Continuer ; si Tier 0 ≥ 75 % → préparer 1er paquet Tier 1 (≤150) | déblocage conditionnel |
| **S4** | Exposer paquet Tier 1 #1 ; mesurer dette | si dette ↑ → re-geler |
| **S5-6** | Itérer cohortes Tier 1 selon cadence A.4 ; +backlinks | objectif 120-200 |

---

# VOLET B — FLUX : régime permanent 100+/jour (Phase 3-TER)

## B.1 — Débit de crawl soutenable vs débit de publication

**Estimation du débit de crawl réel** (à partir de `Coverage/Graphique.csv`) :
- Index : 20 (05-15) → 47 (05-26..29). Net ≈ **+27 indexées / ~11 jours ≈ 2-3/jour** au pic du burst, retombant à **~0,9/jour** après le 05-19 (38→47 en 10 j).
- L'écrasante majorité des découvertes (2 558) sont **jamais crawlées** (1970-01-01) → le crawl effectif est **très inférieur** au nb d'URLs soumises.

**Verdict** :

> **On publie ~100+/jour ; Google indexe ~1-2/jour. Ratio ≈ 50:1 à 100:1.**
> Tant que `publié/jour > crawlé/jour`, la dette « Détectée non indexée » **croît sans borne** et le flux **cannibalise** le crawl du noyau. **C'est déjà le cas.**

**Débit de publication soutenable (aujourd'hui)** ≈ le débit de crawl ≈ **quelques URLs/jour en entrée de sitemap**. Il **montera** avec l'autorité (backlinks) et la fraîcheur de qualité — **pas** en poussant plus.

**Conséquence opérationnelle** : **découpler « publier » de « exposer au sitemap »**. On peut générer 100+/jour (stockés, `noindex`, hors sitemap) ; **seules** les pages qui passent le gate (B.2) **et** que le débit de crawl peut absorber **entrent dans le sitemap**.

## B.2 — Gate qualité automatique en entrée de sitemap (la vanne)

À la génération de chaque page, décision **`index & sitemap`** vs **`noindex & retenu`** :

```
entreDansSitemap(page) =
     contenuUnique(page)        // ≥ ~600 mots utiles, hors boilerplate
  ∧  scoreDuplication(page) < 0.4   // vs pages sœurs (villes/templates) — cf. UNIQUE_VILLE_SLUGS
  ∧  aMaillageEntrant(page)    // ≥1 lien interne depuis un hub crawlé
  ∧  budgetCrawlDisponible()   // file d'attente < seuil (sinon on retient)
```

- **Où ça vit dans le code** :
  - Villes : `src/content/villes/index.ts` → `isVilleIndexable` (déjà le point central : combine drip + `UNIQUE_VILLE_SLUGS`). Ajouter la condition `budgetCrawlDisponible`/cohorte gelée (P0-1) et la dépendance maillage.
  - Contenu généré (blog programmatique, knowledge) : au niveau des exporters (`sitemap.ts` builders `getIndexableBlogPosts`, `knowledge-sitemap.ts`) → n'émettre que `indexationTier='tier_1_indexable'` **+** seuil de qualité. (Déjà partiellement en place : blog filtre tier-1, FAQ ≥3 Q.)
- **Drip villes** : le `+50/jour calendaire` est **remplacé** par : `cohorte = pages passant le gate ∧ rang < seuilPilotéParIndexation`. Jamais le calendrier seul.

## B.3 — Architecture sitemap par type ET par fraîcheur

| Sitemap | Contenu | Cadence | Notes |
|---|---|---|---|
| **`sitemap-news.xml`** | actualités < 48 h | revalidate 300 | déjà conforme Google News (`xmlns:news`, ≤1000, fenêtre 48 h). Vérifier éligibilité Google News (sinon garder comme « fresh » sitemap). |
| **Evergreen éditorial** | blog/cas/comparaisons/glossaire/faq | revalidate 86400 | `lastmod` réel par contenu (déjà le cas blog/knowledge). |
| **Villes (cohorte)** | villes indexables seulement | 86400 | gelé/piloté (P0-1) ; `lastmod` réel (P1-2). |
| **Images** | galerie + services + villes | 3600/86400 | conditionner hreflang en au flag (A-04). |

- **`lastmod` honnêtes et précis** : un `lastmod` faux/en masse **réduit** le crawl (A-10). Vérifier que l'ISR/`revalidate` ne réécrit pas des `lastmod` artificiels à chaque build (les sub-sitemaps villes sont à `BUILD_TIME` → P1-2).

## B.4 — Auto-maillage J0 des nouvelles pages

- **Règle** : aucune page n'entre au sitemap sans **≥1 lien entrant depuis un hub crawlé fréquemment** (condition du gate B.2).
- **News** : doivent apparaître sur un **hub `/fr/blog` ou `/fr/actualites` vivant**, lui-même lié au header/footer → Googlebot revient sur le hub et découvre le neuf.
- **Villes** : liées depuis leur **hub régional** (`/fr/implantations/<region>`), lui-même lié au hub `/fr/implantations` (header mobile + footer).
- **Contenu généré (knowledge)** : ne pas l'enterrer — le mailler depuis `/fr/ressources` / hubs thématiques.

## B.5 — La fraîcheur comme accélérateur (retourner le flux en atout)

- Un flux **réellement utile** + `lastmod` frais **augmente** le crawl-rate (Google revient plus souvent sur les sites qui publient du neuf de qualité).
- Leviers : **hub d'actualité vivant** (priorise le crawl), **news sitemap**, **IndexNow ping à chaque publication Tier 0/news**.
- Le flux 100+/jour devient un **atout** s'il alimente d'abord la **qualité du noyau** (densification, mises à jour) plutôt que la **quantité de pages thin**.

## B.6 — Règle de gouvernance en régime permanent (synthèse)

> **Combien d'URLs/jour peuvent légitimement entrer dans le sitemap ?**
> = `min( débit_crawl_7j , nb_pages_passant_le_gate_qualité_avec_maillage_J0 )`,
> **plafonné** tant que la dette « Détectée non indexée » n'est pas stable/baissière.
>
> **Signal d'alerte (arrêt automatique)** : si « Détectée non indexée » **+200 sur 7 jours** OU taux d'indexation cohorte courante **< 50 %** → **geler** toute nouvelle entrée sitemap, alerter (dashboard P2-4 / alerte Telegram worker existant), diagnostiquer.

C'est ce qui réconcilie « **100+/jour qui augmente** » avec « **ne pas noyer Google** » : on **publie** au débit qu'on veut (stocké, noindex), on **expose** au débit que le crawl absorbe.
