import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";

const etat = vi.hoisted(() => ({
  signatures: [] as unknown[],
  retours: [] as unknown[],
  alertes: [] as unknown[],
  echeances: [] as unknown[],
  rouverts: [] as unknown[] | null,
  emails: 0,
  relances: 0,
}));

vi.mock("@/auth", () => ({ auth: async () => ({ user: { id: "u1", role: "admin" } }) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/server/qualiopi/alertes/routage", () => ({ peutLireLesAlertes: () => true }));
vi.mock("@/server/admin/qualiopi-nav-counts", () => ({
  compterQualiopiNav: async () => ({ emails: etat.emails, relances: etat.relances, total: 0 }),
}));
vi.mock("@/server/qualiopi/alertes/alertes-service", () => ({
  listAlertes: async () => etat.alertes,
}));
vi.mock("@/server/qualiopi/documents/signature/pieces-en-attente", () => ({
  listerPiecesEnAttente: async () => etat.signatures,
}));
vi.mock("@/server/qualiopi/satisfaction/retours-en-attente", () => ({
  listerRetoursEnAttente: async () => etat.retours,
}));
vi.mock("@/server/qualiopi/parcours/echeances-service", () => ({
  prochainesEcheances: async () => ({
    echeances: etat.echeances,
    parSession: new Map(),
    troncature: null,
  }),
}));
vi.mock("@/server/qualiopi/sessions/dossiers-rouverts", () => ({
  DELAI_ALERTE_ROUVERT_JOURS: 7,
  listerDossiersRouvertsAnciens: async () => etat.rouverts,
}));
vi.mock("@/server/qualiopi/documents/signature/lire-horodatages", () => ({
  listerHorodatagesEnRetard: async () => [],
}));
vi.mock("@/server/qualiopi/sessions/verrou-dossier", () => ({
  chargerEtatsVerrou: async () => new Map(),
  dateHeureParis: () => "01/11/2026 09:00",
  dossierFige: () => false,
}));
vi.mock("@/server/qualiopi/documents/signature/contresignables", () => ({
  estContresignable: () => true,
}));
vi.mock("@/server/qualiopi/documents/signature/garde-engagement", () => ({
  peutSignerPourOrganisme: () => true,
}));
vi.mock("@/server/qualiopi/documents/signature/relance-partie", () => ({
  partieARelancer: () => "client",
}));
vi.mock("@/server/qualiopi/parcours/cible-etape", () => ({ hrefEtape: () => "/cible" }));
vi.mock("@/server/qualiopi/parcours/etape-dossier-clos", () => ({
  etapeBloqueeParLeVerrou: () => false,
  MENTION_GESTE_VERROUILLE: "verrouillé",
}));
vi.mock("@/server/qualiopi/parcours/session-parcours", () => ({ CIBLE_SIGNATURE_PIECES: "sig" }));
vi.mock("@/components/admin/qualiopi/BlocHorodatagesEnRetard", () => ({
  BlocHorodatagesEnRetard: () => null,
}));
vi.mock("@/components/admin/qualiopi/RelancerSignatureButton", () => ({
  RelancerSignatureButton: () => <button type="button">Relancer la signature</button>,
}));
vi.mock("@/components/admin/qualiopi/ContresignerLotButton", () => ({
  ContresignerLotButton: () => <button type="button">Contresigner le lot</button>,
}));
vi.mock("@/components/admin/qualiopi/RelancerQuestionnaireButton", () => ({
  RelancerQuestionnaireButton: () => <button type="button">Relancer le questionnaire</button>,
}));

import ATraiterPage from "../page";

async function rendre() {
  const el = await ATraiterPage({
    params: Promise.resolve({ locale: "fr", adminPrefix: "admin" }),
  });
  return render(el);
}

beforeEach(() => {
  etat.signatures = [];
  etat.retours = [];
  etat.alertes = [];
  etat.echeances = [];
  etat.rouverts = [];
  etat.emails = 0;
  etat.relances = 0;
});

const sig = {
  id: "d1",
  type: "convention",
  numero: "CV-1",
  statutSignature: "partielle",
  updatedAt: new Date(Date.now() - 3 * 86400000),
  sessionId: "s1",
  trainerId: null,
  session: { titreSession: "Formation IA", numero: "S-1" },
  signatures: [{ partie: "client" }],
};

describe("page À traiter : refonte visuelle", () => {
  it("état vide : AdminEmptyState et badge « Tout est à jour »", async () => {
    await rendre();
    expect(screen.getByText("Rien à traiter — tout est à jour.")).toBeTruthy();
    expect(screen.getByText("Tout est à jour")).toBeTruthy();
  });

  it("tuiles : un chiffre par type, lien vers la section", async () => {
    etat.signatures = [sig];
    etat.emails = 4;
    await rendre();
    const tuile = screen.getByText("E-mails à valider", { selector: "span" }).closest("a");
    expect(tuile?.getAttribute("href")).toBe("#emails");
    expect(within(tuile as HTMLElement).getByText("4")).toBeTruthy();
    expect(screen.getByText("5 à traiter")).toBeTruthy();
  });

  it("carte de signature : pastille avec icône, titre gras, actions conservées", async () => {
    etat.signatures = [sig];
    const { container } = await rendre();
    const carte = container.querySelector("#signatures li") as HTMLElement;
    expect(carte.className).toContain("border-l-4");
    expect(within(carte).getByText("Contresignature").querySelector("svg")).toBeTruthy();
    expect(within(carte).getByText("Convention CV-1").className).toContain("font-semibold");
    expect(within(carte).getByText("Relancer la signature")).toBeTruthy();
    expect(within(carte).getByText("Ouvrir").closest("a")?.getAttribute("href")).toBe("/cible");
    expect(screen.getByText("Contresigner le lot")).toBeTruthy();
  });

  it("dossier rouvert : motif dans un encadré teinté, registre illisible dit", async () => {
    etat.rouverts = [
      {
        sessionId: "s2",
        numero: "S-2",
        titre: "Titre",
        depuis: new Date(),
        par: "Will",
        jours: 9,
        motif: "erreur de date",
      },
    ];
    const { container, unmount } = await rendre();
    expect(screen.getByText("Motif : « erreur de date »").className).toContain("warning-soft");
    expect(container.querySelector("#rouverts details")).toBeTruthy();
    unmount();
    etat.rouverts = null;
    await rendre();
    expect(screen.getByText(/registre des réouvertures n'a pas pu être lu/)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("registre illisible : pas de « Tout est à jour », badge « À vérifier »", async () => {
    etat.rouverts = null;
    await rendre();
    expect(screen.queryByText("Tout est à jour")).toBeNull();
    expect(screen.getByText(/À vérifier/)).toBeTruthy();
  });

  it("registre illisible mais tâches : badge « N à traiter »", async () => {
    etat.rouverts = null;
    etat.emails = 2;
    await rendre();
    expect(screen.getByText("2 à traiter")).toBeTruthy();
    expect(screen.queryByText(/À vérifier/)).toBeNull();
  });

  it("tuile à 0 : pas de lien vers une section absente", async () => {
    etat.emails = 4;
    await rendre();
    const vide = screen.getByText("Signatures", { selector: "span" });
    expect(vide.closest("a")).toBeNull();
    expect(screen.getByText("E-mails à valider", { selector: "span" }).closest("a")).toBeTruthy();
  });

  it("ordre des sections : rouverts, retours, signatures, e-mails, échéances, relances, alertes", async () => {
    etat.rouverts = [
      {
        sessionId: "s2",
        numero: "S-2",
        titre: "T",
        depuis: new Date(),
        par: "W",
        jours: 9,
        motif: "m",
      },
    ];
    etat.retours = [
      {
        questionnaireId: "r1",
        type: "satisfaction_chaud",
        destinataire: "x",
        estEntreprise: false,
        envoyeAt: new Date(),
        relanceCount: 0,
        derniereRelanceAt: null,
        relancesEpuisees: false,
        sessionId: "s1",
        sessionTitre: "F",
        sessionNumero: "S-1",
      },
    ];
    etat.signatures = [sig];
    etat.emails = 1;
    etat.relances = 1;
    etat.echeances = [
      {
        sessionId: "s1",
        numero: "S-1",
        titre: "F",
        etape: { cle: "k", libelle: "Étape", etat: "hors_delai", mention: "m", geste: "g" },
      },
    ];
    etat.alertes = [{ id: "a1", niveau: "critique", code: "x", titre: "V", message: "msg" }];
    const { container } = await rendre();
    const ids = Array.from(container.querySelectorAll("section[id]")).map((n) => n.id);
    expect(ids).toEqual([
      "rouverts",
      "retours",
      "signatures",
      "emails",
      "echeances",
      "relances",
      "alertes",
    ]);
  });

  it("alerte critique : pastille Critique avec icône", async () => {
    etat.alertes = [
      { id: "a1", niveau: "critique", code: "x", titre: "Vigilance", message: "msg" },
    ];
    const { container } = await rendre();
    const carte = container.querySelector("#alertes li") as HTMLElement;
    expect(within(carte).getByText("Critique").querySelector("svg")).toBeTruthy();
  });

  it("pas de couleur Tailwind par défaut ni de vocabulaire interdit dans la page", () => {
    const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
    expect(src).not.toMatch(
      /(?:text|bg|border)-(?:red|green|blue|amber|gray|slate|yellow|orange)-\d/,
    );
    // textes ajoutés : on ne contrôle que le rendu neuf (le titre de métadonnée existant est exclu)
    const rendu = src.slice(src.indexOf("// ── Présentation")).replaceAll("/qualiopi/", "/");
    expect(rendu).not.toMatch(/OPCO|financement|prise en charge|certification|CPF|Qualiopi/i);
  });
});
