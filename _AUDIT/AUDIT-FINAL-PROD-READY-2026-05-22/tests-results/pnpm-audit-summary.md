# pnpm audit summary (OWASP A06)

## Date : 2026-05-22

**Total : 7 vulnerabilities = 2 low + 5 moderate. 0 critical, 0 high.**

Toutes en deps DEV (vitest/vite/esbuild/lhci-cli/@typescript-eslint). Aucun impact prod runtime.

## Détail

1. esbuild <=0.24.2 (CORS dev server) — moderate, paths: vitest>vite>esbuild
2. vite <=6.4.1 (path traversal optimized deps map) — moderate
3. brace-expansion >=5.0.0 <5.0.6 (regex DoS) — moderate
4. ws >=8.0.0 <8.20.1 (uninitialized memory) — moderate
5. @typescript-eslint/\* (transitive) — low/moderate
6. tmp <0.2.4 (lhci-cli) — low
7. Inquirer (lhci-cli transitive) — low

**Verdict : ✅ OK pour prod. Aucune CVE high/critical. Toutes en dev-deps.**
