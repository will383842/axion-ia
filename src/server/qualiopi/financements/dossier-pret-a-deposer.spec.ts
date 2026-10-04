/**
 * Chantier OPCO A6 — état réel des pièces de la demande et encart de dépôt.
 */

import { describe, it, expect } from "vitest";
import {
  LIBELLES_REGIME,
  NON_RENSEIGNE,
  encartDepot,
  etatPiecesDemande,
  type DocumentLu,
} from "./dossier-pret-a-deposer";

const D = (iso: string) => new Date(`${iso}T10:00:00.000Z`);

function doc(p: Partial<DocumentLu> & Pick<DocumentLu, "type" | "numero">): DocumentLu {
  return {
    id: `id-${p.numero}`,
    createdAt: D("2026-09-01"),
    annuleeAt: null,
    statutSignature: "non_requise",
    ...p,
  };
}

describe("etatPiecesDemande", () => {
  it("pièce manquante → non cochée et nommée « non émise »", () => {
    const pieces = etatPiecesDemande([
      doc({ type: "convention", numero: "AXI-DOC-1", statutSignature: "signee" }),
      doc({ type: "programme", numero: "AXI-DOC-2" }),
    ]);
    const parCle = Object.fromEntries(pieces.map((p) => [p.cle, p]));
    expect(parCle["convention"]?.presente).toBe(true);
    expect(parCle["programme"]?.presente).toBe(true);
    expect(parCle["devis"]).toMatchObject({ presente: false, detail: "non émise", document: null });
    expect(parCle["calendrier"]?.presente).toBe(false);
  });

  it("convention émise mais NON signée → non cochée, le motif le dit", () => {
    const [convention] = etatPiecesDemande([
      doc({ type: "convention", numero: "AXI-DOC-1", statutSignature: "en_attente" }),
    ]);
    expect(convention?.presente).toBe(false);
    expect(convention?.detail).toContain("signature non recueillie");
  });

  it("pièce annulée → ne compte pas", () => {
    const pieces = etatPiecesDemande([
      doc({ type: "programme", numero: "AXI-DOC-2", annuleeAt: D("2026-09-02") }),
    ]);
    expect(pieces.find((p) => p.cle === "programme")?.presente).toBe(false);
  });

  it("la plus récente en vigueur est retenue ; la tripartite prime sur la bipartite", () => {
    const pieces = etatPiecesDemande([
      doc({ type: "programme", numero: "P-ANCIEN", createdAt: D("2026-08-01") }),
      doc({ type: "programme", numero: "P-RECENT", createdAt: D("2026-09-15") }),
      doc({ type: "convention", numero: "C-BI", statutSignature: "signee" }),
      doc({ type: "convention_tripartite", numero: "C-TRI", statutSignature: "signee" }),
    ]);
    expect(pieces.find((p) => p.cle === "programme")?.document?.numero).toBe("P-RECENT");
    expect(pieces.find((p) => p.cle === "convention")?.document?.numero).toBe("C-TRI");
  });
});

describe("encartDepot", () => {
  it("OPCO dont les faits sont null (Akto) → « non renseigné », rien d'inventé", () => {
    const e = encartDepot({
      opco: "akto",
      dateDebut: D("2026-11-20"),
      regime: "inconnu",
      etatFonds: null,
    });
    expect(e.titre).toBe("Comment déposer chez Akto");
    expect(e.portail).toBe(NON_RENSEIGNE);
    expect(e.delai).toBe(NON_RENSEIGNE);
    expect(e.dateLimite).toBe(NON_RENSEIGNE);
    expect(e.regime).toBe("à confirmer sur l'accord");
    expect(e.etatFonds).toBeNull();
  });

  it("Constructys : délai de 15 jours → date limite calculée au jour de Paris", () => {
    const e = encartDepot({
      opco: "constructys",
      dateDebut: D("2026-11-20"),
      regime: "subrogation_possible",
      etatFonds: "Dépôt avant le 30/11/2026",
    });
    expect(e.delai).toBe("au moins 15 jours avant le début de la formation");
    expect(e.dateLimite).toBe("05/11/2026");
    expect(e.regime).toBe("paiement direct possible selon l'accord");
    expect(e.etatFonds).toBe("Dépôt avant le 30/11/2026");
  });

  it("OPCOMMERCE : portail relevé, délai inconnu mais date limite d'exercice connue", () => {
    const e = encartDepot({
      opco: "opcommerce",
      dateDebut: D("2026-11-20"),
      regime: "remboursement_entreprise",
      etatFonds: null,
    });
    expect(e.portail).toBe("https://entreprise.lopcommerce.com/forconet/");
    expect(e.dateLimite).toBe(`${NON_RENSEIGNE} ; au plus tard le 30/11/2026 pour l'exercice 2026`);
    expect(e.regime).toBe(LIBELLES_REGIME.remboursement_entreprise);
  });

  it("Atlas : dépôt par l'entreprise depuis son espace", () => {
    const e = encartDepot({
      opco: "atlas",
      dateDebut: D("2026-11-20"),
      regime: "inconnu",
      etatFonds: null,
    });
    expect(e.qui).toContain("depuis son espace");
  });

  it("OPCO non renseigné → titre générique, tout « non renseigné »", () => {
    const e = encartDepot({
      opco: null,
      dateDebut: D("2026-11-20"),
      regime: "inconnu",
      etatFonds: null,
    });
    expect(e.titre).toBe("Comment déposer la demande de prise en charge");
    expect(e.portail).toBe(NON_RENSEIGNE);
  });

  it("aucun libellé de régime ne promet un délai ni une prise en charge", () => {
    for (const l of Object.values(LIBELLES_REGIME)) {
      expect(l).not.toMatch(/jours?|100 %|0 €|garanti/);
    }
  });
});
