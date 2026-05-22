# F-03 Mobile responsive
## Score : 19/25 — 🟡

## Findings (preuves)

1. **Limitation méthodologique** : audit AUDIT-ONLY (lecture code). Pas de tests Lighthouse mobile réels ; on score sur l’usage des classes responsive Tailwind + viewport meta + composant MobileNav dédié.

2. **Viewport SSOT** (`src/app/[locale]/layout.tsx:79-84`) : `width: "device-width", initialScale: 1, themeColor: "#c24a1b", colorScheme: "light"` (light-only). Correct mobile-first.

3. **MobileNav présent** (`src/components/nav/MobileNav.tsx`) : drawer dédié + Header.tsx l. 142-181 expose un drawer mobile « items principaux (5) + extras (6) + CTA réserver + badge prix » avec parité desktop.

4. **Header desktop / mobile responsive** (`src/components/nav/Header.tsx:74-83`) :
   - `h-20 ... lg:h-24` (height progressive)
   - `px-6 sm:px-8 lg:h-24 lg:gap-3 lg:px-12 xl:gap-4 xl:px-16` (padding fluid)
   - `hidden ... lg:flex` pour nav desktop + `lg:hidden` pour mobile burger (l. 143)
   - CTA central caché mobile : `hidden ... lg:inline-flex` (l. 116) — le CTA est dans le drawer pour le mobile (l. 158-172) ✅

5. **Footer responsive** : 5 occurrences sm/md/lg/xl dans Footer.tsx — grid columns/spacing scalables.

6. **Home (`src/app/[locale]/page.tsx`)** : usage massif de `sm:`/`lg:`/`xl:` :
   - Hero hidden lg : `hero-schema pointer-events-none hidden lg:block` (l. 266) — l’illustration SVG decorative est masquée en mobile (économie LCP).
   - `lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]` (l. 222)
   - Sections poursuivent `py-20 sm:py-24 lg:py-28` pattern fluid.

7. **Display editorial responsive** : `text-[clamp(2.5rem,5.5vw,5rem)]` (h1 home l. 841) → fluid typography, pas de breakpoint hard.

8. **MobileStickyCta** présent (`src/components/marketing/StickyMobileCta.tsx`) — pattern UX mobile-first.

9. **A11y mobile** : aria-label sur boutons Header (l. 80-81, 113-114) + focus-visible:ring-* partout.

10. **`/reserver` exception responsive** : ADR documente `INP ≤ 150 ms, First Load ≤ 110 KB gz` (BookingCalendar lourd). Calendrier responsive grid.

## P0 bloquants prod
- **Aucun**.

## P1 importants
- **Pas de test e2e mobile** : `playwright.config.ts` existe mais aucune assertion de breakpoint < 640 px confirmée (lecture rapide → à vérifier en F-04 ou via run).
- `lighthouserc.json:27` cible « desktop » ET « mobile » preset → mais assertions LCP/CLS sont uniformes (pas de seuil mobile-spécifique différencié).
- L’illustration SVG hero (~554 lignes SVG inline dans `[locale]/page.tsx`) reste dans le DOM même cachée `hidden lg:block` → cost parse HTML mobile non nul (~10 KB compressé). À profiler.

## P2 polish
- `target-size` audit Lighthouse passé en WARN dans `lighthouserc.json:78` — confirme que certains touch targets < 48px sur nav mobile/footer.
- `Footer.tsx` : `topRegions = getTopRegionsByPib(6)` → footer dense en mobile (5+ groupes liens).

## Verdict
Architecture responsive solide : MobileNav dédié, viewport SSOT correct, Tailwind responsive classes utilisées partout, fluid typography clamp() systématique, StickyMobileCta présent. Limitation : pas de vérification visuelle réelle Lighthouse mobile en environnement d’audit. Le `target-size` WARN dans LHCI confirme dette tactile résiduelle. Score 19/25 ; -6 pour absence d’assertion mobile dans LHCI gate strict + parsing SVG hero mobile (caché mais pas removed).
