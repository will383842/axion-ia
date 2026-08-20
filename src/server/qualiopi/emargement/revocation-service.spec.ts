/**
 * `D3-3-04` — une signature apposée sur le mauvais nom était définitive.
 *
 * Le schéma prévoyait tout (`revokedAt`, `revokedById`, `revokedMotif`), les
 * huit lecteurs du registre filtraient déjà `revokedAt: null`, et **personne
 * n'écrivait jamais ces colonnes**. Troisième forme récurrente de cet audit :
 * l'outil est écrit, le câblage manque.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const findUnique = vi.fn();
/** Le compteur de SUCCESSEURS — hors transaction, il précède l'écriture. */
const countSuccesseurs = vi.fn();
const updateSignature = vi.fn();
const countSignatures = vi.fn();
const updateEnrollment = vi.fn();

vi.mock("@/lib/prisma", () => {
  const tx = {
    emargementSignature: {
      update: (...a: unknown[]) => updateSignature(...a),
      count: (...a: unknown[]) => countSignatures(...a),
    },
    enrollment: { update: (...a: unknown[]) => updateEnrollment(...a) },
  };
  return {
    prisma: {
      emargementSignature: {
        findUnique: (...a: unknown[]) => findUnique(...a),
        count: (...a: unknown[]) => countSuccesseurs(...a),
      },
      $transaction: (fn: (t: typeof tx) => Promise<void>) => fn(tx),
    },
  };
});

import { revoquerSignature, MOTIF_MIN } from "./revocation-service";

const MOTIF = "Signée par erreur sur la ligne du voisin.";
const ADMIN = "admin-1";

function signature(over: Record<string, unknown> = {}) {
  return { id: "sig-1", revokedAt: null, enrollmentId: "enr-1", selfHash: "h1", ...over };
}

describe("revoquerSignature", () => {
  beforeEach(() => {
    findUnique.mockReset();
    updateSignature.mockReset().mockResolvedValue({});
    // Par défaut : la signature est la DERNIÈRE de sa chaîne. C'est le cas
    // nominal — révoquer un maillon interne est refusé, cf. le bloc dédié.
    countSuccesseurs.mockReset().mockResolvedValue(0);
    countSignatures.mockReset().mockResolvedValue(1);
    updateEnrollment.mockReset().mockResolvedValue({});
  });

  // ── Le motif ───────────────────────────────────────────────────────────────

  it("🔴 refuse un motif trop court, SANS même lire la signature", async () => {
    const res = await revoquerSignature("sig-1", "erreur", ADMIN);
    expect(res.ok).toBe(false);
    expect(findUnique, "on ne lit rien tant que le motif ne tient pas").not.toHaveBeenCalled();
  });

  it("🔴 refuse un motif fait d'espaces", async () => {
    // 🔑 `trim()` avant mesure : sinon quinze espaces satisfont la longueur
    // minimale, et le registre porte une révocation sans raison.
    const res = await revoquerSignature("sig-1", " ".repeat(MOTIF_MIN + 5), ADMIN);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.raison).toBe("motif_insuffisant");
  });

  // ── Les refus qui protègent ────────────────────────────────────────────────

  it("signature introuvable → refus explicite", async () => {
    findUnique.mockResolvedValue(null);
    const res = await revoquerSignature("sig-x", MOTIF, ADMIN);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.raison).toBe("introuvable");
    expect(updateSignature).not.toHaveBeenCalled();
  });

  it("🔴 une signature DÉJÀ révoquée ne se re-révoque pas", async () => {
    // ⚠️ Re-révoquer écraserait le motif et la date d'origine — c'est-à-dire la
    // trace de qui a décidé, et quand. On refuse, et on le dit.
    findUnique.mockResolvedValue(signature({ revokedAt: new Date("2026-08-01") }));
    const res = await revoquerSignature("sig-1", MOTIF, ADMIN);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.raison).toBe("deja_revoquee");
    expect(updateSignature, "aucune écriture").not.toHaveBeenCalled();
  });

  // ── Le maillon terminal — DÉFAUT DE MON PROPRE CORRECTIF ──────────────────
  //
  // 🔴 Trouvé le 2026-08-20 par le cahier `D3-1`, APRÈS livraison. Sans cette
  // garde, révoquer un maillon intermédiaire FABRIQUE une preuve de
  // falsification sur une feuille intacte.

  it("🔴 révoquer un maillon NON TERMINAL est refusé", async () => {
    // Chaque signature scelle dans `prevHash` l'empreinte de la précédente, et
    // toutes les lectures filtrent `revokedAt: null`. Retirer un maillon du
    // milieu laisse le suivant pointer vers une empreinte devenue invisible :
    // `verifierChaine` conclut à une rupture, et le dossier remis au
    // certificateur déclare la feuille FALSIFIÉE.
    findUnique.mockResolvedValue(signature());
    countSuccesseurs.mockResolvedValue(1);

    const res = await revoquerSignature("sig-1", MOTIF, ADMIN);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.raison).toBe("maillon_interne");
    expect(updateSignature, "aucune écriture").not.toHaveBeenCalled();
  });

  it("le successeur est cherché par `prevHash` ← `selfHash`, sur la MÊME inscription", async () => {
    // 🔑 Non-vacuité du prédicat : chercher sans `prevHash` compterait toutes
    // les signatures vivantes de l'inscription et refuserait TOUTE révocation ;
    // chercher sans `enrollmentId` regarderait la chaîne d'un autre stagiaire.
    findUnique.mockResolvedValue(signature({ selfHash: "empreinte-3" }));
    await revoquerSignature("sig-1", MOTIF, ADMIN);
    expect(countSuccesseurs).toHaveBeenCalledWith({
      where: { enrollmentId: "enr-1", revokedAt: null, prevHash: "empreinte-3" },
    });
  });

  it("un successeur DÉJÀ RÉVOQUÉ ne bloque pas — la chaîne vivante s'arrête là", async () => {
    // ⚠️ Le compteur filtre `revokedAt: null` : révoquer en remontant depuis la
    // fin doit rester possible, sinon une correction de deux signatures
    // deviendrait impossible après la première.
    findUnique.mockResolvedValue(signature());
    countSuccesseurs.mockResolvedValue(0);
    const res = await revoquerSignature("sig-1", MOTIF, ADMIN);
    expect(res.ok).toBe(true);
  });

  // ── L'écriture ─────────────────────────────────────────────────────────────

  it("écrit les TROIS colonnes : date, auteur, motif", async () => {
    findUnique.mockResolvedValue(signature());
    await revoquerSignature("sig-1", `  ${MOTIF}  `, ADMIN);
    const args = updateSignature.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(args.data["revokedAt"]).toBeInstanceOf(Date);
    expect(args.data["revokedById"]).toBe(ADMIN);
    // Le motif est stocké NETTOYÉ, pas tel que saisi.
    expect(args.data["revokedMotif"]).toBe(MOTIF);
  });

  it("🔴 ne touche NI `selfHash` NI `prevHash` — la chaîne reste intacte", async () => {
    // 🔑 Effacer ou réécrire romprait le chaînage, et une chaîne rompue ne
    // prouve plus rien — pas même les signatures valides qui la suivent. La
    // révocation dit qu'une signature ne fait plus foi ; elle ne réécrit pas
    // l'histoire de ce qui a été signé ce jour-là.
    findUnique.mockResolvedValue(signature());
    await revoquerSignature("sig-1", MOTIF, ADMIN);
    const args = updateSignature.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(Object.keys(args.data)).toEqual(["revokedAt", "revokedById", "revokedMotif"]);
  });

  // ── La conséquence de conformité — le cœur du constat ──────────────────────

  it("🔴 plus AUCUNE signature vivante → `emargementSigneAt` retombe", async () => {
    // Sans cet effet, `conformite-service.ts` continuerait de compter
    // l'inscription comme « émargement réellement signé » (ind. `off.12`), et le
    // certificat de réalisation resterait émettable sur une preuve retirée.
    findUnique.mockResolvedValue(signature());
    countSignatures.mockResolvedValue(0);
    const res = await revoquerSignature("sig-1", MOTIF, ADMIN);
    expect(res.ok && res.emargementRetombe).toBe(true);
    expect(updateEnrollment).toHaveBeenCalledWith({
      where: { id: "enr-1" },
      data: { emargementSigneAt: null },
    });
  });

  it("🔴 une AUTRE signature subsiste → `emargementSigneAt` est CONSERVÉ", async () => {
    // 🔑 Le témoin discriminant, et le piège symétrique : retirer l'émargement
    // dès la première révocation effacerait une preuve qui existe encore. Une
    // session de deux jours dont on corrige le premier jour resterait
    // « non émargée » alors que le second jour est signé.
    findUnique.mockResolvedValue(signature());
    countSignatures.mockResolvedValue(1);
    const res = await revoquerSignature("sig-1", MOTIF, ADMIN);
    expect(res.ok && res.emargementRetombe).toBe(false);
    expect(updateEnrollment).not.toHaveBeenCalled();
  });

  it("le décompte des restantes exclut les révoquées", async () => {
    // Non-vacuité du prédicat : compter TOUTES les signatures rendrait le test
    // précédent vert en permanence, et l'émargement ne retomberait jamais.
    findUnique.mockResolvedValue(signature());
    await revoquerSignature("sig-1", MOTIF, ADMIN);
    expect(countSignatures).toHaveBeenCalledWith({
      where: { enrollmentId: "enr-1", revokedAt: null },
    });
  });

  it("une signature sans inscription rattachée ne cherche aucun émargement", async () => {
    // Cas réel : les signatures de coaching n'ont pas d'`enrollmentId`.
    findUnique.mockResolvedValue(signature({ enrollmentId: null }));
    const res = await revoquerSignature("sig-1", MOTIF, ADMIN);
    expect(res.ok).toBe(true);
    expect(countSignatures).not.toHaveBeenCalled();
    expect(updateEnrollment).not.toHaveBeenCalled();
  });
});
