# ADR 0011 — Refonte taxonomique /interventions en 4 familles

**Statut** : ✅ Acté Sprint 14.10.7 · 2026-05-11
**Décideur** : Will (gérant Axion-IA OÜ)
**Contexte sources** : conversation refonte 2026-05-11 · doctrine `axionia_pricing_centralization`

---

## Contexte

Avant Sprint 14.10.7, la page `/interventions` exposait **8 cards format** (Essentielle 4 paliers, Approfondie 2 j, Gagner du temps, Intervention Claude, CODIR Dirigeants, Conférence, Sur demande) listées en 2 colonnes sur la même page. Cette grille « catalogue plat » avait 3 problèmes :

1. **Charge cognitive trop élevée** au premier contact — le visiteur doit comparer 8 cards en un coup d'œil avant de choisir.
2. **Pas d'extensibilité naturelle** — chaque nouveau format aurait imposé d'ajouter une 9ᵉ, 10ᵉ card dans une grille déjà saturée.
3. **Mental model mal posé** — l'audience B2B veut d'abord se reconnaître dans une **situation** (« je dois former mon équipe » / « je veux un coaching perso » / « je veux briefer mon CODIR » / « je veux une plénière kick-off ») avant de choisir une durée et un format.

Will (2026-05-11) a tranché en faveur d'une **arborescence taxonomique** : catégorie famille → (optionnel) palier durée → format. Modèle classique des sites de catalogue produit.

## Décision

### Structure adoptée

```
/interventions              ← HUB 4 BLOCS FAMILLE
│
├── A. Formations équipe    /interventions/collectives
│      ├── 4 heures         /interventions/collectives/4h
│      ├── 1 jour           /interventions/collectives/1-jour
│      ├── 2 jours          /interventions/collectives/2-jours
│      └── 3 jours et +     → /contact?objet=formation-collective-sur-mesure
│
├── B. Coaching individuel  /interventions/individuel
│      └── liste plate (vide en V1 — Will remplira)
│
├── C. Dirigeants           /interventions/dirigeants (page format existante)
│      └── liste plate (1 format CODIR 990 €)
│
└── D. Conférence           /interventions/conference (page format existante)
       └── liste plate (1 format plénière 1 j)
```

- **Famille `collectives`** est la seule à avoir des **paliers durée** (matrice 4 × N formats). Les 3 autres familles sont des **listes plates** de formats sans sous-niveau durée.
- **Pages format détail existantes** (Essentielle, Approfondie, Conférence, Dirigeants, Gagner du temps, Intervention Claude) **non touchées** — elles deviennent les cibles des cards depuis les pages listing. Zéro casse SEO sur ces routes.
- **Calendrier `/reserver` non touché** — il continue de consommer la nomenclature actuelle (`?tier=intimiste/standard/complete` pour Essentielle).
- **Footer + mega-menu non touchés** — ils pointent vers `/interventions` qui devient le hub 4 familles.

### SSOT — `src/content/interventions-taxonomy.ts`

Source unique extensible :

- `FAMILIES` — 4 blocs (slug, label FR/EN, tagline, path, hasDurations, accent).
- `COLLECTIVE_DURATIONS` — 4 paliers (4h / 1-jour / 2-jours / 3-jours-plus avec `isQuoteOnly: true`).
- `INTERVENTION_FORMATS` — liste extensible des formats avec coordonnées `family` + `duration` optionnel.
- Helpers : `getFormatsByFamily`, `getFormatsByCell`, `countFormatsByFamily`, `countFormatsByCell`, `formatPath`, `familyPath`, `durationPath`, `quoteContactPath`.

**Comment ajouter une formation** (workflow Will → Claude ou direct V2 admin) :

1. Ajouter 1 objet à `INTERVENTION_FORMATS` avec `family` et `duration` si Collectives.
2. (Optionnel) Créer une page détail dédiée `/interventions/<slug>` si la formation mérite plus qu'un tagline.
3. La page palier durée (ou famille pour liste plate) incrémente automatiquement son compteur et liste la nouvelle entrée.

### Doctrine « pas de demi-journée » — exception actée

ADR 0008 (et Sprint 14.10.4) avait acté **« durée minimale = 1 jour »**. Le palier `4h` casse cette règle. **L'exception est actée ici** :

- Justification : Will veut pouvoir vendre des formats express (4 h) pour les TPE ou les comités restreints qui ne peuvent pas bloquer une journée entière.
- Garde-fou : aucune obligation de remplir le palier 4h. Tant qu'il est vide, la page affiche un message « Formats en préparation » + CTA contact. La doctrine s'autorégule : si aucun format 4h n'est créé, le palier reste virtuel.

### Conférence promue en famille à part

Précédemment classée comme format Collectives/1-jour, la **Conférence** devient une **famille à part entière** (décision Will 2026-05-11). Justification : c'est une plénière grands effectifs (30+) qui ne colle pas à la grammaire « formation équipe » (2-30 pers., ateliers pratiques) — elle mérite son propre bloc pour clarté visiteur.

## Implémentation V1 — TS pur

- 1 fichier SSOT : `src/content/interventions-taxonomy.ts` (~370 lignes).
- 2 composants partagés :
  - `src/components/sections/InterventionFormatCard.tsx` (card unitaire format)
  - `src/components/sections/CollectiveDurationListing.tsx` (page listing par cellule)
- 6 nouvelles pages :
  - `/interventions` (refonte du hub — 4 cards famille au lieu de 8 cards format)
  - `/interventions/collectives` (nouveau hub famille — 4 paliers durée)
  - `/interventions/collectives/4h`, `/1-jour`, `/2-jours`, `/3-jours-plus` (pages durée)
  - `/interventions/individuel` (nouvelle page famille liste plate)
- 6 routes ajoutées à `routing.ts` (typed, sitemap auto).
- Composant `InterventionsHeroSchema` étendu pour accepter N nodes (3 / 4 / 5 / autre).

## Plan V2 — Admin DB-managé (Sprint dédié futur, ~3-4 semaines)

Le SSOT TS V1 sert d'**API contract** stable pour la migration future :

- Vue Prisma `intervention_taxonomy` (catégorie / sous-catégorie / format / sous-tier / programme / outcomes / FAQ / SEO).
- API CRUD `/admin/catalog` (~40 endpoints) — Tiptap pour éditer programmes longs.
- Slug history + 301 auto (sinon casser une URL renommée détruit le SEO de la 17 500 routes SSG).
- Compatibilité forcée avec le calendrier `/reserver` (`?tier=...` câblé en dur).
- Régénération `copy.services` des 2 157 villes pSEO après chaque modification structurelle (LLM industrialisation).

L'API publique (types + helpers) du module taxonomie **reste identique** entre V1 et V2 → les pages listing ne changent pas de code lors de la migration. Même stratégie que `pricing.ts` (V1 TS → V2 Prisma annoncée en tête de fichier).

## Critères de réussite (V1)

- ✅ Visiteur arrive sur `/interventions` → voit 4 cards famille claires en moins de 2 s.
- ✅ Visiteur clique sur « Formations équipe » → voit les 4 paliers durée avec compteurs dynamiques.
- ✅ Visiteur clique sur « 1 jour » → voit les 3 formations 1-jour (Essentielle, Gagner du temps, Claude).
- ✅ Visiteur clique sur « 3 jours et + » → atterrit sur `/contact?objet=formation-collective-sur-mesure`.
- ✅ Ajouter une nouvelle formation = 1 ligne dans `INTERVENTION_FORMATS`, sans toucher aux pages.
- ✅ Aucune route format existante cassée (essentielle, approfondie, conference, dirigeants, gagner-du-temps, intervention-claude restent intactes).
- ✅ Sitemap inclut automatiquement les 6 nouvelles routes (`routing.pathnames`).
- ✅ Calendrier `/reserver` continue de fonctionner sans modification.

## Liens

- SSOT : `src/content/interventions-taxonomy.ts`
- Hub : `src/app/[locale]/interventions/page.tsx`
- ADR 0008 (Vocabulary intervention/coaching) : doctrine adjacente naming.
- Memory : `axionia_pricing_centralization`, `axionia_pricing_zero_hardcode_2026-05-08`.
