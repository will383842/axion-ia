// Lot L14 — fin de collaboration : préavis, motifs, avertissement, textes F47/F49.
import { describe, expect, it } from "vitest";

import {
  MOTIFS_FIN,
  conservationApresFin,
  dateEffetParDefaut,
  preavisJours,
  refusFin,
  texteFinCollaboration,
  valeursAvertissement,
  type DemandeFin,
} from "../fin-collaboration";
import {
  CROCHET_NON_REMPLI,
  TEXTES_FORMATEUR,
} from "@/lib/email/templates/formateur-independant-textes";

const JOUR = 24 * 60 * 60 * 1000;
const DECISION = new Date("2026-10-13T08:00:00Z");

function demande(over: Partial<DemandeFin> = {}): DemandeFin {
  return {
    motif: "initiative_axion",
    dateEffet: new Date("2026-11-12T00:00:00Z"),
    decision: DECISION,
    debutRelation: new Date("2026-03-01T00:00:00Z"),
    avertissementEnvoyeAt: null,
    irreparable: false,
    note: "",
    missionsApresEffet: [],
    ...over,
  };
}

describe("préavis selon la durée de la relation (C1, D-7)", () => {
  it("30 jours la 1re année, 60 la 2e, 90 au-delà", () => {
    expect(preavisJours(new Date("2026-03-01T00:00:00Z"), DECISION)).toBe(30);
    expect(preavisJours(new Date("2025-10-13T08:00:00Z"), DECISION)).toBe(60);
    expect(preavisJours(new Date("2025-03-01T00:00:00Z"), DECISION)).toBe(60);
    expect(preavisJours(new Date("2024-10-13T08:00:00Z"), DECISION)).toBe(90);
    expect(preavisJours(new Date("2020-01-01T00:00:00Z"), DECISION)).toBe(90);
  });

  it("date d'effet par défaut : décision + préavis ; le jour même sans préavis", () => {
    const debut = new Date("2025-03-01T00:00:00Z");
    expect(dateEffetParDefaut("initiative_axion", debut, DECISION).toISOString()).toBe(
      "2026-12-12T00:00:00.000Z",
    );
    expect(dateEffetParDefaut("siret_cesse", debut, DECISION).toISOString()).toBe(
      "2026-10-13T00:00:00.000Z",
    );
  });
});

describe("refus de la fin demandée", () => {
  it("préavis respecté : permise", () => {
    expect(refusFin(demande())).toEqual([]);
  });

  it("préavis trop court : refusée ; date passée : refusée", () => {
    expect(refusFin(demande({ dateEffet: new Date("2026-11-01T00:00:00Z") }))).toContain(
      "preavis-trop-court",
    );
    expect(
      refusFin(demande({ motif: "siret_cesse", dateEffet: new Date("2026-10-01T00:00:00Z") })),
    ).toContain("date-effet-avant-decision");
  });

  it("manquement refusé sans avertissement préalable de 8 jours", () => {
    const m = { motif: "manquement" as const, dateEffet: DECISION };
    expect(refusFin(demande(m))).toEqual(["avertissement-manquant"]);
    expect(
      refusFin(demande({ ...m, avertissementEnvoyeAt: new Date(DECISION.getTime() - 3 * JOUR) })),
    ).toEqual(["avertissement-manquant"]);
    expect(
      refusFin(demande({ ...m, avertissementEnvoyeAt: new Date(DECISION.getTime() - 8 * JOUR) })),
    ).toEqual([]);
  });

  it("faute irréparable : sans avertissement, mais motivée", () => {
    const m = { motif: "manquement" as const, dateEffet: DECISION, irreparable: true };
    expect(refusFin(demande(m))).toEqual(["note-manquante"]);
    expect(refusFin(demande({ ...m, note: "Motif écrit." }))).toEqual([]);
  });

  it("missions acceptées après la date d'effet : refusée (elles sont listées)", () => {
    expect(
      refusFin(
        demande({
          missionsApresEffet: [{ sessionId: "s", debut: new Date("2026-12-01T00:00:00Z") }],
        }),
      ),
    ).toEqual(["missions-apres-effet"]);
  });
});

describe("jour de Paris, pas d'UTC", () => {
  it("décision à 0 h 30 à Paris (22 h 30 UTC la veille) : le préavis part du jour de Paris", () => {
    const decision = new Date("2026-10-11T22:30:00Z"); // 12/10 à Paris
    expect(
      dateEffetParDefaut(
        "initiative_axion",
        new Date("2026-03-01T00:00:00Z"),
        decision,
      ).toISOString(),
    ).toBe("2026-11-11T00:00:00.000Z");
    expect(
      refusFin(
        demande({ motif: "siret_cesse", decision, dateEffet: new Date("2026-10-11T00:00:00Z") }),
      ),
    ).toContain("date-effet-avant-decision");
  });

  it("une fin sans préavis prend effet le jour même", () => {
    expect(
      refusFin(demande({ motif: "siret_cesse", dateEffet: new Date("2026-10-20T00:00:00Z") })),
    ).toEqual(["date-effet-immediate"]);
    expect(
      refusFin(demande({ motif: "siret_cesse", dateEffet: new Date("2026-10-13T00:00:00Z") })),
    ).toEqual([]);
  });
});

describe("conservation (G5) : aucune purge, des dates affichées", () => {
  it("contrat et vigilance 5 ans après la fin, pièces comptables 10 ans", () => {
    const c = conservationApresFin(new Date("2026-11-12T00:00:00Z"));
    expect(c.contratEtVigilance.toISOString().slice(0, 10)).toBe("2031-11-12");
    expect(c.piecesComptables.toISOString().slice(0, 10)).toBe("2036-11-12");
  });
});

describe("textes F47 et F49", () => {
  const effet = new Date("2026-11-12T00:00:00Z");

  it("décès : aucun e-mail", () => {
    expect(texteFinCollaboration("deces", effet, 30)).toBeNull();
  });

  it("chaque motif rend un texte complet, sans crochet, avec la seule phrase qui s'applique", () => {
    for (const motif of MOTIFS_FIN.filter((m) => m !== "deces")) {
      const t = texteFinCollaboration(motif, effet, 60)!;
      expect(t).not.toMatch(CROCHET_NON_REMPLI);
      expect(t).toContain("12 novembre 2026");
      const avec = t.includes("menées à terme");
      const sans = t.includes("ne sont pas") || t.includes("sont retirées");
      expect(avec !== sans).toBe(true);
    }
    expect(texteFinCollaboration("initiative_axion", effet, 60)).toContain(
      "à notre demande, avec un préavis de 60 jours",
    );
  });

  it("chaque phrase du F47 vient du texte soumis à Will", () => {
    const source =
      TEXTES_FORMATEUR["formateur-fin-collaboration"].variantes[0].paragraphes.join("\n");
    expect(source).toContain(
      "Les missions déjà acceptées sont menées à terme et payées selon votre contrat.",
    );
    expect(source).toContain("les missions qui n'ont pas commencé sont retirées.");
    expect(source).toContain("Vos relevés et vos factures vous parviendront par e-mail.");
  });

  it("aucun mot interdit dans ce qui part au formateur", () => {
    const interdits =
      /poste|entretien|recrutement|salaire|rémunération|bienvenue|vous devez|obligatoire|agent commercial|grenoble/i;
    for (const motif of MOTIFS_FIN) {
      expect(texteFinCollaboration(motif, effet, 90) ?? "").not.toMatch(interdits);
    }
  });

  it("F49 : les deux crochets sont remplis, date limite à + 8 jours", () => {
    const v = valeursAvertissement("  Absence non prévenue le 2 octobre.  ", DECISION);
    expect(v["fait précis, écrit par Will"]).toBe("Absence non prévenue le 2 octobre.");
    expect(v.date).toBe("21 octobre 2026");
  });
});
