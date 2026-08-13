// Encodage des réponses dans l'URL.
//
// Le lien partagé est un CONTRAT : un dirigeant envoie le rapport à son associé
// le lundi, celui-ci l'ouvre le vendredi, après un déploiement. Si le décodage
// a changé entre-temps, c'est une page cassée pour le prospect le plus engagé
// du tunnel. D'où les tests de tolérance ci-dessous.

import { describe, it, expect } from "vitest";
import { ROI_QUERY_PARAM, answersToQuery, decodeAnswers, encodeAnswers } from "@/lib/roi/encode";
import { diagnose } from "@/lib/roi/diagnose";
import type { RoiAnswers } from "@/content/roi/model/types";

const FULL: RoiAnswers = {
  sector: "juridique",
  headcount: "21-50",
  maturity: "bureautique",
  functions: ["administratif", "commercial", "production"],
  volumes: {
    factures_emises_mois: 55,
    devis_emis_semaine: 1.5,
    comptes_rendus_semaine: 6,
    recherches_documentaires_semaine: 40,
  },
  hourlyCostEur: 65,
};

describe("aller-retour", () => {
  it("restitue exactement les réponses", () => {
    const decoded = decodeAnswers(encodeAnswers(FULL));
    expect(decoded).toEqual(FULL);
  });

  it("conserve les valeurs décimales des tranches", () => {
    // Plusieurs tranches ont une médiane à la demie (« moins de 3 » → 1,5).
    const decoded = decodeAnswers(encodeAnswers(FULL));
    expect(decoded?.volumes.devis_emis_semaine).toBe(1.5);
  });

  it("survit à un profil minimal sans volume ni coût", () => {
    const minimal: RoiAnswers = {
      sector: "generique",
      headcount: "1",
      maturity: "papier",
      functions: [],
      volumes: {},
    };
    expect(decodeAnswers(encodeAnswers(minimal))).toEqual(minimal);
  });

  it("omet le coût horaire quand il n'a pas été réglé", () => {
    const { hourlyCostEur: _omit, ...withoutCost } = FULL;
    const decoded = decodeAnswers(encodeAnswers(withoutCost as RoiAnswers));
    expect(decoded).not.toHaveProperty("hourlyCostEur");
  });

  it("produit un rapport identique à celui des réponses d'origine", () => {
    const direct = diagnose(FULL);
    const roundTripped = diagnose(decodeAnswers(encodeAnswers(FULL))!);
    expect(roundTripped.totalSavedEurPerYear).toBe(direct.totalSavedEurPerYear);
    expect(roundTripped.topTasks.map((t) => t.task.id)).toEqual(
      direct.topTasks.map((t) => t.task.id),
    );
  });
});

describe("robustesse du décodage", () => {
  it("refuse une chaîne absente, vide ou tronquée", () => {
    expect(decodeAnswers(null)).toBeNull();
    expect(decodeAnswers("")).toBeNull();
    expect(decodeAnswers("1~ju~e")).toBeNull();
  });

  it("refuse une version inconnue plutôt que de mal interpréter", () => {
    const bumped = encodeAnswers(FULL).replace(/^1~/, "9~");
    expect(decodeAnswers(bumped)).toBeNull();
  });

  it("ignore un code inconnu au lieu d'échouer", () => {
    // Lien fabriqué à la main, tronqué par un client mail, ou produit par une
    // version ultérieure : le dirigeant doit voir un rapport partiel, jamais
    // une page d'erreur.
    const decoded = decodeAnswers("1~ju~e~b~acZ~fa55-ZZ99-cr6~65");
    expect(decoded).not.toBeNull();
    expect(decoded!.functions).toEqual(["administratif", "commercial"]);
    expect(decoded!.volumes.factures_emises_mois).toBe(55);
    expect(decoded!.volumes.comptes_rendus_semaine).toBe(6);
    expect(Object.keys(decoded!.volumes)).toHaveLength(2);
  });

  it("retombe sur des valeurs sûres quand le cadrage est illisible", () => {
    const decoded = decodeAnswers("1~??~?~?~~~");
    expect(decoded).not.toBeNull();
    expect(decoded!.sector).toBe("generique");
    expect(decoded!.maturity).toBe("outille");
  });

  it("écarte les volumes négatifs ou non numériques", () => {
    const decoded = decodeAnswers("1~gx~c~o~a~fa-5-emabc-cr6~");
    expect(decoded!.volumes.comptes_rendus_semaine).toBe(6);
    expect(decoded!.volumes.emails_traites_jour).toBeUndefined();
  });

  it("dédoublonne les fonctions répétées", () => {
    const decoded = decodeAnswers("1~gx~c~o~aacc~~");
    expect(decoded!.functions).toEqual(["administratif", "commercial"]);
  });
});

describe("forme de l'URL", () => {
  it("n'utilise que des caractères qui n'ont pas besoin d'être échappés", () => {
    // Un lien qui se transforme en %7E%2D dans un client mail devient
    // illisible et suspect. Seuls les caractères « unreserved » RFC 3986 sont
    // utilisés comme séparateurs.
    const encoded = encodeAnswers(FULL);
    expect(encodeURIComponent(encoded)).toBe(encoded);
  });

  it("reste assez court pour tenir dans un message", () => {
    expect(encodeAnswers(FULL).length).toBeLessThan(120);
  });

  it("expose la query prête à concaténer", () => {
    expect(answersToQuery(FULL)).toBe(`${ROI_QUERY_PARAM}=${encodeAnswers(FULL)}`);
  });
});
