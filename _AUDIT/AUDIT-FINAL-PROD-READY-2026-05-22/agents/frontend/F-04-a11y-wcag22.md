# F-04 A11y WCAG 2.2

## Score : 20/25 — 🟢

## Findings (preuves)

1. **Skip link conforme WCAG 2.4.1** : `src/components/a11y/SkipToContent.tsx:5-15` émet un `<a href="#main">` sr-only/focus-visible, ciblant `<main id="main">` dans `src/app/[locale]/layout.tsx:224`.

2. **lang attribute** : `<html lang={locale} dir="ltr">` ligne 200-201 du root layout → dynamique selon locale (fr/en).

3. **Pas de `<img>` HTML brut dans le code public** : grep `<img\s` retourne 7 fichiers, tous légitimes :
   - `src/components/admin/image-bank/ImageUploadDropzone.tsx:89` (admin only)
   - `src/components/galerie/EmbedCodeButton.tsx:33` (génération embed code, attendu)
   - `src/components/knowledge/public/AuthorByline.tsx:49` (à vérifier — voir P1)
   - 4 fichiers de tests
     Le reste du site utilise `<Image>` Next 16 (`next/image`).

4. **aria-hidden="true" sur icônes décoratives** : 113 occurrences (39 dans `<button>` analytics search/calendar). Pattern systématique : `<ArrowRight className="h-4 w-4" aria-hidden="true" />` (Header.tsx:125, Home.tsx:247, etc.).

5. **aria-label sur 63 fichiers** : Header.tsx:80 logo (`BRAND.name`), MobileNav.tsx, LocaleSwitcher.tsx, etc. CTA central a aria-label dynamique `${ctaAriaLabel}` (Header.tsx:113).

6. **alt présent partout `<Image>`** : `Header.tsx:85 alt={BRAND.name}`, home illustrations alt FR+EN (page.tsx:1262), etc. Grep `alt=""` retourne 1 seul match dans `alt-text-validation.test.ts:1` (test).

7. **Focus-visible:ring-primary** présent sur tous les CTAs : home l.244, header l.81, etc. Pattern : `focus-visible:ring-primary focus-visible:ring-2 focus-visible:ring-offset-2`.

8. **Heading hierarchy** : home.tsx → 1 h1 (l. 229) + h2 multiples par section (l. 841, 992, etc.) → h3 par card (l. 898). Pas de skip-level visible.

9. **Form labels** : `src/components/ui/label.tsx` + forms (`QuoteRequestForm`, `InterventionRequestForm`) utilisent `<Label>` Radix UI accessible.

10. **Accordion accessible** : `src/components/ui/accordion.tsx` (Radix) → aria-expanded/aria-controls automatique. Utilisé en home FAQ l. 1234-1241.

11. **Contraste terracotta/ivoire** : `lighthouserc.json:62` audit color-contrast en WARN (passe à 1 mais en mode non-bloquant). Charte couleurs documentée (memory + Header.tsx data-tone="terracotta").

## P0 bloquants prod

- **Aucun**.

## P1 importants

- `AuthorByline.tsx:49` utilise `<img>` HTML brut au lieu de `<Image>` — fix simple, à vérifier raison (probablement avatar dynamique runtime).
- `lighthouserc.json:62-63` : `color-contrast` et `deprecations` audits passés en WARN (non error) — gate non strict. Doctrine memory dit Sprint A11y dédié follow-up P1.
- `target-size` audit WARN ligne 78 confirmé : touch targets < 48px sur nav mobile/footer.
- `label-content-name-mismatch` WARN ligne 61 : potentiels labels visuels ≠ accessible name.

## P2 polish

- Pas de `<dialog>` natif détecté → utilise Radix Dialog/Sheet (acceptable).
- LocaleSwitcher accessible mais à valider focus-trap mobile.
- `dir="ltr"` codé en dur ligne 202 — OK pour fr/en mais bloque future RTL si ar/he ajouté.

## Verdict

Bonne base WCAG 2.1 AA : SkipToContent + lang dynamique + alt systématique + focus-visible + Radix UI accessible. Le pattern `<img>` est limité à 1 cas non bloquant. Les WARN dans LHCI confirment dette résiduelle ciblée (color-contrast / target-size / label-mismatch) — pas P0 mais à fixer avant cert AAA. Score 20/25 ; -5 pour les 4 WARN LHCI non gatés strict + AuthorByline img + absence de test axe-core automatisé visible dans le repo.
