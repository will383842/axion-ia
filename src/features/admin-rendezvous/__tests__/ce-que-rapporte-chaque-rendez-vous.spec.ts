/**
 * « Ce que rapporte chaque rendez-vous » (chantier « Types de rendez-vous », L5b).
 *
 * Will veut lire, sur 30 ou 90 jours : « Diagnostic IA · Accueil (haut) :
 * 12 réservés, 9 honorés, 3 devenus clients ». Ce test garde l'agrégation PURE
 * qui reçoit les lignes groupées par la base :
 *   · le type vient de `typeEffectif` (colonne, sinon nom) — l'apporteur à part ;
 *   · l'emplacement vient de `utm_content`, affiché en clair ;
 *   · honoré / absent suivent le point fait après l'appel, puis le statut ;
 *   · fiche et client ne viennent QUE du rattachement validé (rien d'inventé).
 */
import { describe, expect, it } from "vitest";

import {
  agregerBilan,
  etatDuRendezVous,
  libelleEmplacement,
  lirePeriodeBilan,
  type LigneBilanBrute,
} from "../bilan-rendez-vous";

function ligne(p: Partial<LigneBilanBrute>): LigneBilanBrute {
  return {
    typeRendezVous: "diagnostic",
    eventTypeName: "Diagnostic IA",
    utmContent: "diagnostic:accueil-hero",
    status: "scheduled",
    issue: null,
    fiche: false,
    client: false,
    reporte: false,
    n: 1,
    ...p,
  };
}

describe("l'emplacement se lit en clair", () => {
  it.each([
    ["diagnostic:accueil-hero", "Accueil (haut de page)"],
    ["projet:entete", "En-tête"],
    ["projet:pied-de-page", "Pied de page"],
    ["diagnostic:chatbot", "Chatbot"],
    ["diagnostic:email", "E-mail"],
    ["projet:email-salon", "E-mail salon"],
    ["diagnostic:accueil-final", "Accueil (bas de page)"],
    ["diagnostic:accueil-mobile", "Accueil (mobile)"],
    ["projet:entete-mobile", "En-tête (mobile)"],
    ["diagnostic:pied", "Pied de page"],
    ["diagnostic:email-contact", "E-mail contact"],
    ["diagnostic:page-audit", "Page audit"],
  ])("%s → %s", (brut, libelle) => {
    expect(libelleEmplacement(brut)).toBe(libelle);
  });

  it("un emplacement inconnu garde sa valeur brute", () => {
    expect(libelleEmplacement("projet:bandeau-noel")).toBe("projet:bandeau-noel");
  });

  it("sans emplacement ni utm : des libellés honnêtes", () => {
    expect(libelleEmplacement("diagnostic")).toBe("Page rendez-vous");
    expect(libelleEmplacement(null)).toBe("Non renseigné");
    expect(libelleEmplacement("  ")).toBe("Non renseigné");
  });
});

describe("honoré, absent, annulé", () => {
  it("le point fait après l'appel l'emporte sur le statut", () => {
    expect(etatDuRendezVous("scheduled", "eu_lieu")).toBe("honore");
    expect(etatDuRendezVous("scheduled", "absent")).toBe("absent");
    expect(etatDuRendezVous("completed", "reporte")).toBe("en_attente");
  });
  it("sans point, le statut parle", () => {
    expect(etatDuRendezVous("completed", null)).toBe("honore");
    expect(etatDuRendezVous("no_show", null)).toBe("absent");
    expect(etatDuRendezVous("scheduled", null)).toBe("en_attente");
  });
  it("une annulation reste une annulation", () => {
    expect(etatDuRendezVous("canceled", "eu_lieu")).toBe("annule");
  });
});

describe("l'agrégation par type puis par emplacement", () => {
  it("l'exemple de Will : Diagnostic IA · Accueil (haut)", () => {
    const bilan = agregerBilan([
      ligne({ n: 3, status: "scheduled", issue: "eu_lieu", fiche: true, client: true }),
      ligne({ n: 6, status: "completed" }),
      ligne({ n: 2, status: "no_show" }),
      ligne({ n: 1, status: "canceled" }),
    ]);
    const diag = bilan.types.find((t) => t.type === "diagnostic");
    expect(diag?.emplacements).toEqual([
      {
        cle: "diagnostic:accueil-hero",
        libelle: "Accueil (haut de page)",
        compteurs: { reserves: 12, honores: 9, absents: 2, annules: 1, fiches: 3, clients: 3 },
      },
    ]);
    expect(diag?.total.reserves).toBe(12);
  });

  it("les emplacements sont rangés du plus au moins réservé", () => {
    const bilan = agregerBilan([
      ligne({ utmContent: "diagnostic:chatbot", n: 1 }),
      ligne({ utmContent: "diagnostic:accueil-hero", n: 4 }),
    ]);
    const diag = bilan.types.find((t) => t.type === "diagnostic");
    expect(diag?.emplacements.map((e) => e.libelle)).toEqual(["Accueil (haut de page)", "Chatbot"]);
  });

  it("le type suit la colonne, sinon le nom (repli de la fenêtre de déploiement)", () => {
    const bilan = agregerBilan([
      ligne({ typeRendezVous: null, eventTypeName: "Discutons de votre projet IA", n: 2 }),
    ]);
    expect(bilan.types.find((t) => t.type === "echange_projet")?.total.reserves).toBe(2);
  });

  it("🔴 l'apporteur est À PART : jamais dans les types clients", () => {
    const bilan = agregerBilan([
      ligne({ typeRendezVous: "apporteur", eventTypeName: "Échange apporteur", n: 5 }),
      // Double verrou : le nom suffit, même si la colonne dit autre chose.
      ligne({ typeRendezVous: "salon", eventTypeName: "Échange apporteur d'affaires", n: 1 }),
    ]);
    expect(bilan.apporteur.reserves).toBe(6);
    expect(bilan.types.map((t) => t.type as string)).not.toContain("apporteur");
    expect(bilan.types.find((t) => t.type === "salon")?.total.reserves).toBe(0);
  });

  it("Diagnostic, Échange projet et Salon toujours présents ; « Autre » seulement s'il y en a", () => {
    expect(agregerBilan([]).types.map((t) => t.type)).toEqual([
      "diagnostic",
      "echange_projet",
      "salon",
    ]);
    const avecAutre = agregerBilan([ligne({ typeRendezVous: "autre", eventTypeName: "Divers" })]);
    expect(avecAutre.types.map((t) => t.type)).toContain("autre");
  });

  it("des lignes du même emplacement en casse différente se regroupent", () => {
    const bilan = agregerBilan([
      ligne({ utmContent: "Diagnostic:Accueil-Hero", n: 1 }),
      ligne({ utmContent: "diagnostic:accueil-hero", n: 1 }),
    ]);
    expect(bilan.types.find((t) => t.type === "diagnostic")?.emplacements).toHaveLength(1);
  });
});

describe("la période", () => {
  it("30 jours par défaut, 90 sur demande, rien d'autre", () => {
    expect(lirePeriodeBilan(undefined)).toBe(30);
    expect(lirePeriodeBilan("90")).toBe(90);
    expect(lirePeriodeBilan("365")).toBe(30);
  });
});

describe("🔴 un rendez-vous déplacé ne compte qu'une fois (relecture A09)", () => {
  it("l'ancienne ligne d'un report n'est ni réservée ni annulée", () => {
    const bilan = agregerBilan([
      // L'ancien créneau : annulé par le report, marqué `reporte`.
      ligne({ status: "canceled", reporte: true }),
      // Le nouveau créneau.
      ligne({ status: "scheduled" }),
    ]);
    const diag = bilan.types.find((t) => t.type === "diagnostic");
    expect(diag?.total.reserves).toBe(1);
    expect(diag?.total.annules).toBe(0);
  });

  it("idem pour un apporteur", () => {
    const bilan = agregerBilan([
      ligne({ typeRendezVous: "apporteur", status: "canceled", reporte: true }),
      ligne({ typeRendezVous: "apporteur", status: "scheduled" }),
    ]);
    expect(bilan.apporteur).toMatchObject({ reserves: 1, annules: 0 });
  });
});
