/**
 * Bloc « Rapport d'analyse » : ce que Will voit (rendu réel du composant serveur, actions simulées).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { EcranRapport } from "@/features/rapport-avant-audit/ecran/lecture";
import {
  etatBoutonLancer,
  listerPropositions,
  rappelReponses,
} from "@/features/rapport-avant-audit/ecran/logique";
import {
  ficheVide,
  proposition,
  RAPPORT,
  resume,
} from "@/features/rapport-avant-audit/ecran/__tests__/fixtures";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/features/rapport-avant-audit/ecran/actions", () => ({
  lancerAnalyseAction: vi.fn(),
  validerPdfClientAction: vi.fn(),
  completerFicheAction: vi.fn(),
  poserSirenDepuisRapportAction: vi.fn(),
}));

const { BlocRapportAnalyse } = await import("../BlocRapportAnalyse");

const CLIENT = "11111111-1111-4111-8111-111111111111";
const FICHE = `/fr/console/qualiopi/clients/${CLIENT}`;

function ecran(p: Partial<EcranRapport> = {}): EcranRapport {
  const rapports = p.rapports ?? [resume()];
  return {
    superAdmin: true,
    rappel: rappelReponses([new Date("2026-11-01T09:00:00Z")], rapports),
    bouton: etatBoutonLancer({
      role: "super_admin",
      interrupteurAllume: true,
      branche: true,
      nbReponses: 1,
      rapports,
    }),
    rapports,
    courant: rapports.find((r) => r.statut === "termine") ?? null,
    propositions: [],
    retiresPdf: null,
    ...p,
  };
}

describe("BlocRapportAnalyse", () => {
  it("avant validation : pas de lien PDF client, mais le bouton « Valider le PDF client »", () => {
    render(<BlocRapportAnalyse ecran={ecran()} clientId={CLIENT} ficheHref={FICHE} />);
    expect(
      screen.getByRole("link", { name: "base d'audit au format .json" }).getAttribute("href"),
    ).toBe(`${FICHE}/rapport-analyse?r=${RAPPORT}&f=base-json`);
    expect(screen.getByRole("link", { name: "Fiche de chaque personne" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "PDF client" })).toBeNull();
    expect(screen.getByRole("button", { name: "Valider le PDF client" })).toBeTruthy();
  });

  it("après validation : le lien PDF client apparaît", () => {
    const r = resume({ pdfValideLe: new Date("2026-11-02T08:00:00Z") });
    render(
      <BlocRapportAnalyse ecran={ecran({ rapports: [r] })} clientId={CLIENT} ficheHref={FICHE} />,
    );
    expect(screen.getByRole("link", { name: "PDF client" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Valider le PDF client" })).toBeNull();
  });

  it("hors super-administrateur : ni bouton, ni téléchargement, ni liste", () => {
    render(
      <BlocRapportAnalyse
        ecran={ecran({ superAdmin: false })}
        clientId={CLIENT}
        ficheHref={FICHE}
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("interrupteur éteint : bouton visible, désactivé, raison écrite", () => {
    const e = ecran();
    render(
      <BlocRapportAnalyse
        ecran={{
          ...e,
          bouton: etatBoutonLancer({
            role: "super_admin",
            interrupteurAllume: false,
            branche: true,
            nbReponses: 1,
            rapports: e.rapports,
          }),
        }}
        clientId={CLIENT}
        ficheHref={FICHE}
      />,
    );
    const b = screen.getByRole("button", { name: "Relancer l'analyse complète" });
    expect((b as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/RAPPORT_AVANT_AUDIT_ENABLED/)).toBeTruthy();
  });

  it("« Compléter la fiche » : case seulement sur un champ vide ; SIREN à part", () => {
    const propositions = listerPropositions(
      [
        proposition(),
        proposition({ champ: "Ville", valeur: "Lyon" }),
        proposition({ champ: "SIREN", valeur: "123456789" }),
      ],
      ficheVide({ adresseVille: "Paris" }),
    );
    render(
      <BlocRapportAnalyse ecran={ecran({ propositions })} clientId={CLIENT} ficheHref={FICHE} />,
    );
    const cases = screen.getAllByRole("checkbox");
    expect(cases).toHaveLength(1);
    expect(cases[0]?.getAttribute("value")).toBe("p0");
    expect((cases[0] as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText(/sur la fiche : « Paris »/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Poser ce SIREN" })).toBeTruthy();
  });

  it("progression d'une analyse en cours : étape et jetons", () => {
    const enCours = resume({
      id: "r2",
      version: 2,
      statut: "en_cours",
      etape: "Recherches et analyses",
      progression: 33,
      jetonsEntree: 1500,
      jetonsSortie: 200,
    });
    render(
      <BlocRapportAnalyse
        ecran={ecran({ rapports: [enCours, resume()] })}
        clientId={CLIENT}
        ficheHref={FICHE}
      />,
    );
    expect(screen.getByText(/étape : Recherches et analyses \(33 %\)/)).toBeTruthy();
    expect(screen.getAllByText(/1\s500 jetons lus, 200 jetons écrits/).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Historique des versions" })).toBeTruthy();
  });

  it("passages retirés du PDF : listés au-dessus de « Valider le PDF client »", () => {
    render(
      <BlocRapportAnalyse
        ecran={ecran({
          retiresPdf: [{ ou: "piste", texte: "Un passage à reformuler", mots: ["« interdit »"] }],
        })}
        clientId={CLIENT}
        ficheHref={FICHE}
      />,
    );
    const titre = screen.getByRole("heading", { name: /à relire avant d'envoyer/ });
    const bouton = screen.getByRole("button", { name: "Valider le PDF client" });
    expect(titre.compareDocumentPosition(bouton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText(/Un passage à reformuler/)).toBeTruthy();
  });

  it("« Poser ce SIREN » n'envoie pas la valeur dans le formulaire", () => {
    const propositions = listerPropositions(
      [proposition({ champ: "SIREN", valeur: "123456789" })],
      ficheVide(),
    );
    const { container } = render(
      <BlocRapportAnalyse ecran={ecran({ propositions })} clientId={CLIENT} ficheHref={FICHE} />,
    );
    expect(screen.getByRole("button", { name: "Poser ce SIREN" })).toBeTruthy();
    expect(container.querySelector('input[name="siren"]')).toBeNull();
  });
});
