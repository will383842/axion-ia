/**
 * Tests — provenance d'une présence (`G-prerequis-02`, audit initial 2026-09-14).
 *
 * La question posée est « d'où vient cette présence ? ». Le discriminant est la
 * VALEUR qui prouve : une signature vivante, ou le rattachement à un relevé de
 * connexion archivé — pour une présence mesurée, jamais pour une absence ni pour
 * une saisie. `source` n'est lu que dans un sens : `manuel` désigne toujours une
 * saisie à la main ; `emargement_presentiel` ne prouve rien.
 */

import { describe, it, expect } from "vitest";
import {
  provenanceCreneau,
  resumerProvenance,
  libelleEmargementSigne,
  libellesEmargementParInscription,
} from "@/server/qualiopi/presence/provenance";

/** Créneau de test : présent, sans import, source neutre, sans signature. */
function c(over: Partial<Parameters<typeof provenanceCreneau>[0]> = {}) {
  return {
    present: true,
    importId: null,
    source: "emargement_presentiel",
    signaturesVivantes: 0,
    ...over,
  };
}

describe("provenanceCreneau", () => {
  it("une signature vivante fait une présence SIGNÉE", () => {
    expect(provenanceCreneau(c({ signaturesVivantes: 1 }))).toBe("signature");
  });

  it("🔴 présent, sans signature ni import = DÉCLARATION MANUELLE, quelle que soit la source", () => {
    // Le cas des grilles enregistrées avant le correctif : source
    // `emargement_presentiel`, aucune signature.
    expect(provenanceCreneau(c())).toBe("declaration_manuelle");
  });

  it("un créneau PRÉSENT mesuré par un import vient du relevé de connexion", () => {
    expect(provenanceCreneau(c({ importId: "imp-1", source: "import_zoom" }))).toBe(
      "releve_connexion",
    );
  });

  it("🔴 revue A09 §1 — importé et ABSENT = aucune présence, jamais « issue d'un relevé »", () => {
    // Relevé à 0 min : le stagiaire ne s'est pas connecté. Le rattachement au
    // fichier prouve l'absence, pas une présence.
    expect(
      provenanceCreneau(c({ present: false, importId: "imp-1", source: "import_zoom" })),
      "une absence du relevé de connexion est comptée comme une présence",
    ).toBe("aucune");
  });

  it("🔴 revue A09 §6 — créneau importé COCHÉ À LA MAIN (source manuel) = déclaration, jamais « relevé »", () => {
    // L'import a créé ce créneau à 0 min (inscrit non reconnu) ; l'admin l'a
    // coché dans la grille, qui l'a passé en `manuel` en gardant `importId`.
    expect(
      provenanceCreneau(c({ importId: "imp-1", source: "manuel" })),
      "une présence tapée à la main est présentée comme mesurée par la plateforme",
    ).toBe("declaration_manuelle");
  });

  it("absent, sans signature = aucune présence", () => {
    expect(provenanceCreneau(c({ present: false }))).toBe("aucune");
  });
});

describe("resumerProvenance", () => {
  it("compte séparément les présences signées, déclarées et relevées", () => {
    expect(
      resumerProvenance([
        c({ signaturesVivantes: 1 }),
        c(),
        c(),
        c({ present: false }),
        c({ importId: "imp-1", source: "import_zoom" }),
      ]),
    ).toEqual({ signees: 1, declarees: 2, releveConnexion: 1, premiereSignatureAt: null });
  });

  it("🔴 revue A09 §1 — les absences d'un relevé ne gonflent pas le compte « relevé »", () => {
    const resume = resumerProvenance([
      c({ importId: "imp-1", source: "import_zoom" }),
      c({ present: false, importId: "imp-1", source: "import_zoom" }),
      c({ present: false, importId: "imp-1", source: "import_zoom" }),
    ]);
    expect(resume.releveConnexion).toBe(1);
  });

  it("🔴 revue A09 §6 — une présence saisie sur un créneau importé est comptée DÉCLARÉE", () => {
    const resume = resumerProvenance([
      c({ importId: "imp-1", source: "import_teams" }),
      c({ importId: "imp-1", source: "manuel" }),
    ]);
    expect(resume).toMatchObject({ releveConnexion: 1, declarees: 1 });
  });

  it("retient la PLUS ANCIENNE signature vivante", () => {
    const resume = resumerProvenance([
      c({ signaturesVivantes: 1, premiereSignatureAt: new Date("2026-09-06T14:47:00Z") }),
      c({ signaturesVivantes: 1, premiereSignatureAt: new Date("2026-09-05T08:10:00Z") }),
    ]);
    expect(resume.premiereSignatureAt?.toISOString()).toBe("2026-09-05T08:10:00.000Z");
  });
});

describe("libelleEmargementSigne", () => {
  const date = new Date("2026-09-05T10:00:00Z");
  const vide = { signees: 0, declarees: 0, releveConnexion: 0, premiereSignatureAt: null };

  it("« Oui » avec la date de la première signature quand tout est signé", () => {
    expect(
      libelleEmargementSigne({
        emargementSigneAt: date,
        resume: { ...vide, signees: 2, premiereSignatureAt: date },
      }),
    ).toEqual({ ton: "succes", texte: "Oui — 05/09/2026" });
  });

  it("🔴 revue A09 §2 — signé et déclaré MÊLÉS : jamais « Oui », la répartition est dite", () => {
    // 1 demi-journée signée, 5 tapées à la main : le taux voisin affiche 100 %.
    const libelle = libelleEmargementSigne({
      emargementSigneAt: date,
      resume: { ...vide, signees: 1, declarees: 5, premiereSignatureAt: date },
    });
    expect(
      libelle.texte.startsWith("Oui"),
      "l'écran présente comme émargé un taux dont 5 créneaux sur 6 sont déclarés",
    ).toBe(false);
    expect(libelle).toEqual({
      ton: "alerte",
      texte: "Partiel — 1 créneau signé, 5 déclarés à la main sans signature",
    });
  });

  it("🔴 revue A09 §3 — date posée par la grille AVANT la signature : l'écran montre la signature", () => {
    // `emargementSigneAt` write-once, posée le 01/09 par l'ancienne grille ; la
    // première vraie signature est du 06/09. Afficher le 01/09 serait antidater.
    const libelle = libelleEmargementSigne({
      emargementSigneAt: new Date("2026-09-01T09:00:00Z"),
      resume: { ...vide, signees: 2, premiereSignatureAt: new Date("2026-09-06T14:47:00Z") },
    });
    expect(libelle).toEqual({ ton: "succes", texte: "Oui — 06/09/2026" });
  });

  it("🔴 une date posée SANS signature n'est pas présentée comme un émargement signé", () => {
    // Données écrites par la grille avant le correctif : la date existe en base,
    // aucune signature ne la soutient. On ne l'efface pas — on la nomme.
    const libelle = libelleEmargementSigne({
      emargementSigneAt: date,
      resume: { ...vide, declarees: 2 },
    });
    expect(libelle.ton).toBe("alerte");
    expect(libelle.texte.startsWith("Non")).toBe(true);
    expect(libelle.texte).toContain("sans signature");
  });

  it("🔴 une présence déclarée à la main se lit comme telle", () => {
    const libelle = libelleEmargementSigne({
      emargementSigneAt: null,
      resume: { ...vide, declarees: 3 },
    });
    expect(libelle.ton).toBe("alerte");
    expect(libelle.texte).toBe("Non — présence déclarée à la main (3 créneaux, sans signature)");
  });

  it("rien du tout = « Non »", () => {
    expect(libelleEmargementSigne({ emargementSigneAt: null, resume: vide })).toEqual({
      ton: "neutre",
      texte: "Non",
    });
  });
});

describe("libellesEmargementParInscription", () => {
  it("rattache chaque créneau à SON inscription et lit la date au registre", () => {
    const sig = (iso: string) => ({ signeAt: new Date(iso) });
    const libelles = libellesEmargementParInscription(
      [
        { id: "a", emargementSigneAt: new Date("2026-09-01T09:00:00Z") },
        { id: "b", emargementSigneAt: new Date("2026-09-05T10:00:00Z") },
        { id: "c", emargementSigneAt: null },
        { id: "d", emargementSigneAt: null },
      ],
      [
        {
          enrollmentId: "a",
          present: true,
          importId: null,
          source: "emargement_presentiel",
          emargementSignatures: [sig("2026-09-06T14:47:00Z")],
        },
        {
          enrollmentId: "b",
          present: true,
          importId: null,
          source: "manuel",
          emargementSignatures: [],
        },
        {
          enrollmentId: "c",
          present: false,
          importId: "imp-1",
          source: "import_zoom",
          emargementSignatures: [],
        },
        // Créneau importé à 0 min puis coché à la main : une déclaration.
        {
          enrollmentId: "d",
          present: true,
          importId: "imp-1",
          source: "manuel",
          emargementSignatures: [],
        },
      ],
    );
    expect(libelles.get("a")).toEqual({ ton: "succes", texte: "Oui — 06/09/2026" });
    expect(libelles.get("b")?.texte.startsWith("Non — date posée le 05/09/2026")).toBe(true);
    expect(libelles.get("c")).toEqual({ ton: "neutre", texte: "Non" });
    expect(libelles.get("d")).toEqual({
      ton: "alerte",
      texte: "Non — présence déclarée à la main (1 créneau, sans signature)",
    });
  });
});
