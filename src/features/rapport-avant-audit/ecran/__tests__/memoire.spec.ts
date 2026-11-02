import { describe, expect, it } from "vitest";

import { ACCES_NON_BRANCHE, accesRapports } from "../brancher";
import { creerAccesEnMemoire } from "../memoire";
import { AUTRE_CLIENT, base, CLIENT, proposition, resume } from "./fixtures";

const termine = () => ({ clientId: CLIENT, resume: resume(), base: base([proposition()]) });

describe("accès en mémoire (contrat `AccesRapports`)", () => {
  it("liste les rapports d'un client, le plus récent d'abord, sans ceux des autres", async () => {
    const a = creerAccesEnMemoire({
      rapports: [
        termine(),
        {
          clientId: CLIENT,
          resume: resume({ id: "r2", version: 2, statut: "echoue" }),
          base: null,
        },
        { clientId: AUTRE_CLIENT, resume: resume({ id: "x" }), base: base([]) },
      ],
    });
    expect((await a.listerRapports(CLIENT)).map((r) => r.version)).toEqual([2, 1]);
  });

  it("une base ne se lit que par son client", async () => {
    const a = creerAccesEnMemoire({ rapports: [termine()] });
    expect(await a.lireBase(CLIENT, "r1")).not.toBeNull();
    expect(await a.lireBase(AUTRE_CLIENT, "r1")).toBeNull();
    expect(await a.lirePropositions(AUTRE_CLIENT, "r1")).toEqual([]);
  });

  it("le PDF client ne sort qu'après validation", async () => {
    const a = creerAccesEnMemoire({
      rapports: [termine()],
      maintenant: () => new Date("2026-11-02T09:00:00Z"),
    });
    expect(await a.telecharger(CLIENT, "r1", "pdf-client")).toBeNull();
    expect(await a.validerPdf(CLIENT, "r1", "will")).toEqual({ ok: true });
    const [r] = await a.listerRapports(CLIENT);
    expect(r?.pdfValidePar).toBe("will");
    const f = await a.telecharger(CLIENT, "r1", "pdf-client");
    expect(f?.nom).toBe("rapport-client-v1.pdf");
    expect(f?.type).toBe("application/pdf");
  });

  it("un lancement crée une nouvelle version en attente ; pas deux à la fois", async () => {
    const a = creerAccesEnMemoire({ rapports: [termine()] });
    const r = await a.lancer(CLIENT, "will");
    expect(r.ok).toBe(true);
    const [dernier] = await a.listerRapports(CLIENT);
    expect(dernier).toMatchObject({ version: 2, statut: "en_attente" });
    expect((await a.lancer(CLIENT, "will")).ok).toBe(false);
  });
});

describe("raccord (`brancher.ts`)", () => {
  it("tant que le vrai code n'est pas raccordé : rien à lire, rien à lancer", async () => {
    const a = accesRapports();
    expect(a).toBe(ACCES_NON_BRANCHE);
    expect(a.branche).toBe(false);
    expect(await a.listerRapports(CLIENT)).toEqual([]);
    expect((await a.lancer(CLIENT, "will")).ok).toBe(false);
    expect(await a.telecharger(CLIENT, "r1", "base-json")).toBeNull();
  });
});
