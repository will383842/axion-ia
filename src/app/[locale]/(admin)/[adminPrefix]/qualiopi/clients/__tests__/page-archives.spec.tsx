import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  tous: [] as unknown[],
  partage: { actives: [] as unknown[], archivees: [] as unknown[], lectureImpossible: false },
}));

vi.mock("@/server/auth/garde-page", () => ({ gardePage: async () => ({ autorise: true }) }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/server/qualiopi/crm/clients", () => ({ listClients: async () => h.tous }));
vi.mock("@/features/dossier-client/fiche/archivage-liste", () => ({
  separerLesArchivees: async () => h.partage,
}));
vi.mock("@/components/admin/qualiopi/ClientBrancheForm", () => ({ ClientBrancheForm: () => null }));

import Page from "../page";

const rendre = async (sp: { q?: string; archives?: string }): Promise<string> =>
  renderToStaticMarkup(
    await Page({
      params: Promise.resolve({ locale: "fr", adminPrefix: "admin" }),
      searchParams: Promise.resolve(sp),
    }),
  );

const fiche = { id: "c1", raisonSociale: "Acme", statut: "prospect" };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-30T10:00:00Z"));
  h.tous = [];
  h.partage = { actives: [], archivees: [], lectureImpossible: false };
});

describe("liste des clients : fiches archivées", () => {
  it("une recherche qui ne trouve qu'une archivée le dit et n'affiche pas « Aucun client enregistré »", async () => {
    h.tous = [fiche];
    h.partage = { actives: [], archivees: [fiche], lectureImpossible: false };
    const html = await rendre({ q: "Acme" });
    expect(html).toContain(
      "Aucune fiche active ne correspond à « Acme » ; 1 fiche archivée correspond.",
    );
    expect(html).toContain("Voir les archivées");
    expect(html).not.toContain("Aucun client enregistré");
  });

  it("sans aucun client, l'état vide reste proposé", async () => {
    const html = await rendre({});
    expect(html).toContain("Aucun client enregistré");
  });

  it("la vue des archives vide dit « Aucune fiche archivée »", async () => {
    const html = await rendre({ archives: "1" });
    expect(html).toContain("Aucune fiche archivée");
    expect(html).not.toContain("Aucun client enregistré");
  });

  it("la vue des archives libelle le total « hors archivées »", async () => {
    h.tous = [fiche];
    h.partage = { actives: [], archivees: [fiche], lectureImpossible: false };
    expect(await rendre({ archives: "1" })).toContain("Total (hors archivées)");
  });

  it("la vue des archives libelle aussi les cartes de statut « hors archivées »", async () => {
    h.tous = [fiche];
    h.partage = { actives: [], archivees: [fiche], lectureImpossible: false };
    const html = await rendre({ archives: "1" });
    for (const l of ["Prospects", "Devis envoyés", "Clients actifs"]) {
      expect(html).toContain(`${l} (hors archivées)`);
    }
  });

  it("archives illisibles : « lecture impossible », jamais « Aucune fiche archivée »", async () => {
    h.tous = [fiche];
    h.partage = { actives: [fiche], archivees: [], lectureImpossible: true };
    const html = await rendre({ archives: "1" });
    expect(html).toContain("lecture impossible");
    expect(html).not.toContain("Aucune fiche archivée");
  });

  it("vue des archives sans aucune archivée mais avec des clients : « Aucune fiche archivée »", async () => {
    h.tous = [fiche];
    h.partage = { actives: [fiche], archivees: [], lectureImpossible: false };
    const html = await rendre({ archives: "1" });
    expect(html).toContain("Aucune fiche archivée");
  });

  it("recherche dans les archives sans résultat : « Aucune fiche archivée ne correspond »", async () => {
    h.partage = { actives: [], archivees: [], lectureImpossible: false };
    const html = await rendre({ q: "Acme", archives: "1" });
    expect(html).toContain("Aucune fiche archivée ne correspond");
  });

  it("recherche dans des archives illisibles : message de panne et lien de retour, pas d'orthographe", async () => {
    h.tous = [fiche];
    h.partage = { actives: [fiche], archivees: [], lectureImpossible: true };
    const html = await rendre({ q: "Acme", archives: "1" });
    expect(html).toContain("Archives : lecture impossible pour le moment.");
    expect(html).toContain("Revenir aux clients");
    expect(html).not.toContain("Aucune fiche archivée");
    expect(html).not.toContain("Vérifiez l&#x27;orthographe");
    expect(html).not.toContain("Vérifiez l'orthographe");
  });
});
