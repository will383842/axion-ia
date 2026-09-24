/**
 * DÉPOSER UN CV À LA MAIN — CE QUE LE GESTE NE DOIT JAMAIS FAIRE.
 *
 * ── Pourquoi ce fichier ──────────────────────────────────────────────────
 * La console savait TÉLÉCHARGER un CV mais pas en DÉPOSER un : les treize
 * candidatures importées hors formulaire le 2026-09-23, dont huit annoncent
 * un CV, restaient des fiches sans dossier. `televerserCvAction` comble ce
 * vide — et en le comblant, ouvre une écriture sur une pièce de candidat.
 *
 * ⚠️ CE QUE CE FICHIER EXISTE POUR EMPÊCHER, dans l'ordre de gravité :
 *
 *  1. **L'ÉCRASEMENT.** Un dossier qui porte déjà un CV ne doit pas pouvoir
 *     en recevoir un second. Le CV déposé par le candidat lui-même est une
 *     pièce qu'aucune sauvegarde de la console ne reconstituerait, et rien à
 *     l'écran ne dirait qu'elle a disparu. Le refus doit intervenir AVANT
 *     `storeCv`, pas après : un fichier écrit puis « annulé » a déjà remplacé
 *     le précédent sur le disque.
 *
 *  2. **LE PLAFOND QUI NE PLAFONNE RIEN.** Refuser un fichier trop lourd
 *     APRÈS l'avoir lu en mémoire ne protège de rien — c'est précisément la
 *     lecture qu'on voulait éviter. Le test ci-dessous donne un fichier dont
 *     `arrayBuffer()` EXPLOSE : si la garde est déplacée après la lecture, il
 *     rougit. Une assertion sur le message seul ne l'aurait pas vu.
 *
 *  3. **LA GARDE DE RÔLE CONTOURNÉE.** `requireAdminWrite` lève ; l'action
 *     doit rendre un refus et ne rien écrire, ni sur le disque ni en base.
 *
 *  4. **LE DÉPÔT MUET.** Une pièce ajoutée sans trace au journal est une
 *     pièce dont on ignore qui l'a posée et quand.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const findUniqueMock = vi.fn();
const updateMock = vi.fn();
const storeCvMock = vi.fn();
const consignerMock = vi.fn();
const requireAdminWriteMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobApplication: {
      findUnique: (...a: unknown[]) => findUniqueMock(...a),
      update: (...a: unknown[]) => updateMock(...a),
    },
  },
}));
// 🔑 `importOriginal` : extensions, MIME et plafond viennent du VRAI module.
// Les figer ici ferait passer le test le jour où le module change d'avis, ce
// qui est exactement l'écart que l'action cherche à rendre impossible.
vi.mock("@/server/careers/cv-storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/careers/cv-storage")>()),
  storeCv: (...a: unknown[]) => storeCvMock(...a),
}));
vi.mock("../journal", () => ({ consignerEvenement: (...a: unknown[]) => consignerMock(...a) }));
vi.mock("../session", () => ({ requireAdminWrite: () => requireAdminWriteMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { televerserCvAction } from "../televerser-cv";
import { CV_MAX_BYTES } from "@/server/careers/cv-storage";

/**
 * Un VRAI `File`, dont on ment sur la taille sans allouer les octets.
 *
 * ⚠️ DEUX PIÈGES, tous deux mesurés ici, tous deux silencieux.
 *
 * 1. Un objet qui RESSEMBLE à un `File` ne suffit pas : `FormData.set()` ne
 *    l'accepte pas comme pièce jointe et le convertit en chaîne
 *    « [object File] ». L'action rendait alors « Aucun fichier sélectionné »,
 *    et deux des tests ci-dessous passaient au vert pour CETTE raison, pas
 *    pour la bonne. Ils n'éprouvaient plus rien.
 *
 * 2. Le `File` de l'environnement de test **n'a pas de `arrayBuffer`** — ni
 *    après `FormData`, ni avant : sondé, `typeof f.arrayBuffer === "undefined"`
 *    dès la construction. On la fournit donc ici. C'est un manque du bac à
 *    sable, pas de la production, où le `File` d'undici étend `Blob` et la
 *    porte. Corollaire honnête : ce fichier éprouve les GARDES de l'action,
 *    pas la lecture réelle des octets.
 *
 * `defineProperty` survit au passage par `FormData` (vérifié : une taille
 * décorée à 1000 ressort à 1000), ce qui permet de mentir sur le poids sans
 * allouer huit mégaoctets.
 */
function fichier(nom: string, taille: number, type: string, octets?: () => Promise<ArrayBuffer>) {
  const f = new File([new Uint8Array(8)], nom, { type });
  Object.defineProperty(f, "size", { value: taille });
  Object.defineProperty(f, "arrayBuffer", {
    value: octets ?? (async () => new ArrayBuffer(8)),
  });
  return f;
}

function formulaire(f: File, id = "abc") {
  const fd = new FormData();
  fd.set("applicationId", id);
  fd.set("cv", f);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminWriteMock.mockResolvedValue({ userId: "u1", role: "admin", nom: "Will" });
  findUniqueMock.mockResolvedValue({ id: "abc", cvStoragePath: null });
  storeCvMock.mockResolvedValue("2026/09/abc.pdf");
  updateMock.mockResolvedValue({});
  consignerMock.mockResolvedValue({});
});

describe("déposer un CV sur une candidature", () => {
  it("attache la pièce, met la fiche à jour ET consigne « piece_recue »", async () => {
    const res = await televerserCvAction(
      null,
      formulaire(fichier("cv.pdf", 1000, "application/pdf")),
    );

    expect(res.ok).toBe(true);
    expect(storeCvMock).toHaveBeenCalledTimes(1);
    const donnees = (updateMock.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(donnees.cvStoragePath).toBe("2026/09/abc.pdf");
    expect(donnees.cvOriginalName).toBe("cv.pdf");

    const evenement = consignerMock.mock.calls[0]?.[0] as { type: string; authorId: string };
    expect(evenement.type).toBe("piece_recue");
    expect(evenement.authorId).toBe("u1");
  });

  it("🔴 REFUSE d'écraser un CV existant — rien n'est écrit sur le disque", async () => {
    findUniqueMock.mockResolvedValue({ id: "abc", cvStoragePath: "2026/07/deja.pdf" });

    const res = await televerserCvAction(
      null,
      formulaire(fichier("autre.pdf", 1000, "application/pdf")),
    );

    expect(res.ok).toBe(false);
    expect(storeCvMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("🔴 refuse un fichier trop lourd SANS en lire un seul octet", async () => {
    const explose = fichier("enorme.pdf", CV_MAX_BYTES + 1, "application/pdf", async () => {
      throw new Error("arrayBuffer() ne doit jamais être appelé sur un fichier refusé");
    });

    // Si la garde de taille passe après la lecture, l'action attrape l'erreur
    // et rend « L'enregistrement a échoué » : le message discrimine.
    const res = await televerserCvAction(null, formulaire(explose));

    expect(res.ok).toBe(false);
    expect(res.message).toContain("trop lourd");
    expect(storeCvMock).not.toHaveBeenCalled();
  });

  it("refuse une extension hors liste, et le message nomme les formats admis", async () => {
    const res = await televerserCvAction(null, formulaire(fichier("cv.exe", 100, "")));

    expect(res.ok).toBe(false);
    expect(res.message).toContain(".pdf");
    expect(storeCvMock).not.toHaveBeenCalled();
  });

  it("🔴 un rôle sans droit d'écriture ne dépose rien", async () => {
    requireAdminWriteMock.mockRejectedValue(new Error("forbidden"));

    const res = await televerserCvAction(
      null,
      formulaire(fichier("cv.pdf", 100, "application/pdf")),
    );

    expect(res.ok).toBe(false);
    expect(findUniqueMock).not.toHaveBeenCalled();
    expect(storeCvMock).not.toHaveBeenCalled();
  });

  it("un échec d'enregistrement ne se déguise PAS en refus de droit", async () => {
    storeCvMock.mockRejectedValue(new Error("disque plein"));

    const res = await televerserCvAction(
      null,
      formulaire(fichier("cv.pdf", 100, "application/pdf")),
    );

    expect(res.ok).toBe(false);
    expect(res.message).toContain("échoué");
    expect(updateMock).not.toHaveBeenCalled();
  });
});
