import { describe, expect, it } from "vitest";

import { renderEmailTemplate } from "../index";
describe("commission suspendue, puis libérée (art. 4.2 bis)", () => {
  it("prévient l'apporteur sans nommer le client ni promettre de délai", async () => {
    const s = await renderEmailTemplate("apporteur-commission-suspension" as never, "fr", {
      contactName: "Claire Martin",
      etat: "suspendue",
    });
    expect(s.subject).toBe("Une de vos commissions est suspendue");
    expect(s.text).toContain("article 4.2 bis");
    const l = await renderEmailTemplate("apporteur-commission-suspension" as never, "fr", {
      contactName: "Claire Martin",
      etat: "levee",
    });
    expect(l.subject).toBe("Votre commission reprend son cours");
  });
});

describe("manquement ou fraude (art. 4.5 bis)", () => {
  it("donne les faits, les conséquences, et la contestation sous trente jours", async () => {
    const r = await renderEmailTemplate("apporteur-manquement" as never, "fr", {
      contactName: "Claire Martin",
      faits: "L'entreprise déclare n'avoir jamais échangé avec vous.",
    });
    expect(r.subject).toBe("Manquement constaté sur une de vos déclarations");
    const t = r.text.replace(/\s+/g, " ");
    expect(t).toContain("L'entreprise déclare n'avoir jamais échangé avec vous.");
    expect(t).toContain("article 4.5 bis");
    expect(t).toContain("trente jours");
  });
});

describe("manquement : avis au parrain", () => {
  it("un simple avis, sans les faits", async () => {
    const r = await renderEmailTemplate("apporteur-manquement" as never, "fr", {
      contactName: "Paul Martin",
      parrain: true,
    });
    expect(r.subject).toBe("Une part de parrainage est retirée");
    expect(r.text).not.toContain("Les faits sont les suivants");
  });
});
