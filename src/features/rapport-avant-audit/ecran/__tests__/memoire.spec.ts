import { describe, expect, it } from "vitest";

import { creerAccesEnMemoire } from "../memoire";
import { AUTRE_CLIENT, base, CLIENT, proposition, resume, RAPPORT } from "./fixtures";

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
    expect(await a.lireBase(CLIENT, RAPPORT)).not.toBeNull();
    expect(await a.lireBase(AUTRE_CLIENT, RAPPORT)).toBeNull();
    expect(await a.lirePropositions(AUTRE_CLIENT, RAPPORT)).toEqual([]);
  });

  it("les documents V2 ne sortent que pour une base base-audit/2", async () => {
    const v1 = termine();
    v1.resume = { ...v1.resume, versionSchema: "base-audit/1" };
    const a = creerAccesEnMemoire({ rapports: [v1] });
    expect((await a.telecharger(CLIENT, RAPPORT, "synthese-html"))?.nom).toBe(
      "INTERNE-synthese-v1.html",
    );
    expect(await a.telecharger(CLIENT, RAPPORT, "automatisations-html")).toBeNull();
    expect(await a.telecharger(CLIENT, RAPPORT, "schema-html")).toBeNull();
    const b = creerAccesEnMemoire({ rapports: [termine()] });
    const f = await b.telecharger(CLIENT, RAPPORT, "schema-html");
    expect(f?.nom).toBe("INTERNE-schema-v1.html");
    expect(f?.type).toBe("text/html; charset=utf-8");
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
