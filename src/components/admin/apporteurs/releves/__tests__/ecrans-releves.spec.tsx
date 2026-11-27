/** Lot 3e — rendu des blocs de la console, avec des données simulées. */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

// Les actions serveur tirent `@/auth` (next-auth) : inutile pour un rendu statique.
vi.mock("@/features/apporteurs-reseau/releve-mensuel/actions-preparation", () => ({
  preparerRelevesAction: async () => ({ etat: "initial" }),
  recalculerReleveAction: async () => ({ etat: "initial" }),
  ecarterReleveAction: async () => ({ etat: "initial" }),
  retablirReleveAction: async () => ({ etat: "initial" }),
}));

import { BandeauAnomalies } from "../BandeauAnomalies";
import { CartesReleves } from "../CartesReleves";
import { eur } from "../format";
import { ListePeriodes } from "../ListePeriodes";
import { SerieDouzeMois } from "../SerieDouzeMois";
import { TableauReleves } from "../TableauReleves";

describe("BandeauAnomalies", () => {
  it("ne rend rien sans anomalie", () => {
    expect(renderToStaticMarkup(<BandeauAnomalies anomalies={[]} />)).toBe("");
  });
  it("annonce les anomalies bloquantes en tête", () => {
    const html = renderToStaticMarkup(
      <BandeauAnomalies anomalies={[{ code: "completude", detail: "2 apporteurs sans relevé" }]} />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("2 apporteurs sans relevé");
  });
});

describe("CartesReleves", () => {
  it("affiche les cinq repères en euros", () => {
    const html = renderToStaticMarkup(
      <CartesReleves
        cartes={{
          periode: "2026-10",
          apporteursSignes: 12,
          avecMouvement: 5,
          facturesHtCents: 123_456,
          viresTtcCents: 40_000,
          enAttenteHtCents: 8_000,
          cumulAnneeHtCents: 900_000,
          source: "releves",
        }}
      />,
    );
    expect(html).toContain("12");
    expect(html).toContain("1 234,56");
    expect(html).toContain("octobre 2026");
  });
});

describe("SerieDouzeMois", () => {
  it("une barre CSS par mois, sans bibliothèque de graphique", () => {
    const points = ["2026-09", "2026-10"].map((periode, i) => ({
      periode,
      source: "releves" as const,
      facturesHtCents: (i + 1) * 1000,
      avoirsHtCents: 0,
      viresTtcCents: 0,
    }));
    const html = renderToStaticMarkup(<SerieDouzeMois points={points} />);
    expect(html.match(/data-barre/g)).toHaveLength(2);
    expect(html).not.toContain("<canvas");
  });
});

describe("ListePeriodes", () => {
  it("lie chaque période à son écran de vérification", () => {
    const html = renderToStaticMarkup(
      <ListePeriodes
        base="/fr/x"
        periodes={[{ periode: "2026-10", prepares: 3, envoyes: 1, echecs: 1, ecartes: 0 }]}
      />,
    );
    expect(html).toContain("/fr/x/apporteurs/releves/2026-10");
  });
});

describe("TableauReleves", () => {
  const ligne = {
    id: "r1",
    numero: "REL-2026-10-0001",
    apporteurId: "a1",
    apporteurNom: "Apporteur fictif",
    rang: 0,
    statut: "prepare" as const,
    nbLignes: 2,
    facturesHtCents: 10_000,
    avoirsHtCents: 1_000,
    tvaCents: 1_800,
    ttcCents: 10_800,
    viresTtcCents: 0,
    enAttenteHtCents: 0,
    cumulAnneeHtCents: 0,
    empreinteCourte: "abcd1234",
    pdfDisponible: true,
    emailPresent: true,
    erreur: null,
    motifEcart: null,
    envoyeAt: null,
  };
  it("montre l'empreinte courte et un lien d'aperçu vers le PDF stocké", () => {
    const html = renderToStaticMarkup(
      <TableauReleves base="/fr/x" periode="2026-10" releves={[ligne]} peutVoirPdf />,
    );
    expect(html).toContain("abcd1234");
    expect(html).toContain("/fr/x/apporteurs/releves/2026-10/pdf?numero=REL-2026-10-0001");
  });
  it("affiche la TVA et le TTC lus sur le relevé (HT/TVA/TTC)", () => {
    const html = renderToStaticMarkup(
      <TableauReleves base="/fr/x" periode="2026-10" releves={[ligne]} peutVoirPdf />,
    );
    expect(html).toContain(">TVA<");
    expect(html).toContain(">TTC<");
    expect(html).toContain(eur(1_800));
    expect(html).toContain(eur(10_800));
  });
  it("TVA et TTC illisibles : « — », jamais 0,00 €", () => {
    const html = renderToStaticMarkup(
      <TableauReleves
        base="/fr/x"
        periode="2026-10"
        releves={[{ ...ligne, tvaCents: null, ttcCents: null }]}
        peutVoirPdf
      />,
    );
    expect(html).toContain(">—</td>");
    expect(html).not.toContain(eur(1_800));
    expect(html.match(/>—<\/td>/g)).toHaveLength(2);
  });
  it("sans droit de facturation, pas de lien d'aperçu", () => {
    const html = renderToStaticMarkup(
      <TableauReleves base="/fr/x" periode="2026-10" releves={[ligne]} peutVoirPdf={false} />,
    );
    expect(html).not.toContain("pdf?numero=");
  });
  it("aucun bouton d'écriture ni d'envoi dans ce lot", () => {
    const html = renderToStaticMarkup(
      <TableauReleves base="/fr/x" periode="2026-10" releves={[ligne]} peutVoirPdf />,
    );
    expect(html).not.toMatch(/<button|<form|Envoyer/);
  });
});
