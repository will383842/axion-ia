/**
 * La page Conformité RGPD : refus nommé sans rôle reconnu, état vide sans registre,
 * message (et pas de plantage) sans stockage privé, bouton d'import réservé aux
 * administrateurs, pastilles d'état. VRAIE page, VRAIE `gardePage` ; session et
 * lectures doublées. Registre FICTIF.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LectureRegistre } from "@/features/conformite-rgpd/stockage";

const d = vi.hoisted(() => ({
  session: null as unknown,
  lecture: { etat: "absent" } as unknown,
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
vi.mock("@/features/conformite-rgpd/actions", () => ({ importerRegistreAction: vi.fn() }));
vi.mock("@/features/conformite-rgpd/stockage", () => ({
  lireRegistre: async () => d.lecture,
}));
vi.mock("@/features/conformite-rgpd/demandes", () => ({
  LIBELLE_ORIGINE: { stagiaire: "Portail stagiaire", libre_service: "Site" },
  listerDemandes: async () => [],
}));

import Page from "../page";
import { validerRegistre } from "@/features/conformite-rgpd/schema";

async function rendre(searchParams: Record<string, string> = {}): Promise<string> {
  const el = await Page({
    params: Promise.resolve({ locale: "fr", adminPrefix: "adm" }),
    searchParams: Promise.resolve(searchParams),
  });
  return renderToStaticMarkup(el);
}

function registre(): LectureRegistre {
  const r = validerRegistre({
    traitements: [
      { id: "activite-a", nom: "Activité A" },
      { id: "activite-b", nom: "Activité B", ecarts: [{ gravite: "critique" }] },
    ],
  });
  if (!r.ok) throw new Error(r.erreur);
  return { etat: "ok", registre: r.registre, importeLe: null };
}

beforeEach(() => {
  d.session = { user: { id: "u", role: "admin" } };
  d.lecture = { etat: "absent" };
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
    d.lecture = { etat: "non_configure" };
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

  it("onglet Incidents : la procédure et le lien vers la CNIL", async () => {
    const html = await rendre({ onglet: "incidents" });
    expect(html).toContain("Avant 72 h");
    expect(html).toContain("https://notifications.cnil.fr/");
    expect(html).toContain("Aucun incident déclaré.");
  });
});
