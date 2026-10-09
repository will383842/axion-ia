/** L8b — les onglets de la liste « Candidatures » (maquette v2). */
import { describe, expect, it } from "vitest";

import {
  ONGLETS_CANDIDATURES,
  lireOnglet,
  ongletDeLOffre,
  repartirOffres,
} from "../onglets-candidatures";
import { VIDEO_FREELANCE_OFFER_SLUGS } from "@/lib/careers/video-editor-offer";

describe("onglets", () => {
  it("l'ordre et les libellés de la maquette", () => {
    expect(ONGLETS_CANDIDATURES.map((o) => o.libelle)).toEqual([
      "Monteurs & vidéastes",
      "Formateurs",
      "Autres offres",
      "Spontanées",
      "Par le formulaire de contact",
    ]);
  });

  it("une offre se range dans son onglet", () => {
    expect(ongletDeLOffre(VIDEO_FREELANCE_OFFER_SLUGS[0]!)).toBe("monteurs");
    expect(ongletDeLOffre("formateur-ia-grenoble")).toBe("formateurs");
    expect(ongletDeLOffre("redacteur-web")).toBe("autres");
    expect(ongletDeLOffre(null)).toBe("spontanees");
  });

  it("onglet inconnu → défaut ; un lien ?offerId= sans onglet garde le filtre (onglet de l'offre)", () => {
    expect(lireOnglet(undefined)).toBe("monteurs");
    expect(lireOnglet("n'importe quoi")).toBe("monteurs");
    expect(lireOnglet(undefined, "formateurs")).toBe("formateurs");
    expect(lireOnglet("autres", "formateurs")).toBe("autres");
  });

  it("répartit les offres et leurs volumes par onglet", () => {
    const r = repartirOffres([
      { id: "a", count: 3, slug: VIDEO_FREELANCE_OFFER_SLUGS[0]! },
      { id: "b", count: 2, slug: "formateur-ia" },
      { id: "c", count: 5, slug: "redacteur" },
      { id: "spontanee", count: 1, slug: null },
    ]);
    expect(r.ids.formateurs).toEqual(["b"]);
    expect(r.compte).toMatchObject({ monteurs: 3, formateurs: 2, autres: 5, spontanees: 1 });
  });
});
