# P-05 — SEO LIVE (extraction view-source)

## Échantillon `/fr/implantations/ile-de-france/paris` (Paris pilote)

### Title

```
Paris (75) · Cabinet IA opérationnel · Axion-IA
```

**Longueur** : 50 caractères. ✅ Sous cap Google 60c.
Naming Axion-IA respecté + intouchable "Cabinet IA opérationnel" ✅.

### Meta description

```
Axion-IA est un cabinet IA opérationnel qui intervient à Paris (75) sur site dans les
20 arrondissements et la première couronne. Nous accompagnons les TPE, PME, ETI et
grandes entreprises parisiennes (La Défense, 8e, 16e) ainsi que les startups du
Sentier et de Station F sur leurs cas IA opérationnels — diagnostic chiffré, démos
sur vos vraies données, plan d'action concret. Aucun lock-in technologique, vos
équipes gardent la main.
```

**Longueur** : ~520 caractères. ⚠️ **Au-dessus du cap Google 155-160c**. Sera tronqué SERP. **P1 SEO** (concordant AGT-04 P1).

### Canonical

```
<link rel="canonical" href="https://axion-ia.com/fr/implantations/ile-de-france/paris">
```

✅ Absolu HTTPS, sans paramètre, conforme.

### og:image (CONFIRMÉ DYNAMIQUE PROD)

```
<meta property="og:image" content="https://axion-ia.com/api/og?title=Paris%20(75)%20%C2%B7%20Cabinet%20IA%20op%C3%A9rationnel">
```

✅ **og:image localhost = FAUX POSITIF mémoire**. Dynamic OG via `/api/og` route. À mettre à jour mémoire `axionia_bugs_seo_preexistants_2026-05-09`.

### JSON-LD count

**2 blocs `<script type="application/ld+json">`** sur la page Paris. AGT-05 mentionne 5+ schemas + Breadcrumb attendus. Probablement les schemas sont consolidés en blocs `@graph` (analyse JSON parse non faite Phase 4). À cross-confirm Pass B avec AGT-05.

### Hreflang

**À mesurer** : grep `hreflang="..."` sur Paris pilote n'a pas renvoyé d'output dans cette session, peut-être balises plus loin dans le `<head>`. AGT-06 confirme code-side hreflang `fr/en/x-default` partout. Re-confirmation Pass B avec view-source manuel.

## Échantillon `/fr/reserver`

### Title + meta + canonical

À extraire ; les commandes initiales n'ont pas remonté le contenu (peut-être hash injection ou taille). En l'état, **AGT-04 / Phase 0 ont confirmé** que `generateMetadata` est posée sur 73/76 routes publiques.

## Synthèse

| Critère                          | Paris pilote                                 |
| -------------------------------- | -------------------------------------------- |
| Title ≤ 60c                      | ✅ 50c                                       |
| Description 140-160c             | ⚠️ 520c **trop long** (P1 confirmé)          |
| Canonical HTTPS absolu           | ✅                                           |
| og:image absolu (pas localhost)  | ✅ confirmé dynamic /api/og                  |
| Hreflang fr/en/x-default         | À confirmer Pass B                           |
| JSON-LD count                    | 2 blocs (5+ schemas par `@graph` ?) — Pass B |
| Naming "Cabinet IA opérationnel" | ✅                                           |
| Naming Axion-IA                  | ✅                                           |

### Findings clés

1. **P1 SEO** : meta description ~520c sur Paris > 160c cap. AGT-04 P1 cross-confirmé prod.
2. **og:image bug = RÉSOLU prod**. Mémoire à mettre à jour.
3. **2 JSON-LD scripts** sur Paris (vs 5+ attendus) → vérifier consolidation `@graph` Pass B.
