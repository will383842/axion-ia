# Unsplash compliance — content-gen V1

> Source de vérité doctrine 2026-05-14 (Will). Toute évolution doit être validée avant impl.

## TL;DR (doctrine en 1 paragraphe)

Axion-IA utilise **uniquement Unsplash gratuit** (licence Unsplash régulière, type CC0). Le **Contenu Unsplash+** (filigrane « Unsplash+ ») est **interdit d'usage** côté content-gen car ses Conditions d'Abonnement excluent explicitement « toute utilisation à des fins d'apprentissage machine, ou par des dispositifs utilisant de l'Intelligence Artificielle ». Notre pipeline produit du contenu via IA (OpenAI / Anthropic / Perplexity) → le contenu accompagne ce contenu IA → bascule juridique inacceptable.

Le code `unsplash.ts` doit donc :

1. **Filtrer `premium: false`** à toutes les requêtes API.
2. **Vérifier `photo.premium !== true`** après réception de chaque réponse (defense in depth).
3. **Rejeter et logger** toute photo `premium: true` qui passerait les filtres (anomalie).
4. **Stocker l'attribution photographer + lien profil + lien source** obligatoirement.
5. **Émettre les liens UTM Unsplash** (`?utm_source=axion-ia&utm_medium=referral`) tel que requis par leurs guidelines.

## Détail des restrictions Unsplash+ (interdites pour nous)

Source : Conditions d'Abonnement Unsplash+ fournies par Will 2026-05-14.

| Restriction Unsplash+                               | Impact content-gen                                                   |
| --------------------------------------------------- | -------------------------------------------------------------------- |
| Pas d'utilisation ML / IA / biométrique             | ❌ Bloquant absolu — notre pipeline = IA                             |
| Pas de modèles électroniques revendables            | ❌ Bloquant — nos landings villes sont publiées                      |
| Plafonds tirage physique (cartes, t-shirts, etc.)   | N/A — usage web uniquement                                           |
| Pas de stockage DAM / serveur partagé               | ⚠️ Notre BD `WebVitalSample`/etc. peut être interprétée comme DAM    |
| Avertissement « illustration / modèle » si sensible | ⚠️ À implémenter quand on génère sur sujets sensibles                |
| Non-transférable / non-sublicenciable               | ❌ Bloquant — contenu généré est lu par tiers                        |
| Garantie Unsplash+ cap $10K / article               | ❌ Pas un risque acceptable                                          |
| Indemnité limitée si modifications                  | ❌ Notre pipeline modifie systématiquement (resize, watermark, etc.) |

→ **Conclusion : Unsplash+ totalement exclu.** L'opt-out est dans le code (filter strict) et dans l'admin (impossibilité de toggle).

## Doctrine Unsplash gratuit (autorisé)

Source : https://unsplash.com/license (Unsplash License — type CC0 sans attribution obligatoire mais recommandée).

| Permission                                                 | Notre usage                                               |
| ---------------------------------------------------------- | --------------------------------------------------------- |
| Usage commercial autorisé                                  | ✅ Vente, marketing, monétisation OK                      |
| Modifications autorisées                                   | ✅ Resize, watermark, crop OK                             |
| Pas d'attribution obligatoire (mais bonne pratique)        | ✅ On la met quand même (signal authenticité + bon karma) |
| Pas de revente de photos en tant que photos                | ✅ N/A (on intègre dans contenus)                         |
| Pas d'imitation Unsplash (« Unsplash for Brands » etc.)    | ✅ N/A                                                    |
| Pas de compilation pour service concurrent                 | ✅ N/A                                                    |
| AI training : permis (pas de restriction License gratuite) | ✅ Compatible notre pipeline                              |

## Implémentation technique (Sprint 1 Day 2 AGT-B)

### A. Requête API filtrée

```ts
const url = new URL("https://api.unsplash.com/search/photos");
url.searchParams.set("query", searchQuery);
url.searchParams.set("orientation", "landscape"); // default
url.searchParams.set("content_filter", "high"); // anti-NSFW
url.searchParams.set("per_page", "30");
// Unsplash n'expose pas de paramètre "exclude_premium" — on filtre côté client.
```

### B. Filtrage post-réception

```ts
const photos = response.results.filter((p) => {
  // Defense in depth : refus systématique de toute photo premium=true
  if (p.premium === true) {
    logger.warn(`[unsplash] Skipped premium photo ${p.id} (CGU compliance)`);
    return false;
  }
  // Refus aussi si tier paid (Unsplash+ uniquement, garde-fou)
  if (p.tier && p.tier !== "free") {
    logger.warn(`[unsplash] Skipped paid-tier photo ${p.id} (tier=${p.tier})`);
    return false;
  }
  return true;
});

if (photos.length === 0) {
  throw new ProviderError(
    "No free Unsplash photos available for query",
    "invalid_response",
    "unsplash",
    false,
  );
}
```

### C. Attribution photographer obligatoire

Pour chaque photo retenue, stocker dans `WebVitalSample`/`ContentMetric`/output meta :

```ts
const attribution = {
  photographer: photo.user.name,
  photographerUrl: `${photo.user.links.html}?utm_source=axion-ia&utm_medium=referral`,
  photoUrl: `${photo.links.html}?utm_source=axion-ia&utm_medium=referral`,
  unsplashCredit: `Photo de ${photo.user.name} sur Unsplash`,
};
```

→ rendu HTML obligatoire : `<figcaption>{attribution.unsplashCredit} (<a href="{photographerUrl}">{photographer}</a>)</figcaption>`.

### D. Rate limiting (free tier Unsplash)

Quota free : **50 requêtes / heure** par clé API.

```ts
// Redis bucket per-clock-hour
const hourBucket = `unsplash:rate:${new Date().toISOString().slice(0, 13)}`; // "2026-05-14T13"
const count = await redis.incr(hourBucket);
await redis.expire(hourBucket, 3600);
if (count > 45) {
  // garde-fou 45/50 — buffer 10%
  throw new ProviderError(
    `Unsplash rate limit reached (${count}/50 this hour)`,
    "rate_limited",
    "unsplash",
    true, // retryable après expiration bucket
  );
}
```

### E. Trigger « download » API obligatoire (CGU)

Unsplash exige qu'on hit l'endpoint `/photos/:id/download` pour chaque image utilisée (track usage côté Unsplash). C'est une **obligation technique** des CGU régulières.

```ts
// Après avoir sélectionné une photo, AVANT de la stocker localement :
await fetch(`https://api.unsplash.com/photos/${photo.id}/download`, {
  headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` },
});
```

### F. Avertissement sensible (CGU §3 Unsplash+ ET règle prudence Unsplash gratuit)

Si le contenu touche à sujet sensible (santé, justice, politique, etc.), ajouter automatiquement dans le `<figcaption>` :

```html
<figcaption>
  Photo de {photographer} sur Unsplash ·
  <em
    >Illustration à des fins descriptives. Toute personne représentée est un modèle non lié au sujet
    de l'article.</em
  >
</figcaption>
```

Triggered par mot-clé dans le sujet de l'article (à définir dans `posts-validate.ts` Sprint 1 Day 4).

## Gates de conformité automatiques

À ajouter dans `pnpm content-gen:html-audit` (Sprint 1 Day 4) :

- [ ] Vérifie présence `<figcaption>` avec attribution photographer pour chaque `<img>` provenant d'Unsplash
- [ ] Vérifie présence des liens `utm_source=axion-ia` dans les `href` de l'attribution
- [ ] Vérifie qu'aucune photo `premium=true` n'a été utilisée (lookup en DB sur `ContentMetric.imageMetadata`)
- [ ] Vérifie présence du download trigger log dans `GenerationLog.metadata.unsplashDownloadTriggered = true`

## Doctrine V2+ (Sprint 2+)

- V2 : ajouter cache local photos téléchargées (avec attribution conservée) — éviter re-trigger download Unsplash.
- V2 : panel admin pour bloquer photographers spécifiques si Will identifie un problème.
- V3 : possibilité passer à Pexels / Pixabay en parallèle (licence CC0 compatible).
- ❌ V∞ : **Unsplash+ reste interdit tant que leur clause IA n'évolue pas.**

## Références

- Conditions Unsplash+ (fournies Will 2026-05-14, archivées dans ce repo).
- Unsplash License gratuite : https://unsplash.com/license
- Unsplash API rate limits : https://unsplash.com/documentation#rate-limiting
- Unsplash hotlinking rules : https://unsplash.com/documentation#hotlinking
