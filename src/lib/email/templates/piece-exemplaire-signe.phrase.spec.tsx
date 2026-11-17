/**
 * 🔴 L'exemplaire signé disait « Devis est désormais signée… » : libellé nu, article absent,
 * accord toujours au féminin. Les circuits nomment leurs pièces sans article.
 */
import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";
import { PieceExemplaireSigneEmail, pieceExemplaireSigneSubject } from "./piece-exemplaire-signe";

async function corps(payload: Record<string, unknown>): Promise<string> {
  const html = await render(<PieceExemplaireSigneEmail locale="fr" payload={payload} />);
  return html
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ");
}

describe("pièce signée — phrase correcte", () => {
  it("devis : masculin", async () => {
    const t = await corps({ numero: "AXI-DOC-2026-001", libellePiece: "devis" });
    expect(t).toContain("Le devis est désormais signé par l'ensemble des parties");
    expect(t).not.toContain("Devis est");
  });

  it("convention : féminin, même avec article déjà posé", async () => {
    for (const libellePiece of ["convention de formation", "la convention de formation"]) {
      const t = await corps({ numero: "AXI-DOC-2026-002", libellePiece });
      expect(t).toContain("La convention de formation est désormais signée");
    }
  });

  it("libellé inconnu : phrase neutre", async () => {
    const t = await corps({ numero: "N1", libellePiece: "machin truc" });
    expect(t).toContain("Le document est désormais signé par toutes les parties");
  });

  it("libellé absent : le défaut historique « la pièce » est accordé", async () => {
    const t = await corps({ numero: "N1" });
    expect(t).toContain("La pièce est désormais signée par l'ensemble des parties");
  });

  it("numéro, objet et pièce jointe inchangés", async () => {
    const payload = {
      numero: "AXI-DOC-2026-039",
      numeroDevis: "AXI-DEV-2026-001",
      libellePiece: "devis",
    };
    const t = await corps(payload);
    expect(t).toContain("Référence du document : AXI-DEV-2026-001");
    expect(t).toContain("Référence de la pièce : AXI-DOC-2026-039");
    expect(t).toContain("en pièce jointe");
    expect(pieceExemplaireSigneSubject("fr", payload)).toContain("AXI-DEV-2026-001");
  });
});
