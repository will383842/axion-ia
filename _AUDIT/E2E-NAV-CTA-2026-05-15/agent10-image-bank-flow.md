# Agent 10.5 — Image-bank `/galerie` deploy status

## Status

- Skill `axionia-image-bank` v1.1 production-ready (mémoire `axionia_image_bank_skill_v1_1_2026-05-15`).
- **Code public `/fr/galerie`** = ❌ **N'EXISTE PAS** :
  - `ls src/app/[locale]/galerie/` → no such directory
  - Glob `**/galerie/**/page.tsx` → 0 match
- `src/i18n/routing.ts:240-243` déclare pourtant les pathnames :
  ```
  "/galerie": { fr: "/galerie", en: "/gallery" },
  "/galerie/[slug]": { fr: "/galerie/[slug]", en: "/gallery/[slug]" },
  "/galerie/[slug]/telecharger": { fr: "/galerie/[slug]/telecharger", ... },
  ```
  Configuration prête en `routing.ts` mais routes physiques absentes du repo.

## 🚨 P0 — Dead link confirmé dans le footer

`src/components/nav/Footer.tsx:43-45` expose **un lien `/galerie` cliquable** :

```tsx
// Skill axionia-image-bank v1.0 — galerie CC BY 4.0 indexée Google Images / LLMs.
// Placement footer (pas header) : galerie secondaire vs modules commerciaux.
{ href: "/galerie", label: isFr ? "Banque d'images" : "Image bank" },
```

→ Tous les visiteurs qui cliquent ce lien tombent sur une **page 404** (next-intl résoudra l'URL via routing.ts puis le router Next 16 retourne notFound → la page existe pas).

Test prod live `https://axion-ia.com/fr/galerie` → HTTP 503 actuellement (origin throttled, pas pertinent). Sur retour 200, le contenu sera `not-found.tsx`.

**Verdict gate** : « Image-bank déployé mais nav cassée = ROUGE » → **ROUGE applicable inverse** : image-bank PAS déployé mais lien en navigation → ROUGE équivalent (dead link visible).

## Autre exposition `/galerie`

`src/components/sections/PressImageBank.tsx` (composant page `/presse`) référence aussi des assets image-bank. À vérifier en P1 (probablement pareil — pointe vers une route qui n'existe pas).

## P0 / P1

- **P0 (choix rapide)** : retirer le lien `/galerie` du `Footer.tsx:43-45` jusqu'au déploiement réel. Suppression de 3 lignes, 1 commit. Évite dead link en prod.
- **P0 (long)** : implémenter les routes publiques `/galerie` + `/galerie/[slug]` + `/galerie/[slug]/telecharger` conformes au skill v1.1 (mémoire) avant de re-conserver le lien.
- **P1** : vérifier `src/components/sections/PressImageBank.tsx` — si la page `/presse` montre une « banque d'images presse » qui pointe vers /galerie, idem dead link.
- **P1** : si déploiement décidé, suivre le skill v1.1 : 9 tables Prisma + Sharp variants WebP/AVIF + sitemap-images.xml + IndexNow ping + JSON-LD ImageObject.
