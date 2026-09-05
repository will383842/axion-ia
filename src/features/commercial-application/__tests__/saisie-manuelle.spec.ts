// La saisie manuelle d'un contact apporteur.
//
// ── Ce que ces tests protègent ────────────────────────────────────────────
// Trois règles font toute la valeur de cet écran, et chacune est le genre de
// chose qu'on « améliore » de bonne foi en la cassant :
//
//   1. AUCUN ENVOI. La personne n'a rien demandé. Quelqu'un qui brancherait
//      « les mêmes e-mails que le tunnel, par cohérence » lui enverrait un
//      message non sollicité — et, pour un apporteur, un rappel d'activité
//      attendue, c'est-à-dire un indice de requalification.
//   2. LE CONSENTEMENT N'EST PAS SIMULÉ. On enregistre le fait « aucun », pas
//      un `optin` fabriqué. Un accord inventé vaut moins que pas d'accord.
//   3. LE DOUBLON SE TRAITE AVANT L'ÉCRITURE. Après, il faudrait fusionner, et
//      la fusion n'existe pas.

import { describe, it, expect, vi, beforeEach } from "vitest";

const creer = vi.fn(async (_a: unknown) => ({ id: "33333333-3333-4333-8333-333333333333" }));
const chercherPlusieurs = vi.fn(async (_a: unknown) => [] as unknown[]);
const journaliser = vi.fn(async (_a: unknown) => ({ id: "log" }));
const enfiler = vi.fn(async (..._a: unknown[]) => ({ enqueued: true }));
const notifier = vi.fn(async (_a: unknown) => ({ ok: true }));

let session: { user?: { id?: string; role?: string } } | null = {
  user: { id: "admin-1", role: "admin" },
};

vi.mock("@/auth", () => ({ auth: async () => session }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: {
      create: (a: unknown) => creer(a),
      findMany: (a: unknown) => chercherPlusieurs(a),
    },
    activityLog: { create: (a: unknown) => journaliser(a) },
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/lib/pii-crypto", () => ({
  encryptPii: (v: string) => `chiffre(${v})`,
  decryptPii: (v: string) => String(v).replace(/^chiffre\(|\)$/g, ""),
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => enfiler(...a),
  emailsQueue: { remove: async () => 0 },
}));
vi.mock("@/server/notifications", () => ({ notify: (a: unknown) => notifier(a) }));

const { creerContactManuelAction } = await import("../saisie-manuelle-actions");

const valide = {
  prenom: "Camille",
  nom: "Durand",
  email: "camille.durand@example.com",
  telephone: "0612345678",
  origine: "salon",
};

beforeEach(() => {
  creer.mockClear();
  chercherPlusieurs.mockClear();
  chercherPlusieurs.mockResolvedValue([]);
  journaliser.mockClear();
  enfiler.mockClear();
  notifier.mockClear();
  session = { user: { id: "admin-1", role: "admin" } };
});

describe("creerContactManuelAction", () => {
  it("crée la ligne avec sa clé de personne, l'origine, et le fait qu'aucun accord n'existe", async () => {
    const r = await creerContactManuelAction(valide);
    expect(r).toMatchObject({ ok: true });

    const args = creer.mock.calls[0]?.[0] as {
      data: { contactEmailHash?: string | null; source?: string; details: Record<string, unknown> };
    };
    expect(args.data.contactEmailHash, "clé de personne absente").toBeTruthy();
    expect(args.data.source, "une ligne saisie doit se distinguer d'un formulaire").toBe("import");
    expect(args.data.details["origine"]).toBe("saisie-manuelle");
    expect(args.data.details["origineSaisie"]).toBe("salon");
    // 🔴 Le FAIT, pas un `optin` fabriqué.
    expect(String(args.data.details["consentement"])).toContain("aucun");
  });

  it("🔴 N'ENVOIE RIEN — ni confirmation, ni rappels", async () => {
    // La règle la plus facile à casser « par cohérence avec le tunnel ». Cette
    // personne n'a rien demandé : lui écrire est un message non sollicité, et
    // un rappel d'activité attendue est un indice de requalification.
    await creerContactManuelAction(valide);
    expect(enfiler, "aucun e-mail ne doit être mis en file").not.toHaveBeenCalled();
  });

  it("REFUSE d'écrire si l'adresse est déjà connue, et rend les traces", async () => {
    chercherPlusieurs.mockResolvedValue([
      {
        id: "ligne-1",
        type: "contact",
        details: { etape: "premier-contact" },
        submittedAt: new Date("2026-08-01T09:00:00Z"),
        contactName: "chiffre(Camille)",
      },
    ]);
    const r = await creerContactManuelAction(valide);
    expect(r).toMatchObject({ ok: false, erreur: "doublon" });
    expect(
      creer,
      "rien ne doit être écrit tant que le doublon n'est pas tranché",
    ).not.toHaveBeenCalled();
    if (r.ok === false && r.erreur === "doublon") {
      expect(r.traces[0]?.nom).toBe("Camille");
    }
  });

  it("écrit quand même si l'administrateur confirme sciemment", async () => {
    // Le doublon informe, il n'interdit pas : deux personnes peuvent partager
    // une adresse (un couple, une adresse d'entreprise). Le refus définitif
    // obligerait à contourner l'écran.
    chercherPlusieurs.mockResolvedValue([
      {
        id: "ligne-1",
        type: "contact",
        details: {},
        submittedAt: new Date(),
        contactName: "chiffre(X)",
      },
    ]);
    const r = await creerContactManuelAction({ ...valide, confirmeMalgreDoublon: true });
    expect(r).toMatchObject({ ok: true });
    expect(creer).toHaveBeenCalledTimes(1);
  });

  it("la recherche de doublon porte sur l'EMPREINTE, jamais sur l'adresse en clair", async () => {
    // Une requête en clair ne rendrait JAMAIS rien — colonne chiffrée à IV
    // aléatoire — et le doublon passerait sans erreur.
    await creerContactManuelAction(valide);
    const where = (chercherPlusieurs.mock.calls[0]?.[0] as { where: Record<string, unknown> })
      ?.where;
    expect(where).toHaveProperty("contactEmailHash");
    expect(JSON.stringify(where)).not.toContain("camille.durand");
  });

  it("journalise qui a créé la ligne, sans recopier l'adresse en clair", async () => {
    await creerContactManuelAction(valide);
    expect(journaliser).toHaveBeenCalledTimes(1);
    const log = journaliser.mock.calls[0]?.[0] as { data: { changes: Record<string, unknown> } };
    expect(JSON.stringify(log.data.changes)).not.toContain("camille.durand");
    expect(log.data.changes["envoi"]).toBe("aucun");
  });

  it("REFUSE sans session, et REFUSE un rôle en lecture seule", async () => {
    session = null;
    expect(await creerContactManuelAction(valide)).toMatchObject({ erreur: "non-autorise" });

    session = { user: { id: "u", role: "viewer" } };
    expect(await creerContactManuelAction(valide)).toMatchObject({ erreur: "non-autorise" });
    expect(creer).not.toHaveBeenCalled();
  });

  it("REFUSE une adresse invalide ou un prénom vide", async () => {
    for (const mauvais of [
      { ...valide, email: "pas-une-adresse" },
      { ...valide, prenom: "" },
      { ...valide, origine: "inconnue-du-catalogue" },
    ]) {
      creer.mockClear();
      expect(await creerContactManuelAction(mauvais)).toMatchObject({
        erreur: "champs-invalides",
      });
      expect(creer).not.toHaveBeenCalled();
    }
  });
});
