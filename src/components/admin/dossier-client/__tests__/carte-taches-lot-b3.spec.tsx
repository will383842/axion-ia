// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/dossier-client/fiche/actions-taches", () => ({
  ajouterTacheFormAction: vi.fn(),
  marquerFaiteFormAction: vi.fn(),
  rouvrirTacheFormAction: vi.fn(),
}));
vi.mock("@/features/dossier-client/fiche/taches", async () => {
  const reel = await vi.importActual<typeof import("@/features/dossier-client/fiche/taches")>(
    "@/features/dossier-client/fiche/taches",
  );
  return reel;
});
vi.mock("@/features/dossier-client/message-affichable", () => ({
  MessagePourWill: class extends Error {},
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({ logQualiopiActivity: vi.fn() }));

import { CarteTaches } from "../fiche/CarteTaches";
import { jourDeParis } from "@/features/dossier-client/fiche/taches";

const C = "11111111-1111-4111-8111-111111111111";
const t = (id: string, avantLe: string, over = {}) => ({
  id,
  intitule: `Tâche ${id}`,
  avantLe,
  responsable: "Will",
  faiteLe: null,
  personne: null,
  prestation: null,
  ...over,
});
const rendre = (jour: string, o: Partial<Parameters<typeof CarteTaches>[0]> = {}) =>
  renderToStaticMarkup(
    <CarteTaches
      clientId={C}
      ficheHref="/fr/x/qualiopi/clients/abc"
      jour={jour}
      peutEcrire
      ouvertes={[t("a", "2026-10-30"), t("b", "2026-10-31"), t("c", "2026-11-02")]}
      faites={[]}
      personnes={[{ id: "p1", nom: "Awa" }]}
      prestations={[{ id: "r1", libelle: "P-1 · Atelier" }]}
      {...o}
    />,
  );

afterEach(() => {
  vi.useRealTimers();
});

describe("carte Tâches", () => {
  it("dit En retard / Aujourd'hui / À venir à minuit Paris (horloge figée)", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // 30/10 23 h 00 UTC = 31/10 00 h 00 à Paris (heure d'été finie le 25/10 : UTC+1).
    vi.setSystemTime(new Date("2026-10-30T23:00:00Z"));
    const html = rendre(jourDeParis(new Date()));
    expect(html).toContain("En retard");
    expect(html).toContain("Aujourd&#x27;hui");
    expect(html).toContain("À venir");
    expect(html).toContain("Marquer comme faite");
    expect(html).toContain("Ajouter une tâche");
    expect(html).toContain("Voir toutes les tâches");
    expect(html).toContain("onglet=activite&amp;filtre=taches");
    expect(html).toContain('value="Will"');
  });

  it("3 tâches visibles, le reste est compté", () => {
    const ouvertes = ["a", "b", "c", "d", "e"].map((i) => t(i, "2026-12-01"));
    const html = rendre("2026-10-30", { ouvertes });
    expect(html).toContain("Tâche c");
    expect(html).not.toContain("Tâche d");
    expect(html).toContain("2 autre(s) tâche(s) ouverte(s)");
  });

  it("une tâche faite propose Rouvrir ; un lecteur sans écriture ne voit aucun bouton", () => {
    const faite = t("f", "2026-10-01", { faiteLe: new Date("2026-10-02T10:00:00Z") });
    expect(rendre("2026-10-30", { ouvertes: [], faites: [faite] })).toContain("Rouvrir");
    const lecteur = rendre("2026-10-30", { peutEcrire: false });
    expect(lecteur).not.toContain("Marquer comme faite");
    expect(lecteur).not.toContain("Ajouter une tâche");
  });

  it("aucune tâche : le dit", () => {
    expect(rendre("2026-10-30", { ouvertes: [] })).toContain("Aucune tâche ouverte");
  });
});
