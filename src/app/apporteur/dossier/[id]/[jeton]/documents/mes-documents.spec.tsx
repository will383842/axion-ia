// « Mes documents » : la page de l'espace qui réunit ce qui a été remis à l'apporteur. Même
// contrôle du lien que les pages sœurs ; le contrat, la charte et les outils seulement sous
// contrat signé ; le livret seulement si lireLivret() rend un fichier ; jamais indexée.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  dossier: null as Record<string, unknown> | null,
  livret: false,
  appelsLivret: 0,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/features/apporteurs-reseau/donnees", () => ({
  lireDossierParLien: vi.fn(async () => h.dossier),
}));
vi.mock("@/features/apporteurs-reseau/documents-prives", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/apporteurs-reseau/documents-prives")>()),
  lireLivret: vi.fn(async () => {
    h.appelsLivret += 1;
    return h.livret ? Buffer.from("%PDF-livret") : null;
  }),
}));

import {
  DOCUMENTS_NON_SIGNE,
  DOCUMENTS_RESERVES,
} from "@/features/apporteurs-reseau/documents-remis";
import { ID_DOSSIER_EXEMPLE } from "@/features/apporteurs-reseau/jeton";

import Page, { metadata } from "./page";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const ESPACE = `/apporteur/dossier/${ID}/jeton-valide`;
const params = (id = ID) => ({ params: Promise.resolve({ id, jeton: "jeton-valide" }) });
const texte = (x: string) =>
  x
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ");
const rendre = async (id = ID) => renderToStaticMarkup(await Page(params(id)));

const signe = {
  id: ID,
  prenom: "Marie",
  nom: "Dupont",
  restreint: false,
  statut: "signe",
  aContratSigne: true,
};

beforeEach(() => {
  h.dossier = { ...signe };
  h.livret = false;
  h.appelsLivret = 0;
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
      "fiche retirée du réseau (mode restreint)",
      (): void => {
        h.dossier = { ...signe, restreint: true };
      },
      ID,
    ],
    [
      "dossier refusé",
      (): void => {
        h.dossier = { ...signe, statut: "refuse" };
      },
      ID,
    ],
    ["lien d'exemple de l'aperçu", (): void => undefined, ID_DOSSIER_EXEMPLE],
  ];

  it.each(REFUS)("%s : le message sobre, aucun document", async (_c, preparer, id) => {
    preparer();
    const html = await rendre(id);
    expect(texte(html)).toContain(DOCUMENTS_RESERVES.titre);
    expect(html).not.toContain(".pdf");
    expect(html).not.toContain("/contrat");
    expect(html).not.toContain("/guide");
    expect(html).not.toContain("/fiche-commissions");
    expect(html).not.toContain("/livret");
  });
});

describe("dossier signé", () => {
  it("le contrat, le guide, la fiche, la charte, les outils et le retour à l'espace", async () => {
    const html = await rendre();
    const t = texte(html);
    expect(html).toMatch(/<h1[^>]*>Mes documents<\/h1>/);
    expect(html).toContain(`href="${ESPACE}/contrat?dl=1"`);
    expect(html).toContain(`href="${ESPACE}/guide"`);
    expect(html).toMatch(new RegExp(`<a href="${ESPACE}/guide\\?dl=1"[^>]* download`));
    expect(html).toContain(`href="${ESPACE}/fiche-commissions"`);
    expect(html).not.toContain("comment-ca-marche");
    expect(html).toContain(`href="${ESPACE}/charte"`);
    expect(html).toContain(`href="${ESPACE}/outils"`);
    expect(html).toContain(`href="${ESPACE}"`);
    expect(t).toContain("Mon contrat signé");
    expect(t).not.toContain(DOCUMENTS_NON_SIGNE);
  });

  it("chaque document est un titre de niveau 2 dans une liste", async () => {
    const html = await rendre();
    expect(html.match(/<h2/g)).toHaveLength(5);
    expect(html.match(/<li/g)).toHaveLength(5);
    expect(html).not.toMatch(/<h[3-6]/);
  });

  it("contrat signé introuvable : pas de ligne contrat", async () => {
    h.dossier = { ...signe, aContratSigne: false };
    const html = await rendre();
    expect(html).not.toContain("/contrat");
    expect(html).toContain(`href="${ESPACE}/outils"`);
  });

  it("le livret n'apparaît que si lireLivret() rend un fichier", async () => {
    expect(await rendre()).not.toContain(`${ESPACE}/livret`);
    expect(h.appelsLivret).toBe(1);
    h.livret = true;
    const html = await rendre();
    expect(html).toContain(`href="${ESPACE}/livret"`);
    expect(html).not.toContain("livret-apporteur.pdf");
    expect(html.match(/<li/g)).toHaveLength(6);
  });

  it("aucun montant ni pourcentage, aucun mot interdit", async () => {
    h.livret = true;
    const t = texte(await rendre());
    expect(t).not.toMatch(/\d\s*(€|%|euros?)/i);
    expect(t).not.toMatch(/gr[e]noble|aucun\s+gain\s+gar[a]nti|conférence|salari[ée]|obj[e]ctif/i);
  });
});

describe("dossier pas encore signé", () => {
  it.each(["dossier_en_cours", "a_completer", "a_verifier"])(
    "%s : le guide et la fiche, et la phrase qui annonce la suite",
    async (statut) => {
      h.dossier = { ...signe, statut, aContratSigne: false };
      const html = await rendre();
      expect(html).toContain(`href="${ESPACE}/guide"`);
      expect(html).toContain(`href="${ESPACE}/fiche-commissions"`);
      expect(html).not.toContain("/contrat");
      expect(html).not.toContain("/charte");
      expect(html).not.toContain("/outils");
      expect(html.match(/<li/g)).toHaveLength(2);
      expect(texte(html)).toContain(DOCUMENTS_NON_SIGNE);
    },
  );
});
