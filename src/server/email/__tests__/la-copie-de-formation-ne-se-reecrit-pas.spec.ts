// @vitest-environment node
/**
 * Chantier QNC, L11 — la copie d'un e-mail est en CRÉATION SEULE.
 *
 * La copie est la preuve de ce que la personne a reçu. Un job rejoué qui la
 * RÉÉCRIRAIT y mettrait ce que le gabarit est devenu depuis — plus ce qui est
 * parti. Interrupteur `qualiopi.dossier_session.actif` en `actif` : la première
 * copie fait foi, une seconde écriture est un no-op (P2002). Éteint (ou
 * `essai`, faute de session ciblée) : `upsert`, exactement comme avant.
 *
 * Par l'effet, sur une base en mémoire où la clé `email_log_id` est UNIQUE.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { table, type Table } from "@/server/newsletter/__tests__/base-en-memoire";

const base = vi.hoisted(() => ({ tables: {} as Record<string, unknown>, capture: vi.fn() }));

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

/** Une table de copies dont `email_log_id` est la clé primaire, comme en base. */
function copiesUniques(): Table {
  const t = table([]);
  const upsert = t.upsert.bind(t);
  return Object.assign(t, {
    create: async (a: { data: Record<string, unknown> }) => {
      if (t.lignes.some((l) => l["emailLogId"] === a.data["emailLogId"])) {
        throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
      }
      t.lignes.push({ ...a.data });
      return { ...a.data };
    },
    upsert,
  });
}

function journal(): Table {
  const t = table([{ id: "l-1", jobId: "job-1", status: "sent", recipient: "a@example.invalid" }]);
  return Object.assign(t, {
    findFirst: async (a: { where?: Record<string, unknown>; select?: Record<string, boolean> }) =>
      (
        await t.findMany({
          ...(a.where ? { where: a.where } : {}),
          ...(a.select ? { select: a.select } : {}),
        })
      )[0] ?? null,
  });
}

function reglage(etat: string | null): Table {
  return table(etat === null ? [] : [{ key: "qualiopi.dossier_session.actif", value: { etat } }]);
}

const PREMIER = { jobId: "job-1", subject: "Votre convocation", html: "<p>v1</p>", text: "v1" };
const REJOUE = {
  jobId: "job-1",
  subject: "Votre convocation (gabarit modifié)",
  html: "<p>v2</p>",
  text: "v2",
};

beforeEach(() => {
  delete process.env["DATABASE_URL"];
  base.capture.mockReset();
});

function installer(etat: string | null) {
  base.tables = { emailLog: journal(), emailLogContent: copiesUniques(), setting: reglage(etat) };
  return base.tables as Record<string, Table>;
}

describe("actif — la première copie fait foi", () => {
  it("un job rejoué ne réécrit pas la copie, et ne lève pas", async () => {
    const t = installer("actif");
    expect(await enregistrerCopieEnvoi(PREMIER)).toBe(true);
    expect(await enregistrerCopieEnvoi(REJOUE)).toBe(true);
    expect(t["emailLogContent"]!.lignes).toHaveLength(1);
    expect(t["emailLogContent"]!.lignes[0]!["subject"]).toBe("Votre convocation");
    expect(t["emailLogContent"]!.lignes[0]!["text"]).toBe("v1");
    expect(base.capture).not.toHaveBeenCalled();
  });
});

describe("éteint — rien ne change (upsert, comme avant)", () => {
  it("clé absente : le rejeu réécrit la copie, comme avant ce lot", async () => {
    const t = installer(null);
    await enregistrerCopieEnvoi(PREMIER);
    await enregistrerCopieEnvoi(REJOUE);
    expect(t["emailLogContent"]!.lignes).toHaveLength(1);
    expect(t["emailLogContent"]!.lignes[0]!["text"]).toBe("v2");
  });

  it("essai : sans session ciblée, le lot n'agit pas", async () => {
    const t = installer("essai");
    await enregistrerCopieEnvoi(PREMIER);
    await enregistrerCopieEnvoi(REJOUE);
    expect(t["emailLogContent"]!.lignes[0]!["text"]).toBe("v2");
  });
});
