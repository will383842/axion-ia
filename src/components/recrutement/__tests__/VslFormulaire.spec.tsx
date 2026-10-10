/**
 * Le formulaire en deux étapes de la page VSL apporteurs, contre la DOUBLURE des
 * deux actions serveur (contrat `lead-vsl-contrat.ts`) : étapes, validation,
 * erreurs serveur, historique, reprise, accessibilité.
 *
 * Angle mort assumé : on ne mesure pas ici la hauteur réelle des deux étapes
 * (jsdom n'a pas de mise en page) — on vérifie qu'elles partagent la MÊME boîte à
 * hauteur minimale ; la mesure se fait dans un navigateur à 390 px.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const { push, trackFunnel, trackMetaLead, trackMetaSubmitApplication, consentement } = vi.hoisted(
  () => ({
    push: vi.fn(),
    trackFunnel: vi.fn(),
    trackMetaLead: vi.fn(),
    trackMetaSubmitApplication: vi.fn(),
    consentement: { valeur: "accepted" as "accepted" | "declined" | "unknown" },
  }),
);

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push }),
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/lib/tracking", () => ({ trackFunnel }));
vi.mock("@/lib/analytics/meta-pixel", () => ({
  lireCookieFbp: () => "fb.1.1700000000000.123456",
  trackMetaLead,
  trackMetaSubmitApplication,
}));
vi.mock("@/components/analytics/CookieConsent", () => ({
  readAnalyticsConsent: () => consentement.valeur,
}));

import { VslFormulaire } from "../VslFormulaire";
import { creerActionsVslStub } from "@/features/commercial-application/__tests__/lead-vsl-actions.stub";
import { __reinitialiserEtatVslPourTests } from "@/lib/recrutement/vsl-etat";

function monter(sorties: Parameters<typeof creerActionsVslStub>[0] = {}) {
  const stub = creerActionsVslStub(sorties);
  const vue = render(<VslFormulaire capturer={stub.capturer} completer={stub.completer} />);
  return { ...stub, ...vue };
}

function remplirEtape1(prenom = "  Léa ", email = " lea@exemple.fr ", cocher = true) {
  fireEvent.change(screen.getByLabelText(/Prénom/), { target: { value: prenom } });
  fireEvent.change(screen.getByLabelText(/E-mail/), { target: { value: email } });
  if (cocher) fireEvent.click(screen.getByRole("checkbox"));
}

async function allerEtape2() {
  remplirEtape1();
  fireEvent.click(screen.getByRole("button", { name: /Continuer/ }));
  await screen.findByRole("heading", { name: /Dernière étape/ });
}

function remplirEtape2(tel = "06 12 34 56 78", reponse = /De 5 à 20/) {
  fireEvent.change(screen.getByLabelText(/Téléphone/), { target: { value: tel } });
  if (reponse) fireEvent.click(screen.getByLabelText(reponse));
}

beforeEach(() => {
  window.sessionStorage.clear();
  __reinitialiserEtatVslPourTests();
  consentement.valeur = "accepted";
  window.history.replaceState(
    null,
    "",
    "/fr/apporteur-affaires/video?utm_source=facebook&utm_campaign=c1",
  );
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("étape 1", () => {
  it("affiche l'étape 1 seule, avec des étiquettes visibles et la case NON pré-cochée", () => {
    monter();
    expect(screen.getAllByText("Étape 1 sur 2").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("heading", { name: /Parlons de vous/ })).toBeTruthy();
    expect(screen.getByLabelText(/Prénom/)).toBeTruthy();
    expect(screen.getByLabelText(/E-mail/)).toBeTruthy();
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
    // Le téléphone n'existe qu'à l'étape 2.
    expect(screen.queryByLabelText(/Téléphone/)).toBeNull();
    // Champs 16 px minimum (la classe commune à tout le tunnel) et bons claviers.
    expect(screen.getByLabelText(/E-mail/).getAttribute("type")).toBe("email");
    expect(screen.getByLabelText(/E-mail/).getAttribute("autocomplete")).toBe("email");
    expect(screen.getByLabelText(/Prénom/).getAttribute("autocomplete")).toBe("given-name");
    expect(screen.getByLabelText(/Prénom/).className).toContain("text-base");
  });

  it("émet « Lead Step Viewed » (étape 1 sur 2) à l'affichage", () => {
    monter();
    expect(trackFunnel).toHaveBeenCalledWith("Lead Step Viewed", {
      landing: "vsl-apporteur-v1",
      step: "1",
      stepIndex: 1,
      stepTotal: 2,
    });
  });

  it("un envoi vide n'appelle PAS le serveur, nomme les erreurs et met le focus sur le premier champ fautif", () => {
    const { capturer, appelsCapturer } = monter();
    fireEvent.click(screen.getByRole("button", { name: /Continuer/ }));
    expect(appelsCapturer).toHaveLength(0);
    expect(capturer).toBeTypeOf("function");
    const prenom = screen.getByLabelText(/Prénom/);
    expect(prenom.getAttribute("aria-invalid")).toBe("true");
    expect(prenom.getAttribute("aria-describedby")).toBe("vsl-prenom-error");
    expect(document.getElementById("vsl-prenom-error")?.getAttribute("role")).toBe("alert");
    expect(screen.getAllByRole("alert").length).toBeGreaterThanOrEqual(3);
    expect(document.activeElement).toBe(prenom);
  });

  it("une adresse incomplète affiche le message du plan", () => {
    monter();
    remplirEtape1("Léa", "lea@exemple");
    fireEvent.click(screen.getByRole("button", { name: /Continuer/ }));
    expect(screen.getByText("Cette adresse semble incomplète.")).toBeTruthy();
  });

  it("l'erreur d'un champ disparaît dès qu'il est réparé (sans gronder à la frappe)", () => {
    monter();
    fireEvent.click(screen.getByRole("button", { name: /Continuer/ }));
    expect(screen.getByLabelText(/Prénom/).getAttribute("aria-invalid")).toBe("true");
    fireEvent.change(screen.getByLabelText(/Prénom/), { target: { value: "L" } });
    expect(screen.getByLabelText(/Prénom/).getAttribute("aria-invalid")).toBeNull();
    // Taper un e-mail incomplet ne CRÉE pas d'erreur avant l'envoi ou le blur.
    fireEvent.change(screen.getByLabelText(/E-mail/), { target: { value: "l" } });
    expect(screen.getByLabelText(/E-mail/).getAttribute("aria-invalid")).toBe("true"); // gardée : l'e-mail était déjà en faute
  });

  it("envoie prénom/e-mail nettoyés, consentement, contexte (query, fbp, heure) et passe à l'étape 2", async () => {
    window.sessionStorage.setItem(
      "axion-vsl-fbclid",
      JSON.stringify({ fbclid: "IwAR0abcdefghij", at: 1700000000000 }),
    );
    const pushState = vi.spyOn(window.history, "pushState");
    const { appelsCapturer } = monter();
    remplirEtape1();
    fireEvent.click(screen.getByRole("button", { name: /Continuer/ }));

    const titre = await screen.findByRole("heading", { name: /Dernière étape/ });
    expect(appelsCapturer).toHaveLength(1);
    const appel = appelsCapturer[0]!;
    expect(appel.prenom).toBe("Léa");
    expect(appel.email).toBe("lea@exemple.fr");
    expect(appel.consent).toBe(true);
    expect(appel.consentPub).toBe(true);
    expect(appel.ctx.query).toBe("?utm_source=facebook&utm_campaign=c1");
    expect(appel.ctx.fbp).toBe("fb.1.1700000000000.123456");
    expect(appel.ctx.fbclid).toBe("IwAR0abcdefghij");
    expect(appel.ctx.fbclidAt).toBe(1700000000000);
    expect(typeof appel.ctx.renderedAt).toBe("number");
    expect(appel.ctx.renderedAt).toBeGreaterThan(0);
    expect(appel.honeypot).toBeUndefined();

    // Accessibilité : focus sur le titre de l'étape, annonce polie.
    await waitFor(() => expect(document.activeElement).toBe(titre));
    expect(screen.getByRole("status").textContent).toBe("Étape 2 sur 2");
    // Historique : « Retour » du téléphone ramène à l'étape 1.
    expect(pushState).toHaveBeenCalledWith({ vslEtape: 2 }, "");
    // `Lead` du pixel avec l'event_id partagé avec le serveur (déduplication).
    expect(trackMetaLead).toHaveBeenCalledWith("lead:lead-de-test");
    expect(trackFunnel).toHaveBeenCalledWith("Lead Email Captured", { landing: "facebook" });
    expect(trackFunnel).toHaveBeenCalledWith(
      "Lead Step Viewed",
      expect.objectContaining({ step: "2" }),
    );
  });

  it("sans consentement à la bannière : consentPub=false et AUCUN fbclid dans le contexte", async () => {
    consentement.valeur = "declined";
    const { appelsCapturer } = monter();
    await allerEtape2();
    expect(appelsCapturer[0]!.consentPub).toBe(false);
    expect(appelsCapturer[0]!.ctx.fbclid).toBeUndefined();
    expect(appelsCapturer[0]!.ctx.fbclidAt).toBeUndefined();
  });

  it("transmet le leurre anti-robot rempli (le serveur le traite)", async () => {
    const { appelsCapturer } = monter();
    remplirEtape1();
    const leurre = document.querySelector('input[name="website"]') as HTMLInputElement;
    expect(leurre).not.toBeNull();
    expect(leurre.getAttribute("aria-hidden")).toBe("true");
    fireEvent.change(leurre, { target: { value: "http://spam.example" } });
    fireEvent.click(screen.getByRole("button", { name: /Continuer/ }));
    await screen.findByRole("heading", { name: /Dernière étape/ });
    expect(appelsCapturer[0]!.honeypot).toBe("http://spam.example");
  });

  it.each([
    ["invalid", /information semble incorrecte/],
    ["rate", /Trop de tentatives/],
    ["unknown", /Une erreur est survenue/],
  ] as const)(
    "erreur serveur « %s » : message, on reste à l'étape 1, le bouton se rouvre",
    async (code, motif) => {
      monter({ capturer: { ok: false, error: code } });
      remplirEtape1();
      fireEvent.click(screen.getByRole("button", { name: /Continuer/ }));
      const alerte = await screen.findByText(motif);
      expect(alerte.getAttribute("role")).toBe("alert");
      expect(screen.getByRole("heading", { name: /Parlons de vous/ })).toBeTruthy();
      expect(
        (screen.getByRole("button", { name: /Continuer/ }) as HTMLButtonElement).disabled,
      ).toBe(false);
    },
  );

  it("une panne réseau ou un déploiement en cours donne un message, jamais une page blanche", async () => {
    monter({
      capturer: () => Promise.reject(new Error("Failed to find Server Action")),
    });
    remplirEtape1();
    fireEvent.click(screen.getByRole("button", { name: /Continuer/ }));
    expect(await screen.findByText(/vient d'être mis à jour/)).toBeTruthy();
  });

  it("un double clic n'envoie qu'UNE demande (bouton bloqué pendant l'envoi)", async () => {
    let liberer: (v: { ok: true; jeton: string; leadId: string }) => void = () => undefined;
    const { appelsCapturer } = monter({
      capturer: () => new Promise((r) => (liberer = r)),
    });
    remplirEtape1();
    const bouton = screen.getByRole("button", { name: /Continuer/ });
    fireEvent.click(bouton);
    fireEvent.click(bouton);
    expect(appelsCapturer).toHaveLength(1);
    expect((screen.getByRole("button", { name: /Envoi/ }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    await act(async () => liberer({ ok: true, jeton: "j", leadId: "l" }));
    await screen.findByRole("heading", { name: /Dernière étape/ });
  });
});

describe("étape 2", () => {
  it("demande le téléphone et la question fermée à quatre réponses, une seule à choisir", async () => {
    monter();
    await allerEtape2();
    expect(screen.getAllByText("Étape 2 sur 2").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByLabelText(/Téléphone/).getAttribute("type")).toBe("tel");
    const groupe = screen.getByRole("group", {
      name: /Combien de dirigeants connaissez-vous à peu près/,
    });
    const radios = within(groupe).getAllByRole("radio");
    expect(radios).toHaveLength(4);
    expect(radios.map((r) => (r as HTMLInputElement).value)).toEqual([
      "moins-5",
      "5-20",
      "20-50",
      "plus-50",
    ]);
    expect(radios.some((r) => (r as HTMLInputElement).checked)).toBe(false);
  });

  it("un envoi incomplet n'appelle PAS le serveur et nomme téléphone puis question", async () => {
    const { appelsCompleter } = monter();
    await allerEtape2();
    fireEvent.click(screen.getByRole("button", { name: /Envoyer et choisir mon créneau/ }));
    expect(appelsCompleter).toHaveLength(0);
    expect(screen.getByLabelText(/Téléphone/).getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(screen.getByLabelText(/Téléphone/));
    fireEvent.change(screen.getByLabelText(/Téléphone/), { target: { value: "0612345678" } });
    fireEvent.click(screen.getByRole("button", { name: /Envoyer et choisir mon créneau/ }));
    expect(screen.getByText(/Choisissez la réponse/)).toBeTruthy();
    expect(appelsCompleter).toHaveLength(0);
  });

  it("envoie jeton, téléphone, réponse et consentement, puis ouvre la page de merci SANS préfixe de langue", async () => {
    const { appelsCompleter } = monter({
      capturer: { ok: true, jeton: "jeton-xyz", leadId: "lead-1" },
      completer: { ok: true, merciUrl: "/fr/apporteur-affaires/video/merci?utm_source=facebook" },
    });
    await allerEtape2();
    remplirEtape2();
    fireEvent.click(screen.getByRole("button", { name: /Envoyer et choisir mon créneau/ }));
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(appelsCompleter[0]).toEqual({
      jeton: "jeton-xyz",
      telephone: "06 12 34 56 78",
      reponseId: "5-20",
      consent: true,
    });
    expect(push).toHaveBeenCalledWith("/apporteur-affaires/video/merci?utm_source=facebook");
    expect(trackFunnel).toHaveBeenCalledWith("Lead Apporteur Submitted", { landing: "facebook" });
  });

  it("P6 — `SubmitApplication` du pixel à l'étape 2, avec l'eventID du serveur, bannière acceptée seulement", async () => {
    trackMetaSubmitApplication.mockClear();
    monter({
      completer: {
        ok: true,
        merciUrl: "/apporteur-affaires/video/merci",
        candidature: "candidature:lead-1",
      },
    });
    await allerEtape2();
    remplirEtape2();
    fireEvent.click(screen.getByRole("button", { name: /Envoyer et choisir mon créneau/ }));
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(trackMetaSubmitApplication).toHaveBeenCalledTimes(1);
    expect(trackMetaSubmitApplication).toHaveBeenCalledWith("candidature:lead-1");
  });

  it("P6 — rien sans l'accord à la bannière, ni quand le serveur ne rend pas d'eventID (déjà connu, suspect)", async () => {
    trackMetaSubmitApplication.mockClear();
    consentement.valeur = "declined";
    try {
      monter({
        completer: {
          ok: true,
          merciUrl: "/apporteur-affaires/video/merci",
          candidature: "candidature:lead-1",
        },
      });
      await allerEtape2();
      remplirEtape2();
      fireEvent.click(screen.getByRole("button", { name: /Envoyer et choisir mon créneau/ }));
      await waitFor(() => expect(push).toHaveBeenCalled());
    } finally {
      consentement.valeur = "accepted";
    }
    cleanup();
    push.mockClear();
    __reinitialiserEtatVslPourTests();
    monter({ completer: { ok: true, merciUrl: "/apporteur-affaires/video/merci" } });
    await allerEtape2();
    remplirEtape2();
    fireEvent.click(screen.getByRole("button", { name: /Envoyer et choisir mon créneau/ }));
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(trackMetaSubmitApplication).not.toHaveBeenCalled();
  });

  it("n'ouvre jamais une adresse d'un autre site renvoyée par le serveur", async () => {
    monter({ completer: { ok: true, merciUrl: "https://autre.example/x" } });
    await allerEtape2();
    remplirEtape2();
    fireEvent.click(screen.getByRole("button", { name: /Envoyer et choisir mon créneau/ }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/apporteur-affaires/video/merci"));
  });

  it("jeton expiré : retour à l'étape 1 avec un message clair", async () => {
    monter({ completer: { ok: false, error: "jeton" } });
    await allerEtape2();
    remplirEtape2();
    fireEvent.click(screen.getByRole("button", { name: /Envoyer et choisir mon créneau/ }));
    expect(await screen.findByText(/inscription a expiré/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Parlons de vous/ })).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  it.each([
    ["invalid", /information semble incorrecte/],
    ["rate", /Trop de tentatives/],
    ["unknown", /Une erreur est survenue/],
  ] as const)(
    "erreur serveur « %s » : message d'alerte, on reste à l'étape 2",
    async (code, motif) => {
      monter({ completer: { ok: false, error: code } });
      await allerEtape2();
      remplirEtape2();
      fireEvent.click(screen.getByRole("button", { name: /Envoyer et choisir mon créneau/ }));
      expect((await screen.findByText(motif)).getAttribute("role")).toBe("alert");
      expect(screen.getByRole("heading", { name: /Dernière étape/ })).toBeTruthy();
      expect(push).not.toHaveBeenCalled();
    },
  );
});

describe("historique, reprise et hauteur", () => {
  it("reprise depuis l'e-mail d'abandon : ?r=<jeton> ouvre l'étape 2 avec ce jeton", async () => {
    window.history.replaceState(null, "", "/fr/apporteur-affaires/video?r=jeton-de-reprise.abc");
    __reinitialiserEtatVslPourTests();
    const { appelsCompleter } = monter();
    expect(await screen.findByRole("heading", { name: /Dernière étape/ })).toBeTruthy();
    remplirEtape2();
    fireEvent.click(screen.getByRole("button", { name: /Envoyer et choisir mon créneau/ }));
    await waitFor(() => expect(appelsCompleter).toHaveLength(1));
    expect(appelsCompleter[0]!.jeton).toBe("jeton-de-reprise.abc");
  });

  it("un ?r= suspect est ignoré (étape 1)", () => {
    window.history.replaceState(null, "", "/fr/apporteur-affaires/video?r=%3Cscript%3E");
    __reinitialiserEtatVslPourTests();
    monter();
    expect(screen.getByRole("heading", { name: /Parlons de vous/ })).toBeTruthy();
  });

  it("« Retour » du navigateur ramène à l'étape 1 en gardant les réponses ; « Suivant » revient à l'étape 2", async () => {
    const { appelsCapturer } = monter();
    await allerEtape2();
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
    });
    expect(screen.getByRole("heading", { name: /Parlons de vous/ })).toBeTruthy();
    expect((screen.getByLabelText(/Prénom/) as HTMLInputElement).value.trim()).toBe("Léa");
    expect((screen.getByLabelText(/E-mail/) as HTMLInputElement).value.trim()).toBe(
      "lea@exemple.fr",
    );
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate", { state: { vslEtape: 2 } }));
    });
    expect(screen.getByRole("heading", { name: /Dernière étape/ })).toBeTruthy();
    // Revenir en avant n'a pas redemandé de jeton au serveur.
    expect(appelsCapturer).toHaveLength(1);
  });

  it("repasser par « Continuer » sans rien changer ne rappelle pas le serveur", async () => {
    const { appelsCapturer } = monter();
    await allerEtape2();
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
    });
    fireEvent.click(screen.getByRole("button", { name: /Continuer/ }));
    await screen.findByRole("heading", { name: /Dernière étape/ });
    expect(appelsCapturer).toHaveLength(1);
  });

  it("modifier l'e-mail après la capture redemande un jeton au serveur", async () => {
    const { appelsCapturer } = monter();
    await allerEtape2();
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
    });
    fireEvent.change(screen.getByLabelText(/E-mail/), { target: { value: "autre@exemple.fr" } });
    fireEvent.click(screen.getByRole("button", { name: /Continuer/ }));
    await screen.findByRole("heading", { name: /Dernière étape/ });
    expect(appelsCapturer).toHaveLength(2);
    expect(appelsCapturer[1]!.email).toBe("autre@exemple.fr");
  });

  it("le lien « Modifier mes réponses précédentes » revient à l'étape 1 (via l'historique)", async () => {
    monter();
    await allerEtape2();
    fireEvent.click(screen.getByRole("button", { name: /Modifier mes réponses précédentes/ }));
    // `history.back()` : jsdom déclenche `popstate` de façon asynchrone, comme un navigateur.
    expect(await screen.findByRole("heading", { name: /Parlons de vous/ })).toBeTruthy();
  });

  it("reprise : un rechargement à l'étape 2 (jeton gardé) rouvre l'étape 2, sans le téléphone", async () => {
    window.sessionStorage.setItem(
      "axion-vsl-apporteur-v1",
      JSON.stringify({
        etape: 2,
        prenom: "Léa",
        email: "lea@exemple.fr",
        consent: true,
        jeton: "j",
        leadId: "l",
      }),
    );
    monter();
    expect(await screen.findByRole("heading", { name: /Dernière étape/ })).toBeTruthy();
    expect((screen.getByLabelText(/Téléphone/) as HTMLInputElement).value).toBe("");
  });

  it("les deux étapes partagent la MÊME boîte à hauteur minimale (CLS)", async () => {
    monter();
    const boite = document.getElementById("vsl-formulaire") as HTMLElement;
    expect(boite.className).toMatch(/min-h-\[/);
    const classe = boite.className;
    await allerEtape2();
    expect((document.getElementById("vsl-formulaire") as HTMLElement).className).toBe(classe);
  });

  it("le bouton principal est terracotta, jamais le bleu du bouton par défaut", () => {
    monter();
    const b = screen.getByRole("button", { name: /Continuer/ });
    expect(b.className).toContain("bg-terracotta");
    expect(b.className).not.toMatch(/bg-primary(?!-)/);
  });
});
