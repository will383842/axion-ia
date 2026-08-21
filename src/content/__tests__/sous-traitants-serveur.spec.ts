/**
 * 🔴 `D9-5-10` — l'autre moitié de la surface des sous-traitants.
 *
 * ## Le défaut que ce fichier ferme
 *
 * `/sous-processeurs` se déclare « **liste exhaustive** » (RGPD art. 13.1.e).
 * Elle omettait **ZeptoMail** — le relais SMTP qui achemine la TOTALITÉ des
 * e-mails du site, et à qui chaque envoi confie l'adresse du destinataire et le
 * corps complet du message.
 *
 * ## Pourquoi la garde existante ne pouvait pas le voir
 *
 * `subprocessors-coherence.spec.ts` a été écrite le 2026-07-26 après l'omission
 * de Calendly, et elle est adossée à `src/lib/csp.ts` — décrite dans le code
 * comme « le seul goulot qu'un tiers ne peut pas contourner pour charger ».
 *
 * L'affirmation est vraie des tiers qui chargent **dans le navigateur du
 * visiteur**. Elle est fausse de tous les autres : un relais SMTP appelé depuis
 * le worker BullMQ ne traverse aucune CSP, un client d'API serveur non plus.
 * La garde couvrait donc une moitié de la surface **en paraissant la couvrir
 * entière** — et rien, nulle part, ne le disait.
 *
 * 🔑 C'est le défaut que l'omission de Calendly avait censément fermé,
 * reproduit un étage plus bas. Une garde n'est jamais « la » garde : elle a un
 * périmètre, et le périmètre non couvert doit être nommé, sinon il se lit comme
 * couvert.
 *
 * ## Le point d'ancrage retenu, et pourquoi celui-là
 *
 * `src/env.ts`. Un tiers appelé **depuis le serveur** a nécessairement besoin
 * d'une URL ou d'un secret, et dans ce dépôt ils sont tous déclarés là. C'est le
 * goulot symétrique de la CSP : ce qu'un tiers ne peut pas contourner pour être
 * JOIGNABLE.
 *
 * Chaque variable de forme « tiers » doit donc être rattachée à un
 * sous-traitant de la SSOT, **ou** porter une exemption écrite. Une variable
 * nouvelle et non classée fait rougir ce fichier — c'est-à-dire qu'ajouter une
 * intégration force une décision, au lieu de la reporter indéfiniment.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SUBPROCESSORS } from "../subprocessors";

const RACINE = process.cwd();

/**
 * Variables d'environnement de forme « tiers » : une URL, un secret, une clé.
 * Volontairement LARGE — mieux vaut classer une variable inoffensive que rater
 * l'intégration qui achemine les e-mails.
 */
const FORME_TIERS = /_API_KEY$|_TOKEN$|^SMTP_|_SECRET$|_KEY$|_DSN$|_URL$/;

/** Rattachement à un sous-traitant de la SSOT. */
type Rattachement = { readonly tiers: string } | { readonly exempt: string };

/**
 * ⚠️ `tiers` doit correspondre au DÉBUT du `name` d'une entrée de
 * `SUBPROCESSORS`. `exempt` exige un motif — on ne raye pas une variable, on
 * écrit pourquoi elle ne désigne pas un sous-traitant.
 */
const CLASSEMENT: Readonly<Record<string, Rattachement>> = {
  // ── Infrastructure auto-hébergée : Axion-IA est seule responsable ──────────
  DATABASE_URL: { exempt: "Postgres auto-hébergé sur le VPS — cf. Hetzner, déjà déclaré." },
  DIRECT_URL: { exempt: "Même base Postgres, connexion directe (migrations Prisma)." },
  REDIS_URL: { exempt: "Redis auto-hébergé sur le VPS — cf. Hetzner, déjà déclaré." },
  AUTH_URL: { exempt: "URL du site lui-même (NextAuth). Aucun tiers." },
  IMAGE_BANK_CDN_URL: {
    exempt: "Sert les images depuis le domaine du site via Cloudflare, déjà déclaré.",
  },

  // ── Le relais d'e-mails — LE constat `D9-5-10` ────────────────────────────
  SMTP_HOST: { tiers: "Zoho" },
  SMTP_PORT: { tiers: "Zoho" },
  SMTP_USER: { tiers: "Zoho" },
  SMTP_PASS: { tiers: "Zoho" },
  // 🔴 2026-08-20 — clé du webhook de rebonds (`D5-3-02`). MÊME tiers : c'est
  // l'agent ZeptoMail qui poste, et il nous renvoie le destinataire et le sujet
  // des messages rebondis. Le flux est entrant, le sous-traitant est le même.
  ZEPTOMAIL_WEBHOOK_KEY: { tiers: "Zoho" },
  SMTP_FROM_ADDRESS: { exempt: "Adresse d'expédition d'Axion-IA, pas un tiers." },
  SMTP_FROM_NAME: { exempt: "Nom d'expéditeur affiché, pas un tiers." },
  SMTP_FROM_MARKETING: { exempt: "Seconde adresse d'expédition d'Axion-IA." },

  // ── Auto-hébergés, référencés en transparence mais non sous-traitants ─────
  PMTA_API_URL: { exempt: "PowerMTA — auto-hébergé, et JAMAIS déployé (cf. lib/email/client.ts)." },
  PMTA_API_KEY: {
    exempt:
      "Clé de la même instance PowerMTA auto-hébergée que PMTA_API_URL, jamais déployée : aucun flux, aucun tiers.",
  },
  MAILWIZZ_API_URL: { exempt: "Mailwizz auto-hébergé sur le VPS — Axion-IA seule responsable." },
  MAILWIZZ_API_KEY: {
    exempt:
      "Clé de la même instance Mailwizz auto-hébergée sur le VPS : Axion-IA est seule responsable du traitement, pas un sous-traitant externe.",
  },
  DOCUSEAL_BASE_URL: { tiers: "DocuSeal" },
  DOCUSEAL_API_KEY: { tiers: "DocuSeal" },
  DOCUSEAL_WEBHOOK_SECRET: { tiers: "DocuSeal" },

  // ── Plateformes internes Axion-IA ─────────────────────────────────────────
  CRM_SYNC_URL: { exempt: "Axion CRM Pro — plateforme d'Axion-IA, pas un tiers." },
  SITE_SYNC_HMAC_SECRET: { exempt: "Secret partagé site ↔ CRM interne. Aucun tiers." },
  KB_INGEST_SECRET: { exempt: "Secret d'une route interne d'ingestion. Aucun tiers." },
  BACKUP_INGEST_SECRET: { exempt: "Secret d'une route interne de sauvegarde. Aucun tiers." },

  // ── Tiers déjà déclarés ───────────────────────────────────────────────────
  TELEGRAM_BOT_TOKEN: { tiers: "Telegram" },
  TELEGRAM_CALENDLY_BOT_TOKEN: { tiers: "Telegram" },
  TURNSTILE_SECRET_KEY: { tiers: "Cloudflare" },
  CALENDLY_API_TOKEN: { tiers: "Calendly" },
  CALENDLY_WEBHOOK_SIGNING_KEY: { tiers: "Calendly" },
  HETZNER_STORAGE_KEY: { tiers: "Hetzner" },
  HETZNER_STORAGE_SECRET: { tiers: "Hetzner" },
  SENTRY_DSN: { tiers: "Sentry" },
  SENTRY_AUTH_TOKEN: { tiers: "Sentry" },
  OPENAI_API_KEY: { tiers: "OpenAI," },
  ANTHROPIC_API_KEY: { tiers: "Anthropic" },
  PERPLEXITY_API_KEY: { tiers: "Perplexity" },
  UNSPLASH_ACCESS_KEY: { tiers: "Unsplash" },
  VOYAGE_API_KEY: { tiers: "Voyage" },

  // ── Tiers qui ne reçoivent AUCUNE donnée personnelle ──────────────────────
  //
  // ⚠️ Exemptions ARBITRÉES le 2026-08-20, pas héritées. Les déclarer
  // sous-traitants serait sur-déclarer : un tableau de transparence dilué par
  // des tiers qui ne traitent rien perd sa valeur d'information, et la notion
  // de sous-traitant suppose un traitement de données personnelles pour le
  // compte du responsable (art. 4.8). Ils reçoivent des URL de pages PUBLIQUES.
  INDEXNOW_KEY: {
    exempt:
      "IndexNow ne reçoit que des URL de pages publiques, pour signaler leur mise à jour aux moteurs. Aucune donnée personnelle, aucun contenu.",
  },
  GOOGLE_PSI_API_KEY: {
    exempt:
      "PageSpeed Insights mesure des URL publiques du site. Aucune donnée personnelle ne lui est transmise.",
  },

  // ── Variables publiques : c'est la garde CSP qui les couvre ───────────────
  NEXT_PUBLIC_SITE_URL: {
    exempt:
      "URL canonique du site Axion-IA lui-même, utilisée pour construire les liens absolus. Ne désigne aucun tiers.",
  },
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: { exempt: "Cloudflare — couvert par la garde CSP." },
  NEXT_PUBLIC_PLAUSIBLE_API_URL: { exempt: "Plausible auto-hébergé — couvert par la garde CSP." },
  NEXT_PUBLIC_SENTRY_DSN: { exempt: "Sentry — couvert par la garde CSP." },
};

/** Variables serveur de forme « tiers », lues dans `src/env.ts`. */
function variablesTiers(): string[] {
  const source = readFileSync(join(RACINE, "src", "env.ts"), "utf8");
  const noms = [...source.matchAll(/^\s{4}([A-Z][A-Z0-9_]+):\s*z\./gm)].map((m) => m[1] as string);
  return [...new Set(noms)].filter((n) => FORME_TIERS.test(n));
}

describe("🔴 sous-traitants appelés depuis le SERVEUR", () => {
  it("le recensement trouve les variables — sinon la garde ne garde rien", () => {
    // Témoin de NON-VACUITÉ. Si `env.ts` change de forme et que la regex cesse
    // de reconnaître les déclarations, ce fichier passerait ENTIÈREMENT au vert
    // — et l'absence d'alerte se lirait comme une absence de problème. C'est
    // exactement ainsi que la purge de prospection journalisait « 0 ».
    expect(variablesTiers().length).toBeGreaterThanOrEqual(30);
  });

  it("chaque variable de forme « tiers » est rattachée, ou exemptée par écrit", () => {
    const nonClassees = variablesTiers().filter((v) => !(v in CLASSEMENT));
    expect(
      nonClassees,
      "Ces variables d'environnement désignent peut-être un tiers appelé depuis le " +
        "serveur, et ne sont classées nulle part. Un tel tiers ne traverse AUCUNE CSP : " +
        "la garde `subprocessors-coherence.spec.ts` ne peut pas le voir. Rattachez-les " +
        "à une entrée de `src/content/subprocessors.ts` (et à `_AUDIT/DPA-REGISTER.md`), " +
        "ou ajoutez-les à CLASSEMENT avec un motif d'exemption vérifié.",
    ).toEqual([]);
  });

  it("chaque rattachement désigne un sous-traitant qui existe VRAIMENT", () => {
    // Sans ce cas, une faute de frappe dans `tiers` rendrait le rattachement
    // décoratif : la variable serait « classée » et le sous-traitant absent de
    // la page publique. C'est le défaut d'origine, en plus discret.
    const noms = SUBPROCESSORS.map((s) => s.name);
    const introuvables: string[] = [];
    for (const [variable, r] of Object.entries(CLASSEMENT)) {
      if (!("tiers" in r)) continue;
      if (!noms.some((n) => n.startsWith(r.tiers))) introuvables.push(`${variable} → ${r.tiers}`);
    }
    expect(introuvables, "rattachement vers un sous-traitant absent de la SSOT").toEqual([]);
  });

  it("aucune exemption muette", () => {
    const muettes = Object.entries(CLASSEMENT)
      .filter(([, r]) => "exempt" in r && r.exempt.trim().length < 25)
      .map(([v]) => v);
    expect(muettes, "une exemption sans motif lisible est une omission déguisée").toEqual([]);
  });

  it("🔴 le relais SMTP figure bien dans la liste publique dite « exhaustive »", () => {
    // Le constat `D9-5-10` lui-même, en un cas. Il ne suffit pas que la variable
    // soit classée : c'est la PAGE qui se déclare exhaustive.
    const relais = SUBPROCESSORS.find((s) => s.name.startsWith("Zoho"));
    expect(relais, "le relais qui achemine TOUS les e-mails est absent de la SSOT").toBeDefined();
    expect(relais?.activationStatus).toBe("active");
    // Le corps du message transite : c'est ce que la catégorie de données doit
    // dire, sans quoi le lecteur croit à une adresse seule.
    expect(relais?.dataCategoriesFr.toLowerCase()).toContain("corps complet");
  });
});
