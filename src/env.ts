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

    ADMIN_URL_PREFIX: z.string().min(4).optional(),
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

    SENTRY_DSN: z.string().url().optional(),
    SENTRY_AUTH_TOKEN: z.string().optional(),

    INDEXNOW_KEY: z.string().min(8).max(128).optional(),

    COMPANY_NAME: z.string().optional(),
    COMPANY_REGISTRATION_NUMBER: z.string().optional(),
    COMPANY_VAT_NUMBER: z.string().optional(),
    COMPANY_ADDRESS: z.string().optional(),
    COMPANY_EMAIL: z.string().email().optional(),
    COMPANY_DPO_EMAIL: z.string().email().optional(),
    COMPANY_PHONE: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
    NEXT_PUBLIC_APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
    NEXT_PUBLIC_DEFAULT_LOCALE: z.enum(["fr", "en"]).default("fr"),
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),
    NEXT_PUBLIC_PLAUSIBLE_DOMAIN: z.string().optional(),
    NEXT_PUBLIC_PLAUSIBLE_API_URL: z.string().url().optional(),
    NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
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
    SENTRY_DSN: process.env.SENTRY_DSN,
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
    INDEXNOW_KEY: process.env.INDEXNOW_KEY,
    COMPANY_NAME: process.env.COMPANY_NAME,
    COMPANY_REGISTRATION_NUMBER: process.env.COMPANY_REGISTRATION_NUMBER,
    COMPANY_VAT_NUMBER: process.env.COMPANY_VAT_NUMBER,
    COMPANY_ADDRESS: process.env.COMPANY_ADDRESS,
    COMPANY_EMAIL: process.env.COMPANY_EMAIL,
    COMPANY_DPO_EMAIL: process.env.COMPANY_DPO_EMAIL,
    COMPANY_PHONE: process.env.COMPANY_PHONE,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
    NEXT_PUBLIC_DEFAULT_LOCALE: process.env.NEXT_PUBLIC_DEFAULT_LOCALE,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    NEXT_PUBLIC_PLAUSIBLE_DOMAIN: process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN,
    NEXT_PUBLIC_PLAUSIBLE_API_URL: process.env.NEXT_PUBLIC_PLAUSIBLE_API_URL,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  },
  emptyStringAsUndefined: true,
  skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
});
