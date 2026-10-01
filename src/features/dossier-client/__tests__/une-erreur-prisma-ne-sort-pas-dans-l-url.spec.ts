// @vitest-environment node

/**
 * ⛔ UNE ERREUR PRISMA NE SORT PAS DANS L'URL (vérification finale V1, S4).
 *
 * Les gestes du compte rendu (`compte-rendu-gestes.ts`) et les actions des
 * rencontres (`actions-rencontres.ts`, `erreurVers`) mettaient `err.message`
 * de TOUTE `Error` dans `?erreur=` — Prisma compris (« Invalid
 * `prisma.fait.update()` invocation… », avec le nom des tables et parfois des
 * valeurs). L'URL part dans l'historique, les journaux d'accès et Sentry.
 *
 * Désormais seuls les messages MÉTIER (refus d'un geste, refus d'accès,
 * erreurs de validation, de fusion, de déplacement…) sont montrés ; toute
 * autre erreur devient un texte générique, et le détail va au journal serveur.
 *
 * Mutation qui rougit : rendre `e.message` pour toute `Error` dans
 * `messageAffichable` → les cas Prisma.
 * Contre-témoin : un refus métier garde son texte (Will doit savoir pourquoi).
 * N1 (2e vérification) : `suivi-actions.ts` suit la même règle, et un lien
 * forgé n'affiche plus rien (`message-de-retour.ts`, garde
 * `un-message-forge-ne-s-affiche-pas.spec.ts`).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const etat = vi.hoisted(() => ({
  erreur: new Error("") as unknown,
  session: { user: { id: "11111111-1111-4111-8111-111111111111", role: "admin" } } as unknown,
}));

class Redirection extends Error {
  constructor(readonly url: string) {
    super("NEXT_REDIRECT");
  }
}

vi.mock("@/auth", () => ({ auth: async () => etat.session }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, updateTag: () => undefined }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Redirection(url);
  },
  notFound: () => {
    throw new Error("notFound");
  },
}));
vi.mock("@/server/visio/gestes-compte-rendu", async (original) => ({
  ...(await original<typeof import("@/server/visio/gestes-compte-rendu")>()),
  reecrireCompteRendu: async () => {
    throw etat.erreur;
  },
}));
vi.mock("@/features/dossier-client/deplacer", async (original) => ({
  ...(await original<typeof import("@/features/dossier-client/deplacer")>()),
  deplacerRencontre: async () => {
    throw etat.erreur;
  },
}));

vi.mock("@/server/visio/gestes-suivi", () => ({
  demanderEmailSuivi: async () => {
    throw etat.erreur;
  },
}));
vi.mock("@/server/visio/passes/etapes-a-la-demande", () => ({ envoiEmailSuiviReel: {} }));

import { deplacerRencontreAction } from "@/features/dossier-client/actions-rencontres";
import { gesteSuiviAction } from "@/features/dossier-client/suivi-actions";
import { executerGesteCompteRendu } from "@/features/dossier-client/compte-rendu-gestes";
import { ErreurDeplacement } from "@/features/dossier-client/deplacer";
import {
  MESSAGE_ERREUR_GENERIQUE,
  messageAffichable,
} from "@/features/dossier-client/message-affichable";
import { GesteRefuse } from "@/server/visio/gestes-compte-rendu";

const RENCONTRE = "3f1c2a4e-8b7d-4c1e-9a2b-1c2d3e4f5a6b";
const CLIENT = "22222222-2222-4222-8222-222222222222";

/** Une erreur comme Prisma en lève : nom de table, requête, valeur. */
function erreurPrisma(): Error {
  const e = new Error(
    "\nInvalid `prisma.fait.update()` invocation:\n\nUnique constraint failed on the fields: (`enonce`)",
  );
  e.name = "PrismaClientKnownRequestError";
  return e;
}

async function urlDe(action: () => Promise<unknown>): Promise<string> {
  try {
    await action();
  } catch (e) {
    if (e instanceof Redirection) return decodeURIComponent(e.url);
    throw e;
  }
  throw new Error("aucune redirection");
}

function formulaireGeste(): FormData {
  const fd = new FormData();
  fd.set("geste", "reecrire");
  fd.set("rencontreId", RENCONTRE);
  fd.set("retour", `/fr/console/rendez-vous/rencontres/${RENCONTRE}`);
  return fd;
}

function formulaireDeplacer(): FormData {
  const fd = new FormData();
  fd.set("rencontreId", RENCONTRE);
  fd.set("versClientId", CLIENT);
  return fd;
}

beforeEach(() => {
  etat.session = { user: { id: "11111111-1111-4111-8111-111111111111", role: "admin" } };
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("⛔ une erreur Prisma ne sort pas dans l'URL", () => {
  it("🔴 geste du compte rendu : une erreur Prisma devient un texte générique", async () => {
    etat.erreur = erreurPrisma();
    const url = await urlDe(() => executerGesteCompteRendu(formulaireGeste()));
    expect(url).toContain(`erreur=${MESSAGE_ERREUR_GENERIQUE}`);
    expect(url).not.toMatch(/prisma|Unique constraint|enonce/i);
  });

  it("🔴 action des rencontres (`erreurVers`) : même règle", async () => {
    etat.erreur = erreurPrisma();
    const url = await urlDe(() => deplacerRencontreAction(formulaireDeplacer()));
    expect(url).toContain(`erreur=${MESSAGE_ERREUR_GENERIQUE}`);
    expect(url).not.toMatch(/prisma|Unique constraint|enonce/i);
  });

  it("🔴 N1 : « Préparer l'e-mail de suivi » (`suivi-actions`) : même règle", async () => {
    etat.erreur = erreurPrisma();
    const fd = new FormData();
    fd.set("geste", "email_preparer");
    fd.set("rencontreId", RENCONTRE);
    fd.set("contactId", CLIENT);
    fd.set("retour", `/fr/console/rendez-vous?emailSuivi=${RENCONTRE}`);
    const url = await urlDe(() => gesteSuiviAction(fd));
    expect(url).toContain(`erreur=${MESSAGE_ERREUR_GENERIQUE}`);
    expect(url).not.toMatch(/prisma|Unique constraint|enonce/i);
  });

  it("🔴 une erreur quelconque (TypeError, réseau) n'est pas montrée non plus", () => {
    expect(
      messageAffichable(new TypeError("Cannot read properties of undefined (reading 'id')")),
    ).toBe(MESSAGE_ERREUR_GENERIQUE);
    expect(messageAffichable("texte brut")).toBe(MESSAGE_ERREUR_GENERIQUE);
  });

  it("contre-témoin : un refus métier garde son texte, sur les deux chemins", async () => {
    etat.erreur = new GesteRefuse("Le compte rendu est déjà validé.");
    expect(await urlDe(() => executerGesteCompteRendu(formulaireGeste()))).toContain(
      "erreur=Le compte rendu est déjà validé.",
    );
    etat.erreur = new ErreurDeplacement("Ce rendez-vous est déjà chez ce client.");
    expect(await urlDe(() => deplacerRencontreAction(formulaireDeplacer()))).toContain(
      "erreur=Ce rendez-vous est déjà chez ce client.",
    );
  });

  it("contre-témoin : le refus d'accès (rôle hors A2) nomme la raison", async () => {
    etat.session = { user: { id: "11111111-1111-4111-8111-111111111111", role: "secretaire" } };
    const url = await urlDe(() => executerGesteCompteRendu(formulaireGeste()));
    expect(url).toContain("réservés à Williams et aux administrateurs");
  });

  it("une saisie incomplète (Zod) reste « Demande incomplète. »", () => {
    const r = z.string().uuid().safeParse("x");
    expect(r.success).toBe(false);
    if (!r.success) expect(messageAffichable(r.error)).toBe("Demande incomplète.");
  });
});
