import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
  const tx = {
    tourDemande: { findUnique: vi.fn(), updateMany: vi.fn(async () => ({ count: 1 })) },
    activityLog: { create: vi.fn(async () => ({})) },
  };
  return {
    tx,
    prisma: { $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)) },
    auth: vi.fn(),
    creerFicheDepuisDemande: vi.fn(),
    completerFicheDepuisDemande: vi.fn(),
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
vi.mock("../fiche", () => ({
  creerFicheDepuisDemande: m.creerFicheDepuisDemande,
  completerFicheDepuisDemande: m.completerFicheDepuisDemande,
}));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidatePath }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { changerStatutDemande } from "../gestes";
import {
  completerFiche,
  creerFicheProspect,
  ecarter,
  marquerRelancee,
  remettreRecue,
} from "../statuts";

const ID = "3f2b8c1e-5d4a-4b7e-9c1d-0a1b2c3d4e5f";
const FICHE = "7a1d2c3b-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

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
      m.tx.tourDemande.updateMany.mock.calls[0] as unknown as [{ data: Record<string, unknown> }]
    )[0];
    expect(maj.data["statut"]).toBe("relancee_main");
    expect(m.tx.activityLog.create).toHaveBeenCalledTimes(1);
  });

  it("une demande effacée à la demande de la personne ne change plus", async () => {
    m.tx.tourDemande.findUnique.mockResolvedValue({ statut: "effacee_rgpd" });
    await expect(changerStatutDemande(ID, "recue", "u1")).resolves.toBe("efface");
    expect(m.tx.tourDemande.updateMany).not.toHaveBeenCalled();
  });

  it("un effacement survenu entre la lecture et l'écriture n'est pas défait (updateMany conditionnel)", async () => {
    m.tx.tourDemande.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(changerStatutDemande(ID, "relancee_main", "u1")).resolves.toBe("efface");
    const maj = (
      m.tx.tourDemande.updateMany.mock.calls[0] as unknown as [{ where: Record<string, unknown> }]
    )[0];
    expect(maj.where).toEqual({ id: ID, statut: { not: "effacee_rgpd" } });
    expect(m.tx.activityLog.create).not.toHaveBeenCalled();
  });

  it("« Écarter » libère la place : clés de comptage retirées, la demande ne compte plus", async () => {
    await expect(changerStatutDemande(ID, "ecartee", "u1")).resolves.toBe("ok");
    const maj = (
      m.tx.tourDemande.updateMany.mock.calls[0] as unknown as [{ data: Record<string, unknown> }]
    )[0];
    expect(maj.data["statut"]).toBe("ecartee");
    expect(maj.data["compte"]).toBe(false);
    expect(maj.data["cleComptagePersonne"]).toBeNull();
    expect(maj.data["cleComptageDomaine"]).toBeNull();
    expect(maj.data["cleComptageTelephone"]).toBeNull();
  });

  it("les autres gestes ne touchent ni `compte` ni les clés de comptage", async () => {
    await changerStatutDemande(ID, "relancee_main", "u1");
    const maj = (
      m.tx.tourDemande.updateMany.mock.calls[0] as unknown as [{ data: Record<string, unknown> }]
    )[0];
    for (const cle of [
      "compte",
      "cleComptagePersonne",
      "cleComptageDomaine",
      "cleComptageTelephone",
    ]) {
      expect(maj.data, cle).not.toHaveProperty(cle);
    }
  });

  it("même statut : rien n'est écrit ; demande inconnue : dite", async () => {
    await expect(changerStatutDemande(ID, "recue", "u1")).resolves.toBe("inchange");
    m.tx.tourDemande.findUnique.mockResolvedValue(null);
    await expect(changerStatutDemande(ID, "ecartee", "u1")).resolves.toBe("introuvable");
    expect(m.tx.tourDemande.updateMany).not.toHaveBeenCalled();
  });
});

describe("boutons de la console", () => {
  it("« J'ai relancé », « Écarter » et « Remettre en attente » changent le statut", async () => {
    const ok1 = await redirige(marquerRelancee(formulaire({ id: ID })));
    expect(ok1).toContain("ok=relancee");
    m.tx.tourDemande.findUnique.mockResolvedValue({ statut: "relancee_main" });
    await redirige(ecarter(formulaire({ id: ID })));
    await redirige(remettreRecue(formulaire({ id: ID })));
    const statuts = m.tx.tourDemande.updateMany.mock.calls.map(
      (c) => (c as unknown as [{ data: { statut: string } }])[0].data.statut,
    );
    expect(statuts).toEqual(["relancee_main", "ecartee", "recue"]);
  });

  it("sans rôle admis, rien n'est changé", async () => {
    m.auth.mockResolvedValue({ user: { id: "u2", role: "STAGIAIRE" } });
    const url = await redirige(ecarter(formulaire({ id: ID })));
    expect(url).toContain("erreur=role");
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("sans session, renvoie vers la connexion", async () => {
    m.auth.mockResolvedValue(null);
    const url = await redirige(ecarter(formulaire({ id: ID })));
    expect(url).toBe("/fr/adm/login");
  });

  it("un identifiant qui n'est pas un UUID est refusé", async () => {
    const url = await redirige(ecarter(formulaire({ id: "1; DROP TABLE" })));
    expect(url).toContain("erreur=demande_inconnue");
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("une demande effacée à la demande de la personne : message d'une liste fermée", async () => {
    m.tx.tourDemande.findUnique.mockResolvedValue({ statut: "effacee_rgpd" });
    const url = await redirige(ecarter(formulaire({ id: ID })));
    expect(url).toContain("erreur=demande_effacee");
  });

  it("« Créer la fiche prospect » exige un nom de fiche, puis passe par la porte unique", async () => {
    const vide = await redirige(creerFicheProspect(formulaire({ id: ID, raisonSociale: " " })));
    expect(vide).toContain("erreur=nom_fiche");
    expect(m.creerFicheDepuisDemande).not.toHaveBeenCalled();

    m.creerFicheDepuisDemande.mockResolvedValue({ statut: "cree", clientId: "c1", numero: "C-12" });
    const ok = await redirige(
      creerFicheProspect(
        formulaire({ id: ID, raisonSociale: "Société Exemple", type: "entreprise" }),
      ),
    );
    expect(ok).toContain("ok=fiche_creee");
    expect(m.creerFicheDepuisDemande).toHaveBeenCalledWith(
      ID,
      { raisonSociale: "Société Exemple", type: "entreprise", motif: null },
      "u1",
    );
  });

  it("un refus de la porte unique est dit à l'équipe par un CODE, jamais recopié", async () => {
    m.creerFicheDepuisDemande.mockResolvedValue({
      statut: "refuse",
      message: "Adresse déjà connue.",
    });
    const url = await redirige(
      creerFicheProspect(formulaire({ id: ID, raisonSociale: "Société Exemple" })),
    );
    expect(url).toContain("erreur=fiche_refusee");
    expect(url).not.toContain("Adresse déjà connue.");
  });

  it("une demande effacée ou écartée est dite par son code", async () => {
    m.creerFicheDepuisDemande.mockResolvedValue({ statut: "refuse", message: "Demande effacée." });
    const effacee = await redirige(
      creerFicheProspect(formulaire({ id: ID, raisonSociale: "Société Exemple" })),
    );
    expect(effacee).toContain("erreur=demande_effacee");
    m.creerFicheDepuisDemande.mockResolvedValue({ statut: "refuse", message: "Demande écartée." });
    const ecartee = await redirige(
      creerFicheProspect(formulaire({ id: ID, raisonSociale: "Société Exemple" })),
    );
    expect(ecartee).toContain("erreur=demande_ecartee");
  });

  it("le motif est limité à 300 caractères côté serveur", async () => {
    const trop = await redirige(
      creerFicheProspect(
        formulaire({ id: ID, raisonSociale: "Société Exemple", motif: "m".repeat(301) }),
      ),
    );
    expect(trop).toContain("erreur=motif_long");
    expect(m.creerFicheDepuisDemande).not.toHaveBeenCalled();
    m.creerFicheDepuisDemande.mockResolvedValue({ statut: "cree", clientId: "c1", numero: "C-12" });
    const juste = await redirige(
      creerFicheProspect(
        formulaire({ id: ID, raisonSociale: "Société Exemple", motif: "m".repeat(300) }),
      ),
    );
    expect(juste).toContain("ok=fiche_creee");
  });
});

describe("bouton « Compléter la fiche »", () => {
  it("passe par la fonction de complétion, sur la fiche choisie, au nom de l'équipe", async () => {
    m.completerFicheDepuisDemande.mockResolvedValue({ statut: "completee", clientId: FICHE });
    const url = await redirige(completerFiche(formulaire({ id: ID, ficheId: FICHE })));
    expect(url).toContain("ok=fiche_completee");
    expect(m.completerFicheDepuisDemande).toHaveBeenCalledWith(ID, FICHE, "u1");
  });

  it("est gardé comme les autres : sans rôle admis, rien n'est lu ni écrit", async () => {
    m.auth.mockResolvedValue({ user: { id: "u2", role: "STAGIAIRE" } });
    const url = await redirige(completerFiche(formulaire({ id: ID, ficheId: FICHE })));
    expect(url).toContain("erreur=role");
    expect(m.completerFicheDepuisDemande).not.toHaveBeenCalled();
  });

  it("sans session, renvoie vers la connexion", async () => {
    m.auth.mockResolvedValue(null);
    const url = await redirige(completerFiche(formulaire({ id: ID, ficheId: FICHE })));
    expect(url).toBe("/fr/adm/login");
    expect(m.completerFicheDepuisDemande).not.toHaveBeenCalled();
  });

  it("refuse un identifiant de demande ou de fiche qui n'est pas un UUID", async () => {
    const a = await redirige(completerFiche(formulaire({ id: "x", ficheId: FICHE })));
    expect(a).toContain("erreur=demande_inconnue");
    const b = await redirige(completerFiche(formulaire({ id: ID, ficheId: "1; DROP" })));
    expect(b).toContain("erreur=fiche_non_proche");
    expect(m.completerFicheDepuisDemande).not.toHaveBeenCalled();
  });

  it("dit chaque refus par un code de la liste fermée", async () => {
    const cas = [
      ["introuvable", "demande_inconnue"],
      ["efface", "demande_effacee"],
      ["ecartee", "demande_ecartee"],
      ["fiche_non_proche", "fiche_non_proche"],
      ["fiche_disparue", "fiche_disparue"],
    ] as const;
    for (const [raison, code] of cas) {
      m.completerFicheDepuisDemande.mockResolvedValue({ statut: "refuse", raison });
      const url = await redirige(completerFiche(formulaire({ id: ID, ficheId: FICHE })));
      expect(url, raison).toContain(`erreur=${code}`);
    }
    m.completerFicheDepuisDemande.mockResolvedValue({ statut: "deja_rattachee", clientId: "c1" });
    const deja = await redirige(completerFiche(formulaire({ id: ID, ficheId: FICHE })));
    expect(deja).toContain("erreur=deja_fiche");
  });

  it("une panne est dite sans détail", async () => {
    m.completerFicheDepuisDemande.mockRejectedValue(new Error("base: secret interne"));
    const url = await redirige(completerFiche(formulaire({ id: ID, ficheId: FICHE })));
    expect(url).toContain("erreur=completer_echec");
    expect(url).not.toContain("secret");
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
