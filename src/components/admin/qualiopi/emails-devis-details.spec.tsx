import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { EmailOutboxItem } from "./EmailOutboxItem";
import {
  construireApercu,
  lireDetailsDevis,
  messageDejaSaisi,
  presenterDevis,
} from "./emails-devis-details";

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

  it("affiche le message prévu en lecture et laisse le champ vide", () => {
    carte();
    const champ = screen.getByPlaceholderText(/Comme convenu/) as HTMLTextAreaElement;
    expect(champ.value).toBe("");
    expect(screen.getByText(/Message déjà prévu dans l’e-mail/)).toBeTruthy();
    expect(screen.getByText(/Bonjour, voici le devis\./)).toBeTruthy();
    expect(
      screen.getByText("Un texte saisi ici remplace le message prévu ; laisser vide le garde."),
    ).toBeTruthy();
  });

  it("champ vide : l'approbation n'envoie aucun message (le serveur garde le prévu)", async () => {
    const approuver = vi.fn(async (_: unknown) => ({ data: { id: "x", envoye: true } }));
    carte({ approuverAction: approuver });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Approuver et envoyer" }));
    await waitFor(() => expect(approuver).toHaveBeenCalled());
    expect(approuver.mock.calls[0]![0]).toEqual({ id: "e1" });
  });

  it("texte saisi : il est envoyé pour remplacer le message prévu", async () => {
    const approuver = vi.fn(async (_: unknown) => ({ data: { id: "x", envoye: true } }));
    carte({ approuverAction: approuver });
    fireEvent.change(screen.getByPlaceholderText(/Comme convenu/), {
      target: { value: "Nouveau texte" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Approuver et envoyer" }));
    await waitFor(() => expect(approuver).toHaveBeenCalled());
    expect(approuver.mock.calls[0]![0]).toEqual({ id: "e1", messagePersonnalise: "Nouveau texte" });
  });

  it("sans message prévu : pas de bloc de lecture", () => {
    carte({ messageInitial: "" });
    expect(screen.queryByText(/Message déjà prévu/)).toBeNull();
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

describe("lireDetailsDevis — montant", () => {
  const mail = [{ template: "devis-envoi", entityType: "Devis", entityId: "d1" }];
  const lire = async (ligne: Record<string, unknown>) => {
    const findMany = vi.fn().mockResolvedValue([ligne]);
    return (await lireDetailsDevis({ devis: { findMany } }, mail)).get("d1")!;
  };

  it("devis classique : montant exact", async () => {
    const r = await lire({
      id: "d1",
      numero: "N1",
      documentGenereId: "p1",
      offre: null,
      documentGenere: { metadata: photo },
    });
    expect(r.montantTtcCents).toBe(120000);
  });

  it("devis à formules (offre non nulle) : aucun montant", async () => {
    const r = await lire({
      id: "d1",
      numero: "N1",
      documentGenereId: "p1",
      offre: { version: 1 },
      documentGenere: { metadata: photo },
    });
    expect(r.montantTtcCents).toBeNull();
    expect(presenterDevis(r, "d1", "adm").montantTtc).toBeNull();
  });

  it("devis à formules (formules figées dans la pièce) : aucun montant", async () => {
    const metadata = {
      renderData: {
        data: { ...photo.renderData.data, formules: { formules: [{ titre: "A" }] } },
      },
    };
    const r = await lire({
      id: "d1",
      numero: "N1",
      documentGenereId: "p1",
      offre: null,
      documentGenere: { metadata },
    });
    expect(r.montantTtcCents).toBeNull();
  });

  it("total nul : aucun montant, jamais « 0,00 € »", async () => {
    const metadata = {
      renderData: { data: { lignes: [], regimeTva: "assujetti" } },
    };
    const r = await lire({
      id: "d1",
      numero: "N1",
      documentGenereId: "p1",
      offre: null,
      documentGenere: { metadata },
    });
    expect(r.montantTtcCents).toBeNull();
    expect(presenterDevis(r, "d1", "adm").montantTtc).toBeNull();
  });
});

describe("construireApercu — libellé du numéro", () => {
  it("devis-envoi : « Devis n° »", () => {
    expect(construireApercu({ numero: "AXI-DEV-1" }, "devis-envoi")).toEqual([
      { label: "Devis n°", valeur: "AXI-DEV-1" },
    ]);
  });

  it.each([
    "facture-envoi",
    "convention-envoi",
    "relance-devis-client",
  ])("%s : jamais « Devis n° »", (gabarit) => {
    const lignes = construireApercu({ numero: "X-1", titreFormation: "IA" }, gabarit);
    expect(lignes.some((l) => l.label === "Devis n°")).toBe(false);
    render(
      <EmailOutboxItem
        id="e2"
        template={gabarit}
        destinataire="a@b.fr"
        sujet="S"
        clientNom={null}
        creeLe="01/01/2026"
        apercu={lignes}
        nbPiecesJointes={0}
        accepteMessagePersonnalise={false}
        approuverAction={ok}
        refuserAction={async () => ({ data: { id: "e2" } })}
      />,
    );
    expect(screen.queryByText("Devis n°")).toBeNull();
  });
});
