import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { etatT1, etatT3 } from "../../fixtures";
import type { EtatAssistant } from "../../types";
import { EmailEnvoi } from "../envoi/EmailEnvoi";
import { EtapeEnvoi } from "../envoi/EtapeEnvoi";
import { ChoixFormules } from "../formules/ChoixFormules";
import { EtapeFormules } from "../formules/EtapeFormules";
import { EtapePaiement } from "../paiement/EtapePaiement";
import { PaiementA } from "../paiement/PaiementA";
import { RappelPhases } from "../paiement/RappelPhases";

const TVA = 20;
const rien = vi.fn();
const formules = (etat: EtatAssistant) => (
  <EtapeFormules
    etape={2}
    etat={etat}
    dispatch={rien}
    tvaStandardPct={TVA}
    avantagesPossibles={{ A: [], B: [] }}
    aSavoirPossibles={{ A: [], B: [] }}
    textePlafond="Texte"
  />
);

/** Une aide « ? » : bouton nommé, et texte présent dans le DOM même repliée. */
function verifierAide(nom: RegExp, texte: RegExp) {
  const resume = screen.getByText(
    (_, el) => el?.tagName === "SUMMARY" && nom.test(el.getAttribute("aria-label") ?? ""),
  );
  const details = resume.closest("details")!;
  expect(details.open).toBe(false);
  expect(details.textContent).toMatch(texte);
}

describe("Étape 2 : refonte visuelle", () => {
  it("le choix de proposition garde son groupe, ses 4 radios et son aide repliée", () => {
    render(<ChoixFormules etat={etatT3()} dispatch={rien} />);
    expect(screen.getByRole("group", { name: /Que proposez-vous au client/ })).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(4);
    verifierAide(/En savoir plus sur le choix de la proposition/, /Le client verra seulement/);
  });

  it("A + B : les deux cartes, badges d'offre et aides repliées dans le DOM", () => {
    render(formules(etatT3()));
    expect(screen.getByRole("region", { name: /Formule A/ })).toBeTruthy();
    expect(screen.getByRole("region", { name: /Formule B/ })).toBeTruthy();
    expect(
      within(screen.getByRole("region", { name: /Formule A/ })).getByText("Achat"),
    ).toBeTruthy();
    expect(
      within(screen.getByRole("region", { name: /Formule B/ })).getByText("Abonnement"),
    ).toBeTruthy();
    expect(screen.getByRole("complementary", { name: /Ce que le client verra/ })).toBeTruthy();
    verifierAide(/En savoir plus sur la formule A/, /Paiement unique/);
    verifierAide(/En savoir plus sur la formule B/, /Nous hébergeons/);
    verifierAide(
      /En savoir plus sur les services extérieurs/,
      /paient directement|paie directement/,
    );
  });

  it("les champs exigés restent visibles (jamais dans une aide repliée)", () => {
    render(formules(etatT3()));
    for (const nom of [/Prix de la mise en place/, /Abonnement mensuel/]) {
      expect(screen.getByLabelText(nom).closest("details")).toBeNull();
    }
  });
});

describe("Étape 3 : refonte visuelle", () => {
  it("onglets WAI-ARIA conservés, barre de répartition nommée depuis les pourcentages", () => {
    render(<EtapePaiement etape={3} etat={etatT3()} dispatch={rien} tvaStandardPct={TVA} />);
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    const barre = screen.getByRole("img", { name: /Répartition des versements/ });
    expect(barre.getAttribute("aria-label")).toMatch(/\d+ %/);
  });

  it("rythmes de maintenance : vraies cases, aide repliée dans le DOM", () => {
    render(<PaiementA etat={etatT1()} dispatch={rien} />);
    expect(screen.getAllByRole("checkbox")).toHaveLength(4);
    verifierAide(/En savoir plus sur le rythme de maintenance/, /Au moins un rythme/);
    verifierAide(/En savoir plus sur le démarrage des travaux/, /Aucun travail ne démarre/);
  });

  it("versements en liste nommée, montant à droite", () => {
    render(<RappelPhases nom="Phases test" phases={etatT1().achat.phases} montants={[100000]} />);
    expect(screen.getByRole("list", { name: "Phases test" })).toBeTruthy();
  });
});

describe("Étape 4 : refonte visuelle", () => {
  it("cadre d'aperçu de 440 px et bouton d'envoi nommé à l'identique", () => {
    render(
      <EtapeEnvoi
        etape={4}
        preparer={() => new Promise(() => {})}
        envoyer={vi.fn()}
        destinataire="a@b.fr"
      />,
    );
    expect(screen.getByTestId("cadre-apercu").className).toContain("h-[440px]");
  });

  it("e-mail : « À » lu, aide de la pièce jointe repliée, bouton d'envoi", () => {
    render(<EmailEnvoi destinataire="a@b.fr" envoyer={vi.fn()} />);
    expect((screen.getByLabelText("À") as HTMLInputElement).value).toBe("a@b.fr");
    expect(screen.getByRole("button", { name: "Envoyer au client" })).toBeTruthy();
    verifierAide(/En savoir plus sur la pièce jointe/, /jamais de relance/);
  });
});
