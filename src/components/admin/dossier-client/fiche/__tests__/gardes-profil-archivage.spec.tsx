// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  lireProfil: vi.fn(),
  lireEtiquettes: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: h.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/features/dossier-client/fiche/profil", () => ({
  lireProfil: h.lireProfil,
  MOTIF_MAX: 200,
  RESPONSABLE_MAX: 80,
}));
vi.mock("@/features/dossier-client/fiche/etiquettes", () => ({
  lireEtiquettes: h.lireEtiquettes,
  ETIQUETTE_MAX: 40,
}));
vi.mock("@/features/dossier-client/fiche/actions-profil", () => ({
  ajouterEtiquetteAction: vi.fn(),
  archiverAction: vi.fn(),
  definirResponsableAction: vi.fn(),
  desarchiverAction: vi.fn(),
  retirerEtiquetteAction: vi.fn(),
  sortirDesArchivesFormAction: vi.fn(),
}));
vi.mock("../FormulaireProfil", () => ({
  FormulaireProfil: (p: { children: React.ReactNode }) => <form>{p.children}</form>,
}));

import { archivageFiche } from "../ArchivageFiche";
import { profilDeLaFiche } from "../ProfilDeLaFiche";

const ID = "11111111-1111-4111-8111-111111111111";
const ARCHIVE = {
  responsable: null,
  archiveLe: new Date("2026-10-01T00:00:00Z"),
  archiveMotif: null,
};
const LIBRE = { responsable: null, archiveLe: null, archiveMotif: null };

const ctx = (role: string, voitEchanges: boolean) =>
  ({ clientId: ID, role, voitEchanges }) as never;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-30T10:00:00Z"));
  h.auth.mockReset();
  h.lireProfil.mockReset().mockResolvedValue(LIBRE);
  h.lireEtiquettes.mockReset().mockResolvedValue([]);
});

describe("ProfilDeLaFiche : gardes", () => {
  it.each([[undefined], ["editor"], ["lecteur"]])(
    "rôle %s : rend null sans rien lire",
    async (role) => {
      h.auth.mockResolvedValue(role === undefined ? null : { user: { role } });
      expect(await profilDeLaFiche(ID)).toBeNull();
      expect(h.lireProfil).not.toHaveBeenCalled();
      expect(h.lireEtiquettes).not.toHaveBeenCalled();
    },
  );

  it("un admin ne voit pas le bloc « Archiver ce client »", async () => {
    h.auth.mockResolvedValue({ user: { role: "admin" } });
    const html = renderToStaticMarkup((await profilDeLaFiche(ID)) as React.ReactElement);
    expect(html).toContain("Responsable du client");
    expect(html).not.toContain("Archiver ce client");
  });

  it("un super-administrateur le voit", async () => {
    h.auth.mockResolvedValue({ user: { role: "super_admin" } });
    const html = renderToStaticMarkup((await profilDeLaFiche(ID)) as React.ReactElement);
    expect(html).toContain("Archiver ce client");
  });
});

describe("ArchivageFiche : gardes", () => {
  it("sans accès aux échanges : null, aucune lecture", async () => {
    expect(await archivageFiche(ctx("admin", false))).toBeNull();
    expect(h.lireProfil).not.toHaveBeenCalled();
  });

  it("« Sortir des archives » est absent pour un admin, présent pour un super-admin", async () => {
    h.lireProfil.mockResolvedValue(ARCHIVE);
    const admin = renderToStaticMarkup((await archivageFiche(ctx("admin", true))) as never);
    expect(admin).toContain("Client archivé");
    expect(admin).not.toContain("Sortir des archives");
    const sup = renderToStaticMarkup((await archivageFiche(ctx("super_admin", true))) as never);
    expect(sup).toContain("Sortir des archives");
  });
});
