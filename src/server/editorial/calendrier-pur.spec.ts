/**
 * Console éditoriale — tests de la logique de calendrier (lot 0).
 *
 * Ces fonctions décident de ce que l'écran montre. Elles vivaient dans un
 * module `server-only`, donc intestable ; les en avoir sorties est ce qui
 * rend ce fichier possible.
 *
 * L'accent est mis sur les **entrées hostiles** : les paramètres viennent
 * d'une URL, et une URL n'est jamais de confiance.
 */

import { describe, it, expect } from "vitest";
import {
  estFiltreIdentite,
  bornesDuMois,
  moisVoisin,
  lireMois,
  lireAnnee,
  estCleJour,
  compterParJour,
  verifierDateIso,
  dateUtcStricte,
  heureValide,
  ANNEE_MIN,
  ANNEE_MAX,
  etatPublication,
  etatDuJour,
  etatParJour,
} from "./calendrier-pur";

describe("estFiltreIdentite", () => {
  it("reconnaît les deux seules identités", () => {
    expect(estFiltreIdentite("perso")).toBe("perso");
    expect(estFiltreIdentite("pro")).toBe("pro");
  });

  it("retombe sur « toutes » pour tout le reste", () => {
    expect(estFiltreIdentite(undefined)).toBe("toutes");
    expect(estFiltreIdentite("")).toBe("toutes");
    expect(estFiltreIdentite("PRO")).toBe("toutes");
    expect(estFiltreIdentite("professionnel")).toBe("toutes");
    expect(estFiltreIdentite("../../etc/passwd")).toBe("toutes");
  });
});

describe("bornesDuMois", () => {
  it("borne le mois en UTC, fin exclusive", () => {
    const { debut, fin } = bornesDuMois(2026, 9);
    expect(debut.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(fin.toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });

  it("🔴 passe l'année sur décembre, sans déborder", () => {
    const { debut, fin } = bornesDuMois(2026, 12);
    expect(debut.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(fin.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("prend février bissextile pour ce qu'il est", () => {
    const { fin } = bornesDuMois(2028, 2);
    expect(fin.toISOString()).toBe("2028-03-01T00:00:00.000Z");
  });
});

describe("moisVoisin", () => {
  it("avance et recule d'un mois", () => {
    expect(moisVoisin(2026, 9, 1)).toEqual({ annee: 2026, mois: 10 });
    expect(moisVoisin(2026, 9, -1)).toEqual({ annee: 2026, mois: 8 });
  });

  it("🔴 franchit correctement les deux bords d'année", () => {
    // Le bug classique : `mois + 1 = 13` affiché tel quel, ou `mois - 1 = 0`.
    expect(moisVoisin(2026, 12, 1)).toEqual({ annee: 2027, mois: 1 });
    expect(moisVoisin(2026, 1, -1)).toEqual({ annee: 2025, mois: 12 });
  });
});

describe("lireMois", () => {
  it("accepte les douze mois", () => {
    for (let m = 1; m <= 12; m += 1) {
      expect(lireMois(String(m), 6)).toBe(m);
    }
  });

  it("🔴 REFUSE tout ce qui ferait rendre `MOIS[mois - 1]` undefined", () => {
    // Sans ce bornage, le titre devient « Calendrier — undefined 2026 ».
    for (const v of ["0", "13", "99", "-4", "abc", "", undefined, "3.9.9"]) {
      const r = lireMois(v as string | undefined, 6);
      expect(r, `pour ${String(v)}`).toBeGreaterThanOrEqual(1);
      expect(r, `pour ${String(v)}`).toBeLessThanOrEqual(12);
    }
  });

  it("retient le défaut quand l'entrée est absurde", () => {
    expect(lireMois("99", 6)).toBe(6);
    expect(lireMois(undefined, 9)).toBe(9);
  });

  it("tolère « 09 », que produit un lien construit avec padStart", () => {
    expect(lireMois("09", 6)).toBe(9);
  });
});

describe("lireAnnee", () => {
  it("accepte une année plausible", () => {
    expect(lireAnnee("2026", 2026)).toBe(2026);
    expect(lireAnnee("2030", 2026)).toBe(2030);
  });

  it("REFUSE hors fenêtre et non numérique", () => {
    expect(lireAnnee("1", 2026)).toBe(2026);
    expect(lireAnnee("9999", 2026)).toBe(2026);
    expect(lireAnnee("abcd", 2026)).toBe(2026);
    expect(lireAnnee(undefined, 2026)).toBe(2026);
  });
});

describe("estCleJour", () => {
  it("accepte une clé bien formée", () => {
    expect(estCleJour("2026-09-01")).toBe(true);
  });

  it("REFUSE tout le reste", () => {
    for (const v of ["2026-9-1", "01/09/2026", "", undefined, "2026-09-01T00:00:00Z"]) {
      expect(estCleJour(v), `pour ${String(v)}`).toBe(false);
    }
  });
});

describe("compterParJour", () => {
  it("additionne les publications d'un même jour", () => {
    const parJour = compterParJour([
      { dayKey: "2026-09-01" },
      { dayKey: "2026-09-01" },
      { dayKey: "2026-09-02" },
    ]);
    expect(parJour.get("2026-09-01")).toBe(2);
    expect(parJour.get("2026-09-02")).toBe(1);
  });

  it("🔴 compte bien DEUX quand un écho tombe le jour de sa source", () => {
    // C'est le cas réel de septembre : 15 publications du profil et 4 échos
    // de page aux mêmes dates. Ce ne sont pas des doublons — deux diffusions.
    const parJour = compterParJour([{ dayKey: "2026-09-01" }, { dayKey: "2026-09-01" }]);
    expect(parJour.get("2026-09-01")).toBe(2);
  });

  it("rend une table vide sans rien inventer", () => {
    expect(compterParJour([]).size).toBe(0);
  });
});

// ── Dates et heures saisies ───────────────────────────────────────────────

describe("verifierDateIso — les dates impossibles n'entrent pas", () => {
  // 🔴 Les quatre cas rapportés par la passe 4 du protocole. Chacun était
  // ACCEPTÉ et silencieusement reporté sur une autre date.
  it.each([
    ["2026-02-30", "2026-03-02"],
    ["2026-13-45", "2027-02-14"],
    ["0000-00-00", "1899-11-30"],
    ["9999-99-99", "+010007-06-07"],
  ])("REFUSE « %s », que Date.UTC reportait sur %s", (iso) => {
    const r = verifierDateIso(iso);
    expect(r.ok, iso).toBe(false);
    // Le refus doit CITER la valeur fautive : « date invalide » tout seul
    // n'aide personne à corriger sa saisie.
    if (!r.ok) expect(r.erreur).toContain(iso);
  });

  it("REFUSE le 30 février d'une année non bissextile ET d'une bissextile", () => {
    expect(verifierDateIso("2025-02-29").ok).toBe(false);
    expect(verifierDateIso("2026-02-29").ok).toBe(false);
    // …mais accepte le 29 février d'une vraie bissextile.
    expect(verifierDateIso("2024-02-29").ok).toBe(true);
  });

  it("REFUSE le 31 des mois qui n'en ont que 30", () => {
    for (const mois of ["04", "06", "09", "11"]) {
      expect(verifierDateIso(`2026-${mois}-31`).ok, mois).toBe(false);
    }
  });

  it("🔴 REFUSE une année hors du calendrier navigable, en le DISANT", () => {
    // Sans cette borne, la publication existe en base et n'apparaît sur aucun
    // écran : `lireAnnee` ne descend pas sous 2020 ni ne monte au-dessus de
    // 2100. Une donnée réelle et invisible est pire qu'un refus.
    const r = verifierDateIso("1999-06-15");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erreur).toContain("1999");
      expect(r.erreur).toContain("introuvable");
    }
    expect(verifierDateIso("2101-01-01").ok).toBe(false);
  });

  it("garde les bornes du calendrier et celles de la saisie ALIGNÉES", () => {
    // Le vrai risque n'est pas qu'une borne soit fausse, c'est que les deux
    // divergent. On vérifie donc l'accord, pas les valeurs.
    expect(lireAnnee(String(ANNEE_MIN), 2026)).toBe(ANNEE_MIN);
    expect(lireAnnee(String(ANNEE_MAX), 2026)).toBe(ANNEE_MAX);
    expect(verifierDateIso(`${ANNEE_MIN}-01-01`).ok).toBe(true);
    expect(verifierDateIso(`${ANNEE_MAX}-12-31`).ok).toBe(true);
    expect(lireAnnee(String(ANNEE_MIN - 1), 2026)).toBe(2026);
    expect(verifierDateIso(`${ANNEE_MIN - 1}-01-01`).ok).toBe(false);
  });

  it("accepte une date réelle et la rend à MINUIT UTC", () => {
    const r = verifierDateIso("2026-09-15");
    expect(r.ok).toBe(true);
    if (r.ok) {
      // Jamais `new Date(a, m, j)` : le fuseau local décalerait le jour, et
      // une publication du 15 se rangerait au 14 dans la grille.
      expect(r.date.toISOString()).toBe("2026-09-15T00:00:00.000Z");
    }
  });

  it("REFUSE ce qui n'a pas la forme, sans exploser", () => {
    for (const v of ["", "2026-9-15", "15/09/2026", "2026-09-15T10:00", "abc"]) {
      expect(verifierDateIso(v).ok, v).toBe(false);
    }
  });
});

describe("dateUtcStricte — la conversion qui refuse au lieu de reporter", () => {
  it("convertit une date réelle", () => {
    expect(dateUtcStricte("2026-01-31").toISOString()).toBe("2026-01-31T00:00:00.000Z");
  });

  it("🔴 LÈVE sur une date impossible, au lieu de rendre le 2 mars", () => {
    expect(() => dateUtcStricte("2026-02-30")).toThrow(/n'existe pas au calendrier/);
  });
});

describe("heureValide — 99:99 n'est pas une heure", () => {
  it("🔴 REFUSE les heures hors bornes", () => {
    for (const h of ["99:99", "24:00", "12:60", "-1:00", "9:00", "09:0"]) {
      expect(heureValide(h), h).toBe(false);
    }
  });

  it("accepte les bornes exactes", () => {
    for (const h of ["00:00", "09:30", "23:59"]) {
      expect(heureValide(h), h).toBe(true);
    }
  });
});

describe("etatPublication", () => {
  it("rend l'état le plus avancé quand la diffusion est engagée", () => {
    // Un post publié est terminé même si son visuel n'a jamais été déposé :
    // il est trop tard pour le produire, le peindre en rouge n'aide personne.
    expect(etatPublication({ statutAsset: "a_produire", statutDiffusion: "publie" })).toBe(
      "publie",
    );
    expect(etatPublication({ statutAsset: "a_produire", statutDiffusion: "programme" })).toBe(
      "programme",
    );
  });

  it("🔴 compte « non_requis » comme PRÊT, pas comme à produire", () => {
    // Un post de texte seul n'attend aucun visuel. Le classer « à produire »
    // le ferait remonter dans le travail restant, où il n'a rien à faire.
    expect(etatPublication({ statutAsset: "non_requis", statutDiffusion: "non_programme" })).toBe(
      "pret",
    );
  });

  it("distingue le visuel déposé du visuel absent", () => {
    // C'est LA distinction qu'on vient chercher : ce qui est fait, et ce qui
    // reste à faire.
    expect(etatPublication({ statutAsset: "a_produire", statutDiffusion: "non_programme" })).toBe(
      "a_produire",
    );
    expect(etatPublication({ statutAsset: "en_cours", statutDiffusion: "non_programme" })).toBe(
      "en_cours",
    );
    expect(etatPublication({ statutAsset: "a_valider", statutDiffusion: "non_programme" })).toBe(
      "en_cours",
    );
    expect(etatPublication({ statutAsset: "pret", statutDiffusion: "non_programme" })).toBe("pret");
  });
});

describe("etatDuJour", () => {
  it("🔴 retient le MOINS avancé, jamais le plus avancé", () => {
    // Un jour qui porte un post publié et un post sans visuel n'est pas à
    // moitié fait : il reste du travail dessus, et c'est ce qu'on veut voir.
    expect(
      etatDuJour([
        { statutAsset: "pret", statutDiffusion: "publie" },
        { statutAsset: "a_produire", statutDiffusion: "non_programme" },
      ]),
    ).toBe("a_produire");
  });

  it("🔴 ÉCARTE les annulés du calcul", () => {
    // Un post annulé n'est pas du travail restant. Le laisser peser ferait
    // passer un jour terminé pour un jour en retard.
    expect(
      etatDuJour([
        { statutAsset: "pret", statutDiffusion: "publie" },
        { statutAsset: "a_produire", statutDiffusion: "annule" },
      ]),
    ).toBe("publie");
  });

  it("rend « annulé » quand il n'y a QUE des annulés", () => {
    expect(etatDuJour([{ statutAsset: "a_produire", statutDiffusion: "annule" }])).toBe("annule");
  });

  it("rend null sur un jour vide, plutôt qu'une couleur arbitraire", () => {
    expect(etatDuJour([])).toBeNull();
  });
});

describe("etatParJour", () => {
  it("groupe par jour et rend un état par jour", () => {
    const etats = etatParJour([
      { dayKey: "2026-09-01", statutAsset: "a_produire", statutDiffusion: "non_programme" },
      { dayKey: "2026-09-01", statutAsset: "pret", statutDiffusion: "publie" },
      { dayKey: "2026-09-02", statutAsset: "pret", statutDiffusion: "publie" },
    ]);
    expect(etats.get("2026-09-01")).toBe("a_produire");
    expect(etats.get("2026-09-02")).toBe("publie");
    expect(etats.size).toBe(2);
  });
});
