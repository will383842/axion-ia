/**
 * L6b — RÉPONDRE À PLUSIEURS AVEC DES FICHIERS (emploi).
 *
 * Acceptation : 5 cochés dont 1 opposé → 4 envois, 4 liens DISTINCTS (chacun
 * reçoit SON lien), et le récapitulatif nomme l'exclu et pourquoi. Une
 * candidature « Non retenue » ou « Retirée » est exclue de même.
 */
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({
  auth: async () => ({ user: { id: "u1", role: "admin", name: "Will" } }),
}));
vi.mock("@/server/auth/habilitations", () => ({ peutOuvrirDossierCandidat: () => true }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string) => v.replace(/^enc:/, "") }));
const findMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { jobApplication: { findMany: (...a: unknown[]) => findMany(...a) } },
}));
const ecrire = vi.fn();
vi.mock("../envoyer-reponse", () => ({
  ecrireEtEnfilerReponse: (...a: unknown[]) => ecrire(...a),
}));
vi.mock("@/features/job-application/complement", () => ({ lienComplement: vi.fn() }));
const opposees = new Set<string>();
vi.mock("@/server/email/opposition", () => ({
  estOpposee: async (e: string) => opposees.has(e),
}));
const preparer = vi.fn();
vi.mock("@/server/partages/attacher-a-une-reponse", () => ({
  preparerLienFichiers: (...a: unknown[]) => preparer(...a),
}));

import { repondreEnMasseAction } from "../actions-reponse-en-masse";
import type { EtatReponseEnMasse } from "../reponse-en-masse";

const F1 = "33333333-3333-4333-8333-333333333333";
const INITIAL: EtatReponseEnMasse = {
  ok: true,
  envoyees: 0,
  ecartees: 0,
  echouees: 0,
  details: [],
};

function dossier(i: number, extra: Record<string, unknown> = {}) {
  return {
    id: `0000000${i}-0000-4000-8000-000000000000`,
    email: `enc:p${i}@exemple.fr`,
    locale: "fr",
    status: "reviewing",
    offerTitleSnap: "Monteur vidéo",
    firstName: `enc:Prenom${i}`,
    lastName: `enc:Nom${i}`,
    offer: null,
    ...extra,
  };
}

function formulaire(ids: string[], fichiers: string[] = [F1]) {
  const f = new FormData();
  for (const id of ids) f.append("ids", id);
  for (const id of fichiers) f.append("fichierIds", id);
  f.set("subject", "Essai — {poste}");
  f.set("bodyMarkdown", "Bonjour {prenom}, voici les fichiers.");
  f.set("modele", "libre");
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  opposees.clear();
  ecrire.mockResolvedValue({ ecrit: true, enfile: true, replyId: "r" });
  preparer.mockImplementation(async (ids: string[]) => ({
    ok: true,
    lien: { lienId: randomUUID(), fichierIds: ids, categories: ["lut"], paragraphe: "p" },
  }));
});

describe("réponse groupée avec fichiers", () => {
  it("🔑 5 cochés dont 1 opposé → 4 envois, 4 liens distincts, l'opposé nommé", async () => {
    const lignes = [1, 2, 3, 4, 5].map((i) => dossier(i));
    opposees.add("p3@exemple.fr");
    findMany.mockResolvedValueOnce(lignes);
    const r = await repondreEnMasseAction(INITIAL, formulaire(lignes.map((l) => l.id)));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.envoyees).toBe(4);
    expect(ecrire).toHaveBeenCalledTimes(4);
    const liens = ecrire.mock.calls.map(
      (c) => (c[2] as { lienFichiers?: { lienId: string } }).lienFichiers?.lienId,
    );
    expect(new Set(liens).size).toBe(4);
    expect(liens.every(Boolean)).toBe(true);
    // Les MÊMES fichiers pour tous.
    for (const c of preparer.mock.calls) expect(c[0]).toEqual([F1]);
    expect(r.details).toEqual([
      expect.objectContaining({ id: lignes[2]!.id, motif: "opposee", nom: "Prenom3 N." }),
    ]);
  });

  it("« Non retenue » et « Retirée » sont exclues, avec leur motif", async () => {
    const lignes = [
      dossier(1),
      dossier(2, { status: "rejected" }),
      dossier(3, { status: "withdrawn" }),
    ];
    findMany.mockResolvedValueOnce(lignes);
    const r = await repondreEnMasseAction(
      INITIAL,
      formulaire(
        lignes.map((l) => l.id),
        [],
      ),
    );
    expect(r.ok && r.envoyees).toBe(1);
    expect(r.ok && r.details.map((d) => d.motif)).toEqual(["non_retenue", "retiree"]);
    expect(preparer).not.toHaveBeenCalled();
  });

  it("un fichier refusé arrête tout AVANT le premier envoi", async () => {
    findMany.mockResolvedValueOnce([dossier(1), dossier(2)]);
    preparer.mockResolvedValueOnce({ ok: false, erreur: "Un des fichiers choisis est archivé." });
    const r = await repondreEnMasseAction(INITIAL, formulaire([dossier(1).id, dossier(2).id]));
    expect(r).toEqual({ ok: false, error: "Un des fichiers choisis est archivé." });
    expect(ecrire).not.toHaveBeenCalled();
  });
});
