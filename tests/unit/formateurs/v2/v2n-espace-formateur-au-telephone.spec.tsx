/**
 * Vérification n° 2 — regard du FORMATEUR NOVICE, au téléphone : son espace (connexion,
 * réponse à une proposition de mission, bilan de fin de formation, navigation du bas).
 *
 * Rendu dans le DOM simulé (le banc n'ouvre aucun navigateur), actions serveur doublées.
 * Les défauts sont en `it.fails` nommés `V2-N-n` : ils passent au vert le jour où le
 * défaut est corrigé, ce qui fait alors échouer ce fichier — il faudra retirer le `.fails`.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  lien: vi.fn(),
  jeton: vi.fn(),
  mission: vi.fn(),
  refresh: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  }),
  session: vi.fn(),
  avis: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: h.refresh, push: vi.fn() }),
  redirect: h.redirect,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/actions/formateur/auth.actions", () => ({
  sendFormateurMagicLinkAction: h.lien,
}));
vi.mock("@/server/actions/qualiopi/mission-formateur", () => ({
  repondreMissionParJetonAction: h.jeton,
  repondreMissionFormateurAction: h.mission,
}));
vi.mock("@/server/formateur/guard", () => ({ getFormateurSession: h.session }));
vi.mock("@/server/qualiopi/formateurs-independants/bilan-fin-formation/service", () => ({
  enregistrerAvisFormateur: h.avis,
  enregistrerEvaluationFinaleFormateur: vi.fn(),
  terminerBilanFormateur: vi.fn(),
}));

import { FormateurLoginForm } from "@/components/espace-formateur/FormateurLoginForm";
import { MissionReponseForm } from "@/components/espace-formateur/MissionReponseForm";
import {
  BilanFinFormation,
  type VueBilanFinFormation,
} from "@/components/espace-formateur/BilanFinFormation";
import { donnerAvisFormAction } from "@/server/actions/formateur/bilan-fin-formation.actions";

const RACINE = path.resolve(__dirname, "../../../..");
const lire = (rel: string) => readFileSync(path.join(RACINE, rel), "utf8");

/** Taille de police : `text-[NNpx]`, `text-sm` (14), `text-xs` (12), `text-base` (16). */
function policePx(el: Element): number | null {
  const c = ` ${el.className} `;
  const m = /\stext-\[(\d+)px\]\s/.exec(c);
  if (m) return Number(m[1]);
  if (c.includes(" text-xs ")) return 12;
  if (c.includes(" text-sm ")) return 14;
  if (c.includes(" text-base ")) return 16;
  if (c.includes(" text-lg ")) return 18;
  return null;
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("V2-N · se connecter à son espace (lien par e-mail)", () => {
  it("le champ porte un nom, le type e-mail et l'autocomplétion du téléphone", () => {
    render(<FormateurLoginForm />);
    const champ = screen.getByRole("textbox", { name: /adresse e-mail/i });
    expect(champ).toHaveAttribute("type", "email");
    expect(champ).toHaveAttribute("autocomplete", "email");
    expect(screen.getByRole("button", { name: "Recevoir mon lien de connexion" })).toBeVisible();
  });

  // V2-N-8 (mineur) — « Votre adresse e-mail PROFESSIONNELLE » : le compte du formateur est
  // ouvert sur l'adresse de sa CANDIDATURE, souvent personnelle. Une autre adresse ne reçoit
  // rien, et le message neutre (anti-énumération) ne permet pas de comprendre pourquoi.
  // `FormateurLoginForm.tsx` l. 19-21.
  it.fails(
    "V2-N-8 — le libellé renvoie à l'adresse de la candidature, pas à une adresse « professionnelle »",
    () => {
      render(<FormateurLoginForm />);
      expect(screen.queryByText(/professionnelle/i)).toBeNull();
    },
  );

  // V2-N-9 (mineur) — le champ est en 14 px (`text-sm`) : sur iPhone, toucher le champ
  // fait zoomer la page (seuil 16 px). Et la réponse (« Si un compte… ») n'est pas
  // annoncée aux lecteurs d'écran (pas de `role="status"`). `FormateurLoginForm.tsx`.
  it.fails("V2-N-9 — champ de 16 px et réponse annoncée (role=status)", async () => {
    const u = userEvent.setup();
    h.lien.mockResolvedValue({ ok: true, message: "Si un compte formateur correspond…" });
    render(<FormateurLoginForm />);
    const champ = screen.getByRole("textbox", { name: /adresse e-mail/i });
    expect(policePx(champ)).toBeGreaterThanOrEqual(16);
    await u.type(champ, "ines@example.test");
    await u.click(screen.getByRole("button"));
    expect(await screen.findByRole("status")).toHaveTextContent("Si un compte");
  });
});

describe("V2-N · répondre à une proposition de mission", () => {
  it("indépendant : « J'accepte » et « Je ne suis pas disponible », 44 px et plus, liberté dite", async () => {
    render(
      <MissionReponseForm
        cible={{ missionId: "m1" }}
        resume="Formation IA · 3 et 4 novembre · Lyon"
        motifMin={10}
        refusLibre
      />,
    );
    const oui = screen.getByRole("button", { name: "J'accepte" });
    const non = screen.getByRole("button", { name: "Je ne suis pas disponible" });
    for (const b of [oui, non]) expect(b.className).toMatch(/min-h-\[(4[4-9]|[5-9]\d)px\]/);
    expect(screen.getByText(/libre d'accepter ou de refuser/)).toBeVisible();
  });

  it("« J'accepte » : la suite est dite à l'écran (informations pratiques une semaine avant)", async () => {
    const u = userEvent.setup();
    h.mission.mockResolvedValue({ data: { statut: "acceptee" } });
    render(<MissionReponseForm cible={{ missionId: "m1" }} resume="…" motifMin={10} refusLibre />);
    await u.click(screen.getByRole("button", { name: "J'accepte" }));
    expect(await screen.findByRole("status")).toHaveTextContent(/une semaine avant/);
  });

  it("un refus du serveur n'efface pas le mot écrit (il est retrouvé en rouvrant le refus)", async () => {
    const u = userEvent.setup();
    h.mission.mockResolvedValue({ error: "Cette proposition a expiré." });
    render(<MissionReponseForm cible={{ missionId: "m1" }} resume="…" motifMin={10} refusLibre />);
    await u.click(screen.getByRole("button", { name: "Je ne suis pas disponible" }));
    await u.type(screen.getByRole("textbox"), "Je suis en congé cette semaine-là");
    await u.click(screen.getByRole("button", { name: "Envoyer ma réponse" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Cette proposition a expiré.");
    await u.click(screen.getByRole("button", { name: "Je ne suis pas disponible" }));
    expect(screen.getByRole("textbox")).toHaveValue("Je suis en congé cette semaine-là");
  });

  // V2-N-10 (mineur) — après un refus du serveur, le panneau du refus se REFERME : le
  // formateur voit l'erreur au-dessus des deux boutons du début, et doit rouvrir « Je ne
  // suis pas disponible » pour retrouver son texte. `MissionReponseForm.tsx`, l'état
  // `erreur` remplace l'état `refus`.
  it.fails(
    "V2-N-10 — après une erreur, le champ du refus reste ouvert sous le message",
    async () => {
      const u = userEvent.setup();
      h.mission.mockResolvedValue({ error: "Réessayez dans un instant." });
      render(
        <MissionReponseForm cible={{ missionId: "m1" }} resume="…" motifMin={10} refusLibre />,
      );
      await u.click(screen.getByRole("button", { name: "Je ne suis pas disponible" }));
      await u.type(screen.getByRole("textbox"), "Trop loin pour moi");
      await u.click(screen.getByRole("button", { name: "Envoyer ma réponse" }));
      await screen.findByRole("alert");
      expect(screen.getByRole("textbox")).toHaveValue("Trop loin pour moi");
    },
  );
});

describe("V2-N · bilan de fin de formation", () => {
  const vue: VueBilanFinFormation = {
    objectifs: ["Rédiger un prompt utile", "Vérifier une réponse"],
    stagiaires: [{ enrollmentId: "e1", prenom: "Léa", nom: "Martin", finale: null }],
    avis: null,
    termineAt: null,
    etat: { restants: 1, termine: false, peutTerminer: false },
    attenduPourPaiement: true,
    motifPaiement: "le bilan est attendu pour établir votre facture",
  };

  it("les trois étapes sont nommées, et « Terminer » grisé dit ce qui reste", () => {
    render(<BilanFinFormation sessionId="s1" vue={vue} issue={null} />);
    expect(screen.getByRole("heading", { name: /1\. Vos stagiaires/ })).toBeVisible();
    expect(screen.getByRole("heading", { name: /2\. Votre avis/ })).toBeVisible();
    expect(screen.getByRole("button", { name: "Terminer" })).toBeDisabled();
    expect(screen.getByText("1 stagiaire à évaluer")).toBeVisible();
    expect(screen.getByText("votre avis à donner")).toBeVisible();
    expect(screen.getByText(/Paiement : le bilan est attendu/)).toBeVisible();
  });

  it("chaque objectif est un groupe nommé, ses trois réponses des zones de 48 px", () => {
    render(<BilanFinFormation sessionId="s1" vue={vue} issue={null} />);
    for (const o of vue.objectifs) {
      expect(screen.getByRole("group", { name: o })).toBeInTheDocument();
    }
    for (const r of screen.getAllByRole("radio", { name: "Acquis" })) {
      expect(r.nextElementSibling?.className).toMatch(/min-h-12/);
    }
    expect(screen.getByRole("textbox", { name: /Quelques lignes/ })).toBeVisible();
  });

  // V2-N-3 (BLOQUANT — perte de saisie) — l'avis est un formulaire HTML simple : à tout
  // refus du serveur (dossier de la session clos, avis jugé vide une fois les espaces
  // retirés, session expirée → page de connexion), l'action REDIRIGE avec un simple code
  // (`?bilan=dossier_clos`) et le texte écrit au téléphone est perdu.
  // `bilan-fin-formation.actions.ts` (`donnerAvisFormAction`) et `BilanFinFormation.tsx`.
  it.fails("V2-N-3 — un avis refusé par le serveur revient à l'écran, pas effacé", async () => {
    const texte = "Groupe attentif, deux absences le matin du second jour, salle trop petite.";
    h.session.mockResolvedValue({ trainerId: "t1" });
    h.avis.mockResolvedValue("dossier_clos");
    const fd = new FormData();
    fd.set("sessionId", "6f1c2a4e-1b2c-4d3e-8f4a-5b6c7d8e9f01");
    fd.set("commentaire", texte);
    let cible = "";
    try {
      await donnerAvisFormAction(fd);
    } catch (e) {
      cible = (e as { url?: string }).url ?? "";
    }
    expect(cible).toContain("bilan=dossier_clos");
    // Rien ne permet à la page de re-proposer le texte : ni l'adresse, ni la vue.
    expect(decodeURIComponent(cible)).toContain(texte);
  });
});

describe("V2-N · ce que le formateur lit dans son espace", () => {
  // V2-N-11 (mineur) — la barre du bas, sur téléphone, affiche le libellé COURT :
  // « Suivi 1-to-1 » (anglais), et l'entrée reste visible pour un indépendant qui n'a
  // aucun accompagnement individuel (page vide). `_coquille.tsx` ~l. 101-107.
  it.fails("V2-N-11 — aucun libellé anglais dans la barre de navigation du téléphone", () => {
    const coquille = lire("src/app/[locale]/espace-formateur/_coquille.tsx");
    expect(coquille).not.toMatch(/labelCourt:\s*"[^"]*1-to-1/);
  });

  // V2-N-12 (mineur) — la page des honoraires s'intitule « Ma rémunération » pour TOUS,
  // alors que le menu dit « Mes honoraires » à l'indépendant (et que le lexique du chantier
  // proscrit « rémunération » pour lui : vocabulaire du salariat).
  // `remuneration/page.tsx` (titre de l'onglet et <h1>).
  it.fails("V2-N-12 — l'indépendant lit « Mes honoraires » en titre, comme dans le menu", () => {
    const page = lire("src/app/[locale]/espace-formateur/remuneration/page.tsx");
    expect(page).not.toMatch(/<h1[^>]*>Ma rémunération<\/h1>/);
  });
});
