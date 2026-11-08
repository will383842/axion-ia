import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApercuDevis, type VueApercuDevis } from "../ApercuDevis";
import { EmailEnvoi, type ModeleEmail } from "../EmailEnvoi";
import { EtapeEnvoi, type ResultatAction } from "../EtapeEnvoi";

const nettoyer = (s: string) => s.replace(/[\s  ]/g, "");

const VUE: VueApercuDevis = {
  numero: "AXI-DEV-2026-0001",
  clientNom: "Client Test SAS",
  validiteLibelle: "8 décembre 2026",
  objectif: "Objectif lu du serveur.",
  lignes: [
    { libelle: "Assistant", totalHtCents: 240000 },
    { libelle: "Formation", totalHtCents: 28393 },
  ],
  totalHtCents: 268393,
  tvaCents: 53679,
  totalTtcCents: 322072,
  phases: [
    {
      rang: 1,
      libelle: "Cadrage",
      livrable: "Cahier validé",
      pourcentage: 30,
      montantCents: 80518,
    },
    { rang: 2, libelle: "Livraison", livrable: "", pourcentage: 70, montantCents: 187875 },
  ],
  formules: [
    {
      cle: "A",
      titre: "Installée chez vous",
      lignes: [{ libelle: "Mise en place", montantHtCents: 268393 }],
    },
  ],
  servicesExterieurs: [
    { nom: "Serveur", obligatoire: true, estimation: "selon l'offre du fournisseur" },
  ],
  mentionTva: "TVA 20 % en sus.",
  versionCgv: "version en vigueur de test",
};
const MODELES: ModeleEmail[] = [
  {
    cle: "standard",
    libelle: "Proposition standard",
    objet: "Objet standard",
    corps: "Corps standard",
  },
  { cle: "deux_formules", libelle: "Deux formules", objet: "Objet deux", corps: "Corps deux" },
  { cle: "apres_rdv", libelle: "Après notre rendez-vous", objet: "Objet rdv", corps: "Corps rdv" },
  { cle: "libre", libelle: "Mon propre texte", objet: "", corps: "" },
];
const PREPARE = {
  devisId: "d1",
  numero: VUE.numero,
  majLe: "2026-11-08T10:00:00Z",
  apercuPdfUrl: "/api/qualiopi/devis/d1/apercu",
  vue: VUE,
};

function monter(over: Partial<React.ComponentProps<typeof EtapeEnvoi>> = {}) {
  const preparer = vi.fn(async (): Promise<ResultatAction<typeof PREPARE>> => ({ data: PREPARE }));
  const envoyer = vi.fn(async (): Promise<ResultatAction<{ enCorbeille: true }>> => ({
    data: { enCorbeille: true },
  }));
  const exemplaire = vi.fn(async (): Promise<ResultatAction<{ ok: true }>> => ({
    data: { ok: true },
  }));
  const onModifier = vi.fn();
  render(
    <EtapeEnvoi
      etape={4}
      preparer={preparer}
      envoyer={envoyer}
      envoyerExemplaire={exemplaire}
      modelesEmail={MODELES}
      signataire="Signataire de test, Axion-IA"
      destinataire="client@example.test"
      onModifier={onModifier}
      {...over}
    />,
  );
  return { preparer, envoyer, exemplaire, onModifier };
}

describe("EtapeEnvoi : entrée", () => {
  it("appelle l'aperçu serveur UNE fois, avec un squelette de hauteur fixe pendant l'attente", async () => {
    let fin!: (v: ResultatAction<typeof PREPARE>) => void;
    const preparer = vi.fn(() => new Promise<ResultatAction<typeof PREPARE>>((r) => (fin = r)));
    monter({ preparer });
    const cadre = screen.getByTestId("cadre-apercu");
    expect(cadre.getAttribute("aria-busy")).toBe("true");
    expect(cadre.className).toMatch(/h-\[/);
    await act(async () => fin({ data: PREPARE }));
    expect(preparer).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("cadre-apercu").getAttribute("aria-busy")).toBe("false");
  });

  it("AUCUN envoi au simple affichage", async () => {
    const { envoyer, exemplaire } = monter();
    await screen.findByText(VUE.numero, { exact: false });
    expect(envoyer).not.toHaveBeenCalled();
    expect(exemplaire).not.toHaveBeenCalled();
  });

  it("un échec de l'aperçu est dit (role=alert) et laisse réessayer, sans rien envoyer", async () => {
    const preparer = vi
      .fn()
      .mockResolvedValueOnce({ error: "Aperçu impossible." })
      .mockResolvedValueOnce({ data: PREPARE });
    const { envoyer } = monter({ preparer });
    expect((await screen.findByRole("alert")).textContent).toContain("Aperçu impossible.");
    expect(envoyer).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Réessayer/ }));
    await screen.findByText(VUE.numero, { exact: false });
    expect(preparer).toHaveBeenCalledTimes(2);
  });

  it("« Modifier le devis » rend la main à l'appelant", async () => {
    const { onModifier } = monter();
    await screen.findByText(VUE.numero, { exact: false });
    fireEvent.click(screen.getByRole("button", { name: /Modifier le devis/ }));
    expect(onModifier).toHaveBeenCalledTimes(1);
  });
});

describe("ApercuDevis : rendu de la vue serveur", () => {
  it("affiche les montants reçus, formatés seulement, sans rien recalculer", () => {
    render(<ApercuDevis vue={{ ...VUE, totalHtCents: 999, formules: [] }} urlPdf="/pdf" />);
    const t = nettoyer(document.body.textContent!);
    expect(t).toContain("2400,00€");
    expect(t).toContain("9,99€"); // total reçu, même incohérent avec les lignes : jamais recalculé
    expect(t).not.toContain("2683,93€");
  });

  it("« Ouvrir le PDF » ouvre l'URL reçue dans un nouvel onglet", () => {
    render(<ApercuDevis vue={VUE} urlPdf="/api/qualiopi/devis/d1/apercu" />);
    const a = screen.getByRole("link", { name: /Ouvrir le PDF/ });
    expect(a.getAttribute("href")).toBe("/api/qualiopi/devis/d1/apercu");
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.getAttribute("rel")).toContain("noopener");
  });

  it("services extérieurs, mention de TVA et version des CGV viennent de la vue", () => {
    render(<ApercuDevis vue={VUE} urlPdf="/pdf" />);
    expect(screen.getByText(/selon l'offre du fournisseur/)).toBeTruthy();
    expect(screen.getByText(/TVA 20 % en sus\./)).toBeTruthy();
    expect(screen.getByText(/version en vigueur de test/)).toBeTruthy();
  });

  it("aucune date de CGV, aucun nom, aucun cas client en dur", () => {
    render(<ApercuDevis vue={VUE} urlPdf="/pdf" />);
    const t = document.body.textContent!;
    expect(t).not.toMatch(/4 octobre 2026|Will\b|Grenoble|Cas client|capital/i);
  });
});

describe("EmailEnvoi", () => {
  function email(over: Partial<React.ComponentProps<typeof EmailEnvoi>> = {}) {
    const envoyer = vi.fn(async () => ({ data: { enCorbeille: true as const } }));
    const exemplaire = vi.fn(async () => ({ data: { ok: true as const } }));
    render(
      <EmailEnvoi
        modeles={MODELES}
        signataire="Signataire de test, Axion-IA"
        destinataire="client@example.test"
        envoyer={envoyer}
        envoyerExemplaire={exemplaire}
        {...over}
      />,
    );
    return { envoyer, exemplaire };
  }

  it("pré-remplit objet et corps depuis le premier modèle, avec la signature reçue en prop", () => {
    email();
    expect((screen.getByLabelText("Objet") as HTMLInputElement).value).toBe("Objet standard");
    const corps = (screen.getByLabelText("Message") as HTMLTextAreaElement).value;
    expect(corps).toContain("Corps standard");
    expect(corps).toContain("Signataire de test, Axion-IA");
    expect(corps).not.toMatch(/Will\b/);
  });

  it("changer de modèle sans modification remplace directement", () => {
    email();
    fireEvent.change(screen.getByLabelText("Modèle d'e-mail"), {
      target: { value: "deux_formules" },
    });
    expect((screen.getByLabelText("Objet") as HTMLInputElement).value).toBe("Objet deux");
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("changer de modèle après modification demande confirmation, et on peut refuser", () => {
    email();
    fireEvent.change(screen.getByLabelText("Objet"), { target: { value: "Mon objet" } });
    fireEvent.change(screen.getByLabelText("Modèle d'e-mail"), {
      target: { value: "deux_formules" },
    });
    const dlg = screen.getByRole("alertdialog");
    expect((screen.getByLabelText("Objet") as HTMLInputElement).value).toBe("Mon objet");
    fireEvent.click(within(dlg).getByRole("button", { name: /Garder mon texte/ }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect((screen.getByLabelText("Objet") as HTMLInputElement).value).toBe("Mon objet");
    expect((screen.getByLabelText("Modèle d'e-mail") as HTMLSelectElement).value).toBe("standard");
  });

  it("accepter la confirmation applique le nouveau modèle", () => {
    email();
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Mon message" } });
    fireEvent.change(screen.getByLabelText("Modèle d'e-mail"), { target: { value: "apres_rdv" } });
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: /Remplacer/ }),
    );
    expect((screen.getByLabelText("Objet") as HTMLInputElement).value).toBe("Objet rdv");
    expect((screen.getByLabelText("Message") as HTMLTextAreaElement).value).toContain("Corps rdv");
  });

  it("« Revenir au texte d'origine » rétablit objet et corps du modèle", () => {
    email();
    fireEvent.change(screen.getByLabelText("Objet"), { target: { value: "X" } });
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Y" } });
    fireEvent.click(screen.getByRole("button", { name: /Revenir au texte d'origine/ }));
    expect((screen.getByLabelText("Objet") as HTMLInputElement).value).toBe("Objet standard");
    expect((screen.getByLabelText("Message") as HTMLTextAreaElement).value).toContain(
      "Corps standard",
    );
  });

  it("« Envoyer au client » appelle l'envoi UNE fois (double clic neutralisé) avec le contenu saisi", async () => {
    let fin!: (v: { data: { enCorbeille: true } }) => void;
    const envoyer = vi.fn(() => new Promise<{ data: { enCorbeille: true } }>((r) => (fin = r)));
    email({ envoyer });
    const b = screen.getByRole("button", { name: /Envoyer au client/ });
    fireEvent.click(b);
    fireEvent.click(b);
    expect(envoyer).toHaveBeenCalledTimes(1);
    expect(envoyer).toHaveBeenCalledWith(
      expect.objectContaining({
        a: "client@example.test",
        objet: "Objet standard",
        modele: "standard",
      }),
    );
    await act(async () => fin({ data: { enCorbeille: true } }));
    expect(await screen.findByText(/en corbeille, à valider/i)).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: /Envoyer au client/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("un échec d'envoi est dit et laisse réessayer", async () => {
    const envoyer = vi
      .fn()
      .mockResolvedValueOnce({ error: "Conflit : recharger." })
      .mockResolvedValueOnce({ data: { enCorbeille: true } });
    email({ envoyer });
    fireEvent.click(screen.getByRole("button", { name: /Envoyer au client/ }));
    expect((await screen.findByRole("alert")).textContent).toContain("Conflit : recharger.");
    fireEvent.click(screen.getByRole("button", { name: /Envoyer au client/ }));
    await waitFor(() => expect(envoyer).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/en corbeille, à valider/i)).toBeTruthy();
  });

  it("sans destinataire, l'envoi est refusé avec un message", () => {
    const { envoyer } = email({ destinataire: "" });
    fireEvent.click(screen.getByRole("button", { name: /Envoyer au client/ }));
    expect(envoyer).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/adresse/i);
  });

  it("« M'envoyer un exemplaire » appelle l'action d'exemplaire, jamais l'envoi au client", async () => {
    const { envoyer, exemplaire } = email();
    fireEvent.click(screen.getByRole("button", { name: /M'envoyer un exemplaire/ }));
    await waitFor(() => expect(exemplaire).toHaveBeenCalledTimes(1));
    expect(envoyer).not.toHaveBeenCalled();
  });

  it("annonce « relu dans la corbeille avant envoi » et aucune relance automatique", () => {
    email();
    expect(screen.getByText(/relu dans la corbeille avant envoi/)).toBeTruthy();
    expect(screen.getByText(/jamais de relance automatique/)).toBeTruthy();
  });

  it("un seul statut annoncé (pas de aria-live bavard)", () => {
    email();
    expect(document.querySelectorAll("[aria-live]").length).toBeLessThanOrEqual(1);
  });
});
