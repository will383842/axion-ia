// @vitest-environment node
/**
 * Art. 17 — l'effacement SUPPRIME la copie des e-mails envoyés à la personne
 * (2026-09-27), et garde la ligne du journal, pseudonymisée (preuve d'envoi).
 *
 * Par l'effet, sur une base en mémoire, avec la fonction qu'appellent
 * `/api/gdpr-erase` et l'effacement console (`eraseEmailTracesForEmail`).
 *
 * 🔑 Ordre : la copie se retrouve par l'adresse de sa ligne de journal. Si la
 * pseudonymisation passait AVANT, la suppression ne trouverait plus rien — et
 * l'effacement se dirait complet en laissant le contenu. Le test le verrait :
 * le décompte `copiesSupprimees` tomberait à 0 et la copie resterait.
 *
 * Témoins : la copie d'une AUTRE personne reste ; la ligne de journal de la
 * personne reste (pseudonymisée, pas supprimée).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { table, type Table } from "@/server/newsletter/__tests__/base-en-memoire";

const base = vi.hoisted(() => ({ tables: {} as Record<string, unknown> }));

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

import { eraseEmailTracesForEmail } from "@/lib/rgpd-erase";

const PERSONNE = "camille.dupont@example.invalid";
const AUTRE = "alex.martin@example.invalid";

let tables: Record<string, Table>;

beforeEach(() => {
  tables = {
    emailLog: table([
      { id: "l1", recipient: PERSONNE, template: "apporteur-invitation-appel", bounceReason: null },
      // Casse différente : `recipient` est en citext.
      { id: "l2", recipient: "Camille.Dupont@Example.Invalid", template: "lead-apporteur-recu" },
      { id: "l3", recipient: AUTRE, template: "apporteur-invitation-appel", bounceReason: null },
    ]),
    emailLogContent: table([
      {
        emailLogId: "l1",
        subject: "Ta candidature est retenue",
        html: "<p>Bonjour Camille</p>",
        text: "Bonjour Camille",
      },
      {
        emailLogId: "l2",
        subject: "Ton kit",
        html: "<p>Bonjour Camille</p>",
        text: "Bonjour Camille",
      },
      {
        emailLogId: "l3",
        subject: "Ta candidature est retenue",
        html: "<p>Bonjour Alex</p>",
        text: "Bonjour Alex",
      },
    ]),
    emailOutbox: table([]),
  };
  base.tables = tables;
});

describe("🔴 art. 17 — la copie des e-mails de la personne disparaît", () => {
  it("supprime ses copies, et le dit dans le décompte", async () => {
    const r = await eraseEmailTracesForEmail(PERSONNE);
    expect(r.copiesSupprimees).toBe(2);
    expect(tables["emailLogContent"]!.lignes.map((l) => l["emailLogId"])).toEqual(["l3"]);
    // Plus aucun contenu à son nom.
    expect(JSON.stringify(tables["emailLogContent"]!.lignes)).not.toContain("Camille");
  });

  it("garde la ligne du journal, pseudonymisée — la preuve d'envoi survit", async () => {
    await eraseEmailTracesForEmail(PERSONNE);
    const l1 = tables["emailLog"]!.lignes.find((l) => l["id"] === "l1");
    expect(l1).toBeDefined();
    expect(l1?.["recipient"]).toMatch(/^erased:[0-9a-f]{16}@erased\.local$/);
  });

  it("une personne sans envoi : rien n'est supprimé, rien ne lève", async () => {
    const r = await eraseEmailTracesForEmail("inconnue@example.invalid");
    expect(r.copiesSupprimees).toBe(0);
    expect(tables["emailLogContent"]!.lignes).toHaveLength(3);
  });
});
