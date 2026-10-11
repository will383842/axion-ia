/**
 * Lot L11c — T1 (table de vérité de `etapeMission`) et T9 (empreinte).
 */

import { describe, expect, it } from "vitest";

import { empreinteDeMetadata, empreinteMission, type FaitsEmpreinte } from "../empreinte-mission";
import { ETAPES_MISSION, etapeMission, type FaitsEtapeMission } from "../etape-mission";

const MAINTENANT = new Date("2026-10-11T10:00:00Z");
const BASE: FaitsEtapeMission = {
  statut: "acceptee",
  sessionStatut: "planifiee",
  dateDebut: new Date("2026-11-04T08:00:00Z"),
  dateFin: new Date("2026-11-07T16:00:00Z"),
  affecte: true,
  clientEngage: true,
  financeurEnAttente: false,
  gardeRefus: [],
  lettre: null,
  empreinteActuelle: "a".repeat(64),
};
const e = (p: Partial<FaitsEtapeMission>) => etapeMission({ ...BASE, ...p }, MAINTENANT);

describe("T1 — une combinaison de faits, une seule étape", () => {
  it("proposition en attente", () => {
    expect(e({ statut: "en_attente" })).toBe("proposee");
    expect(e({ statut: "en_attente", affecte: false })).toBe("close");
  });
  it("accord donné : client, financeur, garde, puis lettre due", () => {
    expect(e({ clientEngage: false })).toBe("client_pas_engage");
    expect(e({ financeurEnAttente: true })).toBe("client_pas_engage");
    expect(e({ gardeRefus: ["x"] })).toBe("bloquee");
    expect(e({})).toBe("lettre_due");
    expect(e({ statut: "accord_hors_outil" })).toBe("lettre_due");
  });
  it("un fait inconnu n'est jamais lu comme fait : sans client engagé, jamais de lettre due", () => {
    expect(e({ clientEngage: false, gardeRefus: [] })).not.toBe("lettre_due");
  });
  it("lettre vivante : envoyée, signée, confirmée, en cours, réalisée", () => {
    const lettre = { signeeFormateur: false, signeeAxion: false, empreinte: "a".repeat(64) };
    expect(e({ lettre })).toBe("lettre_envoyee");
    expect(e({ lettre: { ...lettre, signeeFormateur: true } })).toBe("lettre_signee");
    expect(e({ lettre: { ...lettre, signeeFormateur: true, signeeAxion: true } })).toBe(
      "confirmee",
    );
    expect(
      e({
        lettre: { ...lettre, signeeFormateur: true, signeeAxion: true },
        dateDebut: new Date("2026-10-10T08:00:00Z"),
      }),
    ).toBe("en_cours");
    expect(
      e({
        lettre: { ...lettre, signeeFormateur: true, signeeAxion: true },
        dateDebut: new Date("2026-10-01T08:00:00Z"),
        dateFin: new Date("2026-10-02T08:00:00Z"),
      }),
    ).toBe("realisee");
  });
  it("lettre périmée : empreintes connues et différentes seulement", () => {
    const lettre = { signeeFormateur: true, signeeAxion: true, empreinte: "b".repeat(64) };
    expect(e({ lettre })).toBe("lettre_perimee");
    expect(e({ lettre: { ...lettre, empreinte: null } })).toBe("confirmee");
  });
  it("refus, silence, désistement, retrait, plus affecté, session annulée : close", () => {
    for (const statut of ["refusee", "sans_reponse", "desistee", "retiree", "expiree"] as const) {
      expect(e({ statut })).toBe("close");
    }
    expect(e({ affecte: false })).toBe("close");
    expect(e({ sessionStatut: "annulee" })).toBe("close");
  });
  it("chaque étape dit qui doit agir", () => {
    expect(ETAPES_MISSION.lettre_signee.quiAgit).toBe("vous");
    expect(ETAPES_MISSION.client_pas_engage.quiAgit).toBe("client");
    expect(ETAPES_MISSION.lettre_envoyee.quiAgit).toBe("formateur");
  });
});

describe("T9 — l'empreinte suit les faits contractuels, et eux seuls", () => {
  const F: FaitsEmpreinte = {
    intitule: "IA pour managers",
    jours: [
      { date: "2026-11-04", heureDebut: "09:00", heureFin: "17:00" },
      { date: "2026-11-05", heureDebut: "09:00", heureFin: "17:00" },
    ],
    distanciel: false,
    adresse: "12 rue Exemple",
    codePostal: "69003",
    ville: "Lyon",
    tarifHtCents: 35_000,
    forfaitDeplacementParJourHtCents: 8_000,
    regimeTva: "franchise_293b",
    role: "principal",
    versionContratCadre: 3,
    gabaritVersion: 2,
  };
  const ref = empreinteMission(F);
  it("stable, et indépendante de l'ordre des journées", () => {
    expect(ref).toMatch(/^[0-9a-f]{64}$/);
    expect(empreinteMission({ ...F, jours: [...F.jours].reverse() })).toBe(ref);
  });
  it("une journée, un horaire, le lieu, le tarif, le forfait ou la TVA la changent", () => {
    for (const p of [
      { jours: [F.jours[0]!] },
      { jours: [F.jours[0]!, { ...F.jours[1]!, heureFin: "12:00" }] },
      { ville: "Villeurbanne" },
      { tarifHtCents: 36_000 },
      { forfaitDeplacementParJourHtCents: 0 },
      { regimeTva: "assujetti_20" },
    ] as Array<Partial<FaitsEmpreinte>>) {
      expect(empreinteMission({ ...F, ...p })).not.toBe(ref);
    }
  });
  it("forfait « compris » : 0 et rien s'écrivent pareil ; distanciel ignore l'adresse", () => {
    expect(empreinteMission({ ...F, forfaitDeplacementParJourHtCents: 0 })).toBe(
      empreinteMission({ ...F, forfaitDeplacementParJourHtCents: null }),
    );
    expect(empreinteMission({ ...F, distanciel: true, ville: "Paris" })).toBe(
      empreinteMission({ ...F, distanciel: true }),
    );
  });
  it("lue dans les métadonnées seulement si elle a la forme d'une empreinte", () => {
    expect(empreinteDeMetadata({ empreinteMission: ref })).toBe(ref);
    expect(empreinteDeMetadata({ empreinteMission: "x" })).toBeNull();
    expect(empreinteDeMetadata(null)).toBeNull();
  });
});
