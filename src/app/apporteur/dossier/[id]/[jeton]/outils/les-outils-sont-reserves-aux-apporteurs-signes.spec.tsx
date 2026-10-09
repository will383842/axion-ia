// Les outils de communication ne s'ouvrent qu'à un apporteur SOUS CONTRAT SIGNÉ, par son lien
// personnel : le contrat (art. 22 bis) n'autorise la communication qu'à partir de là. Sinon, un
// message sobre, pas de 404 ; et la page n'est jamais indexée.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ dossier: null as Record<string, unknown> | null }));
vi.mock("server-only", () => ({}));
vi.mock("@/features/apporteurs-reseau/donnees", () => ({
  lireDossierParLien: vi.fn(async () => h.dossier),
}));

import { ID_DOSSIER_EXEMPLE } from "@/features/apporteurs-reseau/jeton";
import { OUTILS_RESERVES } from "@/features/apporteurs-reseau/outils-communication";

import Page, { metadata } from "./page";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const params = (id = ID) => ({ params: Promise.resolve({ id, jeton: "jeton-valide" }) });
const texte = (x: string) =>
  x
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ");

const signe = { id: ID, prenom: "Marie", nom: "Dupont", restreint: false, statut: "signe" };

beforeEach(() => {
  h.dossier = { ...signe };
});

describe("accès", () => {
  it("noindex, nofollow", () => {
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
  });

  const REFUS: ReadonlyArray<readonly [string, () => void, string]> = [
    [
      "lien invalide",
      (): void => {
        h.dossier = null;
      },
      ID,
    ],
    [
      "dossier pas encore signé",
      (): void => {
        h.dossier = { ...signe, statut: "dossier_en_cours" };
      },
      ID,
    ],
    [
      "fiche retirée du réseau (mode restreint)",
      (): void => {
        h.dossier = { ...signe, restreint: true };
      },
      ID,
    ],
    ["lien d'exemple de l'aperçu", (): void => undefined, ID_DOSSIER_EXEMPLE],
  ];

  it.each(REFUS)("%s : le message sobre, aucune pièce", async (_c, preparer, id) => {
    preparer();
    const t = texte(renderToStaticMarkup(await Page(params(id))));
    expect(t).toContain(OUTILS_RESERVES.titre);
    expect(t).not.toContain("Tout télécharger");
  });
});

describe("pour un apporteur signé", () => {
  it("les sections, le choix de la mention, le retour à l'espace", async () => {
    const html = renderToStaticMarkup(await Page(params()));
    const t = texte(html);
    expect(t).toContain("Mes outils de communication");
    for (const s of ["À votre nom", "Visuels de publication", "Textes prêts à copier", "Logo"]) {
      expect(t).toContain(s);
    }
    expect(t).toContain("Apporteuse d'affaires indépendante");
    expect(t).toContain("Marie Dupont");
    expect(html).toContain(`/apporteur/dossier/${ID}/jeton-valide`);
    expect(html).toContain("/documents/apporteurs/charte-de-marque/index.html");
  });
});
