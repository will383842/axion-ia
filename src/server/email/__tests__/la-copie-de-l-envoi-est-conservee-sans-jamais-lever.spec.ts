// @vitest-environment node
/**
 * `enregistrerCopieEnvoi` — la copie de l'e-mail envoyé (2026-09-27).
 *
 * Prouvé par l'EFFET, sur une base en mémoire : la copie est écrite sur la
 * bonne ligne du journal, liens personnels masqués, noms de pièces jointes
 * gardés. Et la fonction ne lève JAMAIS : l'e-mail est déjà parti quand elle
 * s'exécute, et une exception ferait rejouer le job — donc renvoyer l'e-mail.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { table, type Table } from "@/server/newsletter/__tests__/base-en-memoire";

const base = vi.hoisted(() => ({
  tables: {} as Record<string, unknown>,
  capture: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: new Proxy(
    {},
    {
      get(_c, modele: string) {
        const t = base.tables[modele];
        if (!t) throw new Error(`table inattendue : ${modele}`);
        return t;
      },
    },
  ),
}));
vi.mock("@/server/queue/lib/sentry-worker", () => ({
  captureWorkerError: (...a: unknown[]) => base.capture(...a),
}));

import { enregistrerCopieEnvoi } from "../copie-envoi";

let tables: Record<string, Table & { findFirst?: unknown }>;

/** `findFirst` n'est pas dans la base en mémoire : premier résultat du `findMany`. */
type ArgsLecture = { where?: Record<string, unknown>; select?: Record<string, boolean> };

function avecFindFirst(t: Table): Table & { findFirst: (a: ArgsLecture) => Promise<unknown> } {
  return Object.assign(t, {
    findFirst: async (a: ArgsLecture) =>
      (
        await t.findMany({
          ...(a.where ? { where: a.where } : {}),
          ...(a.select ? { select: a.select } : {}),
        })
      )[0] ?? null,
  });
}

const JETON = "aB3dE5fG7hJ9kL1mN3pQ5rS7tU9vW1xY";

beforeEach(() => {
  delete process.env["DATABASE_URL"];
  base.capture.mockReset();
  tables = {
    emailLog: avecFindFirst(
      table([
        { id: "l-autre", jobId: "job-2", status: "sent", recipient: "b@example.invalid" },
        { id: "l-1", jobId: "job-1", status: "sent", recipient: "a@example.invalid" },
      ]),
    ),
    emailLogContent: table([]),
  };
  base.tables = tables;
});

describe("la copie est conservée à l'envoi", () => {
  it("écrit objet, HTML et texte sur la ligne du job, liens personnels masqués", async () => {
    const ok = await enregistrerCopieEnvoi({
      jobId: "job-1",
      subject: "Votre convention à signer",
      html: `<a href="https://axion-ia.com/portail/signer/${JETON}">Signer</a>`,
      text: `Signer : https://axion-ia.com/portail/signer/${JETON}`,
      attachmentNames: ["convention-AXI-2026-050.pdf"],
    });
    expect(ok).toBe(true);
    const lignes = tables["emailLogContent"]!.lignes;
    expect(lignes).toHaveLength(1);
    const copie = lignes[0]!;
    expect(copie["emailLogId"]).toBe("l-1");
    expect(copie["subject"]).toBe("Votre convention à signer");
    expect(JSON.stringify(copie)).not.toContain(JETON);
    expect(copie["html"]).toContain("https://axion-ia.com/portail/signer/[masqué]");
    expect(copie["attachmentNames"]).toEqual(["convention-AXI-2026-050.pdf"]);
    expect(copie["secretsMasques"]).toBe(2);
  });

  it("sans identifiant de job : rien n'est deviné, rien n'est écrit", async () => {
    const ok = await enregistrerCopieEnvoi({
      jobId: undefined,
      subject: "s",
      html: "h",
      text: "t",
    });
    expect(ok).toBe(false);
    expect(tables["emailLogContent"]!.lignes).toHaveLength(0);
  });
});

describe("🔴 un échec d'enregistrement ne lève jamais", () => {
  it("base en panne : rend false, prévient Sentry, ne lève pas", async () => {
    tables["emailLogContent"]!.upsert = async () => {
      throw new Error("connexion perdue");
    };
    await expect(
      enregistrerCopieEnvoi({ jobId: "job-1", subject: "s", html: "h", text: "t" }),
    ).resolves.toBe(false);
    expect(base.capture).toHaveBeenCalledTimes(1);
  });

  it("table absente (fenêtre worker avant migration, P2021) : ne lève pas, pas de bruit Sentry", async () => {
    tables["emailLogContent"]!.upsert = async () => {
      throw Object.assign(new Error("The table `email_log_contents` does not exist"), {
        code: "P2021",
      });
    };
    await expect(
      enregistrerCopieEnvoi({ jobId: "job-1", subject: "s", html: "h", text: "t" }),
    ).resolves.toBe(false);
    expect(base.capture).not.toHaveBeenCalled();
  });
});

describe("stub.invalid — aucun appel base au build", () => {
  it("ne touche à aucune table", async () => {
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    base.tables = {}; // toute lecture de table lèverait « table inattendue »
    await expect(
      enregistrerCopieEnvoi({ jobId: "job-1", subject: "s", html: "h", text: "t" }),
    ).resolves.toBe(false);
    expect(base.capture).not.toHaveBeenCalled();
  });
});
