# 03 — Charte & fidélité de marque Axion-IA

Tout ce qui est produit — UI admin, fiches publiques, **PDF réglementaires**, emails, **supports de
formation** — doit respecter la charte « Editorial Premium Light ». Les valeurs ci-dessous sont la
**source de vérité observée** dans `src/app/globals.css` (`@theme`) : re-vérifier en Phase 0, et si un
écart existe, **utiliser la valeur réelle du repo** et le signaler (jamais inventer).

## 1. Couleurs (tokens `@theme` — jamais de hex en dur en UI)

| Rôle                      | Token                                          | Hex                                           |
| ------------------------- | ---------------------------------------------- | --------------------------------------------- |
| Fond principal (ivoire)   | `--color-bg`                                   | `#faf8f3`                                     |
| Papier / cartes           | `--color-paper`                                | `#ffffff`                                     |
| Sable / sable profond     | `--color-sand` / `--color-sand-deep`           | `#f0e9da` / `#e6dcc4`                         |
| Mocha (sections premium)  | `--color-mocha` / `-soft` / `-fg`              | `#2a2520` / `#3d362f` / `#f7f3ea`             |
| Texte                     | `--color-fg` / `-soft` / `-muted`              | `#1a1815` / `#524b41` / `#5a4f44`             |
| Primaire (bleu éditorial) | `--color-primary` / `-hover` / `-fg` / `-soft` | `#1a4dd9` / `#0f3aae` / `#ffffff` / `#e8efff` |
| Terracotta (accents)      | `--color-terracotta` / `-soft` / `-deep`       | `#c24a1b` / `#f5e3d8` / `#8c3010`             |
| Sage (succès / proof)     | `--color-sage` / `-soft`                       | `#5e6c54` / `#e6ebe2`                         |
| Bordures                  | `--color-border` / `-strong`                   | `#e5ddc8` / `#c8bda0`                         |

En UI : utiliser les utilities Tailwind dérivées (`bg-canvas`, `text-fg`, `text-fg-muted`,
`bg-primary`, `text-terracotta`, etc.), **jamais** `#c24a1b` en dur. Pas de mode sombre (thème clair unique).

## 2. Typographie

| Token          | Police          | Usage                                     |
| -------------- | --------------- | ----------------------------------------- |
| `--font-serif` | **Fraunces**    | Titres H1–H5, displays                    |
| `--font-sans`  | **Manrope**     | Corps, labels, UI                         |
| `--font-mono`  | **Inconsolata** | Code, n° de document, montants techniques |

Échelle modulaire 1.25, **ancre corps = 18 px** (`--text-base`). Échelons : `sm 15`, `lg 20`, `xl 22`,
`2xl 26`, `3xl 32`, `4xl 40`, `5xl 52`, `6xl 64`, `7xl 80`, `display 88`, `section 48`. Radius :
`xs 2`, `sm 4`, `md 8`, `lg 12` (éditorial, conservateur).

Note H1 prod : le fallback serif au premier rendu (`font-display: optional`, CLS = 0) est **voulu**,
pas un bug.

## 3. Accessibilité (gate `contrast` + WCAG 2.1 AA)

Contrastes vérifiés (le gate `pnpm verify:all` inclut un check contrast/radius), navigation clavier,
focus visibles (`--color-border-strong`), `aria-label` sur les actions, états vide/chargement/erreur/
succès explicites, skeletons sur les données async, toasts (`sonner`).

## 4. SSOT marque pour PDF & email (point technique clé)

`@react-pdf/renderer` et les emails **ne lisent pas les CSS variables**. Pour éviter de re-hardcoder les
couleurs/fonts (et les voir diverger de la charte) :

- Créer **un seul module** `src/server/qualiopi/brand-tokens.ts` exportant couleurs + familles de
  polices, **miroir exact** de `@theme`.
- Tous les templates React-PDF et React Email consomment ce module (jamais de hex/police inline).
- Ajouter un **test de parité** : `brand-tokens.ts` ↔ valeurs `globals.css` (échec si divergence).
- Embarquer les polices (Fraunces/Manrope) dans les PDF (`Font.register`) pour fidélité hors-ligne.

Ainsi la charte reste **modifiable en un seul endroit** : changer le token → propagé UI + PDF + email +
supports, avec le test de parité comme garde-fou.

## 5. Documents réglementaires (PDF)

Chaque type a son **template dédié** (pas un template générique) : en-tête logo Axion-IA, mentions
légales exactes (reference/01 §5), pagination « Page X/Y », polices embarquées, **PDF/A-1b** pour
l'archivage légal (convention, attestation, certificat), filigrane « COPIE » si `est_copie`, QR de
vérification sur attestation/certificat, signed URL S3/R2 à expiration courte. Heures **en centièmes**
sur le certificat de réalisation.

## 6. Supports de formation (qualité « grande formation »)

Les supports générés doivent être dignes d'une formation premium ET à la charte :

- **Slides** : 1 idée par slide, ≤ 30 mots, taille mini lisible, 1 visuel/slide, logo + n° en pied,
  palette ivoire/mocha/terracotta/bleu, contraste AA.
- **Livret participant** : couverture, agenda, modules, espaces de prise de notes, plan d'action,
  imprimable A4 (marges correctes).
- **Fiche mémo A4 recto-verso** : recto 5 points clés ; verso 3 actions + outils.
- **Guide formateur** : timing, animations, signaux, moments clés (hook J+0, « WOW » planifié, clôture
  3 actions), synthèses ≤ 45 min.
- Qualité pédagogique (grille + Backward Design + critique adversariale + fil rouge + livrables
  progressifs) : voir SPEC PART5 §C/§D — le rendu visuel suit cette charte, le fond suit la grille qualité.

## 7. Modifiable manuellement

Tout est pensé pour l'ajustement manuel a posteriori : tokens dans `globals.css` + `brand-tokens.ts`
(un seul changement propagé partout), copy dans `content/*` et `messages/fr.json`, paramètres métier
dans `SiteSetting` (cat. qualiopi), grille qualité dans `grille_qualite_config` (éditeur JSON validé Zod), templates
email éditables depuis l'admin. Aucune valeur de marque ou métier n'est figée dans le code applicatif.
