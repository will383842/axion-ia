/**
 * Tests — provenance d'une présence (`G-prerequis-02`, audit initial 2026-09-14).
 *
 * La question posée est « d'où vient cette présence ? », et la réponse ne doit
 * JAMAIS se lire dans le texte de `source` : les créneaux saisis à la main avant
 * le correctif portent `emargement_presentiel`, exactement comme un créneau
 * signé. Le discriminant est la VALEUR qui prouve : une signature vivante, ou le
 * rattachement à un relevé de connexion archivé.
 */

import { describe, it, expect } from "vitest";
import {
  provenanceCreneau,
  resumerProvenance,
  libelleEmargementSigne,
} from "@/server/qualiopi/presence/provenance";

describe("provenanceCreneau", () => {
  it("une signature vivante fait une présence SIGNÉE", () => {
    expect(provenanceCreneau({ present: true, importId: null, signaturesVivantes: 1 })).toBe(
      "signature",
    );
  });

  it("🔴 présent, sans signature ni import = DÉCLARATION MANUELLE, quelle que soit la source", () => {
    // Le cas des grilles enregistrées avant le correctif : source
    // `emargement_presentiel`, aucune signature. Le prédicat ne lit pas `source`.
    expect(provenanceCreneau({ present: true, importId: null, signaturesVivantes: 0 })).toBe(
      "declaration_manuelle",
    );
  });

  it("un créneau rattaché à un import vient du relevé de connexion", () => {
    expect(provenanceCreneau({ present: true, importId: "imp-1", signaturesVivantes: 0 })).toBe(
      "releve_connexion",
    );
  });

  it("absent, sans signature = aucune présence", () => {
    expect(provenanceCreneau({ present: false, importId: null, signaturesVivantes: 0 })).toBe(
      "aucune",
    );
  });
});

describe("resumerProvenance", () => {
  it("compte séparément les présences signées et les présences déclarées", () => {
    expect(
      resumerProvenance([
        { present: true, importId: null, signaturesVivantes: 1 },
        { present: true, importId: null, signaturesVivantes: 0 },
        { present: true, importId: null, signaturesVivantes: 0 },
        { present: false, importId: null, signaturesVivantes: 0 },
        { present: true, importId: "imp-1", signaturesVivantes: 0 },
      ]),
    ).toEqual({ signees: 1, declarees: 2, releveConnexion: 1 });
  });
});

describe("libelleEmargementSigne", () => {
  const date = new Date("2026-09-05T10:00:00Z");

  it("« Oui » seulement quand une signature existe", () => {
    expect(
      libelleEmargementSigne({
        emargementSigneAt: date,
        resume: { signees: 2, declarees: 0, releveConnexion: 0 },
      }),
    ).toEqual({ ton: "succes", texte: "Oui — 05/09/2026" });
  });

  it("🔴 une date posée SANS signature n'est pas présentée comme un émargement signé", () => {
    // Données écrites par la grille avant le correctif : la date existe en base,
    // aucune signature ne la soutient. On ne l'efface pas — on la nomme.
    const libelle = libelleEmargementSigne({
      emargementSigneAt: date,
      resume: { signees: 0, declarees: 2, releveConnexion: 0 },
    });
    expect(libelle.ton).toBe("alerte");
    expect(libelle.texte.startsWith("Non")).toBe(true);
    expect(libelle.texte).toContain("sans signature");
  });

  it("🔴 une présence déclarée à la main se lit comme telle", () => {
    const libelle = libelleEmargementSigne({
      emargementSigneAt: null,
      resume: { signees: 0, declarees: 3, releveConnexion: 0 },
    });
    expect(libelle.ton).toBe("alerte");
    expect(libelle.texte).toBe("Non — présence déclarée à la main (3 créneaux, sans signature)");
  });

  it("rien du tout = « Non »", () => {
    expect(
      libelleEmargementSigne({
        emargementSigneAt: null,
        resume: { signees: 0, declarees: 0, releveConnexion: 0 },
      }),
    ).toEqual({ ton: "neutre", texte: "Non" });
  });
});
