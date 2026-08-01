/**
 * Tests — politique de validation des emails (F60).
 *
 * Le point sensible n'est pas la résolution elle-même, c'est son DÉFAUT : une
 * erreur ici bloque une convocation de stagiaire, ou laisse partir une relance
 * d'impayé non relue. Les deux cas sont couverts explicitement.
 */

import { describe, it, expect } from "vitest";
import type { EmailJobName } from "@/server/queue/types";
import {
  EMAILS_A_VALIDER_PAR_DEFAUT,
  EMAILS_AUTOMATIQUES_PAR_DEFAUT,
  resoudreModeEnvoi,
  modeParDefaut,
  estEmailQualiopiAutomatique,
  type RegleAutomatisation,
} from "./outbox-policy";

describe("modeParDefaut", () => {
  it("soumet les emails commerciaux à validation", () => {
    expect(modeParDefaut("qualiopi-relance-impayee")).toBe("validation");
    expect(modeParDefaut("devis-envoi")).toBe("validation");
    expect(modeParDefaut("facture-envoi")).toBe("validation");
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
    expect(resoudreModeEnvoi("devis-envoi", regles)).toBe("auto");
  });

  it("le template exact du client prime sur tout le reste", () => {
    const regles = [
      global(null, "auto"),
      global("devis-envoi", "auto"),
      client(null, "auto"),
      client("devis-envoi", "validation"),
    ];
    expect(resoudreModeEnvoi("devis-envoi", regles)).toBe("validation");
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

// 🔴 Contre-vérification 2026-07-26. Les deux listes portaient « devis-envoye »
// et « facture-envoyee » ; les vrais noms de jobs sont « devis-envoi » et
// « facture-envoi ». Deux caractères — et la corbeille ne pouvait JAMAIS se
// remplir pour les deux envois qu'elle existe pour faire relire.
//
// Une liste explicite protège d'un motif trop large. Elle ne protège pas d'une
// faute de frappe. Ce test-ci le fait : toute entrée qui n'est pas un
// `EmailJobName` réel casse la compilation ET l'assertion.
describe("Cohérence avec les noms de jobs réels", () => {
  // Recensement des templates réellement enfilables, tiré de l'union de types.
  const TEMPLATES_REELS: readonly EmailJobName[] = [
    "qualiopi-convocation",
    "qualiopi-rappel-j7",
    "qualiopi-satisfaction-j1",
    "qualiopi-suivi-j30",
    "qualiopi-attestation-disponible",
    "qualiopi-portail-acces",
    "qualiopi-alerte-interne",
    "qualiopi-relance-impayee",
    "devis-envoi",
    "facture-envoi",
    // Lien de signature d'une convention adressé au client (2026-08-01) :
    // pièce contractuelle → même traitement que devis et contrat.
    "convention-envoi",
    "contract-sent",
    "contract-reminder",
  ];

  it("chaque email « à valider » correspond à un job réel", () => {
    for (const t of EMAILS_A_VALIDER_PAR_DEFAUT) {
      expect(TEMPLATES_REELS).toContain(t as EmailJobName);
    }
  });

  it("chaque email « automatique » correspond à un job réel", () => {
    for (const t of EMAILS_AUTOMATIQUES_PAR_DEFAUT) {
      expect(TEMPLATES_REELS).toContain(t as EmailJobName);
    }
  });

  it("les deux listes ne se chevauchent pas", () => {
    const croisement = EMAILS_A_VALIDER_PAR_DEFAUT.filter((t) =>
      EMAILS_AUTOMATIQUES_PAR_DEFAUT.includes(t),
    );
    expect(croisement).toHaveLength(0);
  });
});
