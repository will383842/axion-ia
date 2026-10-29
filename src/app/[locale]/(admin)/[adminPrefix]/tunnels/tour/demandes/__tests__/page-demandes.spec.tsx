/**
 * La page « Demandes du Tour France IA » : la vue montre les trois statuts, les villes, le filtre
 * par ville et les boutons de l'équipe, et n'offre AUCUN bouton de suppression ; la page vérifie le
 * droit AVANT de lire quoi que ce soit. Données FICTIVES.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DemandeConsole, LigneVilleConsole } from "@/features/tour-de-france/lectures";

const d = vi.hoisted(() => ({
  garde: { autorise: false, role: null, motif: "Rôle insuffisant pour ces demandes." } as unknown,
  lireDemandesConsole: vi.fn(async (_filtre?: unknown) => ({
    demandes: [],
    tronquee: false,
    rapprochementIndisponible: false,
  })),
  compteurParVille: vi.fn(async () => []),
}));

vi.mock("@/features/tour-de-france/statuts", () => ({
  marquerRelancee: vi.fn(),
  ecarter: vi.fn(),
  remettreRecue: vi.fn(),
  creerFicheProspect: vi.fn(),
  completerFiche: vi.fn(),
}));
vi.mock("@/features/admin-calendly/acces", () => ({
  gardeLectureAppels: async () => d.garde,
}));
vi.mock("@/features/tour-de-france/lectures", () => ({
  lireDemandesConsole: d.lireDemandesConsole,
  compteurParVille: d.compteurParVille,
}));

import { VueDemandesTour } from "../../../_components/VueDemandesTour";
import Page from "../page";

const demande = (id: string, extra: Partial<DemandeConsole> = {}): DemandeConsole => ({
  id,
  nom: `Personne ${id}`,
  email: `${id}@exemple.fr`,
  telephone: "0612345678",
  telephoneVisio: null,
  villeCle: "lyon",
  ville: "Lyon",
  creeLe: new Date("2026-10-27T10:00:00Z"),
  statut: "recue",
  rattachement: "sans_fiche",
  clientId: null,
  fichesProches: [],
  compte: true,
  doublon: false,
  depuis: null,
  ...extra,
});

const villes: LigneVilleConsole[] = [
  { villeCle: "lyon", ville: "Lyon", demandes: 3, comptees: 3 },
  { villeCle: "annecy", ville: "Annecy", demandes: 1, comptees: 1 },
];

function rendre(over: Partial<Parameters<typeof VueDemandesTour>[0]> = {}): string {
  return renderToStaticMarkup(
    <VueDemandesTour
      adminPrefix="adm"
      liste={{
        demandes: [
          demande("a", { statut: "rdv_pris" }),
          demande("b", { statut: "relancee_main" }),
          demande("c"),
        ],
        tronquee: false,
        rapprochementIndisponible: false,
      }}
      villes={villes}
      filtreVille={null}
      filtreStatut={null}
      ok={null}
      erreur={null}
      {...over}
    />,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("vue : les demandes", () => {
  it("montre les trois statuts, les deux villes et le compteur par ville", () => {
    const html = rendre();
    expect(html).toContain("Rendez-vous pris");
    expect(html).toContain("Relancée à la main");
    expect(html).toContain("Demande reçue");
    expect(html).toContain("Lyon");
    expect(html).toContain("Annecy");
    expect(html).toContain("3 comptées sur 3 demandes");
  });

  it("affiche le téléphone saisi, sinon celui de la visio, sinon « à la visio »", () => {
    const seul = (extra: Partial<DemandeConsole>) =>
      rendre({
        liste: {
          demandes: [demande("z", extra)],
          tronquee: false,
          rapprochementIndisponible: false,
        },
      });
    expect(seul({})).toContain("0612345678");
    const visio = seul({ telephone: "", telephoneVisio: "+33611223344" });
    expect(visio).toContain("+33611223344 (visio)");
    expect(seul({ telephone: "", telephoneVisio: null })).toContain("Téléphone : à la visio");
    expect(rendre()).toContain("Une par personne et par entreprise, dans chaque ville");
  });

  it("le filtre par ville est un lien vers la page filtrée", () => {
    const html = rendre();
    expect(html).toContain("/fr/adm/tunnels/tour/demandes?ville=lyon");
    const filtre = rendre({ filtreVille: "lyon" });
    expect(filtre).toContain("Toutes les villes");
  });

  it("propose « J'ai relancé », « Écarter » et « Créer la fiche prospect »", () => {
    const html = rendre();
    expect(html).toContain("J&#x27;ai relancé");
    expect(html).toContain("Écarter");
    expect(html).toContain("Créer la fiche prospect");
  });

  it("n'offre AUCUN bouton de suppression", () => {
    const html = rendre().toLowerCase();
    expect(html).not.toContain("supprimer");
    expect(html).not.toContain("effacer");
    expect(html).not.toContain("delete");
  });

  it("une demande effacée à la demande de la personne n'a aucun geste", () => {
    const html = rendre({
      liste: {
        demandes: [demande("x", { statut: "effacee_rgpd", nom: "[effacé]" })],
        tronquee: false,
        rapprochementIndisponible: false,
      },
    });
    expect(html).toContain("Aucun geste possible");
    expect(html).not.toContain("Écarter");
  });

  it("dit quand le rapprochement avec les rendez-vous est indisponible", () => {
    const html = rendre({
      liste: { demandes: [], tronquee: false, rapprochementIndisponible: true },
    });
    expect(html).toContain("indisponible");
  });

  it("montre les fiches proches d'une demande à arbitrer, avec un lien vers chacune", () => {
    const html = rendre({
      liste: {
        demandes: [
          demande("z", {
            rattachement: "a_arbitrer",
            fichesProches: [
              {
                ficheId: "f1",
                numero: "C-12",
                raisonSociale: "Société Exemple",
                signal: "nom_ville",
              },
            ],
          }),
        ],
        tronquee: false,
        rapprochementIndisponible: false,
      },
    });
    expect(html).toContain("/fr/adm/qualiopi/clients/f1");
    expect(html).toContain("même nom dans la même ville");
  });

  it("propose « Compléter la fiche » sur chaque fiche proche d'une demande à arbitrer", () => {
    const proches = [
      { ficheId: "f1", numero: "C-12", raisonSociale: "Société Exemple", signal: "email" },
      { ficheId: "f2", numero: "C-13", raisonSociale: "Autre Société", signal: "telephone" },
    ] as const;
    const html = rendre({
      liste: {
        demandes: [demande("z", { rattachement: "a_arbitrer", fichesProches: proches })],
        tronquee: false,
        rapprochementIndisponible: false,
      },
    });
    expect(html.match(/Compléter la fiche/g)).toHaveLength(3);
    expect(html).toContain('name="ficheId" value="f1"');
    expect(html).toContain('name="ficheId" value="f2"');
    expect(html).toContain("ne remplit que ce qui est vide");
  });

  it("pas de « Compléter la fiche » pour une demande écartée, effacée ou déjà rattachée", () => {
    const proches = [
      { ficheId: "f1", numero: "C-12", raisonSociale: "Société Exemple", signal: "email" },
    ] as const;
    for (const extra of [
      { statut: "ecartee" },
      { statut: "effacee_rgpd" },
      { clientId: "f9" },
    ] as const) {
      const html = rendre({
        liste: {
          demandes: [
            demande("z", { rattachement: "a_arbitrer", fichesProches: proches, ...extra }),
          ],
          tronquee: false,
          rapprochementIndisponible: false,
        },
      });
      expect(html, JSON.stringify(extra)).not.toContain("Compléter la fiche");
    }
  });

  it("aucun mot interdit de la landing dans les textes de la console", () => {
    const html = rendre().toLowerCase();
    for (const mot of [
      "grenoble",
      "candidat",
      "réserv",
      "inscri",
      "devis",
      "garanti",
      "obligatoire",
    ]) {
      expect(html, mot).not.toContain(mot);
    }
  });
});

describe("page : la garde passe avant toute lecture", () => {
  it("sans droit : l'écran de refus, et la base n'est pas lue", async () => {
    const html = renderToStaticMarkup(
      await Page({
        params: Promise.resolve({ adminPrefix: "adm" }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(html).toContain("Rôle insuffisant pour ces demandes.");
    expect(d.lireDemandesConsole).not.toHaveBeenCalled();
    expect(d.compteurParVille).not.toHaveBeenCalled();
  });

  it("affiche le message d'un code connu, et RIEN pour un texte forgé dans l'adresse", async () => {
    d.garde = { autorise: true, role: "ADMIN" };
    const connu = renderToStaticMarkup(
      await Page({
        params: Promise.resolve({ adminPrefix: "adm" }),
        searchParams: Promise.resolve({ ok: "ecartee", erreur: "demande_inconnue" }),
      }),
    );
    expect(connu).toContain("Demande écartée.");
    expect(connu).toContain("Demande inconnue.");
    const forge = renderToStaticMarkup(
      await Page({
        params: Promise.resolve({ adminPrefix: "adm" }),
        searchParams: Promise.resolve({
          ok: "Votre compte est suspendu, appelez le 0102030405",
          erreur: "<b>texte choisi par un tiers</b>",
        }),
      }),
    );
    expect(forge).not.toContain("suspendu");
    expect(forge).not.toContain("texte choisi par un tiers");
    expect(forge).not.toContain('role="alert"');
    expect(forge).not.toContain('role="status"');
  });

  it("avec droit : lit les demandes avec le filtre de l'adresse", async () => {
    d.garde = { autorise: true, role: "ADMIN" };
    renderToStaticMarkup(
      await Page({
        params: Promise.resolve({ adminPrefix: "adm" }),
        searchParams: Promise.resolve({ ville: "lyon", statut: "recue" }),
      }),
    );
    expect(d.lireDemandesConsole).toHaveBeenCalledWith({ ville: "lyon", statut: "recue" });
  });
});
