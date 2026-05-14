# Unsplash compliance — content-gen V1 (DOCTRINE 2026-05-14 v3)

> Doctrine acté Will 2026-05-14 après lecture précise des **Conditions Générales Unsplash** + **API Unsplash** + **Unsplash+**. Cette v3 fait foi et **remplace v1 et v2**.

## TL;DR juridique (1 paragraphe)

**Unsplash gratuit** (License standard) est **utilisable** pour le content-gen Axion-IA. Notre usage = **automatisation de sélection** (script API → choisir une photo → l'embarquer dans une page HTML d'article dont le **texte** est généré par IA). Ce n'est ni un dataset, ni un training de modèle, ni de la biométrie — donc hors clause anti-IA des CGU §8 et API §12 qui ciblent spécifiquement « ensembles de données » et « formation de modèles ». **Unsplash+** reste **exclu** par prudence : sa clause §3 est plus large (« par/pour intelligence artificielle quelle qu'elle soit »).

## Analyse précise des clauses

### CGU régulières §8 (`unsplash.com/terms`)

> « Utiliser les images **dans des ensembles de données** en relation avec de l'apprentissage automatique et/ou de l'intelligence artificielle (**par exemple, pour former des modèles** d'apprentissage automatique et/ou d'intelligence artificielle), ou pour des technologies conçues ou destinées à l'**identification de personnes physiques**. »

**Décomposition** :

| Élément                                    | Notre cas                                                              |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| « dans des ensembles de données »          | ❌ Nous n'avons pas de dataset. On utilise 1 image ↔ 1 article.        |
| « pour former des modèles » (exemple type) | ❌ On n'entraîne aucun modèle. On consomme du contenu IA (LLM hosted). |
| « identification de personnes physiques »  | ❌ Pas de biométrie.                                                   |

→ **Verdict** : notre cas est **hors clause**. Conforme.

### API §12 (`unsplash.com/developers`)

> « Si vous souhaitez utiliser le Contenu provenant de l'API **à des fins d'apprentissage automatique et/ou d'intelligence artificielle**, ou pour des technologies conçues pour identifier ou destinées à l'identification de(s) personnes physiques, rendez-vous sur https://unsplash.com/data »

**Décomposition** :

| Élément                                    | Notre cas                                                               |
| ------------------------------------------ | ----------------------------------------------------------------------- |
| « à des fins d'apprentissage automatique » | ❌ Notre fin = automatisation de sélection éditoriale, pas training ML. |
| « identification de personnes physiques »  | ❌ Pas de biométrie.                                                    |

→ **Verdict** : notre cas est **hors clause**. La voie `/data` est pour les acteurs qui entraînent des modèles. Pas nous.

### Unsplash+ §3 « Restrictions de licence »

> « Aucune utilisation à des fins d'apprentissage machine, ou **par des dispositifs utilisant de l'Intelligence Artificielle**, ou des dispositifs de technologie biométrique quels qu'ils soient. Le Contenu Unsplash+ […] ne peut pas être utilisé à des fins d'apprentissage automatique et/ou **par/pour une intelligence artificielle quelle qu'elle soit**. »

**Décomposition** :

| Élément                                   | Notre cas                                                                                                                                                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| « par des dispositifs utilisant de l'IA » | ⚠️ Notre pipeline appelle des LLMs (OpenAI/Anthropic/Perplexity). Le « dispositif » qui consomme l'image = notre serveur Node.js. Mais ce serveur appelle aussi des LLMs en amont/aval. **Zone grise.** |
| « par/pour une IA quelle qu'elle soit »   | ⚠️ Idem — formulation très large.                                                                                                                                                                       |

→ **Verdict** : clause Unsplash+ trop large et risquée. **Unsplash+ exclu** par prudence.

## Décision opérationnelle

✅ **Unsplash gratuit autorisé** pour content-gen V1.
❌ **Unsplash+ interdit V1** (et V2 sauf changement de clause).
✅ **Audit trail obligatoire** : chaque photo utilisée est tracée dans `ContentMetric.imageMetadata` (photo ID + photographer + URL source + date téléchargement + slug article).
✅ **Filtre strict côté code** : `premium=false` à chaque requête + defense in depth post-réception.
✅ **Trigger `/photos/:id/download`** obligatoire (CGU API §6 — Données d'Interaction Image).
✅ **Attribution photographer** sur chaque image rendue (CGU API §9 — bien que non strictement obligatoire pour License gratuite, c'est exigé pour usage via API).

## Implémentation technique (Sprint 1 Day 2 AGT-B → Day 4 image system)

### A. Requête API filtrée

```ts
const url = new URL("https://api.unsplash.com/search/photos");
url.searchParams.set("query", searchQuery);
url.searchParams.set("orientation", "landscape"); // default
url.searchParams.set("content_filter", "high"); // anti-NSFW
url.searchParams.set("per_page", "30");
// Unsplash n'expose pas de paramètre "exclude_premium" — on filtre côté client.
```

### B. Filtrage post-réception (defense in depth)

```ts
const photos = response.results.filter((p) => {
  // Refus systématique de toute photo Unsplash+ (premium=true OU tier!=free)
  if (p.premium === true) {
    logger.warn(`[unsplash] Skipped Unsplash+ photo ${p.id} (premium=true, CGU §3)`);
    return false;
  }
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

### C. Attribution photographer obligatoire (CGU API §9)

Pour chaque photo retenue, stocker dans `ContentMetric.imageMetadata` + rendu HTML :

```ts
const attribution = {
  photographer: photo.user.name,
  photographerUrl: `${photo.user.links.html}?utm_source=axion-ia&utm_medium=referral`,
  photoUrl: `${photo.links.html}?utm_source=axion-ia&utm_medium=referral`,
  unsplashCredit: `Photo de ${photo.user.name} sur Unsplash`,
};
```

→ rendu HTML obligatoire :

```html
<figcaption class="image-credit">
  Photo de
  <a href="{photographerUrl}" rel="noopener" target="_blank">{photographer}</a>
  sur
  <a href="https://unsplash.com?utm_source=axion-ia&utm_medium=referral" rel="noopener">Unsplash</a>
</figcaption>
```

### D. Trigger download API obligatoire (CGU API §6)

Unsplash exige qu'on hit l'endpoint `/photos/:id/download` pour chaque image utilisée (track usage côté Unsplash). C'est une **obligation technique** des Conditions d'Utilisation de l'API.

```ts
// Après avoir sélectionné une photo, AVANT de la stocker localement :
await fetch(`https://api.unsplash.com/photos/${photo.id}/download`, {
  headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` },
});
```

### E. Rate limiting (free tier Unsplash)

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

### F. Avertissement sensible (prudence éditoriale)

Si le contenu touche à sujet sensible (santé, justice, politique, etc.), ajouter automatiquement dans le `<figcaption>` un disclaimer :

```html
<figcaption class="image-credit">
  Photo de <a href="{photographerUrl}">{photographer}</a> sur Unsplash ·
  <em
    >Illustration à des fins descriptives. Toute personne représentée est un modèle non lié au sujet
    de l'article.</em
  >
</figcaption>
```

Triggered par mot-clé dans le sujet de l'article (à définir dans `posts-validate.ts` Sprint 1 Day 4 via `BannedPhrase[severity=info]` ou table dédiée `SensitiveTopic`).

## Gates de conformité automatiques (Sprint 1 Day 4)

À ajouter dans `pnpm content-gen:html-audit` :

- [ ] Vérifie présence `<figcaption class="image-credit">` avec attribution photographer pour chaque `<img>` provenant d'Unsplash
- [ ] Vérifie présence des liens `utm_source=axion-ia` dans les `href` de l'attribution
- [ ] Vérifie qu'aucune photo `premium=true` n'a été utilisée (lookup en DB sur `ContentMetric.imageMetadata`)
- [ ] Vérifie présence du download trigger log dans `GenerationLog.metadata.unsplashDownloadTriggered = true`
- [ ] Vérifie présence du disclaimer sensible si topic ∈ liste sensibles

## Audit trail (RGPD + traçabilité)

Table `ContentMetric.imageMetadata` (Json) — schéma :

```json
{
  "source": "unsplash",
  "photoId": "abc123XYZ",
  "photographer": "John Doe",
  "photographerUrl": "https://unsplash.com/@johndoe?utm_source=axion-ia",
  "photoUrl": "https://unsplash.com/photos/abc123XYZ?utm_source=axion-ia",
  "downloadTriggeredAt": "2026-05-14T13:42:18.234Z",
  "rawApiResponse": { "premium": false, "tier": "free", "..." },
  "selectedFromQuery": "industrial AI consulting Lyon"
}
```

→ permet de :

- Répondre à une plainte « tiers » sous 7 jours (CGU §10 retrait sur notification)
- Justifier la conformité Unsplash en cas d'audit
- Désactiver/remplacer une photo précise à la demande

## Roadmap V2 (Sprint 7+)

Tant que les CGU restent inchangées, doctrine v3 stable. Re-évaluation déclenchée si :

- Unsplash modifie CGU (préavis 7 jours) → audit nouveau texte avant continuer
- Volume images > 50 K/an → demander licence enterprise via `unsplash.com/data` pour clarification écrite
- Plainte tiers reçue → audit immédiat + retrait photo concernée + remplacement
- Will souhaite ajouter providers Pexels/Pixabay/IA-gen → mêmes pattern de compliance docs

## Références

- Conditions Générales Unsplash (fournies Will 2026-05-14, §1-21 + DMCA + arbitrage)
- Conditions d'Utilisation de l'API Unsplash (fournies Will 2026-05-14, §1-20)
- Conditions d'Abonnement Unsplash+ (fournies Will 2026-05-14)
- https://unsplash.com/license (License standard)
- https://unsplash.com/data (voie enterprise IA — non requis V1 selon notre analyse)
- ADR 0012 « Content Generator architecture v1.8 » (à étendre Sprint 1 Day 6 pour acter cette doctrine v3)
