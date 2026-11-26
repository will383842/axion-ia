/**
 * Décision du dirigeant (26/11/2026) : dès qu'un client a versé un acompte, il le perd s'il annule
 * la commande, SANS condition de délai. La règle « annulée à plus de 15 jours ouvrés, les acomptes
 * versés sont intégralement remboursés » n'existe plus nulle part. Le droit de rétractation légal
 * reste réservé, la TVA reste facturée, le dédit de formation est facturé à part.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

type Section = { title: string; body: string };

async function charger(certifiee: boolean) {
  vi.stubEnv("QUALIOPI_CERTIFICATION_OBTENUE", certifiee ? "true" : "");
  vi.resetModules();
  const { getLegal } = await import("@/content/legal");
  const fr = getLegal("conditions-generales").fr as unknown as { sections: Section[] };
  const art = (n: number) =>
    fr.sections.find((s) => new RegExp(`Article ${n}\\. `).test(s.title))?.body ?? "";
  return { fr, art, tout: fr.sections.map((s) => s.title + "\n" + s.body).join("\n") };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("CGV : l'acompte versé reste acquis, sans condition de délai", () => {
  for (const certifiee of [false, true]) {
    const variante = certifiee ? "variante certifiée" : "variante normale";

    it(`${variante} : plus aucune clause « acomptes remboursés » à plus de 15 jours`, async () => {
      const { tout } = await charger(certifiee);
      expect(tout).not.toMatch(/aucune somme due et acomptes? remboursés?/i);
    });

    it(`${variante} : 6.5, 46.2, 47.6 et 49.5 posent la même règle`, async () => {
      const { art } = await charger(certifiee);
      expect(art(6)).toContain(
        "l'acompte prévu au devis reste acquis à Axion-IA, à concurrence des sommes effectivement versées",
      );
      expect(art(46)).toContain(
        "aucune somme n'est due en plus de l'acompte versé, qui reste acquis",
      );
      expect(art(46)).toContain("n'est jamais inférieure au montant hors taxes de l'acompte versé");
      expect(art(47)).toContain(
        "reste acquis à Axion-IA en cas d'annulation par le Client, quel que soit le délai",
      );
      expect(art(47)).not.toContain("pour la seule Journée IA (article 47.10) : dès que");
      expect(art(49)).toContain(
        "l'acompte prévu au devis reste acquis à Axion-IA en cas d'annulation par le Client, quel que soit le délai",
      );
      expect(art(42)).toContain("n'est jamais inférieur au montant hors taxes de l'acompte versé");
    });

    it(`${variante} : le barème au-delà de l'acompte est inchangé (50 % entre 8 et 15 jours, 100 % sous 8)`, async () => {
      const { art } = await charger(certifiee);
      expect(art(46)).toContain("entre 8 et 15 jours, 50 % du prix HT reste dû");
      expect(art(46)).toContain("moins de 8 jours, 100 % du prix HT reste dû");
      expect(art(46)).toContain("reportée une fois sans frais");
    });

    it(`${variante} : rétractation légale réservée, TVA non exonérée, dédit formation facturé à part`, async () => {
      const { art } = await charger(certifiee);
      expect(art(6)).toContain("l'acompte n'est acquis qu'à l'expiration du délai de rétractation");
      expect(art(6)).toContain("sans exonération");
      expect(art(6)).toContain("article 1231-5 du Code civil");
      expect(art(49)).toContain("l'acompte acquis de l'article 6.5 ne s'applique pas");
      expect(art(53)).toContain(
        "n'est acquis à Axion-IA qu'à l'expiration du délai de rétractation",
      );
      expect(art(49)).toContain(
        "ne peuvent être imputées sur les fonds de la formation professionnelle",
      );
      expect(art(49)).toContain("article L6354-1 du Code du travail");
      expect(art(49)).toContain("facture distincte");
    });
  }

  it("personne morale non professionnelle : restitution intégrale avant le début, sans « part réalisée » (6.5)", async () => {
    for (const certifiee of [false, true]) {
      const { art } = await charger(certifiee);
      expect(art(6)).toContain(
        "l'acompte est remboursé en totalité en cas d'annulation avant le début.",
      );
      expect(art(6)).not.toContain("sous réserve de la part réalisée");
    }
  });

  it("l'opérateur de compétences n'est cité qu'après la certification (variante certifiée seulement)", async () => {
    const normale = await charger(false);
    const certifiee = await charger(true);
    expect(normale.art(49)).not.toMatch(/opérateur de compétences/i);
    expect(certifiee.art(49)).toContain("ni prises en charge par un opérateur de compétences");
  });
});
