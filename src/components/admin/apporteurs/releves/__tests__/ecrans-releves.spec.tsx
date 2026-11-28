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

vi.mock("@/features/apporteurs-reseau/releve-mensuel/actions-envoi", () => ({
  envoyerATousAction: async () => ({ etat: "initial" }),
  renvoyerEchecsAction: async () => ({ etat: "initial" }),
  envoyerRectificatifAction: async () => ({ etat: "initial" }),
}));

import { BandeauAnomalies } from "../BandeauAnomalies";
import { CartesReleves } from "../CartesReleves";
import { eur } from "../format";
import { ListePeriodes } from "../ListePeriodes";
import { SerieDouzeMois } from "../SerieDouzeMois";
import { BoutonEnvoyerATous } from "../BoutonEnvoyerATous";
import { ordreAffichage, TableauReleves } from "../TableauReleves";
import {
  anomaliesDePeriode,
  type ReleveEcran,
} from "@/features/apporteurs-reseau/releve-mensuel/statistiques";

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

describe("BoutonEnvoyerATous (lot 4a)", () => {
  const props = {
    periode: "2026-10",
    libelleMois: "octobre 2026",
    aEnvoyer: 3,
    dejaEnvoyes: 1,
    echecs: 0,
    bloque: false,
    toutEnvoyeLe: null,
  };
  it("affiche les compteurs, le bouton et la saisie de confirmation de la période", () => {
    const html = renderToStaticMarkup(<BoutonEnvoyerATous {...props} />);
    expect(html).toContain("Déjà envoyés : 1 ; à envoyer : 3");
    expect(html).toContain("Envoyer les relevés à tout le monde");
    expect(html).toContain('placeholder="2026-10"');
    expect(html).not.toContain("Renvoyer les échecs");
  });
  it("désactivé quand un apporteur attendu n'a pas de relevé (complétude)", () => {
    const html = renderToStaticMarkup(<BoutonEnvoyerATous {...props} bloque />);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Envoyer les relevés à tout le monde/);
    expect(html).toContain("Envoi bloqué");
  });
  it("après un envoi complet : bouton désactivé « sont partis le … », plus de formulaire d'envoi", () => {
    const html = renderToStaticMarkup(
      <BoutonEnvoyerATous {...props} aEnvoyer={0} dejaEnvoyes={4} toutEnvoyeLe="3 nov. 2026" />,
    );
    expect(html).toContain("Tous les relevés de octobre 2026 sont partis le 3 nov. 2026");
    expect(html).not.toContain('name="confirmation"');
  });
  it("propose « Renvoyer les échecs » seulement s'il y en a", () => {
    expect(renderToStaticMarkup(<BoutonEnvoyerATous {...props} echecs={2} />)).toContain(
      "Renvoyer les échecs",
    );
  });
});

describe("e-mail non remis : montré EN PREMIER", () => {
  const ligne = (over: Partial<ReleveEcran>): ReleveEcran => ({
    id: "r",
    numero: "REL-2026-10-0001",
    apporteurId: "a",
    apporteurNom: "A",
    rang: 0,
    statut: "envoye",
    nbLignes: 0,
    facturesHtCents: 0,
    avoirsHtCents: 0,
    tvaCents: 0,
    ttcCents: 0,
    viresTtcCents: 0,
    enAttenteHtCents: 0,
    cumulAnneeHtCents: 0,
    empreinteCourte: "abcd1234",
    pdfDisponible: true,
    emailPresent: true,
    erreur: null,
    motifEcart: null,
    envoyeAt: null,
    ...over,
  });
  it("échec et remise échouée passent avant les relevés sains, même avec un numéro plus grand", () => {
    const ordre = ordreAffichage([
      ligne({ id: "ok", numero: "REL-2026-10-0001" }),
      ligne({ id: "remise", numero: "REL-2026-10-0002", statutEmail: "bounced" }),
      ligne({ id: "echec", numero: "REL-2026-10-0003", statut: "echec" }),
    ]).map((r) => r.id);
    expect(ordre.slice(0, 2).sort()).toEqual(["echec", "remise"]);
    expect(ordre[2]).toBe("ok");
  });
  it("le bandeau d'anomalies annonce l'e-mail non remis", () => {
    const a = anomaliesDePeriode({ cibles: [], releves: [ligne({ statutEmail: "failed" })] });
    expect(a.map((x) => x.code)).toContain("echec_envoi");
    expect(a[0]!.detail).toMatch(/non remis/);
  });
});
