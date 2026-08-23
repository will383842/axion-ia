import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * SYNCHRO SITE → CRM (lot L2).
 *
 * Le test le plus important de ce fichier est le premier : **drapeau à OFF,
 * il ne se passe RIEN**. C'est la condition pour que la PR soit fusionnable
 * avant la bascule finale — pas une opinion, une assertion.
 */

const createMock = vi.fn();
const findUniqueMock = vi.fn();
const updateMock = vi.fn();
const findManyMock = vi.fn();
const findFirstMock = vi.fn();
const countMock = vi.fn();
const queueAddMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    crmSyncOutbox: {
      create: (...args: unknown[]) => createMock(...args),
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
      findMany: (...args: unknown[]) => findManyMock(...args),
      findFirst: (...args: unknown[]) => findFirstMock(...args),
      // Lot L5 : le balayage mesure désormais la file (seuil d'alerte 50).
      count: (...args: unknown[]) => countMock(...args),
    },
  },
}));

vi.mock("@/server/queue/queues", () => ({
  crmSyncQueue: { add: (...args: unknown[]) => queueAddMock(...args) },
}));

vi.mock("@/lib/security/email-hash", () => ({
  normalizeEmail: (email: string) => email.trim().toLowerCase(),
  hashEmailForLookup: (email: string | null | undefined) =>
    email ? `hash-${email.trim().toLowerCase()}` : null,
}));

import { emitOutboxRow, signBody } from "../emit";
import {
  syncCandidateToCrm,
  syncFormSubmissionToCrm,
  syncVivierOppositionToCrm,
  normalizeSiren,
} from "../index";
import { CRM_FORM_TYPES } from "../types";
import { UNIFIED_CONTACT_TYPES } from "@/lib/schemas/unified-contact-schema";
import { sweepCrmSyncOutbox } from "@/server/queue/workers/crm-sync-worker";

const OLD_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  createMock.mockResolvedValue({ id: "outbox-1" });
  queueAddMock.mockResolvedValue(undefined);
  updateMock.mockResolvedValue({});
  countMock.mockResolvedValue(0);
});

afterEach(() => {
  process.env = { ...OLD_ENV };
  vi.unstubAllGlobals();
});

/**
 * Aplati un espion de `console.error` en UNE chaîne inspectable.
 * Les traces de ce module passent leurs identifiants en objet (dernier
 * argument) : sans `JSON.stringify`, `subject_ref` se lirait `[object Object]`
 * et une garde qui le cherche serait rouge pour une mauvaise raison.
 */
function lignesDeJournal(espion: { mock: { calls: unknown[][] } }): string {
  return espion.mock.calls
    .map((args) => args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "))
    .join("\n");
}

function enableSync(): void {
  process.env.CRM_SYNC_ENABLED = "true";
  process.env.CRM_SYNC_URL = "https://api.crm.invalid/api/internal/site-sync";
  process.env.SITE_SYNC_HMAC_SECRET = "secret-de-test";
}

const baseInput = {
  subjectRef: "site:submission:11111111-1111-1111-1111-111111111111",
  formType: "audit" as const,
  person: { email: "ZZ.Test@Example.Invalid", fullName: "Jean ZZ TEST", phone: "+33600000000" },
  company: { name: "ZZ TEST SAS", siren: "900 000 101" },
  consent: { version: "v1-2026-05-24", textRef: "unified-contact-form" },
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. INERTIE
// ─────────────────────────────────────────────────────────────────────────────

describe("inertie (drapeaux à OFF)", () => {
  it("n'écrit rien et n'enfile rien quand CRM_SYNC_ENABLED est absent", async () => {
    delete process.env.CRM_SYNC_ENABLED;

    await syncFormSubmissionToCrm(baseInput);

    expect(createMock).not.toHaveBeenCalled();
    expect(queueAddMock).not.toHaveBeenCalled();
  });

  it('n\'écrit rien quand CRM_SYNC_ENABLED vaut autre chose que "true"', async () => {
    process.env.CRM_SYNC_ENABLED = "1";

    await syncFormSubmissionToCrm(baseInput);

    expect(createMock).not.toHaveBeenCalled();
  });

  it("laisse le flux CANDIDATS fermé tant que son drapeau propre est à OFF", async () => {
    enableSync();
    delete process.env.CRM_SYNC_CANDIDATES_ENABLED;

    await syncCandidateToCrm({
      subjectRef: "site:job_application:42",
      family: "candidat_commercial",
      person: { email: "candidat@example.invalid", firstName: "A", lastName: "B" },
      consent: { version: "careers-v2-2026-08-13" },
    });

    expect(createMock).not.toHaveBeenCalled();

    // …et s'ouvre quand il passe à ON (sinon le test ci-dessus serait vert
    // pour une mauvaise raison : « rien ne marche »).
    process.env.CRM_SYNC_CANDIDATES_ENABLED = "true";
    await syncCandidateToCrm({
      subjectRef: "site:job_application:42",
      family: "candidat_commercial",
      person: { email: "candidat@example.invalid", firstName: "A", lastName: "B" },
      consent: { version: "careers-v2-2026-08-13" },
    });

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock.mock.calls[0]?.[0]?.data?.universe).toBe("vivier");
  });

  /**
   * E31-003 — l'abandon d'une OPPOSITION n'a pas le droit d'être muet.
   *
   * Mesuré le 2026-08-22 : `syncVivierOppositionToCrm()` force l'univers à
   * `vivier`, et le verrou candidats rendait alors `null` SANS un mot. Drapeau
   * maître ON + flux candidats OFF est un état nominal et durable : dans cet
   * état, une opposition — un droit qui s'exerce — disparaissait sans laisser
   * de quoi la rejouer, la personne voyant une page de confirmation.
   *
   * Cette garde ne dit RIEN sur la transmission elle-même (arbitrage ouvert,
   * il appartient au contrat d'ingestion du CRM) : elle inspecte uniquement le
   * fait que l'abandon est journalisé, avec de quoi retrouver l'événement.
   */
  it("E31-003 — journalise l'opposition vivier abandonnée par le verrou candidats", async () => {
    enableSync();
    delete process.env.CRM_SYNC_CANDIDATES_ENABLED;

    const journal = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await syncVivierOppositionToCrm({
        subjectRef: "site:job_application:E31-003",
        person: { email: "oppose@example.invalid" },
        consent: { version: "careers-v2-2026-08-13" },
      });

      const trace = lignesDeJournal(journal);

      expect(
        trace.includes("opposition vivier NON transmise"),
        "E31-003 : le verrou `CRM_SYNC_CANDIDATES_ENABLED` abandonne à nouveau " +
          "une opposition au vivier SANS rien journaliser — elle est perdue et " +
          "personne ne peut la rejouer après la bascule. GESTE : rétablir le " +
          "`console.error` du chemin `event_type === \"opt_out\"` dans " +
          "`src/server/crm-sync/enqueue.ts` (verrou d'inertie).",
      ).toBe(true);

      expect(
        trace.includes("site:job_application:E31-003"),
        "E31-003 : l'abandon est journalisé mais SANS `subject_ref` — une trace " +
          "qui ne nomme pas la personne concernée ne permet pas de rejouer " +
          "l'opposition. GESTE : joindre `{ event_id, subject_ref }` au " +
          "`console.error` de `src/server/crm-sync/enqueue.ts`.",
      ).toBe(true);

      // …et le silence revient quand le verrou s'ouvre, sinon la garde ci-dessus
      // serait verte pour une mauvaise raison (« ça journalise toujours »).
      journal.mockClear();
      createMock.mockClear();
      process.env.CRM_SYNC_CANDIDATES_ENABLED = "true";

      await syncVivierOppositionToCrm({
        subjectRef: "site:job_application:E31-003",
        person: { email: "oppose@example.invalid" },
        consent: { version: "careers-v2-2026-08-13" },
      });

      expect(createMock).toHaveBeenCalledTimes(1);
      expect(
        lignesDeJournal(journal).includes("opposition vivier NON transmise"),
        "E31-003 : le flux candidats est OUVERT et l'opposition part bien au CRM, " +
          "mais la trace d'abandon est quand même émise — elle devient du bruit " +
          "et ne veut plus rien dire. GESTE : garder le `console.error` DANS la " +
          "branche du verrou, dans `src/server/crm-sync/enqueue.ts`.",
      ).toBe(false);
    } finally {
      journal.mockRestore();
    }
  });

  it("le balayage ne touche pas la base quand le drapeau est à OFF", async () => {
    delete process.env.CRM_SYNC_ENABLED;

    const res = await sweepCrmSyncOutbox();

    // `gaveUp` et `backlog` ajoutés au lot L5 (observabilité) : le balayage est
    // devenu le point de mesure de la file, puisque c'est le seul endroit qui
    // la regarde dans son ensemble.
    expect(res).toEqual({
      emitted: 0,
      sent: 0,
      gaveUp: 0,
      backlog: 0,
      oldestPendingMinutes: null,
    });
    expect(findManyMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 1bis. FRONTIÈRE ENTRE LES DEUX DÉPÔTS
//
// Le contrat vit dans deux dépôts et AUCUN type ne les relie : un type émis
// ici et inconnu du CRM est refusé 422, donc `gave_up` — le lead n'arrive
// jamais. C'est arrivé avec `simulateur_roi`. Ces deux tests pinnent la liste ;
// leur symétrique côté CRM est
// `tests/Feature/Crm/SiteSyncIngestTest.php` (« chaque type de formulaire
// accepté a un tag de provenance GOUVERNÉ »).
// ─────────────────────────────────────────────────────────────────────────────

describe("frontière du contrat site → CRM", () => {
  it("pinne la liste des types de formulaire (miroir de SiteSyncEvent::FORM_TYPES)", () => {
    // Toute modification de cette liste doit être portée DANS LE MÊME LOT
    // côté CRM (`FORM_TYPES` + un tag `src:site-formulaire-<type>` au
    // référentiel gouverné), sinon les leads du nouveau type sont perdus.
    expect([...CRM_FORM_TYPES]).toEqual([
      "audit",
      "implementation",
      "formation",
      "un_a_un",
      "devis",
      "partenariat",
      "presse",
      "recrutement",
      "speaker",
      "investisseur",
      "support_client",
      "autre",
      "podcast",
      "simulateur_roi",
    ]);
  });

  it("couvre les 12 types du formulaire unifié, qui lui envoie `data.type` tel quel", () => {
    // `submitUnifiedContactAction` passe `formType: data.type` sans traduction :
    // un type ajouté au formulaire et absent du contrat serait refusé par le CRM.
    const manquants = UNIFIED_CONTACT_TYPES.filter(
      (t) => !(CRM_FORM_TYPES as readonly string[]).includes(t),
    );

    expect(manquants).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. CONSTRUCTION DE L'ÉVÉNEMENT
// ─────────────────────────────────────────────────────────────────────────────

describe("construction de l'événement", () => {
  beforeEach(enableSync);

  it("normalise l'email, pose la clé de personne et nettoie le SIREN", async () => {
    await syncFormSubmissionToCrm(baseInput);

    const payload = createMock.mock.calls[0]?.[0]?.data?.payload;

    expect(payload.schema_version).toBe(1);
    expect(payload.event_type).toBe("form_submission");
    expect(payload.form_type).toBe("audit");
    expect(payload.person.email).toBe("zz.test@example.invalid");
    expect(payload.person.person_key).toBe("hash-zz.test@example.invalid");
    // « 900 000 101 » : les espaces du formulaire ne doivent pas faire perdre
    // le rattachement à l'entreprise.
    expect(payload.company.siren).toBe("900000101");
    // Un nom complet est coupé sur le DERNIER mot : c'est la seule règle qui
    // ne perd rien (« Jean ZZ TEST » → prénom « Jean ZZ », nom « TEST »). Le
    // CRM déduplique par clé de personne, pas par nom : une coupe imparfaite
    // n'a aucune conséquence sur le rapprochement.
    expect(payload.person.first_name).toBe("Jean ZZ");
    expect(payload.person.last_name).toBe("TEST");
  });

  it("ne transmet JAMAIS le workspace ni le type de relation", async () => {
    await syncFormSubmissionToCrm(baseInput);

    const payload = createMock.mock.calls[0]?.[0]?.data?.payload;

    // Le classement est une décision du CRM : le site décrit ce qui s'est
    // passé, pas ce que la fiche doit devenir.
    expect(payload).not.toHaveProperty("workspace");
    expect(payload).not.toHaveProperty("relation_type");
    expect(payload).not.toHaveProperty("lifecycle_stage");
  });

  it("écrit dans la transaction fournie plutôt que sur le client global", async () => {
    const txCreate = vi.fn().mockResolvedValue({ id: "outbox-tx" });

    await syncFormSubmissionToCrm({
      ...baseInput,
      tx: { crmSyncOutbox: { create: txCreate } },
    });

    expect(txCreate).toHaveBeenCalledTimes(1);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("ne lève JAMAIS, même si l'écriture de l'outbox échoue", async () => {
    createMock.mockRejectedValueOnce(new Error("base indisponible"));

    // Une synchro cassée ne doit pas pouvoir faire échouer une capture de lead.
    await expect(syncFormSubmissionToCrm(baseInput)).resolves.toBeUndefined();
  });

  it("rejette un SIREN incomplet et récupère le SIREN d'un SIRET", () => {
    expect(normalizeSiren("12345")).toBeUndefined();
    expect(normalizeSiren("900000101")).toBe("900000101");
    expect(normalizeSiren("90000010100015")).toBe("900000101");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. ÉMISSION
// ─────────────────────────────────────────────────────────────────────────────

describe("émission", () => {
  beforeEach(() => {
    enableSync();
    findUniqueMock.mockResolvedValue({
      id: "outbox-1",
      status: "pending",
      attempts: 0,
      payload: { schema_version: 1, event_id: "evt-1" },
    });
  });

  it("signe l'horodatage ET le corps, et marque la ligne envoyée", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, result: { status: "created" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await emitOutboxRow("outbox-1");

    expect(res.status).toBe("sent");

    const init = fetchMock.mock.calls[0]?.[1] as {
      headers: Record<string, string>;
      body: string;
    };
    const timestamp = init.headers["X-Site-Timestamp"] as string;
    expect(init.headers["X-Site-Signature"]).toBe(signBody("secret-de-test", timestamp, init.body));

    expect(updateMock.mock.calls[0]?.[0]?.data).toMatchObject({
      status: "sent",
      crmResult: "created",
    });
  });

  it("abandonne DÉFINITIVEMENT sur un refus 422", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({ error: "candidate_consent_v2_required" }),
      }),
    );

    const res = await emitOutboxRow("outbox-1");

    expect(res.status).toBe("gave_up");
    expect(updateMock.mock.calls[0]?.[0]?.data?.status).toBe("gave_up");
  });

  it("garde la ligne en attente sur un 503 SANS consommer de tentative", async () => {
    // 503 = le CRM refuse temporairement (drapeau d'ingestion à OFF). C'est
    // l'état NORMAL pendant toute la phase inerte : si ces refus comptaient,
    // tout ce qui s'accumule serait abandonné avant même l'ouverture.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ error: "ingest_disabled" }),
      }),
    );

    const res = await emitOutboxRow("outbox-1");

    expect(res.status).toBe("failed");
    const data = updateMock.mock.calls[0]?.[0]?.data;
    expect(data.status).toBe("failed");
    expect(data.attempts).toBe(0);
    expect(data.nextAttemptAt).toBeInstanceOf(Date);
  });

  it("réessaie après une panne réseau, avec une date de reprise", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const res = await emitOutboxRow("outbox-1");

    expect(res.status).toBe("failed");
    const data = updateMock.mock.calls[0]?.[0]?.data;
    expect(data.attempts).toBe(1);
    expect(data.nextAttemptAt).toBeInstanceOf(Date);
    expect(data.status).toBe("failed");
  });

  it("ne réémet jamais une ligne déjà envoyée", async () => {
    findUniqueMock.mockResolvedValue({ id: "outbox-1", status: "sent", attempts: 1, payload: {} });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await emitOutboxRow("outbox-1");

    expect(res.status).toBe("skipped");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. RATTRAPAGE
// ─────────────────────────────────────────────────────────────────────────────

describe("rattrapage", () => {
  beforeEach(enableSync);

  it("reprend les lignes dues et mesure le retard du plus vieux message", async () => {
    findManyMock.mockResolvedValue([{ id: "outbox-1" }, { id: "outbox-2" }]);
    findUniqueMock.mockResolvedValue({
      id: "outbox-1",
      status: "failed",
      attempts: 1,
      payload: {},
    });
    findFirstMock.mockResolvedValue({ createdAt: new Date(Date.now() - 30 * 60_000) });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) }),
    );

    const res = await sweepCrmSyncOutbox();

    expect(res.emitted).toBe(2);
    expect(res.sent).toBe(2);
    // Le retard est mesuré et journalisé : un silence ne doit jamais passer
    // pour un succès (leçon IndexNow).
    expect(res.oldestPendingMinutes).toBe(30);
  });
});
