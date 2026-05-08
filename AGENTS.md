<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## Performance budget (Web Vitals 2026 — voir `_AUDIT/AUDIT-WEB-VITALS-2026-*.md`)

Toute PR qui touche le code frontend doit respecter ces seuils sur les **15 pages stratégiques** :

- **LCP** ≤ 1 800 ms p75 (cible interne ; Google « good » = 2 500 ms)
- **INP** ≤ 100 ms p75 (cible interne ; Google « good » = 200 ms)
- **CLS** = 0 (cible interne stricte ; Google « good » = 0,1)
- **TBT** ≤ 150 ms (Lighthouse lab desktop)
- **First Load JS** ≤ 75 KB gz / route (cible V6)

Exception : `/reserver` (calendrier client-heavy) → INP ≤ 150 ms, First Load ≤ 110 KB gz.

Tout patch qui dégrade ces seuils requiert un STOP & ASK Will + ADR justifié. Lighthouse CI (`pnpm lhci`) gate les PR. Bundle delta gate (`size-limit`) bloque les PR avec > +5 KB gz vs `main`.

Source de vérité : `_AUDIT/AUDIT-WEB-VITALS-2026-BUDGETS.md`.
