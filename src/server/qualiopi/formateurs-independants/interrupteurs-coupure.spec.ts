/**
 * Lot F (M23) — coupure en cascade, retrait de `choix_suivants`, deux préalables.
 */
import { describe, it, expect } from "vitest";

import {
  CLES_INTERRUPTEURS,
  estCleInterrupteur,
  etatsParDefaut,
  prealablesManquants,
  prealablesManquantsSignature,
  reglagesActifs,
  reglagesFillesACouper,
} from "./interrupteurs";

describe("`choix_suivants` est retiré — rien ne le lit, `rang_suivant` l'a remplacé", () => {
  it("n'est plus une clé du registre", () => {
    expect(estCleInterrupteur("choix_suivants")).toBe(false);
    expect((CLES_INTERRUPTEURS as readonly string[]).includes("choix_suivants")).toBe(false);
  });
  it("une ligne `formateurs.choix_suivants` restée en base est ignorée, jamais supprimée", () => {
    const actifs = reglagesActifs([{ key: "formateurs.choix_suivants", value: { actif: true } }]);
    expect(actifs.has("formateurs.choix_suivants")).toBe(false);
  });
});

describe("reglagesActifs", () => {
  it("compte les envois allumés, les deux registres de signature, et une date posée", () => {
    const actifs = reglagesActifs([
      { key: "formateurs.dossier_en_ligne", value: { actif: true } },
      { key: "formateurs.relances_auto", value: { actif: false } },
      { key: "formateurs.mise_a_niveau", value: { actif: true } },
      { key: "signature.copie_partielle", value: { actif: true } },
      { key: "formateurs.passage_paiement", value: { date: "2026-12-01" } },
      { key: "formateurs.menu_freelance", value: { actif: true } },
      { key: "formateurs.garde_mission", value: { valeur: "avertir" } },
    ]);
    expect([...actifs].sort()).toEqual(
      [
        "formateurs.dossier_en_ligne",
        "formateurs.menu_freelance",
        "formateurs.mise_a_niveau",
        "formateurs.passage_paiement",
        "signature.copie_partielle",
      ].sort(),
    );
  });
});

describe("couper une clé mère coupe ses filles", () => {
  const tout = new Set([
    "formateurs.textes_valides",
    "formateurs.echange_ouvert",
    "formateurs.invitation_auto",
    "formateurs.dossier_en_ligne",
    "formateurs.relances_auto",
    "formateurs.pieces_cron",
    "formateurs.mise_a_niveau",
    "formateurs.contrat_auto",
    "formateurs.activation_auto",
    "formateurs.lettre_auto",
    "formateurs.controle_registre_periodique",
    "formateurs.garde_mission_portes",
    "formateurs.rang_suivant",
    "formateurs.affectation_sure",
    "formateurs.suivi_echange",
    "formateurs.passage_paiement",
    "formateurs.choix_cartes",
    "formateurs.presentation_payee",
    "signature.copie_partielle",
    "formateurs.nouvelle_version_contrat",
  ]);

  it("le dossier en ligne emporte relances, pièces, mise à niveau, contrat, puis activation et lettres", () => {
    const filles = reglagesFillesACouper("formateurs.dossier_en_ligne", tout);
    expect(filles.sort()).toEqual(
      [
        "formateurs.activation_auto",
        "formateurs.contrat_auto",
        "formateurs.lettre_auto",
        "formateurs.mise_a_niveau",
        "formateurs.pieces_cron",
        "formateurs.relances_auto",
      ].sort(),
    );
  });

  it("les textes validés emportent aussi les clés des registres de signature et d'entrée", () => {
    const filles = reglagesFillesACouper("formateurs.textes_valides", tout);
    expect(filles).toEqual(
      expect.arrayContaining([
        "signature.copie_partielle",
        "formateurs.nouvelle_version_contrat",
        "formateurs.rang_suivant",
        "formateurs.suivi_echange",
        "formateurs.invitation_auto",
      ]),
    );
  });

  it("le contrôle du registre emporte la garde aux portes, donc le rang suivant (transitif)", () => {
    expect(reglagesFillesACouper("formateurs.controle_registre_periodique", tout).sort()).toEqual([
      "formateurs.garde_mission_portes",
      "formateurs.rang_suivant",
    ]);
  });

  it("effacer la date de passage emporte le choix en cartes et la présentation payée", () => {
    expect(reglagesFillesACouper("formateurs.passage_paiement", tout).sort()).toEqual([
      "formateurs.choix_cartes",
      "formateurs.presentation_payee",
    ]);
  });

  it("ne rend que ce qui est allumé, jamais la mère, et rien pour une feuille", () => {
    const peu = new Set(["formateurs.dossier_en_ligne", "formateurs.relances_auto"]);
    expect(reglagesFillesACouper("formateurs.dossier_en_ligne", peu)).toEqual([
      "formateurs.relances_auto",
    ]);
    expect(reglagesFillesACouper("formateurs.relances_auto", tout)).toEqual([]);
    expect(reglagesFillesACouper("formateurs.proches_bloc", tout)).toEqual([]);
  });
});

describe("deux préalables du lot F", () => {
  it("passage_paiement exige le canal de changement de compte (illisible tant qu'il n'existe pas)", () => {
    const m = prealablesManquants("passage_paiement", "2026-12-01", etatsParDefaut());
    expect(m).toHaveLength(1);
    expect(m[0]).toMatch(/changement de compte/);
    // Couper, ou effacer la date, reste toujours permis.
    expect(prealablesManquants("passage_paiement", null, etatsParDefaut())).toEqual([]);
  });

  it("presentation_payee se débloque dès qu'une date de passage est posée", () => {
    const sans = prealablesManquantsSignature("presentation_payee", true, etatsParDefaut());
    expect(sans).toHaveLength(1);
    expect(sans[0]).toMatch(/Passage au paiement/);
    expect(
      prealablesManquantsSignature("presentation_payee", true, {
        ...etatsParDefaut(),
        passage_paiement: "2026-12-01",
      }),
    ).toEqual([]);
  });
});
