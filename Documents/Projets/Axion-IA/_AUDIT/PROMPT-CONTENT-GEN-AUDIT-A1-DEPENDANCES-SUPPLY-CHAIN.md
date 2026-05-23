# 🔐 PROMPT AUDIT A1 — Dépendances + supply chain (Content Generator Axion-IA)

> Audit dédié aux dépendances npm, vulnérabilités CVE, licenses, supply chain.
> Mode AUDIT-ONLY strict. Production : 1 rapport `.md` unique.

---

```
Skill : axionia-content-generator (mode 🔒 AUDIT A1 — Dépendances + supply chain)

Tu es l'auditeur des dépendances supply-chain du repo Axion-IA. Tu vérifies
qu'aucun package npm utilisé par le content-gen (et le reste du repo)
introduit de risque sécurité, license incompatible, ou dette technique
critique.

⛔ MODE AUDIT-ONLY STRICT :
- Aucune édition code, aucun commit, aucun pnpm install / update
- Tu LIS : package.json, pnpm-lock.yaml, .github/dependabot.yml,
  .github/workflows/*.yml
- Tu LANCES : pnpm audit (read-only), pnpm outdated, npm-check (read-only)
- Si bug détecté → noter, NE PAS fix
- Seul livrable : `_AUDIT/CONTENT-GEN-AUDIT-A1-DEPS-2026-XX-XX.md`

╔═══════════════════════════════════════════════════════════════════════╗
║                  LECTURE OBLIGATOIRE                                  ║
╚═══════════════════════════════════════════════════════════════════════╝

1. axionia/package.json (toutes les deps + devDeps + scripts)
2. axionia/pnpm-lock.yaml (résolution réelle versions)
3. axionia/.github/dependabot.yml (si présent) OU .github/renovate.json
4. axionia/.github/workflows/*.yml (CI security audits actifs ?)
5. _AUDIT/PROMPT-CONTENT-GENERATOR-MASTER-2026.md § 4.2 stack technique
   cible (cohérence stack actuelle vs spec)
6. axionia/AGENTS.md (Next 16 stack, breaking changes)

╔═══════════════════════════════════════════════════════════════════════╗
║                  PHASE 0 — Setup                                      ║
╚═══════════════════════════════════════════════════════════════════════╝

```bash
git status
git log --oneline -5
cd axionia/
pnpm --version
node --version
cat package.json | jq '.dependencies, .devDependencies'
```

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 1 — Vulnérabilités CVE (pnpm audit)                       ║
╚═══════════════════════════════════════════════════════════════════════╝

```bash
cd axionia/
pnpm audit --json > /tmp/pnpm-audit.json
pnpm audit --audit-level=moderate
```

Vérifier :
- [ ] 0 critical CVE
- [ ] 0 high CVE
- [ ] Si moderate : liste + plan fix (upgrade dispo ? workaround ?)
- [ ] Si low : tolérable selon contexte

→ SORTIE : tableau CVE × sévérité × package × version × fix dispo.

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 2 — Packages obsolètes (pnpm outdated)                    ║
╚═══════════════════════════════════════════════════════════════════════╝

```bash
cd axionia/
pnpm outdated --format json > /tmp/pnpm-outdated.json
pnpm outdated --long
```

Distinguer :
- **Majors disponibles** : breaking changes potentiels (planifier upgrade)
- **Minors disponibles** : amélioration features
- **Patches disponibles** : security fixes (upgrade prioritaire)

Cross-check master prompt § 4.2 :
- Next 16.x ? Prisma 5.22+ ? BullMQ 5.76+ ? Vitest 2.1+ ? Playwright 1.59+ ?
- React 19+ ? TypeScript 5.5+ ? Tailwind 4.x ?

→ SORTIE : tableau package × version actuelle × version dispo × type × criticité.

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 3 — Licenses compatibility (FOSS audit)                   ║
╚═══════════════════════════════════════════════════════════════════════╝

Identifier licenses NON compatibles avec usage commercial Axion-IA OÜ :
- ❌ AGPL-3.0 (copyleft réseau — contamine code commercial)
- ❌ GPL-3.0 (copyleft fort)
- ⚠️ LGPL-3.0 (dynamic linking OK mais attention static)
- ⚠️ SSPL (Server Side Public License — incompatible SaaS commercial)
- ✅ MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, MPL-2.0

```bash
cd axionia/
npx license-checker --production --summary
npx license-checker --production --excludePackages 'axion-ia@0.1.0' \
  --excludeLicenses 'MIT;Apache-2.0;ISC;BSD-3-Clause;BSD-2-Clause;0BSD;CC0-1.0;Unlicense;MPL-2.0;CC-BY-4.0' \
  --csv > /tmp/license-violations.csv
```

→ SORTIE : tableau packages × license × commercial OK ?

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 4 — Packages content-gen spécifiques                      ║
╚═══════════════════════════════════════════════════════════════════════╝

Vérifier présence + versions OK pour les packages critiques content-gen :

| Package | Usage | Version min attendue |
|---------|-------|---------------------|
| `bullmq` | Workers queue | 5.76+ |
| `@prisma/client` + `prisma` | DB ORM | 5.22+ |
| `openai` | Provider OpenAI | latest |
| `@anthropic-ai/sdk` | Provider Anthropic | latest avec prompt caching |
| `axios` | HTTP Perplexity/Unsplash | 1.7+ |
| `isomorphic-dompurify` | HTML sanitize | latest |
| `sharp` | Image pipeline AVIF/WebP | latest |
| `p-limit` | Concurrency control | latest |
| `zod` | Validation runtime | 3.23+ |
| `next` | Framework | 16.x |
| `react` | UI | 19.x |
| `vitest` | Tests | 2.1+ |
| `@playwright/test` | E2E tests | 1.59+ |
| `next-intl` | i18n | latest |
| `next-auth` | Auth | 5.x (Auth.js) |
| `tailwindcss` | Styles | 4.x |
| `tiptap` | Rich text editor | 2.x si V1.5 livré |
| `@dnd-kit/core` | Drag&drop si livré | latest |
| `react-simple-maps` | Cockpit géo si livré | latest |

Vérifier :
- [ ] Tous présents si features livrées ?
- [ ] Versions ≥ minima ?
- [ ] Pas de package dépréciés (`request`, `node-sass`, `moment` legacy) ?

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 5 — Supply chain integrity (lockfile + transitive)        ║
╚═══════════════════════════════════════════════════════════════════════╝

- [ ] `pnpm-lock.yaml` à jour vs package.json (pas de drift)
- [ ] Pas de package avec install hook suspect (`postinstall: curl ...`)
- [ ] `pnpm install --frozen-lockfile` passe (cohérence repro)
- [ ] Pas de package "typosquatting" connu (axios vs axois, react-dom vs
      react-dorm, lodash vs loadash)
- [ ] Aucun `latest` pinning dans package.json (toutes versions semver
      explicite)
- [ ] Aucun fork github URL (`github:user/repo#branch`) pour production

```bash
cd axionia/
# Vérifier dependabot config présent
ls -la .github/dependabot.yml 2>/dev/null || echo "❌ pas de dependabot config"
# Vérifier package-lock pas commité (pnpm only)
ls -la package-lock.json yarn.lock 2>/dev/null && echo "⚠️ multi-lockfiles"
# Vérifier .npmrc strict
cat .npmrc 2>/dev/null
```

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 6 — CI/CD security gates                                  ║
╚═══════════════════════════════════════════════════════════════════════╝

- [ ] GitHub Actions workflow `npm audit` ou `pnpm audit` en CI ?
- [ ] Dependabot auto-PR security updates activé ?
- [ ] Renovate config ?
- [ ] `pnpm verify:all` inclut-il un audit step ?
- [ ] Pre-commit hooks scan secrets (`gitleaks` / `trufflehog`) ?

```bash
grep -r "npm audit\|pnpm audit\|dependabot\|snyk\|trivy" .github/
```

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 7 — Synthèse + verdict                                    ║
╚═══════════════════════════════════════════════════════════════════════╝

Rapport `_AUDIT/CONTENT-GEN-AUDIT-A1-DEPS-2026-XX-XX.md` :

```markdown
# Audit A1 — Dépendances + supply chain (YYYY-MM-DD)

## 1. Contexte
- Branche / commit / tag
- pnpm version / node version
- Total packages (prod + dev)

## 2. Vulnérabilités CVE
| Sévérité | Count | Liste |
|----------|-------|-------|
| Critical | XX | ... |
| High | YY | ... |
| Moderate | ZZ | ... |
| Low | WW | ... |

## 3. Packages obsolètes
| Package | Actuel | Latest | Type | Action |
|---------|--------|--------|------|--------|

## 4. Licenses non conformes
| Package | License | Risk |

## 5. Packages content-gen critiques
[matrice 20+ lignes]

## 6. Supply chain integrity
- Lockfile sync : ✅/⚠️/❌
- Install hooks suspects : count
- Typosquatting : count
- Latest pinning : count

## 7. CI/CD security gates
- pnpm audit CI : ✅/❌
- Dependabot : ✅/❌
- Pre-commit secrets scan : ✅/❌

## 8. Verdict /50
- CVE critical/high : -10 pt chaque
- Licenses non compat : -5 pt chaque
- Lockfile drift : -3 pt
- Packages content-gen manquants/wrong version : -3 pt chaque
- Pas de CI security gate : -5 pt

🟢 SUPPLY CHAIN SAFE : ≥ 45/50
🟡 ATTENTION : 30-44/50
❌ RISKY : < 30/50

## 9. Recommandations P0/P1/P2
- P0 : Critical CVE à patcher AVANT prod
- P1 : High CVE + lockfile drift sous 48h
- P2 : Outdated minor + licenses warnings

## 10. Métadonnées
- Durée : X min
- Packages scannés : Y
```

╔═══════════════════════════════════════════════════════════════════════╗
║                          DÉMARRER                                     ║
╚═══════════════════════════════════════════════════════════════════════╝

Mode : 🔒 AUDIT-ONLY STRICT. Production rapport unique. Aucun fix.
```
