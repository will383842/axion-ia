import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/features/admin-emails/actions", () => ({
  renvoyerEchecsEnLotFormulaire: vi.fn(),
  renvoyerEmailActionFormulaire: vi.fn(),
}));

import { VueEmails } from "../_components/VueEmails";
import type { ChargementEmails, LigneEmail } from "@/features/admin-emails/query";

afterEach(cleanup);

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

describe("E-mails envoyés — corrections de relecture", () => {
  it("groupe sur createdAt : un e-mail créé le 18 et envoyé le 19 ne dédouble pas le jour 18", () => {
    const errs = vi.spyOn(console, "error").mockImplementation(() => {});
    vue([
      ligne({
        id: "a",
        createdAt: new Date("2026-11-18T12:00:00Z"),
        sentAt: new Date("2026-11-18T12:01:00Z"),
      }),
      ligne({
        id: "b",
        createdAt: new Date("2026-11-18T11:00:00Z"),
        sentAt: new Date("2026-11-19T09:00:00Z"),
      }),
      ligne({
        id: "c",
        createdAt: new Date("2026-11-18T10:00:00Z"),
        sentAt: new Date("2026-11-18T10:01:00Z"),
      }),
    ]);
    expect(screen.getAllByRole("heading", { level: 2, name: /18 novembre/i })).toHaveLength(1);
    const dupli = errs.mock.calls.filter((c) => String(c[0]).includes("same key"));
    expect(dupli).toHaveLength(0);
    errs.mockRestore();
  });

  it("affiche l'heure d'envoi réelle dans la carte", () => {
    vue([
      ligne({
        id: "b",
        createdAt: new Date("2026-11-18T11:00:00Z"),
        sentAt: new Date("2026-11-19T09:05:00Z"),
      }),
    ]);
    expect(screen.getByText("10:05")).toBeTruthy();
  });

  it("garde un numéro de devis à 4 chiffres entier", () => {
    vue([ligne({ id: "a", objet: "Devis AXI-DEV-2026-1234 pour vous" })]);
    expect(screen.getByText("AXI-DEV-2026-1234")).toBeTruthy();
  });

  it("le compteur statique n'est pas une région role=status", () => {
    vue([ligne({ id: "a" })]);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByText(/e-mail\(s\) — page 1 sur 1/)).toBeTruthy();
  });
});
