import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
  const tx = {
    tourDemande: { findUnique: vi.fn(), update: vi.fn(async () => ({})) },
    activityLog: { create: vi.fn(async () => ({})) },
  };
  return {
    tx,
    prisma: { $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)) },
    auth: vi.fn(),
    creerFicheDepuisDemande: vi.fn(),
    revalidatePath: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: m.prisma }));
vi.mock("@/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/admin-path", () => ({
  adminPath: (_l: string, sous = "") => `/fr/adm/${sous}`,
}));
vi.mock("@/features/admin-calendly/acces", () => ({
  peutVoirLesAppels: (role: string | undefined) => role === "ADMIN",
}));
vi.mock("../fiche", () => ({ creerFicheDepuisDemande: m.creerFicheDepuisDemande }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidatePath }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { changerStatutDemande } from "../gestes";
import { creerFicheProspect, ecarter, marquerRelancee, remettreRecue } from "../statuts";

const ID = "3f2b8c1e-5d4a-4b7e-9c1d-0a1b2c3d4e5f";

function formulaire(champs: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(champs)) f.set(k, v);
  return f;
}

async function redirige(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    const t = (e as Error).message;
    if (t.startsWith("REDIRECT:")) return decodeURIComponent(t.slice("REDIRECT:".length));
    throw e;
  }
  throw new Error("aucune redirection");
}

beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
  m.tx.tourDemande.findUnique.mockResolvedValue({ statut: "recue" });
});

describe("gestes : changer un statut, rien d'autre", () => {
  it("pose le statut et laisse une trace dans la même transaction", async () => {
    await expect(changerStatutDemande(ID, "relancee_main", "u1")).resolves.toBe("ok");
    const maj = (
      m.tx.tourDemande.update.mock.calls[0] as unknown as [{ data: Record<string, unknown> }]
    )[0];
    expect(maj.data["statut"]).toBe("relancee_main");
    expect(m.tx.activityLog.create).toHaveBeenCalledTimes(1);
  });

  it("une demande effacée à la demande de la personne ne change plus", async () => {
    m.tx.tourDemande.findUnique.mockResolvedValue({ statut: "effacee_rgpd" });
    await expect(changerStatutDemande(ID, "recue", "u1")).resolves.toBe("efface");
    expect(m.tx.tourDemande.update).not.toHaveBeenCalled();
  });

  it("même statut : rien n'est écrit ; demande inconnue : dite", async () => {
    await expect(changerStatutDemande(ID, "recue", "u1")).resolves.toBe("inchange");
    m.tx.tourDemande.findUnique.mockResolvedValue(null);
    await expect(changerStatutDemande(ID, "ecartee", "u1")).resolves.toBe("introuvable");
    expect(m.tx.tourDemande.update).not.toHaveBeenCalled();
  });
});

describe("boutons de la console", () => {
  it("« J'ai relancé », « Écarter » et « Remettre en attente » changent le statut", async () => {
    const ok1 = await redirige(marquerRelancee(formulaire({ id: ID })));
    expect(ok1).toContain("ok=");
    m.tx.tourDemande.findUnique.mockResolvedValue({ statut: "relancee_main" });
    await redirige(ecarter(formulaire({ id: ID })));
    await redirige(remettreRecue(formulaire({ id: ID })));
    const statuts = m.tx.tourDemande.update.mock.calls.map(
      (c) => (c as unknown as [{ data: { statut: string } }])[0].data.statut,
    );
    expect(statuts).toEqual(["relancee_main", "ecartee", "recue"]);
  });

  it("sans rôle admis, rien n'est changé", async () => {
    m.auth.mockResolvedValue({ user: { id: "u2", role: "STAGIAIRE" } });
    const url = await redirige(ecarter(formulaire({ id: ID })));
    expect(url).toContain("erreur=");
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("sans session, renvoie vers la connexion", async () => {
    m.auth.mockResolvedValue(null);
    const url = await redirige(ecarter(formulaire({ id: ID })));
    expect(url).toBe("/fr/adm/login");
  });

  it("un identifiant qui n'est pas un UUID est refusé", async () => {
    const url = await redirige(ecarter(formulaire({ id: "1; DROP TABLE" })));
    expect(url).toContain("erreur=");
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("« Créer la fiche prospect » exige un nom de fiche, puis passe par la porte unique", async () => {
    const vide = await redirige(creerFicheProspect(formulaire({ id: ID, raisonSociale: " " })));
    expect(vide).toContain("erreur=");
    expect(m.creerFicheDepuisDemande).not.toHaveBeenCalled();

    m.creerFicheDepuisDemande.mockResolvedValue({ statut: "cree", clientId: "c1", numero: "C-12" });
    const ok = await redirige(
      creerFicheProspect(
        formulaire({ id: ID, raisonSociale: "Société Exemple", type: "entreprise" }),
      ),
    );
    expect(ok).toContain("C-12");
    expect(m.creerFicheDepuisDemande).toHaveBeenCalledWith(
      ID,
      { raisonSociale: "Société Exemple", type: "entreprise", motif: null },
      "u1",
    );
  });

  it("un refus de la porte unique est dit à l'équipe", async () => {
    m.creerFicheDepuisDemande.mockResolvedValue({
      statut: "refuse",
      message: "Adresse déjà connue.",
    });
    const url = await redirige(
      creerFicheProspect(formulaire({ id: ID, raisonSociale: "Société Exemple" })),
    );
    expect(url).toContain("Adresse déjà connue.");
  });
});

describe("garde : aucune suppression, module « use server » propre", () => {
  const dossier = join(process.cwd(), "src", "features", "tour-de-france");
  const sources = readdirSync(dossier)
    .filter((n) => n.endsWith(".ts"))
    .map((n) => ({ nom: n, texte: readFileSync(join(dossier, n), "utf8") }));

  it("aucun fichier du dossier ne supprime une ligne", () => {
    for (const { nom, texte } of sources) {
      expect(texte, nom).not.toMatch(/\.delete\(/);
      expect(texte, nom).not.toMatch(/\.deleteMany\(/);
      expect(texte, nom).not.toMatch(/\$executeRaw[^;]*\bDELETE\b/i);
    }
  });

  it("statuts.ts n'exporte que des fonctions asynchrones", () => {
    const texte = sources.find((s) => s.nom === "statuts.ts")?.texte ?? "";
    const exports = [...texte.matchAll(/^export\s+(.*)$/gm)].map((x) => x[1] ?? "");
    expect(exports.length).toBeGreaterThan(0);
    for (const e of exports) expect(e).toMatch(/^async function /);
  });
});
