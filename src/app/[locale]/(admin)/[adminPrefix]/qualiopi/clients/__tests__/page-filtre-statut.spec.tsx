import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  role: "super_admin" as string,
  tous: [] as unknown[],
  partage: { actives: [] as unknown[], archivees: [] as unknown[], lectureImpossible: false },
}));

vi.mock("@/server/auth/garde-page", () => ({
  gardePage: async () => ({ autorise: true, role: h.role }),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/server/qualiopi/crm/clients", () => ({ listClients: async () => h.tous }));
vi.mock("@/features/dossier-client/fiche/archivage-liste", () => ({
  separerLesArchivees: async () => h.partage,
}));
vi.mock("@/components/admin/qualiopi/ClientBrancheForm", () => ({ ClientBrancheForm: () => null }));
// Le composant de suppression de la fiche importe des Server Actions : on ne garde que sa forme fermée.
vi.mock("@/features/dossier-client/actions-suppression", () => ({
  preparerSuppressionAction: async () => {},
  supprimerManuellementAction: async () => {},
}));
vi.mock("@/features/dossier-client/suppression-manuelle", () => ({
  bilanSuppression: async () => null,
  MESSAGE_BLOQUE: "",
  MOT_CONFIRMATION: "EFFACER",
}));

import { SuppressionManuelle } from "@/components/admin/dossier-client/SuppressionManuelle";

import Page from "../page";

type Sp = { q?: string; archives?: string; statut?: string };
const rendre = async (sp: Sp): Promise<string> =>
  renderToStaticMarkup(
    await Page({
      params: Promise.resolve({ locale: "fr", adminPrefix: "admin" }),
      searchParams: Promise.resolve(sp),
    }),
  );

const f = (id: string, nom: string, statut: string) => ({
  id,
  numero: `CLI-${id}`,
  raisonSociale: nom,
  statut,
  type: "entreprise",
});
const FICHES = [
  f("1", "Alpha", "prospect"),
  f("2", "Bravo", "devis_envoye"),
  f("3", "Charlie", "client_actif"),
  f("4", "Delta", "client_inactif"),
  f("5", "Echo", "perdu"),
  f("6", "Foxtrot", "prospect"),
];

const lignes = (html: string): string[] =>
  ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot"].filter((n) =>
    html.includes(`>${n}</a>`),
  );

beforeEach(() => {
  h.role = "super_admin";
  h.tous = FICHES;
  h.partage = { actives: FICHES, archivees: [], lectureImpossible: false };
});

describe("liste des clients : filtre ?statut=", () => {
  it("propose Tous / Prospects / Clients / Perdus avec des compteurs justes, en liens simples", async () => {
    const html = await rendre({});
    expect(html).toContain("Tous (6)");
    expect(html).toContain("Prospects (3)");
    expect(html).toContain("Clients (2)");
    expect(html).toContain("Perdus (1)");
    expect(html).toContain('href="/fr/admin/qualiopi/clients?statut=prospects"');
    expect(html).toContain('href="/fr/admin/qualiopi/clients?statut=clients"');
    expect(html).toContain('href="/fr/admin/qualiopi/clients?statut=perdus"');
  });

  it("prospects = prospect + devis envoyé", async () => {
    expect(lignes(await rendre({ statut: "prospects" }))).toEqual(["Alpha", "Bravo", "Foxtrot"]);
  });

  it("clients = client actif + client inactif", async () => {
    expect(lignes(await rendre({ statut: "clients" }))).toEqual(["Charlie", "Delta"]);
  });

  it("perdus = perdu", async () => {
    expect(lignes(await rendre({ statut: "perdus" }))).toEqual(["Echo"]);
  });

  it("une valeur inconnue retombe sur Tous", async () => {
    expect(lignes(await rendre({ statut: "zzz" })).length).toBe(6);
  });

  it("le filtre marque la vue courante (aria-current) et se combine avec q", async () => {
    const html = await rendre({ statut: "prospects", q: "Acme" });
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('name="statut" value="prospects"');
    expect(html).toContain('href="/fr/admin/qualiopi/clients?statut=clients&amp;q=Acme"');
  });

  it("le filtre se combine avec archives : les liens gardent archives=1", async () => {
    h.partage = {
      actives: [FICHES[0]],
      archivees: [FICHES[2], FICHES[4]],
      lectureImpossible: false,
    };
    const html = await rendre({ archives: "1", statut: "clients" });
    expect(lignes(html)).toEqual(["Charlie"]);
    expect(html).toContain("Tous (2)");
    expect(html).toContain('href="/fr/admin/qualiopi/clients?archives=1&amp;statut=perdus"');
  });

  it("un filtre sans résultat le dit, sans afficher « Aucun client enregistré »", async () => {
    h.partage = { actives: [FICHES[0]], archivees: [], lectureImpossible: false };
    const html = await rendre({ statut: "perdus" });
    expect(html).toContain("Aucune fiche dans cette vue");
    expect(html).not.toContain("Aucun client enregistré");
  });
});

describe("liste des clients : lien « Supprimer » (super-administrateur seul)", () => {
  it("le super-administrateur voit un lien par ligne vers l'écran de confirmation de la fiche", async () => {
    const html = await rendre({});
    for (const id of ["1", "2", "3", "4", "5", "6"]) {
      expect(html).toContain(
        `href="/fr/admin/qualiopi/clients/${id}?supprimer=client#suppression-client"`,
      );
    }
  });

  it("le lien est exactement celui que la fiche propose pour ouvrir son écran de confirmation", async () => {
    const dansLaFiche = renderToStaticMarkup(
      SuppressionManuelle({
        type: "client",
        id: "1",
        peutSupprimer: true,
        page: "/fr/admin/qualiopi/clients/1",
        ouvert: false,
      }) as React.ReactElement,
    );
    const m = /data-ouvrir-suppression="client"/.exec(dansLaFiche);
    expect(m).not.toBeNull();
    const href = /href="([^"]+)"/.exec(dansLaFiche)?.[1];
    expect(href).toBe("/fr/admin/qualiopi/clients/1?supprimer=client#suppression-client");
    expect(await rendre({})).toContain(`href="${href}"`);
  });

  it.each(["admin", "reader", "editor", "inconnu"])(
    "un %s non super-administrateur ne voit aucun lien Supprimer",
    async (role) => {
      h.role = role;
      const html = await rendre({});
      expect(html).not.toContain("supprimer=client");
      expect(html).not.toContain("Supprimer");
    },
  );
});
