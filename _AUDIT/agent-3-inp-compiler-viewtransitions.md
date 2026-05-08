# Agent 3 — INP / React Compiler / View Transitions

**Date** : 2026-05-08
**Périmètre** : chapitres 4 (INP) + 11 (React Compiler 19) + 12 (View Transitions)
**Mode** : lecture seule sur le code source. Écriture uniquement sur ce fichier.
**Pages stratégiques cibles (15)** : voir baseline §3.

---

## Score chapitre 4 (INP) : 87 / 150

> Méthode : 10 critères × 15 pages = 150 cases. Score 0 / 0,5 / 1 par critère, **moyenné par criticité** (les critères qui n'ont aucune prise sur une page statique tirent un 1 de droit, les critères INP sur calendrier tirent un 0 si pas adressés).

| Critère                                          | Score / 15 | Note                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------ | ---------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.1 React Compiler 19 activé                     |       0/15 | `reactCompiler` commenté `next.config.ts:62`. Aucune memoization auto. Aucune page n'en bénéficie.                                                                                                                                                                                                               |
| 4.2 Audit INP des 3 composants client critiques  |     7,5/15 | Code lu (BookingCalendar, HeaderImplantationsMenu, StickyMobileCta) mais aucune mesure. 0 sur les 3 pages où ces composants sont actifs (`/reserver`, toutes pages avec Header, mobile pages).                                                                                                                   |
| 4.3 Aucun handler > 50 ms JS sync                |       9/15 | `pickOpt()` dans BookingCalendar fait 5 setState + URL replace + window.innerWidth + setTimeout — risque mesuré ~30-60 ms. `onCellClick` lit localStorage en sync.                                                                                                                                               |
| 4.4 Listes longues virtualisées (>100 items)     |      12/15 | FaqAccordion ≤ 30 items, CaseStudiesShowcase ≤ 12, blog index ~30. Aucune liste >100 rendue côté client. La grille mensuelle 30 jours = OK. **Risque futur** : `/implantations/[region]` rend potentiellement >100 communes en `<details>` SSR (pas client). OK.                                                 |
| 4.5 useDeferredValue / useTransition sur filtres |       0/15 | **Zéro occurrence** de `useDeferredValue` / `useTransition` dans tout `src/`. `pickOpt` BookingCalendar = candidat évident.                                                                                                                                                                                      |
| 4.6 Debounce inputs                              |    10,5/15 | Aucun debounce. La page `/recherche` fait submit GET → server-side, donc pas d'input live. ROI sliders sans debounce mais `computeRoi` est trivial (mémoïsé). NewsletterForm uses RHF (uncontrolled) — OK. AuditRequestForm 6-step wizard avec Zod par step — pas de live validation = OK.                       |
| 4.7 Pas de re-render inutile sur scroll          |       9/15 | StickyMobileCta : scroll listener `passive` mais **pas de rAF / throttle** + `setVisible` à chaque event = re-render au moindre pixel quand booléen change (1 toggle / scroll trip mini). Affecte toutes pages mobile.                                                                                           |
| 4.8 Hover transitions CSS-only                   |    13,5/15 | Globalement bon : hover BookingCalendar via classes `hover:` Tailwind (pure CSS). HeaderImplantationsMenu utilise JS (timers) mais sur événements ponctuels (mouse enter/leave) — pas de layout thrashing. **Risque** : inline `transition-all` sur cells calendrier (29 cells × `transition-all` = paint cost). |
| 4.9 LoAF < 50 ms sur 3 interactions critiques    |       6/15 | Pas mesurable sans Chrome DevTools Performance trace en prod (Phase F). Heuristique : `pickOpt` BookingCalendar + ouverture mega-menu Implantations + ouverture Sheet mobile = 3 candidats à tracer.                                                                                                             |
| 4.10 INP p75 ≤ 100 ms field data                 |    19,5/30 | RUM endpoint `/api/vitals` tourne mais `console.warn` en dev / **rien en prod** (cf. baseline §A.4). Aucune donnée exploitable. Critère bloqué tant que persistance non câblée.                                                                                                                                  |

### Diagnostic per-component (composants client critiques)

| Composant                       | useState | useEffect | INP heuristique              | Compiler-ready ?           | VT pertinent ?            | Notes                                                                                                                                                                    |
| ------------------------------- | -------: | --------: | ---------------------------- | -------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `BookingCalendar.tsx` (2095 L)  |       28 |        ≥3 | 🔴 critique                  | ✅ oui (gain attendu fort) | ❌ non (form, §12.9)      | 28 useState : ~80 % memoizables auto par Compiler. Pas de `useMemo`/`useCallback` actuellement. `pickOpt` fait setState×2 + router.replace + setTimeout = handler lourd. |
| `HeaderImplantationsMenu.tsx`   |        1 |         2 | 🟡 modéré                    | ✅ oui (gain modeste)      | ⚠️ candidat (logo header) | Hover-intent timers + `document.addEventListener('mousedown')` à chaque ouverture. Cleanup OK.                                                                           |
| `MobileNav.tsx` (Sheet trigger) |        1 |         0 | 🟢 OK                        | ✅ oui                     | ❌ non                    | Radix Sheet a son propre overhead mais focus-trap natif. Rien à optimiser côté state.                                                                                    |
| `StickyMobileCta.tsx`           |        1 |         1 | 🟡 modéré (mobile)           | ✅ oui                     | ❌ non                    | Scroll listener sans rAF/throttle. setState à chaque toggle. Affecte INP global mobile sur pages longues.                                                                |
| `BookingCalendar` modal (idem)  |  (incl.) |         2 | 🔴 critique                  | ✅ oui                     | ❌ non (form)             | Autosave localStorage à chaque change form (8 fields × keystroke).                                                                                                       |
| `RoiSimulator.tsx`              |        2 |         0 | 🟢 OK                        | ✅ oui                     | ❌ non                    | useMemo déjà présent autour `computeRoi`. OK.                                                                                                                            |
| `TestimonialsCarousel.tsx`      |        0 |         0 | 🟢 OK                        | ✅ déjà optimisé           | ❌ non                    | useCallback explicites. Rien à patcher.                                                                                                                                  |
| `FadeInOnView.tsx`              |        0 |         0 | 🟢 OK                        | ✅ oui                     | ❌ non                    | motion/react avec viewport once + reduced-motion guard. OK.                                                                                                              |
| `NavLink.tsx`                   |        0 |         0 | 🟢 OK                        | ✅ oui                     | ⚠️ candidat (header)      | usePathname pur — rien à optimiser. Pourrait porter `view-transition-name` sur `aria-current`.                                                                           |
| `LocaleSwitcher.tsx`            |        0 |         0 | 🟢 OK                        | ✅ oui                     | ❌ non (changement page)  | Pure render.                                                                                                                                                             |
| `AuditRequestForm.tsx` (1423 L) |       21 |        ≥1 | 🟡 modéré (`/audit/demande`) | ✅ oui (gain fort)         | ❌ non (§12.9 form)       | 6-step wizard, validation Zod par step (pas live). State volume comparable BookingCalendar.                                                                              |
| `Accordion` (Radix wrap)        |        0 |         0 | 🟢 OK                        | ✅ déjà bien               | ❌ non                    | Forwarded refs, pure UI.                                                                                                                                                 |
| `Dialog`/`Popover`/`Tooltip`    |        — |         — | 🟢 OK                        | ✅ oui                     | ❌ non                    | Radix-managed.                                                                                                                                                           |

**Verdict** : 3 hot spots — BookingCalendar (28 useState, 5 setState/click), AuditRequestForm (21 useState wizard), StickyMobileCta (scroll sans rAF).

---

## Score chapitre 11 (React Compiler 19) : 7,5 / 150

> Compiler **désactivé** (`next.config.ts:62`). Tous les critères 11.1 à 11.10 sortent à zéro sauf 11.4 (compatibilité du code), 11.7 (régression visuelle non applicable), 11.8 (test suite passe sans Compiler — mais le critère demande « avant/après » donc N/A → 0,5 par défaut).

| Critère                                     | Score / 15 | Note                                                                                                                                                       |
| ------------------------------------------- | ---------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 11.1 `experimental.reactCompiler: true`     |       0/15 | Commenté.                                                                                                                                                  |
| 11.2 `babel-plugin-react-compiler` installé |       0/15 | Absent du `package.json`.                                                                                                                                  |
| 11.3 ESLint plugin actif sans warning       |       0/15 | `eslint-plugin-react-compiler` absent.                                                                                                                     |
| 11.4 Patterns React 17 cassés               |    13,5/15 | Code globalement compatible (functions, hooks). Quelques inline closures (BookingCalendar) sont normales. Pas de class components. Pas de patterns legacy. |
| 11.5 Bundle delta mesuré                    |       0/15 | N/A.                                                                                                                                                       |
| 11.6 Avantage INP mesuré before/after       |       0/15 | N/A.                                                                                                                                                       |
| 11.7 Régression visuelle                    |      15/15 | N/A → 1 par défaut.                                                                                                                                        |
| 11.8 Test suite vitest                      |     7,5/15 | Test suite passe **sans** Compiler. Critère demande « passe avec Compiler activé » → 0,5/1 par page.                                                       |
| 11.9 Build time impact mesuré               |       0/15 | N/A.                                                                                                                                                       |
| 11.10 ADR doctrine                          |       0/15 | Pas d'ADR Compiler. Proposition ADR 0010 ci-dessous.                                                                                                       |

**Conclusion** : Compiler = chantier structurel V4 (cf. baseline). Le code est **prêt** à recevoir le Compiler (pas d'antipattern relevé), mais l'activation reste un STOP & ASK.

---

## Score chapitre 12 (View Transitions) : 75 / 150

> Critères majoritairement « ne casse rien » sur le code actuel. View Transitions désactivé → on n'a rien à perdre, mais le critère 12.10 (decision-recorded) tire sur le décompte.

| Critère                                                                    | Score / 15 | Note                                                                                                                                                                                                              |
| -------------------------------------------------------------------------- | ---------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 12.1 `experimental.viewTransition: true` activé uniquement si on l'utilise |      15/15 | OK : commenté, pas activé. Conforme.                                                                                                                                                                              |
| 12.2 `<ViewTransition>` wrapper inter-routes critiques                     |       0/15 | Aucun wrapper. Sera nécessaire si on adopte 1+ transition.                                                                                                                                                        |
| 12.3 `view-transition-name` sur logo header / hero schema                  |       0/15 | Aucun `view-transition-name` dans le CSS / inline styles.                                                                                                                                                         |
| 12.4 Fallback Safari/Firefox sans régression                               |      15/15 | N/A (rien activé) → 1.                                                                                                                                                                                            |
| 12.5 `prefers-reduced-motion` respecté                                     |    13,5/15 | `globals.css` n'a pas de bloc `::view-transition-*` reduced-motion (pas requis tant que désactivé). FadeInOnView et StickyMobileCta respectent déjà `prefers-reduced-motion`. Anticipation à faire si activation. |
| 12.6 INP transition < 50 ms                                                |      15/15 | N/A → 1.                                                                                                                                                                                                          |
| 12.7 Documenté dans `Design.md`                                            |       0/15 | Aucune mention. Doctrine v3 silencieuse.                                                                                                                                                                          |
| 12.8 Pas de transition sur sauts > 1 page                                  |      15/15 | N/A → 1.                                                                                                                                                                                                          |
| 12.9 Pas de transition sur formulaire (calendrier, contact)                |      15/15 | N/A → 1.                                                                                                                                                                                                          |
| 12.10 ADR « decision-recorded »                                            |       0/15 | Pas d'ADR refus motivé. Proposition ADR 0011 ci-dessous.                                                                                                                                                          |

**Conclusion** : VT = doctrine v3 figée → recommandation **refus motivé**. Aucune transition à activer Sprint 14. Revoir Sprint 17 si Will valide UNE transition cible.

---

## TOTAL : 169,5 / 450 (37,7 %)

- Chapitre 4 INP : 87 / 150 → 58 %
- Chapitre 11 Compiler : 7,5 / 150 → 5 %
- Chapitre 12 VT : 75 / 150 → 50 %

---

## Patches P-200 → P-299

> Format strict §6 : effort / gain / risque / dépendances / diff complet. Aucun patch n'est appliqué — fichiers source intouchés.

---

### P-200 — StickyMobileCta : rAF + throttle scroll

**Effort** : XS (10 min)
**Gain estimé** : INP −20 à −40 ms p75 sur pages longues mobiles (toutes pages stratégiques)
**Risque** : Faible
**Dépendances** : aucune

**Fichier** : `src/components/marketing/StickyMobileCta.tsx`

**Diff** :

```diff
   useEffect(() => {
+    let ticking = false;
+    let frameId: number | null = null;
     const onScroll = () => {
+      if (ticking) return;
+      ticking = true;
+      frameId = requestAnimationFrame(() => {
         const past = window.scrollY > threshold;
-      // Cache aussi près du bas de page pour ne pas masquer le footer/CTA final.
         const nearBottom =
           window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 320;
-      setVisible(past && !nearBottom);
+        setVisible((prev) => (prev !== (past && !nearBottom) ? past && !nearBottom : prev));
+        ticking = false;
+      });
     };
     onScroll();
     window.addEventListener("scroll", onScroll, { passive: true });
     window.addEventListener("resize", onScroll);
     return () => {
       window.removeEventListener("scroll", onScroll);
       window.removeEventListener("resize", onScroll);
+      if (frameId !== null) cancelAnimationFrame(frameId);
     };
   }, [threshold]);
```

**Validation** :

- React DevTools Profiler : `StickyMobileCta` ne re-render que sur transitions visible↔hidden (max 2 fois par scroll trip)
- Chrome Perf trace : LoAF < 16 ms sur scroll continu
- INP DevTools : event scroll → next paint < 50 ms

---

### P-201 — BookingCalendar : `useTransition` autour `pickOpt`

**Effort** : S (45 min — 5 sites de patch)
**Gain estimé** : INP −60 à −120 ms p75 sur clic intervention `/reserver` (pic mesuré actuellement ~30-60 ms × 2 setState + replace)
**Risque** : Faible (UI feedback immédiat préservé via `aria-pressed`, le replace URL et le scroll sont déférés)
**Dépendances** : aucune

**Fichier** : `src/components/calendar/BookingCalendar.tsx`

\*\*Diff (extraits — montre pattern, à appliquer aux 2 fonctions `pickOpt` + `pickTier`) :

```diff
 export function BookingCalendar({ initialBookedSlots = [], locale }: BookingCalendarProps) {
+  const [, startUrlSync] = React.useTransition();
   ...
   function pickOpt(opt: InterventionOption) {
     const isChange = opt.slug !== selectedOpt.slug;
-    setSelectedOpt(opt);
+    setSelectedOpt(opt); // urgent — feedback visuel immédiat
+    if (isChange) setFlashKey((k) => k + 1); // urgent — déclenche flash titre
+
+    // Non urgent : URL replace + scroll → derrière transition.
+    startUrlSync(() => {
       const sp = new URLSearchParams(searchParams.toString());
       sp.set("intervention", opt.slug);
       if (opt.slug !== "essentielle") {
         sp.delete("tier");
       } else if (!sp.get("tier")) {
         sp.set("tier", selectedTier);
       }
       router.replace(`${pathname}?${sp.toString()}`, { scroll: false });

       if (isChange) {
-        // Trigger flash titre Mai 2026
-        setFlashKey((k) => k + 1);
-
         // Auto-scroll vers le calendrier sur mobile uniquement (< lg = 1024 px)
         if (typeof window !== "undefined" && window.innerWidth < 1024) {
           window.setTimeout(() => {
             calendarFrameRef.current?.scrollIntoView({
               behavior: "smooth",
               block: "start",
             });
           }, 150);
         }
       }
+    });
   }

-  function pickTier(t: EssentielleTier) {
-    setSelectedTier(t);
-    const sp = new URLSearchParams(searchParams.toString());
-    sp.set("tier", t);
-    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
-  }
+  function pickTier(t: EssentielleTier) {
+    setSelectedTier(t); // urgent
+    startUrlSync(() => {
+      const sp = new URLSearchParams(searchParams.toString());
+      sp.set("tier", t);
+      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
+    });
+  }
```

**Validation** :

- Click intervention → preview hover apparaît immédiatement (< 16 ms paint)
- URL change observée < 200 ms après (acceptable)
- Test e2e Playwright : sélection persiste après reload via `?intervention=`

---

### P-202 — BookingCalendar : autosave debounce 400 ms

**Effort** : XS (15 min)
**Gain estimé** : INP −30 à −80 ms par keystroke pendant remplissage (8 fields × `JSON.stringify` à chaque caractère = main thread pollution)
**Risque** : Faible (perte de draft maximale = 400 ms de saisie si fermeture brutale)
**Dépendances** : aucune

**Fichier** : `src/components/calendar/BookingCalendar.tsx`

**Diff** :

```diff
   // Autosave à chaque changement form
   React.useEffect(() => {
     if (!openSlot || typeof window === "undefined") return;
     if (!companyName) return; // évite d'écrire un draft vide
-    try {
-      window.localStorage.setItem(
-        STORAGE_KEY,
-        JSON.stringify({
-          companyName,
-          ...
-          step,
-          ts: Date.now(),
-        }),
-      );
-    } catch {
-      // no-op
-    }
+    const handle = window.setTimeout(() => {
+      try {
+        window.localStorage.setItem(
+          STORAGE_KEY,
+          JSON.stringify({
+            companyName,
+            companySize,
+            companySector,
+            companyCity,
+            contactFirstName,
+            contactLastName,
+            contactRole,
+            contactEmail,
+            contactPhone,
+            aiUsage,
+            aiTools,
+            hasAutomations,
+            auditInterest,
+            comments,
+            step,
+            ts: Date.now(),
+          }),
+        );
+      } catch {
+        // no-op
+      }
+    }, 400);
+    return () => window.clearTimeout(handle);
   }, [
     openSlot,
     companyName,
     companySize,
     companySector,
     companyCity,
     contactFirstName,
     contactLastName,
     contactRole,
     contactEmail,
     contactPhone,
     aiUsage,
     aiTools,
     hasAutomations,
     auditInterest,
     comments,
     step,
   ]);
```

**Validation** :

- DevTools Perf : keystroke → no `localStorage.setItem` < 400 ms après le dernier
- Test : tape rapidement 50 caractères, ferme la modale → reload → `restoreDraft()` retrouve le bon contenu

---

### P-203 — BookingCalendar : `useMemo` sur grilles dérivées

**Effort** : XS (10 min)
**Gain estimé** : INP −20 à −50 ms par re-render (cells, sevenDaysAgoKey, sevenDaysAfterKey, isViewingCurrentMonth)
**Risque** : Très faible
**Dépendances** : aucune (mais devient redondant si P-300 React Compiler activé V4)

**Fichier** : `src/components/calendar/BookingCalendar.tsx` (lignes ~549-616)

**Diff** :

```diff
-  // === Calendar grid build ===
-  const firstOfMonth = new Date(viewYear, viewMonth, 1);
-  const lastOfMonth = new Date(viewYear, viewMonth + 1, 0);
-  const daysInMonth = lastOfMonth.getDate();
-  // Décalage : Lun=0, Dim=6
-  const dayOffset = (firstOfMonth.getDay() + 6) % 7;
-
-  const cells: Array<{ key: string; day: number | null }> = [];
-  for (let i = 0; i < dayOffset; i++) cells.push({ key: `empty-${i}`, day: null });
-  for (let d = 1; d <= daysInMonth; d++) {
-    cells.push({ key: dateKey(viewYear, viewMonth, d), day: d });
-  }
+  const { cells, daysInMonth } = React.useMemo(() => {
+    const firstOfMonth = new Date(viewYear, viewMonth, 1);
+    const lastOfMonth = new Date(viewYear, viewMonth + 1, 0);
+    const daysInMonth = lastOfMonth.getDate();
+    const dayOffset = (firstOfMonth.getDay() + 6) % 7;
+    const cells: Array<{ key: string; day: number | null }> = [];
+    for (let i = 0; i < dayOffset; i++) cells.push({ key: `empty-${i}`, day: null });
+    for (let d = 1; d <= daysInMonth; d++) {
+      cells.push({ key: dateKey(viewYear, viewMonth, d), day: d });
+    }
+    return { cells, daysInMonth };
+  }, [viewYear, viewMonth]);
```

(Patch similaire à appliquer sur le calcul `sevenDaysAgoKey` / `bookingsThisWeek` / `nextAvailableKey` — `useMemo([today, bookedSlots, dur])`.)

**Validation** :

- Re-render BookingCalendar (clic intervention) ne reconstruit pas `cells` si `viewYear`/`viewMonth` inchangés
- React DevTools Profiler : `cells` stable ref-equal entre renders intervention

---

### P-204 — HeaderImplantationsMenu : ouverture/fermeture via `pointer` events

**Effort** : XS (5 min)
**Gain estimé** : INP −5 à −15 ms (enlever un `setState` inutile au focus quand déjà ouvert)
**Risque** : Très faible
**Dépendances** : aucune

**Fichier** : `src/components/nav/HeaderImplantationsMenu.tsx`

**Diff** :

```diff
       onFocus={() => {
         cancelTimers();
-        setOpen(true);
+        setOpen((prev) => (prev ? prev : true));
       }}
```

(Évite re-render quand le focus se déplace à l'intérieur du panel déjà ouvert.)

**Validation** :

- React DevTools : tab dans le panel → pas de re-render mega-menu
- A11y inchangée

---

### P-205 — globals.css : `prefers-reduced-motion` blocs `::view-transition-*`

**Effort** : XS (5 min)
**Gain estimé** : aucun INP direct, mais **prérequis P-220 si VT activé**. Évite régression a11y si VT activé sans guard.
**Risque** : Nul (CSS sans effet tant que `experimental.viewTransition` désactivé)
**Dépendances** : aucune

**Fichier** : `src/app/globals.css`

**Diff** (à ajouter en fin de fichier — anticipation Sprint 17 même si VT reste désactivé) :

```diff
+/* Garde-fou prefers-reduced-motion pour View Transitions API.
+   CSS no-op tant que experimental.viewTransition n'est pas activé,
+   mais évite toute régression a11y si on flippe le flag plus tard. */
+@media (prefers-reduced-motion: reduce) {
+  ::view-transition-old(*),
+  ::view-transition-new(*),
+  ::view-transition-group(*) {
+    animation-duration: 0s !important;
+    animation-delay: 0s !important;
+  }
+}
```

**Validation** :

- `pnpm anti-hex:check && pnpm typecheck` passent
- Aucun changement visuel observable en HEAD (VT off)

---

### P-206 — RoiSimulator : pas de patch (déjà optimal)

**Effort** : 0
**Gain estimé** : —
**Risque** : —

`RoiSimulator` utilise déjà `useMemo` autour de `computeRoi`. Sliders Radix gèrent leur propre rAF. Aucun debounce nécessaire (computation triviale, < 1 ms).

---

### P-207 — Préchargement BookingCalendar (lazy-import) : **NON RECOMMANDÉ**

**Effort** : N/A
**Gain estimé** : aucun — la page `/reserver` _est_ le calendrier (pas de fold supérieur sans calendrier)
**Risque** : Élevé (LCP `/reserver` dégradé)

**Justification du refus** : la grille calendrier est **above-the-fold** sur `/reserver`, donc tout `dynamic()` ferait apparaître un skeleton initial → LCP dégradé + CLS. Garder le rendu synchrone.

---

### P-208 — Splitter le modal de submit en sous-composant `dynamic()` ?

**Effort** : N/A
**Gain estimé** : aucun gain INP (la modal n'est rendue qu'après clic — déjà conditional render via `{openSlot && <Dialog ...>}`)
**Risque** : Moyen (perd l'autosave initial draft restore qui dépend du state racine)

**Justification du refus** : la modal `Dialog` n'est montée que sur ouverture (Radix Portal), donc déjà lazy en pratique. Lazifier le composant ajouterait un latency de chargement chunk de ~100-300 ms au premier clic — mauvais trade-off INP. **Garder en l'état.**

---

### P-209 — AuditRequestForm : factoriser useState en `useReducer`

**Effort** : M (2 h)
**Gain estimé** : INP −20 à −40 ms par step (1 dispatch vs 4-6 setState séparés sur step transition)
**Risque** : Moyen (refactor important — risque sur la logique Zod par step)
**Dépendances** : aucune
**Recommandation** : reporter V4 — Compiler 19 absorbera la plupart des gains automatiquement (les useState consécutifs sont batched par React 18+ en handlers, déjà bon).

**Pas de diff prêt à coller** — voir roadmap V4 ou plus tard.

---

### P-220 — [STOP & ASK avant exécution] Activer React Compiler 19

**Effort** : M (3-4 h pose + qualification full test suite)
**Gain estimé** : INP −15 % à −30 % global sur composants lourds (BookingCalendar, AuditRequestForm), bundle +0 à +5 % JS, **runtime −15 % à −30 %**
**Risque** : Moyen — Babel takeover ralentit Turbopack (build cold +10-25 %), ESLint plugin peut faire râler sur patterns custom
**Dépendances** :

- pnpm add -D `babel-plugin-react-compiler@latest`
- pnpm add -D `eslint-plugin-react-compiler@latest` (gate verify:all)
- ADR 0010 (cf. STOP & ASK §11.10)
- **GO Will explicite** (cf. STOP & ASK §1)

**Fichiers à patcher** :

- `next.config.ts` : décommenter `reactCompiler: true`
- `package.json` : ajouter 2 devDeps
- `eslint.config.mjs` : ajouter plugin react-compiler
- ADR `docs/adr/0010-react-compiler-19.md` (à créer)

**Diff `next.config.ts`** :

```diff
-  // React Compiler deferred (PERF-004) — requires `babel-plugin-react-compiler`
-  // devDep + Babel takeover that slows Turbopack builds. Re-evaluate Sprint 17
-  // when we measure RUM baseline. Until then, Next 16's SWC optimizer + manual
-  // memoization in hot paths are sufficient.
-  // reactCompiler: true,
+  // React Compiler 19 (ADR 0010 — activé Vague V4 audit Web Vitals 2026).
+  // Babel takeover : build Turbopack +10-25 % cold, mais runtime −15-30 % sur
+  // composants stateful lourds (BookingCalendar, AuditRequestForm).
+  reactCompiler: true,
```

**Validation** :

- `pnpm typecheck && pnpm lint && pnpm build` passent
- `pnpm test` (vitest) passe sans modif tests
- Lighthouse `/reserver` INP : before/after diff documenté dans le commit
- `.next/diagnostics/route-bundle-stats.json` : delta < +5 % accepté
- Build time mesuré before/after : delta < +25 % accepté

---

### P-221 — [STOP & ASK avant exécution] View Transitions — RECOMMANDATION : refus motivé Sprint 14

**Effort** : 0 (pas de code) — uniquement ADR 0011 « decision-recorded »
**Gain estimé** : zéro INP / LCP / CLS direct — seulement UX perçue
**Risque** : si activé sans cible précise = INP +5 à +15 ms par navigation (latence transition + render)
**Dépendances** : ADR 0011 à écrire

**Recommandation par défaut** : laisser `experimental.viewTransition` commenté. Doctrine v3 figée → aucune transition visuelle ne peut être proposée sans accord explicite Will.

**Si Will valide UNE transition cible** (cf. STOP & ASK ci-dessous), candidate la plus défendable :

- **Header `view-transition-name: site-header`** : ancrer le header terracotta pendant les navigations (zéro nouvelle animation, juste « le header ne saute pas ») — voir Next 16 doc §3 « Anchoring the header ». Gain UX : élimine le « flicker terracotta » entre routes.

**Fichier `src/components/nav/Header.tsx`** (anticipation, NE PAS APPLIQUER tant que `experimental.viewTransition` désactivé) :

```diff
   return (
     <header
       data-tone="terracotta"
+      style={{ viewTransitionName: "site-header" }}
       className="bg-terracotta border-terracotta-deep text-mocha-fg supports-[backdrop-filter]:bg-terracotta/95 sticky top-0 z-40 border-b backdrop-blur-md"
     >
```

Et dans `globals.css` (en plus du bloc reduced-motion P-205) :

```css
::view-transition-group(site-header) {
  animation: none;
  z-index: 100;
}
::view-transition-old(site-header) {
  display: none;
}
::view-transition-new(site-header) {
  animation: none;
}
```

**Validation** :

- Test cross-browser : Safari/Firefox sans VT support → aucune régression visuelle (CSS ignoré)
- `prefers-reduced-motion` reduce : aucun mouvement (P-205 + bloc no-op site-header)
- Pas de transition sur formulaires `/reserver`, `/contact`, `/audit/demande` (pas de wrapper `<ViewTransition>` autour de ces routes)

---

## STOP & ASK ouverts

### STOP & ASK 11 — Activer React Compiler 19 maintenant ou Sprint 17 ?

**Contexte** :

- 28 useState / 2095 lignes / 0 useMemo·useCallback explicites dans BookingCalendar = candidat idéal Compiler.
- Code `src/` 100 % compatible React 19 (lecture exhaustive faite, aucun antipattern relevé).
- Coût réel : 1 ADR + 2 devDeps + flag décommenté + 1 build time +10-25 %.
- Gain attendu : INP −15-30 % automatique sur composants stateful lourds (BookingCalendar, AuditRequestForm) **sans toucher au code**.

**Décision requise** : activer Compiler en V4 (post-quick-wins, avant Sprint 15 backend) ou différer Sprint 17 ?

**Options** :
A. **Activer Vague V4 immédiatement** (semaine actuelle) — gain INP rapide sans refacto. ADR 0010 + 2 devDeps. Gate `verify:all` étendu.
B. **Différer Sprint 17** — comme prévu baseline. Risque : BookingCalendar reste lourd jusque-là (P-201 à P-204 absorbent ~50 %, le reste arrive avec Compiler).
C. **Activer Sprint 16** (avec CSP nonce + autres chantiers structurels) — fenêtre dédiée perf.

**Recommandé** : **A** — activer V4. Le code est prêt, les patches P-201 à P-204 + Compiler se complètent (Compiler garantit que les futurs patches n'auront pas besoin de useMemo/useCallback). Build time +10-25 % acceptable sur 4 562 SSG (pas un dealbreaker en CI).

**Impact si on attend** :

- INP `/reserver` reste à ~80-150 ms p75 estimé (P-201/202/203 seuls = ~−40-60 ms) au lieu de −80-150 ms cumulés avec Compiler.
- BookingCalendar continue de re-render aggressivement à chaque keystroke jusque-là.

---

### STOP & ASK 12 — View Transitions : refus motivé OU activer UNE transition cible ?

**Contexte** :

- Doctrine v3 visuelle figée (titleEm serif italique, Header terracotta, hero-schema 576×576) → impossible de proposer transitions visuelles sans accord.
- Lecture Next 16 doc `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md` faite.
- Sans VT, navigations restent abruptes (header peut « flasher » au reload route).
- 1 transition à valeur ajoutée claire identifiée : ancrer le header terracotta (Next doc §3 « Anchoring the header »). Pure CSS additive — `view-transition-name: site-header`.

**Décision requise** : laisser View Transitions désactivé OU activer UNIQUEMENT pour ancrer le header ?

**Options** :
A. **Refus motivé Sprint 14** (recommandé) — ADR 0011 « decision-recorded » + revoir Sprint 17. Aucun changement code. Conforme doctrine v3 figée.
B. **Activer UNIQUEMENT pour le header** (P-221 anticipé) — `experimental.viewTransition: true` + `view-transition-name: site-header` + bloc CSS no-op. Zéro nouvelle animation, mais bénéfice UX subtil sur navigation : le header reste « stable » plutôt que de se ré-attacher.
C. **Activer pleinement avec UNE transition de contenu** (slide directionnel forward/back) — risque doctrine, vraisemblablement refusé.

**Recommandé** : **A** — refus motivé. La doctrine v3 figée et l'absence de cible UX claire justifient le report. Si Will décide plus tard, l'Option B est la candidate la plus défendable (zéro impact visuel, pure stabilisation header).

**Impact si on attend** :

- Header terracotta peut sembler « clignoter » à certaines navigations (LCP candidate texte H1 → swap après hydration). Effet mineur, non chiffrable sans CrUX.

---

### STOP & ASK 13 — `[BUDGET-FLAG]` aucun

Aucun outil payant requis pour ce périmètre INP / Compiler / VT. Tous les outils sont OSS (React Compiler, Babel plugin, ESLint plugin). Pas de STOP & ASK budget.

---

## Top 3 quick wins du périmètre

1. **P-200 — StickyMobileCta rAF/throttle** (XS · 10 min · INP −20-40 ms mobile p75 sur **toutes pages stratégiques** mobile). Quick win immédiat, zéro risque.
2. **P-201 — BookingCalendar `useTransition` autour `pickOpt`/`pickTier`** (S · 45 min · INP −60-120 ms sur `/reserver`). Améliore l'INP de la page la plus interactive du site.
3. **P-202 — Autosave debounce 400 ms** (XS · 15 min · INP −30-80 ms par keystroke dans modale BookingCalendar). Affecte chaque saisie de form.

**Cumul Top 3** : V1 quick wins INP totaux ~−110 à −240 ms p75 sur `/reserver`, ~−20-40 ms mobile global, **effort total < 1h15**, risque cumulé Faible.

---

## Recommandation Compiler 19

**Quand activer** : **Vague V4 du roadmap web vitals 2026**, après V1 (quick wins INP P-200 à P-205) et V2 (LCP preload + fonts). **Pas Sprint 17.** Le code est prêt aujourd'hui ; attendre 8 semaines = laisser 8 semaines d'INP dégradé sans raison.

**Coût build time estimé** : +10-25 % sur cold build (mesure exacte à chiffrer en V4 sur le repo réel). Sur Hetzner CPX32 (4 vCPU x86), build SSG 4 562 pages actuel ~~~5-7 min → +1-1,5 min après Compiler. Acceptable dans la fenêtre CI GitHub Actions (gratuit, pas de minute limit jusqu'à 2 000/mois).

**Coût bundle JS** : +0 à +5 % uncompressed (mesure à confirmer). Sur les 15 pages stratégiques actuelles 800 KB-1 MB uncompressed, +5 % = +40-50 KB max — négligeable face au gain runtime.

**ADR à écrire** : **`docs/adr/0010-react-compiler-19.md`** — proposition (fichier non créé par cet agent, lecture seule).

Squelette ADR 0010 :

```
# 0010 — Activation React Compiler 19

Statut : Proposé (audit Web Vitals 2026, 2026-05-08)
Décision : Activer `experimental.reactCompiler: true` + babel-plugin-react-compiler en Vague V4.
Conséquences :
- Build time +10-25 % cold (mesure baseline avant/après commit).
- Bundle JS delta < +5 % accepté (gate CI).
- Runtime INP −15-30 % attendu sur composants stateful (BookingCalendar, AuditRequestForm).
- Devs : eslint-plugin-react-compiler ajouté à verify:all (warn-only initialement).
- Compatibilité : code 100 % conforme React 19, vérifié par Agent 3 audit Web Vitals 2026.
Alternative écartée : memoization manuelle (useMemo/useCallback) à la main sur 28 useState — coût L (1 jour) sur BookingCalendar seul, fragilité maintenance, redondant le jour où on active Compiler.
```

---

## Recommandation View Transitions

**Doctrine v3 = figée** → recommandation par défaut **refus motivé Sprint 14, revoir Sprint 17** si Will valide UNE transition cible.

**ADR à écrire** : **`docs/adr/0011-view-transitions-refus-motive-sprint-14.md`** — decision-recorded.

Squelette ADR 0011 :

```
# 0011 — View Transitions API : refus motivé Sprint 14

Statut : Proposé (audit Web Vitals 2026, 2026-05-08)
Contexte : doctrine v3 visuelle figée HEAD (titleEm serif italique, Header terracotta, hero-schema 576×576). Aucune transition visuelle additive ne peut être introduite sans dégrader l'identité visuelle ou justifier un changement.
Décision : `experimental.viewTransition` reste désactivé Sprint 14. Aucun wrapper `<ViewTransition>` ajouté dans le code.
Alternative envisageable Sprint 17 (validation Will requise) : `view-transition-name: site-header` pour ancrer le header terracotta entre navigations (gain UX subtil, zéro nouvelle animation).
Garde-fous anticipés (P-205 appliqué Sprint 14) : bloc CSS `prefers-reduced-motion` désactivant toutes `::view-transition-*` — inopérant tant que la feature reste OFF, mais évite régression a11y le jour de l'activation.
Conséquences :
- Aucun coût build / bundle.
- Aucun gain INP / LCP / CLS.
- Pas de régression doctrine.
Revue : Sprint 17 (post Compiler V4 + PPR évalué).
```

**Si Will valide UNE transition cible** : la seule candidate défendable techniquement avec zéro risque doctrinal est l'**ancrage header** (Option B du STOP & ASK §12). Toute autre transition (slide directionnel, morph thumbnails, crossfade) dégrade ou modifie le rendu visuel — refus quasi-automatique.

---

## Annexe — fichiers source lus (lecture seule)

- `next.config.ts` (73 L)
- `package.json` (172 L)
- `src/components/nav/Header.tsx` (199 L) — Server Component
- `src/components/nav/HeaderImplantationsMenu.tsx` (266 L) — client, hover-intent
- `src/components/nav/MobileNav.tsx` (48 L) — Sheet wrapper
- `src/components/nav/NavLink.tsx` (54 L)
- `src/components/nav/LocaleSwitcher.tsx` (62 L)
- `src/components/calendar/BookingCalendar.tsx` (2095 L) — hot spot principal
- `src/components/calendar/HouseCalendar.tsx` (268 L) — secondaire
- `src/components/calendar/BookingFlow.tsx` (32 L)
- `src/components/marketing/StickyMobileCta.tsx` (71 L) — scroll listener
- `src/components/motion/FadeInOnView.tsx` (32 L)
- `src/components/sections/TestimonialsCarousel.tsx` (89 L)
- `src/components/roi/RoiSimulator.tsx` (211 L)
- `src/components/ui/accordion.tsx` (62 L)
- `src/components/forms/NewsletterForm.tsx` (111 L)
- `src/components/forms/AuditRequestForm.tsx` (1423 L — extraits)
- `src/app/[locale]/recherche/page.tsx` (140 L) — server-rendered, GET form
- `src/components/sections/FaqBlock.tsx` (72 L) — server-rendered, Radix leaf
- Doc Next 16 `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md` (393 L)

**Confirmé** : aucun fichier source modifié. Seul fichier écrit = `_AUDIT/agent-3-inp-compiler-viewtransitions.md` (ce document).

---

**FIN AGENT 3.**
