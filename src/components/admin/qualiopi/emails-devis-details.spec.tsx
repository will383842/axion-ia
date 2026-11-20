import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { EmailOutboxItem } from "./EmailOutboxItem";
import { lireDetailsDevis, messageDejaSaisi } from "./emails-devis-details";

const ok = async () => ({ data: { id: "x", envoye: true } });
const photo = {
  renderData: {
    data: {
      lignes: [{ designation: "Atelier", quantite: 1, prixUnitaireHtCents: 100000 }],
      regimeTva: "assujetti",
    },
  },
};

function carte(extra: Record<string, unknown> = {}) {
  return render(
    <EmailOutboxItem
      id="e1"
      template="devis-envoi"
      destinataire="a@client.fr"
      sujet="Devis AXI-DEV-2026-001"
      clientNom="Société Test"
      creeLe="12/11/2026"
      apercu={[
        { label: "Devis n°", valeur: "AXI-DEV-2026-001" },
        { label: "Montant TTC", valeur: "1 200,00 €" },
      ]}
      nbPiecesJointes={1}
      accepteMessagePersonnalise
      messageInitial="Bonjour, voici le devis."
      lienDevis="/fr/adm/qualiopi/devis/d1"
      lienPdf="/api/qualiopi/documents/p1"
      approuverAction={ok}
      refuserAction={async () => ({ data: { id: "e1" } })}
      {...extra}
    />,
  );
}

describe("EmailOutboxItem — devis", () => {
  it("affiche numéro, montant TTC et liens (nouvel onglet, 44 px), sans iframe", () => {
    const { container } = carte();
    expect(screen.getByText("AXI-DEV-2026-001")).toBeTruthy();
    expect(screen.getByText(/1\s200,00/)).toBeTruthy();
    const voir = screen.getByRole("link", { name: "Voir le devis" });
    const pdf = screen.getByRole("link", { name: "Ouvrir le PDF" });
    expect(voir.getAttribute("href")).toBe("/fr/adm/qualiopi/devis/d1");
    expect(pdf.getAttribute("href")).toBe("/api/qualiopi/documents/p1");
    for (const a of [voir, pdf]) {
      expect(a.getAttribute("target")).toBe("_blank");
      expect(a.getAttribute("rel")).toBe("noopener");
      expect(a.className).toContain("min-h-[44px]");
    }
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("pré-remplit le message personnalisé", () => {
    carte();
    const champ = screen.getByPlaceholderText(/Comme convenu/) as HTMLTextAreaElement;
    expect(champ.value).toBe("Bonjour, voici le devis.");
  });

  it("sans liens, aucun lien affiché", () => {
    carte({ lienDevis: null, lienPdf: null });
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("lireDetailsDevis", () => {
  it("une seule requête groupée pour N e-mails, TTC depuis la photo", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: "d1", numero: "N1", documentGenereId: "p1", documentGenere: { metadata: photo } },
      { id: "d2", numero: "N2", documentGenereId: null, documentGenere: null },
    ]);
    const mails = [
      { template: "devis-envoi", entityType: "Devis", entityId: "d1" },
      { template: "devis-envoi", entityType: "Devis", entityId: "d2" },
      { template: "devis-envoi", entityType: "Devis", entityId: "d1" },
      { template: "relance-impaye", entityType: "Facture", entityId: "f1" },
    ];
    const r = await lireDetailsDevis({ devis: { findMany } }, mails);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany.mock.calls[0]![0].where.id.in).toEqual(["d1", "d2"]);
    expect(r.get("d1")).toEqual({ numero: "N1", montantTtcCents: 120000, documentId: "p1" });
    expect(r.get("d2")).toEqual({ numero: "N2", montantTtcCents: null, documentId: null });
  });

  it("aucun devis en attente : aucune requête", async () => {
    const findMany = vi.fn();
    await lireDetailsDevis({ devis: { findMany } }, [
      { template: "relance-impaye", entityType: "Facture", entityId: "f1" },
    ]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("lit le message déjà saisi", () => {
    expect(messageDejaSaisi({ messagePersonnalise: "Salut" })).toBe("Salut");
    expect(messageDejaSaisi(null)).toBe("");
  });
});
