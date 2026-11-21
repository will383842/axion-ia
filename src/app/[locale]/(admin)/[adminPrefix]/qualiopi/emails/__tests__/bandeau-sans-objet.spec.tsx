import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { EmailOutboxItem } from "@/components/admin/qualiopi/EmailOutboxItem";

const MOTIF = "Le devis est accepté : cette relance est sans objet.";

function carte(template: string, motifSansObjet?: string | null) {
  return render(
    <EmailOutboxItem
      id="e1"
      template={template}
      destinataire="a@b.fr"
      sujet="Devis AXI-DEV-2026-012 : un point ?"
      clientNom="Société Test"
      creeLe="12/11/2026"
      apercu={[]}
      nbPiecesJointes={0}
      accepteMessagePersonnalise={false}
      approuverAction={async () => ({ data: { id: "e1", envoye: true } })}
      refuserAction={async () => ({ data: { id: "e1" } })}
      {...(motifSansObjet !== undefined ? { motifSansObjet } : {})}
    />,
  );
}

describe("EmailOutboxItem — bandeau « Relance sans objet »", () => {
  it("affiche le titre, le motif tel quel et la consigne quand un motif est renseigné", () => {
    carte("relance-devis-client", MOTIF);
    expect(screen.getByText("Relance sans objet")).toBeTruthy();
    expect(screen.getByText(MOTIF)).toBeTruthy();
    expect(screen.getByText("Vous pouvez la refuser : elle ne partira pas.")).toBeTruthy();
  });

  it("le bandeau est statique : ni role=alert ni role=status", () => {
    const { container } = carte("relance-devis-client", MOTIF);
    const bandeau = screen.getByText("Relance sans objet").closest("section") as HTMLElement;
    expect(bandeau).not.toBeNull();
    expect(bandeau.querySelector("[role]")).toBeNull();
    expect(bandeau.getAttribute("role")).toBeNull();
    expect(container.querySelectorAll('[role="status"]')).toHaveLength(0);
  });

  it("n'affiche aucun bandeau quand le motif est null", () => {
    carte("relance-devis-client", null);
    expect(screen.queryByText("Relance sans objet")).toBeNull();
  });

  it("n'affiche aucun bandeau quand la propriété est absente", () => {
    carte("relance-devis-client");
    expect(screen.queryByText("Relance sans objet")).toBeNull();
  });

  it("garde les boutons Approuver, Refuser et la case de relecture", () => {
    carte("relance-devis-client", MOTIF);
    expect(screen.getByRole("button", { name: "Approuver et envoyer" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Refuser" })).toBeTruthy();
    expect(screen.getByRole("checkbox")).toBeTruthy();
  });

  it("le titre du bandeau n'est pas un h3 : c'est un h4, sous le h3 du sujet", () => {
    const { container } = carte("relance-devis-client", MOTIF);
    const titre = screen.getByText("Relance sans objet");
    expect(titre.tagName).toBe("H4");
    expect(titre.tagName).not.toBe("H3");
    // Le seul h3 de la carte est le sujet.
    const h3 = container.querySelectorAll("h3");
    expect(h3).toHaveLength(1);
    expect(h3[0]?.textContent).toContain("Devis AXI-DEV-2026-012");
  });

  it("le bandeau est placé avant le champ Objet (haut de la carte)", () => {
    carte("relance-devis-client", MOTIF);
    const bandeau = screen.getByText("Relance sans objet");
    const objet = screen.getByLabelText("Objet");
    expect(bandeau.compareDocumentPosition(objet) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("page E-mails à valider — calcul du motif « sans objet »", () => {
  const relance = (id: string, devisId: string | null, template = "relance-devis-client") => ({
    id,
    template,
    recipient: "a@b.fr",
    sujet: `Sujet ${id}`,
    payload: {},
    attachments: [],
    createdAt: new Date("2026-11-18T09:00:00Z"),
    entityType: devisId ? "Devis" : null,
    entityId: devisId,
    jobId: null,
    client: { raisonSociale: "Société Test" },
  });

  // Enregistreur simple (pas `vi.fn`) : un espion dont l'implémentation lève ou rejette fait
  // échouer le test côté outil, alors que la page capte l'erreur.
  type Impl = (lecteur: unknown, devisId: string, maintenant: Date) => Promise<string | null>;
  let impl: Impl = async () => null;
  const appels: [unknown, string, Date][] = [];
  const motifSpy = (l: unknown, id: string, d: Date) => {
    appels.push([l, id, d]);
    return impl(l, id, d);
  };

  async function rendrePage(enAttente: unknown[]) {
    vi.resetModules();
    vi.doMock("@/auth", () => ({ auth: async () => ({ user: { id: "u" } }) }));
    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        emailOutbox: {
          findMany: async (a: { where: { statut: unknown } }) =>
            typeof a.where.statut === "string" ? enAttente : [],
        },
        emailAutomationSetting: { findMany: async () => [] },
        client: { findMany: async () => [] },
      },
    }));
    vi.doMock("@/server/relances/reponse-relance-garee", () => ({
      lireReponsesSurRelancesGarees: async () => new Map(),
    }));
    vi.doMock("@/components/admin/qualiopi/emails-devis-details", async (orig) => ({
      ...(await orig<object>()),
      lireDetailsDevis: async () => new Map(),
    }));
    vi.doMock("@/server/qualiopi/devis/relance-devis-sans-objet", () => ({
      motifRelanceDevisSansObjet: motifSpy,
    }));
    const { default: Page } = await import("../page");
    return render(await Page({ params: Promise.resolve({ locale: "fr", adminPrefix: "a" }) }));
  }

  beforeEach(() => {
    appels.length = 0;
    impl = async () => null;
  });

  it("un seul appel par devis distinct, bandeau sur chaque relance concernée", async () => {
    impl = async (_l, id) => (id === "d1" ? MOTIF : null);
    await rendrePage([
      relance("r1", "d1"),
      relance("r2", "d1"),
      relance("r3", "d2"),
      relance("r4", "d3", "relance-impaye"),
    ]);
    expect(appels).toHaveLength(2);
    expect(appels.map((c) => c[1]).sort()).toEqual(["d1", "d2"]);
    expect(appels[0]?.[2]).toBeInstanceOf(Date);
    // d1 sert deux relances : deux bandeaux ; d2 (null) et le gabarit étranger : aucun.
    expect(screen.getAllByText("Relance sans objet")).toHaveLength(2);
  });

  it("12 devis distincts : jamais plus de 5 calculs en cours en même temps", async () => {
    let enCours = 0;
    let maxEnCours = 0;
    impl = async () => {
      enCours += 1;
      maxEnCours = Math.max(maxEnCours, enCours);
      await new Promise((r) => setTimeout(r, 5));
      enCours -= 1;
      return null;
    };
    await rendrePage(Array.from({ length: 12 }, (_, i) => relance(`r${i}`, `d${i}`)));
    expect(appels).toHaveLength(12);
    expect(maxEnCours).toBe(5);
  });

  it("relance sans lien vers un devis : aucun appel, aucun bandeau", async () => {
    await rendrePage([relance("r1", null)]);
    expect(appels).toHaveLength(0);
    expect(screen.queryByText("Relance sans objet")).toBeNull();
  });

  it("le calcul échoue : pas de bandeau, la page se rend quand même", async () => {
    impl = async () => {
      throw new Error("base indisponible");
    };
    await rendrePage([relance("r1", "d1"), relance("r2", "d2")]);
    expect(appels).toHaveLength(2);
    expect(screen.queryByText("Relance sans objet")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Refuser" })).toHaveLength(2);
  });
});
