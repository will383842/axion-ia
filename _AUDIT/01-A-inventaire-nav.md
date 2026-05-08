# Agent A — Inventaire interne navigation AxionIA (état HEAD)

> Date : 2026-05-07
> HEAD : `a726ca9` (sha complet : `a726ca9ad8d1b91a357c2ed1322fd1d7bd4ebc2a`)
> Working tree non commité signalé : **oui** (3 fichiers modifiés + 2 non-trackés, tous liés à la refonte `/stack-ia` — voir §12)
> Périmètre : sous-repo `axionia/` (Next.js 16 + next-intl + Tailwind v4)
> Méthodologie : tous les extraits proviennent de `git show HEAD:<path>` (pas du working tree). Lecture seule strict.

---

## 1. Snapshot `Header.tsx`

**Path** : `axionia/src/components/nav/Header.tsx`
**Type** : Server Component (pas de `"use client"`)
**Volume** : 119 lignes

### Extrait line-numbered

```tsx
  1: import { getTranslations } from "next-intl/server";
  2: import { ArrowRight } from "lucide-react";
  3: import { Link } from "@/i18n/navigation";
  4: import { LocaleSwitcher } from "./LocaleSwitcher";
  5: import { MobileNav } from "./MobileNav";
  6: import { NavLink } from "./NavLink";
  7:
  8: // Server Component. 5 items, ZERO dropdown (CLAUDE.md v6 §9.2).
  9: // Editorial doctrine v3 — fond `bg-terracotta` constant (figé, pas de
 10: // transition au scroll). Layout balanced :
 11: // [Logo badge] [Nav 1, 2]    [CTA centré]    [Nav 3, 4] [Locale]
 12: export async function Header() {
 13:   const t = await getTranslations();
 14:
 15:   // Nav items split — 2 gauche du CTA, 2 droite du CTA.
 16:   const navLeft = [
 17:     { href: "/interventions", label: t("nav.interventions") },
 18:     { href: "/audit", label: t("nav.audit") },
 19:   ];
 20:   const navRight = [
 21:     { href: "/implementation", label: t("nav.implementation") },
 22:     { href: "/cas-concrets", label: t("nav.caseStudies") },
 23:   ];
 24:   const navAll = [...navLeft, ...navRight];
 25:
 26:   return (
 27:     <header
 28:       data-tone="terracotta"
 29:       className="bg-terracotta border-terracotta-deep text-mocha-fg supports-[backdrop-filter]:bg-terracotta/95 sticky top-0 z-40 border-b backdrop-blur-md"
 30:     >
 31:       {/* Hairline mocha sous le header pour signature subtile */}
 32:       <span
 33:         aria-hidden="true"
 34:         className="bg-mocha/30 pointer-events-none absolute inset-x-0 bottom-0 block h-px"
 35:       />
 36:       {/* Layout pleine largeur : Logo + Nav split + CTA centré + Locale */}
 37:       <div className="relative flex h-20 w-full items-center gap-4 px-6 sm:px-8 lg:h-24 lg:gap-3 lg:px-12 xl:gap-4 xl:px-16">
 38:         {/* GAUCHE : Logo (avec bulle ivoire pour ressortir) + Nav 1+2 */}
 39:         <div className="flex flex-1 items-center justify-between gap-6 lg:gap-8">
 40:           {/* Logo dans badge ivoire — fait ressortir "Axion-IA" sur fond terracotta. */}
 41:           <Link
 42:             href="/"
 43:             aria-label="AxionIA"
 44:             className="bg-paper text-fg shadow-subtle focus-visible:ring-mocha focus-visible:ring-offset-terracotta hover:shadow-card inline-flex shrink-0 items-center gap-1 rounded-xl px-4 py-2 transition-shadow focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
 45:           >
 46:             <span
 47:               className="text-2xl leading-none font-medium tracking-tight"
 48:               style={{ fontFamily: "var(--font-serif)" }}
 49:             >
 50:               Axion
 51:               <span aria-hidden="true" className="text-fg/70 mx-0.5">
 52:                 -
 53:               </span>
 54:               <span className="text-terracotta italic" style={{ fontFamily: "var(--font-serif)" }}>
 55:                 IA
 56:               </span>
 57:             </span>
 58:           </Link>
 59:
 60:           {/* Desktop nav — 2 premiers items, poussés à droite (près du CTA) */}
 61:           <nav
 62:             aria-label={t("nav.home")}
 63:             className="hidden items-center gap-6 lg:flex lg:justify-end xl:gap-8"
 64:           >
 65:             {navLeft.map((item) => (
 66:               <NavLink key={item.href} href={item.href} label={item.label} />
 67:             ))}
 68:           </nav>
 69:         </div>
 70:
 71:         {/* CENTRE : CTA pill bleu primary saillant */}
 72:         <Link
 73:           href="/reserver"
 74:           className="bg-primary text-primary-fg cta-lift hover:bg-primary-hover focus-visible:ring-mocha-fg focus-visible:ring-offset-terracotta ring-mocha-fg/30 hover:ring-mocha-fg/60 hidden h-12 shrink-0 items-center gap-2 rounded-full px-6 text-sm font-bold shadow-[0_8px_24px_-8px_rgba(26,77,217,0.6)] ring-2 ring-offset-0 transition-shadow hover:shadow-[0_12px_32px_-8px_rgba(26,77,217,0.7)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none lg:inline-flex"
 75:         >
 76:           {t("cta.bookInterventionLong")}
 77:           <ArrowRight className="h-4 w-4" aria-hidden="true" />
 78:         </Link>
 79:
 80:         {/* DROITE : Nav 3+4 + Locale */}
 81:         <div className="hidden flex-1 items-center justify-between gap-6 lg:flex lg:gap-8">
 82:           <nav
 83:             aria-label={`${t("nav.home")} 2`}
 84:             className="hidden items-center gap-6 lg:flex lg:justify-start xl:gap-8"
 85:           >
 86:             {navRight.map((item) => (
 87:               <NavLink key={item.href} href={item.href} label={item.label} />
 88:             ))}
 89:           </nav>
 90:           <LocaleSwitcher />
 91:         </div>
 92:
 93:         {/* Mobile drawer trigger (mobile only) */}
 94:         <div className="ml-auto lg:hidden">
 95:           <MobileNav>
 96:             <nav aria-label={t("nav.home")} className="flex flex-col gap-1 text-base">
 97:               {navAll.map((item) => (
 98:                 <NavLink key={item.href} href={item.href} label={item.label} variant="mobile" />
 99:               ))}
100:               <Link
101:                 href="/reserver"
102:                 className="bg-terracotta text-mocha-fg mt-4 flex items-center justify-center gap-2 rounded-full px-5 py-3 text-base font-semibold"
103:               >
104:                 {t("cta.bookInterventionLong")}
105:                 <ArrowRight className="h-4 w-4" aria-hidden="true" />
106:               </Link>
107:               <div className="border-border mt-6 flex items-center justify-between border-t pt-4">
108:                 <span className="text-fg-muted text-xs tracking-[0.16em] uppercase">
109:                   {t("common.switchLanguage")}
110:                 </span>
111:                 <LocaleSwitcher />
112:               </div>
113:             </nav>
114:           </MobileNav>
115:         </div>
116:       </div>
117:     </header>
118:   );
119: }
```

### Diagnostic Chapitre 1 (Header desktop)

| Critère                                          | État HEAD                        | Constat factuel                                                                                                                                                                                                                                                                      |
| ------------------------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1.1** Sticky + fond figé terracotta            | ✅ Présent                       | Ligne 29 : `sticky top-0 z-40` + `bg-terracotta` constant. `data-tone="terracotta"` (ligne 28). Pas de transition au scroll (commentaire ligne 9).                                                                                                                                   |
| **1.2** Logo / branding                          | ✅ Présent dans **badge ivoire** | Lignes 41-58 : `Link href="/"` dans bloc `bg-paper` (ivoire) avec `Axion-IA` typo serif italique sur `IA`. Hauteur logo ≈ 40-48 px (px-4 py-2 + text-2xl). Pas de logo SVG monogramme — c'est du texte stylisé. **Divergence avec §9.1** qui prévoit un « logo monogramme 28-32px ». |
| **1.3** 5 items navigation                       | ⚠️ **4 items**, PAS 5            | Lignes 16-23 : navLeft (2) + navRight (2) = 4 items totaux. `/blog` est absent (déplacé en footer cf. §10.1 zone Ressources). §9.1 listait `/interventions, /audit, /implementation, /cas-concrets` = 4 explicitement. Le « 5 items » du commentaire ligne 8 est erroné/obsolète.    |
| **1.4** CTA central                              | ✅ Présent                       | Lignes 72-78 : pill bleu primary, href `/reserver`, label `t("cta.bookInterventionLong")`. **Divergence §9.3** : pas de badge prix « 490 € » accolé. Pas de tracking analytics `cta_central_click` visible. aria-label implicite = label.                                            |
| **1.5** LocaleSwitcher                           | ✅ Présent desktop               | Ligne 90 : intégré au bloc droite. Voir §2 pour détails.                                                                                                                                                                                                                             |
| **1.6** Hairline mocha sous header               | ✅ Présent                       | Lignes 32-35 : `bg-mocha/30 absolute inset-x-0 bottom-0 h-px`.                                                                                                                                                                                                                       |
| **1.7** Skip-to-content                          | ✅ Présent (au layout)           | Voir `axionia/src/app/[locale]/layout.tsx` ligne ~136 (`<SkipToContent />` avant header). Pas dans le Header lui-même.                                                                                                                                                               |
| **1.8** ZERO dropdown                            | ✅ Conforme §9.2                 | Aucun `Popover`, `DropdownMenu`, `HoverCard` importé. Liens directs uniquement. Voir §9 pour citation littérale.                                                                                                                                                                     |
| **1.9** Active link visuel                       | ✅ Géré dans `NavLink.tsx`       | Voir §2.NavLink — `aria-current="page"` + underline mocha-fg + italique.                                                                                                                                                                                                             |
| **1.10** Responsive desktop ≥1024 / mobile <1024 | ✅ Géré                          | Lignes 60-91 (`hidden lg:flex`) + ligne 94 (`lg:hidden` pour drawer trigger). Breakpoint `lg` = 1024 px (Tailwind v4 par défaut, à vérifier dans `globals.css`).                                                                                                                     |

**Findings clés Chapitre 1** :

- 4 items au lieu de 5 — décalage avec §9.1 (qui aussi liste 4 items en réalité ; le commentaire « 5 items » du code est trompeur).
- Logo = texte serif `Axion-IA` dans badge ivoire — pas le « monogramme 28-32px » prescrit par §9.1.
- CTA central manque le **badge prix « 490 € »** prescrit §9.3.
- Pas de tracking analytics `cta_central_click` prescrit §9.3.

---

## 2. Snapshot `MobileNav.tsx` + `NavLink.tsx` + `LocaleSwitcher.tsx`

### 2.1 `MobileNav.tsx`

**Path** : `axionia/src/components/nav/MobileNav.tsx`
**Type** : Client Component (`"use client"`)
**Volume** : 48 lignes

```tsx
 1: "use client";
 2: // use-client: Sheet (Radix Dialog) needs portals + focus trap + animation
 3: // states. Refactored from a custom div drawer per A11Y-003 / NAV-008
 4: // (focus trap absent + backdrop click no-op).
 5:
 6: import { useState } from "react";
 7: import { Menu } from "lucide-react";
 8: import { useTranslations } from "next-intl";
 9: import {
10:   Sheet,
11:   SheetContent,
12:   SheetTrigger,
13:   SheetTitle,
14:   SheetDescription,
15: } from "@/components/ui/sheet";
16:
17: interface MobileNavProps {
18:   children: React.ReactNode;
19: }
20:
21: // Mobile drawer = Radix Sheet (right-side). Inherits focus trap, Escape,
22: // click-outside dismissal, and reduced-motion compliance from Radix.
23: export function MobileNav({ children }: MobileNavProps) {
24:   const t = useTranslations("common");
25:   const [open, setOpen] = useState(false);
26:
27:   return (
28:     <Sheet open={open} onOpenChange={setOpen}>
29:       <SheetTrigger asChild>
30:         <button
31:           type="button"
32:           aria-label={t("openMenu")}
33:           className="text-fg hover:bg-border/50 focus-visible:ring-primary inline-flex h-11 w-11 items-center justify-center rounded-sm focus-visible:ring-2 focus-visible:outline-none lg:hidden"
34:         >
35:           <Menu className="h-5 w-5" aria-hidden="true" />
36:         </button>
37:       </SheetTrigger>
38:       <SheetContent side="right" className="w-full max-w-sm sm:max-w-sm">
39:         <SheetTitle className="sr-only">{t("openMenu")}</SheetTitle>
40:         <SheetDescription className="sr-only">AxionIA navigation</SheetDescription>
41:         <div className="-m-6 flex h-full flex-col overflow-y-auto p-6">
42:           <span className="text-fg mb-6 text-sm font-semibold tracking-tight">AxionIA</span>
43:           {children}
44:         </div>
45:       </SheetContent>
46:     </Sheet>
47:     );
48: }
```

### 2.2 `NavLink.tsx`

**Path** : `axionia/src/components/nav/NavLink.tsx`
**Type** : Client Component
**Volume** : 54 lignes

```tsx
 1: "use client";
 2: // use-client: usePathname() needs the client runtime to read the active URL
 3: // and apply the `aria-current="page"` + visual underline.
 4:
 5: import { usePathname } from "@/i18n/navigation";
 6: import { Link } from "@/i18n/navigation";
 7: import { cn } from "@/lib/utils";
 8:
 9: interface NavLinkProps {
10:   href: string;
11:   label: string;
12:   variant?: "desktop" | "mobile";
13: }
14:
15: // Editorial v3 — desktop on terracotta header (fixe, pas de scroll-aware) :
16: // italique mocha sur item actif, underline animée mocha-fg.
17: // Mobile (drawer ivoire): bg sand sur item actif.
18: export function NavLink({ href, label, variant = "desktop" }: NavLinkProps) {
19:   const pathname = usePathname();
20:   const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
21:
22:   if (variant === "mobile") {
23:     return (
24:       <Link
25:         href={href as never}
26:         aria-current={isActive ? "page" : undefined}
27:         className={cn(
28:           "text-fg -mx-3 rounded-md px-3 py-3 font-medium",
29:           isActive ? "bg-sand text-terracotta italic" : "hover:bg-sand/60",
30:         )}
31:       >
32:         {label}
33:       </Link>
34:     );
35:   }
36:
37:   return (
38:     <Link
39:       href={href as never}
40:       aria-current={isActive ? "page" : undefined}
41:       className={cn(
42:         "relative text-[17px] font-semibold tracking-tight transition-colors",
43:         "after:absolute after:-bottom-1.5 after:left-0 after:h-0.5 after:transition-all after:duration-300",
44:         "[[data-tone=terracotta]_&]:after:bg-mocha-fg",
45:         isActive
46:           ? "text-mocha italic after:w-full"
47:           : "text-mocha-fg hover:text-mocha [[data-tone=terracotta]_&]:after:w-0 [[data-tone=terracotta]_&]:hover:after:w-full",
48:       )}
49:     >
50:       {label}
51:     </Link>
52:   );
53: }
```

### 2.3 `LocaleSwitcher.tsx`

**Path** : `axionia/src/components/nav/LocaleSwitcher.tsx`
**Type** : Client Component
**Volume** : 61 lignes

```tsx
 1: "use client";
 2: // use-client: `usePathname()` from next-intl needs the client runtime to
 3: // know which page is currently displayed (so we can preserve it when
 4: // the user toggles language).
 5:
 6: import { Link, usePathname } from "@/i18n/navigation";
 7: import { useLocale, useTranslations } from "next-intl";
 8: import { useParams } from "next/navigation";
 9: import { routing } from "@/i18n/routing";
10: import { cn } from "@/lib/utils";
11:
12: // Editorial v3 — pill style mocha-aware. Auto-adapte aux conteneurs sombres
13: // via descendant selectors `[data-tone='dark']`. Active = bg ivoire + text mocha
14: // pour gros contraste, inactive = ivoire/60 hover ivoire.
15: //
16: // Comportement : le toggle FR/EN garde l'utilisateur sur la même page, en
17: // traduisant le pathname (ex `/fr/interventions/essentielle` ↔
18: // `/en/interventions/essential`). next-intl utilise les `pathnames` typés de
19: // `routing.ts` pour la traduction. Pour les routes dynamiques (`[slug]`),
20: // `useParams` fournit les valeurs courantes au Link.
21: export function LocaleSwitcher() {
22:   const current = useLocale();
23:   const pathname = usePathname();
24:   const params = useParams();
25:   const t = useTranslations("common");
26:
27:   return (
28:     <nav
29:       aria-label={t("switchLanguage")}
30:       className={cn(
31:         "border-border inline-flex items-center gap-0.5 rounded-full border p-0.5",
32:         "[[data-tone=dark]_&]:border-border-on-mocha",
33:         "[[data-tone=terracotta]_&]:border-mocha/30",
34:       )}
35:     >
36:       {routing.locales.map((locale) => {
37:         const active = locale === current;
38:         return (
39:           <Link
40:             key={locale}
41:             href={{ pathname, params } as never}
42:             locale={locale}
43:             aria-current={active ? "true" : undefined}
44:             className={cn(
45:               "rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.12em] uppercase transition",
46:               active
47:                 ? "bg-sand text-fg [[data-tone=dark]_&]:bg-mocha-fg [[data-tone=dark]_&]:text-mocha [[data-tone=terracotta]_&]:bg-mocha-fg [[data-tone=terracotta]_&]:text-terracotta"
48:                 : "text-fg-muted hover:text-fg [[data-tone=dark]_&]:text-mocha-fg/70 [[data-tone=dark]_&]:hover:text-mocha-fg [[data-tone=terracotta]_&]:text-mocha-fg/75 [[data-tone=terracotta]_&]:hover:text-mocha-fg",
48:             )}
49:           >
50:             {locale}
51:           </Link>
52:         );
53:       })}
53:       })}
54:     </nav>
55:   );
56: }
```

### Diagnostic Chapitre 7 (Mobile Navigation)

| Critère                                         | État HEAD                      | Constat factuel                                                                                                                                                                                                                                                                         |
| ----------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **7.1** Drawer slide-in droite                  | ✅ Présent                     | `MobileNav.tsx:38` `<SheetContent side="right" className="w-full max-w-sm sm:max-w-sm">` — largeur max 384px (`max-w-sm`), entre 280-320px §9.4 → **plus large que prescrit**.                                                                                                          |
| **7.2** Trigger burger                          | ✅ Présent                     | `MobileNav.tsx:30-36` button 44×44 px (`h-11 w-11`), `aria-label={t("openMenu")}` = « Ouvrir le menu », icône `Menu` lucide aria-hidden. Conforme tactile §9.4.                                                                                                                         |
| **7.3** Focus trap + Escape + backdrop dismiss  | ✅ Hérité Radix Sheet          | Commentaire ligne 21 : « Inherits focus trap, Escape, click-outside dismissal, and reduced-motion compliance from Radix ». Refacto post-A11Y-003 / NAV-008.                                                                                                                             |
| **7.4** SheetTitle + SheetDescription pour a11y | ✅ Présents                    | Lignes 39-40, sr-only. SheetTitle = label « Ouvrir le menu » (réutilisé du trigger, perfectible).                                                                                                                                                                                       |
| **7.5** Liste verticale items                   | ✅ Géré par `Header.tsx:96-98` | Le drawer reçoit `navAll` (4 items navLeft+navRight) en `variant="mobile"`. **Divergence §9.4** qui prescrit 9 items (Interventions, Audit, Implementation, Cas concrets, Blog, FAQ, Centre d'aide, À propos, Contact) — donc Blog/FAQ/Centre-aide/À-propos/Contact MANQUENT du drawer. |
| **7.6** Active state mobile                     | ✅ Présent                     | `NavLink.tsx:29` `bg-sand text-terracotta italic` quand actif.                                                                                                                                                                                                                          |
| **7.7** CTA bas du drawer                       | ✅ Présent                     | `Header.tsx:100-106` : pill `bg-terracotta` `/reserver`. **Divergence §9.4** : pas de prix « 490 € » dans le label CTA mobile.                                                                                                                                                          |
| **7.8** LocaleSwitcher dans drawer              | ✅ Présent                     | `Header.tsx:107-112` séparation mocha-bordure top, label « Changer de langue » + switcher.                                                                                                                                                                                              |
| **7.9** Coordonnées contact discrètes en bas    | ❌ Absent                      | §9.4 dernière puce prescrit « Coordonnées de contact discrètes en bas » — non implémenté.                                                                                                                                                                                               |
| **7.10** CTA bar permanente niveau 2 (mobile)   | ❌ Absent                      | §9.4 prescrit « Niveau 2 : [Intervention en entreprise] [Réserver · 490 € →] » sticky toujours visible — header actuel a UN seul niveau (h-20 = 80px) sur mobile sans CTA bar permanente.                                                                                               |

---

## 3. Snapshot `Footer.tsx`

**Path** : `axionia/src/components/nav/Footer.tsx`
**Type** : Server Component (`async function Footer()`)
**Volume HEAD** : 238 lignes
**Working tree** : `+1 ligne` (signalé §12 — non analysé ici)

### Extrait line-numbered (HEAD)

```tsx
  1: import { getLocale, getTranslations } from "next-intl/server";
  2: import { Link } from "@/i18n/navigation";
  3: import { LocaleSwitcher } from "./LocaleSwitcher";
  4:
  5: // 2026 reference: Linear / Anthropic / Stripe / Vercel — single dense row,
  6: // no separate newsletter band, slim one-line bottom strip. Flex+grid combo
  7: // (brand fixed-width left, 4 link cols flex-1 grid right) — avoids the
  8: // `grid-cols-12` JIT pitfall when `--breakpoint-sm` isn't defined.
  9: export async function Footer() {
 10:   const t = await getTranslations();
 11:   const locale = await getLocale();
 12:   const isFr = locale === "fr";
 13:   const year = new Date().getFullYear();
 14:
 15:   const services = [
 16:     {
 17:       href: "/interventions/essentielle",
 18:       label: isFr ? "Essentielle · 490 €" : "Essential · €490",
 19:     },
 20:     { href: "/interventions", label: t("nav.interventions") },
 21:     { href: "/audit", label: t("nav.audit") },
 22:     { href: "/implementation", label: t("nav.implementation") },
 23:   ];
 24:   const resources = [
 25:     { href: "/blog", label: t("nav.blog") },
 26:     { href: "/cas-concrets", label: t("nav.caseStudies") },
 27:     { href: "/faq", label: "FAQ" },
 28:     { href: "/centre-aide", label: isFr ? "Centre d'aide" : "Help center" },
 29:   ];
 30:   const company = [
 31:     { href: "/a-propos", label: t("nav.about") },
 32:     { href: "/contact", label: t("nav.contact") },
 33:     { href: "/roi", label: isFr ? "Simulateur ROI" : "ROI simulator" },
 34:     { href: "/presse", label: isFr ? "Presse" : "Press" },
 35:   ];
 36:   const legal = [
 37:     { href: "/mentions-legales", label: isFr ? "Mentions légales" : "Legal notice" },
 38:     { href: "/conditions-generales", label: isFr ? "CGV" : "Terms" },
 39:     { href: "/politique-confidentialite", label: isFr ? "Confidentialité" : "Privacy" },
 40:     { href: "/cookies", label: "Cookies" },
 41:   ];
 42:
 43:   return (
 44:     <footer
 45:       data-tone="dark"
 46:       className="bg-mocha-rich text-mocha-fg relative isolate overflow-hidden"
 47:     >
 48:       <span aria-hidden="true" className="bg-terracotta/40 ... h-px" />
 49:       <div className="px-6 py-10 md:px-8 lg:px-12 lg:py-12 xl:px-16">
 50:         <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-16 xl:gap-20">
 51:           {/* Brand column */}
 52:           <div className="lg:w-64 lg:shrink-0">
 53:             <Link href="/" aria-label="AxionIA" ...>
 54:               <span ... font-serif >Axion<span>-</span><span italic>IA</span></span>
 55:             </Link>
 56:             <p className="text-mocha-fg/85 max-w-xs text-sm leading-snug" font-serif>
 57:               {isFr ? "Le cabinet IA qui vous fait gagner." : "The AI consultancy that makes you win."}
 58:             </p>
 59:             <div className="mt-5"><SocialLinks /></div>
 60:           </div>
 61:           {/* 4 link columns */}
 62:           <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4 md:gap-x-8 lg:gap-y-0">
 63:             <FooterColumn title={t("footer.services")} items={services} />
 64:             <FooterColumn title={t("footer.resources")} items={resources} />
 65:             <FooterColumn title={t("footer.company")} items={company} />
 66:             <FooterColumn title={t("footer.legal")} items={legal} />
 67:           </div>
 68:         </div>
 69:         {/* Slim bottom strip */}
 70:         <div className="border-border-on-mocha text-mocha-fg/65 mt-10 flex flex-col gap-3 border-t pt-5 text-xs lg:mt-12 lg:flex-row lg:items-center lg:justify-between">
 71:           <div>© {year} AxionIA OÜ · Hébergé en UE · RGPD</div>
 72:           <div>
 73:             <a href="/sitemap.xml">{t("footer.siteMap")}</a>
 74:             <Link href="/rgpd">RGPD</Link>
 75:             <LocaleSwitcher />
 76:           </div>
 77:         </div>
 78:       </div>
 79:     </footer>
 80:   );
 81: }
```

(Sous-composants `Dot`, `FooterColumn`, `LinkedinIcon`, `FacebookIcon`, `SocialLinks` aux lignes 82-238 — résumé : 4 colonnes simples, 2 réseaux sociaux LinkedIn + Facebook, pas de YouTube/X.)

### Diagnostic Chapitre 8 (Footer)

| Critère                                                   | État HEAD            | Constat factuel                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **8.1** Background sombre `bg-mocha-rich`                 | ✅ Conforme          | Ligne 46. `data-tone="dark"` enclenche les variants des sous-composants.                                                                                                                                                                                                                                                                                                                                   |
| **8.2** Hairline terracotta haut                          | ✅ Présent           | Ligne 48 `bg-terracotta/40 ... h-px`.                                                                                                                                                                                                                                                                                                                                                                      |
| **8.3** Brand column gauche                               | ✅ Présent           | Lignes 52-60 : logo serif + tagline serif + SocialLinks. **Divergence §10.1 zone 1** : pas de newsletter signup intégré (commentaire ligne 6 « no separate newsletter band » — choix éditorial 2026 assumé).                                                                                                                                                                                               |
| **8.4** 4 colonnes Services / Resources / Company / Legal | ⚠️ Partiel           | Lignes 15-41 : 4 listes correctes mais §10.1 prescrit **5 zones** (Identité + Services + Ressources + Entreprise + Légal). Le footer rassemble Identité dans la « brand column » + 4 colonnes = équivalent fonctionnel mais **manque le « Guide IA gratuit »** dans Resources, **manque « Partenaires » et « Carrières »** dans Entreprise, **manque « RGPD »** dans Legal (présent dans le bottom strip). |
| **8.5** Liens Services                                    | ⚠️ Partiel           | Manque « IA Custom » prescrit §10.1 zone 2.                                                                                                                                                                                                                                                                                                                                                                |
| **8.6** Liens Ressources                                  | ⚠️ Partiel           | Manque « Guide IA gratuit » prescrit §10.1 zone 3.                                                                                                                                                                                                                                                                                                                                                         |
| **8.7** Liens Entreprise                                  | ⚠️ Partiel           | A `/roi` (non prescrit) et manque `/partenaires` et `/carrieres` (prescrits §10.1 zone 4). `/presse` présent (ok).                                                                                                                                                                                                                                                                                         |
| **8.8** Liens Légal                                       | ⚠️ Partiel           | Manque RGPD dans la liste (mais lien RGPD présent dans bottom strip ligne 74).                                                                                                                                                                                                                                                                                                                             |
| **8.9** Réseaux sociaux                                   | ⚠️ 2 sur 3 prescrits | LinkedIn + Facebook (lignes 211-220). §10.1 zone 1 prescrit **LinkedIn + YouTube + X**. Facebook substitue YouTube et X.                                                                                                                                                                                                                                                                                   |
| **8.10** Bandeau bas                                      | ⚠️ Partiel           | `© AxionIA OÜ · Hébergé en UE · RGPD` + sitemap.xml + lien `/rgpd` + LocaleSwitcher. **Manque** : numéro d'enregistrement OÜ, TVA EE, email/téléphone, lien `/accessibilite` (prescrits §10.2).                                                                                                                                                                                                            |

---

## 4. Snapshot `Breadcrumbs.tsx` + coverage

**Path** : `axionia/src/components/nav/Breadcrumbs.tsx`
**Type** : Server Component (`async function Breadcrumbs`)
**Volume** : 63 lignes

```tsx
 1: import { getLocale, getTranslations } from "next-intl/server";
 2: import { Link } from "@/i18n/navigation";
 3:
 4: interface BreadcrumbItem {
 5:   href: string;
 6:   label: string;
 7: }
 8:
 9: interface BreadcrumbsProps {
10:   items: ReadonlyArray<BreadcrumbItem>;
11: }
12:
13: // Visible visually + Schema.org BreadcrumbList JSON-LD (axionia-seo-aeo).
14: // Caller passes the path tail (without home).
15: export async function Breadcrumbs({ items }: BreadcrumbsProps) {
16:   const t = await getTranslations("breadcrumb");
17:   const locale = await getLocale();
18:   const SITE_URL = process.env["NEXT_PUBLIC_SITE_URL"] ?? "https://axion-ia.com";
19:   const homeLabel = t("home");
20:
21:   const fullItems: ReadonlyArray<BreadcrumbItem> = [{ href: "/", label: homeLabel }, ...items];
22:
23:   const jsonLd = {
24:     "@context": "https://schema.org",
25:     "@type": "BreadcrumbList",
26:     itemListElement: fullItems.map((item, idx) => ({
27:       "@type": "ListItem",
28:       position: idx + 1,
29:       name: item.label,
30:       item: `${SITE_URL}/${locale}${item.href === "/" ? "" : item.href}`,
31:     })),
32:   } as const;
33:
34:   return (
35:     <>
36:       <nav aria-label="breadcrumb" className="text-xs text-gray-600">
37:         <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
38:           {fullItems.map((item, idx) => {
39:             const isLast = idx === fullItems.length - 1;
40:             return (
41:               <li key={`${item.href}-${idx}`} className="flex items-center gap-2">
42:                 {isLast ? (
43:                   <span aria-current="page" className="text-fg">
44:                     {item.label}
45:                   </span>
46:                 ) : (
47:                   <Link href={item.href as never} className="hover:text-fg">
48:                     {item.label}
49:                   </Link>
50:                 )}
51:                 {!isLast ? <span aria-hidden="true">/</span> : null}
52:               </li>
53:             );
54:           })}
55:         </ol>
56:       </nav>
57:       <script
58:         type="application/ld+json"
59:         dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
60:       />
61:     </>
62:   );
63: }
```

### Diagnostic Chapitre 9 (Breadcrumbs & maillage)

| Critère                                        | État HEAD              | Constat factuel                                                                                                                                                                             |
| ---------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **9.1** Composant existe                       | ✅                     | `nav/Breadcrumbs.tsx`, server component.                                                                                                                                                    |
| **9.2** JSON-LD `BreadcrumbList` Schema.org    | ✅                     | Lignes 23-32. URLs absolues `${SITE_URL}/${locale}${href}`.                                                                                                                                 |
| **9.3** `aria-label="breadcrumb"`              | ✅                     | Ligne 36.                                                                                                                                                                                   |
| **9.4** Auto-prefix « Accueil/Home »           | ✅                     | Ligne 21 : `[{href:"/", label:homeLabel}, ...items]`.                                                                                                                                       |
| **9.5** `aria-current="page"` sur dernier item | ✅                     | Ligne 43.                                                                                                                                                                                   |
| **9.6** Coverage actuel (où est-il rendu ?)    | ❓ À vérifier par grep | Les pages doivent l'inclure manuellement. **Pas de rendu auto au layout.tsx** (vérifié §8 ci-dessous). Coverage page-par-page n'est pas déterminable depuis ce composant seul.              |
| **9.7** Style visuel                           | ⚠️ Faible              | `text-xs text-gray-600` (ligne 36). Couleur arbitraire `gray-600` au lieu d'un token doctrinal (`text-fg-muted`/`text-fg-soft`). Séparateur `/` (ligne 51) au lieu de `›` ou `›` plus 2026. |

---

## 5. `messages/{fr,en}.json` — sections nav

**Path** : `axionia/src/messages/fr.json` et `axionia/src/messages/en.json` (note : sous `src/messages/`, pas `messages/` à la racine).

### 5.1 fr.json — sections pertinentes

```json
{
  "nav": {
    "home": "Accueil",
    "interventions": "Interventions entreprise",
    "audit": "Audit & optimisation",
    "implementation": "Implémentation IA",
    "caseStudies": "Cas concrets",
    "blog": "Blog",
    "about": "À propos",
    "contact": "Contact"
  },
  "footer": {
    "identity": "Identité",
    "services": "Services",
    "resources": "Ressources",
    "company": "Entreprise",
    "legal": "Légal",
    "newsletter": "Newsletter mensuelle",
    "tagline": "Cabinet IA opérationnel",
    "rights": "Tous droits réservés",
    "siteMap": "Plan du site",
    "linkedin": "LinkedIn",
    "youtube": "YouTube",
    "x": "X (Twitter)"
  },
  "breadcrumb": { "home": "Accueil" },
  "common": {
    "skipToContent": "Aller au contenu",
    "openMenu": "Ouvrir le menu",
    "closeMenu": "Fermer le menu",
    "switchLanguage": "Changer de langue",
    "loading": "Chargement…"
  },
  "cta": {
    "bookIntervention": "Réserver une intervention",
    "bookInterventionLong": "Réserver une intervention en entreprise",
    "priceFrom": "à partir de"
  }
}
```

### 5.2 en.json — sections pertinentes

```json
{
  "nav": {
    "home": "Home",
    "interventions": "Corporate AI sessions",
    "audit": "Audit & optimization",
    "implementation": "AI implementation",
    "caseStudies": "Case studies",
    "blog": "Blog",
    "about": "About",
    "contact": "Contact"
  },
  "footer": {
    "identity": "Identity",
    "services": "Services",
    "resources": "Resources",
    "company": "Company",
    "legal": "Legal",
    "newsletter": "Monthly newsletter",
    "tagline": "Operational AI consultancy",
    "rights": "All rights reserved",
    "siteMap": "Sitemap",
    "linkedin": "LinkedIn",
    "youtube": "YouTube",
    "x": "X (Twitter)"
  },
  "breadcrumb": { "home": "Home" },
  "common": {
    "skipToContent": "Skip to content",
    "openMenu": "Open menu",
    "closeMenu": "Close menu",
    "switchLanguage": "Switch language",
    "loading": "Loading…"
  },
  "cta": {
    "bookIntervention": "Book a session",
    "bookInterventionLong": "Book an on-site AI session",
    "priceFrom": "from"
  }
}
```

### Constats messages

- `nav.blog` existe (« Blog ») mais le Header n'utilise QUE 4 items (interventions, audit, implementation, caseStudies). `nav.blog`, `nav.about`, `nav.contact` sont consommés par le Footer.
- `footer.youtube` et `footer.x` existent comme libellés, mais `Footer.tsx` n'instancie que LinkedIn + Facebook.
- `cta.bookIntervention` (court) n'est jamais utilisé dans Header/MobileNav (c'est `bookInterventionLong` partout).
- Pas de clé `cta.priceBadge`/`cta.priceTag` pour le « 490 € » prescrit §9.3.

---

## 6. `routing.pathnames` — slugs FR↔EN

**Path** : `axionia/src/i18n/routing.ts` (140 lignes)
**Helpers** : `axionia/src/i18n/navigation.ts` (6 lignes) — re-exporte `Link, redirect, usePathname, useRouter, getPathname` via `createNavigation(routing)`.

### Liste exhaustive des entrées `pathnames` (groupées par bloc du fichier)

**Dev shells** :

- `/` → `/`
- `/design` → `/design`
- `/components` → `/components`
- `/sections` → `/sections`

**Module 1 — Interventions entreprise** :

- `/interventions` → fr `/interventions` / en `/interventions`
- `/interventions/essentielle` → fr `/interventions/essentielle` / en `/interventions/essential`
- `/interventions/equipes` → fr `/interventions/equipes` / en `/interventions/teams`
- `/interventions/managers` → fr `/interventions/managers` / en `/interventions/managers`
- `/interventions/conference` → fr `/interventions/conference` / en `/interventions/conference`
- `/interventions/dirigeants` → fr `/interventions/dirigeants` / en `/interventions/executives`

**Module 2 — Audit (pyramide 4 niveaux)** :

- `/audit` → fr `/audit` / en `/audit`
- `/audit/flash` → fr `/audit/flash` / en `/audit/flash`
- `/audit/process` → fr `/audit/process` / en `/audit/process`
- `/audit/strategique-pme` → fr `/audit/strategique-pme` / en `/audit/strategic-pme`
- `/audit/strategique-eti` → fr `/audit/strategique-eti` / en `/audit/strategic-eti`
- `/audit/demande` → fr `/audit/demande` / en `/audit/request`

**Module 3 — Implémentation IA** :

- `/implementation` → fr `/implementation` / en `/implementation`
- `/implementation/ia-custom` → fr `/implementation/ia-custom` / en `/implementation/custom-ai`
- `/implementation/chatbot` → `/implementation/chatbot`
- `/implementation/processus` → fr `/implementation/processus` / en `/implementation/processes`
- `/implementation/structuration` → fr `/implementation/structuration` / en `/implementation/structuring`
- `/implementation/crm-erp` → `/implementation/crm-erp`
- `/implementation/documents` → `/implementation/documents`
- `/implementation/agents` → `/implementation/agents`
- `/implementation/integrations` → `/implementation/integrations`
- `/implementation/no-code` → `/implementation/no-code`
- `/implementation/par-fonction/[slug]` → fr `/implementation/par-fonction/[slug]` / en `/implementation/by-function/[slug]`
- `/implementation/par-techno` → fr `/implementation/par-techno` / en `/implementation/by-technology`

**Cas concrets** :

- `/cas-concrets` → fr `/cas-concrets` / en `/case-studies`
- `/cas-concrets/[slug]` → fr `/cas-concrets/[slug]` / en `/case-studies/[slug]`
- `/cas-concrets/secteur/[slug]` → fr `/cas-concrets/secteur/[slug]` / en `/case-studies/industry/[slug]`

**Transversales** :

- `/a-propos` → fr `/a-propos` / en `/about`
- `/contact` → fr `/contact` / en `/contact`
- `/presse` → fr `/presse` / en `/press`
- `/blog` → `/blog`
- `/blog/[slug]` → `/blog/[slug]`
- `/blog/categorie/[slug]` → fr `/blog/categorie/[slug]` / en `/blog/category/[slug]`
- `/blog/tag/[slug]` → `/blog/tag/[slug]`
- `/blog/auteur/[slug]` → fr `/blog/auteur/[slug]` / en `/blog/author/[slug]`
- `/faq` → `/faq`
- `/faq/[slug]` → `/faq/[slug]`
- `/centre-aide` → fr `/centre-aide` / en `/help`
- `/centre-aide/[slug]` → fr `/centre-aide/[slug]` / en `/help/[slug]`
- `/centre-aide/categorie/[slug]` → fr `/centre-aide/categorie/[slug]` / en `/help/category/[slug]`
- `/reserver` → fr `/reserver` / en `/book`
- `/roi` → `/roi`
- `/recherche` → fr `/recherche` / en `/search`
- `/guide-ia` → fr `/guide-ia` / en `/ai-guide`
- `/methodologie` → fr `/methodologie` / en `/methodology`
- `/stack-ia` → fr `/stack-ia` / en `/ai-stack`
- `/glossaire` → fr `/glossaire` / en `/glossary`
- `/comparaisons` → fr `/comparaisons` / en `/comparisons`
- `/comparaisons/[slug]` → fr `/comparaisons/[slug]` / en `/comparisons/[slug]`
- `/confirmation` → fr `/confirmation` / en `/confirmation`
- `/desabonnement` → fr `/desabonnement` / en `/unsubscribe`
- `/preferences-cookies` → fr `/preferences-cookies` / en `/cookie-preferences`
- `/mes-donnees` → fr `/mes-donnees` / en `/my-data`
- `/accessibilite` → fr `/accessibilite` / en `/accessibility`

**Légales** :

- `/mentions-legales` → fr `/mentions-legales` / en `/legal-notice`
- `/conditions-generales` → fr `/conditions-generales` / en `/terms`
- `/politique-confidentialite` → fr `/politique-confidentialite` / en `/privacy-policy`
- `/cookies` → `/cookies`
- `/rgpd` → `/rgpd`
- `/politique-deplacement` → fr `/politique-deplacement` / en `/travel-policy`

### Configuration locale

```ts
locales: ["fr", "en"];
defaultLocale: "fr";
localePrefix: "always";
```

### Constats routing

- 60 entrées au total (incluant les patterns `[slug]`).
- Toutes les pages `app/[locale]/<dir>/page.tsx` ont leur entrée dans `routing.pathnames`.
- Routes ne pointant PAS vers une présence header/footer actuelle : 38+ (toutes les sous-pages module 1/2/3, blog/categorie/tag/auteur, faq/[slug], centre-aide/[slug], comparaisons, transversales `roi`, `guide-ia`, `methodologie`, `stack-ia`, `glossaire`, `accessibilite`).
- `/recherche` ET `/search` typés et fonctionnels (page existe — voir §11).

---

## 7. `sitemap.ts` + `robots.ts`

### 7.1 `sitemap.ts` — extrait clé

**Path** : `axionia/src/app/sitemap.ts` (172 lignes)

```ts
type PathnameKey = keyof typeof routing.pathnames;

const EXCLUDED_FROM_INDEX: ReadonlyArray<PathnameKey> = [
  "/design",
  "/components",
  "/sections",
  "/desabonnement",
  "/mes-donnees",
  "/confirmation",
  "/recherche",
  "/preferences-cookies",
];

function isSlugTemplate(key: PathnameKey): boolean {
  return (key as string).includes("[slug]");
}

function localizedHref(key, locale) { /* lookup routing.pathnames[key][locale] */ }

function alternateLanguages(key) {
  return { fr, en, "x-default": fr };
}

interface DynamicSlug {
  fr: string;
  en?: string;
  slugs: ReadonlyArray<string>;
  changeFrequency: ...;
  priority: number;
}

function buildDynamic(entries, now): MetadataRoute.Sitemap {
  // émet 2 entrées par slug (fr + en) avec alternates.languages sur l'entrée FR
}

export default function sitemap(): MetadataRoute.Sitemap {
  // 1. Itère routing.pathnames, exclut EXCLUDED + isSlugTemplate
  // 2. Pour chaque (key, locale), émet une URL avec alternates
  //    priority: "/" → 1, top-level → 0.8, deeper → 0.6
  //    changeFrequency: "weekly"
  // 3. buildDynamic sur :
  //    - cas-concrets/[slug] (priority 0.6, monthly)
  //    - blog/[slug] (priority 0.5, monthly)
  //    - blog/categorie/[slug] (priority 0.5, monthly)
  //    - blog/tag/[slug] (priority 0.4, monthly)
  //    - blog/auteur/[slug] (priority 0.4, monthly)
  //    - faq/[slug] (priority 0.7, monthly)
  //    - centre-aide/[slug] (priority 0.6, monthly)
  //    - centre-aide/categorie/[slug] (priority 0.5, monthly)
  //    - cas-concrets/secteur/[slug] (priority 0.5, monthly)
  //    - comparaisons/[slug] (priority 0.5, monthly)
}
```

### 7.2 `robots.ts` — contenu intégral

**Path** : `axionia/src/app/robots.ts` (29 lignes)

```ts
 1: import type { MetadataRoute } from "next";
 2:
 3: const SITE_URL = process.env["NEXT_PUBLIC_SITE_URL"] ?? "https://axion-ia.com";
 4:
 5: export default function robots(): MetadataRoute.Robots {
 6:   return {
 7:     rules: [
 8:       {
 9:         userAgent: "*",
10:         allow: "/",
11:         disallow: [
12:           "/api/",
13:           "/_next/",
14:           "/design",
15:           "/fr/design",
16:           "/en/design",
17:           "/components",
18:           "/fr/components",
19:           "/en/components",
20:           "/sections",
21:           "/fr/sections",
22:           "/en/sections",
23:         ],
24:       },
25:     ],
26:     sitemap: `${SITE_URL}/sitemap.xml`,
27:     host: SITE_URL,
28:   };
29: }
```

### Diagnostic Chapitre 10 (SEO/AEO/GEO partiel)

| Critère                                   | État HEAD             | Constat factuel                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **10.1** sitemap.xml dynamique            | ✅ Présent            | `app/sitemap.ts` builder pattern `buildDynamic` réutilise `routing.pathnames` + collections de slugs (`getAllBlogSlugs`, `getAllFaqIds`, etc.).                                                                                                                                                                                                                                                                                                                                |
| **10.2** Exclusions index                 | ✅ Présent            | EXCLUDED_FROM_INDEX = 8 entrées (dev shells + privacy-sensitive).                                                                                                                                                                                                                                                                                                                                                                                                              |
| **10.3** alternates.languages hreflang    | ✅ Présent            | Pour entrées statiques : full `{fr, en, x-default}`. Pour dynamiques : seule l'entrée FR porte les alternates (l'EN n'a pas d'alternates → asymétrie potentielle).                                                                                                                                                                                                                                                                                                             |
| **10.4** robots.txt cohérent avec sitemap | ⚠️ Partiel            | Disallow couvre `/design /components /sections` (dev shells) mais **pas** `/desabonnement`, `/mes-donnees`, `/confirmation`, `/recherche`, `/preferences-cookies` qui sont exclus du sitemap. **Risque** : crawl toujours autorisé sur ces pages (cf. `<meta robots noindex>` ?). À vérifier sur les pages elles-mêmes. **Confirmation** : `/recherche` page.tsx ligne 31 : `robots: { index: false, follow: true }` → noindex via metadata. Idem à vérifier sur les 4 autres. |
| **10.5** Sitemap reference dans robots    | ✅ Présent            | Ligne 26 : `sitemap: ${SITE_URL}/sitemap.xml`.                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **10.6** `host` directive                 | ✅ Présent            | Ligne 27 (utile pour Yandex, ignoré ailleurs).                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **10.7** Pages régions/villes pSEO        | ❌ Non architecturées | Aucune entrée `pathnames` ni handler dans `sitemap.ts`. À architecturer (hors scope inventaire).                                                                                                                                                                                                                                                                                                                                                                               |
| **10.8** Sitemap index (multi-fichiers)   | ❌ Mono-fichier       | Un seul `sitemap()` → tout dans `sitemap.xml`. À ~3500 pages pSEO + dynamiques, il faudra splitter (limite ~50 000 URL/sitemap mais bonnes pratiques 2026 = sous-sitemaps thématiques).                                                                                                                                                                                                                                                                                        |

---

## 8. `layout.tsx` — Organization JSON-LD au layout-level

**Path** : `axionia/src/app/[locale]/layout.tsx` (172 lignes)

### Présence Organization JSON-LD : **OUI**

Extrait clé (lignes 95-115) :

```ts
 95: // JSON-LD: Organization + WebSite (axionia-seo-aeo).
 96: const organizationJsonLd = {
 97:   "@context": "https://schema.org",
 98:   "@type": "Organization",
 99:   name: "AxionIA",
100:   url: SITE_URL,
101:   legalName: "AxionIA OÜ",
102: } as const;
103: const websiteJsonLd = {
104:   "@context": "https://schema.org",
105:   "@type": "WebSite",
106:   name: "AxionIA",
107:   url: `${SITE_URL}/${locale}`,
108:   inLanguage: locale,
109:   potentialAction: {
110:     "@type": "SearchAction",
111:     target: `${SITE_URL}/${locale}/recherche?q={query}`,
112:     "query-input": "required name=query",
113:   },
114: } as const;
```

Émis en bas de `<body>` lignes 137-144 :

```tsx
137: <script
138:   type="application/ld+json"
139:   dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
140: />
141: <script
142:   type="application/ld+json"
143:   dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
144: />
```

### Speculation Rules présentes (production-only)

Lignes 145-170 : `<script type="speculationrules">` avec `prerender` (eagerness moderate) + `prefetch` (eagerness eager) sur `/${locale}/*`. **Activé uniquement en `NODE_ENV === "production"`** (commentaire mémoire utilisateur `axionia_perf_audit_2026-05-07.md` confirme : eager prefetch en dev saturait le serveur Turbopack).

### Diagnostic Chapitre 10 (suite — JSON-LD layout-level)

| Critère                                     | État HEAD  | Constat factuel                                                                                                                                                                                                                                          |
| ------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **10.9** Organization JSON-LD au layout     | ✅ Présent | Minimal (`name + url + legalName`). **Manque** : `logo`, `sameAs` (LinkedIn/Facebook), `address` (Tallinn OÜ), `vatID`, `taxID`, `email`, `telephone`. Le Footer mentionne « OÜ » mais l'entité n'est pas tracée dans le JSON-LD au-delà de `legalName`. |
| **10.10** WebSite + SearchAction            | ✅ Présent | `target: /${locale}/recherche?q={query}` cohérent avec page existante (§11).                                                                                                                                                                             |
| **10.11** ItemList ou SiteNavigationElement | ❌ Absent  | Pas de JSON-LD `SiteNavigationElement` ou `ItemList` listant les liens du Header/Footer. Bénéfice GEO 2026 manquant.                                                                                                                                     |
| **10.12** WebVitals tracking                | ✅ Présent | Ligne 132 `<WebVitals />` (composant analytics).                                                                                                                                                                                                         |
| **10.13** SkipToContent                     | ✅ Présent | Ligne 128 avant le NextIntlClientProvider.                                                                                                                                                                                                               |

---

## 9. CLAUDE.md §9.2 in extenso

**Source** : `C:\Users\willi\Documents\Projets\Axion-IA\AxionIA_Dossier_FINAL_ABSOLU_v10.1\CLAUDE.md`

> Note : le `CLAUDE.md` du sous-repo `axionia/` est un simple `@AGENTS.md` (1 ligne). La doctrine §9.x se trouve dans le dossier projet parent (v10.1 dossier final absolu).

### Section 9 complète (lignes 333-414, citation littérale)

> ## 9. HEADER — STRUCTURE DÉFINITIVE (épuré, mobile-first)
>
> 🎯 **Philosophie : épuré, moderne, expérience utilisateur exceptionnelle. Aucun nom de société affiché — uniquement un logo monogramme. Le CTA central est l'élément de conversion principal.**
>
> ### 9.1 Structure desktop (≥1024px)
>
> ```
> [Logo monogramme] [Interventions entreprise] [Audit & optimisation] [Implémentation IA] [Cas concrets] [CTA Réserver · 490 €] [FR · EN]
> ```
>
> | Élément                         | Détail                                                                                                     |
> | ------------------------------- | ---------------------------------------------------------------------------------------------------------- |
> | 1. Logo monogramme              | Carré de 28-32px avec initiale ou symbole · pas de texte de société · lien vers /                          |
> | 2. « Interventions entreprise » | Lien direct vers /interventions (pas de dropdown)                                                          |
> | 3. « Audit & optimisation »     | Lien direct vers /audit                                                                                    |
> | 4. « Implémentation IA »        | Lien direct vers /implementation                                                                           |
> | 5. « Cas concrets »             | Lien direct vers /cas-concrets                                                                             |
> | 6. CTA central                  | « Réserver une intervention » + badge prix « 490 € » + flèche → · redirige vers /interventions/essentielle |
> | 7. Sélecteur langue             | « FR · EN » discret à droite                                                                               |
>
> ### 9.2 Pourquoi pas de dropdowns
>
> Volonté d'épure : **un clic = une page**. Les sous-pages des modules sont accessibles depuis la page parent (qui les présente toutes). Avantages :
>
> - Header plus léger visuellement
> - UX plus rapide (pas de menu à survoler)
> - Mobile-friendly natif (pas de menus à reproduire en accordéon)
> - SEO meilleur : les pages parents reçoivent du jus de lien depuis le header
>
> ### 9.3 Le CTA central — règles précises
>
> - Texte exact FR : **« Réserver une intervention »**
> - Texte exact EN : **« Book a session »**
> - Badge prix accolé : **« 490 € »** (HT, dynamique depuis admin)
> - Icône flèche → discrète à droite
> - Style : bouton plein, couleur d'accent forte (la plus visible de la charte)
> - Action au clic : redirection vers `/[lang]/interventions/essentielle` (PAS une modal)
> - **Sticky** sur toutes les pages, à toutes les étapes du scroll
> - Hauteur : tactile sur mobile (min 44px), proportionné sur desktop
> - Tracking : événement analytics « cta_central_click »
> - aria-label explicite incluant le prix
>
> ### 9.4 Variante mobile (<1024px) — header en 2 niveaux
>
> ```
> Niveau 1 : [Logo monogramme] ............... [Burger ☰]
> Niveau 2 : [Intervention en entreprise] ... [Réserver · 490 € →]
> ```
>
> **Ligne 1** (56px de haut) :
>
> - Logo monogramme à gauche
> - Burger menu à droite
>
> **Ligne 2** (CTA bar, 48px de haut, fond légèrement teinté) :
>
> - Mention discrète à gauche : « Intervention en entreprise »
> - Bouton compact à droite : « Réserver · 490 € → »
> - Cette barre reste visible TOUJOURS pour garder le CTA accessible
>
> **Drawer mobile** (à l'ouverture du burger) :
>
> - Slide-in depuis la droite, 280-320px de large
> - Liste verticale propre :
>   - Interventions entreprise
>   - Audit & optimisation
>   - Implémentation IA
>   - Cas concrets
>   - Blog
>   - FAQ
>   - Centre d'aide
>   - À propos
>   - Contact
> - Sélecteur langue (FR · EN)
> - CTA gros en bas du drawer : « Réserver une intervention · 490 € »
> - Coordonnées de contact discrètes en bas
>
> ### 9.5 Comportements
>
> - Sticky toujours
> - Au repos : fond blanc/neutre, pas d'ombre
> - Au scroll : ombre subtile en bas (`box-shadow: 0 1px 3px rgba(0,0,0,0.04)`)
> - Indicateur visuel discret sur l'item de nav correspondant à la page active (point sous l'item, ou opacité changée)
> - Animations : 150ms ease-out pour tout
> - Skip-to-content link en premier (caché, visible au focus clavier)
> - Respecte `prefers-reduced-motion`

### Diagnostic Chapitre 2 (mega-menus / conflit doctrinal)

**Critère 2.1** — Conflit doctrinal §9.2 ↔ proposition mega-menus du prompt source.

§9.2 prescrit explicitement « pas de dropdowns » (un clic = une page). Le prompt audit `PROMPT-HEADER-NAVIGATION-2026.md` Chapitre 2 propose d'introduire des **mega-menus** au header pour exposer les sous-pages des modules (Module 1 = 5 sous-pages, Module 2 = 5 sous-pages, Module 3 = 9 sous-pages + par-fonction + par-techno). Conflit doctrinal réel.

**État actuel** : ZERO dropdown / ZERO mega-menu implémenté (vérifié §1). Conformité §9.2 = **stricte**.

**Note doctrinale 2026-05-07** (mémoire `axionia_design_pivot.md`) : la direction visuelle commitée HEAD (`941a8e1`+) confirme « Header terracotta figé » — donc on ne touche ni au fond ni au logo monogramme cible, mais la décision mega-menu/no-dropdown reste OUVERTE pour le synthétiseur (Agent C s'occupe du diagnostic doctrinal).

Critères 2.2-2.10 (architecture mega-menus) : **N/A pour l'inventaire interne** — c'est une cible architecturale, pas un état actuel.

---

## 10. Inventaire pages `app/[locale]/` (table)

**Total** : 32 dossiers (tous avec `page.tsx` au HEAD).
Notation Header : ✅ = présent dans navLeft+navRight (4 items) | ❌ = absent.
Notation Footer : ✅ = listé dans `Footer.tsx` (services/resources/company/legal) | bottom = bottom strip uniquement | ❌ = absent.
Indexable : `sitemap` = présent dans sitemap | `robots:noindex` = page emit metadata noindex (à vérifier individuellement). « ✅ » = sitemap présent ET non noindex à ma connaissance.

| Slug FR                      | Slug EN               | Header      | Footer       | Indexable                                                               | Catégorie             |
| ---------------------------- | --------------------- | ----------- | ------------ | ----------------------------------------------------------------------- | --------------------- |
| `/` (page.tsx racine)        | `/`                   | logo (lien) | logo (lien)  | ✅ priority 1                                                           | marketing             |
| `/a-propos`                  | `/about`              | ❌          | ✅ company   | ✅                                                                      | marketing             |
| `/accessibilite`             | `/accessibility`      | ❌          | ❌           | ✅                                                                      | utilitaire / a11y     |
| `/audit`                     | `/audit`              | ✅ navLeft  | ✅ services  | ✅                                                                      | produit               |
| `/blog`                      | `/blog`               | ❌          | ✅ resources | ✅                                                                      | marketing/contenu     |
| `/cas-concrets`              | `/case-studies`       | ✅ navRight | ✅ resources | ✅                                                                      | marketing             |
| `/centre-aide`               | `/help`               | ❌          | ✅ resources | ✅                                                                      | utilitaire/support    |
| `/comparaisons`              | `/comparisons`        | ❌          | ❌           | ✅                                                                      | marketing/SEO         |
| `/components`                | `/components`         | ❌          | ❌           | ❌ exclu sitemap+robots                                                 | dev shell             |
| `/conditions-generales`      | `/terms`              | ❌          | ✅ legal     | ✅                                                                      | légal                 |
| `/confirmation`              | `/confirmation`       | ❌          | ❌           | ❌ exclu sitemap (à vérifier robots/noindex)                            | utilitaire            |
| `/contact`                   | `/contact`            | ❌          | ✅ company   | ✅                                                                      | marketing             |
| `/cookies`                   | `/cookies`            | ❌          | ✅ legal     | ✅                                                                      | légal                 |
| `/desabonnement`             | `/unsubscribe`        | ❌          | ❌           | ❌ exclu sitemap                                                        | utilitaire/privacy    |
| `/design`                    | `/design`             | ❌          | ❌           | ❌ exclu sitemap+robots                                                 | dev shell             |
| `/faq`                       | `/faq`                | ❌          | ✅ resources | ✅                                                                      | utilitaire/support    |
| `/glossaire`                 | `/glossary`           | ❌          | ❌           | ✅                                                                      | marketing/SEO         |
| `/guide-ia`                  | `/ai-guide`           | ❌          | ❌           | ✅                                                                      | marketing/lead-magnet |
| `/implementation`            | `/implementation`     | ✅ navRight | ✅ services  | ✅                                                                      | produit               |
| `/interventions`             | `/interventions`      | ✅ navLeft  | ✅ services  | ✅                                                                      | produit               |
| `/mentions-legales`          | `/legal-notice`       | ❌          | ✅ legal     | ✅                                                                      | légal                 |
| `/mes-donnees`               | `/my-data`            | ❌          | ❌           | ❌ exclu sitemap                                                        | utilitaire/privacy    |
| `/methodologie`              | `/methodology`        | ❌          | ❌           | ✅                                                                      | marketing             |
| `/politique-confidentialite` | `/privacy-policy`     | ❌          | ✅ legal     | ✅                                                                      | légal/privacy         |
| `/politique-deplacement`     | `/travel-policy`      | ❌          | ❌           | ✅                                                                      | légal                 |
| `/preferences-cookies`       | `/cookie-preferences` | ❌          | ❌           | ❌ exclu sitemap                                                        | utilitaire/privacy    |
| `/presse`                    | `/press`              | ❌          | ✅ company   | ✅                                                                      | marketing             |
| `/recherche`                 | `/search`             | ❌          | ❌           | ❌ exclu sitemap + page emit `robots:{index:false}` (page.tsx ligne 31) | utilitaire            |
| `/reserver`                  | `/book`               | CTA pill    | ❌           | ✅                                                                      | marketing/conversion  |
| `/rgpd`                      | `/rgpd`               | ❌          | bottom strip | ✅                                                                      | légal/privacy         |
| `/roi`                       | `/roi`                | ❌          | ✅ company   | ✅                                                                      | marketing/calculateur |
| `/sections`                  | `/sections`           | ❌          | ❌           | ❌ exclu sitemap+robots                                                 | dev shell             |
| `/stack-ia`                  | `/ai-stack`           | ❌          | ❌           | ✅                                                                      | marketing/produit     |

### Constats inventaire pages

- **4 pages dans le Header** sur 32 dossiers réels (12.5 % de couverture). Le CTA `/reserver` n'est pas un item nav mais le pill central.
- **15 pages dans le Footer** (4 services + 4 resources + 4 company + 4 legal − overlaps). +1 dans bottom strip (`/rgpd`).
- **9 pages NON couvertes par Header NI Footer** (à part le footer minimal) : `/accessibilite`, `/comparaisons`, `/glossaire`, `/guide-ia`, `/methodologie`, `/politique-deplacement`, `/stack-ia` (la page IA stratégique !), plus les utilitaires privacy. **`/stack-ia` et `/guide-ia` sont des pages stratégiques marketing non liées depuis nav.**
- **Dev shells** (`/design`, `/components`, `/sections`) : exclus sitemap ET robots.
- **Privacy/utilitaires** (`/desabonnement`, `/mes-donnees`, `/confirmation`, `/recherche`, `/preferences-cookies`) : exclus sitemap mais **pas explicitement** dans robots.ts (à crawl autorisé). `/recherche` au moins emit metadata `robots: {index:false}`. À auditer pour les autres.

---

## 11. `/recherche` existante — analyse

**Path** : `axionia/src/app/[locale]/recherche/page.tsx` (~140 lignes lues)
**Type** : **SSR avec searchParams** (signature `Props = { params: Promise, searchParams: Promise<{q?: string}> }`).

### Mode de rendu

- **Pas de `generateStaticParams`** → la page n'est pas SSG.
- Reçoit `searchParams.q` et le re-injecte dans le `<input defaultValue={q}>` (ligne ~84).
- Affiche les résultats conditionnellement quand `q` est défini (lignes ~95-130 : pour l'instant placeholder « moteur Sprint 15 » + 4 liens vers blog/faq/glossaire/centre-aide).
- Form `<form action={`/${locale}/recherche`} method="GET">` → submit recharge la page avec `?q=...` côté serveur. **Pas d'API client-side**, pas de fetch JS.
- `generateMetadata` retourne `robots: { index: false, follow: true }` → **noindex** (la page n'est pas crawlable même si robots.txt l'autorise).

### JSON-LD émis

- `WebSite + SearchAction` au niveau de la page (en plus du WebSite déjà émis au layout — risque de **double WebSite JSON-LD**).
- `BreadcrumbList` via `buildBreadcrumbJsonLd`.

### Articulation possible avec ⌘K (Chapitre 6)

**Critère 6.3bis (palette ⌘K vers `/recherche`)** :

- ✅ La page existe, fonctionnelle en mode placeholder.
- ✅ Form GET → l'URL `/{locale}/recherche?q=<query>` est canonique et la palette ⌘K peut faire un `router.push('/recherche?q='+q)` après submit.
- ✅ `routing.pathnames["/recherche"]` est typé donc `Link.from('/recherche')` traduit FR↔EN.
- ⚠️ **Pas de moteur réel** : le commentaire dans la page dit « Sprint 15 wires Postgres FTS — engine under construction ». Donc une palette ⌘K peut soit :
  1. Rediriger vers `/recherche?q=...` (état HEAD viable) ;
  2. Faire de la recherche cliente full-text in-memory (sur les contenus typés `src/content/*.ts`) en attendant Sprint 15.
- ⚠️ Pas de raccourci clavier `Cmd+K`/`Ctrl+K` global existant (ni `KBar`, `cmdk`, ni `<Combobox>` global au layout). À architecturer.

---

## 12. Annexe — working tree non committé `/stack-ia`

État `git status --porcelain` à HEAD `a726ca9` :

```
 M src/app/[locale]/stack-ia/page.tsx           (+161 -119 vs HEAD selon diff --stat)
 M src/components/nav/Footer.tsx                (+1 ligne, modification mineure)
 M src/content/stack-ia.ts                      (+10 -? lignes)
?? src/components/sections/StackHeroSchema.tsx  (nouveau, non-tracké)
?? src/components/sections/ToolLogo.tsx         (nouveau, non-tracké)
```

**Total** : 3 fichiers modifiés, 2 fichiers non-trackés.
**Diff résumé** : 161 insertions, 119 suppressions sur 3 fichiers.

**Interprétation** (alignée avec `axionia_stack_ia_page.md` mémoire) : refonte de la page IA `/stack-ia` (FR) / `/ai-stack` (EN). Les composants `StackHeroSchema.tsx` (probablement ItemList JSON-LD pour la stack) et `ToolLogo.tsx` (probablement substitut monogramme aux logos vendor — cohérent avec doctrine « monogrammes pas logos » de la mémoire) sont nouveaux.

**Décision audit Agent A** : pris HEAD comme référence, comme demandé. La modif `Footer.tsx` (+1 ligne) est mineure et n'altère pas le diagnostic Chapitre 8.

---

## 13. Récap blocages / fichiers manquants

| Élément attendu                                 | Statut                                                                                                                                                                                           |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `axionia/src/components/nav/Header.tsx`         | ✅ lu HEAD                                                                                                                                                                                       |
| `axionia/src/components/nav/MobileNav.tsx`      | ✅ lu HEAD                                                                                                                                                                                       |
| `axionia/src/components/nav/NavLink.tsx`        | ✅ lu HEAD                                                                                                                                                                                       |
| `axionia/src/components/nav/LocaleSwitcher.tsx` | ✅ lu HEAD                                                                                                                                                                                       |
| `axionia/src/components/nav/Breadcrumbs.tsx`    | ✅ lu HEAD                                                                                                                                                                                       |
| `axionia/src/components/nav/Footer.tsx`         | ✅ lu HEAD                                                                                                                                                                                       |
| `axionia/src/i18n/navigation.ts`                | ✅ lu HEAD (6 lignes)                                                                                                                                                                            |
| `axionia/src/i18n/routing.ts`                   | ✅ lu HEAD                                                                                                                                                                                       |
| `axionia/messages/fr.json`                      | ⚠️ Inexistant à ce path. **Trouvé à `axionia/src/messages/fr.json`** (idem en.json). Structure conforme attendue.                                                                                |
| `axionia/messages/en.json`                      | ⚠️ Inexistant à ce path. Trouvé à `axionia/src/messages/en.json`.                                                                                                                                |
| `axionia/src/app/[locale]/layout.tsx`           | ✅ lu HEAD                                                                                                                                                                                       |
| `axionia/src/app/sitemap.ts`                    | ✅ lu HEAD                                                                                                                                                                                       |
| `axionia/src/app/robots.ts`                     | ✅ lu HEAD                                                                                                                                                                                       |
| `axionia/CLAUDE.md` §9.2                        | ⚠️ `axionia/CLAUDE.md` = 1 ligne `@AGENTS.md`. **§9.x trouvé dans `C:\...\AxionIA_Dossier_FINAL_ABSOLU_v10.1\CLAUDE.md`** (lignes 333-414). Citation littérale §9 complète au §9 du présent doc. |
| `axionia/src/app/[locale]/recherche/page.tsx`   | ✅ lu (~140 lignes). SSR via searchParams.                                                                                                                                                       |

**Aucun blocage majeur**. Toutes les sources de vérité sont accessibles et cohérentes. Les divergences listées (paths messages, CLAUDE.md indirection) sont signalées mais résolues.
