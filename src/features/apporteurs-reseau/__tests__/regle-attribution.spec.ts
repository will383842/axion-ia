/**
 * Lot 2 du chantier « validation par rendez-vous » (future règle du contrat 2.8) : les règles
 * PURES et l'interrupteur. Aucun appelant ne les lit encore.
 *
 * Deux familles de preuves :
 *   1. SANS le nouveau champ `reservation`, `commandeCouverte`, `etatPourApporteur` et
 *      `presentationOccupe` rendent exactement ce qu'elles rendaient avant ce lot (comparées, sur
 *      une grille de cas, à une copie figée de l'ancienne règle) ;
 *   2. AVEC le champ, la réservation de 60 jours s'applique, bornes incluses.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
// `presentations.ts` tire les envois (file BullMQ) : seule la fonction pure `presentationOccupe`
// est lue ici, ses voisins serveur sont coupés.
vi.mock("../envois", () => ({}));
vi.mock("../attribution-annonce", () => ({}));
vi.mock("../rebonds", () => ({}));
vi.mock("../annuaire", () => ({}));

import { etatPourApporteur } from "../declaration-regles";
import { validationParRendezVousActive } from "../interrupteur-rendez-vous";
import { presentationOccupe } from "../presentations";
import {
  RESERVATION_PROVISOIRE_JOURS,
  VERSION_REGLE_RENDEZ_VOUS,
  finDeProtectionRendezVous,
  finReservation,
  regleDe,
  rendezVousRecevable,
  reservationOccupe,
  versionAuMoins,
} from "../regle-attribution";
import {
  PROTECTION_MOIS,
  RAPPEL_SANS_REPONSE_JOURS,
  ajouterJours,
  ajouterMois,
  commandeCouverte,
  finDeProtection,
} from "../regles";

const SAISIE = new Date("2026-03-10T09:30:00.000Z");
const j = (n: number): Date => ajouterJours(SAISIE, n);
const FIN = finReservation(SAISIE);

describe("constantes et dates de la règle par rendez-vous", () => {
  it("réserve 60 jours et vise le contrat 2.8", () => {
    expect(RESERVATION_PROVISOIRE_JOURS).toBe(60);
    expect(VERSION_REGLE_RENDEZ_VOUS).toBe("2.8");
  });

  it("finReservation : la saisie + 60 jours, même arithmétique que les délais existants", () => {
    expect(FIN.getTime()).toBe(ajouterJours(SAISIE, 60).getTime());
    expect(FIN.toISOString()).toBe("2026-05-09T09:30:00.000Z");
  });

  it("finDeProtectionRendezVous : 6 mois depuis le rendez-vous, comme la fonction de mois existante", () => {
    for (const iso of [
      "2026-03-10T09:30:00.000Z",
      "2026-08-31T14:00:00.000Z",
      "2026-08-30T23:59:59.000Z",
      "2027-08-31T00:00:00.000Z",
      "2026-12-15T08:00:00.000Z",
    ]) {
      const rdv = new Date(iso);
      expect(finDeProtectionRendezVous(rdv).getTime()).toBe(
        ajouterMois(rdv, PROTECTION_MOIS).getTime(),
      );
      expect(finDeProtectionRendezVous(rdv).getTime()).toBe(finDeProtection(rdv).getTime());
    }
  });

  it("un 31 août mène au dernier jour de février (28, ou 29 une année bissextile)", () => {
    expect(finDeProtectionRendezVous(new Date("2026-08-31T14:00:00.000Z")).toISOString()).toBe(
      "2027-02-28T14:00:00.000Z",
    );
    expect(finDeProtectionRendezVous(new Date("2027-08-31T14:00:00.000Z")).toISOString()).toBe(
      "2028-02-29T14:00:00.000Z",
    );
  });
});

describe("versionAuMoins", () => {
  it("compare composante par composante, en nombres", () => {
    expect(versionAuMoins({ version: "2.8" }, "2.8")).toBe(true);
    expect(versionAuMoins({ version: "2.10" }, "2.8")).toBe(true);
    expect(versionAuMoins({ version: "2.9" }, "2.10")).toBe(false);
    expect(versionAuMoins({ version: "3" }, "2.8")).toBe(true);
    expect(versionAuMoins({ version: "3.0" }, "2.8")).toBe(true);
    expect(versionAuMoins({ version: "2.8.1" }, "2.8")).toBe(true);
    expect(versionAuMoins({ version: "2.8" }, "2.8.1")).toBe(false);
    expect(versionAuMoins({ version: "2.8.0" }, "2.8")).toBe(true);
    expect(versionAuMoins({ version: "2.7" }, "2.8")).toBe(false);
    expect(versionAuMoins({ version: "2.6" }, "2.8")).toBe(false);
    expect(versionAuMoins({ version: "1.99" }, "2.8")).toBe(false);
  });

  it("version absente, vide ou illisible : faux", () => {
    for (const signature of [
      null,
      undefined,
      "2.8",
      28,
      [],
      ["2.8"],
      {},
      { version: "" },
      { version: "   " },
      { version: null },
      { version: 2.8 },
      { version: "v2.8" },
      { version: "2.8-beta" },
      { version: "2..8" },
      { version: "2." },
      { version: ".8" },
      { version: "-2.8" },
      { version: "2,8" },
      { version: "deux" },
    ]) {
      expect(versionAuMoins(signature, "2.8"), JSON.stringify(signature)).toBe(false);
    }
  });

  it("un minimum illisible : faux", () => {
    expect(versionAuMoins({ version: "2.8" }, "")).toBe(false);
    expect(versionAuMoins({ version: "2.8" }, "x")).toBe(false);
  });
});

describe("regleDe", () => {
  it("contrat 2.8 ou 2.10, interrupteur allumé : rendez_vous", () => {
    expect(regleDe({ version: "2.8" }, true)).toBe("rendez_vous");
    expect(regleDe({ version: "2.10" }, true)).toBe("rendez_vous");
  });

  it("contrat 2.6 ou 2.7 : null, même interrupteur allumé", () => {
    expect(regleDe({ version: "2.6" }, true)).toBeNull();
    expect(regleDe({ version: "2.7" }, true)).toBeNull();
  });

  it("signature absente ou illisible : null", () => {
    expect(regleDe(null, true)).toBeNull();
    expect(regleDe(undefined, true)).toBeNull();
    expect(regleDe({}, true)).toBeNull();
    expect(regleDe({ version: "?" }, true)).toBeNull();
    expect(regleDe("2.8", true)).toBeNull();
  });

  it("interrupteur éteint : null, quelle que soit la version", () => {
    expect(regleDe({ version: "2.8" }, false)).toBeNull();
    expect(regleDe({ version: "2.10" }, false)).toBeNull();
    expect(regleDe({ version: "2.6" }, false)).toBeNull();
  });
});

describe("rendezVousRecevable", () => {
  const base = { recueAt: SAISIE, reserveeJusquAt: FIN, maintenant: j(200) };

  it("pris avant la saisie : refusé", () => {
    expect(rendezVousRecevable({ ...base, prisAt: j(-1), tenuAt: j(10) })).toEqual({
      ok: false,
      motif: "pris_avant_saisie",
    });
    expect(
      rendezVousRecevable({ ...base, prisAt: new Date(SAISIE.getTime() - 1), tenuAt: j(10) }),
    ).toEqual({ ok: false, motif: "pris_avant_saisie" });
  });

  it("pris à J+59, tenu à J+80 : recevable", () => {
    expect(rendezVousRecevable({ ...base, prisAt: j(59), tenuAt: j(80) })).toEqual({ ok: true });
  });

  it("pris à J+61 : refusé", () => {
    expect(rendezVousRecevable({ ...base, prisAt: j(61), tenuAt: j(80) })).toEqual({
      ok: false,
      motif: "pris_apres_reservation",
    });
    expect(
      rendezVousRecevable({ ...base, prisAt: new Date(FIN.getTime() + 1), tenuAt: j(80) }),
    ).toEqual({ ok: false, motif: "pris_apres_reservation" });
  });

  it("bornes incluses : pris exactement à la saisie, ou exactement à la fin de la réservation", () => {
    expect(rendezVousRecevable({ ...base, prisAt: SAISIE, tenuAt: j(5) })).toEqual({ ok: true });
    expect(rendezVousRecevable({ ...base, prisAt: FIN, tenuAt: j(90) })).toEqual({ ok: true });
  });

  it("pas encore tenu (null, ou dans le futur) : refusé", () => {
    expect(rendezVousRecevable({ ...base, prisAt: j(10), tenuAt: null })).toEqual({
      ok: false,
      motif: "pas_encore_tenu",
    });
    expect(
      rendezVousRecevable({ ...base, prisAt: j(10), tenuAt: j(30), maintenant: j(29) }),
    ).toEqual({ ok: false, motif: "pas_encore_tenu" });
  });

  it("tenu à l'instant même : recevable", () => {
    expect(
      rendezVousRecevable({ ...base, prisAt: j(10), tenuAt: j(30), maintenant: j(30) }),
    ).toEqual({ ok: true });
  });

  it("ordre des contrôles : la date de prise est jugée avant la tenue", () => {
    expect(rendezVousRecevable({ ...base, prisAt: j(-1), tenuAt: null }).ok).toBe(false);
    expect(rendezVousRecevable({ ...base, prisAt: j(-1), tenuAt: null })).toMatchObject({
      motif: "pris_avant_saisie",
    });
    expect(rendezVousRecevable({ ...base, prisAt: j(61), tenuAt: null })).toMatchObject({
      motif: "pris_apres_reservation",
    });
  });
});

describe("rendezVousRecevable : échec FERMÉ (relecture du 25/11, I1 et I2)", () => {
  const NAN = new Date(NaN);
  const bon = {
    recueAt: SAISIE,
    reserveeJusquAt: FIN,
    prisAt: j(10),
    tenuAt: j(30),
    maintenant: j(200),
  };

  it("le cas de référence est recevable", () => {
    expect(rendezVousRecevable(bon)).toEqual({ ok: true });
  });

  it("I1 · une date illisible, quelle qu'elle soit, ne valide jamais l'entreprise", () => {
    expect(rendezVousRecevable({ ...bon, prisAt: NAN })).toEqual({
      ok: false,
      motif: "pris_avant_saisie",
    });
    expect(rendezVousRecevable({ ...bon, recueAt: NAN })).toEqual({
      ok: false,
      motif: "pris_avant_saisie",
    });
    expect(rendezVousRecevable({ ...bon, reserveeJusquAt: NAN })).toEqual({
      ok: false,
      motif: "pris_apres_reservation",
    });
    expect(rendezVousRecevable({ ...bon, tenuAt: NAN })).toEqual({
      ok: false,
      motif: "pas_encore_tenu",
    });
    expect(rendezVousRecevable({ ...bon, maintenant: NAN })).toEqual({
      ok: false,
      motif: "pas_encore_tenu",
    });
  });

  it("I2 · tenu AVANT sa prise : refusé", () => {
    expect(rendezVousRecevable({ ...bon, prisAt: j(10), tenuAt: j(5) })).toEqual({
      ok: false,
      motif: "tenu_avant_prise",
    });
    expect(
      rendezVousRecevable({ ...bon, prisAt: j(10), tenuAt: new Date(j(10).getTime() - 1) }),
    ).toEqual({ ok: false, motif: "tenu_avant_prise" });
  });

  it("I2 · tenu avant la saisie : refusé", () => {
    expect(rendezVousRecevable({ ...bon, prisAt: SAISIE, tenuAt: j(-30) })).toEqual({
      ok: false,
      motif: "tenu_avant_prise",
    });
  });

  it("pris et tenu au même instant : recevable (borne incluse)", () => {
    expect(rendezVousRecevable({ ...bon, prisAt: j(10), tenuAt: j(10) })).toEqual({ ok: true });
  });
});

describe("occupation de l'entreprise : jamais deux apporteurs (I4 et I5)", () => {
  const NAN = new Date(NaN);
  const p = { statut: "reservee" as const, protegeeJusquAt: null };
  const pres = {
    statut: "reservee",
    contactEnvoyeAt: j(3),
    recueAt: SAISIE,
    protegeeJusquAt: null,
  };
  const enAttente = (prisAt: Date | null) => ({
    recueAt: SAISIE,
    reserveeJusquAt: FIN,
    rendezVousEnAttentePrisAt: prisAt,
  });

  it("I4 · rendez-vous pris à J+50, à tenir à J+80 : l'entreprise reste occupée de J+61 à J+80", () => {
    for (const n of [50, 60, 61, 70, 80]) {
      expect(presentationOccupe(p, j(n), enAttente(j(50))), `J+${n}`).toBe(true);
      expect(reservationOccupe(enAttente(j(50)), j(n)), `J+${n}`).toBe(true);
    }
  });

  it("I4 · l'apporteur voit « Réservée », pas « Expirée », tant que son rendez-vous est à tenir", () => {
    expect(etatPourApporteur(pres, j(59), enAttente(j(50)))).toEqual({
      etat: "reservee",
      jusquAu: FIN,
    });
    // Terme passé, droit encore vivant : aucune date de fin à annoncer.
    expect(etatPourApporteur(pres, j(70), enAttente(j(50)))).toEqual({
      etat: "reservee",
      jusquAu: null,
    });
  });

  it("I4 · bornes de prise incluses : pris à la saisie ou au terme de la réservation", () => {
    expect(presentationOccupe(p, j(70), enAttente(SAISIE))).toBe(true);
    expect(presentationOccupe(p, j(70), enAttente(FIN))).toBe(true);
  });

  it("I4 · un rendez-vous pris AVANT la saisie ou APRÈS les 60 jours ne retient pas l'entreprise", () => {
    expect(presentationOccupe(p, j(70), enAttente(j(-1)))).toBe(false);
    expect(presentationOccupe(p, j(70), enAttente(new Date(SAISIE.getTime() - 1)))).toBe(false);
    expect(presentationOccupe(p, j(70), enAttente(j(61)))).toBe(false);
    expect(presentationOccupe(p, j(70), enAttente(new Date(FIN.getTime() + 1)))).toBe(false);
    expect(etatPourApporteur(pres, j(70), enAttente(j(61)))).toEqual({
      etat: "expiree",
      jusquAu: FIN,
    });
    // … mais pendant les 60 jours, la réservation occupe de toute façon.
    expect(presentationOccupe(p, j(30), enAttente(j(-1)))).toBe(true);
  });

  it("I4 · sans rendez-vous en attente (absent ou null) : libre à J+61, comme avant", () => {
    expect(presentationOccupe(p, j(61), enAttente(null))).toBe(false);
    expect(presentationOccupe(p, j(61), { recueAt: SAISIE, reserveeJusquAt: FIN })).toBe(false);
    expect(presentationOccupe(p, j(60), enAttente(null))).toBe(true);
  });

  it("I5 · une réservation de date illisible continue d'occuper, et l'état dit la même chose", () => {
    const illisible = { recueAt: SAISIE, reserveeJusquAt: NAN };
    expect(presentationOccupe(p, j(10), illisible)).toBe(true);
    expect(presentationOccupe(p, j(400), illisible)).toBe(true);
    expect(etatPourApporteur(pres, j(400), illisible)).toEqual({ etat: "reservee", jusquAu: null });
    expect(presentationOccupe(p, NAN, { recueAt: SAISIE, reserveeJusquAt: FIN })).toBe(true);
  });

  it("I5 · un rendez-vous en attente de date illisible continue d'occuper", () => {
    expect(presentationOccupe(p, j(70), enAttente(NAN))).toBe(true);
    expect(presentationOccupe(p, j(70), { ...enAttente(j(50)), recueAt: NAN })).toBe(true);
  });

  it("presentationOccupe et etatPourApporteur ne se contredisent sur aucun cas", () => {
    for (const reserveeJusquAt of [FIN, NAN, j(-5)])
      for (const prisAt of [undefined, null, j(-1), SAISIE, j(50), FIN, j(61), NAN])
        for (const maintenant of [...INSTANTS, NAN]) {
          const r = { recueAt: SAISIE, reserveeJusquAt, rendezVousEnAttentePrisAt: prisAt };
          expect(etatPourApporteur(pres, maintenant, r)?.etat === "reservee").toBe(
            presentationOccupe(p, maintenant, r),
          );
        }
  });
});

describe("durcissements mineurs (relecture du 25/11)", () => {
  it("M1 · versionAuMoins refuse les formes non canoniques", () => {
    for (const version of [
      "2.08",
      "02.8",
      "2.008",
      " 2.8 ",
      "2.8\n",
      "9".repeat(400),
      "99999",
      `2.8${".0".repeat(50_000)}`,
      "2.8.0.0.0",
      "2.8e1",
      "0x3",
      "٢.٨",
    ]) {
      expect(versionAuMoins({ version }, "2.8"), version.slice(0, 20)).toBe(false);
    }
    expect(versionAuMoins({ version: "2" }, "2.8")).toBe(false);
    expect(versionAuMoins({ version: "2.8.0.0" }, "2.8")).toBe(true);
    expect(versionAuMoins({ version: "10.0" }, "2.8")).toBe(true);
    expect(versionAuMoins({ version: "0.9" }, "2.8")).toBe(false);
  });

  it("M1 · une version héritée du prototype n'est pas lue", () => {
    expect(versionAuMoins(Object.create({ version: "2.8" }), "2.8")).toBe(false);
  });

  it("M2 · regleDe exige un interrupteur strictement booléen", () => {
    for (const actif of ["false", "true", 1, {}, []])
      expect(regleDe({ version: "2.8" }, actif as unknown as boolean)).toBeNull();
  });

  it("regleDe et l'interrupteur, de bout en bout", () => {
    vi.stubEnv("APPORTEURS_VALIDATION_RDV", "true");
    expect(regleDe({ version: "2.8" }, validationParRendezVousActive())).toBe("rendez_vous");
    expect(regleDe({ version: "2.6" }, validationParRendezVousActive())).toBeNull();
    vi.stubEnv("APPORTEURS_VALIDATION_RDV", "TRUE");
    expect(regleDe({ version: "2.8" }, validationParRendezVousActive())).toBeNull();
    vi.unstubAllEnvs();
  });

  it("M3 · finReservation ajoute 60 × 24 h, y compris à travers un changement d'heure", () => {
    // 1er février 9 h (Paris, UTC+1) → 2 avril 10 h (Paris, UTC+2).
    expect(finReservation(new Date("2026-02-01T08:00:00.000Z")).toISOString()).toBe(
      "2026-04-02T08:00:00.000Z",
    );
    // 1er septembre 9 h (Paris, UTC+2) → 31 octobre 8 h (Paris, UTC+1).
    expect(finReservation(new Date("2026-09-01T07:00:00.000Z")).toISOString()).toBe(
      "2026-10-31T07:00:00.000Z",
    );
  });
});

describe("verrous du lot 2 : module pur, aucun branchement", () => {
  const DOSSIER = join(process.cwd(), "src/features/apporteurs-reseau");

  it("regle-attribution.ts n'importe que ./regles", () => {
    const source = readFileSync(join(DOSSIER, "regle-attribution.ts"), "utf8");
    const imports = [...source.matchAll(/\bfrom\s+"([^"]+)"|\bimport\s+"([^"]+)"|import\(/g)].map(
      (m) => m[1] ?? m[2] ?? "import()",
    );
    expect(imports).toEqual(["./regles"]);
    expect(source).not.toMatch(/process\.env|require\(/);
  });

  it("aucun appelant ne construit encore de réservation (la preuve « sans effet »)", () => {
    // Brancher la règle oblige à écrire `reserveeJusquAt` : tant que ce lot n'est pas suivi du
    // branchement, le mot ne vit que dans les modules de règles. Le lot suivant retirera ce test.
    const SRC = join(process.cwd(), "src");
    const porteurs = (readdirSync(SRC, { recursive: true }) as string[])
      .map((f) => f.replaceAll("\\", "/"))
      .filter((f) => /\.tsx?$/.test(f) && !f.includes("__tests__/") && !/\.spec\.tsx?$/.test(f))
      .filter((f) => readFileSync(join(SRC, f), "utf8").includes("reserveeJusquAt"))
      .sort();
    expect(porteurs).toEqual([
      "features/apporteurs-reseau/declaration-regles.ts",
      "features/apporteurs-reseau/regle-attribution.ts",
      "features/apporteurs-reseau/regles.ts",
      // Lot 1 (#2253) : module de présentation pur, lui aussi sans appelant.
      "features/apporteurs-reseau/reservation-presentation.ts",
    ]);
  });
});

// ── Copies figées des règles d'AVANT ce lot (origin/main du 2026-11-25) ──────────────────────────

function ancienneCommandeCouverte(e: {
  signeeAt: Date;
  recueAt: Date;
  confirmee: boolean;
  protegeeJusquAt: Date | null;
}): boolean {
  if (!e.confirmee || !e.protegeeJusquAt) return false;
  return (
    e.signeeAt.getTime() >= e.recueAt.getTime() &&
    e.signeeAt.getTime() <= e.protegeeJusquAt.getTime()
  );
}

function ancienEtat(
  p: { statut: string; contactEnvoyeAt: Date | null; recueAt: Date; protegeeJusquAt: Date | null },
  maintenant: Date,
): { etat: string; jusquAu: Date | null } | null {
  const fin = p.protegeeJusquAt ?? finDeProtection(p.recueAt);
  switch (p.statut) {
    case "reservee":
      if (!p.contactEnvoyeAt) {
        const attente = maintenant.getTime() - p.recueAt.getTime();
        return {
          etat: attente >= RAPPEL_SANS_REPONSE_JOURS * 86_400_000 ? "sans_reponse" : "a_l_etude",
          jusquAu: null,
        };
      }
      return { etat: fin.getTime() < maintenant.getTime() ? "expiree" : "reservee", jusquAu: fin };
    case "confirmee":
      return { etat: fin.getTime() < maintenant.getTime() ? "expiree" : "reservee", jusquAu: fin };
    case "terminee":
      return { etat: "expiree", jusquAu: fin };
    case "deja_connue":
    case "hors_champ":
      return { etat: "non_disponible", jusquAu: null };
    default:
      return null;
  }
}

function ancienneOccupation(
  p: { statut: string; protegeeJusquAt: Date | null },
  maintenant: Date,
): boolean {
  if (p.statut === "reservee") return true;
  if (p.statut === "confirmee")
    return !p.protegeeJusquAt || p.protegeeJusquAt.getTime() >= maintenant.getTime();
  return false;
}

const STATUTS = ["reservee", "confirmee", "terminee", "deja_connue", "hors_champ", "dementie"];
const INSTANTS = [-1, 0, 1, 14, 15, 16, 59, 60, 61, 100, 183, 184, 185, 400].map(j);
const PROTECTIONS = [null, j(30), j(60), finDeProtection(SAISIE), j(300)];

describe("sans le champ reservation : rien ne change", () => {
  it("commandeCouverte rend ce qu'elle rendait (grille de cas, y compris reservation null)", () => {
    let cas = 0;
    for (const confirmee of [true, false])
      for (const protegeeJusquAt of PROTECTIONS)
        for (const signeeAt of INSTANTS) {
          const e = { signeeAt, recueAt: SAISIE, confirmee, protegeeJusquAt };
          const attendu = ancienneCommandeCouverte(e);
          expect(commandeCouverte(e)).toBe(attendu);
          expect(commandeCouverte({ ...e, reservation: null })).toBe(attendu);
          cas++;
        }
    expect(cas).toBe(2 * 5 * 14);
  });

  it("une commande à J+10 d'une présentation NON confirmée reste non couverte", () => {
    expect(
      commandeCouverte({
        signeeAt: j(10),
        recueAt: SAISIE,
        confirmee: false,
        protegeeJusquAt: null,
      }),
    ).toBe(false);
  });

  it("etatPourApporteur rend ce qu'il rendait (grille de cas)", () => {
    let cas = 0;
    for (const statut of STATUTS)
      for (const contactEnvoyeAt of [null, j(2), j(40)])
        for (const protegeeJusquAt of PROTECTIONS)
          for (const maintenant of INSTANTS) {
            const p = { statut, contactEnvoyeAt, recueAt: SAISIE, protegeeJusquAt };
            const attendu = ancienEtat(p, maintenant);
            expect(etatPourApporteur(p, maintenant)).toEqual(attendu);
            expect(etatPourApporteur(p, maintenant, null)).toEqual(attendu);
            expect(etatPourApporteur(p, maintenant, undefined)).toEqual(attendu);
            cas++;
          }
    expect(cas).toBe(6 * 3 * 5 * 14);
  });

  it("presentationOccupe rend ce qu'elle rendait (grille de cas)", () => {
    let cas = 0;
    for (const statut of STATUTS)
      for (const protegeeJusquAt of PROTECTIONS)
        for (const maintenant of INSTANTS) {
          const p = { statut: statut as "reservee", protegeeJusquAt };
          const attendu = ancienneOccupation(p, maintenant);
          expect(presentationOccupe(p, maintenant)).toBe(attendu);
          expect(presentationOccupe(p, maintenant, null)).toBe(attendu);
          expect(presentationOccupe(p, maintenant, undefined)).toBe(attendu);
          cas++;
        }
    expect(cas).toBe(6 * 5 * 14);
  });

  it("une présentation reservee sans reservation occupe toujours, même un an plus tard", () => {
    expect(presentationOccupe({ statut: "reservee", protegeeJusquAt: null }, j(365))).toBe(true);
  });
});

describe("avec une reservation : commandeCouverte", () => {
  const reservation = { reserveeJusquAt: FIN, statut: "reservee" };
  const nonConfirmee = { recueAt: SAISIE, confirmee: false, protegeeJusquAt: null, reservation };

  it("J+59 couverte, J+60 pile couverte, J+61 non couverte", () => {
    expect(commandeCouverte({ ...nonConfirmee, signeeAt: j(59) })).toBe(true);
    expect(commandeCouverte({ ...nonConfirmee, signeeAt: j(60) })).toBe(true);
    expect(commandeCouverte({ ...nonConfirmee, signeeAt: new Date(FIN.getTime() + 1) })).toBe(
      false,
    );
    expect(commandeCouverte({ ...nonConfirmee, signeeAt: j(61) })).toBe(false);
  });

  it("signée à l'instant de la saisie : couverte ; avant la saisie : non couverte", () => {
    expect(commandeCouverte({ ...nonConfirmee, signeeAt: SAISIE })).toBe(true);
    expect(commandeCouverte({ ...nonConfirmee, signeeAt: new Date(SAISIE.getTime() - 1) })).toBe(
      false,
    );
    expect(commandeCouverte({ ...nonConfirmee, signeeAt: j(-3) })).toBe(false);
  });

  it("la branche existante reste prioritaire : confirmée et protégée, couverte après les 60 jours", () => {
    const confirmee = {
      recueAt: SAISIE,
      confirmee: true,
      protegeeJusquAt: finDeProtection(SAISIE),
      reservation,
    };
    expect(commandeCouverte({ ...confirmee, signeeAt: j(120) })).toBe(true);
    expect(commandeCouverte({ ...confirmee, signeeAt: j(30) })).toBe(true);
    expect(commandeCouverte({ ...confirmee, signeeAt: j(200) })).toBe(false);
    expect(commandeCouverte({ ...confirmee, signeeAt: j(-1) })).toBe(false);
  });

  it("I3 · confirmée dont la protection est échue tôt : jugée sur sa SEULE protection", () => {
    const e = { recueAt: SAISIE, confirmee: true, protegeeJusquAt: j(30), reservation };
    expect(commandeCouverte({ ...e, signeeAt: j(30) })).toBe(true);
    expect(commandeCouverte({ ...e, signeeAt: j(45) })).toBe(false);
    expect(commandeCouverte({ ...e, signeeAt: j(61) })).toBe(false);
  });

  it("I3 · résiliée à J+20 (protection ramenée à J+20), commande à J+45 : non couverte", () => {
    for (const statut of ["terminee", "confirmee"]) {
      const e = {
        recueAt: SAISIE,
        confirmee: true,
        protegeeJusquAt: j(20),
        reservation: { reserveeJusquAt: FIN, statut },
      };
      expect(commandeCouverte({ ...e, signeeAt: j(45) }), statut).toBe(false);
      expect(commandeCouverte({ ...e, signeeAt: j(20) }), statut).toBe(true);
    }
  });

  it("I3 · la réservation ne couvre que le statut reservee", () => {
    for (const statut of ["terminee", "dementie", "deja_connue", "hors_champ", "confirmee", ""]) {
      for (const protegeeJusquAt of [null, j(20)])
        expect(
          commandeCouverte({
            signeeAt: j(45),
            recueAt: SAISIE,
            confirmee: false,
            protegeeJusquAt,
            reservation: { reserveeJusquAt: FIN, statut },
          }),
          statut,
        ).toBe(false);
    }
  });

  it("une réservation dont le terme précède la saisie ne couvre rien", () => {
    const e = { ...nonConfirmee, reservation: { reserveeJusquAt: j(-5), statut: "reservee" } };
    for (const n of [-10, -5, -1, 0, 1, 30])
      expect(commandeCouverte({ ...e, signeeAt: j(n) })).toBe(false);
  });

  it("date illisible : jamais couverte", () => {
    const nan = new Date(NaN);
    expect(commandeCouverte({ ...nonConfirmee, signeeAt: nan })).toBe(false);
    expect(commandeCouverte({ ...nonConfirmee, recueAt: nan, signeeAt: j(10) })).toBe(false);
    expect(
      commandeCouverte({
        ...nonConfirmee,
        signeeAt: j(10),
        reservation: { reserveeJusquAt: nan, statut: "reservee" },
      }),
    ).toBe(false);
  });
});

describe("avec une reservation : présentation reservee", () => {
  const reservation = { recueAt: SAISIE, reserveeJusquAt: FIN };
  const p = { statut: "reservee" as const, protegeeJusquAt: null };

  it("occupe à J+59 et à J+60 pile, n'occupe plus à J+61", () => {
    expect(presentationOccupe(p, j(59), reservation)).toBe(true);
    expect(presentationOccupe(p, j(60), reservation)).toBe(true);
    expect(presentationOccupe(p, new Date(FIN.getTime() + 1), reservation)).toBe(false);
    expect(presentationOccupe(p, j(61), reservation)).toBe(false);
  });

  it("la reservation ne touche pas les autres statuts", () => {
    for (const statut of ["confirmee", "terminee", "deja_connue", "hors_champ"] as const)
      for (const protegeeJusquAt of PROTECTIONS)
        for (const maintenant of INSTANTS)
          expect(presentationOccupe({ statut, protegeeJusquAt }, maintenant, reservation)).toBe(
            ancienneOccupation({ statut, protegeeJusquAt }, maintenant),
          );
  });

  it("état « réservée » jusqu'à la fin incluse, puis « expirée », avec la date de fin", () => {
    for (const contactEnvoyeAt of [null, j(3)]) {
      const pres = {
        statut: "reservee",
        contactEnvoyeAt,
        recueAt: SAISIE,
        protegeeJusquAt: null,
      };
      expect(etatPourApporteur(pres, j(1), reservation)).toEqual({
        etat: "reservee",
        jusquAu: FIN,
      });
      expect(etatPourApporteur(pres, j(20), reservation)).toEqual({
        etat: "reservee",
        jusquAu: FIN,
      });
      expect(etatPourApporteur(pres, j(60), reservation)).toEqual({
        etat: "reservee",
        jusquAu: FIN,
      });
      expect(etatPourApporteur(pres, new Date(FIN.getTime() + 1), reservation)).toEqual({
        etat: "expiree",
        jusquAu: FIN,
      });
      expect(etatPourApporteur(pres, j(61), reservation)).toEqual({
        etat: "expiree",
        jusquAu: FIN,
      });
    }
  });

  it("la reservation ne touche pas l'état des autres statuts", () => {
    for (const statut of ["confirmee", "terminee", "deja_connue", "hors_champ", "dementie"])
      for (const protegeeJusquAt of PROTECTIONS)
        for (const maintenant of INSTANTS) {
          const pres = { statut, contactEnvoyeAt: j(2), recueAt: SAISIE, protegeeJusquAt };
          expect(etatPourApporteur(pres, maintenant, reservation)).toEqual(
            ancienEtat(pres, maintenant),
          );
        }
  });
});

describe("l'interrupteur APPORTEURS_VALIDATION_RDV", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("absent : éteint", () => {
    vi.stubEnv("APPORTEURS_VALIDATION_RDV", undefined);
    expect(validationParRendezVousActive()).toBe(false);
  });

  it('"false", "TRUE", "1", vide, " true " : éteint', () => {
    for (const valeur of ["false", "TRUE", "True", "1", "", " true ", "oui", "essai"]) {
      vi.stubEnv("APPORTEURS_VALIDATION_RDV", valeur);
      expect(validationParRendezVousActive(), JSON.stringify(valeur)).toBe(false);
    }
  });

  it('"true" exactement : allumé', () => {
    vi.stubEnv("APPORTEURS_VALIDATION_RDV", "true");
    expect(validationParRendezVousActive()).toBe(true);
  });

  it("lu à l'exécution : un changement après l'import est suivi", () => {
    vi.stubEnv("APPORTEURS_VALIDATION_RDV", "true");
    expect(validationParRendezVousActive()).toBe(true);
    vi.stubEnv("APPORTEURS_VALIDATION_RDV", "false");
    expect(validationParRendezVousActive()).toBe(false);
    vi.stubEnv("APPORTEURS_VALIDATION_RDV", undefined);
    expect(validationParRendezVousActive()).toBe(false);
  });
});
