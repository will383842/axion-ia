import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * VIVIER CANDIDATS — consentements v2, fenêtre d'opposition, intégration J+30.
 *
 * Les trois tests qui comptent le plus portent chacun sur une GARDE, et chacun
 * a été vu ROUGIR avant d'être vu vert (règle : une garde ne vaut que si elle
 * rougit) :
 *   (a) une candidature OPPOSÉE n'est jamais intégrée ;
 *   (b) une candidature n'est pas intégrée AVANT l'échéance des 30 jours ;
 *   (c) un jeton d'opposition invalide ne pose RIEN en base.
 *
 * La fenêtre de 30 jours n'est jamais raccourcie dans le code : les cas qui ont
 * besoin d'une autre durée passent `windowDays` explicitement — l'écart se voit
 * donc dans le test, et la règle reste intacte.
 */

const findManyMock = vi.fn();
const findUniqueMock = vi.fn();
const updateMock = vi.fn();
const updateManyMock = vi.fn();
const consentCreateMock = vi.fn();
const outboxCreateMock = vi.fn();
const queueAddMock = vi.fn();
const enqueueEmailMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobApplication: {
      findMany: (...args: unknown[]) => findManyMock(...args),
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
      updateMany: (...args: unknown[]) => updateManyMock(...args),
    },
    consentEvent: { create: (...args: unknown[]) => consentCreateMock(...args) },
    crmSyncOutbox: { create: (...args: unknown[]) => outboxCreateMock(...args) },
  },
}));

vi.mock("@/server/queue/queues", () => ({
  crmSyncQueue: { add: (...args: unknown[]) => queueAddMock(...args) },
  enqueueEmail: (...args: unknown[]) => enqueueEmailMock(...args),
}));

// Les PII sont chiffrées at-rest : dans les tests, l'identité est la plus
// simple des transformations réversibles.
vi.mock("@/lib/pii-crypto", () => ({
  decryptPii: (value: string | null) => value,
  encryptPii: (value: string | null) => value,
}));

vi.mock("@/lib/security/email-hash", () => ({
  normalizeEmail: (email: string) => email.trim().toLowerCase(),
  hashEmailForLookup: (email: string | null | undefined) =>
    email ? `hash-${email.trim().toLowerCase()}` : null,
}));

vi.mock("@/lib/security/ip-hash", () => ({
  hashIp: (ip: string | null) => (ip ? "iphash" : null),
}));

import { integrateVivierStock, sendVivierInformationBatch } from "../stock";
import { recordVivierOpposition } from "../opposition";
import { signVivierOppositionToken, verifyVivierOppositionToken } from "../token";
import { VIVIER_OPPOSITION_WINDOW_DAYS, vivierIntegrationCutoff } from "../config";

const OLD_ENV = { ...process.env };

const JOUR_MS = 24 * 60 * 60 * 1000;

beforeEach(() => {
  vi.clearAllMocks();
  updateMock.mockResolvedValue({});
  updateManyMock.mockResolvedValue({ count: 1 });
  consentCreateMock.mockResolvedValue({});
  outboxCreateMock.mockResolvedValue({ id: "outbox-1" });
  queueAddMock.mockResolvedValue(undefined);
  enqueueEmailMock.mockResolvedValue({ enqueued: true });
  // Secret de test CONSTRUIT (jamais de littéral à haute entropie en clair —
  // Gitleaks refuserait le commit).
  process.env.AUTH_SECRET = ["axion", "test", "secret"].join("-").repeat(2);
});

afterEach(() => {
  process.env = { ...OLD_ENV };
});

function enableCandidates(): void {
  process.env.CRM_SYNC_ENABLED = "true";
  process.env.CRM_SYNC_CANDIDATES_ENABLED = "true";
  process.env.CRM_SYNC_URL = "https://api.crm.invalid/api/internal/site-sync";
  process.env.SITE_SYNC_HMAC_SECRET = ["stub", "hmac", "value"].join("-");
}

/** Une candidature informée il y a `ageJours`, prête à être intégrée. */
function candidature(overrides: Record<string, unknown> = {}) {
  return {
    id: "app-1",
    email: "candidat@example.invalid",
    firstName: "Alex",
    lastName: "Martin",
    phone: "+33600000000",
    offerTitleSnap: "Commercial IA",
    submittedAt: new Date("2026-06-01T10:00:00Z"),
    vivierInfoSentAt: new Date("2026-07-01T10:00:00Z"),
    consentVersion: "careers-v2-2026-08-13",
    cvStoragePath: null,
    experienceBand: null,
    offer: { slug: "commercial-ia", category: "commercial" },
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. INERTIE
// ─────────────────────────────────────────────────────────────────────────────

describe("inertie", () => {
  it("la campagne d'information REFUSE de s'exécuter sans VIVIER_STOCK_ENABLED", async () => {
    delete process.env.VIVIER_STOCK_ENABLED;

    const report = await sendVivierInformationBatch();

    expect(report.refused).toBe(true);
    // Le refus est ANTÉRIEUR à toute lecture de base : l'inertie est totale.
    expect(findManyMock).not.toHaveBeenCalled();
    expect(enqueueEmailMock).not.toHaveBeenCalled();
  });

  it('ne s\'exécute pas non plus quand le drapeau vaut autre chose que "true"', async () => {
    process.env.VIVIER_STOCK_ENABLED = "1";

    const report = await sendVivierInformationBatch();

    expect(report.refused).toBe(true);
    expect(enqueueEmailMock).not.toHaveBeenCalled();
  });

  it("l'intégration ne consomme RIEN tant que le flux candidats est fermé (état mixte de la séquence d'activation)", async () => {
    // 🔴 Défaut BLOQUANT trouvé en revue adversariale : dans l'état PRÉVU par
    // la séquence d'activation (stock informé AVANT l'ouverture du canal),
    // l'enqueue refusait en silence et `vivierSyncedAt` était quand même
    // posé — les 71 fiches sortaient à jamais du rattrapage. La garde doit
    // sortir AVANT toute lecture : rien de lu, rien d'écrit, rien de consommé.
    delete process.env.CRM_SYNC_CANDIDATES_ENABLED;
    findManyMock.mockResolvedValue([candidature()]);

    const report = await integrateVivierStock({ now: new Date("2026-08-14T10:00:00Z") });

    expect(report).toEqual({ due: 0, integrated: 0, skipped: 0 });
    expect(findManyMock).not.toHaveBeenCalled();
    expect(outboxCreateMock).not.toHaveBeenCalled();
    // SURTOUT : `vivierSyncedAt` n'est jamais posé — l'échéance survit.
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("une échéance n'est consommée QUE si la ligne d'outbox existe réellement", async () => {
    // Canal ouvert mais écriture d'outbox en échec (« événement perdu ») :
    // l'enqueue rend null — la fiche ne doit PAS être marquée intégrée.
    enableCandidates();
    const now = new Date("2026-08-14T10:00:00Z");
    findManyMock.mockResolvedValue([
      candidature({ vivierInfoSentAt: new Date(now.getTime() - 31 * JOUR_MS) }),
    ]);
    outboxCreateMock.mockRejectedValueOnce(new Error("base indisponible"));

    const report = await integrateVivierStock({ now });

    expect(report.integrated).toBe(0);
    expect(report.skipped).toBe(1);
    expect(updateMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. LA FENÊTRE DE 30 JOURS — gardes (a) et (b)
// ─────────────────────────────────────────────────────────────────────────────

describe("fenêtre d'opposition", () => {
  beforeEach(enableCandidates);

  it("la règle est de 30 jours, et cette valeur est pinnée", () => {
    // Ce test existe pour qu'un raccourcissement « juste pour tester » ne
    // puisse pas passer inaperçu : il faudrait modifier CE test pour y arriver.
    expect(VIVIER_OPPOSITION_WINDOW_DAYS).toBe(30);

    const now = new Date("2026-08-14T00:00:00Z");
    expect(vivierIntegrationCutoff(now).toISOString()).toBe("2026-07-15T00:00:00.000Z");
  });

  // ── GARDE (b) ────────────────────────────────────────────────────────────
  it("n'intègre PAS une candidature dont la fenêtre n'est pas échue", async () => {
    // Informée il y a 29 jours : il reste un jour de réflexion.
    const now = new Date("2026-08-14T10:00:00Z");
    const informeeIlYA29Jours = new Date(now.getTime() - 29 * JOUR_MS);

    // La sélection se fait EN BASE (`vivierInfoSentAt <= cutoff`) : on vérifie
    // donc que la requête porte bien la borne, et qu'une ligne trop récente
    // n'en ferait pas partie.
    findManyMock.mockResolvedValue([]);

    const report = await integrateVivierStock({ now });

    expect(report.integrated).toBe(0);
    expect(outboxCreateMock).not.toHaveBeenCalled();

    const where = findManyMock.mock.calls[0]?.[0]?.where;
    const cutoff = where.vivierInfoSentAt.lte as Date;
    expect(cutoff.getTime()).toBe(now.getTime() - 30 * JOUR_MS);
    // La borne EXCLUT bien une candidature informée il y a 29 jours…
    expect(informeeIlYA29Jours.getTime()).toBeGreaterThan(cutoff.getTime());
    // …et INCLUT celle informée il y a 31 jours (sinon le test serait vert
    // pour une mauvaise raison : « la borne exclut tout »).
    expect(now.getTime() - 31 * JOUR_MS).toBeLessThan(cutoff.getTime());
  });

  it("intègre une candidature dont la fenêtre est échue", async () => {
    enableCandidates();
    const now = new Date("2026-08-14T10:00:00Z");
    findManyMock.mockResolvedValue([
      candidature({ vivierInfoSentAt: new Date(now.getTime() - 31 * JOUR_MS) }),
    ]);

    const report = await integrateVivierStock({ now });

    expect(report.integrated).toBe(1);
    expect(outboxCreateMock).toHaveBeenCalledTimes(1);
    // La version envoyée est celle du STOCK (l'acte = information + 30 j sans
    // opposition), JAMAIS la v1 de la fiche : le CRM n'accepte que des
    // versions énumérées, et v1 = 422 en masse au J+30.
    const sent = outboxCreateMock.mock.calls[0]?.[0]?.data?.payload;
    expect(sent.consent.version).toBe("vivier-stock-2026-08-14");
    expect(sent.consent.text_ref).toBe("vivier-information-email");

    const data = outboxCreateMock.mock.calls[0]?.[0]?.data;
    expect(data.universe).toBe("vivier");
    expect(data.payload.event_type).toBe("application_submitted");
    // L'accord réputé acquis est horodaté à l'ÉCHÉANCE, pas à la candidature :
    // c'est à partir de cette date que la conservation devient licite.
    expect(data.payload.consent.vivier_at).toBe(new Date(now.getTime() - JOUR_MS).toISOString());

    // Marqueur d'idempotence posé : rejouer ne créera pas de doublon.
    expect(updateMock.mock.calls[0]?.[0]?.data).toEqual({ vivierSyncedAt: now });
  });

  // ── GARDE (a) ────────────────────────────────────────────────────────────
  it("n'intègre JAMAIS une candidature opposée, même sa fenêtre échue", async () => {
    const now = new Date("2026-08-14T10:00:00Z");

    // La garde vit dans le `where` de la requête : une candidature opposée
    // n'est simplement jamais sélectionnée. On l'asserte explicitement, sinon
    // le test passerait avec une requête qui aurait perdu la condition.
    findManyMock.mockResolvedValue([]);

    await integrateVivierStock({ now });

    const where = findManyMock.mock.calls[0]?.[0]?.where;
    expect(where.vivierOpposedAt).toBeNull();
    expect(where.vivierSyncedAt).toBeNull();
    expect(outboxCreateMock).not.toHaveBeenCalled();
  });

  it("l'override de fenêtre est EXPLICITE et ne change pas la règle", async () => {
    const now = new Date("2026-08-14T10:00:00Z");
    findManyMock.mockResolvedValue([]);

    await integrateVivierStock({ now, windowDays: 1 });

    const cutoff = findManyMock.mock.calls[0]?.[0]?.where.vivierInfoSentAt.lte as Date;
    expect(cutoff.getTime()).toBe(now.getTime() - JOUR_MS);
    // La constante métier, elle, n'a pas bougé.
    expect(VIVIER_OPPOSITION_WINDOW_DAYS).toBe(30);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. LE JETON D'OPPOSITION — garde (c)
// ─────────────────────────────────────────────────────────────────────────────

describe("jeton d'opposition", () => {
  it("accepte un jeton fraîchement signé", async () => {
    const token = await signVivierOppositionToken("app-42");
    const verified = await verifyVivierOppositionToken(token);

    expect(verified).toEqual({ ok: true, applicationId: "app-42" });
  });

  // ── GARDE (c) ────────────────────────────────────────────────────────────
  it.each([
    ["absent", null],
    ["vide", ""],
    ["malformé", "pas-un-jeton"],
  ])("refuse un jeton %s sans rien poser en base", async (_label, token) => {
    const verified = await verifyVivierOppositionToken(token);

    expect(verified.ok).toBe(false);
    // Aucune écriture : ni opposition, ni registre, ni outbox.
    expect(updateManyMock).not.toHaveBeenCalled();
    expect(consentCreateMock).not.toHaveBeenCalled();
    expect(outboxCreateMock).not.toHaveBeenCalled();
  });

  it("refuse un jeton dont SEULE la signature est fausse", async () => {
    // 🔴 Ce test a d'abord été écrit avec un payload bidon — et il restait VERT
    // quand on neutralisait la vérification de signature, parce que le contrôle
    // d'AUDIENCE le rattrapait. Une garde verte pour la mauvaise raison ne
    // garde rien. Le payload est donc ici parfaitement VALIDE (sujet, audience,
    // expiration) : plus rien d'autre que la signature ne peut le faire échouer.
    const payload = {
      sub: "app-42",
      aud: "vivier-opposition",
      exp: Date.now() + 60_000,
    };
    const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8")
      .toString("base64url")
      .replace(/=+$/, "");
    const signatureBidon = Buffer.from("signature-qui-ne-vaut-rien", "utf8").toString("base64url");

    const verified = await verifyVivierOppositionToken(`${payloadB64}.${signatureBidon}`);

    expect(verified.ok).toBe(false);
    if (!verified.ok) expect(verified.reason).toBe("invalid_signature");
    expect(updateManyMock).not.toHaveBeenCalled();
    expect(consentCreateMock).not.toHaveBeenCalled();
    expect(outboxCreateMock).not.toHaveBeenCalled();
  });

  it("refuse un jeton signé pour une AUTRE finalité", async () => {
    // Même secret, autre audience : un jeton d'export RGPD ne doit pas valoir
    // opposition vivier. Sans le contrôle d'audience, les deux seraient
    // interchangeables.
    const { signGdprToken } = await import("@/lib/gdpr-token");
    const autre = await signGdprToken("candidat@example.invalid");

    const verified = await verifyVivierOppositionToken(autre);

    expect(verified.ok).toBe(false);
    if (!verified.ok) expect(verified.reason).toBe("wrong_audience");
  });

  it("refuse un jeton expiré", async () => {
    const token = await signVivierOppositionToken("app-42");
    // 401 jours plus tard : au-delà de la durée de vie de 400 jours.
    vi.setSystemTime(new Date(Date.now() + 401 * JOUR_MS));

    const verified = await verifyVivierOppositionToken(token);

    expect(verified.ok).toBe(false);
    if (!verified.ok) expect(verified.reason).toBe("expired");
    vi.useRealTimers();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. ENREGISTREMENT DE L'OPPOSITION
// ─────────────────────────────────────────────────────────────────────────────

describe("enregistrement de l'opposition", () => {
  beforeEach(() => {
    enableCandidates();
    findUniqueMock.mockResolvedValue({
      id: "app-1",
      email: "candidat@example.invalid",
      consentVersion: "careers-v2-2026-08-13",
      vivierOpposedAt: null,
    });
    findManyMock.mockResolvedValue([
      { id: "app-1", email: "candidat@example.invalid" },
      { id: "app-2", email: "Candidat@Example.Invalid" },
      { id: "app-3", email: "quelqun.autre@example.invalid" },
    ]);
  });

  it("oppose TOUTES les candidatures de la même adresse, casse comprise", async () => {
    const result = await recordVivierOpposition("app-1");

    expect(result).toEqual({ ok: true, alreadyOpposed: false, applications: 2 });
    // `app-2` porte la même adresse écrite différemment : elle doit suivre.
    // `app-3` appartient à quelqu'un d'autre et ne doit surtout pas suivre.
    expect(updateManyMock.mock.calls[0]?.[0]?.where.id.in).toEqual(["app-1", "app-2"]);
  });

  it("consigne le retrait au registre et le propage au CRM", async () => {
    await recordVivierOpposition("app-1");

    expect(consentCreateMock.mock.calls[0]?.[0]?.data).toMatchObject({
      personKey: "hash-candidat@example.invalid",
      formRef: "vivier-opposition",
      action: "optout",
    });

    const payload = outboxCreateMock.mock.calls[0]?.[0]?.data;
    expect(payload.universe).toBe("vivier");
    expect(payload.payload.event_type).toBe("opt_out");
    // Le champ d'application est dit DANS le message, pas seulement déduit de
    // l'univers : le CRM ne doit pas avoir à l'inférer.
    expect(payload.payload.payload.scope).toBe("vivier");
  });

  it("est idempotente : re-cliquer le lien ne ré-émet rien", async () => {
    findUniqueMock.mockResolvedValue({
      id: "app-1",
      email: "candidat@example.invalid",
      consentVersion: "careers-v2-2026-08-13",
      vivierOpposedAt: new Date("2026-08-01T10:00:00Z"),
    });
    updateManyMock.mockResolvedValue({ count: 0 });

    const result = await recordVivierOpposition("app-1");

    expect(result).toEqual({ ok: true, alreadyOpposed: true, applications: 2 });
    expect(outboxCreateMock).not.toHaveBeenCalled();
  });

  it("ne lève jamais, même si la base tombe", async () => {
    findUniqueMock.mockRejectedValueOnce(new Error("base indisponible"));

    await expect(recordVivierOpposition("app-1")).resolves.toEqual({
      ok: false,
      reason: "internal",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. CAMPAGNE D'INFORMATION AU STOCK
// ─────────────────────────────────────────────────────────────────────────────

describe("campagne d'information", () => {
  beforeEach(() => {
    process.env.VIVIER_STOCK_ENABLED = "true";
  });

  it("dédoublonne par adresse : une personne, un seul email", async () => {
    findManyMock
      // Les candidatures à informer…
      .mockResolvedValueOnce([
        {
          id: "a",
          email: "x@example.invalid",
          firstName: "X",
          offerTitleSnap: "O1",
          submittedAt: new Date(),
          locale: "fr",
        },
        {
          id: "b",
          email: "X@Example.Invalid",
          firstName: "X",
          offerTitleSnap: "O2",
          submittedAt: new Date(),
          locale: "fr",
        },
      ])
      // …puis la liste des oppositions connues.
      .mockResolvedValueOnce([]);

    const report = await sendVivierInformationBatch();

    expect(report.candidates).toBe(2);
    expect(report.sent).toBe(1);
    expect(report.skipped).toBe(1);
    // Les DEUX candidatures sont horodatées : sans cela, la seconde
    // reviendrait au prochain passage et la personne recevrait un 2ᵉ email.
    expect(updateMock).toHaveBeenCalledTimes(2);
  });

  it("n'écrit PAS la date d'envoi si l'email n'a pas pu être mis en file", async () => {
    // Poser la date sans avoir envoyé ferait courir la fenêtre d'opposition
    // contre une personne jamais informée — exactement l'inverse de ce que la
    // mécanique garantit.
    enqueueEmailMock.mockResolvedValue({ enqueued: false });
    findManyMock
      .mockResolvedValueOnce([
        {
          id: "a",
          email: "x@example.invalid",
          firstName: "X",
          offerTitleSnap: "O1",
          submittedAt: new Date(),
          locale: "fr",
        },
      ])
      .mockResolvedValueOnce([]);

    const report = await sendVivierInformationBatch();

    expect(report.sent).toBe(0);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("n'informe pas une adresse déjà opposée", async () => {
    findManyMock
      .mockResolvedValueOnce([
        {
          id: "a",
          email: "x@example.invalid",
          firstName: "X",
          offerTitleSnap: "O1",
          submittedAt: new Date(),
          locale: "fr",
        },
      ])
      .mockResolvedValueOnce([{ email: "x@example.invalid" }]);

    const report = await sendVivierInformationBatch();

    expect(report.sent).toBe(0);
    expect(enqueueEmailMock).not.toHaveBeenCalled();
  });

  it("PROPAGE l'opposition connue à la candidature au lieu de l'horodater informée", async () => {
    // 🔴 Le trou que ce test ferme : une personne s'oppose, puis repostule. La
    // nouvelle candidature naît avec `vivierOpposedAt` à NULL. Si la campagne
    // se contentait de l'écarter en posant la date d'information, la ligne
    // serait « informée, non opposée » — et le passage J+30 l'intégrerait au
    // vivier malgré une opposition connue, sans que personne ne le voie.
    findManyMock
      .mockResolvedValueOnce([
        {
          id: "app-neuve",
          email: "x@example.invalid",
          firstName: "X",
          offerTitleSnap: "O1",
          submittedAt: new Date(),
          locale: "fr",
        },
      ])
      .mockResolvedValueOnce([{ email: "x@example.invalid" }]);

    await sendVivierInformationBatch();

    const data = updateMock.mock.calls[0]?.[0]?.data;
    expect(data.vivierOpposedAt).toBeInstanceOf(Date);
    // …et surtout PAS de date d'information : on ne l'a jamais informée, la
    // base ne doit pas prétendre le contraire.
    expect(data.vivierInfoSentAt).toBeUndefined();
  });

  it("l'email porte un lien d'opposition vérifiable", async () => {
    findManyMock
      .mockResolvedValueOnce([
        {
          id: "app-77",
          email: "x@example.invalid",
          firstName: "X",
          offerTitleSnap: "O1",
          submittedAt: new Date(),
          locale: "fr",
        },
      ])
      .mockResolvedValueOnce([]);

    await sendVivierInformationBatch({ baseUrl: "https://axion-ia.test" });

    const [template, to, , payload] = enqueueEmailMock.mock.calls[0] as [
      string,
      string,
      string,
      { oppositionUrl: string },
    ];
    expect(template).toBe("vivier-information");
    expect(to).toBe("x@example.invalid");

    // Le lien n'est pas décoratif : le jeton qu'il porte doit réellement
    // désigner CETTE candidature.
    const token = new URL(payload.oppositionUrl).searchParams.get("token");
    await expect(verifyVivierOppositionToken(token)).resolves.toEqual({
      ok: true,
      applicationId: "app-77",
    });
  });
});
