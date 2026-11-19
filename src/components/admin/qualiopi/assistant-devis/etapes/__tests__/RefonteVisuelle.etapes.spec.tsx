import { render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { etatT1, etatT3 } from "../../fixtures";
import type { EtatAssistant } from "../../types";
import { ApercuDevis } from "../envoi/ApercuDevis";
import { EmailEnvoi } from "../envoi/EmailEnvoi";
import { EtapeEnvoi } from "../envoi/EtapeEnvoi";
import { ChoixFormules } from "../formules/ChoixFormules";
import { EtapeFormules } from "../formules/EtapeFormules";
import { ServicesExterieurs } from "../formules/ServicesExterieurs";
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

describe("Cibles tactiles de 44 px (classe admin-button-lg, 48 px)", () => {
  const SERVICE = {
    nom: "Serveur",
    obligatoire: true,
    rythme: "mensuel",
    estimationHtCents: null,
  } as unknown as EtatAssistant["servicesTiers"][number];

  it("services extérieurs : ajouter et retirer", () => {
    const etat = { ...etatT3(), servicesTiers: [SERVICE] };
    render(<ServicesExterieurs etat={etat} dispatch={rien} textePlafond="Texte" />);
    expect(screen.getByRole("button", { name: /Retirer le service 1/ }).className).toContain(
      "admin-button-lg",
    );
    expect(screen.getByRole("button", { name: /Ajouter un service/ }).className).toContain(
      "admin-button-lg",
    );
  });

  it("e-mail : « Envoyer au client »", () => {
    render(<EmailEnvoi destinataire="a@b.fr" envoyer={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Envoyer au client" }).className).toContain(
      "admin-button-lg",
    );
  });

  it("envoi : « Réessayer » et « Modifier le devis »", async () => {
    const { unmount } = render(
      <EtapeEnvoi
        etape={4}
        preparer={async () => ({ error: "Échec" })}
        envoyer={vi.fn()}
        destinataire="a@b.fr"
        onModifier={rien}
      />,
    );
    const reessayer = await screen.findByRole("button", { name: /Réessayer/ });
    expect(reessayer.className).toContain("admin-button-lg");
    unmount();
    const vue = {
      numero: "AXI-DEV-2026-0001",
      clientNom: "Client",
      validiteLibelle: "8 décembre 2026",
      objectif: null,
      lignes: [],
      totalHtCents: 0,
      tvaCents: 0,
      totalTtcCents: 0,
      phases: [],
      formules: [],
      servicesExterieurs: [],
      mentionTva: "",
      versionCgv: "v",
    };
    render(
      <EtapeEnvoi
        etape={4}
        preparer={async () => ({
          data: { devisId: "d1", numero: vue.numero, majLe: "", apercuPdfUrl: "/pdf", vue },
        })}
        envoyer={vi.fn()}
        destinataire="a@b.fr"
        onModifier={rien}
      />,
    );
    const modifier = await screen.findByRole("button", { name: /Modifier le devis/ });
    await waitFor(() => expect(modifier.className).toContain("admin-button-lg"));
  });

  it("aperçu : le lien « Ouvrir le PDF »", () => {
    render(
      <ApercuDevis
        vue={{
          numero: "N",
          clientNom: "C",
          validiteLibelle: "v",
          objectif: null,
          lignes: [],
          totalHtCents: 0,
          tvaCents: 0,
          totalTtcCents: 0,
          phases: [],
          formules: [],
          servicesExterieurs: [],
          mentionTva: "",
          versionCgv: "v",
        }}
        urlPdf="/pdf"
      />,
    );
    expect(screen.getByRole("link", { name: /Ouvrir le PDF/ }).className).toContain(
      "admin-button-lg",
    );
  });
});

describe("Segments : l'état coché ne tient pas à la seule couleur", () => {
  it("rythmes de maintenance : coche seulement sur les cases cochées", () => {
    render(<PaiementA etat={etatT1()} dispatch={rien} />);
    for (const c of screen.getAllByRole("checkbox") as HTMLInputElement[]) {
      const icone = c.closest("label")!.querySelector("svg[aria-hidden='true']");
      expect(icone !== null).toBe(c.checked);
    }
    expect((screen.getAllByRole("checkbox") as HTMLInputElement[]).some((c) => c.checked)).toBe(
      true,
    );
  });

  it("choix de proposition : la coche suit le radio retenu", () => {
    render(<ChoixFormules etat={etatT3()} dispatch={rien} />);
    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(radios.some((r) => r.checked)).toBe(true);
    for (const r of radios) {
      const icone = r.closest("label")!.querySelector("svg[aria-hidden='true']");
      expect(icone !== null).toBe(r.checked);
    }
  });

  it("services extérieurs : le badge est masqué aux lecteurs d'écran", () => {
    const etat = {
      ...etatT3(),
      servicesTiers: [
        { nom: "S", obligatoire: true, rythme: "mensuel", estimationHtCents: null },
      ] as unknown as EtatAssistant["servicesTiers"],
    };
    render(<ServicesExterieurs etat={etat} dispatch={rien} textePlafond="T" />);
    const badge = screen.getAllByText("Obligatoire").find((e) => e.closest("[aria-hidden='true']"));
    expect(badge).toBeTruthy();
  });
});
