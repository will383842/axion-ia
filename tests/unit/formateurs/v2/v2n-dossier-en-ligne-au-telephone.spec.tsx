/**
 * Vérification n° 2 — regard du FORMATEUR NOVICE, au téléphone : le dossier en ligne
 * (`/formateur/dossier/<id>/<jeton>`), étape par étape, tel que le candidat le manipule.
 *
 * Le banc `@formateurs` n'ouvre aucun navigateur (cf. `banc-formateurs.yml`) : l'écran est
 * donc rendu ici, dans le DOM simulé, avec les vraies règles du dossier et des actions
 * serveur doublées. Ce qui est vérifié est ce que le candidat voit et touche :
 *   · chaque champ a un nom accessible (lecteur d'écran, saisie vocale) ;
 *   · les champs font 16 px et plus (sinon le téléphone zoome à chaque champ) ;
 *   · les boutons font 44 px et plus de haut (zone tactile) ;
 *   · un bouton grisé dit pourquoi ;
 *   · un refus du serveur garde TOUT ce qui a été tapé (une perte de saisie est bloquante).
 *
 * Les défauts trouvés sont en `it.fails` / `it.todo` nommés `V2-N-n` et consignés au rapport.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  vous: vi.fn(),
  activite: vi.fn(),
  recherche: vi.fn(),
  piece: vi.fn(),
  urssaf: vi.fn(),
  envoyer: vi.fn(),
  code: vi.fn(),
  signer: vi.fn(),
  situation: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: h.refresh, push: vi.fn() }) }));
vi.mock("@/app/formateur/dossier/[id]/[jeton]/actions", () => ({
  enregistrerVousAction: h.vous,
  enregistrerActiviteAction: h.activite,
  rechercherSiretAction: h.recherche,
  deposerPieceAction: h.piece,
  enregistrerCodeUrssafAction: h.urssaf,
  envoyerDossierAction: h.envoyer,
  demanderCodeContratAction: h.code,
  signerEtEnvoyerDossierAction: h.signer,
  signalerSituationAction: h.situation,
}));

import {
  DossierFormateur,
  type DossierPublic,
} from "@/app/formateur/dossier/[id]/[jeton]/DossierFormateur";
import { TEXTES } from "@/app/formateur/dossier/[id]/[jeton]/textes";
import { TEXTES_CONTRAT } from "@/app/formateur/dossier/[id]/[jeton]/textes-contrat";

const IBAN = "FR7630006000011234567890189";
const SIRET = "73282932000074";

function dossier(p: Partial<DossierPublic> = {}): DossierPublic {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    jeton: "jeton-du-banc",
    prenom: "Inès",
    nom: "Novice",
    email: "ines.novice@example.test",
    telephone: "0600000000",
    codePostalPro: "69003",
    adressePro: null,
    siret: null,
    siretEnregistre: false,
    adressePro: null,
    nda: null,
    regimeTva: null,
    ibanSaisi: false,
    ibanFige: false,
    codeUrssafSaisi: false,
    pieces: [],
    piecesDemandees: [
      "rib",
      "cv",
      "attestation_vigilance_urssaf",
      "assurance_rc_pro",
      "diplome",
    ] as DossierPublic["piecesDemandees"],
    ...p,
  };
}

/** Tous les champs que le candidat peut remplir ou cocher à l'écran. */
function champs(): HTMLElement[] {
  return [
    ...screen.queryAllByRole("textbox"),
    ...screen.queryAllByRole("checkbox"),
    ...screen.queryAllByRole("radio"),
  ];
}

/** Taille de police d'une classe Tailwind arbitraire `text-[NNpx]`, ou `null`. */
function policePx(el: Element): number | null {
  const m = /(?:^|\s)text-\[(\d+)px\]/.exec(el.className);
  return m ? Number(m[1]) : null;
}

/** Hauteur minimale `min-h-[NNpx]` (ou `min-h-12` = 48 px), ou `null`. */
function hauteurMinPx(el: Element): number | null {
  const m = /(?:^|\s)min-h-\[(\d+)px\]/.exec(el.className);
  if (m) return Number(m[1]);
  const n = /(?:^|\s)min-h-(\d+)(?:\s|$)/.exec(el.className);
  return n ? Number(n[1]) * 4 : null;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.vous.mockResolvedValue({ ok: true });
  h.activite.mockResolvedValue({ ok: true });
});
afterEach(cleanup);

describe("V2-N · dossier en ligne au téléphone — étape 1 « Vous »", () => {
  it("chaque champ porte un nom accessible, et le bouton principal tient au pouce", () => {
    render(<DossierFormateur dossier={dossier()} etapeInitiale={1} />);
    for (const c of champs()) expect(c).toHaveAccessibleName();
    expect(screen.getByRole("textbox", { name: TEXTES.codePostal })).toBeInTheDocument();
    const continuer = screen.getByRole("button", { name: TEXTES.continuer });
    expect(hauteurMinPx(continuer)).toBeGreaterThanOrEqual(44);
  });

  it("les champs font 16 px et plus : le téléphone ne zoome pas à chaque saisie", () => {
    render(<DossierFormateur dossier={dossier()} etapeInitiale={1} />);
    for (const c of screen.queryAllByRole("textbox")) {
      expect(policePx(c), c.outerHTML.slice(0, 80)).toBeGreaterThanOrEqual(16);
    }
  });

  it("un « Continuer » grisé dit ce qui manque, en français simple", async () => {
    render(<DossierFormateur dossier={dossier({ codePostalPro: null })} etapeInitiale={1} />);
    expect(screen.getByRole("button", { name: TEXTES.continuer })).toBeDisabled();
    expect(screen.getByText(/Pour continuer, il manque : votre code postal\./)).toBeVisible();
  });

  it("un refus du serveur (téléphone illisible) garde le téléphone et le code postal tapés", async () => {
    const u = userEvent.setup();
    h.vous.mockResolvedValue({ ok: false, message: TEXTES.telephoneInvalide });
    render(<DossierFormateur dossier={dossier({ telephone: null })} etapeInitiale={1} />);
    const tel = screen.getByRole("textbox", { name: TEXTES.telephone });
    await u.type(tel, "06 12");
    await u.click(screen.getByRole("button", { name: TEXTES.continuer }));
    expect(await screen.findByRole("alert")).toHaveTextContent(TEXTES.telephoneInvalide);
    expect(screen.getByRole("textbox", { name: TEXTES.telephone })).toHaveValue("06 12");
    expect(screen.getByRole("textbox", { name: TEXTES.codePostal })).toHaveValue("69003");
  });
});

describe("V2-N · dossier en ligne au téléphone — étape 2 « Votre activité »", () => {
  const prete = () =>
    dossier({ siret: SIRET, siretEnregistre: true, nda: "84691234569", regimeTva: null });

  it("un refus du serveur garde le SIRET, le numéro de déclaration, la TVA et l'IBAN tapés", async () => {
    const u = userEvent.setup();
    h.activite.mockResolvedValue({ ok: false, message: TEXTES.ibanInvalide });
    render(<DossierFormateur dossier={prete()} etapeInitiale={2} />);
    await u.click(screen.getByRole("radio", { name: TEXTES.tvaFranchise }));
    await u.type(screen.getByRole("textbox", { name: TEXTES.iban }), IBAN);
    await u.click(screen.getByRole("button", { name: TEXTES.continuer }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/IBAN n'est pas valide/);
    expect(screen.getByRole("textbox", { name: TEXTES.iban })).toHaveValue(IBAN);
    expect(screen.getByRole("radio", { name: TEXTES.tvaFranchise })).toBeChecked();
    expect(screen.getByRole("textbox", { name: TEXTES.nda })).toHaveValue("84691234569");
  });

  it("« Retour » puis « Continuer » : l'étape 1 et l'étape 2 gardent ce qui a été tapé", async () => {
    const u = userEvent.setup();
    render(<DossierFormateur dossier={prete()} etapeInitiale={2} />);
    await u.click(screen.getByRole("radio", { name: TEXTES.tvaAssujetti }));
    await u.type(screen.getByRole("textbox", { name: TEXTES.iban }), IBAN);
    await u.click(screen.getByRole("button", { name: TEXTES.retour }));
    expect(screen.getByRole("textbox", { name: TEXTES.codePostal })).toHaveValue("69003");
    await u.click(screen.getByRole("button", { name: TEXTES.continuer }));
    expect(await screen.findByRole("textbox", { name: TEXTES.iban })).toHaveValue(IBAN);
    expect(screen.getByRole("radio", { name: TEXTES.tvaAssujetti })).toBeChecked();
  });

  it("les trois régimes de TVA sont des zones tactiles de 44 px et plus, nommées en clair", () => {
    render(<DossierFormateur dossier={prete()} etapeInitiale={2} />);
    for (const nom of [TEXTES.tvaFranchise, TEXTES.tvaExonere, TEXTES.tvaAssujetti]) {
      const radio = screen.getByRole("radio", { name: nom });
      const zone = radio.closest("label");
      expect(zone && hauteurMinPx(zone)).toBeGreaterThanOrEqual(44);
    }
  });

  // V2-N-7 (mineur) — CORRIGÉ. Le champ SIRET était enveloppé dans un <label> qui
  // contenait AUSSI le bouton « Rechercher » : son nom accessible devenait « Numéro SIRET
  // Rechercher ». L'étiquette vise désormais le seul champ (`htmlFor`).
  it("V2-N-7 — le champ SIRET s'annonce « Numéro SIRET », sans le texte du bouton", () => {
    render(<DossierFormateur dossier={prete()} etapeInitiale={2} />);
    expect(screen.getByRole("textbox", { name: TEXTES.siret })).toBeInTheDocument();
  });
});

describe("V2-N · dossier en ligne au téléphone — étape 3 « Vos documents »", () => {
  const avecPieces = (p: Partial<DossierPublic> = {}) =>
    dossier({
      siret: SIRET,
      siretEnregistre: true,
      nda: "84691234569",
      regimeTva: "franchise_293b",
      ibanSaisi: true,
      pieces: [
        { type: "rib", statut: "deposee", motif: null, nomFichier: "rib.pdf" },
        { type: "cv", statut: "deposee", motif: null, nomFichier: "cv.pdf" },
      ],
      ...p,
    });

  it("CV et RIB déposés, rien de facultatif : « Continuer » s'active", () => {
    render(<DossierFormateur dossier={avecPieces()} etapeInitiale={3} />);
    expect(screen.getByRole("button", { name: TEXTES.continuer })).toBeEnabled();
  });

  it("chaque pièce dit ce qu'elle est, et les pièces facultatives le disent", () => {
    render(<DossierFormateur dossier={avecPieces()} etapeInitiale={3} />);
    const liste = screen.getAllByRole("listitem");
    expect(liste.length).toBeGreaterThanOrEqual(5);
    expect(screen.getAllByText(new RegExp(TEXTES.depot.facultatif)).length).toBeGreaterThanOrEqual(
      3,
    );
  });

  // V2-N-4 (MAJEUR) — l'attestation URSSAF est FACULTATIVE à l'entrée (lot G1). Mais un
  // candidat qui la dépose « pour bien faire » ne peut plus avancer sans recopier son code
  // de sécurité (`manquesEtape3`, `dossier-regles.ts` ~l. 123), et l'écran n'offre aucun
  // moyen de retirer la pièce (seulement « Remplacer »). Une pièce facultative devient une
  // impasse : « Pour continuer, il manque : le code de sécurité de votre attestation ».
  // CORRIGÉ : le code reste demandé à l'écran, mais il ne bloque plus (`manquesEtape3`).
  it("V2-N-4 — déposer l'attestation facultative ne bloque pas le dossier", () => {
    render(
      <DossierFormateur
        dossier={avecPieces({
          pieces: [
            { type: "rib", statut: "deposee", motif: null, nomFichier: "rib.pdf" },
            { type: "cv", statut: "deposee", motif: null, nomFichier: "cv.pdf" },
            {
              type: "attestation_vigilance_urssaf",
              statut: "deposee",
              motif: null,
              nomFichier: "attestation.pdf",
            },
          ],
        })}
        etapeInitiale={3}
      />,
    );
    const bloque = screen.getByRole("button", { name: TEXTES.continuer }).hasAttribute("disabled");
    const retirer = screen.queryByRole("button", { name: /retirer|supprimer/i });
    expect(!bloque || retirer !== null).toBe(true);
    // Le code est toujours proposé, et dit facultatif.
    expect(screen.getByRole("textbox", { name: /Code de sécurité \(facultatif\)/ })).toBeVisible();
  });
});

describe("V2-N · dossier en ligne au téléphone — étape 4 « Votre contrat »", () => {
  const contrat = {
    mode: "a_signer" as const,
    signe: false,
    pdfUrl: null,
    textes: TEXTES_CONTRAT,
  };

  it("le code reçu par e-mail se tape au clavier numérique, et un code faux garde les cases cochées", async () => {
    const u = userEvent.setup();
    h.code.mockResolvedValue({ ok: true, adresse: "i***@example.test", pdfUrl: null });
    h.signer.mockResolvedValue({ ok: false, message: "Ce code n'est pas le bon." });
    render(<DossierFormateur dossier={dossier()} etapeInitiale={4} contrat={contrat} />);
    const [certifie, accepte] = screen.getAllByRole("checkbox");
    await u.click(certifie!);
    await u.click(accepte!);
    await u.click(screen.getByRole("button", { name: TEXTES_CONTRAT.recevoirCode }));
    const champ = await screen.findByRole("textbox", { name: TEXTES_CONTRAT.codeSignature });
    expect(champ).toHaveAttribute("inputmode", "numeric");
    expect(champ).toHaveAttribute("autocomplete", "one-time-code");
    await u.type(champ, "123456");
    await u.click(screen.getByRole("button", { name: TEXTES_CONTRAT.signer }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Ce code n'est pas le bon.");
    expect(certifie).toBeChecked();
    expect(accepte).toBeChecked();
    expect(screen.getByRole("textbox", { name: TEXTES_CONTRAT.codeSignature })).toHaveValue(
      "123456",
    );
  });

  it("l'adresse où part le code est dite à l'écran (le candidat sait où chercher)", async () => {
    const u = userEvent.setup();
    h.code.mockResolvedValue({ ok: true, adresse: "i***@example.test", pdfUrl: null });
    render(<DossierFormateur dossier={dossier()} etapeInitiale={4} contrat={contrat} />);
    await u.click(screen.getByRole("button", { name: TEXTES_CONTRAT.recevoirCode }));
    expect(await screen.findByRole("status")).toHaveTextContent("i***@example.test");
  });

  it("chaque case de l'étape 4 est nommée par sa phrase", () => {
    render(<DossierFormateur dossier={dossier()} etapeInitiale={4} contrat={contrat} />);
    const cases = screen.getAllByRole("checkbox");
    expect(cases).toHaveLength(2);
    for (const c of cases) expect(c).toHaveAccessibleName();
    expect(within(cases[0]!.closest("label")!).getByText(TEXTES.jeCertifie)).toBeVisible();
  });
});
