/**
 * REQ-INT-006 + REQ-DM-015 (qui absorbe REQ-ARG-006) — la résolution de commission.
 *
 * REQ-INT-006 : « calculé dans axionia par une fonction pure dérivée de pricing.ts ;
 * Partners ne contient aucune copie de la grille ». C'est la raison d'être de ce
 * module : la grille est un fait d'axionia, et elle ne doit exister qu'ici.
 *
 * REQ-DM-015 pose le test frontière et exige qu'il ait été VU ROUGE avant correction :
 * « palier forfaitaire appelé avec jours = 2 → montant simple, jamais doublé ».
 */
import { describe, expect, it } from "vitest";

import { COMMERCIAL_COMMISSIONS } from "@/content/pricing";

import { GRILLE_VERSION, resoudreCommission, versionDeLaGrille } from "../commission";

describe("REQ-DM-015 — les cinq valeurs d'ActiviteFacturation sont couvertes", () => {
  it("formation 1 jour → forfait du palier 1 j", () => {
    const r = resoudreCommission({ activite: "formation", jours: 1, montantHtCents: 250_000 });
    expect(r.statut).toBe("calculee");
    expect(r.commissionId).toBe("com-formation-1j");
    expect(r.montantCents).toBe(50_000); // 500 € × 100
  });

  it("🔴 A-2 — un palier FORFAITAIRE appelé avec jours = 2 rend le montant SIMPLE, jamais doublé", () => {
    // C'est LE défaut que REQ-DM-015 nomme : `flatEur × quantiteJournees × 100`
    // doublait la commission sur tous les paliers pluri-journées. Le palier 2 j porte
    // DÉJÀ le forfait des deux journées (1 000 € dans la grille publiée) : le
    // multiplier une seconde fois par 2 rendrait 2 000 €.
    const r = resoudreCommission({ activite: "formation", jours: 2, montantHtCents: 500_000 });
    expect(r.statut).toBe("calculee");
    expect(r.commissionId).toBe("com-formation-2j");
    expect(r.montantCents).toBe(100_000); // 1 000 € — PAS 200 000
  });

  it("🔴 A-2 — le palier « 3 jours et + » ne suit pas non plus la durée : 5 jours = le forfait du palier", () => {
    const trois = resoudreCommission({ activite: "formation", jours: 3, montantHtCents: 750_000 });
    const cinq = resoudreCommission({ activite: "formation", jours: 5, montantHtCents: 1_250_000 });

    expect(trois.commissionId).toBe("com-formation-3j");
    expect(cinq.commissionId).toBe("com-formation-3j");
    expect(cinq.montantCents).toBe(trois.montantCents);
    expect(cinq.montantCents).toBe(150_000); // 1 500 €
  });

  it("audit → 30 % du HT, arrondi", () => {
    const r = resoudreCommission({ activite: "audit", jours: null, montantHtCents: 333_333 });
    expect(r.statut).toBe("calculee");
    expect(r.commissionId).toBe("com-audit");
    expect(r.montantCents).toBe(Math.round((30 * 333_333) / 100));
  });

  it("implementation → 15 % du HT", () => {
    const r = resoudreCommission({
      activite: "implementation",
      jours: null,
      montantHtCents: 800_000,
    });
    expect(r.commissionId).toBe("com-integration");
    expect(r.montantCents).toBe(120_000);
  });

  it("un_a_un est sur BARÈME (`scale`) → bloquée `a_qualifier`, jamais 0, jamais une exception", () => {
    const r = resoudreCommission({ activite: "un_a_un", jours: null, montantHtCents: 400_000 });
    expect(r.statut).toBe("bloquee");
    expect(r.motifBlocage).toBe("a_qualifier");
    expect(r.montantCents).toBeNull();
    expect(r.commissionId).toBe("com-un-a-un");
  });

  it("site_web n'a AUCUN barème dans la grille → bloquée, et le dit", () => {
    // Vérifié contre la grille elle-même : aucune entrée ne vise le site web.
    expect(COMMERCIAL_COMMISSIONS.some((c) => c.id.includes("site"))).toBe(false);

    const r = resoudreCommission({ activite: "site_web", jours: null, montantHtCents: 300_000 });
    expect(r.statut).toBe("bloquee");
    expect(r.motifBlocage).toBe("a_qualifier");
    expect(r.montantCents).toBeNull();
    expect(r.commissionId).toBeNull();
    expect(r.libelleCommission).toBe("Prestation hors grille de commissions");
  });

  it("une formation SANS nombre de journées ne peut pas identifier son palier → bloquée", () => {
    // `jours` sert à IDENTIFIER le palier (REQ-DM-040). Sans lui, il n'y a pas de
    // palier — et surtout pas de repli sur « 1 jour », qui serait une invention.
    const r = resoudreCommission({ activite: "formation", jours: null, montantHtCents: 250_000 });
    expect(r.statut).toBe("bloquee");
    expect(r.commissionId).toBeNull();
  });

  it("une activité ABSENTE (ligne de devis sans activité) est bloquée, pas devinée", () => {
    const r = resoudreCommission({ activite: null, jours: 1, montantHtCents: 250_000 });
    expect(r.statut).toBe("bloquee");
    expect(r.motifBlocage).toBe("a_qualifier");
  });

  it("aucun cas ne LÈVE et aucun ne rend 0 : les cinq activités rendent un verdict", () => {
    for (const activite of [
      "formation",
      "un_a_un",
      "audit",
      "implementation",
      "site_web",
    ] as const) {
      const r = resoudreCommission({ activite, jours: 2, montantHtCents: 100_000 });
      expect(r.statut === "calculee" || r.statut === "bloquee").toBe(true);
      if (r.statut === "calculee") expect(r.montantCents).toBeGreaterThan(0);
    }
  });
});

describe("REQ-INT-006 — la grille reste un fait d'axionia", () => {
  it("chaque `commissionId` rendu existe RÉELLEMENT dans COMMERCIAL_COMMISSIONS", () => {
    const ids = new Set(COMMERCIAL_COMMISSIONS.map((c) => c.id));
    for (const activite of ["formation", "un_a_un", "audit", "implementation"] as const) {
      const r = resoudreCommission({ activite, jours: 1, montantHtCents: 100_000 });
      if (r.commissionId !== null) expect(ids.has(r.commissionId)).toBe(true);
    }
  });

  it("la version de grille est DÉRIVÉE de la grille — elle n'est pas un numéro à bumper à la main", () => {
    expect(GRILLE_VERSION).toMatch(/^[0-9a-f]{12}$/);
  });

  it("la version de grille SAIT changer : un taux modifié la fait diverger", () => {
    // Contre-témoin. Sans lui, `GRILLE_VERSION` pourrait être une constante figée et
    // Partners pinnerait une grille qui a bougé sous ses pieds.
    const mutee = COMMERCIAL_COMMISSIONS.map((c) =>
      c.id === "com-audit" ? { ...c, percent: 31 } : c,
    );
    expect(versionDeLaGrille(mutee)).not.toBe(GRILLE_VERSION);
  });
});
