import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  emailLog: { findMany: vi.fn(async () => [{ id: "1", recipient: "camille@exemple.fr" }]) },
  emailOutbox: { findMany: vi.fn(async () => []) },
  clientContactAdresse: {
    findMany: vi.fn(async () => [
      { email: "camille@exemple.fr", contact: { nom: "Camille Roux" } },
    ]),
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { NomDestinataire } from "../NomDestinataire";

describe("NomDestinataire", () => {
  it("rend le nom du destinataire, jamais l'adresse", async () => {
    const el = await NomDestinataire({ clientId: "cl", cles: "mail:1", cle: "mail:1" });
    const html = renderToStaticMarkup(el as React.ReactElement);
    expect(html).toContain("à Camille Roux");
    expect(html).not.toContain("@");
  });
  it("ne rend rien quand le contact est inconnu", async () => {
    expect(await NomDestinataire({ clientId: "cl2", cles: "mail:9", cle: "mail:9" })).toBeNull();
  });
  it("une panne de lecture ne coûte que le nom", async () => {
    prismaMock.clientContactAdresse.findMany.mockRejectedValueOnce(new Error("coupée"));
    expect(await NomDestinataire({ clientId: "cl3", cles: "mail:1", cle: "mail:1" })).toBeNull();
  });
});
