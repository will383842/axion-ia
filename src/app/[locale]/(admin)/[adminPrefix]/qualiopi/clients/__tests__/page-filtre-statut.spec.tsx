import { readFileSync } from "node:fs";
import path from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Fiche {
  id: string;
  numero: string;
  raisonSociale: string;
  statut: string;
  type: string;
}

const h = vi.hoisted(() => ({
  role: "super_admin" as string,
  tous: [] as Fiche[],
  /** Ids des fiches archivées : le mock de `separerLesArchivees` en tire ses deux listes. */
  archivees: new Set<string>(),
  recherches: [] as Array<string | undefined>,
}));

vi.mock("@/server/auth/garde-page", () => ({
  gardePage: async () => ({ autorise: true, role: h.role }),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
// Le mock RESPECTE ses arguments : la recherche `q` filtre vraiment, et l'archivage sépare vraiment.
vi.mock("@/server/qualiopi/crm/clients", () => ({
  listClients: async (opts?: { recherche?: string }) => {
    h.recherches.push(opts?.recherche);
    const r = (opts?.recherche ?? "").toLowerCase();
    return h.tous.filter((f) => r === "" || f.raisonSociale.toLowerCase().includes(r));
  },
}));
vi.mock("@/features/dossier-client/fiche/archivage-liste", () => ({
  separerLesArchivees: async (_p: unknown, fiches: Fiche[]) => ({
    actives: fiches.filter((f) => !h.archivees.has(f.id)),
    archivees: fiches.filter((f) => h.archivees.has(f.id)),
    lectureImpossible: false,
  }),
}));
vi.mock("@/components/admin/qualiopi/ClientBrancheForm", () => ({ ClientBrancheForm: () => null }));
// Le composant de suppression de la fiche importe des Server Actions : on les neutralise.
vi.mock("@/features/dossier-client/actions-suppression", () => ({
  preparerSuppressionAction: async () => {},
  supprimerManuellementAction: async () => {},
}));
vi.mock("@/features/dossier-client/suppression-manuelle", () => ({
  bilanSuppression: async () => ({
    type: "client",
    id: "1",
    nom: "Alpha",
    email: null,
    code: "CLI-1",
    compteurs: [{ libelle: "fiche client", n: 1 }],
    bloquants: [],
  }),
  MESSAGE_BLOQUE: "",
  MOT_CONFIRMATION: "EFFACER",
}));

import { SuppressionManuelle } from "@/components/admin/dossier-client/SuppressionManuelle";
import { avecMessageDeRetour } from "@/features/dossier-client/message-de-retour";

import Page from "../page";

type Sp = {
  q?: string;
  archives?: string;
  statut?: string;
  message?: string;
  sceau?: string;
};
const rendre = async (sp: Sp): Promise<string> =>
  renderToStaticMarkup(
    await Page({
      params: Promise.resolve({ locale: "fr", adminPrefix: "admin" }),
      searchParams: Promise.resolve(sp),
    }),
  );

const f = (id: string, nom: string, statut: string): Fiche => ({
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
const NOMS = FICHES.map((x) => x.raisonSociale);

const lignes = (html: string): string[] => NOMS.filter((n) => html.includes(`>${n}</a>`));
/** La valeur affichée par la carte de compteur dont le libellé est `label`. */
const carte = (html: string, label: string): number | null => {
  const i = html.indexOf(`>${label}<`);
  if (i < 0) return null;
  const m = />(\d+)</.exec(html.slice(i + label.length));
  return m ? Number(m[1]) : null;
};
const BASE = "/fr/admin/qualiopi/clients";

beforeEach(() => {
  h.role = "super_admin";
  h.tous = FICHES;
  h.archivees = new Set();
  h.recherches = [];
});

describe("liste des clients : filtre ?statut=", () => {
  it("propose Tous / Prospects / Clients / Perdus avec des compteurs justes, en liens simples", async () => {
    const html = await rendre({});
    expect(html).toContain("Tous (6)");
    expect(html).toContain("Prospects (3)");
    expect(html).toContain("Clients (2)");
    expect(html).toContain("Perdus (1)");
    expect(html).toContain(`href="${BASE}?statut=prospects"`);
    expect(html).toContain(`href="${BASE}?statut=clients"`);
    expect(html).toContain(`href="${BASE}?statut=perdus"`);
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

  it("aria-current est porté par le SEUL lien de la vue courante", async () => {
    const html = await rendre({ statut: "prospects" });
    const courants = [...html.matchAll(/<a [^>]*aria-current="page"[^>]*>([^<]*)<\/a>/g)].map(
      (m) => m[1],
    );
    expect(courants).toEqual(["Prospects (3)"]);
    const sansFiltre = await rendre({});
    expect([...sansFiltre.matchAll(/aria-current="page"[^>]*>([^<]*)</g)].map((m) => m[1])).toEqual(
      ["Tous (6)"],
    );
  });

  it("se combine avec q : les lignes affichées sont celles de q ET du statut", async () => {
    // « a » : Alpha, Bravo, Charlie, Delta (ni Echo ni Foxtrot).
    const html = await rendre({ q: "a", statut: "prospects" });
    expect(h.recherches).toContain("a");
    expect(lignes(html)).toEqual(["Alpha", "Bravo"]);
    expect(html).toContain("2 résultats pour « a ».");
    // Les compteurs du filtre portent sur la recherche : « a » donne 4 fiches, dont 2 clientes.
    expect(html).toContain("Tous (4)");
    expect(html).toContain("Clients (2)");
    expect(html).toContain("Perdus (0)");
    expect(html).toContain('name="statut" value="prospects"');
    expect(html).toContain(`href="${BASE}?statut=clients&amp;q=a"`);
  });

  it("q + statut sans ligne : « Aucune fiche dans cette vue », jamais « N résultats » en même temps", async () => {
    const html = await rendre({ q: "a", statut: "perdus" });
    expect(lignes(html)).toEqual([]);
    expect(html).toContain("Aucune fiche dans cette vue");
    expect(html).not.toMatch(/résultats? pour/);
    expect(html).not.toContain("Aucun client enregistré");
  });

  it("« N résultats » compte les lignes affichées, pas la recherche seule", async () => {
    const html = await rendre({ q: "a", statut: "clients" });
    expect(lignes(html)).toEqual(["Charlie", "Delta"]);
    expect(html).toContain("2 résultats pour « a ».");
  });

  it("l'encodage de q est conservé dans les liens (espace, &, accent)", async () => {
    h.tous = [f("9", "Café & Cie", "prospect")];
    const html = await rendre({ q: "Café & Cie", statut: "prospects" });
    expect(html).toContain(`href="${BASE}?statut=clients&amp;q=Caf%C3%A9+%26+Cie"`);
  });

  it("un filtre sans résultat le dit, sans afficher « Aucun client enregistré »", async () => {
    h.tous = [FICHES[0]!];
    const html = await rendre({ statut: "perdus" });
    expect(html).toContain("Aucune fiche dans cette vue");
    expect(html).not.toContain("Aucun client enregistré");
  });

  it("garde le statut sur « Effacer »", async () => {
    const html = await rendre({ q: "a", statut: "clients" });
    expect(html).toMatch(new RegExp(`href="${BASE}\\?statut=clients"[^>]*>Effacer<`));
  });
});

describe("liste des clients : filtre et archives", () => {
  beforeEach(() => {
    h.archivees = new Set(["3", "5"]); // Charlie (client) et Echo (perdu)
  });

  it("« Voir les archivées (N) » annonce les lignes obtenues avec le filtre courant, et garde statut", async () => {
    expect(await rendre({})).toContain("Voir les archivées (2)");
    const clients = await rendre({ statut: "clients" });
    expect(clients).toContain("Voir les archivées (1)");
    expect(clients).toContain(`href="${BASE}?archives=1&amp;statut=clients"`);
    expect(await rendre({ statut: "prospects" })).toContain("Voir les archivées (0)");
  });

  it("la vue archives filtrée liste N lignes et « Fiches archivées (N) » dit N", async () => {
    const html = await rendre({ archives: "1", statut: "clients" });
    expect(lignes(html)).toEqual(["Charlie"]);
    expect(html).toContain("Fiches archivées (1).");
    expect(html).toContain("Tous (2)");
    expect(html).toContain(`href="${BASE}?archives=1&amp;statut=perdus"`);
    const perdus = await rendre({ archives: "1", statut: "perdus" });
    expect(lignes(perdus)).toEqual(["Echo"]);
    expect(perdus).toContain("Fiches archivées (1).");
  });

  it("garde le statut sur « Revenir aux clients »", async () => {
    const html = await rendre({ archives: "1", statut: "clients", q: "a" });
    expect(html).toMatch(
      new RegExp(`href="${BASE}\\?statut=clients&amp;q=a"[^>]*>Revenir aux clients<`),
    );
  });

  it("garde le statut sur « Voir les archivées » de la recherche sans résultat actif", async () => {
    // « Charlie » n'existe que parmi les archivées.
    const html = await rendre({ q: "Charlie", statut: "clients" });
    expect(html).toContain(
      "Aucune fiche active ne correspond à « Charlie » ; 1 fiche archivée correspond.",
    );
    expect(html).toMatch(
      new RegExp(
        `href="${BASE}\\?archives=1&amp;statut=clients&amp;q=Charlie"[^>]*>Voir les archivées<`,
      ),
    );
  });
});

describe("liste des clients : cartes de compteur", () => {
  it("sans filtre : Total 6, Prospects sans devis 2, Devis 1, Clients actifs 1", async () => {
    const html = await rendre({});
    expect(carte(html, "Total")).toBe(6);
    expect(carte(html, "Prospects sans devis")).toBe(2);
    expect(carte(html, "Devis envoyés")).toBe(1);
    expect(carte(html, "Clients actifs")).toBe(1);
  });

  it("avec ?statut=perdus : les cartes suivent la ligne affichée, et le disent", async () => {
    const html = await rendre({ statut: "perdus" });
    expect(lignes(html)).toEqual(["Echo"]);
    expect(carte(html, "Total · Perdus")).toBe(1);
    expect(carte(html, "Prospects sans devis")).toBe(0);
    expect(carte(html, "Clients actifs")).toBe(0);
  });

  it("avec ?statut=prospects : Total = 3, et la carte ne se confond plus avec le filtre « Prospects »", async () => {
    const html = await rendre({ statut: "prospects" });
    expect(carte(html, "Total · Prospects")).toBe(3);
    expect(carte(html, "Prospects sans devis")).toBe(2);
    expect(carte(html, "Devis envoyés")).toBe(1);
    expect(html).not.toContain(">Prospects<");
  });
});

describe("liste des clients : confirmation après suppression (?message= scellé)", () => {
  const scelle = (texte: string): Sp => {
    const u = new URL(avecMessageDeRetour("http://x/l", "message", texte));
    return { message: u.searchParams.get("message")!, sceau: u.searchParams.get("sceau")! };
  };

  it("affiche un message scellé par nos actions", async () => {
    const html = await rendre(scelle("Supprimé : 1 fiche client."));
    expect(html).toContain("Supprimé : 1 fiche client.");
    expect(html).toContain('role="status"');
  });

  it("n'affiche ni un message forgé, ni un message sans sceau", async () => {
    expect(await rendre({ message: "Supprimé : tout.", sceau: "faux" })).not.toContain(
      "Supprimé : tout.",
    );
    expect(await rendre({ message: "Supprimé : tout." })).not.toContain("Supprimé : tout.");
  });

  it("n'injecte jamais de HTML : le texte est échappé", async () => {
    const html = await rendre(scelle("<img src=x onerror=alert(1)>"));
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("borne la longueur à 300 caractères", async () => {
    const html = await rendre(scelle("x".repeat(500)));
    expect(html).toContain("x".repeat(300));
    expect(html).not.toContain("x".repeat(301));
  });
});

describe("liste des clients : lien « Supprimer » (super-administrateur seul)", () => {
  it("le super-administrateur voit un lien par ligne vers l'écran de confirmation de la fiche", async () => {
    const html = await rendre({});
    for (const id of ["1", "2", "3", "4", "5", "6"]) {
      expect(html).toContain(`href="${BASE}/${id}?supprimer=client#suppression-client"`);
    }
  });

  it("le lien est exactement celui que la fiche propose pour ouvrir son écran de confirmation", async () => {
    const dansLaFiche = renderToStaticMarkup(
      SuppressionManuelle({
        type: "client",
        id: "1",
        peutSupprimer: true,
        page: `${BASE}/1`,
        ouvert: false,
      }) as ReactElement,
    );
    expect(dansLaFiche).toContain('data-ouvrir-suppression="client"');
    const href = /href="([^"]+)"/.exec(dansLaFiche)?.[1];
    expect(href).toBe(`${BASE}/1?supprimer=client#suppression-client`);
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

describe("fiche : écran de confirmation ouvert par ce lien", () => {
  // L'écran ouvert est un composant ASYNCHRONE : on l'appelle puis on rend son résultat.
  const ecranOuvert = async (peutSupprimer: boolean): Promise<string> => {
    const el = SuppressionManuelle({
      type: "client",
      id: "1",
      peutSupprimer,
      page: `${BASE}/1`,
      ouvert: true,
    }) as ReactElement<Record<string, unknown>> | null;
    if (el === null) return "";
    const fonction = el.type as (p: unknown) => Promise<ReactElement>;
    return renderToStaticMarkup(await fonction(el.props));
  };

  it("ouvert pour un super-administrateur : l'écran de confirmation avec le mot EFFACER", async () => {
    const html = await ecranOuvert(true);
    expect(html).toContain('data-bloc="suppression-client"');
    expect(html).toContain("EFFACER");
  });

  it("pour un autre rôle : rien du tout", async () => {
    expect(await ecranOuvert(false)).toBe("");
  });

  it("la fiche ouvre cet écran sur ?supprimer=client, pour le super-administrateur seul (garde de source)", () => {
    // Rendre la page fiche entière coûte trop (20 imports serveur) : on verrouille le branchement.
    const source = readFileSync(path.join(__dirname, "..", "[id]", "page.tsx"), "utf8");
    expect(source).toMatch(/peutSupprimer=\{acces\.role === "super_admin"\}/);
    expect(source).toMatch(/ouvert=\{sp\.supprimer === "client"\}/);
  });
});
