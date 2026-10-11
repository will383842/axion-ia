// @vitest-environment node

/**
 * Verrou — le candidat supprime SA candidature en un clic depuis nos e-mails
 * (décision de Will, 2026-10-11).
 *
 * Ce que ce fichier garde :
 *  · le jeton : une finalité propre, refusée pour toute autre (et l'inverse),
 *    falsification et expiration refusées ;
 *  · 🔴 la LECTURE (GET de la page) n'efface rien ;
 *  · l'effacement (POST) : fichiers d'abord, ligne ensuite, journal sans
 *    donnée personnelle, alerte avec le seul intitulé du poste ;
 *  · une personne recrutée n'est pas effaçable par ce lien ;
 *  · un double clic ne lève pas d'erreur ;
 *  · le quota par IP ;
 *  · la page et l'action : la page n'importe pas l'effacement, le geste passe
 *    par un formulaire.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const ordre: string[] = [];
const findUnique = vi.fn();
const deleteMany = vi.fn();
const activityCreate = vi.fn();
const notify = vi.fn();
const checkRateLimit = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobApplication: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      deleteMany: (...a: unknown[]) => {
        ordre.push("ligne");
        return deleteMany(...a);
      },
      delete: () => {
        throw new Error("delete() interdit : deleteMany garde le double clic");
      },
    },
    activityLog: { create: (...a: unknown[]) => activityCreate(...a) },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...a: unknown[]) => checkRateLimit(...a),
}));

vi.mock("@/server/careers/cv-storage", () => ({
  deleteCv: async (chemin: string | null) => {
    ordre.push(`fichier:${chemin ?? "∅"}`);
  },
}));

vi.mock("@/server/careers/videos-candidat", () => ({
  supprimerVideosCandidature: async (id: string) => {
    ordre.push(`videos:${id}`);
  },
}));

vi.mock("@/server/notifications", () => ({
  notify: (...a: unknown[]) => notify(...a),
}));

import {
  ACTION_JOURNAL,
  effacerCandidatureParLeCandidat,
  lireDemandeEffacement,
} from "../effacement-par-le-candidat";
import {
  signEffacementCandidatureToken,
  signVivierOppositionToken,
  verifyEffacementCandidatureToken,
  verifyVivierOppositionToken,
} from "@/server/vivier/token";

const ID = "4f1c2b8a-1111-4222-8333-944455556666";
const DOSSIER = {
  status: "reviewing",
  offerTitleSnap: "Développeur web",
  cvStoragePath: "/data/cv/abc.pdf",
  photoStoragePath: "/data/photos/abc.jpg",
};
const IP = { ip: "203.0.113.7" };

beforeAll(() => {
  process.env["AUTH_SECRET"] = "secret-de-test-suffisamment-long-0123456789";
});

beforeEach(() => {
  ordre.length = 0;
  findUnique.mockReset().mockResolvedValue(DOSSIER);
  deleteMany.mockReset().mockResolvedValue({ count: 1 });
  activityCreate.mockReset().mockResolvedValue({});
  notify.mockReset().mockResolvedValue(undefined);
  checkRateLimit.mockReset().mockResolvedValue({ allowed: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("le jeton d'effacement", () => {
  it("désigne UNE candidature", async () => {
    const jeton = await signEffacementCandidatureToken(ID);
    await expect(verifyEffacementCandidatureToken(jeton)).resolves.toEqual({
      ok: true,
      applicationId: ID,
    });
  });

  it("🔴 un jeton d'OPPOSITION au vivier ne sert pas à effacer", async () => {
    const opposition = await signVivierOppositionToken(ID);
    await expect(verifyEffacementCandidatureToken(opposition)).resolves.toEqual({
      ok: false,
      reason: "wrong_audience",
    });
    expect(await effacerCandidatureParLeCandidat(opposition, IP)).toBe("neutre");
    expect(deleteMany).not.toHaveBeenCalled();
    expect(ordre).toEqual([]);
  });

  it("…et réciproquement : un jeton d'effacement ne vaut pas opposition", async () => {
    const effacement = await signEffacementCandidatureToken(ID);
    await expect(verifyVivierOppositionToken(effacement)).resolves.toEqual({
      ok: false,
      reason: "wrong_audience",
    });
  });

  it("🔴 un jeton falsifié est refusé", async () => {
    const jeton = await signEffacementCandidatureToken(ID);
    const [, signature] = jeton.split(".");
    const autre = Buffer.from(
      JSON.stringify({ sub: "un-autre-dossier", aud: "candidature-effacement", exp: 9e15 }),
    ).toString("base64url");
    expect(await effacerCandidatureParLeCandidat(`${autre}.${signature}`, IP)).toBe("neutre");
    expect(await effacerCandidatureParLeCandidat("n.importe.quoi", IP)).toBe("neutre");
    expect(await effacerCandidatureParLeCandidat("", IP)).toBe("neutre");
    expect(deleteMany).not.toHaveBeenCalled();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("🔴 un jeton expiré est refusé", async () => {
    const jeton = await signEffacementCandidatureToken(ID);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 801 * 24 * 60 * 60 * 1000);
    await expect(verifyEffacementCandidatureToken(jeton)).resolves.toEqual({
      ok: false,
      reason: "expired",
    });
    expect(await effacerCandidatureParLeCandidat(jeton, IP)).toBe("neutre");
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("vit au moins aussi longtemps que le dossier (24 mois)", async () => {
    const jeton = await signEffacementCandidatureToken(ID);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 25 * 31 * 24 * 60 * 60 * 1000);
    await expect(verifyEffacementCandidatureToken(jeton)).resolves.toMatchObject({ ok: true });
  });
});

describe("🔴 la lecture (GET de la page) n'efface rien", () => {
  it("jeton valide : le poste est affiché, rien n'est touché", async () => {
    const jeton = await signEffacementCandidatureToken(ID);
    await expect(lireDemandeEffacement(jeton)).resolves.toEqual({
      etat: "pret",
      poste: "Développeur web",
    });
    expect(deleteMany).not.toHaveBeenCalled();
    expect(activityCreate).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
    expect(ordre).toEqual([]);
  });

  it("jeton refusé et dossier introuvable rendent le MÊME état neutre", async () => {
    await expect(lireDemandeEffacement("faux.jeton")).resolves.toEqual({ etat: "neutre" });
    findUnique.mockResolvedValueOnce(null);
    const jeton = await signEffacementCandidatureToken(ID);
    await expect(lireDemandeEffacement(jeton)).resolves.toEqual({ etat: "neutre" });
  });

  it("personne recrutée : l'état le dit, sans bouton", async () => {
    findUnique.mockResolvedValueOnce({ ...DOSSIER, status: "hired" });
    const jeton = await signEffacementCandidatureToken(ID);
    await expect(lireDemandeEffacement(jeton)).resolves.toEqual({ etat: "recrute" });
  });
});

describe("l'effacement (POST, après le clic)", () => {
  it("🔴 fichiers d'abord, ligne ensuite", async () => {
    const jeton = await signEffacementCandidatureToken(ID);
    expect(await effacerCandidatureParLeCandidat(jeton, IP)).toBe("efface");
    expect(ordre).toEqual([
      "fichier:/data/cv/abc.pdf",
      "fichier:/data/photos/abc.jpg",
      `videos:${ID}`,
      "ligne",
    ]);
    // Le statut est relu DANS la suppression.
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: ID, status: { not: "hired" } } });
  });

  it("journal : l'action et l'identifiant, AUCUNE donnée personnelle", async () => {
    const jeton = await signEffacementCandidatureToken(ID);
    await effacerCandidatureParLeCandidat(jeton, IP);
    expect(activityCreate).toHaveBeenCalledWith({
      data: {
        adminUserId: null,
        action: ACTION_JOURNAL,
        targetType: "job_application",
        targetId: ID,
      },
    });
    expect(ACTION_JOURNAL).toBe("jobapplication.self_erased");
    expect(JSON.stringify(activityCreate.mock.calls)).not.toContain(IP.ip);
  });

  it("alerte : l'intitulé du poste seulement", async () => {
    const jeton = await signEffacementCandidatureToken(ID);
    await effacerCandidatureParLeCandidat(jeton, IP);
    expect(notify).toHaveBeenCalledTimes(1);
    const evenement = notify.mock.calls[0]![0] as {
      category: string;
      payload: Record<string, unknown>;
    };
    expect(evenement.category).toBe("CANDIDAT_SELF_ERASED");
    expect(Object.keys(evenement.payload).sort()).toEqual(["erasedAt", "offerTitle"]);
    expect(evenement.payload["offerTitle"]).toBe("Développeur web");
  });

  it("une alerte en panne ne remet pas l'effacement en cause", async () => {
    notify.mockRejectedValueOnce(new Error("telegram"));
    activityCreate.mockRejectedValueOnce(new Error("base"));
    const jeton = await signEffacementCandidatureToken(ID);
    expect(await effacerCandidatureParLeCandidat(jeton, IP)).toBe("efface");
  });

  it("🛑 une personne RECRUTÉE n'est pas effaçable par ce lien", async () => {
    findUnique.mockResolvedValueOnce({ ...DOSSIER, status: "hired" });
    const jeton = await signEffacementCandidatureToken(ID);
    expect(await effacerCandidatureParLeCandidat(jeton, IP)).toBe("recrute");
    expect(ordre).toEqual([]);
    expect(deleteMany).not.toHaveBeenCalled();
    expect(activityCreate).not.toHaveBeenCalled();
  });

  it("double clic : la seconde requête ne trouve plus rien, sans erreur", async () => {
    const jeton = await signEffacementCandidatureToken(ID);
    expect(await effacerCandidatureParLeCandidat(jeton, IP)).toBe("efface");
    findUnique.mockResolvedValueOnce(null);
    expect(await effacerCandidatureParLeCandidat(jeton, IP)).toBe("deja");
    expect(activityCreate).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it("double clic SIMULTANÉ : la seconde suppression compte 0 ligne, sans trace en double", async () => {
    deleteMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const jeton = await signEffacementCandidatureToken(ID);
    const issues = await Promise.all([
      effacerCandidatureParLeCandidat(jeton, IP),
      effacerCandidatureParLeCandidat(jeton, IP),
    ]);
    expect(issues.sort()).toEqual(["deja", "efface"]);
    expect(activityCreate).toHaveBeenCalledTimes(1);
  });

  it("quota par IP atteint : rien n'est lu ni effacé", async () => {
    checkRateLimit.mockResolvedValueOnce({ allowed: false });
    const jeton = await signEffacementCandidatureToken(ID);
    expect(await effacerCandidatureParLeCandidat(jeton, IP)).toBe("trop_de_tentatives");
    expect(checkRateLimit).toHaveBeenCalledWith(
      `candidature-effacement:${IP.ip}`,
      expect.objectContaining({ limit: 10, windowSec: 3600 }),
    );
    expect(findUnique).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
  });
});

describe("la page affiche, l'action agit", () => {
  const RACINE = process.cwd();
  const page = readFileSync(
    join(RACINE, "src/app/[locale]/candidature/supprimer/page.tsx"),
    "utf8",
  );
  const action = readFileSync(
    join(RACINE, "src/app/[locale]/candidature/supprimer/actions.ts"),
    "utf8",
  );
  const sansCommentaires = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
  const codePage = sansCommentaires(page);

  it("contre-témoin : le filtre n'a pas vidé la source", () => {
    expect(codePage).toContain("lireDemandeEffacement");
    expect(codePage.length).toBeGreaterThan(page.length / 3);
  });

  it("🔴 la page n'appelle pas l'effacement", () => {
    expect(codePage).not.toContain("effacerCandidatureParLeCandidat");
    expect(codePage).not.toContain("deleteMany");
    expect(codePage).not.toContain("deleteCv");
  });

  it("🔴 le geste passe par un FORMULAIRE, pas par un lien", () => {
    expect(codePage).toContain("<form action={supprimerMaCandidature}>");
    expect(codePage).toContain('type="submit"');
    expect(codePage).toContain('name="token"');
    expect(action).toContain('const CHAMP_JETON = "token";');
  });

  it("l'action est une action serveur, et c'est elle qui efface", () => {
    expect(action.trimStart().startsWith('"use server"')).toBe(true);
    expect(action).toContain("effacerCandidatureParLeCandidat(");
  });

  it("la page n'est pas indexée", () => {
    expect(page).toContain("robots: { index: false, follow: false }");
  });
});
