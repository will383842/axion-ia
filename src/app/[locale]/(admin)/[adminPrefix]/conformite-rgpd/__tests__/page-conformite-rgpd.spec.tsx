/**
 * La page Conformité RGPD : refus nommé sans rôle reconnu, état vide sans registre,
 * message (et pas de plantage) sans stockage privé, bouton d'import réservé aux
 * administrateurs, pastilles d'état, reprise du lot 1, gestes sur les écarts,
 * incidents et compte à rebours. VRAIE page, VRAIE `gardePage` ; session et
 * lectures (base, R2) doublées. Registre et incidents FICTIFS.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LectureBase, TraitementBase } from "@/features/conformite-rgpd/base";
import type { Incident } from "@/features/conformite-rgpd/incidents-base";

const d = vi.hoisted(() => ({
  session: null as unknown,
  lecture: { etat: "ok", traitements: [], archives: [], importeLe: null } as unknown,
  r2: true,
  aReprendre: false,
  incidents: [] as unknown[] | null,
}));

vi.mock("@/auth", () => ({ auth: () => Promise.resolve(d.session) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/features/conformite-rgpd/actions", () => ({
  importerRegistreAction: vi.fn(),
  reprendreRegistreAction: vi.fn(),
}));
vi.mock("@/features/conformite-rgpd/actions-ecarts", () => ({
  marquerEcartCorrigeAction: vi.fn(),
  rouvrirEcartAction: vi.fn(),
}));
vi.mock("@/components/admin/conformite-rgpd/FormulaireIncident", () => ({
  FormulaireIncident: () => "FORMULAIRE-INCIDENT",
}));
vi.mock("@/features/conformite-rgpd/stockage", () => ({
  stockageConfigure: () => d.r2,
  registreARecuperer: async () => d.aReprendre,
}));
vi.mock("@/features/conformite-rgpd/base", async (orig) => ({
  ...(await orig<typeof import("@/features/conformite-rgpd/base")>()),
  lireRegistreBase: async () => d.lecture,
}));
vi.mock("@/features/conformite-rgpd/incidents-base", () => ({
  listerIncidents: async () => d.incidents,
}));
vi.mock("@/features/conformite-rgpd/demandes", () => ({
  LIBELLE_ORIGINE: { stagiaire: "Portail stagiaire", libre_service: "Site" },
  listerDemandes: async () => [],
}));

import Page from "../page";

async function rendre(searchParams: Record<string, string> = {}): Promise<string> {
  const el = await Page({
    params: Promise.resolve({ locale: "fr", adminPrefix: "adm" }),
    searchParams: Promise.resolve(searchParams),
  });
  return renderToStaticMarkup(el);
}

function ecart(
  id: string,
  gravite: "critique" | "faible",
  statut: "ouvert" | "corrige",
): TraitementBase["ecarts"][number] {
  return {
    id,
    code: id,
    gravite,
    constat: `Constat ${id}`,
    correction: null,
    statut,
    corrigeLe: statut === "corrige" ? new Date("2000-01-02T00:00:00Z") : null,
    corrigeParNom: statut === "corrige" ? "Admin Exemple" : null,
    note: null,
  };
}

function traitement(id: string, nom: string, ecarts: TraitementBase["ecarts"]): TraitementBase {
  return {
    uuid: `00000000-0000-4000-8000-00000000000${id.length}`,
    id,
    nom,
    statut: "actif",
    personnes: [],
    donnees: [],
    finalite: null,
    baseLegale: null,
    conservationAnnoncee: null,
    conservationReelle: null,
    destinataires: [],
    securite: null,
    droits: null,
    ecarts,
  };
}

function registre(): LectureBase {
  return {
    etat: "ok",
    traitements: [
      traitement("activite-a", "Activité A", [ecart("e-corrige", "faible", "corrige")]),
      traitement("activite-b", "Activité B", [ecart("e-ouvert", "critique", "ouvert")]),
    ],
    archives: [],
    importeLe: null,
  };
}

function incident(heuresDepuis: number, extra: Partial<Incident> = {}): Incident {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    numero: 1,
    decouvertLe: new Date(Date.now() - heuresDepuis * 3600_000),
    survenuLe: null,
    description: "Description fictive",
    donneesConcernees: null,
    nombrePersonnes: null,
    categoriesPersonnes: null,
    consequences: null,
    mesuresPrises: null,
    declareCnil: null,
    declareCnilLe: null,
    motifNonDeclaration: null,
    personnesPrevenues: null,
    personnesPrevenuesLe: null,
    motifNonInformation: null,
    statut: "ouvert",
    closLe: null,
    creeParNom: "Admin Exemple",
    creeLe: new Date(),
    ...extra,
  };
}

beforeEach(() => {
  d.session = { user: { id: "u", role: "admin" } };
  d.lecture = { etat: "ok", traitements: [], archives: [], importeLe: null };
  d.r2 = true;
  d.aReprendre = false;
  d.incidents = [];
});

describe("Conformité RGPD — la page", () => {
  it("sans session : renvoie vers la connexion", async () => {
    d.session = null;
    await expect(rendre()).rejects.toThrow("NEXT_REDIRECT /fr/adm/login");
  });

  it("sans rôle reconnu : refus nommé, aucune donnée", async () => {
    d.session = { user: { id: "u", role: "inconnu" } };
    const html = await rendre();
    expect(html).toContain("rôle reconnu");
    expect(html).not.toContain("Activités au registre");
  });

  it("sans registre : l'état vide dit où trouver le fichier", async () => {
    const html = await rendre();
    expect(html).toContain("Aucun registre importé.");
    expect(html).toContain(
      "Importez le fichier registre.json rangé dans le Drive (04 · Administratif &amp; Juridique › RGPD — Site Axion-IA).",
    );
    expect(html).not.toContain("Télécharger le registre (PDF)");
  });

  it("stockage privé absent : un message, pas de plantage, pas d'import", async () => {
    d.r2 = false;
    const html = await rendre();
    expect(html).toContain("stockage privé n&#x27;est pas configuré");
    expect(html).not.toContain("Mettre à jour le registre");
  });

  it("le bouton d'import est réservé aux administrateurs", async () => {
    expect(await rendre()).toContain("Mettre à jour le registre");
    d.session = { user: { id: "u", role: "secretaire" } };
    expect(await rendre()).not.toContain("Mettre à jour le registre");
  });

  it("registre importé : une ligne par activité, pastille selon la gravité, PDF proposé", async () => {
    d.lecture = registre();
    const html = await rendre();
    expect(html).toContain("/fr/adm/conformite-rgpd/activite-a");
    expect(html).toContain("À jour");
    expect(html).toContain("Critique");
    expect(html).toContain("Télécharger le registre (PDF)");
  });

  it("base vide + registre dans R2 : propose « Reprendre le registre déjà importé » aux administrateurs", async () => {
    d.aReprendre = true;
    expect(await rendre()).toContain("Reprendre le registre déjà importé");
    d.session = { user: { id: "u", role: "secretaire" } };
    expect(await rendre()).not.toContain("Reprendre le registre déjà importé");
  });

  it("base déjà remplie : pas de reprise proposée", async () => {
    d.lecture = registre();
    d.aReprendre = true;
    expect(await rendre()).not.toContain("Reprendre le registre déjà importé");
  });

  it("points à corriger : « Marquer corrigé » pour l'administrateur, les corrigés dans leur sous-onglet", async () => {
    d.lecture = registre();
    const ouverts = await rendre({ onglet: "points" });
    expect(ouverts).toContain("Constat e-ouvert");
    expect(ouverts).not.toContain("Constat e-corrige");
    expect(ouverts).toContain("Marquer corrigé");
    expect(ouverts).toContain("Corrigés (1)");
    const corriges = await rendre({ onglet: "points", vue: "corriges" });
    expect(corriges).toContain("Constat e-corrige");
    expect(corriges).toContain("Rouvrir");
    expect(corriges).toContain("Admin Exemple");
  });

  it("points à corriger : aucun bouton pour un rôle de consultation", async () => {
    d.lecture = registre();
    d.session = { user: { id: "u", role: "secretaire" } };
    const html = await rendre({ onglet: "points" });
    expect(html).toContain("Constat e-ouvert");
    expect(html).not.toContain("Marquer corrigé");
  });

  it("onglet Incidents : la procédure et le lien vers la CNIL", async () => {
    const html = await rendre({ onglet: "incidents" });
    expect(html).toContain("Avant 72 h");
    expect(html).toContain("https://notifications.cnil.fr/");
    expect(html).toContain("Aucun incident déclaré.");
  });

  it("incidents : compte à rebours rouge une fois les 72 h passées, indicateur en haut", async () => {
    d.incidents = [incident(80)];
    const html = await rendre({ onglet: "incidents" });
    expect(html).toContain("Délai CNIL dépassé de 8 h");
    expect(html).toContain("Incidents ouverts");
    expect(html).toContain("Journal des incidents (PDF)");
    expect(html).toContain("Déclarer un incident");
    // La liste ne montre pas les textes saisis.
    expect(html).not.toContain("Description fictive");
  });

  it("incidents : « Déclarer » ouvre le formulaire, administrateurs seulement", async () => {
    expect(await rendre({ onglet: "incidents", nouveau: "1" })).toContain("FORMULAIRE-INCIDENT");
    d.session = { user: { id: "u", role: "secretaire" } };
    const html = await rendre({ onglet: "incidents", nouveau: "1" });
    expect(html).not.toContain("FORMULAIRE-INCIDENT");
    expect(html).not.toContain("Journal des incidents (PDF)");
  });
});
