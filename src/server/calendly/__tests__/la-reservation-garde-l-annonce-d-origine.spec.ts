// La réservation d'un échange apporteur garde l'ANNONCE d'origine (2026-10-10).
//
// L'identifiant de l'annonce (`utm_content` du lien Facebook) vit sur la fiche ;
// rattachée à une fiche de la page vidéo, la réservation le reprend — quel que
// soit le lien emprunté — sans jamais remplacer une valeur qui n'est pas un
// simple marqueur de bouton.

import { describe, expect, it } from "vitest";
import { attributionDeLaFiche, completerAttribution } from "../attribution-fiche-video";

const FICHE_VIDEO = {
  vsl: { etapeAtteinte: 2 },
  funnel: {
    utm: {
      utm_source: "facebook",
      utm_medium: "paid",
      utm_campaign: "apporteurs-vsl-2026-10",
      utm_content: "ad-42",
    },
  },
};
const VIDE = { utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null };

describe("attributionDeLaFiche", () => {
  it("lit l'attribution d'une fiche vidéo ; rien d'inventé pour une autre", () => {
    expect(attributionDeLaFiche(FICHE_VIDEO)).toEqual({
      ficheVideo: true,
      utmSource: "facebook",
      utmMedium: "paid",
      utmCampaign: "apporteurs-vsl-2026-10",
      utmContent: "ad-42",
    });
    for (const d of [null, "x", [], {}, { funnel: { utm: { utm_content: 12 } } }]) {
      const a = attributionDeLaFiche(d);
      expect(a.ficheVideo).toBe(false);
      expect(a.utmContent).toBeNull();
    }
  });
});

describe("completerAttribution", () => {
  const fiche = attributionDeLaFiche(FICHE_VIDEO);

  it("une réservation sans UTM (lien de l'e-mail B1) reprend toute l'attribution de la fiche", () => {
    expect(completerAttribution(VIDE, fiche)).toEqual({
      ecrire: {
        utmSource: "facebook",
        utmMedium: "paid",
        utmCampaign: "apporteurs-vsl-2026-10",
        utmContent: "ad-42",
      },
      marqueurRemplace: null,
    });
  });

  it("🔴 le marqueur du bouton (`apporteur:vsl-apporteur`) cède la place à l'annonce, et reste connu", () => {
    const r = completerAttribution(
      { ...VIDE, utmSource: "facebook", utmContent: "apporteur:vsl-apporteur" },
      fiche,
    );
    expect(r.ecrire.utmContent).toBe("ad-42");
    expect(r.ecrire).not.toHaveProperty("utmSource");
    expect(r.marqueurRemplace).toBe("apporteur:vsl-apporteur");
  });

  it("un utm_content qui n'est PAS un marqueur n'est jamais remplacé", () => {
    const r = completerAttribution({ ...VIDE, utmContent: "ad-7" }, fiche);
    expect(r.ecrire).not.toHaveProperty("utmContent");
    expect(r.marqueurRemplace).toBeNull();
  });

  it("une fiche qui n'est pas de la page vidéo : rien n'est écrit", () => {
    const autre = attributionDeLaFiche({ funnel: FICHE_VIDEO.funnel });
    expect(completerAttribution(VIDE, autre)).toEqual({ ecrire: {}, marqueurRemplace: null });
  });
});
