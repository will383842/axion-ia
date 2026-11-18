/**
 * I3-1 : `emails-envoyes/reponses/[source]/[id]` — lecture d'une réponse écrite à la main.
 *
 * Donnée de personne : la page ne LIT qu'après `gardePage("consultation")` (vraie garde, seule la
 * session est doublée) ; une réponse de candidat exige en plus le droit « dossier candidat ».
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

const d = vi.hoisted(() => ({ session: null as unknown, lire: vi.fn() }));

vi.mock("@/auth", () => ({ auth: () => Promise.resolve(d.session) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/features/admin-emails/reponses-manuelles", async (orig) => ({
  ...(await orig<typeof import("@/features/admin-emails/reponses-manuelles")>()),
  lireReponseManuelle: (...a: unknown[]) => d.lire(...a),
}));

import Page, { dynamic } from "../page";

const ID = "cm0abcdefghijklmnopqrstuv";
const PARENT = "11111111-1111-4111-8111-111111111111";
const FICHE = "33333333-3333-4333-8333-333333333333";
const appel = (source: string) =>
  Page({
    params: Promise.resolve({ adminPrefix: "p", source, id: ID }),
  } as never) as Promise<ReactElement>;

const reponse = (source: "demande" | "candidature") => ({
  source,
  id: ID,
  parentId: PARENT,
  ficheClientId: source === "demande" ? FICHE : null,
  sujet: "Votre demande",
  destinataire: "alice@example.invalid",
  de: '"Axion-IA" <contact@axion-ia.com>',
  repondreA: "contact@axion-ia.com",
  html: "<p>Bonjour Alice</p>",
  texte: "Bonjour Alice",
  preEntete: "",
  statut: "echec",
  date: new Date("2026-11-10T10:00:00Z"),
  envoyeLe: null,
  echecLe: new Date("2026-11-10T10:01:00Z"),
  erreur: "Relais indisponible",
  auteur: "Le fondateur",
  noteInterne: "Rappeler jeudi",
});

beforeEach(() => {
  d.lire.mockReset();
  d.session = null;
});

describe("la page de lecture d'une réponse", () => {
  it("jamais pré-rendue", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("6) sans session : connexion, et AUCUNE lecture", async () => {
    await expect(appel("demande")).rejects.toThrow("NEXT_REDIRECT /fr/p/login");
    expect(d.lire).not.toHaveBeenCalled();
  });

  it("6) rôle sans accès à la console : refus nommé, AUCUNE lecture", async () => {
    d.session = { user: { id: "u", role: "client" } };
    const html = renderToStaticMarkup(await appel("demande"));
    expect(html).toContain("Cet écran ne vous est pas ouvert");
    expect(d.lire).not.toHaveBeenCalled();
  });

  it("6) réponse à un candidat avec reader : AccesRefuse, AUCUNE lecture", async () => {
    d.session = { user: { id: "u", role: "reader" } };
    const html = renderToStaticMarkup(await appel("candidature"));
    expect(html).toContain("Cet écran ne vous est pas ouvert");
    expect(html).not.toContain("Bonjour Alice");
    expect(d.lire).not.toHaveBeenCalled();
  });

  it("source inconnue : 404, AUCUNE lecture", async () => {
    d.session = { user: { id: "u", role: "admin" } };
    await expect(appel("manuel")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(d.lire).not.toHaveBeenCalled();
  });

  it("réponse inconnue : 404", async () => {
    d.session = { user: { id: "u", role: "admin" } };
    d.lire.mockResolvedValue(null);
    await expect(appel("demande")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("6) demande : lecteur isolé, liens vers la demande, la fiche client et le plein écran", async () => {
    d.session = { user: { id: "u", role: "reader" } };
    d.lire.mockResolvedValue(reponse("demande"));
    const html = renderToStaticMarkup(await appel("demande"));
    expect(d.lire).toHaveBeenCalledWith("demande", ID, "reader");
    expect(html).toMatch(/<iframe[^>]*sandbox=""/);
    expect(html).toContain(`/fr/p/contacts/messages/${PARENT}`);
    expect(html).toContain(`/fr/p/qualiopi/clients/${FICHE}`);
    expect(html).toContain(`/fr/p/emails/lecture/reponse-demande/${ID}`);
    expect(html).toContain("Note interne, jamais envoyée");
    expect(html).toContain("Rappeler jeudi");
    expect(html).toContain("Relais indisponible");
    expect(html).toContain("Le fondateur");
  });

  it("6) candidature (admin) : lien vers la candidature, pas de fiche client", async () => {
    d.session = { user: { id: "u", role: "admin" } };
    d.lire.mockResolvedValue(reponse("candidature"));
    const html = renderToStaticMarkup(await appel("candidature"));
    expect(d.lire).toHaveBeenCalledWith("candidature", ID, "admin");
    expect(html).toContain(`/fr/p/contacts/candidatures/${PARENT}`);
    expect(html).not.toContain("/qualiopi/clients/");
    expect(html).toContain(`/fr/p/emails/lecture/reponse-candidature/${ID}`);
  });

  it("aucun mot interdit dans le texte visible", async () => {
    d.session = { user: { id: "u", role: "admin" } };
    d.lire.mockResolvedValue(reponse("demande"));
    const html = renderToStaticMarkup(await appel("demande"));
    const visible = html.replace(/\s(?:href|srcdoc)="[^"]*"/g, "");
    expect(visible).not.toMatch(/Qualiopi|OPCO|prise en charge|financeur/i);
  });
});
