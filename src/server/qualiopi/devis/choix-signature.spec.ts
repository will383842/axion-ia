import { describe, expect, it } from "vitest";

import { choixCanonique, sha256Choix, sha256Offre } from "./offre-calculs";
import { offreFictive } from "./offre-fixtures.spec-util";
import {
  devisSignableParFormules,
  presentationDuChoix,
  validerChoixSignature,
} from "./choix-signature";
import type { OffreDevisV1 } from "./offre-devis";

const NUMERO = "AXI-DEV-2026-001";

function ctx(offre: OffreDevisV1 = offreFictive()) {
  return { offre, devisNumero: NUMERO, offreSha256: sha256Offre(offre) };
}

describe("validerChoixSignature — formule", () => {
  it("accepte la formule A avec maintenance facultative refusée", () => {
    const r = validerChoixSignature(ctx(), {
      formule: "achat",
      automatisationsRetenues: [],
      maintenanceRetenue: false,
      periodiciteMois: null,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.choix.formule).toBe("achat");
    expect(r.choix.maintenanceRetenue).toBe(false);
    expect(r.choix.periodiciteMois).toBeNull();
    expect(r.sha256Choix).toBe(sha256Choix(r.choix));
  });

  it("refuse une formule hors de l'offre (formulesProposees)", () => {
    const offre = offreFictive();
    offre.formulesProposees = ["abonnement"];
    delete offre.achat;
    const r = validerChoixSignature(ctx(offre), {
      formule: "achat",
      automatisationsRetenues: [],
      maintenanceRetenue: false,
      periodiciteMois: null,
    });
    expect(r).toMatchObject({ ok: false, raison: "formule_hors_offre" });
  });

  it("refuse une valeur de formule inconnue", () => {
    const r = validerChoixSignature(ctx(), {
      formule: "gratuite" as never,
      automatisationsRetenues: [],
      maintenanceRetenue: false,
      periodiciteMois: null,
    });
    expect(r).toMatchObject({ ok: false, raison: "formule_hors_offre" });
  });

  it("refuse le choix d'une formule quand l'offre en propose deux mais que rien n'est choisi", () => {
    const r = validerChoixSignature(ctx(), {
      formule: undefined as never,
      automatisationsRetenues: [],
      maintenanceRetenue: null,
      periodiciteMois: null,
    });
    expect(r).toMatchObject({ ok: false, raison: "formule_hors_offre" });
  });
});

describe("validerChoixSignature — maintenance (formule A)", () => {
  it("maintenance obligatoire décochée : refusée", () => {
    const offre = offreFictive();
    offre.achat!.maintenance.regle = "obligatoire";
    const r = validerChoixSignature(ctx(offre), {
      formule: "achat",
      automatisationsRetenues: [],
      maintenanceRetenue: false,
      periodiciteMois: null,
    });
    expect(r).toMatchObject({ ok: false, raison: "maintenance_obligatoire" });
  });

  it("maintenance obligatoire cochée avec une périodicité proposée : acceptée", () => {
    const offre = offreFictive();
    offre.achat!.maintenance.regle = "obligatoire";
    const r = validerChoixSignature(ctx(offre), {
      formule: "achat",
      automatisationsRetenues: [],
      maintenanceRetenue: true,
      periodiciteMois: 12,
    });
    expect(r.ok).toBe(true);
  });

  it("maintenance retenue avec une périodicité non proposée : refusée", () => {
    const r = validerChoixSignature(ctx(), {
      formule: "achat",
      automatisationsRetenues: [],
      maintenanceRetenue: true,
      periodiciteMois: 6,
    });
    expect(r).toMatchObject({ ok: false, raison: "periodicite_hors_offre" });
  });

  it("maintenance retenue sans périodicité : refusée", () => {
    const r = validerChoixSignature(ctx(), {
      formule: "achat",
      automatisationsRetenues: [],
      maintenanceRetenue: true,
      periodiciteMois: null,
    });
    expect(r).toMatchObject({ ok: false, raison: "periodicite_hors_offre" });
  });

  it("maintenance non retenue mais périodicité envoyée : refusée (pas de champ orphelin)", () => {
    const r = validerChoixSignature(ctx(), {
      formule: "achat",
      automatisationsRetenues: [],
      maintenanceRetenue: false,
      periodiciteMois: 12,
    });
    expect(r).toMatchObject({ ok: false, raison: "choix_incoherent" });
  });

  it("maintenance facultative : une réponse explicite est exigée (null refusé)", () => {
    const r = validerChoixSignature(ctx(), {
      formule: "achat",
      automatisationsRetenues: [],
      maintenanceRetenue: null,
      periodiciteMois: null,
    });
    expect(r).toMatchObject({ ok: false, raison: "choix_incoherent" });
  });
});

describe("validerChoixSignature — abonnement (formule B)", () => {
  it("accepte une périodicité proposée", () => {
    const r = validerChoixSignature(ctx(), {
      formule: "abonnement",
      automatisationsRetenues: [],
      maintenanceRetenue: null,
      periodiciteMois: 1,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.choix.maintenanceRetenue).toBe(false);
    expect(r.choix.periodiciteMois).toBe(1);
  });

  it("refuse une périodicité non proposée", () => {
    const r = validerChoixSignature(ctx(), {
      formule: "abonnement",
      automatisationsRetenues: [],
      maintenanceRetenue: null,
      periodiciteMois: 6,
    });
    expect(r).toMatchObject({ ok: false, raison: "periodicite_hors_offre" });
  });

  it("refuse une case maintenance cochée en formule B", () => {
    const r = validerChoixSignature(ctx(), {
      formule: "abonnement",
      automatisationsRetenues: [],
      maintenanceRetenue: true,
      periodiciteMois: 1,
    });
    expect(r).toMatchObject({ ok: false, raison: "choix_incoherent" });
  });
});

describe("validerChoixSignature — automatisations", () => {
  it("scelle la liste RÉELLEMENT facturée : une automatisation non facultative est ajoutée", () => {
    const offre = offreFictive();
    offre.automatisations.push({
      code: "socle",
      libelle: "Socle obligatoire",
      facultative: false,
      dependDe: [],
      prixHtCents: 1000,
      tauxTvaBps: 2000,
      modeIA: "client_direct",
    });
    const r = validerChoixSignature(ctx(offre), {
      formule: "abonnement",
      automatisationsRetenues: [],
      maintenanceRetenue: null,
      periodiciteMois: 1,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.choix.automatisationsRetenues).toEqual(["socle"]);
  });

  it("refuse un code inconnu", () => {
    const r = validerChoixSignature(ctx(), {
      formule: "abonnement",
      automatisationsRetenues: ["fantome"],
      maintenanceRetenue: null,
      periodiciteMois: 1,
    });
    expect(r).toMatchObject({ ok: false, raison: "selection_incomplete" });
  });

  it("refuse une sélection sans la dépendance requise", () => {
    const offre = offreFictive();
    offre.automatisations.push({
      code: "auto2",
      libelle: "Dépend de un",
      facultative: true,
      dependDe: ["auto1"],
      prixHtCents: 100,
      tauxTvaBps: 2000,
      modeIA: "client_direct",
    });
    const r = validerChoixSignature(ctx(offre), {
      formule: "abonnement",
      automatisationsRetenues: ["auto2"],
      maintenanceRetenue: null,
      periodiciteMois: 1,
    });
    expect(r).toMatchObject({ ok: false, raison: "selection_incomplete" });
  });

  it("l'empreinte est stable : doublons et ordre n'y changent rien (sceau V4 stable)", () => {
    const offre = offreFictive();
    offre.automatisations.push({
      code: "auto2",
      libelle: "Deux",
      facultative: true,
      dependDe: [],
      prixHtCents: 100,
      tauxTvaBps: 2000,
      modeIA: "client_direct",
    });
    const a = validerChoixSignature(ctx(offre), {
      formule: "abonnement",
      automatisationsRetenues: ["auto2", "auto1", "auto1"],
      maintenanceRetenue: null,
      periodiciteMois: 1,
    });
    const b = validerChoixSignature(ctx(offre), {
      formule: "abonnement",
      automatisationsRetenues: ["auto1", "auto2"],
      maintenanceRetenue: null,
      periodiciteMois: 1,
    });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.sha256Choix).toBe(b.sha256Choix);
    expect(a.sha256Choix).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("validerChoixSignature — l'offre scellée", () => {
  it("refuse si l'empreinte stockée ne correspond plus à l'offre lue (offre altérée)", () => {
    const offre = offreFictive();
    const r = validerChoixSignature(
      { offre, devisNumero: NUMERO, offreSha256: "0".repeat(64) },
      {
        formule: "abonnement",
        automatisationsRetenues: [],
        maintenanceRetenue: null,
        periodiciteMois: 1,
      },
    );
    expect(r).toMatchObject({ ok: false, raison: "offre_alteree" });
  });

  it("le choix scelle le numéro du devis et l'empreinte de l'offre", () => {
    const r = validerChoixSignature(ctx(), {
      formule: "abonnement",
      automatisationsRetenues: [],
      maintenanceRetenue: null,
      periodiciteMois: 1,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.choix).toEqual(
      choixCanonique({
        devisNumero: NUMERO,
        offreSha256: sha256Offre(offreFictive()),
        formule: "abonnement",
        automatisationsRetenues: [],
        maintenanceRetenue: false,
        periodiciteMois: 1,
      }),
    );
  });

  it("ignore tout champ supplémentaire fourni par le navigateur (prix, remise…)", () => {
    const r = validerChoixSignature(ctx(), {
      formule: "abonnement",
      automatisationsRetenues: [],
      maintenanceRetenue: null,
      periodiciteMois: 1,
      prixHtCents: 1,
      remiseBps: 10000,
    } as never);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(JSON.stringify(r.choix)).not.toMatch(/prix|remise/i);
  });
});

describe("devisSignableParFormules — expiration", () => {
  const maintenant = new Date("2026-11-10T10:00:00.000Z");
  it("signable avant la date de validité", () => {
    expect(
      devisSignableParFormules({ dateValidite: new Date("2026-11-20T00:00:00.000Z") }, maintenant),
    ).toBe(true);
  });
  it("refusé le jour même de l'échéance dépassée, avant que le cron ne passe le statut à expiré", () => {
    expect(
      devisSignableParFormules({ dateValidite: new Date("2026-11-10T09:59:59.000Z") }, maintenant),
    ).toBe(false);
  });
  it("refusé à l'instant exact de l'échéance (borne exclue)", () => {
    expect(devisSignableParFormules({ dateValidite: maintenant }, maintenant)).toBe(false);
  });
});

describe("presentationDuChoix", () => {
  it("décrit uniquement ce que l'offre propose, sans mot « token »", () => {
    const p = presentationDuChoix(offreFictive());
    expect(p.formules.map((f) => f.formule)).toEqual(["achat", "abonnement"]);
    expect(JSON.stringify(p)).not.toMatch(/token|jeton/i);
    const a = p.formules.find((f) => f.formule === "achat")!;
    expect(a.maintenance).toEqual({
      regle: "facultative",
      mensuelHtCents: 4000,
      periodesMois: [1, 12],
    });
    const b = p.formules.find((f) => f.formule === "abonnement")!;
    expect(b.periodes).toEqual([{ mois: 1, remiseBps: 0 }]);
  });

  it("calcule le total ponctuel par formule avec la TVA (jamais d'exonération)", () => {
    const p = presentationDuChoix(offreFictive());
    const a = p.formules.find((f) => f.formule === "achat")!;
    expect(a.totalTtcCents).toBeGreaterThan(a.totalHtCents);
  });
});
