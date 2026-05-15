import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().url().optional(),
    DIRECT_URL: z.string().url().optional(),
    REDIS_URL: z.string().url().optional(),

    // Sprint 15 fix Fork 3 C3-3 : superRefine en prod (min 32, refuse dev_*).
    AUTH_SECRET: z
      .string()
      .min(32)
      .optional()
      .superRefine((val, ctx) => {
        if (process.env.NODE_ENV !== "production") return;
        if (!val) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "AUTH_SECRET is required in production",
          });
          return;
        }
        if (val.startsWith("dev_") || val.startsWith("dev-")) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "AUTH_SECRET must not start with 'dev_' in production",
          });
        }
      }),
    AUTH_URL: z.string().url().optional(),

    // P2 audit OWASP-RUNTIME — durci de min(4) → min(16) + refus dev fallback en prod.
    // ADMIN_URL_PREFIX agit comme secret URL pour eviter brute-force admin —
    // 16 chars random alphanumeriques = entropie ~96 bits. La valeur dev
    // `admin-dev-x7k2n9` (publique dans le repo) doit etre refusee en prod.
    ADMIN_URL_PREFIX: z
      .string()
      .min(16)
      .optional()
      .superRefine((val, ctx) => {
        if (process.env.NODE_ENV !== "production") return;
        if (!val) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "ADMIN_URL_PREFIX is required in production",
          });
          return;
        }
        if (val.startsWith("admin-dev") || val === "admin-dev-x7k2n9") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "ADMIN_URL_PREFIX must not use the public dev fallback in production",
          });
        }
      }),
    ADMIN_EMAIL: z.string().email().optional(),

    SMTP_HOST: z.string().default("localhost"),
    SMTP_PORT: z.coerce.number().int().positive().default(2525),
    SMTP_FROM_ADDRESS: z.string().email().default("noreply@axion-ia.com"),
    SMTP_FROM_NAME: z.string().default("Axion-IA"),
    SMTP_FROM_MARKETING: z.string().email().default("news@axion-ia.com"),
    PMTA_API_URL: z.string().url().optional(),
    PMTA_API_KEY: z.string().optional(),
    MAILWIZZ_API_URL: z.string().url().optional(),
    MAILWIZZ_API_KEY: z.string().optional(),

    TELEGRAM_BOT_TOKEN: z.string().optional(),
    TELEGRAM_CHAT_ID: z.string().optional(),

    TURNSTILE_SECRET_KEY: z.string().optional(),

    HETZNER_STORAGE_ENDPOINT: z.string().optional(),
    HETZNER_STORAGE_BUCKET: z.string().optional(),
    HETZNER_STORAGE_KEY: z.string().optional(),
    HETZNER_STORAGE_SECRET: z.string().optional(),
    // P0-OPS-1 fix audit OWASP-RUNTIME — vars SSH rsync requises pour
    // scripts/backup-postgres.sh + restore-postgres-test.sh. Sans elles
    // le cron quotidien crash → 0 backup chiffré pendant N jours.
    HETZNER_STORAGE_USER: z.string().optional(),
    HETZNER_STORAGE_HOST: z.string().optional(),
    // P0-OPS-2 fix — passphrase AES-256 backups. ≥ 32 chars random,
    // refuse fallback dev en prod (superRefine).
    BACKUP_ENCRYPTION_PASSPHRASE: z
      .string()
      .min(32)
      .optional()
      .superRefine((val, ctx) => {
        if (process.env.NODE_ENV !== "production") return;
        if (!val) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "BACKUP_ENCRYPTION_PASSPHRASE is required in production",
          });
          return;
        }
        if (val.startsWith("dev_") || val.startsWith("dev-")) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "BACKUP_ENCRYPTION_PASSPHRASE must not start with 'dev_' in production",
          });
        }
      }),

    SENTRY_DSN: z.string().url().optional(),
    SENTRY_AUTH_TOKEN: z.string().optional(),

    INDEXNOW_KEY: z.string().min(8).max(128).optional(),

    // D3 cert 2026-05-08 — verification meta GSC + Bing Webmaster Tools.
    // Sans property vérifiée, pas de coverage report ni URL Inspection API.
    // En prod 2026-05-13 : GSC vérifié par DNS TXT (Domain property),
    // Bing par Import OAuth GSC → ces env vars restent optional pour
    // fallback méthode meta tag si on en a besoin un jour.
    GOOGLE_SITE_VERIFICATION: z.string().optional(),
    BING_SITE_VERIFICATION: z.string().optional(),

    // P2-29 (audit re-run 2026-05-15) — PageSpeed Insights API key (gratuit
    // illimité avec clé, throttled 1 req/60s sans clé). Server-only car la
    // clé peut être restrictée par referrer côté GCP Console. Si absent,
    // le worker `content-psi-monitor-worker` skip silencieusement.
    GOOGLE_PSI_API_KEY: z.string().optional(),

    // 2026-05-13 — URL Plausible "Shared Dashboard" pour embed iframe dans
    // l'admin (/fr/{prefix}/analytics). Format :
    //   https://plausible.axion-ia.com/share/axion-ia.com?auth=TOKEN&embed=true&theme=light
    // Générée depuis Plausible UI > Site Settings > Visibility > Add a shared link.
    // Server-only (URL = token d'accès, ne doit pas leak dans le bundle public).
    PLAUSIBLE_SHARED_LINK: z.string().url().optional(),

    COMPANY_NAME: z.string().optional(),
    COMPANY_REGISTRATION_NUMBER: z.string().optional(),
    COMPANY_VAT_NUMBER: z.string().optional(),
    COMPANY_ADDRESS: z.string().optional(),
    COMPANY_EMAIL: z.string().email().optional(),
    COMPANY_DPO_EMAIL: z.string().email().optional(),
    COMPANY_PHONE: z.string().optional(),

    // Sprint 24 / D3 — RGPD retention-purge worker (cron daily 03:00 UTC).
    // Toutes optionnelles (defaults dans le worker). Doit être ≥ 1 mois sinon
    // ignorée (anti-misconfig accidentel qui supprimerait toute la base).
    RETENTION_LOGS_MONTHS: z.coerce.number().int().min(1).optional(),
    RETENTION_SUBS_ARCHIVE_MONTHS: z.coerce.number().int().min(1).optional(),
    RETENTION_NEWSLETTER_UNSUB_MONTHS: z.coerce.number().int().min(1).optional(),
    RETENTION_BOOKINGS_CANCELLED_MONTHS: z.coerce.number().int().min(1).optional(),
    // Audit B5 P0-7 — extension purge content-gen / cost ledger / RUM.
    RETENTION_GENERATION_LOGS_MONTHS: z.coerce.number().int().min(1).optional(),
    RETENTION_COST_LEDGER_MONTHS: z.coerce.number().int().min(1).optional(),
    RETENTION_WEB_VITALS_MONTHS: z.coerce.number().int().min(1).optional(),

    // Content Generator V1 (Sprint 1 Day 1 AGT-B) — providers IA + KB ingest.
    // Toutes optional V1 : le BUILD continue sans elles ; seul le RUN (génération
    // live) les exige. Mockés tant que les clés ne sont pas dans Coolify env.
    // Cf. _AUDIT/PROMPT-CONTENT-GENERATOR-MASTER-2026.md § 24.1 + Annexe A.
    OPENAI_API_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    PERPLEXITY_API_KEY: z.string().optional(),
    UNSPLASH_ACCESS_KEY: z.string().optional(),
    /// Voyage AI key pour embeddings KB V4 (`voyage-3-lite` dim 1024).
    /// Sans clé → fallback stub déterministe SHA-256 (cf. src/lib/knowledge/embeddings.ts).
    VOYAGE_API_KEY: z.string().optional(),
    /// HMAC secret factory ingest API (cf. src/lib/knowledge/hmac.ts).
    /// Min 32 chars enforcé runtime par `getKbIngestSecret()` quand utilisé.
    KB_INGEST_SECRET: z.string().min(32).optional(),
    /// Toggle publication immédiate KB depuis factory content-gen (V1 default OFF
    /// → audience='team' review manuel admin /connaissances/).
    KB_AUTO_PUBLISH: z
      .string()
      .optional()
      .transform((v) => v === "true" || v === "1"),
    /// Mode dégradé V0 transitoire : désactive hard gate KB ≥ 50 entries.
    /// Banner rouge admin si actif. Jamais en prod.
    KB_BYPASS: z
      .string()
      .optional()
      .transform((v) => v === "true" || v === "1"),

    // ────────────────────────────────────────────────────────────────
    // Image Bank (Sprint M? — axionia-image-bank skill v1.0).
    // Cf. `.claude/skills/axionia-image-bank/SKILL.md` + spec maître
    // `_AUDIT/PROMPT-IMAGE-BANK-MASTER-2026.md` § 9.
    // ────────────────────────────────────────────────────────────────
    /// Salt SHA-256 pour hash IP RGPD (`ImageUsageLog.ip_hash`).
    /// Required ≥ 32 chars en prod (superRefine). Fallback dev gracieux
    /// pour `pnpm dev` sans secret (warn log + salt non-secret prévisible).
    IP_HASH_SALT: z
      .string()
      .min(32)
      .optional()
      .superRefine((val, ctx) => {
        if (process.env.NODE_ENV !== "production") return;
        if (!val) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "IP_HASH_SALT is required in production (image-bank RGPD)",
          });
          return;
        }
        if (val.startsWith("dev_") || val.startsWith("dev-") || val === "dev-insecure-salt") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "IP_HASH_SALT must not use the dev fallback in production",
          });
        }
      }),
    /// Auto-publish image translations dès SEO score ≥ ce seuil (worker enrich).
    /// Default 999 = jamais auto-publish (review admin manuel). En prod recommandé
    /// 80 pour pipeline FR-only fluide, 999 pour gate humain strict.
    IMAGE_AUTO_PUBLISH_SCORE: z.coerce.number().int().min(0).max(100).optional(),
    /// Rétention image_usage_logs en mois (worker `retention-purge-worker`).
    /// Default 12 mois si non défini.
    RETENTION_IMAGE_LOGS_MONTHS: z.coerce.number().int().min(1).optional(),
  },
  client: {
    NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
    NEXT_PUBLIC_APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
    NEXT_PUBLIC_DEFAULT_LOCALE: z.enum(["fr", "en"]).default("fr"),
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),
    NEXT_PUBLIC_PLAUSIBLE_DOMAIN: z.string().optional(),
    NEXT_PUBLIC_PLAUSIBLE_API_URL: z.string().url().optional(),
    NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
    // Microsoft Clarity project ID (heatmaps + session replay + frustration signals).
    // Public alphanumeric (~10 chars). Méta-cert 2026-05-15 AGENT 21 — Clarity
    // est désormais GATÉ sur consent CMP (`src/components/analytics/CookieConsent.tsx`)
    // donc cookies déposés uniquement post-accept visiteur. No-op si non défini.
    // DPA Microsoft à signer côté Will + entry dans `subprocessors.ts` (déclarée).
    NEXT_PUBLIC_CLARITY_PROJECT_ID: z.string().optional(),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    REDIS_URL: process.env.REDIS_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_URL: process.env.AUTH_URL,
    ADMIN_URL_PREFIX: process.env.ADMIN_URL_PREFIX,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_FROM_ADDRESS: process.env.SMTP_FROM_ADDRESS,
    SMTP_FROM_NAME: process.env.SMTP_FROM_NAME,
    SMTP_FROM_MARKETING: process.env.SMTP_FROM_MARKETING,
    PMTA_API_URL: process.env.PMTA_API_URL,
    PMTA_API_KEY: process.env.PMTA_API_KEY,
    MAILWIZZ_API_URL: process.env.MAILWIZZ_API_URL,
    MAILWIZZ_API_KEY: process.env.MAILWIZZ_API_KEY,
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
    HETZNER_STORAGE_ENDPOINT: process.env.HETZNER_STORAGE_ENDPOINT,
    HETZNER_STORAGE_BUCKET: process.env.HETZNER_STORAGE_BUCKET,
    HETZNER_STORAGE_KEY: process.env.HETZNER_STORAGE_KEY,
    HETZNER_STORAGE_SECRET: process.env.HETZNER_STORAGE_SECRET,
    HETZNER_STORAGE_USER: process.env.HETZNER_STORAGE_USER,
    HETZNER_STORAGE_HOST: process.env.HETZNER_STORAGE_HOST,
    BACKUP_ENCRYPTION_PASSPHRASE: process.env.BACKUP_ENCRYPTION_PASSPHRASE,
    SENTRY_DSN: process.env.SENTRY_DSN,
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
    INDEXNOW_KEY: process.env.INDEXNOW_KEY,
    GOOGLE_SITE_VERIFICATION: process.env.GOOGLE_SITE_VERIFICATION,
    GOOGLE_PSI_API_KEY: process.env.GOOGLE_PSI_API_KEY,
    BING_SITE_VERIFICATION: process.env.BING_SITE_VERIFICATION,
    PLAUSIBLE_SHARED_LINK: process.env.PLAUSIBLE_SHARED_LINK,
    COMPANY_NAME: process.env.COMPANY_NAME,
    COMPANY_REGISTRATION_NUMBER: process.env.COMPANY_REGISTRATION_NUMBER,
    COMPANY_VAT_NUMBER: process.env.COMPANY_VAT_NUMBER,
    COMPANY_ADDRESS: process.env.COMPANY_ADDRESS,
    COMPANY_EMAIL: process.env.COMPANY_EMAIL,
    COMPANY_DPO_EMAIL: process.env.COMPANY_DPO_EMAIL,
    COMPANY_PHONE: process.env.COMPANY_PHONE,
    RETENTION_LOGS_MONTHS: process.env.RETENTION_LOGS_MONTHS,
    RETENTION_SUBS_ARCHIVE_MONTHS: process.env.RETENTION_SUBS_ARCHIVE_MONTHS,
    RETENTION_NEWSLETTER_UNSUB_MONTHS: process.env.RETENTION_NEWSLETTER_UNSUB_MONTHS,
    RETENTION_BOOKINGS_CANCELLED_MONTHS: process.env.RETENTION_BOOKINGS_CANCELLED_MONTHS,
    RETENTION_GENERATION_LOGS_MONTHS: process.env.RETENTION_GENERATION_LOGS_MONTHS,
    RETENTION_COST_LEDGER_MONTHS: process.env.RETENTION_COST_LEDGER_MONTHS,
    RETENTION_WEB_VITALS_MONTHS: process.env.RETENTION_WEB_VITALS_MONTHS,
    // Content Generator V1 (Sprint 1 Day 1 AGT-B)
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY,
    UNSPLASH_ACCESS_KEY: process.env.UNSPLASH_ACCESS_KEY,
    VOYAGE_API_KEY: process.env.VOYAGE_API_KEY,
    KB_INGEST_SECRET: process.env.KB_INGEST_SECRET,
    KB_AUTO_PUBLISH: process.env.KB_AUTO_PUBLISH,
    KB_BYPASS: process.env.KB_BYPASS,
    // Image Bank (Sprint M? — axionia-image-bank skill v1.0)
    IP_HASH_SALT: process.env.IP_HASH_SALT,
    IMAGE_AUTO_PUBLISH_SCORE: process.env.IMAGE_AUTO_PUBLISH_SCORE,
    RETENTION_IMAGE_LOGS_MONTHS: process.env.RETENTION_IMAGE_LOGS_MONTHS,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
    NEXT_PUBLIC_DEFAULT_LOCALE: process.env.NEXT_PUBLIC_DEFAULT_LOCALE,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    NEXT_PUBLIC_PLAUSIBLE_DOMAIN: process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN,
    NEXT_PUBLIC_PLAUSIBLE_API_URL: process.env.NEXT_PUBLIC_PLAUSIBLE_API_URL,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_CLARITY_PROJECT_ID: process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID,
  },
  emptyStringAsUndefined: true,
  skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
});
