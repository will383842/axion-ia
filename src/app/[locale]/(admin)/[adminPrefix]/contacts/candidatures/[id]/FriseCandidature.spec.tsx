/**
 * La frise d'une candidature DIT l'accusé de réception automatique.
 *
 * Défaut mesuré en production le 2026-09-18 : une fiche dont l'accusé était
 * parti (et même livré) affichait « Rien n'a encore été consigné ». Ce fichier
 * verrouille le RENDU — la lecture est verrouillée par
 * `features/admin-job-applications/__tests__/l-accuse-de-reception-se-voit-sur-la-fiche.spec.ts`.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { AccuseReception } from "@/features/admin-job-applications/accuse-reception";

import { FriseCandidature } from "./FriseCandidature";

function rendre(accuse: AccuseReception | null): string {
  return renderToStaticMarkup(<FriseCandidature entrees={[]} accuse={accuse} />);
}

const ENVOYE: AccuseReception = {
  etat: "envoye",
  date: new Date("2026-09-18T15:48:37Z"),
  essais: 1,
  motif: null,
  rebond: null,
  rattachement: "exact",
};

describe("FriseCandidature — l'accusé de réception automatique", () => {
  it("envoyé : la fiche le dit, avec sa date, et rappelle que ce n'est PAS une réponse", () => {
    const html = rendre(ENVOYE);
    expect(html).toContain("Accusé de réception automatique");
    expect(html).toContain("18 sept. 2026");
    expect(html).toMatch(/pas une réponse/);
    expect(html).not.toContain("Rien n’a encore été consigné");
  });

  it("envoyé après plusieurs essais : dit le renvoi, pas seulement « envoyé »", () => {
    const html = rendre({ ...ENVOYE, essais: 6 });
    expect(html).toMatch(/6(ᵉ|e) essai/);
  });

  it("en échec : dit qu'il n'est PAS parti, avec le motif, en alerte", () => {
    const html = rendre({
      etat: "echec",
      date: new Date("2026-09-16T08:30:00Z"),
      essais: 5,
      motif: "Invalid login: 535 Authentication Failed",
      rebond: null,
      rattachement: "exact",
    });
    expect(html).toMatch(/n.est pas parti/);
    expect(html).toContain("Invalid login: 535 Authentication Failed");
    expect(html).toContain('role="alert"');
  });

  it("absent : le dit — une fiche muette laisserait croire qu'il est parti", () => {
    const html = rendre({
      etat: "absent",
      date: null,
      essais: 0,
      motif: null,
      rebond: null,
      rattachement: null,
    });
    expect(html).toMatch(/Aucun accusé de réception automatique/);
  });

  it("rattaché par adresse et heure : le dit, pour ne pas le présenter comme un lien exact", () => {
    const html = rendre({ ...ENVOYE, rattachement: "adresse_et_date" });
    expect(html).toMatch(/adresse et l.heure/);
  });

  it("frise NON vide : l'accusé reste dit, en dernière ligne (c'est le premier fait du dossier)", () => {
    const html = renderToStaticMarkup(
      <FriseCandidature
        entrees={[
          {
            id: "e1",
            type: "note",
            occurredAt: new Date("2026-09-18T16:00:00Z"),
            authorName: "Will",
            summary: "Profil à rappeler",
            body: null,
            livraison: null,
          },
        ]}
        accuse={ENVOYE}
      />,
    );
    expect(html).toContain("Profil à rappeler");
    expect(html).toContain("Accusé de réception automatique");
    expect(html.indexOf("Profil à rappeler")).toBeLessThan(
      html.indexOf("Accusé de réception automatique"),
    );
  });

  it("sans accès au dossier (accusé null) : la frise vide reste celle d'avant", () => {
    const html = rendre(null);
    expect(html).toContain("Rien n’a encore été consigné");
    expect(html).not.toContain("Accusé de réception automatique");
  });
});
