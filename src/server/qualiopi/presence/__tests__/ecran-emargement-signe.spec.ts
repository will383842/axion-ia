/**
 * Témoin d'ÉCRAN — `G-prerequis-02` (audit initial 2026-09-14) et revue A09.
 *
 * La colonne « Émargement signé » du récapitulatif de la sous-page Émargement
 * est ce que l'auditrice lit. Ce test REND la page (Server Component) avec des
 * données de présence réalistes et lit la cellule de chaque stagiaire, pour que
 * le défaut se constate là où il se voit, et pas seulement dans un module pur.
 *
 * Quatre cas :
 *   · présences seulement DÉCLARÉES, date posée par l'ancienne grille → jamais « Oui » ;
 *   · une demi-journée signée, cinq déclarées → la répartition, jamais « Oui » ;
 *   · date posée par la grille AVANT la première signature → date de la signature ;
 *   · contre-témoin : tout signé → « Oui — date de la signature ».
 *
 * Les composants clients et les actions sont neutralisés : seule compte la
 * table rendue côté serveur.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("notFound");
  }),
}));
vi.mock("next/link", () => ({ default: (p: { children?: unknown }) => p.children }));
vi.mock("@/components/admin/ui/AdminPageShell", () => ({
  AdminPageShell: (p: { children?: unknown }) => p.children,
}));
vi.mock("@/components/admin/ui/AdminPageHeader", () => ({
  AdminPageHeader: (p: { title: string }) => p.title,
}));
vi.mock("@/components/admin/ui/AdminButton", () => ({
  AdminButton: (p: { children?: unknown }) => p.children,
}));
vi.mock("@/components/admin/ui/AccesRefuse", () => ({ AccesRefuse: () => null }));
vi.mock("@/components/admin/qualiopi/EmargementGrid", () => ({ EmargementGrid: () => null }));
vi.mock("@/components/admin/qualiopi/ImportReleveForm", () => ({ ImportReleveForm: () => null }));
vi.mock("@/components/admin/qualiopi/GenererCreneauxButton", () => ({
  GenererCreneauxButton: () => null,
}));
vi.mock("@/components/admin/qualiopi/SessionJoursEditor", () => ({
  SessionJoursEditor: () => null,
}));
vi.mock("@/components/admin/qualiopi/LiensEmargement", () => ({ LiensEmargement: () => null }));
vi.mock("@/components/admin/qualiopi/DossierSessionButton", () => ({
  DossierSessionButton: () => null,
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
vi.mock("@/server/auth/garde-page", () => ({ gardePage: vi.fn() }));
vi.mock("@/server/qualiopi/config/site-settings", () => ({ getQualiopiConfig: vi.fn() }));
vi.mock("@/server/qualiopi/presence/queries", () => ({ getSessionEmargement: vi.fn() }));

import { gardePage } from "@/server/auth/garde-page";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { getSessionEmargement } from "@/server/qualiopi/presence/queries";
import EmargementPage from "@/app/[locale]/(admin)/[adminPrefix]/qualiopi/sessions/[id]/emargement/page";

const SIGNATURE_REELLE = new Date("2026-09-06T14:47:00Z");

function inscription(id: string, prenom: string, emargementSigneAt: Date | null) {
  return {
    id,
    traineeId: `t-${id}`,
    statut: "presente",
    tauxPresencePct: 100,
    emargementSigneAt,
    trainee: { nom: "Test", prenom, email: `${id}@exemple.test` },
  };
}

function creneau(
  enrollmentId: string,
  jour: number,
  opts: { signeAt?: Date; importId?: string; present?: boolean } = {},
) {
  return {
    id: `${enrollmentId}-${jour}`,
    enrollmentId,
    date: new Date(Date.UTC(2026, 8, jour)),
    demiJournee: "matin",
    libelle: `2026-09-0${jour} matin`,
    dureePrevueMinutes: 210,
    dureeRealiseeMinutes: 210,
    present: opts.present ?? true,
    source: "emargement_presentiel",
    importId: opts.importId ?? null,
    emargementSignatures:
      opts.signeAt !== undefined
        ? [{ id: `sig-${enrollmentId}-${jour}`, signeAt: opts.signeAt }]
        : [],
  };
}

/** Texte de la dernière cellule (« Émargement signé ») de la ligne du stagiaire. */
function celluleEmargement(html: string, prenom: string): string {
  const ligne = html.split("<tr").find((l) => l.includes(`${prenom} `) || l.includes(`${prenom}<`));
  expect(ligne, `ligne du récapitulatif introuvable pour ${prenom}`).toBeDefined();
  const cellules = ligne!.split("<td");
  return cellules[cellules.length - 1]!.replace(/<[^>]+>/g, " ")
    .replace(/^[^>]*>/, "")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function rendre(): Promise<string> {
  const element = await EmargementPage({
    params: Promise.resolve({ locale: "fr", adminPrefix: "admin", id: "ses-1" }),
  });
  return renderToStaticMarkup(element);
}

beforeEach(() => {
  vi.mocked(gardePage).mockResolvedValue({ autorise: true } as never);
  vi.mocked(getQualiopiConfig).mockResolvedValue(80 as never);
  vi.mocked(getSessionEmargement).mockResolvedValue({
    session: {
      id: "ses-1",
      numero: "AXI-SESS-TEST",
      titreSession: "Session de test",
      dateDebut: new Date("2026-09-01T07:00:00Z"),
      dateFin: new Date("2026-09-06T16:00:00Z"),
      dureeReelleHeures: 21,
      modalite: "presentiel",
      statut: "realisee",
      formationId: "f-1",
      nbParticipantsPrevus: 4,
      nbParticipantsReels: 4,
    },
    enrollments: [
      // Grille antérieure au correctif : date posée, rien de signé.
      inscription("a", "Alice", new Date("2026-09-05T10:00:00Z")),
      // Une demi-journée signée, cinq tapées à la main.
      inscription("b", "Bruno", SIGNATURE_REELLE),
      // Date posée par la grille le 01/09, première vraie signature le 06/09.
      inscription("c", "Chloe", new Date("2026-09-01T09:00:00Z")),
      // Contre-témoin : tout signé.
      inscription("d", "Dora", SIGNATURE_REELLE),
    ],
    creneaux: [
      creneau("a", 1),
      creneau("a", 2),
      creneau("b", 1, { signeAt: SIGNATURE_REELLE }),
      creneau("b", 2),
      creneau("b", 3),
      creneau("b", 4),
      creneau("b", 5),
      creneau("b", 6),
      creneau("c", 1, { signeAt: SIGNATURE_REELLE }),
      creneau("c", 2, { signeAt: SIGNATURE_REELLE }),
      creneau("d", 1, { signeAt: SIGNATURE_REELLE }),
    ],
    jours: [],
  } as never);
});

describe("sous-page Émargement — colonne « Émargement signé » (G-prerequis-02)", () => {
  it("🔴 présences seulement DÉCLARÉES, date posée par la grille : l'écran ne dit jamais « Oui »", async () => {
    const cellule = celluleEmargement(await rendre(), "Alice");
    expect(
      cellule.startsWith("Oui"),
      `une présence tapée à la main est affichée comme un émargement signé : « ${cellule} »`,
    ).toBe(false);
    expect(cellule).toContain("sans signature");
  });

  it("🔴 revue A09 §2 — signé et déclaré MÊLÉS : la répartition, jamais « Oui »", async () => {
    const cellule = celluleEmargement(await rendre(), "Bruno");
    expect(
      cellule.startsWith("Oui"),
      `1 créneau signé sur 6 est présenté comme un émargement complet : « ${cellule} »`,
    ).toBe(false);
    expect(cellule).toBe("Partiel — 1 créneau signé, 5 déclarés à la main sans signature");
  });

  it("🔴 revue A09 §3 — date de grille puis signature : la date affichée est celle de la signature", async () => {
    const cellule = celluleEmargement(await rendre(), "Chloe");
    expect(
      cellule,
      "l'écran antidate l'émargement avec la date de saisie de l'ancienne grille",
    ).not.toContain("01/09/2026");
    expect(cellule).toBe("Oui — 06/09/2026");
  });

  it("contre-témoin : un émargement entièrement signé reste « Oui — date »", async () => {
    expect(celluleEmargement(await rendre(), "Dora")).toBe("Oui — 06/09/2026");
  });
});
