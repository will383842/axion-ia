import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import { ProviderFormClient } from "../ProviderFormClient";

const row = (provider: string) => ({
  id: provider,
  provider,
  role: "text",
  apiKeyEnvVar: "X",
  enabled: true,
  model: "m",
  monthlyCapUsd: 10,
  rateLimitRpm: null,
  currentMonthSpentUsd: 0,
  blogClaude: { jour: 1, mois: 10, reserve: 2, jugeMax: 3 },
});

describe("ProviderFormClient — plafonds du blog", () => {
  const sans = vi.fn(async () => {});
  it("openai : aucun champ du blog", () => {
    render(
      <ProviderFormClient
        row={row("openai")}
        saveAction={sans}
        resetSpendAction={sans}
        saveBlogAction={vi.fn(async () => ({ ok: true as const }))}
      />,
    );
    expect(screen.queryByLabelText("Relectures max par jour")).toBeNull();
  });
  it("anthropic sans action : aucun champ", () => {
    render(<ProviderFormClient row={row("anthropic")} saveAction={sans} resetSpendAction={sans} />);
    expect(screen.queryByLabelText("Relectures max par jour")).toBeNull();
  });
  it("anthropic avec action : 4 champs pré-remplis, envoi à 4 entrées", async () => {
    const blog = vi.fn(async (_fd: FormData) => ({ ok: true as const }));
    render(
      <ProviderFormClient
        row={row("anthropic")}
        saveAction={sans}
        resetSpendAction={sans}
        saveBlogAction={blog}
      />,
    );
    expect((screen.getByLabelText("Plafond du jour (USD)") as HTMLInputElement).value).toBe("1");
    expect((screen.getByLabelText("Relectures max par jour") as HTMLInputElement).value).toBe("3");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer les plafonds du blog" }));
    await waitFor(() => expect(blog).toHaveBeenCalledTimes(1));
    const fd = blog.mock.calls[0]![0];
    expect([...fd.keys()].sort()).toEqual(["jour", "jugeMax", "mois", "reserve"]);
    expect(sans).not.toHaveBeenCalled();
  });
  it("ok:false → message affiché", async () => {
    const blog = vi.fn(async () => ({ ok: false as const, message: "Refus de test" }));
    render(
      <ProviderFormClient
        row={row("anthropic")}
        saveAction={sans}
        resetSpendAction={sans}
        saveBlogAction={blog}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer les plafonds du blog" }));
    expect(await screen.findByText("Refus de test")).toBeTruthy();
  });
  it("le formulaire principal n'envoie aucun champ du blog", async () => {
    const save = vi.fn(async (_fd: FormData) => {});
    render(
      <ProviderFormClient
        row={row("anthropic")}
        saveAction={save}
        resetSpendAction={sans}
        saveBlogAction={vi.fn(async () => ({ ok: true as const }))}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(save).toHaveBeenCalled());
    const cles = [...save.mock.calls[0]![0].keys()];
    for (const c of ["jour", "mois", "reserve", "jugeMax"]) expect(cles).not.toContain(c);
  });
  it("blogClaude null → champs vides", () => {
    render(
      <ProviderFormClient
        row={{ ...row("anthropic"), blogClaude: null }}
        saveAction={sans}
        resetSpendAction={sans}
        saveBlogAction={vi.fn(async () => ({ ok: true as const }))}
      />,
    );
    expect((screen.getByLabelText("Plafond du jour (USD)") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Relectures max par jour") as HTMLInputElement).value).toBe("");
  });
  it("clés absentes → champs vides", () => {
    const { blogClaude: _b, ...sansBlog } = row("anthropic");
    render(
      <ProviderFormClient
        row={sansBlog}
        saveAction={sans}
        resetSpendAction={sans}
        saveBlogAction={vi.fn(async () => ({ ok: true as const }))}
      />,
    );
    expect((screen.getByLabelText("Plafond mensuel du blog (USD)") as HTMLInputElement).value).toBe(
      "",
    );
  });
  it("bouton désactivé pendant l'envoi", async () => {
    let fin: (v: { ok: true }) => void = () => {};
    const blog = vi.fn(() => new Promise<{ ok: true }>((r) => (fin = r)));
    render(
      <ProviderFormClient
        row={row("anthropic")}
        saveAction={sans}
        resetSpendAction={sans}
        saveBlogAction={blog}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer les plafonds du blog" }));
    const bouton = await screen.findByRole("button", { name: "Enregistrement…" });
    expect((bouton as HTMLButtonElement).disabled).toBe(true);
    fin({ ok: true });
    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
  });
  it("action qui lève → message d'erreur, sans planter", async () => {
    const blog = vi.fn(async () => {
      throw new Error("Panne de test");
    });
    render(
      <ProviderFormClient
        row={row("anthropic")}
        saveAction={sans}
        resetSpendAction={sans}
        saveBlogAction={blog}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer les plafonds du blog" }));
    expect(await screen.findByText("Panne de test")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });
  it("ok:true → confirmation affichée", async () => {
    render(
      <ProviderFormClient
        row={row("anthropic")}
        saveAction={sans}
        resetSpendAction={sans}
        saveBlogAction={vi.fn(async () => ({ ok: true as const }))}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer les plafonds du blog" }));
    expect((await screen.findByRole("status")).textContent).toBe("Plafonds du blog enregistrés.");
  });
});
