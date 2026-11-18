import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/dossier-client/fiche/actions-relance-devis", () => ({
  preparerRelanceDevisAction: vi.fn(),
}));

import { MESSAGE_RELANCE_PRETE } from "@/features/dossier-client/fiche/relance-devis";
import { RelanceDevis } from "../RelanceDevis";
import type { ContexteFiche } from "../contexte";

const ctx = (message: string | null): ContexteFiche =>
  ({
    clientId: "11111111-1111-4111-8111-111111111111",
    locale: "fr",
    adminPrefix: "admin",
    qBase: "/fr/admin/qualiopi",
    ficheHref: "/fr/admin/qualiopi/clients/x",
    role: "SUPER_ADMIN",
    peutEcrire: true,
    voitEchanges: true,
    maintenant: new Date("2026-10-30T10:00:00Z"),
    sp: {},
    erreur: null,
    message,
  }) as unknown as ContexteFiche;

const devis = [
  {
    id: "d1",
    numero: "AXI-DEV-1",
    statut: "envoye",
    montantTotalHtCents: 1,
    createdAt: new Date(),
  },
];

describe("RelanceDevis — lien vers les e-mails à valider", () => {
  it.each([
    [null, "Voir les e-mails à valider"],
    [MESSAGE_RELANCE_PRETE, "Relire la relance prête"],
  ])("garde une cible tactile de 44 px (message %s)", (message, libelle) => {
    const html = renderToStaticMarkup(<RelanceDevis ctx={ctx(message)} devis={devis} />);
    const lien = html.match(/<a [^>]*>[^<]*<\/a>/)?.[0] ?? "";
    expect(lien).toContain(libelle);
    expect(lien).toContain("inline-flex min-h-11 items-center");
  });
});
