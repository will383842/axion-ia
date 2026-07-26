/**
 * Tests — politique de validation des emails (F60).
 *
 * Le point sensible n'est pas la résolution elle-même, c'est son DÉFAUT : une
 * erreur ici bloque une convocation de stagiaire, ou laisse partir une relance
 * d'impayé non relue. Les deux cas sont couverts explicitement.
 */

import { describe, it, expect } from "vitest";
import {
  resoudreModeEnvoi,
  modeParDefaut,
  estEmailQualiopiAutomatique,
  type RegleAutomatisation,
} from "./outbox-policy";

describe("modeParDefaut", () => {
  it("soumet les emails commerciaux à validation", () => {
    expect(modeParDefaut("qualiopi-relance-impayee")).toBe("validation");
    expect(modeParDefaut("devis-envoye")).toBe("validation");
    expect(modeParDefaut("facture-envoyee")).toBe("validation");
  });

  // 🔴 Le cas qui compte le plus. Retenir une convocation expose un stagiaire à
  // ne jamais la recevoir, et les indicateurs 4, 9, 11, 30 et 32 en dépendent.
  it("laisse partir la chaîne Qualiopi automatiquement", () => {
    for (const t of [
      "qualiopi-convocation",
      "qualiopi-rappel-j7",
      "qualiopi-satisfaction-j1",
      "qualiopi-suivi-j30",
      "qualiopi-attestation-disponible",
    ]) {
      expect(modeParDefaut(t)).toBe("auto");
    }
  });

  it("laisse passer un template inconnu — le comportement historique prime", () => {
    expect(modeParDefaut("booking-confirmed")).toBe("auto");
  });
});

describe("resoudreModeEnvoi — précédence", () => {
  const client = (template: string | null, mode: "auto" | "validation"): RegleAutomatisation => ({
    scope: "client",
    template,
    mode,
  });
  const global = (template: string | null, mode: "auto" | "validation"): RegleAutomatisation => ({
    scope: "global",
    template,
    mode,
  });

  it("sans aucune règle, retombe sur le défaut par nature", () => {
    expect(resoudreModeEnvoi("qualiopi-relance-impayee", [])).toBe("validation");
    expect(resoudreModeEnvoi("qualiopi-convocation", [])).toBe("auto");
  });

  it("une règle globale « tous templates » couvre ce que le défaut ne dit pas", () => {
    expect(resoudreModeEnvoi("booking-confirmed", [global(null, "validation")])).toBe("validation");
  });

  it("une règle globale sur le template exact prime sur la règle globale générale", () => {
    const regles = [global(null, "validation"), global("qualiopi-convocation", "auto")];
    expect(resoudreModeEnvoi("qualiopi-convocation", regles)).toBe("auto");
  });

  it("le réglage du client prime sur le réglage global", () => {
    const regles = [global(null, "validation"), client(null, "auto")];
    expect(resoudreModeEnvoi("devis-envoye", regles)).toBe("auto");
  });

  it("le template exact du client prime sur tout le reste", () => {
    const regles = [
      global(null, "auto"),
      global("devis-envoye", "auto"),
      client(null, "auto"),
      client("devis-envoye", "validation"),
    ];
    expect(resoudreModeEnvoi("devis-envoye", regles)).toBe("validation");
  });

  it("permet de RÉACTIVER l'automatique sur un email commercial, par client", () => {
    // Un client de confiance avec qui Will ne veut plus relire chaque relance.
    expect(resoudreModeEnvoi("qualiopi-relance-impayee", [client(null, "auto")])).toBe("auto");
  });

  it("permet de SOUMETTRE une convocation à validation, si Will le décide", () => {
    expect(
      resoudreModeEnvoi("qualiopi-convocation", [client("qualiopi-convocation", "validation")]),
    ).toBe("validation");
  });
});

describe("estEmailQualiopiAutomatique", () => {
  it("identifie la chaîne Qualiopi", () => {
    expect(estEmailQualiopiAutomatique("qualiopi-convocation")).toBe(true);
    expect(estEmailQualiopiAutomatique("qualiopi-relance-impayee")).toBe(false);
  });
});
