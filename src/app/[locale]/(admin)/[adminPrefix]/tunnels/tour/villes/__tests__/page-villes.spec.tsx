/**
 * Les pages « Villes » et « Fiche d'une ville » du Tour France IA : la vue montre la jauge « n sur 5 »,
 * les quatre cartes, les réponses de l'étape 2 dans un `<details>`, n'offre AUCUN bouton de
 * suppression et n'emploie aucun mot interdit de la landing ; les pages vérifient le droit AVANT de
 * lire quoi que ce soit, et une ville invalide n'ouvre AUCUNE lecture. Données FICTIVES.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MOTS_INTERDITS } from "@/app/tour-france-ia/__tests__/mots-interdits";
import type { DemandeFiche, FicheVille, VisioTour } from "@/features/tour-de-france/fiche-ville";
import type { LigneVilleConsole } from "@/features/tour-de-france/lectures";

const d = vi.hoisted(() => ({
  garde: { autorise: false, role: null, motif: "Rôle insuffisant pour ces demandes." } as unknown,
  compteurParVille: vi.fn(async () => []),
  lireFicheVille: vi.fn(async (_cle: string) => null as unknown),
}));

vi.mock("@/features/admin-calendly/acces", () => ({
  gardeLectureAppels: async () => d.garde,
}));
vi.mock("@/features/tour-de-france/lectures", () => ({
  compteurParVille: d.compteurParVille,
  lireFicheVille: d.lireFicheVille,
}));

import { VueVilleTour } from "../../../_components/VueVilleTour";
import { VueVillesTour } from "../../../_components/VueVillesTour";
import FichePage from "../fiche/page";
import VillesPage from "../page";

const demande = (id: string, extra: Partial<DemandeFiche> = {}): DemandeFiche => ({
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
  emailHash: `h-${id}`,
  ...extra,
});

const visio = (id: string, extra: Partial<VisioTour> = {}): VisioTour => ({
  id,
  debut: new Date("2026-11-10T09:00:00Z"),
  statut: "prevue",
  profil: {
    secteur: "Commerce",
    entreprise: "Société Exemple",
    origine: "Bouche à oreille",
    taille: "11 à 50",
    taches: "Les devis à la main",
    usageIa: "Aucun",
  },
  efface: false,
  ...extra,
});

const fiche = (extra: Partial<FicheVille> = {}): FicheVille => ({
  villeCle: "lyon",
  ville: "Lyon",
  recues: 3,
  comptees: 3,
  visiosPrises: 1,
  ouverte: false,
  seuil: 5,
  personnes: [
    {
      demande: demande("a", { statut: "rdv_pris", clientId: "f1" }),
      compte: true,
      visio: visio("v1"),
    },
    { demande: demande("b"), compte: true, visio: null },
    {
      demande: demande("x", { statut: "effacee_rgpd", nom: "[effacé]", emailHash: null }),
      compte: true,
      visio: null,
    },
  ],
  visiosSansDemande: [visio("v9")],
  tronquee: false,
  visiosIndisponibles: false,
  ...extra,
});

const villes: LigneVilleConsole[] = [
  { villeCle: "lyon", ville: "Lyon", demandes: 6, comptees: 5 },
  { villeCle: "annecy", ville: "Annecy", demandes: 1, comptees: 1 },
];

function rendreFiche(f: FicheVille | null): string {
  return renderToStaticMarkup(<VueVilleTour adminPrefix="adm" fiche={f} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  d.garde = { autorise: false, role: null, motif: "Rôle insuffisant pour ces demandes." };
});

describe("vue : les villes", () => {
  it("une ligne par ville, la jauge « n sur 5 », « Ville ouverte » à 5 et le lien vers la fiche", () => {
    const html = renderToStaticMarkup(<VueVillesTour adminPrefix="adm" villes={villes} />);
    expect(html).toContain("5 sur 5");
    expect(html).toContain("1 sur 5");
    expect(html.match(/Ville ouverte/g)).toHaveLength(1);
    expect(html).toContain("/fr/adm/tunnels/tour/villes/fiche?ville=lyon");
    expect(html).toContain("/fr/adm/tunnels/tour/villes/fiche?ville=annecy");
  });
});

describe("vue : la fiche d'une ville", () => {
  it("montre les quatre cartes et la jauge", () => {
    const html = rendreFiche(fiche());
    expect(html).toContain("Demandes reçues");
    expect(html).toContain("Comptées (sur 5)");
    expect(html).toContain("3 sur 5");
    expect(html).toContain("Visios prises");
    expect(html).toContain("Ville ouverte");
    expect(html).toContain("pas encore");
    expect(rendreFiche(fiche({ ouverte: true, comptees: 5 }))).toContain("oui");
  });

  it("montre les réponses de l'étape 2 dans un <details>, les liens et la section des visios orphelines", () => {
    const html = rendreFiche(fiche());
    expect(html).toContain("<details>");
    expect(html).toContain("Réponses de l&#x27;étape 2");
    expect(html).toContain("Commerce");
    expect(html).toContain("Société Exemple");
    expect(html).toContain("/fr/adm/qualiopi/clients/f1");
    expect(html).toContain("/fr/adm/contacts/appels/v1");
    expect(html).toContain("Visios sans mini-demande");
    expect(html).toContain("/fr/adm/contacts/appels/v9");
    expect(html).toContain("Pas encore");
  });

  it("une personne effacée : « — » et aucune réponse ; une visio annulée est dite annulée", () => {
    const effacee = rendreFiche(
      fiche({
        personnes: [
          {
            demande: demande("x", { statut: "effacee_rgpd", nom: "[effacé]", emailHash: null }),
            compte: true,
            visio: visio("v1"),
          },
        ],
        visiosSansDemande: [],
      }),
    );
    expect(effacee).toContain("—");
    expect(effacee).not.toContain("Commerce");
    const annulee = rendreFiche(
      fiche({
        personnes: [
          { demande: demande("a"), compte: true, visio: visio("v1", { statut: "annulee" }) },
        ],
        visiosSansDemande: [],
      }),
    );
    expect(annulee).toContain("Annulée");
  });

  it("dit quand la lecture des visios est indisponible, et « Ville inconnue » sans fiche", () => {
    expect(rendreFiche(fiche({ visiosIndisponibles: true }))).toContain("indisponible");
    const inconnue = rendreFiche(null);
    expect(inconnue).toContain("Ville inconnue");
    expect(inconnue).toContain("/fr/adm/tunnels/tour/villes");
  });

  it("n'offre AUCUN bouton de suppression ni aucun formulaire", () => {
    const html = rendreFiche(fiche()).toLowerCase();
    expect(html).not.toContain("supprimer");
    expect(html).not.toContain("effacer");
    expect(html).not.toContain("delete");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("<button");
  });

  it("aucun mot interdit de la landing dans les textes de la console", () => {
    const textes = [
      renderToStaticMarkup(<VueVillesTour adminPrefix="adm" villes={villes} />),
      rendreFiche(fiche({ ouverte: true, visiosIndisponibles: true, tronquee: true })),
      rendreFiche(null),
    ].join(" ");
    // Les réponses de l'invité sont des données, pas des textes de la console : on les écarte.
    const sansDonnees = textes.replace(/Les devis à la main/g, "").replace(/href="[^"]*"/g, "");
    for (const mot of MOTS_INTERDITS) {
      expect(sansDonnees, String(mot)).not.toMatch(mot);
    }
  });
});

describe("pages : la garde passe avant toute lecture", () => {
  it("villes : sans droit, l'écran de refus et aucune lecture", async () => {
    const html = renderToStaticMarkup(
      await VillesPage({ params: Promise.resolve({ adminPrefix: "adm" }) }),
    );
    expect(html).toContain("Rôle insuffisant pour ces demandes.");
    expect(d.compteurParVille).not.toHaveBeenCalled();
  });

  it("fiche : sans droit, l'écran de refus et aucune lecture", async () => {
    const html = renderToStaticMarkup(
      await FichePage({
        params: Promise.resolve({ adminPrefix: "adm" }),
        searchParams: Promise.resolve({ ville: "lyon" }),
      }),
    );
    expect(html).toContain("Rôle insuffisant pour ces demandes.");
    expect(d.lireFicheVille).not.toHaveBeenCalled();
  });

  it("fiche : une ville invalide ou absente affiche « Ville inconnue » sans lire", async () => {
    d.garde = { autorise: true, role: "ADMIN" };
    for (const ville of [undefined, "", "lyon<script>", "a".repeat(101)]) {
      const html = renderToStaticMarkup(
        await FichePage({
          params: Promise.resolve({ adminPrefix: "adm" }),
          searchParams: Promise.resolve({ ville }),
        }),
      );
      expect(html, String(ville)).toContain("Ville inconnue");
    }
    expect(d.lireFicheVille).not.toHaveBeenCalled();
  });

  it("fiche : une ville valide est lue avec sa clé", async () => {
    d.garde = { autorise: true, role: "ADMIN" };
    d.lireFicheVille.mockResolvedValue(fiche());
    const html = renderToStaticMarkup(
      await FichePage({
        params: Promise.resolve({ adminPrefix: "adm" }),
        searchParams: Promise.resolve({ ville: "lyon" }),
      }),
    );
    expect(d.lireFicheVille).toHaveBeenCalledWith("lyon");
    expect(html).toContain("Personne a");
  });
});
