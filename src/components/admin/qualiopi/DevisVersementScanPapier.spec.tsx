/**
 * Formulaire de versement du scan d'un devis signé sur papier.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { DevisVersementScanPapier } from "./DevisVersementScanPapier";
import type { ResultatVersementScan } from "@/server/actions/qualiopi/devis-scan-papier";

const DEVIS_ID = "11111111-1111-4111-8111-111111111111";
const pdf = () =>
  new File(["%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF"], "devis.pdf", { type: "application/pdf" });
const ATTESTATION = /original papier est conservé par Axion-IA/;

beforeEach(() => refresh.mockReset());
afterEach(cleanup);

function monter(
  action: (fd: FormData) => Promise<ResultatVersementScan>,
  validiteDepassee: string | null = null,
) {
  const user = userEvent.setup();
  render(
    <DevisVersementScanPapier
      devisId={DEVIS_ID}
      signataireNom="Jean Dupont"
      organismeNom="Axion-IA"
      validiteDepassee={validiteDepassee}
      verserAction={action}
    />,
  );
  return user;
}

async function ouvrir(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Verser le devis signé (scan PDF)" }));
}

async function remplir(
  user: ReturnType<typeof userEvent.setup>,
  f: File | null = pdf(),
  cocher = true,
) {
  if (f !== null) {
    // `applyAccept: false` : le filtre `accept` d'user-event écarterait le PNG avant notre contrôle
    const champ = screen.getByLabelText("Scan du devis signé (PDF)");
    await userEvent.setup({ applyAccept: false }).upload(champ, f);
  }
  if (cocher) await user.click(screen.getByLabelText(ATTESTATION));
}

const verser = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: "Verser le scan signé" }));

describe("F2 — validité dépassée et date écrite par le client", () => {
  it("avertissement_texte_exact", async () => {
    const user = monter(vi.fn(), "10/11/2026");
    await ouvrir(user);
    expect(
      screen.getByText(
        "La date de validité de ce devis (10/11/2026) est dépassée. Le scan sera tout de même accepté : en le versant, vous acceptez l'accord tardif du client aux conditions du PDF d'origine.",
      ),
    ).toBeTruthy();
    expect(document.body.textContent).not.toContain("ne versez le scan que si");
  });

  it("champ_date_libelle_aide_max", async () => {
    const user = monter(vi.fn());
    await ouvrir(user);
    const champ = screen.getByLabelText(
      "Date écrite par le client sur le devis (facultatif)",
    ) as HTMLInputElement;
    expect(champ.type).toBe("date");
    expect(champ.name).toBe("dateEcriteParClient");
    expect(champ.max).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(
      screen.getByText(
        "Recopiez la date qui figure près de sa signature, s'il en a écrit une. Elle est gardée pour information : la signature est enregistrée à la date du versement, et le scan fait foi.",
      ),
    ).toBeTruthy();
  });

  it("date_envoyee_dans_formdata", async () => {
    const action = vi.fn().mockResolvedValue({ ok: false, message: "fin" });
    const user = monter(action);
    await ouvrir(user);
    await remplir(user);
    fireEvent.change(screen.getByLabelText("Date écrite par le client sur le devis (facultatif)"), {
      target: { value: "2026-11-12" },
    });
    await verser(user);
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect((action.mock.calls[0]![0] as FormData).get("dateEcriteParClient")).toBe("2026-11-12");
  });

  it("statut_apres_versement_validite_depassee", async () => {
    const user = monter(
      vi.fn().mockResolvedValue({ ok: true, signatureId: "s", statutSignature: "partielle" }),
      "10/11/2026",
    );
    await ouvrir(user);
    await remplir(user);
    await verser(user);
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        "Scan versé : le devis est enregistré comme signé par le client, sur papier, après sa date de validité. Contresignez-le pour le conclure.",
      ),
    );
  });
});

describe("DevisVersementScanPapier", () => {
  it("ouvre le formulaire : champ fichier et case d'attestation", async () => {
    const user = monter(vi.fn());
    await ouvrir(user);
    expect(screen.getByLabelText("Scan du devis signé (PDF)")).toBeTruthy();
    expect(screen.getByLabelText(ATTESTATION)).toBeTruthy();
  });

  it("case non cochée : action non appelée, case invalide et focalisée", async () => {
    const action = vi.fn();
    const user = monter(action);
    await ouvrir(user);
    await remplir(user, pdf(), false);
    await verser(user);
    expect(action).not.toHaveBeenCalled();
    expect(screen.getByText("Cochez l'attestation avant de verser le scan.")).toBeTruthy();
    const c = screen.getByLabelText(ATTESTATION);
    expect(c.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(c);
  });

  it("sans fichier", async () => {
    const action = vi.fn();
    const user = monter(action);
    await ouvrir(user);
    await remplir(user, null, true);
    await verser(user);
    expect(action).not.toHaveBeenCalled();
    expect(screen.getByText("Choisissez le fichier PDF du devis signé.")).toBeTruthy();
  });

  it("fichier PNG refusé", async () => {
    const action = vi.fn();
    const user = monter(action);
    await ouvrir(user);
    await remplir(user, new File(["x"], "photo.png", { type: "image/png" }));
    await verser(user);
    expect(action).not.toHaveBeenCalled();
    expect(screen.getByText("Le fichier doit être un PDF.")).toBeTruthy();
  });

  it("fichier trop lourd", async () => {
    const action = vi.fn();
    const user = monter(action);
    await ouvrir(user);
    const f = pdf();
    Object.defineProperty(f, "size", { value: 10 * 1024 * 1024 + 1 });
    await remplir(user, f);
    await verser(user);
    expect(action).not.toHaveBeenCalled();
    expect(screen.getByText("Le fichier dépasse 10 Mo.")).toBeTruthy();
  });

  it.each([
    "Votre session a expiré ou vos droits sont insuffisants pour verser ce scan.",
    "Ce devis est introuvable.",
    "Ce devis ne peut pas recevoir de scan signé : il doit être envoyé, classique (sans formules), avec sa pièce en vigueur.",
    "La fiche client ne porte pas de nom de signataire : renseignez-la d'abord.",
    "Ce devis est déjà signé par le client.",
    "Ce scan a déjà été versé.",
    "Le scan n'a pas pu être enregistré. Rien n'a été versé : réessayez.",
  ])("refus de l'action affiché mot pour mot : %s", async (message) => {
    const action = vi.fn().mockResolvedValue({ ok: false, message });
    const user = monter(action);
    await ouvrir(user);
    await remplir(user);
    await verser(user);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(message));
    expect(action).toHaveBeenCalledTimes(1);
    const fd = action.mock.calls[0]![0] as FormData;
    expect(fd.get("devisId")).toBe(DEVIS_ID);
    expect(fd.get("fichier")).toBeInstanceOf(File);
    expect(fd.get("attestation")).toBe("true");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("exception de l'action : erreur inattendue", async () => {
    const user = monter(vi.fn().mockRejectedValue(new Error("boom")));
    await ouvrir(user);
    await remplir(user);
    await verser(user);
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("erreur inattendue"),
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it("succès partielle : statut puis rafraîchissement", async () => {
    const user = monter(
      vi.fn().mockResolvedValue({ ok: true, signatureId: "s", statutSignature: "partielle" }),
    );
    await ouvrir(user);
    await remplir(user);
    await verser(user);
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        "Scan versé : le devis est enregistré comme signé par le client, sur papier.",
      ),
    );
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("succès avec activation refusée : alerte, pas de rafraîchissement automatique", async () => {
    const user = monter(
      vi.fn().mockResolvedValue({
        ok: true,
        signatureId: "s",
        statutSignature: "signee",
        activationRefusee: "La suite n'a pas pu être lancée.",
      }),
    );
    await ouvrir(user);
    await remplir(user);
    await verser(user);
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("La suite n'a pas pu être lancée."),
    );
    expect(refresh).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Actualiser la fiche" }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("en cours : bouton occupé et désactivé, un seul appel", async () => {
    let fin: (r: ResultatVersementScan) => void = () => undefined;
    const action = vi.fn(() => new Promise<ResultatVersementScan>((r) => (fin = r)));
    const user = monter(action);
    await ouvrir(user);
    await remplir(user);
    await verser(user);
    const bouton = await screen.findByRole("button", { name: "Verser le scan signé" });
    await waitFor(() => expect(bouton.getAttribute("aria-busy")).toBe("true"));
    expect((bouton as HTMLButtonElement).disabled).toBe(true);
    await user.click(bouton);
    expect(action).toHaveBeenCalledTimes(1);
    fin({ ok: false, message: "fin" });
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("fin"));
  });

  it("Annuler referme le formulaire", async () => {
    const user = monter(vi.fn());
    await ouvrir(user);
    await user.click(screen.getByRole("button", { name: "Annuler" }));
    expect(screen.getByRole("button", { name: "Verser le devis signé (scan PDF)" })).toBeTruthy();
    expect(screen.queryByLabelText("Scan du devis signé (PDF)")).toBeNull();
  });

  it("dit que le scan versé est scellé et ne peut pas être retiré", async () => {
    const user = monter(vi.fn());
    await ouvrir(user);
    expect(
      screen.getByText(
        "Une fois versé, le scan est scellé et ne peut pas être retiré depuis cet écran.",
      ),
    ).toBeTruthy();
  });

  it("le bouton d'ouverture ne déclare ni aria-expanded ni aria-controls", () => {
    monter(vi.fn());
    const b = screen.getByRole("button", { name: "Verser le devis signé (scan PDF)" });
    expect(b.hasAttribute("aria-expanded")).toBe(false);
    expect(b.hasAttribute("aria-controls")).toBe(false);
  });

  it.each([
    ["succès simple", { ok: true, signatureId: "s", statutSignature: "signee" }],
    [
      "succès avec activation refusée",
      { ok: true, signatureId: "s", statutSignature: "signee", activationRefusee: "Refus." },
    ],
  ] as Array<[string, ResultatVersementScan]>)(
    "%s : « Verser le scan signé » disparaît, « Actualiser la fiche » reste",
    async (_nom, res) => {
      const user = monter(vi.fn().mockResolvedValue(res));
      await ouvrir(user);
      await remplir(user);
      await verser(user);
      await screen.findByRole("button", { name: "Actualiser la fiche" });
      expect(screen.queryByRole("button", { name: "Verser le scan signé" })).toBeNull();
    },
  );
});
