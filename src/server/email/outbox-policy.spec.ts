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
    expect(modeParDefaut("devis-envoi")).toBe("validation");
    expect(modeParDefaut("facture-envoi")).toBe("validation");
    expect(modeParDefaut("convention-envoi")).toBe("validation");
  });

  // 🔴 2026-08-02 — la relance d'impayé est le SEUL email commercial qui part
  // sans passer par la corbeille, et c'est délibéré : sa validation a lieu en
  // amont, dans la boîte de dialogue du hub (reste dû net + fraîcheur du
  // pointage bancaire + case à cocher obligatoire). Deux garages successifs sur
  // le même envoi produisaient un e-mail qui ne partait jamais, sur une relance
  // pourtant marquée « envoyée ».
  it("laisse partir la relance d'impayé : sa validation est faite en amont", () => {
    expect(modeParDefaut("qualiopi-relance-impayee")).toBe("auto");
    expect(EMAILS_A_VALIDER_PAR_DEFAUT).not.toContain("qualiopi-relance-impayee");
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
    expect(resoudreModeEnvoi("devis-envoi", [])).toBe("validation");
    expect(resoudreModeEnvoi("qualiopi-convocation", [])).toBe("auto");
    // Validée en amont dans la boîte de dialogue du hub, pas en corbeille.
    expect(resoudreModeEnvoi("qualiopi-relance-impayee", [])).toBe("auto");
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
    // Un client de confiance avec qui Will ne veut plus relire chaque devis.
    expect(resoudreModeEnvoi("devis-envoi", [client(null, "auto")])).toBe("auto");
  });

  // Le réglage par client reste OPÉRANT sur la relance : un client sensible peut
  // repasser en relecture en corbeille malgré le défaut « auto ».
  it("permet de SOUMETTRE une relance à validation pour un client sensible", () => {
    expect(
      resoudreModeEnvoi("qualiopi-relance-impayee", [
        client("qualiopi-relance-impayee", "validation"),
      ]),
    ).toBe("validation");
  });

  it("permet de SOUMETTRE une convocation à validation, si Will le décide", () => {
    expect(
      resoudreModeEnvoi("qualiopi-convocation", [client("qualiopi-convocation", "validation")]),
    ).toBe("validation");
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 🔴 Audit du 2026-08-16 — la garde qui manquait.
  //
  // Avant ce correctif, UNE seule règle attrape-tout enregistrée depuis la page
  // de réglages garait toute la chaîne réglementaire. Ces tests rougissent si
  // la garde saute : ils sont la seule chose qui empêche un stagiaire de ne
  // jamais recevoir sa convocation.
  // ─────────────────────────────────────────────────────────────────────────
  describe("garde — une règle attrape-tout ne peut pas garer la chaîne Qualiopi", () => {
    it("une règle GLOBALE « toutes natures → validation » n'emporte pas la chaîne", () => {
      for (const t of EMAILS_AUTOMATIQUES_PAR_DEFAUT) {
        expect(
          resoudreModeEnvoi(t, [global(null, "validation")]),
          `${t} doit rester automatique malgré la règle attrape-tout`,
        ).toBe("auto");
      }
    });

    it("une règle CLIENT « toutes natures → validation » n'emporte pas la chaîne", () => {
      for (const t of EMAILS_AUTOMATIQUES_PAR_DEFAUT) {
        expect(resoudreModeEnvoi(t, [client(null, "validation")]), t).toBe("auto");
      }
    });

    it("la garde ne s'applique QU'À la chaîne réglementaire", () => {
      // Le commercial reste gouvernable par une règle générale : c'est
      // exactement l'usage pour lequel la page de réglages existe.
      expect(resoudreModeEnvoi("booking-confirmed", [global(null, "validation")])).toBe(
        "validation",
      );
      expect(resoudreModeEnvoi("qualiopi-relance-impayee", [global(null, "validation")])).toBe(
        "validation",
      );
    });

    it("une règle qui NOMME le template reste souveraine — la garde n'ôte aucune liberté", () => {
      expect(
        resoudreModeEnvoi("qualiopi-convocation", [global("qualiopi-convocation", "validation")]),
      ).toBe("validation");
      expect(
        resoudreModeEnvoi("qualiopi-attestation-disponible", [
          client("qualiopi-attestation-disponible", "validation"),
        ]),
      ).toBe("validation");
    });

    it("une règle attrape-tout « auto » reste sans effet notable sur la chaîne", () => {
      expect(resoudreModeEnvoi("qualiopi-convocation", [global(null, "auto")])).toBe("auto");
    });
  });

  // La précédence documentée en tête de `outbox-policy.ts` ne doit PAS bouger :
  // une règle client générale prime sur une règle globale nominative. La garde
  // ci-dessus a été écrite en boucle précisément pour préserver cet ordre.
  it("une règle client « toutes natures » prime sur une règle globale nominative", () => {
    const regles = [global("devis-envoi", "validation"), client(null, "auto")];
    expect(resoudreModeEnvoi("devis-envoi", regles)).toBe("auto");
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
    // Positionnement (2026-08-15) — envoyé par `envoyerPositionnement`, depuis
    // l'action « Envoyer au stagiaire ». Remplace le repli sur
    // `qualiopi-portail-acces`, qui invitait le stagiaire à ignorer le message.
    "qualiopi-positionnement",
    // Relances questionnaires + enquête entreprise (2026-08-04) — envoyés par
    // les crons relance-questionnaires / enquete-entreprise-j30.
    "qualiopi-questionnaire-relance",
    "qualiopi-enquete-entreprise",
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
