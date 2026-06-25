# 07 — AUDIT DE COHÉRENCE TRANSVERSALE

> Cohérence génération ↔ stockage ↔ rendu ↔ indexation. C'est ici que vivent les vrais défauts « système » (chaque couche est saine isolément, mais les jointures laissent des écarts).

## 7.1 — Schema.org & métadonnées : généré vs rendu

```
[MAJEUR] | hreflang (lib/seo.ts) vs SSG | EN est désactivé runtime (301→FR) MAIS les pages continuent à pré-rendre en EN et certaines metadata peuvent encore exposer un alternate hreflang. Génération FR-only, rendu FR-only, mais l'arbre SSG garde EN. | Signal hreflang potentiellement incohérent (alternate vers une URL qui 301). Connu (cf. CLAUDE.md « EN désactivé »). Reco : confirmer qu'aucun hreflang `en` n'est émis tant que `EN_LOCALE_ENABLED` est off.
[MAJEUR] | metaTitle (génération) → <title> (rendu) | Le LLM produit des metaTitle 33-50 car (cf. 02) ; le rendu ne complète PAS / ne tronque PAS / ne reconstruit pas le title à partir du H1 quand il est trop court. | Title SERP sous-optimisé propagé tel quel ; aucune couche de garantie de longueur entre génération et rendu. Reco : fallback `metaTitle || title` + clamp côté generateMetadata.
[MAJEUR] | og:image : colonnes ogImage/ogImageAlt (DB) vs rendu | Les colonnes `ArticleTranslation.ogImage/ogImageAlt` sont NULL sur les 33 articles ; le rendu dérive og:image du `featuredImage`. | Modèle de données trompeur : deux sources de vérité pour l'image sociale (colonne morte + featuredImage). Reco : peupler ogImage au publish OU supprimer les colonnes.
```

## 7.2 — Cohérence du contenu lui-même

```
[MAJEUR] | injectInternalLinks + catalogue (ALL_EXTERNAL_LINKS) | Le catalogue de liens internes/externes est en partie HARDCODÉ (~2400 entrées) et non re-validé HTTP au publish (cf. 01.5). Une route retirée → lien interne mort. | Liens cassés silencieux au fil des refontes ; cohérence inter-pages fragile. Reco : job périodique de link-check sur le catalogue.
[MINEUR] | titre dupliqué en tête de body (cf. 02.7) | Certains articles répètent le title en texte brut avant le 1er H2 → H1 (page) + texte identique. | Redondance perçue (humain + crawler), pas de pénalité directe.
[MINEUR] | "Sources" toujours en H2 (cf. 02.1) | Section non-éditoriale comptée comme H2 → gonfle la densité de titres. | Métrique de structure biaisée ; cohérence du sommaire (TOC) légèrement polluée.
[MINEUR] | entités/chiffres datés (cf. 02.6) | Présence inégale de chiffres sourcés dans le corps d'un article à l'autre. | Cohérence GEO inter-contenus variable.
```

## 7.3 — Orphelins & contenu invisible

```
[MAJEUR] | tier_3 (rétrogradation intent) ↔ maillage interne | Un article rétrogradé tier_3 (noindex,nofollow) reste lié depuis d'autres pages mais sort de l'index (cf. 06.5). | Contenu « fantôme » : généré, coûté, lié, mais non indexé et sans alerte. Reco : tableau de bord des rétrogradations + dé-maillage auto.
[MINEUR] | actualités : 0 publié (cf. 02) | Le type `blog_from_rss` / news existe (et a reçu un kind SEO dédié) mais 0 actualité en base. | Surface news non exploitée ; cohérence catalogue ↔ réalité publiée à surveiller.
[MINEUR] | templateVariant NULL (les 8) | La route de rendu se dérive du SLUG, pas d'un champ `templateVariant` stocké. | Couplage implicite slug→template ; un renommage de slug pourrait changer la route de rendu.
```

## 7.4 — Cohérence config ↔ comportement

```
[MAJEUR] | seuil auto-publish (70, seed) ↔ gate data-quality (OFF) ↔ auto-publish (ON) | Trois réglages indépendants se combinent en fail-open : seuil bas + gate désactivée + auto-publish par défaut = un contenu thin franchit toute la chaîne (cf. 03.1, 06.1). | Le « filet de sécurité qualité » n'est garanti par AUCUN réglage actif par défaut. C'est le défaut système le plus structurant. Reco : aligner les 3 (gate ON pour types courts OU plancher relevé).
[MINEUR] | search_intent (DB) vocabulaire FR ↔ enum SearchIntent | La colonne mélange FR/custom (transactionnel/sectoriel/aeo…) vs enum ; normalisation partielle (cf. 01.2 + garde-fou wiré). | Risque de mauvais routage intent→type ; atténué par `intentSafeForType` + `allowKeywordIntent`.
```

### Bilan Étape 7

**0 CRITIQUE.** La cohérence isolée de chaque couche est bonne ; les défauts vivent aux **jointures** : (1) la chaîne qualité fail-open (seuil×gate×auto-publish) — défaut le plus structurant ; (2) garanties de longueur meta absentes entre génération et rendu ; (3) og:image à deux sources ; (4) hreflang EN résiduel ; (5) catalogue de liens non re-validé ; (6) tier_3 orphelin sans alerte. Ce sont des problèmes d'**intégration**, pas de composants.
