/**
 * Fiche E17b — `/qualiopi/devis/new` monte l'assistant selon l'interrupteur `devis_assistant`.
 *
 * Mutations qui font rougir ces tests (essayées à la main) :
 *   - lire l'interrupteur par `assistantDevisActif` (booléen) au lieu de l'état brut → « essai +
 *     fiche d'essai » rougit ;
 *   - monter l'assistant sans regarder la fiche d'essai → « essai + vraie fiche » rougit ;
 *   - rediriger un devis à formules vers /modifier → la carte rougit (et boucle) ;
 *   - retirer le `redirect` vers /corriger → « devis classique » rougit ;
 *   - ne pas passer `clientId` au chargeur → « clientId » rougit.
 */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  garde: vi.fn(),
  etat: vi.fn(),
  auth: vi.fn(),
  charger: vi.fn(),
  devis: vi.fn(),
  listClients: vi.fn(),
  listOffres: vi.fn(),
  formules: vi.fn(),
  aide: vi.fn(),
  assistant: vi.fn(),
}));

class Redirection extends Error {
  constructor(public readonly cible: string) {
    super(`REDIRECT:${cible}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (c: string) => {
    throw new Redirection(c);
  },
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/auth", () => ({ auth: m.auth }));
vi.mock("@/server/auth/garde-page", () => ({ gardePage: m.garde }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    devis: { findUnique: m.devis },
    devisTexteBibliotheque: { findMany: vi.fn(async () => []) },
  },
}));
vi.mock("@/server/qualiopi/socle/interrupteurs", () => ({ lireInterrupteurQualiopi: m.etat }));
vi.mock("@/server/qualiopi/devis/assistant/charger", () => ({ chargerAssistantDevis: m.charger }));
vi.mock("@/server/qualiopi/crm/clients", () => ({ listClients: m.listClients }));
vi.mock("@/server/qualiopi/offres/offres", () => ({ listOffres: m.listOffres }));
vi.mock("@/server/qualiopi/devis/interrupteur-formules", () => ({ formulesActives: m.formules }));
vi.mock("@/features/dossier-client/aide-du-projet", () => ({ chargerAideDuProjet: m.aide }));
vi.mock("@/components/admin/qualiopi/DevisForm", () => ({
  DevisForm: () => <div data-testid="devis-form" />,
}));
vi.mock("@/components/admin/qualiopi/assistant-devis/AssistantDevisDiffere", () => ({
  AssistantDevisDiffere: (p: unknown) => {
    m.assistant(p);
    return <div data-testid="assistant" />;
  },
}));

import Page from "../new/page";
import { payloadVide } from "@/server/qualiopi/devis/assistant/payload";

const CLIENT_ESSAI = "11111111-1111-4111-8111-111111111111";
const CLIENT_REEL = "22222222-2222-4222-8222-222222222222";
const DEVIS = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const BROUILLON = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const RENCONTRE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const clientOpt = (id: string, ficheEssai: boolean) => ({
  id,
  numero: id.slice(0, 4),
  raisonSociale: `Client ${id.slice(0, 4)}`,
  type: "entreprise" as const,
  adresse: null,
  contactNom: null,
  email: null,
  salutation: "Bonjour,",
  ficheEssai,
});

function contexte(over: Record<string, unknown> = {}) {
  return {
    brouillon: null,
    payloadInitial: payloadVide(20),
    clients: [clientOpt(CLIENT_ESSAI, true), clientOpt(CLIENT_REEL, false)],
    offres: [],
    textesParDefaut: [],
    bibliotheque: {
      avantages: { A: [], B: [] },
      aSavoir: { A: [], B: [] },
      delais: "",
      garantie: "",
      plafond: "",
    },
    formulesActives: true,
    regimeTva: "assujetti",
    tauxStandard: 20,
    aide: null,
    rencontreId: null,
    ...over,
  };
}

const args = (sp: Record<string, string> = {}) => ({
  params: Promise.resolve({ locale: "fr" as const, adminPrefix: "adm" }),
  searchParams: Promise.resolve(sp),
});
async function rendre(sp: Record<string, string> = {}) {
  render(await Page(args(sp)));
}
async function cible(sp: Record<string, string> = {}) {
  try {
    await Page(args(sp));
  } catch (e) {
    return e instanceof Redirection ? e.cible : `ERR:${(e as Error).message}`;
  }
  return null;
}

beforeEach(() => {
  vi.clearAllMocks();
  m.garde.mockResolvedValue({ autorise: true, role: "admin", peutEcrire: true });
  m.etat.mockResolvedValue("actif");
  m.auth.mockResolvedValue({ user: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } });
  m.charger.mockResolvedValue(contexte());
  m.devis.mockResolvedValue(null);
  m.listClients.mockResolvedValue([]);
  m.listOffres.mockResolvedValue([]);
  m.formules.mockResolvedValue(false);
  m.aide.mockResolvedValue({ projetId: null, aide: null });
});

describe("interrupteur", () => {
  it("éteint : DevisForm, le chargeur de l'assistant n'est pas appelé", async () => {
    m.etat.mockResolvedValue("eteint");
    await rendre();
    expect(screen.getByTestId("devis-form")).toBeTruthy();
    expect(m.charger).not.toHaveBeenCalled();
    expect(m.auth).not.toHaveBeenCalled();
  });

  it("actif : l'assistant, avec tous les clients et les valeurs de la page", async () => {
    await rendre();
    expect(screen.getByTestId("assistant")).toBeTruthy();
    const p = m.assistant.mock.calls[0]![0] as Record<string, unknown>;
    expect((p["clients"] as unknown[]).length).toBe(2);
    expect(p["formulesActives"]).toBe(true);
    expect(p["versionCgv"]).toMatch(/\d{4}/);
    expect(p["aujourdhui"]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(p["validiteParDefaut"]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const ecart =
      (Date.parse(p["validiteParDefaut"] as string) - Date.parse(p["aujourdhui"] as string)) /
      86_400_000;
    expect(ecart).toBe(30);
  });

  it("essai + fiche d'essai : l'assistant, avec les seules fiches d'essai", async () => {
    m.etat.mockResolvedValue("essai");
    m.charger.mockResolvedValue(
      contexte({ payloadInitial: { ...payloadVide(20), clientId: CLIENT_ESSAI } }),
    );
    await rendre({ clientId: CLIENT_ESSAI });
    expect(screen.getByTestId("assistant")).toBeTruthy();
    const p = m.assistant.mock.calls[0]![0] as { clients: { id: string }[] };
    expect(p.clients.map((c) => c.id)).toEqual([CLIENT_ESSAI]);
  });

  it("essai + vraie fiche : DevisForm", async () => {
    m.etat.mockResolvedValue("essai");
    m.charger.mockResolvedValue(
      contexte({ payloadInitial: { ...payloadVide(20), clientId: CLIENT_REEL } }),
    );
    await rendre({ clientId: CLIENT_REEL });
    expect(screen.getByTestId("devis-form")).toBeTruthy();
    expect(screen.queryByTestId("assistant")).toBeNull();
  });
});

describe("paramètres", () => {
  it("clientId inconnu et rencontreId qui n'est pas un UUID : transmis au chargeur ; pas de lien Rendez-vous", async () => {
    await rendre({ clientId: "99999999-9999-4999-8999-999999999999", rencontreId: "pas-un-uuid" });
    expect(m.charger).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "99999999-9999-4999-8999-999999999999",
        rencontreId: "pas-un-uuid",
      }),
    );
    expect(screen.queryByRole("link", { name: /Rendez-vous/ })).toBeNull();
    // Que le chargeur ignore un clientId inconnu se vérifie sur le VRAI chargeur
    // (`charger.spec.ts`, « clientId retenu seulement s'il existe ») : ici il est simulé.
  });

  it("rencontreId valide : lien de retour", async () => {
    await rendre({ rencontreId: RENCONTRE });
    expect(screen.getByRole("link", { name: /Rendez-vous/ }).getAttribute("href")).toBe(
      `/fr/adm/rendez-vous/rencontres/${RENCONTRE}`,
    );
  });

  it("?brouillon= : transmis au chargeur avec l'administrateur de la session", async () => {
    m.charger.mockResolvedValue(contexte({ brouillon: { id: BROUILLON, revision: 3 } }));
    await rendre({ brouillon: BROUILLON });
    expect(m.charger).toHaveBeenCalledWith(
      expect.objectContaining({
        brouillonId: BROUILLON,
        adminId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      }),
    );
    expect((m.assistant.mock.calls[0]![0] as { brouillon: unknown }).brouillon).toEqual({
      id: BROUILLON,
      revision: 3,
    });
  });

  it("sans session : redirection vers la connexion", async () => {
    m.auth.mockResolvedValue(null);
    expect(await cible()).toBe("/fr/adm/login");
  });
});

describe("redirections du chargeur", () => {
  it("sans message : redirect (préfixe ajouté)", async () => {
    m.charger.mockResolvedValue({ redirection: `/qualiopi/devis/${DEVIS}` });
    expect(await cible({ devis: DEVIS })).toBe(`/fr/adm/qualiopi/devis/${DEVIS}`);
  });

  it("avec message : une carte avec le message et un lien, aucune redirection", async () => {
    m.charger.mockResolvedValue({
      redirection: `/qualiopi/devis/${DEVIS}`,
      message: "Ce devis ne s'ouvre pas ici.",
    });
    await rendre({ devis: DEVIS });
    expect(screen.getByText("Ce devis ne s'ouvre pas ici.")).toBeTruthy();
    expect(screen.getByRole("link", { name: /fiche du devis/ }).getAttribute("href")).toBe(
      `/fr/adm/qualiopi/devis/${DEVIS}`,
    );
    expect(screen.queryByTestId("assistant")).toBeNull();
  });
});

describe("?devis= sans brouillon d'assistant", () => {
  const ctxDevis = () =>
    contexte({
      payloadInitial: {
        ...payloadVide(20),
        sync: { devisId: DEVIS, devisMajLe: "2026-11-08T10:00:00.000Z" },
      },
    });

  it("devis classique (sans offre) : redirigé vers /corriger", async () => {
    m.charger.mockResolvedValue(ctxDevis());
    m.devis.mockResolvedValue({ id: DEVIS, offre: null });
    expect(await cible({ devis: DEVIS })).toBe(`/fr/adm/qualiopi/devis/${DEVIS}/corriger`);
  });

  it("devis à formules : la carte « créé avant l'assistant », lien vers la fiche, jamais /modifier", async () => {
    m.charger.mockResolvedValue(ctxDevis());
    m.devis.mockResolvedValue({ id: DEVIS, offre: { version: 1 } });
    expect(await cible({ devis: DEVIS })).toBeNull();
    await rendre({ devis: DEVIS });
    expect(screen.getByText(/créé avant l'assistant : il ne s'ouvre pas encore ici/)).toBeTruthy();
    const href = screen.getByRole("link", { name: /fiche du devis/ }).getAttribute("href");
    expect(href).toBe(`/fr/adm/qualiopi/devis/${DEVIS}`);
    expect(href).not.toContain("modifier");
    expect(screen.queryByTestId("assistant")).toBeNull();
  });

  it("devis avec brouillon d'assistant : l'assistant s'ouvre, ni carte ni redirection", async () => {
    m.charger.mockResolvedValue({ ...ctxDevis(), brouillon: { id: BROUILLON, revision: 2 } });
    await rendre({ devis: DEVIS });
    expect(screen.getByTestId("assistant")).toBeTruthy();
    expect(m.devis).not.toHaveBeenCalled();
  });
});

describe("?devis= invalide ou inconnu (jamais une page 500)", () => {
  it.each([["abc"], [""]])(
    "?devis=%j : ignoré, ni requête devis ni erreur, assistant vide",
    async (v) => {
      expect(await cible({ devis: v })).toBeNull();
      await rendre({ devis: v });
      expect(m.devis).not.toHaveBeenCalled();
      expect(m.charger.mock.calls.every(([a]) => !("devisId" in a))).toBe(true);
      expect(screen.getByTestId("assistant")).toBeTruthy();
      expect((m.assistant.mock.calls.at(-1)![0] as { devisId?: string }).devisId).toBeUndefined();
    },
  );

  it("UUID valide mais inconnu : « Devis introuvable », aucun lien mort vers une fiche", async () => {
    m.charger.mockResolvedValue(
      contexte({
        payloadInitial: {
          ...payloadVide(20),
          sync: { devisId: null, devisMajLe: null },
        },
      }),
    );
    m.devis.mockResolvedValue(null);
    await rendre({ devis: DEVIS });
    expect(screen.getByText("Devis introuvable.")).toBeTruthy();
    expect(screen.queryByText(/créé avant l'assistant/)).toBeNull();
    expect(screen.queryByTestId("assistant")).toBeNull();
    for (const a of screen.getAllByRole("link"))
      expect(a.getAttribute("href")).not.toContain(DEVIS);
  });
});

describe("Nouvelle vente : nom du paramètre", () => {
  it("?venteBrouillonId= est transmis au chargeur", async () => {
    await rendre({ venteBrouillonId: BROUILLON });
    expect(m.charger).toHaveBeenCalledWith(
      expect.objectContaining({ venteBrouillonId: BROUILLON }),
    );
  });

  it("?vente= (ancien nom) reste lu en repli", async () => {
    await rendre({ vente: BROUILLON });
    expect(m.charger).toHaveBeenCalledWith(
      expect.objectContaining({ venteBrouillonId: BROUILLON }),
    );
  });
});

describe("mode essai", () => {
  it("l'assistant reçoit modeEssai (pas de création de fiche) ; actif : non", async () => {
    m.etat.mockResolvedValue("essai");
    m.charger.mockResolvedValue(
      contexte({ payloadInitial: { ...payloadVide(20), clientId: CLIENT_ESSAI } }),
    );
    await rendre({ clientId: CLIENT_ESSAI });
    expect((m.assistant.mock.calls.at(-1)![0] as { modeEssai: boolean }).modeEssai).toBe(true);
  });
});
