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
    ...p,
  };
}

describe("BlocRapportAnalyse", () => {
  it("une base V2 : trois boutons de téléchargement, le .json, et la phrase « jamais transmis au client »", () => {
    render(<BlocRapportAnalyse ecran={ecran()} clientId={CLIENT} ficheHref={FICHE} />);
    const lien = (nom: string) => screen.getByRole("link", { name: nom }).getAttribute("href");
    expect(lien("Synthèse (réponses, difficultés, logiciels)")).toBe(
      `${FICHE}/rapport-analyse?r=${RAPPORT}&f=synthese-html`,
    );
    expect(lien("Fiche des automatisations")).toBe(
      `${FICHE}/rapport-analyse?r=${RAPPORT}&f=automatisations-html`,
    );
    expect(lien("Schéma des dépendances")).toBe(
      `${FICHE}/rapport-analyse?r=${RAPPORT}&f=schema-html`,
    );
    expect(lien("base d'audit au format .json")).toBe(
      `${FICHE}/rapport-analyse?r=${RAPPORT}&f=base-json`,
    );
    expect(screen.getByText(/Documents internes : jamais transmis au client/)).toBeTruthy();
    expect(screen.queryByText(/Valider le PDF client/)).toBeNull();
    expect(screen.queryByText(/PDF/)).toBeNull();
  });

  it("une base V1 : la synthèse seule est un lien ; les deux autres sont désactivés avec la phrase de relance", () => {
    const r = resume({ versionSchema: "base-audit/1" });
    render(
      <BlocRapportAnalyse ecran={ecran({ rapports: [r] })} clientId={CLIENT} ficheHref={FICHE} />,
    );
    expect(screen.getByRole("link", { name: /Synthèse/ })).toBeTruthy();
    for (const nom of ["Fiche des automatisations", "Schéma des dépendances"]) {
      expect(screen.queryByRole("link", { name: nom })).toBeNull();
      expect((screen.getByRole("button", { name: nom }) as HTMLButtonElement).disabled).toBe(true);
    }
    expect(
      screen.getByText(
        "Ce document n'existe que pour une analyse lancée après la mise à jour : relancez l'analyse.",
      ),
    ).toBeTruthy();
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
