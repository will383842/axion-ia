// Tests DocuSeal client (Sprint X.3 — Booking V1)
//
// Tests purs : pas d'appel réseau (fetch mocké via vi). Couvre :
//   - isDocusealConfigured / isDocusealWebhookConfigured gates
//   - verifyWebhookSignature (HMAC-SHA256 timing-safe)
//   - parseWebhookPayload (parsing + idempotence id)
//   - createSubmission shape attendue (mock fetch)

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import {
  isDocusealConfigured,
  isDocusealWebhookConfigured,
  verifyWebhookSignature,
  parseWebhookPayload,
  createSubmission,
  createContractSubmission,
  DocusealApiError,
  DOCUSEAL_ROLES,
} from "./docuseal";

describe("docuseal — gates de configuration", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env["DOCUSEAL_BASE_URL"];
    delete process.env["DOCUSEAL_API_KEY"];
    delete process.env["DOCUSEAL_WEBHOOK_SECRET"];
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("isDocusealConfigured → false si BASE_URL absent", () => {
    process.env["DOCUSEAL_API_KEY"] = "test-key";
    expect(isDocusealConfigured()).toBe(false);
  });

  it("isDocusealConfigured → false si API_KEY absent", () => {
    process.env["DOCUSEAL_BASE_URL"] = "https://docuseal.example.com";
    expect(isDocusealConfigured()).toBe(false);
  });

  it("isDocusealConfigured → true si BASE_URL + API_KEY présents", () => {
    process.env["DOCUSEAL_BASE_URL"] = "https://docuseal.example.com";
    process.env["DOCUSEAL_API_KEY"] = "test-key";
    expect(isDocusealConfigured()).toBe(true);
  });

  it("isDocusealWebhookConfigured → true si WEBHOOK_SECRET présent", () => {
    process.env["DOCUSEAL_WEBHOOK_SECRET"] = "secret";
    expect(isDocusealWebhookConfigured()).toBe(true);
  });

  it("isDocusealWebhookConfigured → false sans secret", () => {
    expect(isDocusealWebhookConfigured()).toBe(false);
  });
});

describe("docuseal — verifyWebhookSignature", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env["DOCUSEAL_WEBHOOK_SECRET"] = "test-secret-32chars-min-len-ok";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("retourne true pour signature valide", () => {
    const body = '{"event":"form.completed"}';
    const sig = createHmac("sha256", "test-secret-32chars-min-len-ok").update(body).digest("hex");
    expect(verifyWebhookSignature(body, sig)).toBe(true);
  });

  it("retourne false pour signature corrompue", () => {
    const body = '{"event":"form.completed"}';
    const wrongSig = "0".repeat(64);
    expect(verifyWebhookSignature(body, wrongSig)).toBe(false);
  });

  it("retourne false pour signature null", () => {
    expect(verifyWebhookSignature("body", null)).toBe(false);
  });

  it("retourne false pour signature longueur invalide", () => {
    expect(verifyWebhookSignature("body", "tooshort")).toBe(false);
  });

  it("retourne false pour signature hex invalide (lettres non-hex)", () => {
    const fakeSig = "z".repeat(64); // 64 chars mais pas hex
    expect(verifyWebhookSignature("body", fakeSig)).toBe(false);
  });

  it("comparaison timing-safe — body différent → false", () => {
    const sig1 = createHmac("sha256", "test-secret-32chars-min-len-ok")
      .update("body1")
      .digest("hex");
    expect(verifyWebhookSignature("body2", sig1)).toBe(false);
  });
});

describe("docuseal — parseWebhookPayload", () => {
  it("parse un event form.completed standard", () => {
    const raw = JSON.stringify({
      event_id: "evt_abc123",
      event_type: "form.completed",
      timestamp: "2026-05-13T12:00:00Z",
      data: {
        submission_id: 42,
        metadata: { bookingId: "uuid-booking-1" },
      },
    });
    const parsed = parseWebhookPayload(raw);
    expect(parsed.eventId).toBe("evt_abc123");
    expect(parsed.eventType).toBe("form.completed");
    expect(parsed.submissionId).toBe("42");
    expect(parsed.metadata.bookingId).toBe("uuid-booking-1");
  });

  // 🔴 F4 : DocuSeal 2.5.3 n'envoie PAS `event_id` (corps = `{event_type,
  // timestamp, data}`) — l'ancienne exigence faisait répondre 400 à TOUS les
  // callbacks authentiques. On dérive une clé déterministe, et c'est ce
  // déterminisme qu'il faut verrouiller : `data` embarque des URLs signées
  // régénérées à chaque tentative, donc une clé calculée sur le bloc `data`
  // entier changerait à chaque retry et la contrainte UNIQUE ne dédupliquerait
  // plus rien.
  it("dérive une clé d'idempotence stable quand event_id est absent", () => {
    const commun = {
      event_type: "form.completed",
      timestamp: "2026-07-26T10:00:00.000Z",
    };
    const first = parseWebhookPayload(
      JSON.stringify({
        ...commun,
        data: {
          id: 7,
          submission_id: 42,
          metadata: { devisId: "d-1", kind: "devis" },
          audit_log_url: "https://ds.example.com/a?exp=111",
          documents: [{ url: "https://ds.example.com/d?exp=111" }],
          updated_at: "2026-07-26T10:00:00.000Z",
        },
      }),
    );
    expect(first.eventId).toMatch(/^sha256:[0-9a-f]{64}$/);
    // Colonne docuseal_event_id = VarChar(120).
    expect(first.eventId.length).toBeLessThanOrEqual(120);
    expect(first.metadata.devisId).toBe("d-1");
    expect(first.submissionId).toBe("42");

    // Retry DocuSeal : mêmes identifiants, mais URLs signées REGÉNÉRÉES
    // (`expires_at` = 40 min à partir de maintenant) et `updated_at` bougé.
    const retry = parseWebhookPayload(
      JSON.stringify({
        ...commun,
        data: {
          id: 7,
          submission_id: 42,
          metadata: { devisId: "d-1", kind: "devis" },
          audit_log_url: "https://ds.example.com/a?exp=999",
          documents: [{ url: "https://ds.example.com/d?exp=999" }],
          updated_at: "2026-07-26T10:07:31.000Z",
        },
      }),
    );
    expect(retry.eventId).toBe(first.eventId);

    // Deux signataires du même document = deux data.id = deux clés distinctes.
    const contreSignataire = parseWebhookPayload(
      JSON.stringify({ ...commun, data: { id: 8, submission_id: 42 } }),
    );
    expect(contreSignataire.eventId).not.toBe(first.eventId);
  });

  it("utilise event_id verbatim quand DocuSeal en fournit un", () => {
    const raw = JSON.stringify({
      event_id: "evt_explicite",
      event_type: "form.completed",
      data: { id: 1 },
    });
    expect(parseWebhookPayload(raw).eventId).toBe("evt_explicite");
  });

  it("throw si event_type absent", () => {
    const raw = JSON.stringify({ event_id: "evt_1" });
    expect(() => parseWebhookPayload(raw)).toThrow(/event_type/);
  });

  it("fallback metadata vide si non fournie", () => {
    const raw = JSON.stringify({
      event_id: "evt_1",
      event_type: "form.started",
      data: { submission_id: "sub_1" },
    });
    const parsed = parseWebhookPayload(raw);
    expect(parsed.metadata).toEqual({});
  });

  it("supporte submission_id à la racine (variante DocuSeal)", () => {
    const raw = JSON.stringify({
      event_id: "evt_2",
      event_type: "form.viewed",
      submission_id: "sub_99",
    });
    const parsed = parseWebhookPayload(raw);
    expect(parsed.submissionId).toBe("sub_99");
  });
});

describe("docuseal — createSubmission (fetch mocké)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env["DOCUSEAL_BASE_URL"] = "https://docuseal.example.com";
    process.env["DOCUSEAL_API_KEY"] = "test-key";
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("POST /api/submissions avec body correct + retourne submissionId/embedUrl", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            id: 1,
            submission_id: 42,
            embed_src: "https://docuseal.example.com/s/abc",
            email: "client@example.com",
            name: "John Doe",
            status: "pending",
          },
        ]),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const result = await createSubmission({
      templateId: 1,
      signers: [{ email: "client@example.com", name: "John Doe" }],
      fields: [{ name: "amount", default_value: "1500 EUR" }],
      sendEmail: false,
      metadata: { bookingId: "uuid-1" },
    });

    expect(result.submissionId).toBe("42");
    expect(result.embedUrl).toBe("https://docuseal.example.com/s/abc");
    expect(result.status).toBe("pending");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://docuseal.example.com/api/submissions");
    const reqInit = init as RequestInit;
    expect(reqInit.method).toBe("POST");
    const headers = reqInit.headers as Record<string, string>;
    expect(headers["X-Auth-Token"]).toBe("test-key");
    const body = JSON.parse(reqInit.body as string);
    expect(body.template_id).toBe(1);
    expect(body.submitters).toHaveLength(1);
    expect(body.submitters[0].email).toBe("client@example.com");
  });

  it("throw DocusealApiError si 400 retourné", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response("Bad Request", { status: 400 }));
    await expect(
      createSubmission({
        templateId: 1,
        signers: [{ email: "x@y.z" }],
      }),
    ).rejects.toBeInstanceOf(DocusealApiError);
  });

  it("throw si tableau vide retourné", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response("[]", { status: 200, headers: { "content-type": "application/json" } }),
    );
    await expect(
      createSubmission({
        templateId: 1,
        signers: [{ email: "x@y.z" }],
      }),
    ).rejects.toThrow(/empty submission/);
  });

  it("default submitters_order = preserved (séquentiel)", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            id: 1,
            submission_id: 1,
            embed_src: "x",
            email: "a@b.c",
            name: null,
            status: "pending",
          },
        ]),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    await createSubmission({
      templateId: 1,
      signers: [{ email: "a@b.c" }, { email: "d@e.f" }],
    });
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(body.submitters_order).toBe("preserved");
  });

  it("signOrder='random' propagé tel quel", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            id: 1,
            submission_id: 1,
            embed_src: "x",
            email: "a@b.c",
            name: null,
            status: "pending",
          },
        ]),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    await createSubmission({
      templateId: 1,
      signOrder: "random",
      signers: [{ email: "a@b.c" }],
    });
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(body.submitters_order).toBe("random");
  });
});

describe("docuseal — createContractSubmission (pattern B2B client → Axion-IA)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env["DOCUSEAL_BASE_URL"] = "https://docuseal.example.com";
    process.env["DOCUSEAL_API_KEY"] = "test-key";
    delete process.env["AXIONIA_CONTRACT_COUNTERSIGNER_EMAIL"];
    delete process.env["AXIONIA_CONTRACT_COUNTERSIGNER_NAME"];
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  function mockOk() {
    return vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            id: 1,
            submission_id: 99,
            embed_src: "https://docuseal.example.com/s/abc",
            email: "client@example.com",
            name: "John Doe",
            status: "pending",
          },
        ]),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
  }

  it("envoie 2 submitters dans l'ordre client (1er) → Axion-IA (2e)", async () => {
    const fetchMock = mockOk();
    await createContractSubmission({
      templateId: 42,
      client: { email: "client@example.com", name: "John Doe", phone: "+33612345678" },
      metadata: { bookingId: "uuid-1" },
    });
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(body.submitters).toHaveLength(2);
    expect(body.submitters[0].email).toBe("client@example.com");
    expect(body.submitters[0].role).toBe(DOCUSEAL_ROLES.CLIENT);
    expect(body.submitters[0].phone).toBe("+33612345678");
    expect(body.submitters[1].email).toBe("contact@axion-ia.com");
    expect(body.submitters[1].role).toBe(DOCUSEAL_ROLES.AXIONIA);
    expect(body.submitters_order).toBe("preserved");
  });

  it("contre-signataire override via env AXIONIA_CONTRACT_COUNTERSIGNER_EMAIL", async () => {
    process.env["AXIONIA_CONTRACT_COUNTERSIGNER_EMAIL"] = "will@axion-ia.com";
    process.env["AXIONIA_CONTRACT_COUNTERSIGNER_NAME"] = "Williams";
    const fetchMock = mockOk();
    await createContractSubmission({
      templateId: 42,
      client: { email: "client@example.com", name: "John Doe" },
    });
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(body.submitters[1].email).toBe("will@axion-ia.com");
    expect(body.submitters[1].name).toBe("Williams");
  });

  it("contre-signataire override explicite (paramètre `countersigner`)", async () => {
    const fetchMock = mockOk();
    await createContractSubmission({
      templateId: 42,
      client: { email: "client@example.com", name: "John Doe" },
      countersigner: { email: "admin@axion-ia.com", name: "Admin Override" },
    });
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(body.submitters[1].email).toBe("admin@axion-ia.com");
    expect(body.submitters[1].name).toBe("Admin Override");
  });

  it("fallback final = contact@axion-ia.com si aucun override", async () => {
    const fetchMock = mockOk();
    await createContractSubmission({
      templateId: 42,
      client: { email: "client@example.com", name: "John Doe" },
    });
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(body.submitters[1].email).toBe("contact@axion-ia.com");
  });

  it("rôles canoniques DOCUSEAL_ROLES restent stables", () => {
    expect(DOCUSEAL_ROLES.CLIENT).toBe("Client");
    expect(DOCUSEAL_ROLES.AXIONIA).toBe("Axion-IA");
  });

  // ── Cause racine du 422 (constat F4) ─────────────────────────────────────
  // Reproduit sur le conteneur DocuSeal 2.5.3 : `fields[].default_value` est
  // reversé dans `values` puis validé RÔLE PAR RÔLE
  // (`Submitters::NormalizeValues`, `throw_errors: true`). role="Client" résout
  // les 3 champs ; role="Axion-IA" lève `Unknown field: devis_number` → 422, et
  // la soumission ENTIÈRE est refusée. Ces tests sont le garde-fou.

  it("les champs pré-remplis ne partent QU'AU client, jamais au contre-signataire", async () => {
    const fetchMock = mockOk();
    await createContractSubmission({
      templateId: 42,
      client: { email: "client@example.com", name: "John Doe" },
      fields: [
        { name: "devis_number", default_value: "AXI-DEV-2026-003", readonly: true },
        { name: "amount_ht", default_value: "1200.00", readonly: true },
      ],
    });
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(body.submitters[0].fields).toHaveLength(2);
    expect(body.submitters[0].fields[0].name).toBe("devis_number");
    // `readonly` doit survivre au transport : sans lui le client peut réécrire
    // le montant avant de signer.
    expect(body.submitters[0].fields[0].readonly).toBe(true);
    expect(body.submitters[1].fields).toBeUndefined();
  });

  it("la metadata reste sur LES DEUX submitters", async () => {
    const fetchMock = mockOk();
    await createContractSubmission({
      templateId: 42,
      client: { email: "client@example.com", name: "John Doe" },
      fields: [{ name: "devis_number", default_value: "AXI-DEV-2026-003" }],
      metadata: { devisId: "uuid-devis", kind: "devis" },
    });
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    // Le webhook porte la metadata DU submitter concerné : sans elle sur le 2e,
    // `dispatchDevisEvent` perdrait `devisId`.
    expect(body.submitters[0].metadata.devisId).toBe("uuid-devis");
    expect(body.submitters[1].metadata.devisId).toBe("uuid-devis");
  });
});

describe("docuseal — createSubmission : distribution des champs par signataire", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env["DOCUSEAL_BASE_URL"] = "https://docuseal.example.com";
    process.env["DOCUSEAL_API_KEY"] = "test-key";
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  function mockOkMulti() {
    return vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            id: 1,
            submission_id: 7,
            embed_src: "https://docuseal.example.com/s/abc",
            email: "a@x.fr",
            name: null,
            status: "pending",
          },
        ]),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
  }

  it("chaque signataire ne porte QUE ses propres champs", async () => {
    const fetchMock = mockOkMulti();
    await createSubmission({
      templateId: 1,
      signers: [
        { email: "a@x.fr", fields: [{ name: "f1" }] },
        { email: "b@x.fr", fields: [{ name: "f2" }] },
      ],
      fields: [{ name: "globalement_ignore" }],
    });
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(body.submitters[0].fields).toEqual([{ name: "f1" }]);
    expect(body.submitters[1].fields).toEqual([{ name: "f2" }]);
  });

  it("le `fields` global ne va qu'au signataire d'index 0", async () => {
    const fetchMock = mockOkMulti();
    await createSubmission({
      templateId: 1,
      signers: [{ email: "a@x.fr" }, { email: "b@x.fr" }],
      fields: [{ name: "f1" }],
    });
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(body.submitters[0].fields).toEqual([{ name: "f1" }]);
    expect(body.submitters[1].fields).toBeUndefined();
  });

  it("un tableau `fields` VIDE n'émet pas la clé du tout", async () => {
    const fetchMock = mockOkMulti();
    await createSubmission({ templateId: 1, signers: [{ email: "a@x.fr" }], fields: [] });
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(body.submitters[0].fields).toBeUndefined();
  });
});

describe("docuseal — signature webhook v2 (format réellement émis par DocuSeal 2.5.3)", () => {
  const originalEnv = { ...process.env };
  const SECRET = "test-secret-32chars-min-len-ok";

  beforeEach(() => {
    process.env["DOCUSEAL_WEBHOOK_SECRET"] = SECRET;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  /** Réplique exacte de `WebhookUrls::Signatures.sign` (DocuSeal 2.5.3). */
  function signV2(body: string, ts: number): string {
    return `${ts}.${createHmac("sha256", SECRET).update(`${ts}.${body}`).digest("hex")}`;
  }

  it("accepte `<timestamp>.<hex64>` signé sur `<ts>.<corps>`", () => {
    const body = '{"event_type":"form.completed"}';
    const ts = Math.floor(Date.now() / 1000);
    const header = signV2(body, ts);
    expect(header).toHaveLength(String(ts).length + 65);
    expect(verifyWebhookSignature(body, header)).toBe(true);
  });

  it("refuse un header v2 dont le HMAC porte sur le CORPS SEUL (l'ancien message)", () => {
    const body = '{"event_type":"form.completed"}';
    const ts = Math.floor(Date.now() / 1000);
    const digestSansTs = createHmac("sha256", SECRET).update(body).digest("hex");
    expect(verifyWebhookSignature(body, `${ts}.${digestSansTs}`)).toBe(false);
  });

  it("refuse un timestamp hors de la fenêtre de 300 s (alignée sur l'émetteur)", () => {
    const body = "{}";
    const now = Math.floor(Date.now() / 1000);
    expect(verifyWebhookSignature(body, signV2(body, now - 7200))).toBe(false);
    expect(verifyWebhookSignature(body, signV2(body, now + 7200))).toBe(false);
    expect(verifyWebhookSignature(body, signV2(body, now - 290))).toBe(true);
  });

  it("refuse un digest v2 non hexadécimal", () => {
    const ts = Math.floor(Date.now() / 1000);
    expect(verifyWebhookSignature("{}", `${ts}.${"z".repeat(64)}`)).toBe(false);
  });

  it("le format legacy hex64 nu reste accepté", () => {
    const body = '{"event":"form.completed"}';
    const sig = createHmac("sha256", SECRET).update(body).digest("hex");
    expect(verifyWebhookSignature(body, sig)).toBe(true);
  });
});
