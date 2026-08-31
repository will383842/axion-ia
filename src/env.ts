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

    // Segment d'URL de l'admin (cf. src/lib/admin-path.ts ; fallback dev
    // `admin-dev-x7k2n9`). Optionnel.
    // NB : décision Will 2026-06-05 — validation assouplie (l'ancien durcissement
    // OWASP P2 imposait min(16) + refus du fallback dev en prod pour cacher l'admin
    // du brute-force). Compromis ASSUMÉ : URL d'admin simple/mémorisable >
    // obfuscation. Protection restante = mot de passe + rate-limit + lockout /login.
    // ⚠️ Si tu poses `ADMIN_URL_PREFIX=admin-dev-x7k2n9` (valeur publique du repo),
    // l'URL de login est connue de tous → repose uniquement sur le mot de passe.
    ADMIN_URL_PREFIX: z.string().min(1).optional(),
    ADMIN_EMAIL: z.string().email().optional(),

    SMTP_HOST: z.string().default("localhost"),
    SMTP_PORT: z.coerce.number().int().positive().default(2525),
    // 🔴 Audit du 2026-08-16 — ces deux variables n'étaient déclarées NULLE
    // PART, alors qu'elles décident à elles seules si la production parle à
    // Zoho en TLS authentifié ou retombe sur `localhost:2525` en clair (cf.
    // `assertTransportUtilisable` dans `src/lib/email/client.ts`).
    //
    // Volontairement `.optional()` et NON requises en production : le dev et
    // les tests tournent sans, et surtout une exigence bloquante ici ferait
    // échouer le BOOT du conteneur si les variables portaient un autre nom côté
    // Coolify — on transformerait un défaut d'e-mail en panne de site. Le refus
    // dur vit dans `client.ts`, au moment de l'envoi. Les déclarer ici les rend
    // typées, documentées, et visibles de quiconque lit la configuration.
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    // 🔴 Le defaut valait `noreply@axion-ia.com` jusqu'au 2026-08-31, et la
    // variable n'est posee nulle part : c'est donc ce defaut qui signait tous
    // les envois. Le referentiel e-mail (§3.2) l'interdit, et `client.ts`
    // refuse desormais activement toute adresse en `noreply@` (repli + log).
    // Le defaut est aligne ici pour que les deux disent la meme chose.
    SMTP_FROM_ADDRESS: z.string().email().default("contact@axion-ia.com"),
    SMTP_FROM_NAME: z.string().default("Axion-IA"),
    SMTP_FROM_MARKETING: z.string().email().default("news@axion-ia.com"),
    PMTA_API_URL: z.string().url().optional(),
    PMTA_API_KEY: z.string().optional(),
    MAILWIZZ_API_URL: z.string().url().optional(),
    MAILWIZZ_API_KEY: z.string().optional(),

    // ── Synchro sortante vers Axion CRM Pro (lot L2, 2026-08-14) ───────────
    // Drapeau MAÎTRE : tant qu'il ne vaut pas exactement "true", aucune ligne
    // d'outbox n'est écrite et aucun appel réseau n'est émis — le site se
    // comporte EXACTEMENT comme avant le lot. Rollback = repasser à "false".
    // Optionnelles toutes les quatre : un site sans CRM doit démarrer.
    CRM_SYNC_ENABLED: z.enum(["true", "false"]).optional(),
    // Second verrou, propre aux flux CANDIDATS. Ne s'ouvre qu'après que les
    // textes de consentement v2 sont servis en production (le CRM rejette de
    // toute façon toute fiche candidat sans consentement v2).
    CRM_SYNC_CANDIDATES_ENABLED: z.enum(["true", "false"]).optional(),
    CRM_SYNC_URL: z.string().url().optional(),
    // Secret partagé du canal signé (64 hex). Jamais dans un commit.
    SITE_SYNC_HMAC_SECRET: z.string().optional(),
    // ── Reprise du STOCK de candidatures (lot L4, 2026-08-14) ──────────────
    // Autorise l'ENVOI de l'email d'information au stock existant (fenêtre
    // d'opposition de 30 jours avant intégration au vivier). Distinct de
    // CRM_SYNC_CANDIDATES_ENABLED à dessein : on informe les candidats AVANT
    // d'ouvrir le canal CRM — c'est même l'ordre imposé, la fenêtre de 30 jours
    // devant s'écouler d'abord. Tant qu'il n'est pas à "true", la campagne
    // refuse de s'exécuter sans même lire la base.
    VIVIER_STOCK_ENABLED: z.enum(["true", "false"]).optional(),

    TELEGRAM_BOT_TOKEN: z.string().optional(),
    TELEGRAM_CHAT_ID: z.string().optional(),

    // Bot Telegram DÉDIÉ au groupe 📅 Calendly (2026-08-09). Absent = les
    // rendez-vous repartent sur le bot historique, dans le salon de repli
    // (`TELEGRAM_CHAT_ID_RDV`) — jamais dans le salon Calendly, où ce bot-là
    // n'est pas membre. Cf. `resolveTelegramTarget()` dans notifications/routing.ts.
    //
    // Les 9 `TELEGRAM_CHAT_ID_<GROUPE>` ne sont volontairement PAS déclarés ici :
    // ils sont lus par `process.env` direct dans `routing.ts`, comme les 3
    // existants depuis 2026-07-09. Les déclarer ici obligerait à toucher deux
    // fichiers pour ajouter un groupe.
    TELEGRAM_CALENDLY_BOT_TOKEN: z.string().optional(),

    // WhatsApp (CallMeBot) — notif GRATUITE des leads humains vers le numéro perso.
    // Optionnelles : sans elles le canal WhatsApp est un no-op silencieux (le reste
    // des notifs Telegram continue normalement). Cf. `src/server/notifications/channels/whatsapp.ts`.
    //   - WHATSAPP_CALLMEBOT_APIKEY : la clé renvoyée par le bot CallMeBot sur WhatsApp.
    //   - WHATSAPP_NOTIFY_PHONE     : le numéro destinataire au format international (ex. +33755512345).
    WHATSAPP_CALLMEBOT_APIKEY: z.string().optional(),
    WHATSAPP_NOTIFY_PHONE: z.string().optional(),

    TURNSTILE_SECRET_KEY: z.string().optional(),

    // Personal Access Token Calendly (API v2) — OPTIONNEL, cf. ADR 0036.
    // Absent = l'enrichissement des réservations est inerte et le produit se
    // comporte exactement comme avant (URI captées, contact à compléter à la
    // main). Posé = le serveur résout les URI du postMessage et remplit
    // automatiquement nom / email / téléphone / horaire / lien d'annulation.
    // À générer sur https://calendly.com/integrations/api_webhooks.
    // ⚠️ Server-only : ne JAMAIS l'exposer via NEXT_PUBLIC_*.
    CALENDLY_API_TOKEN: z.string().optional(),

    // Clé de signature du webhook Calendly (2026-08-09, ADR 0039).
    // Absente = `/api/calendly/webhook` répond 200 sans rien faire, et le
    // sondage BullMQ (≤ 60 s) reste le chemin nominal. Posée = livraison
    // instantanée (~2 s).
    //
    // 🔴 ÉTAT CONSTATÉ EN PRODUCTION LE 2026-08-31 : cette clé est ABSENTE, et
    // elle l'a toujours été — `calendly_events` ne contient pas une seule ligne
    // de source `webhook` depuis la création de la table. Le sondage porte donc
    // seul la découverte (≤ 60 s pour une création, ≤ 10 min pour une
    // annulation via le cron `refresh`). Ce n'est pas un oubli de configuration
    // mais une conséquence : voir ci-dessous.
    //
    // ⚠️ LA CAUSE N'EST PAS LE PLAN — ce commentaire a affirmé jusqu'au
    // 2026-08-31 qu'un plan Standard était exigé et que « le plan gratuit n'y a
    // pas droit ». C'est une cause qui n'avait jamais été mesurée. Mesuré
    // depuis : le jeton `CALENDLY_API_TOKEN` de production ne porte que
    // `event_types:read scheduled_events:read users:read`, sans aucune portée
    // `webhooks:*` — et Calendly ne crée un webhook QUE par API. Le script de
    // souscription ne pouvait donc pas aboutir, quel que soit le plan.
    // `GET /organizations/{uuid}` répondant lui aussi 403 faute de
    // `organizations:read`, le plan réel reste à ce jour NON VÉRIFIÉ : on sait
    // que la portée manque, on ne sait pas si le plan suffirait ensuite.
    //
    // ⛔ Geste pour activer : régénérer un jeton personnel Calendly incluant
    // `webhooks:read` ET `webhooks:write`, le poser dans CALENDLY_API_TOKEN,
    // puis lancer `pnpm calendly:webhook:subscribe` — il distingue désormais un
    // 403 de portée d'un 403 de plan au lieu de conclure au second.
    // La clé n'est affichée qu'UNE SEULE FOIS, à la création.
    CALENDLY_WEBHOOK_SIGNING_KEY: z.string().optional(),

    // ── Agenda Google — console « Agenda » (2026-08-26) ────────────────────
    // Accès en LECTURE ET ÉCRITURE à l'agenda de Will, par compte de service.
    // Les trois vont ensemble : il en manque une, le module est inerte et la
    // console affiche les seules réservations Calendly, en le disant.
    //
    // Pourquoi cet agenda et pas Calendly : il est le pivot mesuré de toute la
    // disponibilité. Calendly y écrit ses réservations, l'iPhone de Will y
    // écrit les siennes, et un événement posé ici ferme le créneau Calendly
    // correspondant en 11 secondes (mesuré le 2026-08-26). Lire cet agenda =
    // tout voir ; y écrire = fermer Calendly sans jamais lui parler.
    //
    // Mise en service : créer un compte de service dans Google Cloud, puis
    // PARTAGER l'agenda avec son adresse en « Apporter des modifications aux
    // événements ». Pas de délégation à l'échelle du domaine, pas d'écran de
    // consentement — ça fonctionne avec un Gmail personnel.
    GOOGLE_CALENDAR_CLIENT_EMAIL: z.string().optional(),
    // ⚠️ Clé privée PEM. Coolify et GitHub Actions transportent les sauts de
    // ligne en `\n` littéraux ; `auth.ts` les redéveloppe. Ne pas tenter de les
    // « corriger » à la main dans l'interface : les deux formes sont acceptées.
    GOOGLE_CALENDAR_PRIVATE_KEY: z.string().optional(),
    // L'agenda visé — l'adresse Gmail elle-même.
    GOOGLE_CALENDAR_ID: z.string().optional(),
    /**
     * 🔴 `D5-3-02` — clé d'authentification du webhook de rebonds ZeptoMail
     * (Agent > Webhooks > « Authentication Key »).
     *
     * `optional()` DÉLIBÉRÉMENT : tant qu'elle n'est pas posée, la route répond
     * 200 muet plutôt que d'échouer. ZeptoMail désabonne un webhook qui échoue
     * plusieurs fois de suite — la rendre obligatoire ferait détruire
     * l'abonnement par le déploiement qui précède sa configuration.
     */
    ZEPTOMAIL_WEBHOOK_KEY: z.string().optional(),

    // ────────────────────────────────────────────────────────────────
    // Stripe Checkout V1 (Sprint X.2 — Booking V1) + ADR 0013.
    // Cert plateforme 2026-05-16 — fail-fast au boot prod si une clé manque
    // (avant fix : throw lazy au premier appel SDK = revenu perdu sans alerte).
    // ────────────────────────────────────────────────────────────────
    /// Secret Stripe (server-only). Format `sk_(live|test)_*`. Required en prod.
    /// Si `STRIPE_LIVE_MODE=true` → DOIT être `sk_live_*` (refuse `sk_test_*`).
    STRIPE_SECRET_KEY: z
      .string()
      .regex(/^sk_(live|test)_/, "STRIPE_SECRET_KEY must start with sk_live_ or sk_test_")
      .optional()
      .superRefine((val, ctx) => {
        // Stripe NEUTRALISÉ par défaut → clé NON requise au boot prod (paiement
        // par virement/manuel). On vérifie seulement la cohérence LIVE si une
        // clé est fournie.
        if (val && process.env.STRIPE_LIVE_MODE === "true" && val.startsWith("sk_test_")) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "STRIPE_SECRET_KEY must be sk_live_* when STRIPE_LIVE_MODE=true",
          });
        }
      }),
    /// Clé publishable Stripe (server-validée mais exposable client via prop).
    /// Format `pk_(live|test)_*`. Required en prod.
    STRIPE_PUBLISHABLE_KEY: z
      .string()
      .regex(/^pk_(live|test)_/, "STRIPE_PUBLISHABLE_KEY must start with pk_live_ or pk_test_")
      .optional()
      .superRefine((val, ctx) => {
        // Stripe neutralisé → non requis au boot prod. Cohérence LIVE seulement.
        if (val && process.env.STRIPE_LIVE_MODE === "true" && val.startsWith("pk_test_")) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "STRIPE_PUBLISHABLE_KEY must be pk_live_* when STRIPE_LIVE_MODE=true",
          });
        }
      }),
    /// Secret webhook Stripe (HMAC `constructEvent`). Format `whsec_*`. Required prod.
    STRIPE_WEBHOOK_SECRET: z
      .string()
      .regex(/^whsec_/, "STRIPE_WEBHOOK_SECRET must start with whsec_")
      .min(20)
      .optional(),
    /// Interrupteur Stripe. ABSENT/false par défaut → paiement par virement /
    /// saisie manuelle. `true` (+ clés Stripe) réactive le paiement carte en ligne.
    STRIPE_ENABLED: z
      .string()
      .optional()
      .transform((v) => v === "true" || v === "1"),
    /// Toggle mode LIVE vs TEST. Si `true` → keys doivent être `sk_live_` + `pk_live_`.
    STRIPE_LIVE_MODE: z
      .string()
      .optional()
      .transform((v) => v === "true" || v === "1"),
    /// Version API Stripe pinnée (ex. `2024-11-20.acacia`). Optional — fallback SDK default.
    STRIPE_API_VERSION: z.string().optional(),

    // ────────────────────────────────────────────────────────────────
    // DocuSeal self-hosted (Sprint X.3 — Booking V1) + ADR 0014.
    // Cert plateforme 2026-05-16 — clés optionnelles par design (fallback mode
    // dégradé hybride manuel admin upload PDF). Mais si une seule est définie,
    // toutes doivent l'être : superRefine cohérence trio URL+API+webhook.
    // ────────────────────────────────────────────────────────────────
    /// URL base DocuSeal self-hosted (ex. `https://signature.axion-ia.com`).
    DOCUSEAL_BASE_URL: z.string().url().optional(),
    /// Token X-Auth-Token DocuSeal API.
    DOCUSEAL_API_KEY: z.string().min(16).optional(),
    /// HMAC secret webhook DocuSeal (header `X-Docuseal-Signature`).
    DOCUSEAL_WEBHOOK_SECRET: z.string().min(16).optional(),
    /// IDs templates DocuSeal — devis + contrat. Optionnels (skip flow auto si absents).
    DOCUSEAL_QUOTE_TEMPLATE_ID: z.string().optional(),
    DOCUSEAL_CONTRACT_TEMPLATE_ID: z.string().optional(),

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

    // ⚠️ 2026-08-31 — CES QUATRE VARIABLES N'ONT PLUS AUCUN LECTEUR.
    //
    // Elles alimentaient le pied de page légal des e-mails. Leur repli était la
    // CHAÎNE VIDE, filtrée en silence : un e-mail rendu sans elles partait sans
    // adresse de siège ni SIREN — ce que la LCEN art. 1-1 impose d'afficher. Et
    // le worker qui rend les e-mails est une application Coolify DISTINCTE, avec
    // son propre environnement : rien ne garantissait qu'elles y soient posées.
    //
    // L'identité légale est désormais figée dans `src/lib/email/legal-footer.ts`,
    // pour le même motif que l'adresse du siège dans `src/lib/seo.ts` : une
    // adresse immatriculée n'est pas un réglage, et la rendre configurable
    // garantissait la divergence (constatée le 02/08/2026, deux adresses en
    // production pour la même entité).
    //
    // Elles restent DÉCLARÉES pour ne pas faire échouer un environnement qui les
    // porte encore — mais les poser ne change plus rien. Ne pas les rétablir
    // comme source : modifier `legal-footer.ts`, que `legal-footer.spec.ts` tient
    // aligné sur les SSOT du dépôt.
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
    // Audit B5 P0-7 — extension purge content-gen / cost ledger / RUM.
    RETENTION_GENERATION_LOGS_MONTHS: z.coerce.number().int().min(1).optional(),
    RETENTION_COST_LEDGER_MONTHS: z.coerce.number().int().min(1).optional(),
    RETENTION_WEB_VITALS_MONTHS: z.coerce.number().int().min(1).optional(),
    // Tunnels d'acquisition. Défaut 12 mois côté worker — sous le plafond de
    // 13 mois de la CNIL pour la mesure d'audience, dont dépend l'absence de
    // bannière sur les pages de tunnel.
    RETENTION_FUNNEL_EVENTS_MONTHS: z.coerce.number().int().min(1).optional(),
    // Candidatures : 24 mois, recommandation CNIL pour un candidat non
    // retenu. La purge supprime AUSSI le CV et la photo sur le disque.
    RETENTION_CANDIDATURES_MONTHS: z.coerce.number().int().min(1).optional(),

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
    /// HMAC secret ingestion statut backups depuis scripts cron VPS + CI (ADR 0032).
    /// Min 32 chars enforcé runtime par `getBackupIngestSecret()` (src/lib/backups/hmac.ts).
    BACKUP_INGEST_SECRET: z.string().min(32).optional(),
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

    // ────────────────────────────────────────────────────────────────
    // PII at-rest encryption — Méta-cert 2026-05-15 AGENT 12 P0 OWASP A02.
    // Cf. `src/lib/pii-crypto.ts` + ADR 0025.
    // ────────────────────────────────────────────────────────────────
    /// Clé AES-256-GCM hex 64 chars (32 bytes) pour chiffrement application-level
    /// des champs PII Submission (contactEmail/Name/Phone). En dev sans clé →
    /// pass-through clear text (fallback gracieux + warn log). En prod sans clé
    /// → fail-fast au boot (superRefine).
    /// Génération : `openssl rand -hex 32` (à archiver 1Password + papier).
    PII_ENCRYPTION_KEY: z
      .string()
      .regex(/^[0-9a-fA-F]{64}$/, "PII_ENCRYPTION_KEY must be 64 hex chars (32 bytes)")
      .optional()
      .superRefine((val, ctx) => {
        if (process.env.NODE_ENV !== "production") return;
        if (!val) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "PII_ENCRYPTION_KEY is required in production (Submission PII at-rest)",
          });
        }
      }),

    // ─── Banque d'images — GEO-094 (audit GEO/AEO 2026-08-14) ────────────────
    //
    // 🔴 Ces deux variables étaient utilisées dans le code SANS être déclarées
    // ici ni dans aucun `.env*.example`. Conséquence mesurée : chaque appelant
    // repliait sur SON propre défaut, et ces défauts divergeaient
    // (`/var/data/image-bank` à l'écriture, `/data/image-bank` à la lecture) —
    // on lisait dans un dossier où rien n'a jamais été écrit.
    //
    // Les déclarer ici ne change aucun comportement par défaut ; ça rend
    // simplement la configuration VISIBLE, et une divergence future détectable.
    /** Racine du volume de stockage des variantes. Défaut : `/var/data/image-bank`. */
    IMAGE_BANK_STORAGE_PATH: z.string().min(1).optional(),
    /** Préfixe CDN servant `/image-bank/*`. Vide = servi par la même origine. */
    IMAGE_BANK_CDN_URL: z.string().url().optional(),

    // ─── Console éditoriale — stockage des médias ────────────────────────
    //
    // 🔴 Même défaut que GEO-094 ci-dessus, reproduit un an plus tard :
    // `EDITORIAL_STORAGE_PATH` était lu par `server/editorial/stockage.ts`
    // sans être déclaré ici ni dans aucun `.env*.example`. La leçon de la
    // banque d'images était écrite à trois lignes de distance, et je ne
    // l'ai pas appliquée.
    //
    // ⚠️ Volume DÉDIÉ, distinct de celui de la banque d'images. Les deux
    // stockent des fichiers utilisateur, mais avec des cycles de vie sans
    // rapport : une variante d'image se régénère, un rush de tournage ne se
    // régénère pas. Les mélanger ferait qu'un nettoyage de l'un emporterait
    // l'autre.
    //
    // 🔑 Sans volume monté à ce chemin, les fichiers déposés vivent dans la
    // couche éphémère du conteneur et DISPARAISSENT au redéploiement — sans
    // erreur, sans trace, et la fiche continuera d'afficher un asset qui
    // pointe vers un fichier absent.
    /** Racine du volume des médias éditoriaux. Défaut : `/var/data/editorial-media`. */
    EDITORIAL_STORAGE_PATH: z.string().min(1).optional(),
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
    /**
     * LinkedIn Insight Tag — « Partner ID » numérique fourni par LinkedIn
     * Campaign Manager (Paramètres du compte → Insight Tag). Absent tant
     * qu'aucun compte publicitaire n'existe : le composant rend alors `null`
     * et AUCUNE requête n'est émise. Ne sert QU'au retargeting publicitaire —
     * la mesure d'audience passe par Plausible, et l'attribution des
     * réservations par les UTM lus dans `/appel`.
     */
    NEXT_PUBLIC_LINKEDIN_PARTNER_ID: z.string().optional(),
    // Kill-switch PUBLIC du widget chatbot (T-08). "true" → la bulle se monte
    // côté client (île idle). Tant que non défini / != "true", le widget ne
    // monte rien et n'émet aucune requête. Pendant client de la garde serveur
    // `CHATBOT_ENABLED` (route SSE) — D-PROD : Will active les deux pour la prod.
    NEXT_PUBLIC_CHATBOT_ENABLED: z.enum(["true", "false"]).optional(),
    // Canary par page (T-25) : liste de préfixes de chemin séparés par des
    // virgules où le widget est autorisé (ex. "/fr/audit,/fr/implementation").
    // Vide / non défini = toutes les pages (rollout global). Permet d'activer
    // d'abord sur une page avant généralisation.
    NEXT_PUBLIC_CHATBOT_PAGES: z.string().optional(),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    IMAGE_BANK_STORAGE_PATH: process.env.IMAGE_BANK_STORAGE_PATH,
    EDITORIAL_STORAGE_PATH: process.env.EDITORIAL_STORAGE_PATH,
    IMAGE_BANK_CDN_URL: process.env.IMAGE_BANK_CDN_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    REDIS_URL: process.env.REDIS_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_URL: process.env.AUTH_URL,
    ADMIN_URL_PREFIX: process.env.ADMIN_URL_PREFIX,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    SMTP_FROM_ADDRESS: process.env.SMTP_FROM_ADDRESS,
    SMTP_FROM_NAME: process.env.SMTP_FROM_NAME,
    SMTP_FROM_MARKETING: process.env.SMTP_FROM_MARKETING,
    PMTA_API_URL: process.env.PMTA_API_URL,
    PMTA_API_KEY: process.env.PMTA_API_KEY,
    MAILWIZZ_API_URL: process.env.MAILWIZZ_API_URL,
    MAILWIZZ_API_KEY: process.env.MAILWIZZ_API_KEY,
    CRM_SYNC_ENABLED: process.env.CRM_SYNC_ENABLED,
    CRM_SYNC_CANDIDATES_ENABLED: process.env.CRM_SYNC_CANDIDATES_ENABLED,
    CRM_SYNC_URL: process.env.CRM_SYNC_URL,
    SITE_SYNC_HMAC_SECRET: process.env.SITE_SYNC_HMAC_SECRET,
    VIVIER_STOCK_ENABLED: process.env.VIVIER_STOCK_ENABLED,
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CALENDLY_BOT_TOKEN: process.env.TELEGRAM_CALENDLY_BOT_TOKEN,
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
    WHATSAPP_CALLMEBOT_APIKEY: process.env.WHATSAPP_CALLMEBOT_APIKEY,
    WHATSAPP_NOTIFY_PHONE: process.env.WHATSAPP_NOTIFY_PHONE,
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
    CALENDLY_API_TOKEN: process.env.CALENDLY_API_TOKEN,
    CALENDLY_WEBHOOK_SIGNING_KEY: process.env.CALENDLY_WEBHOOK_SIGNING_KEY,
    GOOGLE_CALENDAR_CLIENT_EMAIL: process.env.GOOGLE_CALENDAR_CLIENT_EMAIL,
    GOOGLE_CALENDAR_PRIVATE_KEY: process.env.GOOGLE_CALENDAR_PRIVATE_KEY,
    GOOGLE_CALENDAR_ID: process.env.GOOGLE_CALENDAR_ID,
    ZEPTOMAIL_WEBHOOK_KEY: process.env.ZEPTOMAIL_WEBHOOK_KEY,
    // Stripe Checkout V1 (Booking V1 — ADR 0013)
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_ENABLED: process.env.STRIPE_ENABLED,
    STRIPE_LIVE_MODE: process.env.STRIPE_LIVE_MODE,
    STRIPE_API_VERSION: process.env.STRIPE_API_VERSION,
    // DocuSeal self-hosted (Booking V1 — ADR 0014)
    DOCUSEAL_BASE_URL: process.env.DOCUSEAL_BASE_URL,
    DOCUSEAL_API_KEY: process.env.DOCUSEAL_API_KEY,
    DOCUSEAL_WEBHOOK_SECRET: process.env.DOCUSEAL_WEBHOOK_SECRET,
    DOCUSEAL_QUOTE_TEMPLATE_ID: process.env.DOCUSEAL_QUOTE_TEMPLATE_ID,
    DOCUSEAL_CONTRACT_TEMPLATE_ID: process.env.DOCUSEAL_CONTRACT_TEMPLATE_ID,
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
    RETENTION_GENERATION_LOGS_MONTHS: process.env.RETENTION_GENERATION_LOGS_MONTHS,
    RETENTION_COST_LEDGER_MONTHS: process.env.RETENTION_COST_LEDGER_MONTHS,
    RETENTION_WEB_VITALS_MONTHS: process.env.RETENTION_WEB_VITALS_MONTHS,
    RETENTION_FUNNEL_EVENTS_MONTHS: process.env.RETENTION_FUNNEL_EVENTS_MONTHS,
    RETENTION_CANDIDATURES_MONTHS: process.env.RETENTION_CANDIDATURES_MONTHS,
    // Content Generator V1 (Sprint 1 Day 1 AGT-B)
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY,
    UNSPLASH_ACCESS_KEY: process.env.UNSPLASH_ACCESS_KEY,
    VOYAGE_API_KEY: process.env.VOYAGE_API_KEY,
    KB_INGEST_SECRET: process.env.KB_INGEST_SECRET,
    BACKUP_INGEST_SECRET: process.env.BACKUP_INGEST_SECRET,
    KB_AUTO_PUBLISH: process.env.KB_AUTO_PUBLISH,
    KB_BYPASS: process.env.KB_BYPASS,
    // Image Bank (Sprint M? — axionia-image-bank skill v1.0)
    IP_HASH_SALT: process.env.IP_HASH_SALT,
    IMAGE_AUTO_PUBLISH_SCORE: process.env.IMAGE_AUTO_PUBLISH_SCORE,
    RETENTION_IMAGE_LOGS_MONTHS: process.env.RETENTION_IMAGE_LOGS_MONTHS,
    // PII at-rest (Méta-cert 2026-05-15 AGENT 12 P0)
    PII_ENCRYPTION_KEY: process.env.PII_ENCRYPTION_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
    NEXT_PUBLIC_DEFAULT_LOCALE: process.env.NEXT_PUBLIC_DEFAULT_LOCALE,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    NEXT_PUBLIC_PLAUSIBLE_DOMAIN: process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN,
    NEXT_PUBLIC_PLAUSIBLE_API_URL: process.env.NEXT_PUBLIC_PLAUSIBLE_API_URL,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_CLARITY_PROJECT_ID: process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID,
    NEXT_PUBLIC_LINKEDIN_PARTNER_ID: process.env.NEXT_PUBLIC_LINKEDIN_PARTNER_ID,
    NEXT_PUBLIC_CHATBOT_ENABLED: process.env.NEXT_PUBLIC_CHATBOT_ENABLED,
    NEXT_PUBLIC_CHATBOT_PAGES: process.env.NEXT_PUBLIC_CHATBOT_PAGES,
  },
  emptyStringAsUndefined: true,
  skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
});
