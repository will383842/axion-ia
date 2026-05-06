# ADR 0001 — Stack initiale & toolchain Sprint 0

- **Statut** : Accepté
- **Date** : 2026-05-06
- **Auteur** : Will + Claude (Opus 4.7)
- **Référence** : `AxionIA_Dossier_FINAL_ABSOLU_v10.1/CLAUDE.md` v6 §6, `_DECISIONS-FINALES.md`, `_AUDIT/02-PLAN.md` jalon M1

## Contexte

Sprint 0 = jalon M1 du plan d'implémentation. Doit livrer un repo Next.js bootstrappé, gates CI A→E configurées, observability en place, conventions verrouillées avant toute ligne de code métier (Sprint 1+).

Particularités à acter dès maintenant :

1. **Next.js 16.2.4 (au lieu de 15)** : `pnpm create next-app@latest` pull la stable courante. Le `axionia/AGENTS.md` injecté par le scaffold prévient explicitement « this is NOT the Next.js you know ». Les options expérimentales décrites dans `PROMPT-CODAGE.md` (`experimental.ppr`, `experimental.useCache`, `experimental.viewTransition`) doivent être revalidées contre `node_modules/next/dist/docs/` avant activation. Sprint 0 active uniquement `experimental.reactCompiler` qui est stable. Le reste atterrit Sprint 2 (layout) après lecture des guides.
2. **Auth.js v5 — version `5.0.0-beta.31`** : la v5 stable n'existe pas encore au moment du scaffold. La beta est utilisée largement en production par la communauté Next.js et est la voie officielle (`next-auth@beta`). À reconsidérer en Sprint 16 si une stable est sortie.
3. **Sous-repo Git** : `axionia/` a son propre `.git`. Le repo parent `Axion-IA/` reste l'umbrella docs/audits. Husky/lint-staged opèrent à l'intérieur du sous-repo.
4. **Pas de Stripe** : aucune dépendance facturation incluse. `_NO-STRIPE.md` fait foi.
5. **Email maison** : Resend / SendGrid / Mailgun / Brevo INTERDITS. Stack = PowerMTA + MailWizz self-hosted + Nodemailer + React Email. Cf. `axionia-emails/SKILL.md`.
6. **Observability dès Sprint 0** : Sentry (server + edge + client), endpoint `/api/vitals` (Edge runtime), Plausible stub. Pas d'OpenTelemetry SDK installé en Sprint 0 — `@vercel/otel` ou `@opentelemetry/sdk-node` arrivera quand on aura un endpoint OTLP self-hosted (Tempo/Jaeger Sprint 23).

## Décision

### Versions épinglées

| Couche        | Choix                                                                                                               | Note                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Framework     | `next@16.2.4`                                                                                                       | scaffold latest stable                 |
| React         | `react@19.2.4`                                                                                                      | fourni par Next 16                     |
| TS            | `typescript@^5` strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` + `noImplicitOverride`           | gates CI dès J1                        |
| Style         | `tailwindcss@^4` (Tailwind v4 + `@tailwindcss/postcss`)                                                             | tokens Webflow Sprint 1                |
| i18n          | `next-intl@^3.26`                                                                                                   | App Router compatible                  |
| Forms         | `react-hook-form@^7` + `zod@^3.25`                                                                                  | Server actions Sprint 17               |
| State serveur | `@tanstack/react-query@^5`                                                                                          |                                        |
| State client  | `zustand@^4.5`                                                                                                      |                                        |
| Animation     | `motion@^11.18`                                                                                                     | ex-Framer Motion                       |
| Auth          | `next-auth@5.0.0-beta.31`                                                                                           | aka Auth.js v5                         |
| DB            | `prisma@^5.22` + `@prisma/client@^5.22`                                                                             | Sprint 15 active                       |
| Queue         | `bullmq@^5` + `ioredis@^5`                                                                                          | Sprint 18 active                       |
| Email         | `nodemailer@^8` + `@react-email/components@^1` + `@react-email/render@^2`                                           | Sprint 19 active                       |
| Tests         | `vitest@^2` + `@playwright/test@^1.59` + `@axe-core/playwright@^4.11`                                               | tous configurés                        |
| LHCI          | `@lhci/cli@^0.15`                                                                                                   | desktop preset, mobile activé Sprint 5 |
| Sentry        | `@sentry/nextjs@^10.51`                                                                                             | server + edge + client                 |
| Lint          | `eslint@^9` flat config + `eslint-config-next@16.2.4` + `eslint-plugin-jsx-a11y@^6.10` + `@typescript-eslint@^8.59` |                                        |
| Quality gates | `husky@^9` + `lint-staged@^15` + `@commitlint/cli@^19`                                                              | hooks dès Sprint 0                     |
| Sécurité      | `argon2@^0.44` + `otplib@^13`                                                                                       | Sprint 16 active 2FA                   |
| Bundle        | `size-limit@^12` + `@next/bundle-analyzer`                                                                          | budget 100 KB JS first load            |

### Scripts npm

30+ scripts dans `package.json` couvrant dev/build/lint/test/format/CI/observability/Prisma. Un script par check de gate, un script par sprint critique futur.

### Hooks Husky

- `pre-commit` : `lint-staged` + 4 grep checks (formation/SIREN/hex/use-client).
- `commit-msg` : `commitlint` Conventional Commits.
- `pre-push` : `typecheck` + `i18n:check` + `zod:check` + `vitest`.

### Workflows GitHub Actions

- `ci.yml` : Gate A (per-commit) + Gate B (per-PR build/Playwright/LHCI) avec gitleaks.
- `staging.yml` : Gate C — déploiement Coolify webhook + smoke + ZAP baseline (stubs).
- `nightly.yml` : Gate D — full Playwright + audit deps + Mail-tester + backup drill (stubs).
- `release.yml` : Gate E — tag `v*` → prod + smoke + Telegram alert.
- `dependabot.yml` : weekly grouped PRs.

## Conséquences

**Positives**

- 0 dette technique à l'entrée du Sprint 1 ; toute violation détectée par CI.
- Mobile-first / a11y / i18n / anti-formation / anti-SIREN forcés dès le premier commit.
- Observability prête à recevoir des événements dès le premier visit local.
- Convention single-source : `_DECISIONS-FINALES.md` > `CLAUDE.md` v6 > skills `axionia-*` > génériques LOCKés > .docx.

**Négatives**

- Auth.js v5 sur beta — risque de breaking en Sprint 16. Mitigation : la communauté Next.js l'utilise déjà en prod, beta très stable.
- Next.js 16 = APIs partiellement non documentées dans le knowledge cutoff Claude — lire `node_modules/next/dist/docs/` avant chaque feature serveur côté Sprint 2+.
- `experimental.useCache`, `experimental.viewTransition`, `experimental.ppr` reportés — à valider contre la doc Next 16.

## Alternatives considérées

- **Vercel hosting** : écarté définitivement (cf. CLAUDE.md v6 §6, société estonienne UE → Hetzner).
- **Stripe billing** : écarté (cf. `_NO-STRIPE.md` — devis + virement + facture Indy).
- **Pure-JS argon2** : `@node-rs/argon2` envisageable si `argon2` (native) pose souci sur Windows ; on garde `argon2@0.44` pour le moment.
- **Mégapack archivé** : décision Will Q2=c — aucun skill archivé, mégapack conservé.
