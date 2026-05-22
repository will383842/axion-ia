# F-09 UX brand coherence

## Score : 22/25 — 🟢

## Findings (preuves)

1. **`src/lib/brand.ts` SSOT** (37 lignes) :
   - `name: "Axion-IA"` (canonique)
   - `legalName: "Axion-IA"` (D7 société FR, sans suffix juridique encore)
   - `alternateName: ["AxionIA", "Axion IA", "axion-ia.com"]`
   - `taglineFr: "cabinet IA opérationnel"`, `taglineEn: "operational AI consultancy"`
   - `sloganFr: "De l'idée à l'impact. Un seul partenaire IA."`, slogan EN miroir
   - `url: env.NEXT_PUBLIC_SITE_URL`
   - Naming canonique acté Will 2026-05-08

2. **Couleurs respectées** :
   - **Terracotta primaire** `#c24a1b` : `themeColor` PWA (`layout.tsx:82`), `theme_color` manifest (`manifest.ts:25`). Tokens CSS `--color-terracotta` / `--color-terracotta-soft` / `--color-terracotta-deep`.
   - **Ivoire fond** `#faf8f3` : `background_color` manifest (l. 24). Token `--color-bg`.
   - **Bleu primary `#1a4dd9` pointes seulement** : utilisé sur CTAs centrals (Header CTA central `bg-primary`, Home hero CTA primary l. 244) — bleu marqué comme « accent analyse » uniquement pour service Audit (`accent: "primary"` home l. 96). Pas de `bg-blue-*` brut dans `src/components/` (grep zero match).

3. **CTAs principaux** :
   - Header central « Réserver intervention » : `bg-primary text-primary-fg` (Header.tsx:116) — choix bleu validé doctrine (signaler service phare reserver via CTA bleu sur fond terracotta header).
   - Home hero primary `bg-primary` (l. 244) — même pattern.
   - Cards services : terracotta (Intervenir) / primary (Audit) / sage (Implémenter) — 3 accents distincts (home l. 84-115).
   - CTA blocks fin de page : ivoire/paper sur fond mocha (`bg-paper text-fg`, home l. 1293) ou terracotta selon contexte.

4. **Composants UI SSOT** (`src/components/ui/`) : 18 composants Radix-based + tests :
   - accordion, alert, badge, button, card, checkbox, dialog, dropdown-menu, input, label, popover, radio-group, select, separator, sheet, skeleton, slider, switch, tabs, textarea, tooltip
   - - `ImageBankPicture.tsx` (variant SSOT image)
   - Pattern Radix UI accessible.

5. **Header data-tone="terracotta"** (Header.tsx:65) : signalétique unique fond terracotta sticky. Logo en bulle ivoire (`bg-paper` l. 81) pour contraste correct.

6. **MobileNav** : drawer avec parité desktop, CTA réserver mobile présent.

7. **Footer 4 colonnes** : Services (6 liens) / Resources (7 liens) / Company (5 liens) / Legal (5 liens) + Implantations (6 régions par PIB). Cohérent.

8. **Typo SSOT** :
   - Manrope (sans-serif éditorial) — body, h1-h6
   - Fraunces (serif italique premium) — emphasis editorial display
   - Inconsolata (mono) — code, numbers tabular (preload=false)

9. **Pages Manon persona** : `/equipe/manon` page existe + JSON-LD Person `aiGenerated: true` + `disambiguatingDescription` AI Act art. 50.

10. **Persona slogan/positionnement** : 5 verticales reflétées dans `Footer.tsx:14-30` (interventions, audit, implementation, codage-developpement, un-a-un) + `Header.tsx:29-37` (Interventions, Audit, Implementation, Cas-concrets, Implantations).

## P0 bloquants prod

- **Aucun**.

## P1 importants

- `BRAND.legalName: "Axion-IA"` (brand.ts:16) → quand Will tranche raison sociale officielle FR (ex. « Axion-IA SASU » + SIREN), updater ici uniquement (propagation auto via JSON-LD Organization l. 389 + Person workfor).
- 5e verticale `codage-developpement` / `sites-web-augmentes` : 2 chemins coexistent (Footer.tsx:23 + page distincte `/sites-web-augmentes`). Confusion potentielle utilisateur — choisir SSOT.

## P2 polish

- Brand identity: `BRAND` est complet mais aucun composant ne consomme `BRAND.sloganFr`/`sloganEn` directement (grep). Slogan reste dans i18n messages `home`.
- Le bleu primary sur CTA principal réserver pourrait être perçu comme dérogation à la doctrine « bleu uniquement en pointe » — à clarifier dans charte interne (doctrine accepte ici car CTA pivot service phare).

## Verdict

Brand identity solide : SSOT `BRAND` + couleurs respectées (terracotta primary, ivoire fond, bleu en pointes/CTA pivot uniquement) + composants UI SSOT Radix-accessible + typo trois fonts justifiée + 5 verticales cohérentes Header/Footer + Manon persona AI Act compliant. Score 22/25 ; -3 pour `legalName` placeholder D7, duplication codage-developpement/sites-web-augmentes, et `sloganFr` non consommé directement.
