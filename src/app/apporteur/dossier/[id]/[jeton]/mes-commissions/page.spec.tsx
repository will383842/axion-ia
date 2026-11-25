// « Mes commissions » : accès, rendu à liste blanche, vocabulaire sans pression ni compteur.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const h = vi.hoisted(() => ({
  dossier: null as Record<string, unknown> | null,
  vue: null as unknown,
  lire: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useParams: () => ({}),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/features/apporteurs-reseau/donnees", () => ({
  lireDossierParLien: vi.fn(async () => h.dossier),
}));
vi.mock("@/features/apporteurs-reseau/espace-commissions", () => ({
  lireEspaceCommissions: (...a: unknown[]) => {
    h.lire(...a);
    return h.vue;
  },
}));

import { ID_DOSSIER_EXEMPLE } from "@/features/apporteurs-reseau/jeton";

import Page, { metadata } from "./page";
import { TEXTES_COMMISSIONS } from "./textes";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const params = (id = ID) => ({ params: Promise.resolve({ id, jeton: "jeton-valide" }) });
const rendre = async (id = ID) => renderToStaticMarkup(await Page(params(id)));
const texte = (x: string) =>
  x
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ");

const vide = { entreprises: [], horsEntreprise: [], virements: [], pieces: [], tronque: false };
const ligne = (o: object) => ({
  cle: "c0",
  nature: "Formation générale, 1 jour",
  montantCents: 50_000,
  etat: "facturee",
  numeroFacture: "AXI-APP-2026-0014",
  factureLe: new Date("2026-11-18T09:00:00Z"),
  echeanceLe: new Date("2026-12-18T12:00:00Z"),
  verseeLe: null,
  numeroAvoir: null,
  ...o,
});
const riche = {
  entreprises: [
    {
      cle: "e0",
      denomination: "MENUISERIE DURAND",
      presenteeLe: new Date("2026-10-03T08:00:00Z"),
      etat: "reservee",
      reserveeJusquAu: new Date("2026-12-01T12:00:00Z"),
      valideeLe: new Date("2026-10-12T08:00:00Z"),
      commissions: [ligne({})],
    },
    {
      cle: "e1",
      denomination: "CABINET LEROY",
      presenteeLe: new Date("2026-11-08T08:00:00Z"),
      etat: "a_l_etude",
      reserveeJusquAu: null,
      valideeLe: null,
      commissions: [],
    },
  ],
  horsEntreprise: [],
  virements: [
    {
      numero: "AXI-APP-2026-0014",
      factureLe: new Date("2026-11-18T09:00:00Z"),
      echeanceLe: new Date("2026-12-18T12:00:00Z"),
      regime: "assujetti",
      montants: { htCents: 50_000, tvaCents: 10_000, ttcCents: 60_000 },
    },
  ],
  pieces: [
    { numero: "AXI-APP-2026-0014", genre: "facture", le: new Date("2026-11-18T09:00:00Z") },
    { numero: "AXI-APP-2026-0011", genre: "avoir", le: new Date("2026-11-02T09:00:00Z") },
  ],
  tronque: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.APPORTEUR_MES_COMMISSIONS_ENABLED = "true";
  h.dossier = { id: ID, statut: "signe", prenom: "Marie", regimeTva: "assujetti" };
  h.vue = vide;
});

describe("accès", () => {
  it("noindex", () => expect(metadata.robots).toMatchObject({ index: false, follow: false }));

  it.each([
    ["interrupteur éteint", () => delete process.env.APPORTEUR_MES_COMMISSIONS_ENABLED],
    ["lien invalide", () => (h.dossier = null)],
    ["mode restreint", () => (h.dossier = { id: ID, statut: "signe", restreint: true })],
    ["dossier non signé", () => (h.dossier = { id: ID, statut: "dossier_en_cours" })],
  ])("%s : 404", async (_n, regler) => {
    regler();
    await expect(rendre()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(h.lire).not.toHaveBeenCalled();
  });

  it("lien d'exemple : écran d'exemple, jamais un 404, sans lire la base", async () => {
    h.dossier = null;
    const html = await rendre(ID_DOSSIER_EXEMPLE);
    expect(texte(html)).toContain("lien d'exemple");
    expect(h.lire).not.toHaveBeenCalled();
  });

  it("lit l'identifiant du dossier, pas celui de l'adresse", async () => {
    h.dossier = { id: ID, statut: "signe", regimeTva: "assujetti" };
    await rendre("AUTRE-ID-DANS-L-ADRESSE");
    expect(h.lire).toHaveBeenCalledWith({ id: ID, regimeTva: "assujetti" }, expect.any(Date));
  });
});

describe("rendu", () => {
  it("montre l'état de compte, les dates et les téléchargements nommés", async () => {
    h.vue = riche;
    const t = texte(await rendre());
    expect(t).toContain("MENUISERIE DURAND");
    expect(t).toContain("Validée le 12 octobre 2026");
    expect(t).toContain("Réservée jusqu'au 1 décembre 2026");
    expect(t).toContain("Commission : 500,00 € hors taxes");
    expect(t).toContain("échéance indiquée sur la facture : 18 décembre 2026");
    expect(t).toContain("TVA 20 % : 100,00 €");
    expect(t).toContain("Télécharger la facture AXI-APP-2026-0014");
    expect(t).toContain("Télécharger l'avoir AXI-APP-2026-0011");
    expect(t).toContain("À l'étude");
  });

  it("les liens de téléchargement pointent sous l'espace de l'apporteur", async () => {
    h.vue = riche;
    const html = await rendre();
    expect(html).toContain(`/apporteur/dossier/${ID}/jeton-valide/factures/AXI-APP-2026-0014?dl=1`);
  });

  it("états vides : jamais « 0 € »", async () => {
    const t = texte(await rendre());
    expect(t).toContain(TEXTES_COMMISSIONS.aucuneEntreprise);
    expect(t).toContain(TEXTES_COMMISSIONS.aucuneFacture);
    expect(t).not.toMatch(/0,00 €|\b0 €/);
    expect(t).not.toContain("Virement à venir");
  });

  it("ni total, ni compteur, ni formule de pression ni jauge", async () => {
    h.vue = riche;
    const t = texte(await rendre()).toLowerCase();
    for (const m of [
      "total",
      "objectif",
      "challenge",
      "défi",
      "bravo",
      "félicitations",
      "gagnez",
      "potentiel",
      "classement",
      "rang",
      "record",
      "bonus",
      "performance",
      "progression",
      "atteindre",
      "il vous reste",
      "plus que",
      "jours restants",
      "dépêchez",
      "garanti",
      "grenoble",
      "sans discussion",
    ]) {
      expect(t, m).not.toContain(m);
    }
    // Seule occurrence permise : la règle de paiement « au plus tard 30 jours après ce paiement ».
    expect(t.replace("au plus tard 30 jours après ce paiement", "")).not.toMatch(
      /ce mois|\d+ entreprises?\b|\d+ jours/,
    );
    expect(t).not.toMatch(/undefined|\[object/);
  });

  it("régime inconnu : aucun chiffre de virement", async () => {
    h.vue = { ...riche, virements: [{ ...riche.virements[0]!, regime: null, montants: null }] };
    const t = texte(await rendre());
    expect(t).toContain("Montant en vérification");
    expect(t).not.toContain("600,00");
  });

  it("un seul h1 ; une liste vide de pièces ne casse rien", async () => {
    const html = await rendre();
    expect(html.match(/<h1/g)?.length ?? 0).toBeLessThanOrEqual(1);
  });
});
