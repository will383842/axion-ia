/**
 * Lot L15c — l'encadré « Formateurs proches » de la fiche client (W6 D-W6-1).
 *
 * Rendu de la VRAIE page, avec la VRAIE `gardePage` (seule la session est
 * doublée) :
 *   · hors des rôles qui habilitent un formateur (super_admin, admin,
 *     responsable_qualite), RIEN n'est requêté : ni l'interrupteur, ni les
 *     formateurs ;
 *   · interrupteur `formateurs.proches_bloc` absent ou coupé : aucun encadré,
 *     aucune lecture des formateurs (comportement d'avant le lot) ;
 *   · allumé : l'encadré s'affiche ; une panne affiche « indisponible ».
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  session: null as unknown,
  allume: false,
  envoiAllume: vi.fn(),
  lireFormateursProches: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: () => Promise.resolve(d.session) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/server/qualiopi/crm/clients", async (orig) => {
  const { FICHE_360 } = await import("./_fiche-client-rendu");
  return {
    ...(await orig<typeof import("@/server/qualiopi/crm/clients")>()),
    getClient360: () => Promise.resolve(FICHE_360),
  };
});
vi.mock("@/features/dossier-client/queries", () => ({
  lireFaitsDuClient: vi.fn(async () => []),
  lireProjetsDuClient: vi.fn(async () => []),
  lireFaitsARanger: vi.fn(async () => []),
  lireRencontresDuClient: vi.fn(async () => []),
  lirePersonnesDuClient: vi.fn(async () => []),
}));
vi.mock("@/features/dossier-client/actions", () => ({
  ajouterPersonneFormAction: vi.fn(),
  basculerOppositionIaFormAction: vi.fn(),
  creerProjetFormAction: vi.fn(),
  garderCetteValeurFormAction: vi.fn(),
  confirmerSirenFormAction: vi.fn(),
}));
vi.mock("@/server/actions/qualiopi/clients", () => ({
  updateClientAction: vi.fn(),
  rafraichirEffectifInseeFormAction: vi.fn(),
}));
vi.mock("@/server/qualiopi/formateurs-independants/interrupteurs-envoi", () => ({
  envoiAllume: (...a: unknown[]) => d.envoiAllume(...a),
}));
vi.mock("@/server/qualiopi/formateurs-proches/formateurs-proches-service", () => ({
  lireFormateursProches: (...a: unknown[]) => d.lireFormateursProches(...a),
}));

import Page from "@/app/[locale]/(admin)/[adminPrefix]/qualiopi/clients/[id]/page";
import { rendreFiche } from "./_fiche-client-rendu";

const RESULTAT = {
  depart: {
    sorte: "lieu",
    point: { lat: 46.2, lon: 5.2, departement: "01" },
    libelle: "Bourg-en-Bresse (01) — adresse de la fiche client",
  },
  approximatif: false,
  groupes: [
    {
      cle: "meme_departement",
      formateurs: [
        {
          id: "00000000-0000-4000-8000-000000000001",
          nom: "Camille Test",
          statut: "sous_traitant",
          point: { lat: 46, lon: 5.3, departement: "01" },
          commune: "Ambérieu-en-Bugey (01)",
          regionsIntervention: [],
          franceEntiere: false,
          distanceKm: 28,
          intervientDansLaRegion: false,
          stats: { formationsRealisees: 3, satisfaction: null, derniereFormation: null },
        },
      ],
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  d.envoiAllume.mockImplementation(async () => d.allume);
  d.lireFormateursProches.mockResolvedValue(RESULTAT);
});

describe("encadré « Formateurs proches »", () => {
  it.each(["editor", "reader", "secretaire"])(
    "rôle « %s » : ni l'interrupteur ni les formateurs ne sont requêtés",
    async (role) => {
      d.session = { user: { id: "u1", role } };
      d.allume = true;
      const html = await rendreFiche(Page, undefined);
      expect(d.envoiAllume).not.toHaveBeenCalled();
      expect(d.lireFormateursProches).not.toHaveBeenCalled();
      expect(html).not.toContain("Formateurs proches");
    },
  );

  it.each(["super_admin", "admin", "responsable_qualite"])(
    "rôle « %s », interrupteur absent : aucun encadré, aucune lecture",
    async (role) => {
      d.session = { user: { id: "u1", role } };
      d.allume = false;
      const html = await rendreFiche(Page, undefined);
      expect(d.envoiAllume).toHaveBeenCalledWith("proches_bloc");
      expect(d.lireFormateursProches).not.toHaveBeenCalled();
      expect(html).not.toContain("Formateurs proches");
    },
  );

  it.each(["super_admin", "admin", "responsable_qualite"])(
    "rôle « %s », interrupteur allumé : l'encadré liste le formateur avec sa distance",
    async (role) => {
      d.session = { user: { id: "u1", role } };
      d.allume = true;
      const html = await rendreFiche(Page, undefined);
      expect(html).toContain("Formateurs proches");
      expect(html).toContain("Camille Test");
      expect(html).toContain("28 km");
      expect(html).toContain("Même département");
      expect(html).toContain("moins de 5 avis");
    },
  );

  it("panne de lecture : « indisponible », jamais « aucun formateur »", async () => {
    d.session = { user: { id: "u1", role: "admin" } };
    d.allume = true;
    d.lireFormateursProches.mockResolvedValue(null);
    const html = await rendreFiche(Page, undefined);
    expect(html).toContain("Encadré indisponible");
    expect(html).not.toContain("Aucun formateur actif");
  });
});

// Lot 1 fiche client : le bloc « Questionnaire avant audit » lit la base ; ces specs ne la touchent pas.
vi.mock("@/features/dossier-client/questionnaires-de-la-fiche", () => ({
  lireQuestionnairesDeLaFiche: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/features/dossier-client/fil-des-echanges", () => ({
  lireFilDesEchanges: vi.fn().mockResolvedValue([]),
}));
