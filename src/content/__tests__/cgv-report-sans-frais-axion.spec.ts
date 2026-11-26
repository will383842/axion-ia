/**
 * Décision du dirigeant (26/11/2026) : Axion-IA n'annule jamais, elle REPORTE.
 * Clause unique : article 46.4 ; 6.5, 17.4, 49, 50.2 et 53.3 y renvoient.
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
  const alinea = (n: number, num: string) =>
    art(n)
      .split("\n")
      .find((l) => l.startsWith(`${num} `)) ?? "";
  return { art, alinea, tout: fr.sections.map((s) => s.title + "\n" + s.body).join("\n") };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("CGV : report à l'initiative d'Axion-IA, sans frais", () => {
  for (const certifiee of [false, true]) {
    const variante = certifiee ? "variante certifiée" : "variante normale";

    it(`${variante} : 46.4 = au moins 2 nouvelles dates, dans les 6 mois, 1re date réputée acceptée, bon d'achat, sans frais`, async () => {
      const { alinea } = await charger(certifiee);
      const a = alinea(46, "46.4");
      expect(a).toContain("Report à l'initiative d'Axion-IA, sans frais");
      expect(a).toContain("Axion-IA n'annule pas une prestation à date convenue");
      expect(a).toContain("sans frais pour le Client");
      expect(a).toContain("au moins 2 nouvelles dates");
      expect(a).toContain("dans les 30 jours suivant cette information");
      expect(a).toContain("situées dans les 6 mois suivant la date initialement convenue");
      expect(a).toContain("d'au moins 10 Jours ouvrés");
      expect(a).toContain("il est réputé accepter la première date proposée");
      expect(a).toContain("rien n'est remboursé");
      expect(a).toContain("seconde série, qui suit les mêmes règles que la première");
      expect(a).toContain(
        "le Client peut aussi proposer ses propres dates, qu'Axion-IA accepte, sauf indisponibilité de l'intervenant justifiée par écrit",
      );
      expect(a).toContain(
        "bon d'achat (avoir) du montant des sommes qu'il a lui-même versées, valable 12 mois et utilisable sur toute prestation d'Axion-IA",
      );
      expect(a).toContain("sans prolonger le délai de 6 mois");
      expect(a).toContain(
        "Pour la personne physique de l'article 49.2, le report n'a lieu qu'avec son accord exprès",
      );
      expect(a).toContain(
        "la part non utilisée à l'expiration du bon lui est remboursée dans les 30 jours",
      );
      expect(a).toContain("les sommes réglées par un tiers pour son compte en sont exclues");
      expect(a).not.toContain("son silence valant refus");
      expect(a).not.toContain("dans les 3 mois");
      expect(a).toContain("n'est pas une annulation par lui");
      expect(a).toContain("l'acompte ne devient pas acquis à Axion-IA de ce fait");
    });

    it(`${variante} : le remboursement ne joue qu'après échec du report`, async () => {
      const { alinea } = await charger(certifiee);
      const a = alinea(46, "46.4");
      expect(a).toContain("Le remboursement n'intervient qu'en dernier recours");
      expect(a).toContain("aucune date n'a pu être convenue dans les 6 mois");
      expect(a).toContain("le Client n'a pas choisi le bon d'achat");
      expect(a).toContain(
        "ou Axion-IA ne lui a pas proposé, dans le délai de 30 jours ci-dessus, au moins 2 dates",
      );
    });

    it(`${variante} : l'indemnité égale ne vise que la personne morale non professionnelle, jamais le professionnel`, async () => {
      const { alinea, tout } = await charger(certifiee);
      const a = alinea(46, "46.4");
      expect(a).toContain(
        "Pour la seule personne morale non professionnelle (article 53.3), hors force majeure (article 39) et hors faute du Client, Axion-IA verse en outre une indemnité égale à l'acompte",
      );
      expect(a).toContain("le Client professionnel ne reçoit jamais d'indemnité en plus");
      const a53 = alinea(53, "53.3");
      expect(a53).toContain(
        "Cette indemnité ne vise qu'elle : sauf faute lourde ou dolosive, le Client professionnel n'en reçoit jamais",
      );
      expect(a53).toContain("Axion-IA n'annule pas la prestation");
      expect(a53).toContain("au moins 2 nouvelles dates dans les 6 mois");
      // Aucune autre clause n'ouvre une indemnité égale à l'acompte.
      expect(tout.match(/indemnité d'un montant égal à (cet |l')acompte/g)?.length ?? 0).toBe(2);
      expect(alinea(53, "53.3")).toContain(
        "notamment celles de l'article 42, si Axion-IA renonce à l'exécuter",
      );
      expect(tout.match(/renonce à l'exécuter/g)?.length ?? 0).toBe(1);
      expect(tout).not.toContain("sauf report accepté par lui");
    });

    it(`${variante} : 6.5, 17.4, 49 et 50.2 renvoient à 46.4 (pas de remboursement direct)`, async () => {
      const { art, alinea } = await charger(certifiee);
      expect(art(6)).toContain("d'un report à l'initiative d'Axion-IA (article 46.4)");
      expect(art(6)).not.toContain("d'une annulation par Axion-IA");
      expect(art(6)).toContain(
        "En cas de report (articles 46.3 et 46.4), l'acompte est reporté sur la nouvelle date, ou porté sur le bon d'achat de l'article 46.4, et reste imputé",
      );
      expect(alinea(17, "17.4")).toContain("au moins 2 nouvelles dates dans les 6 mois");
      expect(alinea(17, "17.4")).toContain("que dans les cas prévus à l'article 46.4");
      expect(art(49)).toContain("le report à l'initiative d'Axion-IA suit l'article 46.4");
      expect(alinea(50, "50.2")).toContain("au moins 2 nouvelles dates dans les 6 mois");
      expect(alinea(50, "50.2")).toContain("que dans les cas prévus à l'article 46.4");
      expect(art(47)).not.toContain("l'annulation par Axion-IA");
    });
  }
});
