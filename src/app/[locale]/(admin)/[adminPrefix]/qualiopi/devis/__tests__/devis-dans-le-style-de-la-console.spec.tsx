/**
 * Les pages du devis suivent le style de la console (badges d'état, bouton
 * d'en-tête, lien de retour « ← … » en xs) et le portail de signature n'utilise
 * plus la palette grise de Tailwind. Présentation seule : aucune logique testée.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const NOW = new Date("2030-01-01T00:00:00Z");
vi.mock("@/server/auth/garde-page", () => ({
  gardePage: () => Promise.resolve({ autorise: true, role: "admin", peutEcrire: true }),
}));
vi.mock("@/server/qualiopi/crm/devis", () => ({
  listDevis: () =>
    Promise.resolve([
      {
        id: "d1",
        numero: "AXI-DEV-2030-001",
        clientId: "c1",
        statut: "accepte",
        montantTotalHtCents: 100000,
        montantOpcoEstimeCents: null,
        financementSuggere: null,
        dateValidite: NOW,
      },
    ]),
}));
vi.mock("@/server/qualiopi/crm/clients", () => ({
  listClients: () => Promise.resolve([{ id: "c1", raisonSociale: "Client fictif" }]),
}));
vi.mock("@/server/qualiopi/documents/signature/pieces-en-attente", () => ({
  idsPiecesDevisAContresigner: () => Promise.resolve(new Set<string>()),
}));

import QualiopiDevisPage from "../page";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const BASE = "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/devis";

describe("liste des devis", () => {
  it("affiche l'état en badge et « Nouveau devis » comme action d'en-tête", async () => {
    const ui = await QualiopiDevisPage({
      params: Promise.resolve({ locale: "fr", adminPrefix: "adm" }),
      searchParams: Promise.resolve({}),
    });
    const { container } = render(ui);
    expect(container.querySelector(".admin-badge-v2")?.textContent).toContain("Accepté");
    const nouveau = screen.getByRole("link", { name: "Nouveau devis" });
    expect(nouveau.getAttribute("href")).toBe("/fr/adm/qualiopi/devis/new");
    expect(container.querySelector("header")?.contains(nouveau)).toBe(true);
  });
});

describe("liens de retour et palette", () => {
  it.each(["new", "bibliotheque", "[id]/modifier"])(
    "devis/%s utilise le lien de retour de la console",
    (page) => {
      const s = lire(`${BASE}/${page}/page.tsx`);
      expect(s).toContain("underline-offset-2 hover:underline");
      expect(s).not.toContain("underline hover:no-underline");
    },
  );

  it("devis/new relie le client pré-sélectionné à sa fiche", () => {
    const s = lire(`${BASE}/new/page.tsx`);
    expect(s).toContain("qualiopi/clients/${clientPreselectionne.id}");
  });

  it.each([
    "src/app/[locale]/portail/signer/[token]/page.tsx",
    "src/components/portail/PieceSignatureForm.tsx",
  ])("%s n'emploie plus la palette grise de Tailwind", (f) => {
    expect(lire(f)).not.toMatch(/\bgray-\d/);
  });
});
