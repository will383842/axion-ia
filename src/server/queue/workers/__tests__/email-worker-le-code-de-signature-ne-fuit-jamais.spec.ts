// S6b — relecture sécurité « code vers Sentry ». Le code de signature à usage unique
// part dans l'e-mail, et NULLE PART ailleurs — y compris quand l'envoi échoue :
//   · ni dans les données du job (Redis, tableau des files, `jobData` chez Sentry) ;
//   · ni dans le message d'erreur (journal des envois, raison d'échec, Sentry) ;
//   · ni sur la console (journaux du conteneur).
// Le chemin est parcouru de bout en bout : demande du code → job enfilé → worker →
// relais en panne qui recopie l'objet du message dans son erreur → `failed` → Sentry.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const CODE = "042517";

const d = vi.hoisted(() => ({
  ctor: vi.fn(),
  handlers: new Map<string, (...a: unknown[]) => unknown>(),
  sendEmail: vi.fn(),
  render: vi.fn(),
  cloturer: vi.fn(),
  tentative: vi.fn(),
  copie: vi.fn(),
  sentry: vi.fn(),
  envoyer: vi.fn(),
}));

vi.mock("bullmq", () => ({
  Worker: class {
    constructor(...args: unknown[]) {
      d.ctor(...args);
    }
    on(evt: string, fn: (...a: unknown[]) => unknown): this {
      d.handlers.set(evt, fn);
      return this;
    }
  },
}));
vi.mock("@sentry/nextjs", () => ({ captureException: (...a: unknown[]) => d.sentry(...a) }));
vi.mock("../../connection", () => ({ getBullConnectionOrThrow: () => ({ host: "doublure" }) }));
vi.mock("@/lib/email/client", () => ({
  sendEmail: (...a: unknown[]) => d.sendEmail(...a),
  verifyTransport: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("@/lib/email/templates", () => ({
  renderEmailTemplate: (...a: unknown[]) => d.render(...a),
}));
vi.mock("@/lib/r2-storage", () => ({ isR2Configured: () => false, getObjectBufferR2: vi.fn() }));
vi.mock("@/server/email/email-log", () => ({
  cloturerJournal: (...a: unknown[]) => d.cloturer(...a),
  noterTentativeEchouee: (...a: unknown[]) => d.tentative(...a),
  marquerAnnule: vi.fn(),
}));
vi.mock("@/server/email/copie-envoi", () => ({
  enregistrerCopieEnvoi: (...a: unknown[]) => d.copie(...a),
}));
// La relecture au départ (texte toujours validé, fiche vivante) a ses propres tests ;
// ici, le job doit ATTEINDRE le relais.
vi.mock("@/server/email/relecture-au-depart", () => ({ RELECTURES_AU_DEPART: new Map() }));
vi.mock("@/server/guide-ia/journal", () => ({ marquerGuideEnvoye: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentGenere: {
      findUnique: vi.fn().mockResolvedValue({
        type: "contrat_sous_traitance",
        sousTraitantId: null,
        trainerId: "t-1",
      }),
      findMany: vi.fn().mockResolvedValue([{ id: "d-1" }]),
    },
    trainer: {
      findUnique: vi
        .fn()
        .mockResolvedValue({
          statut: "sous_traitant",
          prenom: "Claire",
          email: "c@exemple.invalid",
        }),
    },
    documentSignatureCode: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue({ expiresAt: new Date("2026-10-13T08:15:00Z") }),
    },
  },
}));
vi.mock("@/server/qualiopi/documents/signature/code-signature", () => ({
  CODE_VALIDITE_MS: 15 * 60 * 1000,
  emettreCodeSignature: vi
    .fn()
    .mockResolvedValue({ code: "042517", expiresAt: new Date("2026-10-13T08:15:00Z") }),
}));
vi.mock("@/server/qualiopi/formateurs-independants/envois", () => ({
  envoyer: (...a: unknown[]) => d.envoyer(...a),
  texteValide: vi.fn().mockResolvedValue(true),
}));

import { envoyerCodeSignature } from "@/server/qualiopi/formateurs-independants/code-signature-envoi";
import { startEmailWorker } from "../email-worker";

type Processeur = (job: Record<string, unknown>) => Promise<void>;
const sorties: unknown[] = [];
const espions: Array<{ mockRestore: () => void }> = [];

beforeEach(() => {
  vi.clearAllMocks();
  d.handlers.clear();
  sorties.length = 0;
  process.env["PII_ENCRYPTION_KEY"] = "a1".repeat(32);
  d.envoyer.mockResolvedValue("envoye");
  // Le rendu reçoit le code OUVERT et le met dans l'objet (texte F17).
  d.render.mockImplementation(
    async (_t: string, _l: string, payload: { valeurs: { code: string } }) => ({
      subject: `${payload.valeurs.code} : votre code de signature Axion-IA`,
      html: `<p>Votre code : ${payload.valeurs.code}</p>`,
      text: `Votre code : ${payload.valeurs.code}`,
      famille: "A",
    }),
  );
  for (const m of ["log", "info", "warn", "error", "debug"] as const) {
    espions.push(
      vi.spyOn(console, m).mockImplementation((...a: unknown[]) => {
        sorties.push(a);
      }),
    );
  }
});
afterEach(() => {
  for (const e of espions.splice(0)) e.mockRestore();
});

/** Le job tel que la file le reçoit, construit depuis le VRAI envoi du code. */
async function jobDuCode(): Promise<Record<string, unknown>> {
  const r = await envoyerCodeSignature({
    documentGenereId: "d-1",
    maintenant: new Date("2026-10-13T08:00:00Z"),
  });
  expect(r).toEqual({ ok: true });
  const e = d.envoyer.mock.calls[0]?.[0] as {
    gabarit: string;
    destinataire: string;
    payload: object;
  };
  return {
    id: "job-1",
    name: e.gabarit,
    data: { template: e.gabarit, to: e.destinataire, locale: "fr", payload: e.payload },
    attemptsMade: 0,
    opts: { attempts: 1 },
  };
}

function toutCeQuiEstSorti(): string {
  return JSON.stringify(
    [
      sorties,
      d.cloturer.mock.calls,
      d.tentative.mock.calls,
      d.sentry.mock.calls.map(([err, hint]) => [String(err), (err as Error).stack, hint]),
    ],
    (_k, v) => (v instanceof Error ? { message: v.message, stack: v.stack } : v),
  );
}

describe("le code de signature ne sort que par l'e-mail", () => {
  it("le job enfilé ne porte pas le code en clair", async () => {
    const job = await jobDuCode();
    expect(JSON.stringify(job)).not.toContain(CODE);
  });

  it("envoi réussi : l'e-mail porte bien le code (ouvert au seul rendu)", async () => {
    d.sendEmail.mockResolvedValue({ messageId: "<m1>" });
    startEmailWorker();
    const job = await jobDuCode();
    await (d.ctor.mock.calls[0]?.[1] as Processeur)(job);
    expect(d.sendEmail.mock.calls[0]?.[0]).toMatchObject({
      subject: expect.stringContaining(CODE),
    });
    expect(JSON.stringify(job)).not.toContain(CODE);
    expect(toutCeQuiEstSorti()).not.toContain(CODE);
  });

  it("🔴 envoi en échec : le code n'est ni dans Sentry, ni dans le journal, ni sur la console", async () => {
    // Le relais refuse et RECOPIE l'objet du message dans son erreur.
    d.sendEmail.mockRejectedValue(
      new Error(`550 5.7.1 rejected: Subject "${CODE} : votre code de signature Axion-IA"`),
    );
    startEmailWorker();
    const job = await jobDuCode();
    let leve: unknown;
    try {
      await (d.ctor.mock.calls[0]?.[1] as Processeur)(job);
    } catch (e) {
      leve = e;
    }
    expect(leve).toBeInstanceOf(Error);
    expect(String((leve as Error).message)).toContain("[code masqué]");
    // BullMQ appelle `failed` avec l'erreur levée : c'est elle qui part chez Sentry.
    d.handlers.get("failed")?.({ ...job, failedReason: (leve as Error).message }, leve);
    expect(d.sentry).toHaveBeenCalledTimes(1);
    expect(d.cloturer).toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
    expect(toutCeQuiEstSorti()).not.toContain(CODE);
  });

  it("une tentative intermédiaire en échec ne journalise pas non plus le code", async () => {
    d.sendEmail.mockRejectedValue(new Error(`421 try later (${CODE})`));
    startEmailWorker();
    const job = { ...(await jobDuCode()), opts: { attempts: 5 } };
    await expect((d.ctor.mock.calls[0]?.[1] as Processeur)(job)).rejects.toThrow();
    expect(d.tentative).toHaveBeenCalledTimes(1);
    expect(toutCeQuiEstSorti()).not.toContain(CODE);
  });

  it("un job à code dont le code n'est pas scellé est refusé, sans rien envoyer", async () => {
    startEmailWorker();
    const job = await jobDuCode();
    const data = job["data"] as { payload: { valeurs: Record<string, string> } };
    data.payload.valeurs["code"] = CODE;
    await expect((d.ctor.mock.calls[0]?.[1] as Processeur)(job)).rejects.toThrow(/non scellé/);
    expect(d.sendEmail).not.toHaveBeenCalled();
    expect(toutCeQuiEstSorti()).not.toContain(CODE);
  });
});
