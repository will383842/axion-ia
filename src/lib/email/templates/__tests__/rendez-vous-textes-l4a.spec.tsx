// @vitest-environment node
// L4a (plan « sept points », 2026-11-25) : textes du chantier « rendez-vous » vus par
// l'apporteur et par la personne présentée. Liste FERMÉE des gabarits du chantier : tout
// gabarit ajouté au chantier doit y être inscrit, et ne doit jamais pousser l'apporteur à
// relancer l'entreprise ou à obtenir un rendez-vous (pression indirecte).
import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";

import { ApporteurPresentationRecueRendezVousEmail } from "../apporteur-presentation-recue-rendez-vous";
import { EntrepriseInformationCoordonneesEmail } from "../entreprise-information-coordonnees";

const EXEMPLE = {
  contactName: "Camille Martin",
  entreprise: "Atelier Dumont",
  dateFinReservation: "24 janvier 2027",
  nomApporteur: "Alex Durand",
};

const GABARITS_DU_CHANTIER = {
  "apporteur-presentation-recue-rendez-vous": ApporteurPresentationRecueRendezVousEmail,
  "entreprise-information-coordonnees": EntrepriseInformationCoordonneesEmail,
} as const;

const TOURNURES_INTERDITES = [
  /relancez/i,
  /pensez à/i,
  /obtenir un rendez-vous/i,
  /n'oubliez pas/i,
];

async function texte(Gabarit: (typeof GABARITS_DU_CHANTIER)[keyof typeof GABARITS_DU_CHANTIER]) {
  return (await render(<Gabarit locale="fr" payload={EXEMPLE} />, { plainText: true })).replace(
    /\s+/g,
    " ",
  );
}

describe("L4a — verrou anti-relance (liste fermée des gabarits du chantier)", () => {
  for (const [nom, Gabarit] of Object.entries(GABARITS_DU_CHANTIER)) {
    it(`${nom} n'invite jamais l'apporteur à relancer ni à obtenir un rendez-vous`, async () => {
      const lu = await texte(Gabarit);
      for (const tournure of TOURNURES_INTERDITES) expect(lu).not.toMatch(tournure);
    });
  }
});

describe("L4a — accusé 7a : un langage de fait, pas de reproche ni de « compte »", () => {
  it("dit que la réservation prend fin automatiquement, sans « reproche »", async () => {
    const lu = await texte(ApporteurPresentationRecueRendezVousEmail);
    expect(lu).toContain(
      "Sans rendez-vous pris d'ici là, la réservation prend fin automatiquement ; vous pourrez nous présenter de nouveau cette entreprise après un nouveau contact avec elle.",
    );
    expect(lu).not.toMatch(/reproche/i);
  });

  it("dit « à votre nom », jamais « sur votre compte »", async () => {
    const lu = await texte(ApporteurPresentationRecueRendezVousEmail);
    expect(lu).toContain("à votre nom");
    expect(lu).not.toContain("sur votre compte");
  });
});

describe("L4a — information de la personne présentée : base légale, conservation, réclamation", () => {
  it("reprend ce que dit le gabarit en service et la notice", async () => {
    const lu = await texte(EntrepriseInformationCoordonneesEmail);
    expect(lu).toContain("intérêt légitime");
    expect(lu).toContain("art. 6.1.f");
    expect(lu).toContain("réclamation auprès de la CNIL");
    expect(lu).toContain("Conservation");
    expect(lu).toContain("jusqu'à votre opposition ou votre demande d'effacement");
  });
});
