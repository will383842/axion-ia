import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/features/admin-emails/actions", () => ({
  renvoyerEchecsEnLotFormulaire: vi.fn(),
  renvoyerEmailActionFormulaire: vi.fn(),
}));

import { VueEmails } from "../_components/VueEmails";
import type { ChargementEmails, LigneEmail } from "@/features/admin-emails/query";

const ligne = (o: Partial<LigneEmail>): LigneEmail => ({
  id: "i",
  template: "devis-envoi",
  recipient: "paie@client.fr",
  status: "sent",
  attempts: 1,
  error: null,
  entityType: null,
  entityId: null,
  providerMessageId: null,
  sentAt: new Date("2026-11-18T10:00:00Z"),
  failedAt: null,
  createdAt: new Date("2026-11-18T09:59:00Z"),
  jobId: null,
  bounceType: null,
  bounceReason: null,
  objet: null,
  client: null,
  ...o,
});

function vue(lignes: LigneEmail[]) {
  const donnees = {
    lignes,
    total: lignes.length,
    page: 1,
    pages: 1,
    parStatut: { envoyes: 2, echecs: 1, enAttente: 0, annules: 0, rebonds: 0, rebondsDurs: 0 },
    gabarits: [],
    session: null,
    client: null,
  } as unknown as ChargementEmails;
  return render(
    <VueEmails
      donnees={donnees}
      echecs={
        {
          total: 0,
          sansJob: 0,
          destinatairesDistincts: 0,
          depuis: null,
          panneEnCours: false,
          motif: null,
          luA: new Date(),
        } as never
      }
      issueRenvoi={null}
      filtres={{
        jours: 30,
        statut: null,
        gabarit: null,
        destinataire: null,
        sessionId: null,
        page: 1,
      }}
      adminPrefix="gestion"
      nbGabaritsDeclares={61}
    />,
  );
}

const trois = [
  ligne({ id: "a", objet: "Devis AXI-DEV-2026-012 pour vous" }),
  ligne({ id: "b", sentAt: new Date("2026-11-18T14:00:00Z") }),
  ligne({
    id: "c",
    status: "failed",
    error: "Boîte pleine",
    jobId: "j1",
    sentAt: null,
    createdAt: new Date("2026-11-17T08:00:00Z"),
  }),
];

describe("E-mails envoyés — refonte visuelle", () => {
  it("groupe par jour : deux e-mails du même jour → un seul titre", () => {
    vue(trois);
    expect(screen.getAllByRole("heading", { level: 2, name: /18 novembre 2026/ })).toHaveLength(1);
    expect(screen.getAllByRole("heading", { level: 2, name: /17 novembre 2026/ })).toHaveLength(1);
  });

  it("cartes : pastille avec icône, puce du numéro de devis, motif en encadré, action Renvoyer", () => {
    const { container } = vue(trois);
    expect(container.querySelectorAll("li[data-statut]")).toHaveLength(3);
    expect(container.querySelector("li[data-statut=failed] svg")).not.toBeNull();
    expect(screen.getByText("AXI-DEV-2026-012")).toBeTruthy();
    expect(screen.getByText("Motif :").tagName).toBe("STRONG");
    expect(screen.getByRole("button", { name: "Renvoyer" })).toBeTruthy();
  });

  it("tuiles : les nombres de la donnée déjà chargée", () => {
    vue(trois);
    expect(screen.getByText("Envoyés")).toBeTruthy();
    expect(screen.getByText("Échecs")).toBeTruthy();
  });

  it("état vide, aucun <iframe>, vocabulaire sans mention interdite", () => {
    const { container } = vue([]);
    expect(screen.getByText("Aucun e-mail sur cette sélection")).toBeTruthy();
    expect(container.querySelector("iframe")).toBeNull();
    const src = readFileSync(join(__dirname, "../_components/VueEmails.tsx"), "utf8");
    const ajoutes = src
      .slice(src.indexOf("const NUMERO_DEVIS"), src.indexOf("const PUCE"))
      .replace(/\/qualiopi\/clients\//g, "");
    expect(ajoutes).not.toMatch(/qualiopi|opco|financement|prise en charge|certification|cpf/i);
  });
});
