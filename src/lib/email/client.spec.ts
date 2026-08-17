/**
 * Tests — transport SMTP (audit du 2026-08-16).
 *
 * Ce fichier n'avait aucun équivalent : la couverture de la chaîne d'e-mails
 * s'arrêtait au RENDU des gabarits. Le transport — c'est-à-dire l'endroit où on
 * décide si la production parle à Zoho en TLS authentifié ou retombe en clair
 * sur `localhost` — n'était vérifié par rien.
 *
 * Les deux propriétés testées ici sont des GARDES, et une garde ne vaut que si
 * elle rougit quand on la retire :
 *
 *   1. **Le refus du repli silencieux.** Sans identifiants en production, on
 *      lève au lieu d'envoyer en clair vers un relais local inexistant.
 *   2. **Le bridage du débit.** Le `pool` et ses bornes sont la moitié
 *      transport du correctif F-01 ; l'autre moitié est le `limiter` du worker.
 *      Les deux se retirent d'une ligne, sans que rien ne casse visiblement —
 *      la facture arrive des semaines plus tard, sous forme de réputation
 *      d'expéditeur dégradée.
 *
 * ⚠️ `_transport` est un singleton de module : chaque cas doit passer par
 * `vi.resetModules()` + import dynamique, sinon le second cas hérite du
 * transport construit par le premier et ne teste plus rien.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const createTransportMock = vi.fn();

vi.mock("nodemailer", () => ({
  default: { createTransport: (...a: unknown[]) => createTransportMock(...a) },
}));

const ENV_ORIGINE = { ...process.env };

/** Construit le transport et rend les options passées à nodemailer. */
async function optionsTransport(): Promise<Record<string, unknown>> {
  vi.resetModules();
  createTransportMock.mockReturnValue({ verify: vi.fn().mockResolvedValue(true) });
  const { verifyTransport } = await import("./client");
  await verifyTransport();
  return createTransportMock.mock.calls[0]?.[0] as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env["SMTP_HOST"] = "smtppro.zoho.eu";
  process.env["SMTP_PORT"] = "465";
  process.env["SMTP_USER"] = "contact@axion-ia.com";
  process.env["SMTP_PASS"] = "secret-de-test";
});

afterEach(() => {
  process.env = { ...ENV_ORIGINE };
});

describe("transport — le repli silencieux est refusé en production", () => {
  // 🔴 Le défaut d'origine : `SMTP_USER`/`SMTP_PASS` n'étaient déclarés nulle
  // part. Un secret perdu ou mal orthographié côté Coolify ne faisait pas
  // échouer le démarrage — il faisait retomber la PRODUCTION sur
  // `localhost:2525` avec `ignoreTLS`, et les e-mails cessaient simplement
  // d'arriver, sans une ligne d'erreur.
  it("lève en production quand les identifiants manquent", async () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env["SMTP_USER"];
    delete process.env["SMTP_PASS"];
    vi.resetModules();
    const { sendEmail } = await import("./client");
    await expect(
      sendEmail({ to: "a@b.fr", subject: "s", html: "<p>h</p>", text: "h" }),
    ).rejects.toThrow(/SMTP_USER/);
    expect(createTransportMock).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  // Le dev et les tests tournent sans identifiants, contre un Mailhog local :
  // la garde ne doit mordre qu'en production, sinon elle rend le dépôt
  // inutilisable et se fait retirer.
  it("tolère l'absence d'identifiants hors production", async () => {
    delete process.env["SMTP_USER"];
    delete process.env["SMTP_PASS"];
    const opts = await optionsTransport();
    expect(opts["ignoreTLS"]).toBe(true);
    expect(opts["auth"]).toBeUndefined();
  });

  it("authentifie et chiffre quand les identifiants sont là", async () => {
    const opts = await optionsTransport();
    expect(opts["auth"]).toEqual({ user: "contact@axion-ia.com", pass: "secret-de-test" });
    // 465 = SSL implicite (l'hôte `smtppro` du plan payant Zoho).
    expect(opts["secure"]).toBe(true);
    expect(opts["ignoreTLS"]).toBeUndefined();
  });

  it("bascule en STARTTLS sur un port qui n'est pas 465", async () => {
    process.env["SMTP_PORT"] = "587";
    const opts = await optionsTransport();
    expect(opts["secure"]).toBe(false);
    expect(opts["requireTLS"]).toBe(true);
  });
});

describe("transport — le bridage du débit (F-01)", () => {
  // 🔴 Sans `pool`, nodemailer ouvre une connexion NEUVE et s'authentifie à
  // CHAQUE message. Croisé avec la concurrence du worker, un lot dense se
  // présentait au relais comme une série d'ouvertures simultanées répétées —
  // le profil qu'un relais lit comme une attaque.
  it("met les connexions en pool, bornées à 2", async () => {
    const opts = await optionsTransport();
    expect(opts["pool"]).toBe(true);
    expect(opts["maxConnections"]).toBe(2);
  });

  it("recycle la session après 100 messages", async () => {
    const opts = await optionsTransport();
    expect(opts["maxMessages"]).toBe(100);
  });

  // Soupape SOUS le limiteur BullMQ : elle protège le chemin qui contourne la
  // file. Ce chemin existe — `content-weekly-report-worker.ts` appelle
  // `sendEmail()` en direct.
  it("plafonne à 2 messages par seconde, file contournée comprise", async () => {
    const opts = await optionsTransport();
    expect(opts["rateDelta"]).toBe(1000);
    expect(opts["rateLimit"]).toBe(2);
  });
});

describe("verifyTransport — le verdict rendu au démarrage du worker", () => {
  // Personne ne vérifiait le relais : la première preuve qu'un identifiant
  // Zoho avait expiré était un e-mail qu'un stagiaire n'avait pas reçu.
  it("rend ok quand le relais répond", async () => {
    vi.resetModules();
    createTransportMock.mockReturnValue({ verify: vi.fn().mockResolvedValue(true) });
    const { verifyTransport } = await import("./client");
    await expect(verifyTransport()).resolves.toEqual({ ok: true });
  });

  // NE LÈVE PAS : un relais injoignable ne doit pas empêcher les quarante
  // autres workers de démarrer. Il rend le verdict, l'appelant crie.
  it("rend le motif sans lever quand le relais refuse", async () => {
    vi.resetModules();
    createTransportMock.mockReturnValue({
      verify: vi.fn().mockRejectedValue(new Error("535 authentification refusee")),
    });
    const { verifyTransport } = await import("./client");
    await expect(verifyTransport()).resolves.toEqual({
      ok: false,
      error: "535 authentification refusee",
    });
  });
});
