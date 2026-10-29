/**
 * La carte de rendez-vous dit le type, l'objet et l'état du compte rendu (lot A3).
 *
 * Mutation qui rougit : montrer l'extrait d'un compte rendu non validé, oublier la
 * pastille « Compte rendu à relire » sur un passé non validé, ranger du plus ancien
 * au plus récent, ou afficher l'heure en UTC. Contre-témoin : un compte rendu validé
 * montre son extrait et aucune pastille.
 */

import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("@/features/dossier-client/actions", () => ({
  ajouterPersonneFormAction: vi.fn(),
  basculerOppositionIaFormAction: vi.fn(),
  creerProjetFormAction: vi.fn(),
  garderCetteValeurFormAction: vi.fn(),
}));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import { OngletEchanges } from "@/components/admin/dossier-client/Onglets";
import type { RencontreDuDossier } from "@/features/dossier-client/queries";

const MAINTENANT = new Date("2026-10-20T10:00:00Z");

const rdv = (p: Partial<RencontreDuDossier> & { id: string }): RencontreDuDossier => ({
  titre: "Titre fictif",
  objet: null,
  lieu: null,
  type: "visio",
  debutPrevu: new Date("2026-10-06T08:00:00Z"),
  statut: null,
  projetId: null,
  estTestInterne: false,
  issue: "eu_lieu",
  compteRenduValide: null,
  compteRenduEnCours: false,
  emailsSuivi: [],
  ...p,
});

const rendre = (rencontres: RencontreDuDossier[]): HTMLElement =>
  render(
    <OngletEchanges
      rencontres={rencontres}
      projets={[]}
      rendezVousBase="/fr/adm/rendez-vous"
      maintenant={MAINTENANT}
    />,
  ).container;

describe("la carte de rendez-vous", () => {
  it("met l'objet en titre, sinon le titre", () => {
    const c = rendre([
      rdv({ id: "a", objet: "Cadrer la formation", titre: "Visio du 6" }),
      rdv({ id: "b", titre: "Appel de repli" }),
    ]);
    expect(c.querySelector("[data-rencontre=a] h3")?.textContent).toBe("Cadrer la formation");
    expect(c.querySelector("[data-rencontre=b] h3")?.textContent).toBe("Appel de repli");
  });

  it("dit le type en mots et le lieu quand il existe", () => {
    const c = rendre([
      rdv({ id: "a", type: "telephone" }),
      rdv({ id: "b", type: "presentiel", lieu: "Chez le client, Lyon" }),
      rdv({ id: "c", type: "visio" }),
    ]);
    expect(c.querySelector("[data-rencontre=a]")?.textContent).toContain("Téléphone");
    const b = c.querySelector("[data-rencontre=b]")?.textContent ?? "";
    expect(b).toContain("Sur place");
    expect(b).toContain("Chez le client, Lyon");
    expect(c.querySelector("[data-rencontre=c]")?.textContent).toContain("Visio");
  });

  it("n'affiche l'extrait que d'un compte rendu validé", () => {
    const c = rendre([
      rdv({
        id: "ok",
        compteRenduValide: { valideLe: new Date("2026-10-07T08:00:00Z"), enBref: "Besoin cadré." },
      }),
      rdv({ id: "non", compteRenduEnCours: true }),
    ]);
    const ok = c.querySelector("[data-rencontre=ok]")!;
    expect(ok.textContent).toContain("Besoin cadré.");
    expect(ok.querySelector("[data-a-relire]")).toBeNull();
    const non = c.querySelector("[data-rencontre=non]")!;
    expect(non.textContent).not.toContain("En bref");
  });

  it("pose « Compte rendu à relire » sur un passé non validé, jamais sur un à venir", () => {
    const c = rendre([
      rdv({ id: "passe" }),
      rdv({ id: "futur", debutPrevu: new Date("2026-10-25T08:00:00Z"), issue: null }),
    ]);
    const passe = c.querySelector("[data-rencontre=passe]")!;
    expect(passe.textContent).toContain("Compte rendu à relire");
    expect(passe.textContent).toContain("Relire le compte rendu");
    expect(passe.textContent).not.toMatch(/envoy/i);
    const futur = c.querySelector("[data-rencontre=futur]")!;
    expect(futur.textContent).not.toContain("à relire");
    expect(futur.textContent).toContain("Prévu");
  });

  it("range du prochain au plus ancien", () => {
    const c = rendre([
      rdv({ id: "vieux", debutPrevu: new Date("2026-09-01T08:00:00Z") }),
      rdv({ id: "loin", debutPrevu: new Date("2026-11-30T08:00:00Z"), issue: null }),
      rdv({ id: "recent", debutPrevu: new Date("2026-10-10T08:00:00Z") }),
      rdv({ id: "proche", debutPrevu: new Date("2026-10-22T08:00:00Z"), issue: null }),
    ]);
    const ordre = [...c.querySelectorAll("[data-rencontre]")].map((e) =>
      e.getAttribute("data-rencontre"),
    );
    expect(ordre).toEqual(["proche", "loin", "recent", "vieux"]);
  });

  it("écrit l'heure à Paris", () => {
    // 08:00 UTC en octobre = 10:00 à Paris (heure d'été) ; en janvier 09:00.
    const c = rendre([
      rdv({ id: "ete", debutPrevu: new Date("2026-10-06T08:00:00Z") }),
      rdv({ id: "hiver", debutPrevu: new Date("2026-01-15T08:00:00Z") }),
    ]);
    expect(c.querySelector("[data-rencontre=ete]")?.textContent).toContain("06/10/2026 10:00");
    expect(c.querySelector("[data-rencontre=hiver]")?.textContent).toContain("15/01/2026 09:00");
  });
});
