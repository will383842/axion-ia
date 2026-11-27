/** Lot 4b' — bloc « Relevés mensuels » de la fiche apporteur : LECTURE seule. */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { RelevesMensuels, etatEnvoiReleve, type ReleveDeFiche } from "../RelevesMensuels";

const releve = (over: Partial<ReleveDeFiche> = {}): ReleveDeFiche => ({
  id: "r1",
  numero: "REL-2026-10-0001",
  periode: "2026-10",
  rang: 0,
  statut: "envoye",
  envoyeAt: new Date("2026-11-02T09:00:00Z"),
  empreinteCourte: "abcd1234",
  pdfDisponible: true,
  statutEmail: "sent",
  erreur: null,
  ...over,
});

describe("etatEnvoiReleve (statut lu dans EmailLog)", () => {
  it("envoyé : relevé envoyé et journal « sent »", () => {
    expect(etatEnvoiReleve("envoye", "sent").code).toBe("envoye");
  });
  it("en file : enfilé mais journal en attente ou pas encore écrit", () => {
    expect(etatEnvoiReleve("envoye", "pending").code).toBe("en_file");
    expect(etatEnvoiReleve("envoye", null).code).toBe("en_file");
    expect(etatEnvoiReleve("envoi_en_cours", null).code).toBe("en_file");
  });
  it("échoué : échec d'enfilage ou journal failed / bounced", () => {
    expect(etatEnvoiReleve("echec", null).code).toBe("echoue");
    expect(etatEnvoiReleve("envoye", "failed").code).toBe("echoue");
    expect(etatEnvoiReleve("envoye", "bounced").code).toBe("echoue");
  });
  it("préparé et écarté ont leur état propre", () => {
    expect(etatEnvoiReleve("prepare", null).code).toBe("prepare");
    expect(etatEnvoiReleve("ecarte", null).code).toBe("ecarte");
  });
});

describe("RelevesMensuels", () => {
  it("liste période, numéro, empreinte courte et état", () => {
    const html = renderToStaticMarkup(
      <RelevesMensuels base="/fr/x" releves={[releve()]} peutVoirPdf />,
    );
    expect(html).toContain("REL-2026-10-0001");
    expect(html).toContain("abcd1234");
    expect(html).toContain("Envoyé");
    expect(html).toContain("/fr/x/apporteurs/releves/2026-10/pdf?numero=REL-2026-10-0001");
  });
  it("rend en file et échoué", () => {
    const html = renderToStaticMarkup(
      <RelevesMensuels
        base="/fr/x"
        releves={[
          releve({ id: "2", numero: "REL-2026-09-0001", periode: "2026-09", statutEmail: "pending" }),
          releve({ id: "3", numero: "REL-2026-08-0001", periode: "2026-08", statutEmail: "failed" }),
        ]}
        peutVoirPdf
      />,
    );
    expect(html).toContain("En file");
    expect(html).toContain("Échec");
  });
  it("marque un rectificatif", () => {
    const html = renderToStaticMarkup(
      <RelevesMensuels base="/fr/x" releves={[releve({ rang: 1, numero: "REL-2026-10-0001-R1" })]} peutVoirPdf />,
    );
    expect(html).toContain("Rectificatif");
  });
  it("message sobre quand il n'y a aucun relevé", () => {
    const html = renderToStaticMarkup(<RelevesMensuels base="/fr/x" releves={[]} peutVoirPdf />);
    expect(html).toContain("Aucun relevé");
  });
  it("lecture seule : ni bouton, ni formulaire", () => {
    const html = renderToStaticMarkup(
      <RelevesMensuels base="/fr/x" releves={[releve()]} peutVoirPdf />,
    );
    expect(html).not.toMatch(/<button|<form|rectificatif établi|Établir/i);
  });
  it("sans droit, pas de lien PDF", () => {
    const html = renderToStaticMarkup(
      <RelevesMensuels base="/fr/x" releves={[releve()]} peutVoirPdf={false} />,
    );
    expect(html).not.toContain("pdf?numero=");
  });
});
