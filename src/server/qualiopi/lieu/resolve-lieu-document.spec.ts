/**
 * Tests — lieu imprimé sur les documents légaux.
 *
 * Le défaut corrigé ici : cinq gabarits annonçaient l'adresse de l'ORGANISME
 * comme lieu de déroulement, y compris pour une formation donnée chez le client.
 */

import { describe, it, expect } from "vitest";

import {
  defautLieuDocument,
  pieceImprimeRepliOrganisme,
  refusEmissionLieu,
  resolveLieuDocument,
  resolveLieuConvocation,
} from "./resolve-lieu-document";
import type { LieuFields } from "./format-lieu";

const IDENTITE = {
  adresseExercice: "10 rue de l'Exercice, 38000 Grenoble",
  adresseSiege: "1 rue du Siège, 38000 Grenoble",
};

/** Ce que le lieu imprimé dit de l'endroit : une adresse, ou une ville. */
function imprimeUnEndroit(lieuImprime: string, c: LieuFields): boolean {
  return [c.lieuAdresse, c.lieuVille]
    .map((v) => (v ?? "").trim())
    .some((v) => v.length > 0 && lieuImprime.includes(v));
}

/**
 * 🔴 I17-01 (audit initial Qualiopi, 2026-09-14) — le repli sur l'adresse de
 * l'organisme était SILENCIEUX. Une session présentielle ou hybride sans lieu
 * imprimait la domiciliation sur la convention, la convocation et la feuille
 * d'émargement, et aucune alerte ne le disait. Le prédicat ci-dessous est ce que
 * lit l'alerte `session_sans_lieu` : il doit dire EXACTEMENT quand le repli joue.
 */
describe("defautLieuDocument — le prédicat que lit l'alerte « session sans lieu »", () => {
  it("🔴 aucun champ de lieu : le document retombera sur l'adresse de l'organisme", () => {
    expect(defautLieuDocument({})).toBe("aucun_lieu");
    expect(
      defautLieuDocument({ lieuType: null, lieuAdresse: "  ", lieuVille: null, lieuSalle: "" }),
    ).toBe("aucun_lieu");
  });

  it("sur site sans adresse ni ville : le document n'imprimera que « Sur site »", () => {
    expect(defautLieuDocument({ lieuType: "sur_site" })).toBe("lieu_sans_adresse");
    expect(
      defautLieuDocument({
        lieuType: "sur_site",
        lieuIntitule: "Siège du client",
        lieuSalle: "B2",
      }),
    ).toBe("lieu_sans_adresse");
  });

  it("🔴 SANS type, une salle, un intitulé ou un code postal seul ne disent pas OÙ non plus", () => {
    // Relecture #1086, constat 3 : `{ lieuSalle: "B2" }` imprime « Salle B2 »,
    // `{ lieuCodePostal: "42000" }` imprime « 42000 ». Le critère « sans dire
    // où » s'appliquait au seul `sur_site`.
    expect(defautLieuDocument({ lieuSalle: "B2" })).toBe("lieu_sans_adresse");
    expect(defautLieuDocument({ lieuIntitule: "Salle Fraunces" })).toBe("lieu_sans_adresse");
    expect(defautLieuDocument({ lieuCodePostal: "42000" })).toBe("lieu_sans_adresse");
  });

  it("🔑 « lieu_sans_adresse » coïncide avec ce que resolveLieuDocument IMPRIME réellement", () => {
    // Le témoin porte sur le comportement du repli, pas sur l'existence d'une
    // fonction : pour chaque cas, on lit la chaîne que la pièce imprimerait.
    const cas: LieuFields[] = [
      { lieuSalle: "B2" },
      { lieuIntitule: "Salle Fraunces" },
      { lieuCodePostal: "42000" },
      { lieuType: "sur_site" },
      { lieuType: "sur_site", lieuSalle: "B2" },
      { lieuType: "sur_site", lieuAdresse: "5 rue des Docks" },
      { lieuVille: "Saint-Étienne" },
      { lieuSalle: "B2", lieuVille: "Saint-Étienne" },
    ];
    for (const c of cas) {
      const imprime = resolveLieuDocument(c, IDENTITE);
      const repli = imprime === IDENTITE.adresseExercice;
      const sansEndroit = !repli && !imprimeUnEndroit(imprime, c);
      expect(
        defautLieuDocument(c) === "lieu_sans_adresse",
        `${JSON.stringify(c)} → ${imprime}`,
      ).toBe(sansEndroit);
    }
  });

  it("témoins de non-vacuité : un lieu réel ne fait rien lever", () => {
    expect(defautLieuDocument({ lieuType: "sur_site", lieuAdresse: "5 rue des Docks" })).toBeNull();
    expect(defautLieuDocument({ lieuType: "sur_site", lieuVille: "Saint-Étienne" })).toBeNull();
    expect(defautLieuDocument({ lieuType: "nos_locaux" })).toBeNull();
    expect(defautLieuDocument({ lieuVille: "Saint-Étienne" })).toBeNull();
    expect(
      defautLieuDocument({ lieuType: "distanciel", lieuVisioUrl: "https://meet.google.com/x" }),
    ).toBeNull();
    // Distanciel sans lien : la pièce imprime « Distanciel », c'est le domaine
    // de `session_distanciel_sans_lien`, pas de celui-ci.
    expect(defautLieuDocument({ lieuType: "distanciel" })).toBeNull();
    // Sans type, un lien seul : `formatLieu` imprime « Distanciel — hôte ».
    expect(defautLieuDocument({ lieuVisioUrl: "https://meet.google.com/abc" })).toBeNull();
  });

  it("🔑 « aucun_lieu » coïncide EXACTEMENT avec le repli de resolveLieuDocument", () => {
    // Deux prédicats jumeaux divergent au premier changement. On vérifie donc,
    // cas par cas, que l'alerte lève si et seulement si le document imprime
    // l'adresse de l'organisme.
    const cas: LieuFields[] = [
      {},
      { lieuType: null },
      { lieuSalle: "  " },
      { lieuSalle: "B2" },
      { lieuIntitule: "Salle Fraunces" },
      { lieuVisioUrl: "https://meet.google.com/abc" },
      { lieuVisioUrl: "lien à venir" },
      { lieuType: "sur_site" },
      { lieuType: "nos_locaux" },
      { lieuType: "distanciel" },
      { lieuCodePostal: "42000" },
    ];
    for (const c of cas) {
      const repli = resolveLieuDocument(c, IDENTITE) === IDENTITE.adresseExercice;
      expect(defautLieuDocument(c) === "aucun_lieu", JSON.stringify(c)).toBe(repli);
    }
  });
});

/**
 * 🔴 Relecture #1086, constat 1 — la pièce fausse ne doit plus NAÎTRE. Une
 * alerte seule la laissait au dossier ; le refus d'émettre l'empêche d'exister.
 */
describe("refusEmissionLieu — une pièce qui imprimerait un lieu faux n'est pas émise", () => {
  it("🔴 présentiel sans lieu : refus, et le motif dit QUOI saisir", () => {
    const motif = refusEmissionLieu({ modalite: "presentiel" });
    expect(motif, "la pièce imprimerait l'adresse de l'organisme").not.toBeNull();
    expect(motif).toContain("adresse de l'organisme");
    expect(motif).toContain("type de lieu");
    expect(motif).toContain("fiche de session");
  });

  it("🔴 hybride sans lieu : refus", () => {
    expect(refusEmissionLieu({ modalite: "hybride", lieuSalle: "  " })).not.toBeNull();
  });

  it("🔴 lieu sans adresse ni ville : refus, le motif demande l'adresse", () => {
    const motif = refusEmissionLieu({ modalite: "presentiel", lieuType: "sur_site" });
    expect(motif).not.toBeNull();
    expect(motif).toContain("adresse");
    expect(refusEmissionLieu({ modalite: "presentiel", lieuSalle: "B2" })).not.toBeNull();
  });

  it("n'est pas plus sévère que le défaut : chaque refus correspond à un défaut réel", () => {
    const cas: LieuFields[] = [
      {},
      { lieuType: "sur_site" },
      { lieuSalle: "B2" },
      { lieuType: "nos_locaux" },
      { lieuType: "sur_site", lieuAdresse: "5 rue des Docks", lieuVille: "Saint-Étienne" },
      { lieuType: "distanciel" },
    ];
    for (const c of cas) {
      expect(refusEmissionLieu({ modalite: "presentiel", ...c }) !== null, JSON.stringify(c)).toBe(
        defautLieuDocument(c) !== null,
      );
    }
  });

  it("témoins : « nos locaux », une adresse réelle, un lieu distanciel sont émis", () => {
    expect(refusEmissionLieu({ modalite: "presentiel", lieuType: "nos_locaux" })).toBeNull();
    expect(
      refusEmissionLieu({
        modalite: "presentiel",
        lieuType: "sur_site",
        lieuAdresse: "5 rue des Docks",
        lieuVille: "Saint-Étienne",
      }),
    ).toBeNull();
    expect(refusEmissionLieu({ modalite: "hybride", lieuType: "distanciel" })).toBeNull();
  });

  it("⚠️ une session 100 % distancielle n'est JAMAIS refusée ici — hors périmètre", () => {
    expect(refusEmissionLieu({ modalite: "distanciel" })).toBeNull();
    expect(refusEmissionLieu({ modalite: "distanciel", lieuSalle: "B2" })).toBeNull();
  });
});

/**
 * 🔴 Relecture #1086, constat 1 (suite) — les pièces DÉJÀ émises restent
 * fausses après la saisie du lieu. Leur instantané de rendu (`metadata.renderData`,
 * posé par `generateDocument` depuis le 2026-07-30) porte le lieu imprimé ET
 * l'identité de l'organisme au moment de l'émission : on compare les deux.
 */
describe("pieceImprimeRepliOrganisme — la pièce émise a-t-elle imprimé l'adresse de l'organisme ?", () => {
  /** Métadonnées telles que `generateDocument` les écrit. */
  function metadata(lieu: string | undefined, identite: object = IDENTITE) {
    return {
      genereParWorker: true,
      renderData: {
        data: { numero: "AXI-DOC-2026-001", ...(lieu !== undefined ? { lieu } : {}) },
        identite,
      },
    };
  }

  it("🔴 une pièce émise sans lieu est reconnue — par ce que resolveLieuDocument a imprimé", () => {
    expect(pieceImprimeRepliOrganisme(metadata(resolveLieuDocument({}, IDENTITE)))).toBe(true);
    // Sans adresse d'exercice : le repli est le siège, et il est reconnu aussi.
    const siegeSeul = { adresseSiege: IDENTITE.adresseSiege };
    expect(
      pieceImprimeRepliOrganisme(metadata(resolveLieuDocument({}, siegeSeul), siegeSeul)),
    ).toBe(true);
  });

  it("témoins : un lieu réel, « Nos locaux », « Distanciel » ne sont pas un repli", () => {
    for (const c of [
      { lieuType: "sur_site", lieuAdresse: "5 rue des Docks", lieuVille: "Saint-Étienne" },
      { lieuType: "nos_locaux" },
      { lieuType: "distanciel" },
    ] as LieuFields[]) {
      expect(
        pieceImprimeRepliOrganisme(metadata(resolveLieuDocument(c, IDENTITE))),
        JSON.stringify(c),
      ).toBe(false);
    }
  });

  it("compare à l'identité FIGÉE dans la pièce, pas à celle d'aujourd'hui", () => {
    const ancienne = { adresseExercice: "3 place Ancienne, 69001 Lyon" };
    expect(pieceImprimeRepliOrganisme(metadata("3 place Ancienne, 69001 Lyon", ancienne))).toBe(
      true,
    );
  });

  it("⚠️ sans instantané (pièce antérieure au 2026-07-30) : indétectable, donc `false`", () => {
    expect(pieceImprimeRepliOrganisme({})).toBe(false);
    expect(pieceImprimeRepliOrganisme(null)).toBe(false);
    expect(pieceImprimeRepliOrganisme({ renderData: { data: {} } })).toBe(false);
    // Convocation émise sans aucune adresse connue : la ligne n'a pas été imprimée.
    expect(pieceImprimeRepliOrganisme(metadata(undefined, {}))).toBe(false);
  });
});

describe("resolveLieuDocument", () => {
  // 🔴 Le test qui porte tout le chantier.
  it("imprime le lieu RÉEL de la session, pas l'adresse de l'organisme", () => {
    const lieu = resolveLieuDocument(
      {
        lieuType: "sur_site",
        lieuAdresse: "5 rue des Docks",
        lieuCodePostal: "42000",
        lieuVille: "Saint-Étienne",
      },
      IDENTITE,
    );
    expect(lieu).toContain("Saint-Étienne");
    expect(lieu).not.toContain("Grenoble");
  });

  it("session sans lieu : repli sur l'adresse d'exercice (comportement historique)", () => {
    expect(resolveLieuDocument({}, IDENTITE)).toBe(IDENTITE.adresseExercice);
  });

  it("sans adresse d'exercice : repli sur le siège", () => {
    expect(resolveLieuDocument({}, { adresseSiege: IDENTITE.adresseSiege })).toBe(
      IDENTITE.adresseSiege,
    );
  });

  it("aucune adresse connue : « — », jamais une chaîne vide", () => {
    expect(resolveLieuDocument({}, {})).toBe("—");
  });

  // Un lieu partiellement rempli reste un lieu : on ne retombe pas sur l'adresse
  // de l'organisme au prétexte qu'il manque le code postal.
  it("un seul champ renseigné suffit à primer sur l'adresse de l'organisme", () => {
    expect(resolveLieuDocument({ lieuVille: "Saint-Étienne" }, IDENTITE)).toContain(
      "Saint-Étienne",
    );
  });

  it("distanciel : n'expose que l'hôte de la visio, jamais le lien complet", () => {
    const lieu = resolveLieuDocument(
      { lieuType: "distanciel", lieuVisioUrl: "https://meet.google.com/abc-defg-hij" },
      IDENTITE,
    );
    expect(lieu).toContain("meet.google.com");
    expect(lieu).not.toContain("abc-defg-hij");
  });
});

describe("resolveLieuConvocation", () => {
  it("renvoie le lieu réel quand il existe", () => {
    expect(resolveLieuConvocation({ lieuVille: "Saint-Étienne" }, IDENTITE)).toContain(
      "Saint-Étienne",
    );
  });

  // « Lieu : — » sur une convocation est pire que pas de ligne du tout : le
  // stagiaire lit que l'information a été cherchée et qu'elle n'existe pas.
  it("renvoie undefined plutôt que « — » quand rien n'est connu", () => {
    expect(resolveLieuConvocation({}, {})).toBeUndefined();
  });

  it("conserve le repli sur l'adresse de l'organisme s'il y en a une", () => {
    expect(resolveLieuConvocation({}, IDENTITE)).toBe(IDENTITE.adresseExercice);
  });
});
