/**
 * Filet du départ du code de signature d'un DEVIS (lot 4 bis, audit sécurité) : un e-mail porteur d'un
 * code ne part pas quand le code est expiré, servi, remplacé — ni quand la PIÈCE est bloquée (cinq échecs
 * sur un code, ou plafond cumulé). Le commentaire du lecteur le promettait ; le lecteur ne le faisait pas.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({
  code: null as null | Record<string, unknown>,
  bloqueDansLaPiece: null as null | { id: string },
  cumule: null as null | { bloqueJusquA: Date | null },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentSignatureCode: {
      findUnique: async () => etat.code,
      findFirst: async () => etat.bloqueDansLaPiece,
    },
    documentSignatureEchecs: { findUnique: async () => etat.cumule },
  },
}));
vi.mock("@/lib/security/email-hash", () => ({ hashEmailForLookup: () => null }));
vi.mock("@/server/email/textes-valides-lecture", () => ({ lireTextesValides: async () => ({}) }));

import { CLE_CODE_SIGNATURE } from "@/server/email/code-en-file";
import { RELECTURES_AU_DEPART } from "@/server/email/relecture-au-depart";

const lire = () => {
  const lecteur = RELECTURES_AU_DEPART.get("devis-code-signature");
  if (lecteur === undefined) throw new Error("aucun lecteur");
  return lecteur({
    template: "devis-code-signature",
    to: "client@exemple.fr",
    entityType: "DocumentGenere",
    entityId: "d1",
    payload: { [CLE_CODE_SIGNATURE]: "c1" },
  });
};

beforeEach(() => {
  etat.code = {
    expiresAt: new Date(Date.now() + 5 * 60_000),
    utiliseAt: null,
    invalideAt: null,
    documentGenereId: "d1",
    partie: "client",
  };
  etat.bloqueDansLaPiece = null;
  etat.cumule = null;
});

describe("relireCodeDevis : pièce bloquée", () => {
  it("laisse partir un code vivant sur une pièce libre", async () => {
    expect(await lire()).toBeNull();
  });

  it("retient l'e-mail quand la pièce est bloquée (cinq échecs sur un code)", async () => {
    etat.bloqueDansLaPiece = { id: "autre" };
    expect(await lire()).toMatch(/bloqu/);
  });

  it("retient l'e-mail quand le plafond cumulé bloque la pièce", async () => {
    etat.cumule = { bloqueJusquA: new Date(Date.now() + 60_000) };
    expect(await lire()).toMatch(/bloqu/);
  });

  it("laisse partir quand le blocage cumulé est échu", async () => {
    etat.cumule = { bloqueJusquA: new Date(Date.now() - 60_000) };
    expect(await lire()).toBeNull();
  });

  it("retient toujours un code expiré, servi ou remplacé", async () => {
    etat.code = { ...etat.code!, expiresAt: new Date(Date.now() - 1) };
    expect(await lire()).toMatch(/expir/);
    etat.code = { ...etat.code, expiresAt: new Date(Date.now() + 60_000), utiliseAt: new Date() };
    expect(await lire()).toMatch(/servi/);
    etat.code = { ...etat.code, utiliseAt: null, invalideAt: new Date() };
    expect(await lire()).toMatch(/remplac/);
  });
});
