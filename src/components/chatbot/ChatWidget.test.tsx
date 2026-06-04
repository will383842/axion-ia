import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import frMessages from "@/messages/fr.json";
import type { ChatMessage } from "./types";

// Mock du hook de streaming : on contrôle messages/status/send sans réseau.
const sendMock = vi.fn();
let mockMessages: ChatMessage[] = [];
let mockStatus: "idle" | "streaming" | "error" = "idle";
vi.mock("./useChatStream", () => ({
  useChatStream: () => ({ messages: mockMessages, status: mockStatus, send: sendMock }),
}));

// Importé APRÈS le mock (vi.mock est hoisté, mais on garde l'ordre explicite).
import { ChatWidget } from "./ChatWidget";

function renderWidget() {
  return render(
    <NextIntlClientProvider locale="fr" messages={frMessages}>
      <ChatWidget />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  sendMock.mockClear();
  mockMessages = [];
  mockStatus = "idle";
});

describe("ChatWidget — bulle & ouverture", () => {
  it("rend la bulle avec aria-label, panneau fermé par défaut", () => {
    renderWidget();
    expect(screen.getByRole("button", { name: "Ouvrir l'assistant Axion-IA" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("ouvre le panneau au clic et affiche la mention IA + l'intro", () => {
    renderWidget();
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir l'assistant Axion-IA" }));
    const dialog = screen.getByRole("dialog", { name: "Assistant Axion-IA" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(/Vous dialoguez avec une IA/i)).toBeInTheDocument();
    expect(within(dialog).getByPlaceholderText("Posez votre question…")).toBeInTheDocument();
  });

  it("ferme le panneau via Échap et rend le focus à la bulle", () => {
    renderWidget();
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir l'assistant Axion-IA" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ouvrir l'assistant Axion-IA" })).toHaveFocus();
  });

  it("ferme via le bouton Fermer", () => {
    renderWidget();
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir l'assistant Axion-IA" }));
    fireEvent.click(screen.getByRole("button", { name: "Fermer l'assistant" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("ChatWidget — envoi", () => {
  it("appelle send avec la saisie et vide le champ", () => {
    renderWidget();
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir l'assistant Axion-IA" }));
    const input = screen.getByPlaceholderText("Posez votre question…") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "formations à 2000 €" } });
    fireEvent.click(screen.getByRole("button", { name: "Envoyer" }));
    expect(sendMock).toHaveBeenCalledWith("formations à 2000 €");
    expect(input.value).toBe("");
  });

  it("désactive Envoyer si la saisie est vide", () => {
    renderWidget();
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir l'assistant Axion-IA" }));
    expect(screen.getByRole("button", { name: "Envoyer" })).toBeDisabled();
  });
});

describe("ChatWidget — rendu des réponses", () => {
  it("affiche une carte d'offre avec son lien quand sendLinks=true", () => {
    mockMessages = [
      { id: "u-1", role: "user", text: "audit" },
      {
        id: "a-1",
        role: "assistant",
        text: "Voici une offre :",
        sendLinks: true,
        cards: [
          {
            id: "audit-sur-place",
            titre: "Audit sur place",
            prix: "1 190 € HT",
            urlFR: "/fr/audit",
            onQuote: false,
          },
        ],
      },
    ];
    renderWidget();
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir l'assistant Axion-IA" }));
    expect(screen.getByText("Audit sur place")).toBeInTheDocument();
    expect(screen.getByText("1 190 € HT")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Voir l'offre" });
    expect(link).toHaveAttribute("href", "/fr/audit");
  });

  it("masque le lien d'offre tant que sendLinks=false (confirmation requise)", () => {
    mockMessages = [
      {
        id: "a-1",
        role: "assistant",
        text: "J'ai trouvé une offre.",
        sendLinks: false,
        cards: [
          {
            id: "x",
            titre: "Audit sur place",
            prix: "1 190 € HT",
            urlFR: "/fr/audit",
            onQuote: false,
          },
        ],
      },
    ];
    renderWidget();
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir l'assistant Axion-IA" }));
    expect(screen.getByText("Audit sur place")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Voir l'offre" })).not.toBeInTheDocument();
  });

  it("affiche le CTA RDV et les sources", () => {
    mockMessages = [
      {
        id: "a-1",
        role: "assistant",
        text: "Je vous propose un rendez-vous.",
        rdvUrl: "/fr/appel",
        sources: [{ sourceType: "kb", sourceRef: "/fr/audit" }],
      },
    ];
    renderWidget();
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir l'assistant Axion-IA" }));
    expect(screen.getByRole("link", { name: "Prendre rendez-vous" })).toHaveAttribute(
      "href",
      "/fr/appel",
    );
    expect(screen.getByText(/Sources/i)).toBeInTheDocument();
  });

  it("affiche le message d'erreur en mode dégradé", () => {
    mockStatus = "error";
    renderWidget();
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir l'assistant Axion-IA" }));
    expect(screen.getByText(/Un souci est survenu/i)).toBeInTheDocument();
  });
});
