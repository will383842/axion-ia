// Capture des coordonnées du prospect — en DEUX temps.
//
// ── L'invariant que ce fichier protège ────────────────────────────────────
// Le téléphone ne doit JAMAIS apparaître dans le formulaire d'entrée. C'est le
// champ qui coûte le plus de conversions, parce que c'est celui qui fait penser
// « ils vont me harceler ». Il n'a le droit d'exister qu'APRÈS l'envoi du
// rapport, quand la personne a déjà reçu ce qu'elle venait chercher et que le
// refuser ne lui retire plus rien.
//
// Quelqu'un qui, dans six mois, remonterait le téléphone dans le formulaire
// principal « pour capter plus » obtiendrait l'inverse : moins d'e-mails, donc
// moins de leads. Ce test le lui dira.

import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReportEmailForm } from "../ReportEmailForm";
import { diagnose } from "@/lib/roi/diagnose";
import type { RoiAnswers } from "@/content/roi/model/types";

// Signature explicite : sans elle, `mock.calls[0]` est un tuple VIDE et
// l'assertion sur la `FormData` transmise ne compile pas. `pnpm test` ne
// typecheck pas — seul `pnpm typecheck` l'aurait vu, et c'est un gate de CI.
const submitRoiReportAction = vi.fn(async (_prev: unknown, _fd: FormData) => ({
  ok: true as const,
  submissionId: "uuid-de-test",
}));
const attachRoiCallbackAction = vi.fn(async (_prev: unknown, _fd: FormData) => ({
  ok: true as const,
}));

vi.mock("@/features/roi-report/actions", () => ({
  submitRoiReportAction: (prev: unknown, fd: FormData) => submitRoiReportAction(prev, fd),
  attachRoiCallbackAction: (prev: unknown, fd: FormData) => attachRoiCallbackAction(prev, fd),
}));
vi.mock("@/components/forms/TurnstileWidget", () => ({
  useTurnstileToken: () => ({ token: null, widget: null, reset: vi.fn() }),
}));

const ANSWERS: RoiAnswers = {
  sector: "btp_immobilier",
  headcount: "11-20",
  maturity: "bureautique",
  functions: ["administratif", "commercial"],
  volumes: { factures_emises_mois: 20, devis_emis_semaine: 6 },
};

function renderForm() {
  return render(<ReportEmailForm report={diagnose(ANSWERS)} locale="fr" />);
}

async function envoyer(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Votre prénom"), "Camille");
  await user.type(screen.getByLabelText("Votre e-mail professionnel"), "camille@exemple.fr");
  await user.click(screen.getByRole("checkbox"));
  await user.click(screen.getByRole("button", { name: /Recevoir mon rapport/i }));
}

beforeEach(() => {
  submitRoiReportAction.mockClear();
  attachRoiCallbackAction.mockClear();
});

describe("premier temps — le formulaire d'entrée", () => {
  it("ne demande QUE le prénom, l'e-mail et l'entreprise facultative", () => {
    renderForm();
    expect(screen.getByLabelText("Votre prénom")).toBeInTheDocument();
    expect(screen.getByLabelText("Votre e-mail professionnel")).toBeInTheDocument();
    expect(screen.getByLabelText(/Votre entreprise/)).toBeInTheDocument();
  });

  it("🔴 ne comporte AUCUN champ téléphone", () => {
    const { container } = renderForm();
    expect(container.querySelector('input[type="tel"]')).toBeNull();
  });

  it("exige le consentement avant d'appeler le serveur", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText("Votre prénom"), "Camille");
    await user.type(screen.getByLabelText("Votre e-mail professionnel"), "c@exemple.fr");
    await user.click(screen.getByRole("button", { name: /Recevoir mon rapport/i }));

    expect(submitRoiReportAction).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(/cocher la case/i);
  });
});

describe("second temps — le rappel téléphonique", () => {
  it("propose le téléphone UNE FOIS le rapport envoyé", async () => {
    const user = userEvent.setup();
    const { container } = renderForm();
    await envoyer(user);

    expect(await screen.findByText(/C'est parti/)).toBeInTheDocument();
    expect(container.querySelector('input[type="tel"]')).not.toBeNull();
  });

  it("annonce une contrepartie bornée et promet de ne pas relancer", async () => {
    // C'est ce qui fait la différence entre un numéro donné et un onglet fermé.
    const user = userEvent.setup();
    renderForm();
    await envoyer(user);

    expect(await screen.findByText(/Quinze minutes/)).toBeInTheDocument();
    expect(screen.getByText(/jamais de relance automatique/)).toBeInTheDocument();
  });

  it("garde le bouton inactif tant que le numéro est trop court", async () => {
    const user = userEvent.setup();
    const { container } = renderForm();
    await envoyer(user);
    await screen.findByText(/C'est parti/);

    const bouton = screen.getByRole("button", { name: /Me rappeler/i });
    expect(bouton).toBeDisabled();

    await user.type(container.querySelector('input[type="tel"]')!, "06 12 34 56 78");
    expect(bouton).toBeEnabled();
  });

  it("rattache le numéro au lead déjà créé, sans redemander l'e-mail", async () => {
    const user = userEvent.setup();
    const { container } = renderForm();
    await envoyer(user);
    await screen.findByText(/C'est parti/);

    await user.type(container.querySelector('input[type="tel"]')!, "06 12 34 56 78");
    await user.click(screen.getByRole("button", { name: /Me rappeler/i }));

    expect(attachRoiCallbackAction).toHaveBeenCalledTimes(1);
    const fd = attachRoiCallbackAction.mock.calls[0]![1];
    expect(fd.get("submissionId")).toBe("uuid-de-test");
    expect(fd.get("telephone")).toBe("06 12 34 56 78");

    expect(await screen.findByText(/C'est noté/)).toBeInTheDocument();
  });

  it("laisse le rapport acquis si le visiteur ignore le bloc", async () => {
    // Le refus est le geste par DÉFAUT : ne rien faire. Aucun bouton « non
    // merci » culpabilisant, et surtout aucune perte — le lead reste complet.
    const user = userEvent.setup();
    renderForm();
    await envoyer(user);

    expect(await screen.findByText(/C'est parti/)).toBeInTheDocument();
    expect(screen.getByText(/votre rapport vous est acquis dans tous les cas/)).toBeInTheDocument();
    expect(attachRoiCallbackAction).not.toHaveBeenCalled();
  });
});
