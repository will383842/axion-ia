# Runbook prod — Reindex galerie banque d'images (215 visuels)

> Branche `feat/image-bank-reindex`, commit `2d1a43a0`.
> La galerie est **100 % DB-backed** : convertir les fichiers ne suffit pas, il faut
> remplir la base en prod. Tout se lance **dans le terminal Coolify de l'app**
> (workdir `/app`). `tsx` est une dépendance → `npx tsx …` fonctionne en prod.

---

## ⚠️ D'ABORD : les images déjà indexées par Google

Sur les 215 nouveaux slugs :

| Cas | Nombre | Risque |
|---|---|---|
| Slugs identiques à avant | 60 | ✅ aucun (même URL) |
| Vraiment nouveaux | 155 | ✅ aucun |
| Anciens qui disparaissent (orphelins) | 76 | ⚠️ à traiter |

**Ce qui NE casse PAS** : les 76 anciens fichiers `.webp` ne sont **pas supprimés** du
disque → leurs URLs image `/images/ancien.webp` restent servies → **pas de 404 sur
Google Images**.

**Ce qui PEUT casser** : les **pages** `/fr/galerie/{ancien-slug}`. Si on désactive la
ligne en base (`REINDEX_DEACTIVATE_ORPHANS=true`), la page renvoie **404** → mauvais si
elle est indexée.

### Reco : procéder en 2 temps

1. **Phase 1 (sans risque)** — lancer le seed **sans** l'option orphelins → ajoute les
   215, ne supprime rien. La galerie montre 215 + anciennes le temps de décider.
2. **Phase 2 (à froid)** — vérifier dans Google Search Console lesquelles des 76 pages
   `/fr/galerie/{ancien-slug}` sont réellement indexées :
   - **Aucune / très peu indexées** → activer `REINDEX_DEACTIVATE_ORPHANS=true` (2ᵉ run),
     c'est propre.
   - **Beaucoup indexées** → NE PAS désactiver tel quel : ajouter d'abord des **301** des
     anciens slugs → `/fr/galerie` (ou l'équivalent). ⚠️ Il n'existe pas de mapping
     ancien→nouveau (le renommage n'a pas gardé de trace), donc un 301 fin nécessite un
     mapping manuel ; un 301 groupé vers le hub `/fr/galerie` est le repli sûr.

Liste des 76 slugs : `_AUDIT/image-bank-reindex-2026-07/orphan-slugs.txt`.

---

## Étape 1 — Remplir la base avec les 215 (SANS risque)

```bash
# terminal Coolify de l'app, workdir /app
npx tsx prisma/seeds/image-bank/seed-images.ts
```

Attendu : `215 upserted, 0 erreurs`, puis un rapport des slugs orphelins (rapport seul,
rien n'est désactivé). Idempotent (upsert par slug), relançable sans danger.

## Étape 2 — Vérifier

- Ouvrir `https://axion-ia.com/fr/galerie` → les nouvelles images apparaissent (ISR ~60 s).
- Le sitemap `https://axion-ia.com/sitemaps/images-fr.xml` se repeuple seul (ISR ~1 h) —
  aucun code à régénérer, il lit la base.

## Étape 3 — (Après décision SEO) désactiver les orphelins

```bash
REINDEX_DEACTIVATE_ORPHANS=true npx tsx prisma/seeds/image-bank/seed-images.ts
```

Soft-delete (`isActive=false` + `deletedAt`) → sort de galerie + sitemap + JSON-LD.
**Réversible** (remettre `isActive=true`, `deletedAt=null`). Aucune suppression de fichier.

## Étape 4 — Enrichissement IA (alt / description réels → indexation)

Le seed ne pose qu'un **alt provisoire** (= le titre). Les pages détail restent `noindex`
tant que `description`/`aiSummary` ne sont pas remplis. Pour les remplir :

```bash
# Env requis : DATABASE_URL, ANTHROPIC_API_KEY, NEXT_PUBLIC_SITE_URL
npx tsx scripts/enrich-seeded-images.mts
# options utiles : --limit 5 (test) · --slug <slug> · --force
```

~215 images → prévoir du temps (délai anti-rate-limit ~2,5 s/appel). Flippe les pages
`noindex → index` une fois enrichies.

---

## Résumé

| Étape | Casse le SEO ? | Réversible ? |
|---|---|---|
| 1. Seed 215 | non | oui |
| 2. Vérif | — | — |
| 3. Désactiver orphelins | oui **si** indexées et pas de 301 | oui |
| 4. Enrichment IA | non (améliore) | oui (--force) |
