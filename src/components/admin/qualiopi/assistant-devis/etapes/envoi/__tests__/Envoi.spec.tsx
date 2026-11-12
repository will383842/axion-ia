import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApercuDevis, type VueApercuDevis } from "../ApercuDevis";
import { EmailEnvoi } from "../EmailEnvoi";
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
  const onModifier = vi.fn();
  render(
    <EtapeEnvoi
      etape={4}
      preparer={preparer}
      envoyer={envoyer}
      destinataire="client@example.test"
      onModifier={onModifier}
      {...over}
    />,
  );
  return { preparer, envoyer, onModifier };
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
    const { envoyer } = monter();
    await screen.findByText(VUE.numero, { exact: false });
    expect(envoyer).not.toHaveBeenCalled();
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

  it("« Réessayer » : un double clic ne lance qu'un seul nouvel appel", async () => {
    let fin!: (v: ResultatAction<typeof PREPARE>) => void;
    const preparer = vi
      .fn()
      .mockResolvedValueOnce({ error: "Aperçu impossible." })
      .mockImplementationOnce(() => new Promise((r) => (fin = r)));
    monter({ preparer });
    const b = await screen.findByRole("button", { name: /Réessayer/ });
    // Deux clics dans le même lot : le bouton est encore monté au second, seul le verrou protège.
    act(() => {
      fireEvent.click(b);
      fireEvent.click(b);
    });
    expect(preparer).toHaveBeenCalledTimes(2);
    await act(async () => fin({ data: PREPARE }));
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

describe("EmailEnvoi (D9 : pas d'e-mail personnalisé en v1)", () => {
  function email(over: Partial<React.ComponentProps<typeof EmailEnvoi>> = {}) {
    const envoyer = vi.fn(async () => ({ data: { enCorbeille: true as const } }));
    render(<EmailEnvoi destinataire="client@example.test" envoyer={envoyer} {...over} />);
    return { envoyer };
  }

  it("aucun choix de modèle, objet, message ni exemplaire : seul le destinataire se saisit", () => {
    email();
    expect(screen.queryByLabelText(/Modèle d'e-mail/)).toBeNull();
    expect(screen.queryByLabelText("Objet")).toBeNull();
    expect(screen.queryByLabelText("Message")).toBeNull();
    expect(screen.queryByRole("button", { name: /exemplaire/i })).toBeNull();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect((screen.getByLabelText("À") as HTMLInputElement).value).toBe("client@example.test");
  });

  it("l'adresse est en LECTURE SEULE : une frappe ne la change pas et c'est elle qui part", async () => {
    const { envoyer } = email();
    const champ = screen.getByLabelText("À") as HTMLInputElement;
    expect(champ.readOnly).toBe(true);
    fireEvent.change(champ, { target: { value: "autre@example.test" } });
    expect(champ.value).toBe("client@example.test");
    fireEvent.click(screen.getByRole("button", { name: /Envoyer au client/ }));
    await waitFor(() => expect(envoyer).toHaveBeenCalledWith({ a: "client@example.test" }));
  });

  it("« Envoyer au client » appelle l'envoi UNE fois (double clic neutralisé)", async () => {
    let fin!: (v: { data: { enCorbeille: true } }) => void;
    const envoyer = vi.fn(() => new Promise<{ data: { enCorbeille: true } }>((r) => (fin = r)));
    email({ envoyer });
    const b = screen.getByRole("button", { name: /Envoyer au client/ });
    fireEvent.click(b);
    fireEvent.click(b);
    expect(envoyer).toHaveBeenCalledTimes(1);
    expect(envoyer).toHaveBeenCalledWith({ a: "client@example.test" });
    await act(async () => fin({ data: { enCorbeille: true } }));
    expect(await screen.findByText(/en corbeille, à valider/i)).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: /Envoyer au client/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("aucun envoi à l'affichage", () => {
    const { envoyer } = email();
    expect(envoyer).not.toHaveBeenCalled();
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
