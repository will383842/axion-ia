import { readFileSync } from "node:fs";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";

const donnees = vi.hoisted(() => ({ valeur: null as unknown }));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/server/auth/garde-page", () => ({
  gardePage: async () => ({ autorise: true, role: "admin" }),
}));
vi.mock("@/server/qualiopi/presence/queries", () => ({
  getSessionEmargement: async () => donnees.valeur,
}));
vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: async () => 80,
}));
vi.mock("@/server/qualiopi/emargement/constat-financeur-session", () => ({
  constatContresignatureSession: async () => null,
}));
vi.mock("@/server/qualiopi/emargement/demi-journee/suivi", () => ({
  lireSuiviEmargement: async () => null,
}));
vi.mock("@/server/actions/qualiopi/presence", () => ({
  generateSessionCreneauxAction: vi.fn(),
  saveEmargementAction: vi.fn(),
  importReleveConnexionAction: vi.fn(),
  genererReleveConnexionDocumentAction: vi.fn(),
}));
vi.mock("@/server/actions/qualiopi/session-jours", () => ({ saveSessionJoursAction: vi.fn() }));
vi.mock("@/server/actions/qualiopi/emargement-liens", () => ({
  emettreLiensSessionAction: vi.fn(),
  envoyerLiensEmargementAction: vi.fn(),
  revoquerLiensSessionAction: vi.fn(),
}));
vi.mock("@/server/actions/qualiopi/emargement-demi-journee", () => ({
  cocherFicheJourFormAction: vi.fn(),
  saisirRattrapageFormAction: vi.fn(),
}));
// Composants clients et d'écriture : hors périmètre de cette refonte (présentation de la page).
vi.mock("@/components/admin/qualiopi/EmargementGrid", () => ({
  EmargementGrid: () => <div data-testid="grille" />,
}));
vi.mock("@/components/admin/qualiopi/ImportReleveForm", () => ({
  ImportReleveForm: () => <div data-testid="import" />,
}));
vi.mock("@/components/admin/qualiopi/GenererCreneauxButton", () => ({
  GenererCreneauxButton: () => <div data-testid="generer" />,
}));
vi.mock("@/components/admin/qualiopi/SessionJoursEditor", () => ({
  SessionJoursEditor: () => <div data-testid="jours" />,
}));
vi.mock("@/components/admin/qualiopi/LiensEmargement", () => ({
  LiensEmargement: () => <div data-testid="liens-comp" />,
}));
vi.mock("@/components/admin/qualiopi/BandeauContresignatureFinanceur", () => ({
  BandeauContresignatureFinanceur: () => <div data-testid="bandeau" />,
}));
vi.mock("@/components/admin/qualiopi/DossierSessionButton", () => ({
  DossierSessionButton: () => <div data-testid="dossier" />,
}));
vi.mock("@/components/admin/qualiopi/EmargementDemiJournee", () => ({
  EmargementDemiJournee: () => <div data-testid="demi" />,
}));

import EmargementPage from "../page";

const PAGE = "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/sessions/[id]/emargement/page.tsx";

function session(modalite: string, stagiaires: number) {
  return {
    session: {
      numero: "AXI-26-001",
      modalite,
      statut: "planifiee",
      dateDebut: new Date("2026-08-10T10:00:00Z"),
      dateFin: new Date("2026-08-11T10:00:00Z"),
      dureeReelleHeures: 14,
    },
    enrollments: Array.from({ length: stagiaires }, (_, i) => ({
      id: `e${i}`,
      traineeId: `t${i}`,
      tauxPresencePct: i === 0 ? 90 : null,
      emargementSigneAt: null,
      trainee: { nom: `Nom${i}`, prenom: `Prenom${i}`, email: `s${i}@ex.fr` },
    })),
    creneaux: [],
    jours: [],
  };
}

async function rendre() {
  const ui = await EmargementPage({
    params: Promise.resolve({ locale: "fr", adminPrefix: "admin", id: "s1" }),
  });
  return render(ui);
}

beforeEach(() => {
  donnees.valeur = session("presentiel", 2);
});

describe("Émargement d'une session — refonte visuelle", () => {
  it("en-tête : titre, description à séparateurs « · », badges d'état", async () => {
    const { container } = await rendre();
    const entete = container.querySelector(".admin-page-header") as HTMLElement;
    expect(entete).not.toBeNull();
    expect(within(entete).getByRole("heading", { level: 2 }).textContent).toBe("Émargement");
    expect(entete.textContent).toMatch(/·\s*Présentiel\s*·/);
    expect(within(entete).getByText("2 stagiaires")).toBeTruthy();
    expect(within(entete).getByText("Créneaux à générer")).toBeTruthy();
  });

  it("blocs : titres attendus, ancres conservées, explications repliées", async () => {
    const { container } = await rendre();
    for (const t of [
      "Créneaux de présence",
      "Dossier d'audit",
      "Feuille d'émargement à jour",
      "Feuille d'émargement présentiel",
      "Récapitulatif des taux de présence",
    ]) {
      expect(screen.getByRole("heading", { level: 2, name: t })).toBeTruthy();
    }
    for (const id of ["contresignature", "journees", "liens", "feuille"]) {
      expect(container.querySelector(`#${id}`)).not.toBeNull();
    }
    const repliables = container.querySelectorAll("details");
    expect(repliables.length).toBeGreaterThanOrEqual(3);
    repliables.forEach((d) => expect(d.hasAttribute("open")).toBe(false));
    // Présentiel : pas de bloc de relevé distanciel.
    expect(screen.queryByRole("heading", { name: "Relevé de connexion distanciel" })).toBeNull();
  });

  it("tuiles : chiffres clés calculés sur les données chargées", async () => {
    const { container } = await rendre();
    const tuiles = container.querySelectorAll(".admin-stat-card");
    expect(tuiles).toHaveLength(4);
    const lu = (i: number) => tuiles[i]?.textContent ?? "";
    expect(lu(0)).toMatch(/Stagiaires.*2/);
    expect(lu(1)).toMatch(/Créneaux.*0/);
    expect(lu(2)).toMatch(/Présence complète.*1/);
    expect(lu(3)).toMatch(/À suivre.*1/);
  });

  it("récapitulatif : une ligne-carte par stagiaire, pastille large avec icône, bordure colorée", async () => {
    const { container } = await rendre();
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader")).toHaveLength(4);
    const lignes = within(table).getAllByRole("row").slice(1);
    expect(lignes).toHaveLength(2);
    const entete = (i: number) => lignes[i]?.querySelector("td") as HTMLElement;
    expect(entete(0).className).toContain("border-l-[color:var(--color-admin-success)]");
    expect(entete(1).className).toContain("border-l-[color:var(--color-admin-destructive)]");
    expect(lignes[0]?.querySelector("svg")).not.toBeNull();
    expect(lignes[0]?.querySelector(".admin-badge-plein")).not.toBeNull();
    expect(within(lignes[0] as HTMLElement).getByText("90 %")).toBeTruthy();
    expect(within(lignes[0] as HTMLElement).getByText("Complète")).toBeTruthy();
    expect(within(lignes[1] as HTMLElement).getByText("Aucune")).toBeTruthy();
    expect(table.parentElement?.className).toContain("overflow-x-auto");
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("récapitulatif : la 2e td de la ligne porte le taux (lecture de l'E2E), sans th de ligne", async () => {
    await rendre();
    const lignes = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    const ligne = lignes[0] as HTMLElement;
    expect(ligne.querySelector("th")).toBeNull();
    expect(ligne.querySelectorAll("td")[1]?.textContent).toMatch(/90\s*%/);
  });

  it("les blocs ne sont pas séparés par un gap en plus de leur margin-bottom", async () => {
    const { container } = await rendre();
    const bloc = container.querySelector(".admin-bloc") as HTMLElement;
    expect(bloc.parentElement?.className ?? "").not.toMatch(/\bgap-/);
  });

  it("distanciel : le bloc d'import du relevé apparaît", async () => {
    donnees.valeur = session("distanciel", 1);
    await rendre();
    expect(screen.getByRole("heading", { name: "Relevé de connexion distanciel" })).toBeTruthy();
    expect(screen.getByTestId("import")).toBeTruthy();
  });

  it("sans stagiaire : état vide, ni grille ni tableau", async () => {
    donnees.valeur = session("presentiel", 0);
    await rendre();
    expect(screen.getByText("Aucun stagiaire inscrit à cette session.")).toBeTruthy();
    expect(screen.queryByTestId("grille")).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
    expect(document.querySelector("svg")).not.toBeNull();
  });

  it("actions identiques : le lien PDF et les composants d'écriture sont toujours montés", async () => {
    await rendre();
    const lien = screen.getByRole("link", { name: /Télécharger la feuille à jour \(PDF\)/ });
    expect(lien.getAttribute("href")).toBe("/api/qualiopi/sessions/s1/emargement");
    for (const t of ["generer", "jours", "liens-comp", "dossier", "grille", "bandeau"]) {
      expect(screen.getByTestId(t)).toBeTruthy();
    }
  });

  it("la page garde ses actions serveur et sa requête telles quelles", () => {
    const src = readFileSync(PAGE, "utf8");
    for (const s of [
      "saveEmargementAction",
      "generateSessionCreneauxAction",
      "importReleveConnexionAction",
      "genererReleveConnexionDocumentAction",
      "getSessionEmargement(id)",
    ]) {
      expect(src).toContain(s);
    }
  });
});

// Garde de vocabulaire : aucune chaîne visible AJOUTÉE ne porte un mot réservé.
const INTERDIT = /qualiopi|opco|financement|prise en charge|certification|cpf/i;
// Chaînes déjà présentes avant la refonte (chemins d'import, titre de métadonnées, aide existante).
const DEJA_PRESENTES = [
  "@/",
  "Qualiopi — Émargement session",
  "Voir le formateur désigné",
  "/qualiopi/",
  "/api/qualiopi/",
];

function chainesVisibles(src: string): string[] {
  const sansCommentaires = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  const out: string[] = [];
  for (const m of sansCommentaires.matchAll(/"([^"\n]*)"|`([^`]*)`/g)) out.push(m[1] ?? m[2] ?? "");
  for (const m of sansCommentaires.matchAll(/>([^<>{}\n]+)</g)) out.push(m[1] ?? "");
  return out;
}

describe("garde de vocabulaire", () => {
  it("aucune chaîne visible ajoutée avec un mot réservé", () => {
    const fautives = chainesVisibles(readFileSync(PAGE, "utf8")).filter(
      (c) => INTERDIT.test(c) && !DEJA_PRESENTES.some((p) => c.includes(p)),
    );
    expect(fautives).toEqual([]);
  });
});
