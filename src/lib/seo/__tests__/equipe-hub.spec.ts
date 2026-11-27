import { describe, expect, it } from "vitest";
import { FOUNDER_PERSON_ID } from "@/lib/brand";
import {
  FICHES_HUB_STATIQUES,
  HUB_FAQ,
  HUB_META_DESCRIPTION,
  HUB_META_TITRE,
  HUB_REJOINDRE_TEXTE,
  HUB_REPONSE,
  HUB_TRANSPARENCE_TEXTE,
  HUB_TRAVAIL_ETAPES,
  HUB_TRAVAIL_INTRO,
} from "@/content/equipe/hub";
import { buildEquipeHubJsonLd, HUB_URL } from "@/lib/seo/equipe-hub-jsonld";
import { fichePublique } from "@/lib/equipe";

const TOUS_LES_TEXTES = [
  HUB_REPONSE,
  HUB_META_TITRE,
  HUB_META_DESCRIPTION,
  HUB_TRAVAIL_INTRO,
  HUB_REJOINDRE_TEXTE,
  HUB_TRANSPARENCE_TEXTE,
  ...HUB_TRAVAIL_ETAPES.map((e) => `${e.titre} ${e.texte}`),
  ...HUB_FAQ.map((q) => `${q.question} ${q.answer}`),
].join("\n");

describe("hub /fr/equipe — textes", () => {
  it("réponse de tête : startup française, TPE et PME, partout en France", () => {
    expect(HUB_REPONSE).toBe(
      "Axion-IA est une startup française qui aide les TPE et PME, partout en France, à gagner en rentabilité avec l'équipe qu'elles ont déjà. Fondée par Williams Jullin, elle s'occupe de tout, de A à Z : le dirigeant n'a pas à toucher à la technique.",
    );
  });

  it.each([
    [/agence/i],
    [/freelance/i],
    [/grenobl/i],
    [/€|\beuros?\b|\btarifs?\b|\bprix\b|\bcommissions?\b/i],
    [/\d+\s?%/],
  ])("aucune formulation interdite : %s", (motif) => {
    expect(TOUS_LES_TEXTES).not.toMatch(motif);
  });
});

describe("hub /fr/equipe — fiches", () => {
  it("Williams seul, en Direction, sans ville ni point de carte", () => {
    const fiches = FICHES_HUB_STATIQUES.map((f) => fichePublique(f));
    expect(fiches).toHaveLength(1);
    expect(fiches[0]).toMatchObject({
      slug: "williams",
      categorie: "direction",
      nom: "Williams Jullin",
      afficherSurCarte: false,
    });
    expect(fiches[0]?.ville).toBeUndefined();
  });
});

describe("hub /fr/equipe — JSON-LD", () => {
  const graphe = buildEquipeHubJsonLd([{ slug: "williams", estDirigeantPrincipal: true }]);
  const parType = (t: string) => graphe.find((n) => n["@type"] === t);

  it("CollectionPage, ItemList, BreadcrumbList et FAQPage, sans Person redéfini", () => {
    expect(graphe.map((n) => n["@type"])).toEqual([
      "CollectionPage",
      "ItemList",
      "BreadcrumbList",
      "FAQPage",
    ]);
    expect(graphe.some((n) => n["@type"] === "Person")).toBe(false);
  });

  it("ItemList référence l'@id Person de Williams, inchangé", () => {
    expect(FOUNDER_PERSON_ID.endsWith("/fr/equipe/williams#person")).toBe(true);
    const liste = parType("ItemList") as { itemListElement: Array<{ item: unknown }> };
    expect(liste.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, item: { "@id": FOUNDER_PERSON_ID } },
    ]);
  });

  it("le fil d'Ariane et la collection pointent le même hub", () => {
    const fil = parType("BreadcrumbList") as { "@id": string; itemListElement: unknown[] };
    expect(fil["@id"]).toBe(`${HUB_URL}#breadcrumb`);
    expect(fil.itemListElement).toHaveLength(2);
    expect(parType("CollectionPage")).toMatchObject({
      "@id": `${HUB_URL}#collection`,
      url: HUB_URL,
      breadcrumb: { "@id": `${HUB_URL}#breadcrumb` },
    });
  });

  it("n'inclut dans la liste que les fiches transmises (indexables)", () => {
    const vide = buildEquipeHubJsonLd([]);
    expect((vide[1] as { numberOfItems: number }).numberOfItems).toBe(0);
  });
});
