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
  resume,
} from "@/features/rapport-avant-audit/ecran/__tests__/fixtures";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/features/rapport-avant-audit/ecran/actions", () => ({
  lancerAnalyseAction: vi.fn(),
  validerPdfClientAction: vi.fn(),
  completerFicheAction: vi.fn(),
}));
vi.mock("@/features/dossier-client/actions", () => ({ confirmerSirenFormAction: vi.fn() }));

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
    courant: rapports.find((r) => r.statut === "termine" || r.statut === "incomplet") ?? null,
    propositions: [],
    ...p,
  };
}

describe("BlocRapportAnalyse", () => {
  it("avant validation : pas de lien PDF client, mais le bouton « Valider le PDF client »", () => {
    render(<BlocRapportAnalyse ecran={ecran()} clientId={CLIENT} ficheHref={FICHE} />);
    expect(screen.getByRole("link", { name: "Base d'audit (.json)" }).getAttribute("href")).toBe(
      `${FICHE}/rapport-analyse?r=r1&f=base-json`,
    );
    expect(screen.getByRole("link", { name: "Fiche de chaque personne (.md)" })).toBeTruthy();
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
      etapesFaites: 2,
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
    expect(screen.getByText(/étape : Recherches et analyses/)).toBeTruthy();
    expect(screen.getAllByText(/1\s500 jetons lus, 200 jetons écrits/).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Historique des versions" })).toBeTruthy();
  });
});
