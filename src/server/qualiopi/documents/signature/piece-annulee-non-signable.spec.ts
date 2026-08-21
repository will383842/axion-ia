/**
 * Garde — une pièce ANNULÉE n'est jamais proposée à la signature.
 *
 * ## Le défaut que cette garde ferme
 *
 * Constaté en production le 04/08/2026. Après annulation de la convention
 * `AXI-DOC-2026-003`, le panneau de signature de la page session continuait
 * d'afficher « Envoyer au client », « Copier le lien » et « Signer pour
 * l'organisme ». On pouvait donc faire signer à la cliente une pièce que
 * l'organisme venait de déclarer sans valeur — et rien à l'écran ne disait
 * qu'elle était annulée.
 *
 * Cause : la sélection filtrait sur le SEUL type signable
 * (`circuitPour(d.type) !== null`), sans regarder le sort de la pièce. Le
 * filtre `annuleeAt: null` avait été posé sur la file « à signer », sur les
 * preuves d'indicateurs, sur le ZIP d'audit et sur l'espace formateur — pas
 * sur cette surface-là.
 *
 * ## Pourquoi la première garde porte sur la SOURCE
 *
 * La sélection vit dans un composant serveur de page (`sessions/[id]/page.tsx`)
 * qui charge une douzaine de requêtes Prisma : l'instancier dans un test
 * demanderait de simuler tout son contexte, pour vérifier une seule condition.
 * L'invariant, lui, est textuel et déterministe.
 *
 * ## Pourquoi ça ne suffisait pas
 *
 * Cette garde-là ne lisait QU'UN fichier — le panneau d'administration. Elle
 * énumérait pourtant, dans son propre en-tête, les surfaces réputées couvertes ;
 * le canal par JETON, seul canal qui sort de l'organisme, n'y figurait pas, et
 * il ne regardait effectivement pas le sort de la pièce : `verifierJeton` pesait
 * cinq conditions (existence, pièce visée, partie, révocation, péremption) sans
 * jamais que l'annulation entre dans la décision.
 *
 * Ce n'est pas une faille — le porteur d'un lien légitimement émis s'en sert
 * légitimement. C'est un état métier faux, et il a des CONSÉQUENCES AUTOMATIQUES :
 * `consequenceSignatureComplete` envoie les questionnaires de positionnement à
 * des stagiaires réels dès qu'une convention ou un contrat passe `signee`, et
 * fait basculer un devis en `accepte`. Aucun écran humain entre la signature et
 * l'effet. C'est ça qu'il faut empêcher.
 *
 * La seconde garde porte donc sur le COMPORTEMENT de `signerDocument` — le seul
 * endroit du dépôt qui écrit une ligne `document_signatures`, donc le seul dont
 * un refus ferme réellement toutes les surfaces.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentGenere: { findUnique: vi.fn(), update: vi.fn() },
    documentSignature: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), count: vi.fn() },
    documentSignatureToken: { findUnique: vi.fn() },
    trainer: { findUnique: vi.fn() },
    adminUser: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/server/qualiopi/emargement/storage", () => ({
  storeSignatureImage: vi.fn(),
  supprimerImageSignature: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { storeSignatureImage } from "@/server/qualiopi/emargement/storage";
import { signerDocument, type PorteurSignatureDocument } from "./document-signature-service";

const PAGE = path.join(
  process.cwd(),
  "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/sessions/[id]/page.tsx",
);

describe("🔴 panneau de signature — une pièce annulée ne se signe plus", () => {
  const source = fs.readFileSync(PAGE, "utf8");

  it("la page est bien lue (sinon la garde ne garde rien)", () => {
    expect(source.length).toBeGreaterThan(2000);
    expect(source).toContain("piecesSignables");
  });

  it("`piecesSignables` exclut les pièces annulées", () => {
    // ⚠️ On cherche la CONDITION, pas le commentaire qui l'explique : un test
    // qui trouve sa propre documentation reste vert quand le code disparaît.
    const sansCommentaires = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^[ \t]*\/\/.*$/gm, "");
    const bloc = sansCommentaires.match(/const piecesSignables = [\s\S]{0,300}?;/);
    expect(bloc, "déclaration de `piecesSignables` introuvable").not.toBeNull();
    expect(bloc![0]).toMatch(/annuleeAt\s*===\s*null|annuleeAt:\s*null/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// L'ÉCRAN PUBLIC — celui que le tiers ouvre depuis son e-mail
// ─────────────────────────────────────────────────────────────────────────────
//
// 🔴 Cette garde manquait, et son absence n'était pas anodine : le panneau admin
// ci-dessus est vu par l'organisme, qui SAIT qu'il a annulé la pièce. La page
// `/portail/signer/[token]` est vue par le tiers, qui ne le sait pas. C'est le
// seul des deux écrans où le silence trompe réellement quelqu'un.
//
// ⚠️ Garde de SOURCE, pas de comportement : la page est un composant serveur qui
// tire `notFound()`, l'identité de l'organisme et quatre relations Prisma — la
// monter dans vitest exigerait plus de mocks que la propriété n'a de substance.
// On vérifie donc les deux maillons sans lesquels rien ne peut fonctionner : que
// le sort de la pièce est DEMANDÉ à la base, et qu'il est LU avant le rendu du
// formulaire. La garde de fond, elle, est éprouvée pour de vrai plus bas —
// `signerDocument` refuse la signature quoi qu'affiche cette page.
const PAGE_PORTAIL = path.join(process.cwd(), "src/app/[locale]/portail/signer/[token]/page.tsx");

describe("🔴 page publique de signature — le tiers apprend que la pièce est annulée", () => {
  const source = fs.readFileSync(PAGE_PORTAIL, "utf8");
  // On cherche la CONDITION, jamais le commentaire qui l'explique : un test
  // statique qui trouve sa propre documentation reste vert quand le code part
  // (mémoire `test-statique-trouve-ses-propres-commentaires`).
  const sansCommentaires = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

  it("la page est bien lue (sinon la garde ne garde rien)", () => {
    expect(source.length).toBeGreaterThan(2000);
    expect(sansCommentaires).toContain("circuitPour");
  });

  it("le `select` DEMANDE `annuleeAt` — sans lui, la page ne peut rien savoir", () => {
    expect(sansCommentaires).toMatch(/annuleeAt:\s*true/);
  });

  it("la page REFUSE d'afficher le formulaire pour une pièce annulée", () => {
    expect(sansCommentaires).toMatch(/piece\.annuleeAt\s*!==\s*null/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// La garde de FOND — au seul endroit qui écrit
// ─────────────────────────────────────────────────────────────────────────────

type Mock = ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as {
  documentGenere: { findUnique: Mock; update: Mock };
  documentSignature: { findFirst: Mock; findMany: Mock; create: Mock; count: Mock };
  documentSignatureToken: { findUnique: Mock };
  trainer: { findUnique: Mock };
  adminUser: { findUnique: Mock };
  $transaction: Mock;
};
const mockStore = storeSignatureImage as unknown as Mock;

const DOC = "11111111-1111-4111-8111-111111111111";
const TRAINER = "22222222-2222-4222-8222-222222222222";
const ADMIN = "33333333-3333-4333-8333-333333333333";
const SESSION = "44444444-4444-4444-8444-444444444444";
const TOKEN = "55555555-5555-4555-8555-555555555555";
const MAINTENANT = new Date("2026-08-19T10:00:00.000Z");
const ANNULEE_LE = new Date("2026-08-12T09:00:00.000Z");

/** Pièce ANNULÉE, par ailleurs parfaitement signable : scellée, non spécimen. */
function pieceAnnulee(over: Record<string, unknown> = {}) {
  return {
    id: DOC,
    numero: "AXI-DOC-2026-003",
    type: "convention",
    hashSha256: "c".repeat(64),
    metadata: {},
    sessionId: SESSION,
    annuleeAt: ANNULEE_LE,
    signatures: [] as Array<{ id: string }>,
    session: {
      formateurPrincipalId: TRAINER,
      sessionFormateurs: [{ trainerId: TRAINER, role: "formateur_principal" }],
    },
    ...over,
  };
}

function entree(porteur: PorteurSignatureDocument, over: Record<string, unknown> = {}) {
  return {
    documentGenereId: DOC,
    porteur,
    methode: "trace" as const,
    partiesRequises: ["client", "axionia", "formateur"] as const,
    imageDataUrl: "data:image/png;base64,AAAA",
    maintenant: MAINTENANT,
    ...over,
  };
}

/**
 * Un refus ne suffit pas : il doit tomber AVANT toute écriture. Une image posée
 * sur R2 puis abandonnée, ou pire une ligne créée, laisserait derrière elle la
 * trace d'une signature que le refus prétend n'avoir jamais eu lieu.
 */
function attendRefusAnnulee(res: unknown) {
  expect(res).toStrictEqual({
    ok: false,
    raison: "piece_annulee",
    message: expect.any(String),
  });
  expect(mockStore).not.toHaveBeenCalled();
  expect(mockPrisma.documentSignature.create).not.toHaveBeenCalled();
  expect(mockPrisma.documentGenere.update).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.documentGenere.findUnique.mockResolvedValue(pieceAnnulee());
  mockPrisma.documentGenere.update.mockResolvedValue({ id: DOC });
  mockPrisma.documentSignature.findFirst.mockResolvedValue(null);
  mockPrisma.documentSignature.findMany.mockResolvedValue([]);
  mockPrisma.documentSignature.count.mockResolvedValue(0);
  mockPrisma.documentSignature.create.mockImplementation(
    async (args: { data: Record<string, unknown> }) => ({
      id: args.data["id"],
      selfHash: args.data["selfHash"],
    }),
  );
  // Jeton parfaitement VALIDE : c'est tout le propos. Rien ne cloche du côté du
  // lien — c'est la pièce qui n'a plus de valeur.
  mockPrisma.documentSignatureToken.findUnique.mockResolvedValue({
    documentGenereId: DOC,
    partie: "client",
    signataireNom: "Camille Durand",
    signataireEmail: "camille@client.test",
    signataireQualite: "Directrice",
    expiresAt: new Date("2026-12-01T00:00:00.000Z"),
    revokedAt: null,
  });
  mockPrisma.trainer.findUnique.mockResolvedValue({
    nom: "Jullin",
    prenom: "Williams",
    email: "w@axion.test",
  });
  mockPrisma.adminUser.findUnique.mockResolvedValue({
    name: "Williams Jullin",
    email: "w@axion.test",
    status: "active",
    role: "super_admin",
  });
  mockPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb(mockPrisma),
  );
  mockStore.mockResolvedValue({
    key: "emargement/2026/signatures/x.png",
    sha256: "a".repeat(64),
    mimeType: "image/png",
    sizeBytes: 1234,
  });
});

describe("🔴 signerDocument — une pièce ANNULÉE ne se signe sur AUCUN canal", () => {
  it("canal A (lien à jeton) : le lien est valide, la pièce ne l'est plus", async () => {
    // Le canal qui SORT de l'organisme, et le seul dont la signature déclenche
    // des envois automatiques à des stagiaires réels.
    attendRefusAnnulee(
      await signerDocument(entree({ type: "signataire_jeton", tokenId: TOKEN, partie: "client" })),
    );
  });

  it("canal B (organisme authentifié) : contresigner ne ressuscite pas la pièce", async () => {
    attendRefusAnnulee(
      await signerDocument(
        entree({ type: "organisme_authentifie", adminId: ADMIN, partie: "axionia" }),
      ),
    );
  });

  it("canal B (formateur authentifié)", async () => {
    attendRefusAnnulee(
      await signerDocument(
        entree({ type: "formateur_authentifie", trainerId: TRAINER, partie: "formateur" }),
      ),
    );
  });

  it("canal papier : aucun reversement n'est réservé, faute de flux qui l'exige", async () => {
    // `reversement_papier` est DÉFINI mais n'a aucun appelant dans le dépôt, et
    // le service n'accepte aucune date de recueil distincte de `maintenant` : il
    // ne peut donc pas attester qu'un papier a été signé AVANT l'annulation.
    // Réserver l'exception ici reviendrait à l'ouvrir sur une simple promesse.
    attendRefusAnnulee(
      await signerDocument(
        entree(
          {
            type: "reversement_papier",
            adminId: ADMIN,
            provider: "physical_signed",
            partie: "client",
            signataire: { nom: "Camille Durand" },
          },
          { methode: "papier_scanne" },
        ),
      ),
    );
  });

  it("le message NOMME l'annulation — sinon le signataire redemande un lien pour rien", async () => {
    const res = await signerDocument(
      entree({ type: "signataire_jeton", tokenId: TOKEN, partie: "client" }),
    );
    expect((res as { message: string }).message.toLowerCase()).toContain("annul");
  });

  it("une pièce NON annulée reste signable — sinon la garde ne garde rien, elle bloque", async () => {
    mockPrisma.documentGenere.findUnique.mockResolvedValue(pieceAnnulee({ annuleeAt: null }));
    const res = await signerDocument(
      entree({ type: "signataire_jeton", tokenId: TOKEN, partie: "client" }),
    );
    expect(res).toMatchObject({ ok: true });
  });
});
