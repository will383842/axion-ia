// M1 (lot A) — l'écran de validation : les actions appelées par les boutons.
//   · un texte (gabarit ou variante) se valide ou se dévalide, super-admin seul ;
//   · « valider tous les textes formateurs d'un coup » exige une confirmation explicite
//     ET le nombre de textes affichés (la liste n'a pas changé entre l'écran et le clic) ;
//   · jamais de `targetId` dans `activity_logs` (la clé va dans `changes`).
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn();
vi.mock("@/auth", () => ({ auth: () => auth() }));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "203.0.113.7" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { tx } = vi.hoisted(() => ({
  tx: {
    setting: {
      findUnique: vi.fn(async () => null as unknown),
      findMany: vi.fn(async () => [] as Array<{ key: string; value: unknown }>),
      upsert: vi.fn(async () => ({})),
    },
    activityLog: { create: vi.fn(async () => ({})) },
  },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)) },
}));

import {
  validerTexteEmailFormAction,
  validerTousTextesFormateursAction,
} from "../textes-valides-actions";
import {
  cleDuTexte,
  empreinteDuTexte,
  listeDesTextesAffichee,
  TEXTES_FORMATEURS_A_VALIDER,
} from "../textes-formateurs-a-valider";
import { cleTexteValide } from "../textes-valides";

const INITIAL = { ok: true as const, message: "" };
const connecte = (role: string) => auth.mockResolvedValue({ user: { id: "u-1", role } });
const form = (champs: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(champs)) f.set(k, v);
  return f;
};
const logs = () =>
  (tx.activityLog.create.mock.calls as unknown as Array<[{ data: Record<string, unknown> }]>).map(
    (c) => c[0].data,
  );

beforeEach(() => vi.clearAllMocks());

describe("validerTexteEmailFormAction (un texte)", () => {
  it("valide une VARIANTE : écrit sa propre clé, journal sans targetId", async () => {
    connecte("super_admin");
    const r = await validerTexteEmailFormAction(
      INITIAL,
      form({
        gabarit: "formateur-mission-retiree",
        variante: "lettre-non-signee",
        valide: "1",
        empreinte: empreinteDuTexte({
          gabarit: "formateur-mission-retiree",
          variante: "lettre-non-signee",
        }),
      }),
    );
    expect(r.ok).toBe(true);
    const cle = cleTexteValide("formateur-mission-retiree", "lettre-non-signee");
    expect(tx.setting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: cle } }),
    );
    expect(logs()[0]).not.toHaveProperty("targetId");
  });

  it("retire une validation (valide=0)", async () => {
    connecte("super_admin");
    tx.setting.findUnique.mockResolvedValueOnce({ value: { valide: true } });
    const r = await validerTexteEmailFormAction(
      INITIAL,
      form({ gabarit: "formateur-dossier-lien", valide: "0" }),
    );
    expect(r).toEqual({ ok: true, message: "Validation retirée." });
    expect(tx.setting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { value: { valide: false }, updatedBy: "u-1" } }),
    );
    expect(logs()[0]?.action).toBe("email.texte_invalide");
  });

  it("refuse un texte qui ne se valide pas ici (autre public, texte de base de F23)", async () => {
    connecte("super_admin");
    for (const champs of [
      { gabarit: "lead-apporteur-recu", valide: "1" },
      { gabarit: "formateur-mission-proposee", valide: "1" },
    ]) {
      const r = await validerTexteEmailFormAction(INITIAL, form(champs));
      expect(r.ok).toBe(false);
    }
    expect(tx.setting.upsert).not.toHaveBeenCalled();
  });

  it("sans session : refusé, rien n'est lu ni écrit", async () => {
    auth.mockResolvedValue(null);
    const r = await validerTexteEmailFormAction(
      INITIAL,
      form({ gabarit: "formateur-dossier-lien", valide: "1" }),
    );
    expect(r).toEqual({ ok: false, error: "Session expirée." });
    expect(tx.setting.findUnique).not.toHaveBeenCalled();
    expect(tx.setting.upsert).not.toHaveBeenCalled();
  });

  it("un administrateur qui n'est pas super-admin est refusé", async () => {
    connecte("admin");
    const r = await validerTexteEmailFormAction(
      INITIAL,
      form({ gabarit: "formateur-dossier-lien", valide: "1" }),
    );
    expect(r.ok).toBe(false);
    expect(tx.setting.upsert).not.toHaveBeenCalled();
  });
});

describe("validerTousTextesFormateursAction (d'un coup)", () => {
  const N = String(TEXTES_FORMATEURS_A_VALIDER.length);
  const L = listeDesTextesAffichee();

  it("sans la case de confirmation : rien n'est écrit", async () => {
    connecte("super_admin");
    const r = await validerTousTextesFormateursAction(INITIAL, form({ nombre: N }));
    expect(r.ok).toBe(false);
    expect(tx.setting.upsert).not.toHaveBeenCalled();
    expect(tx.activityLog.create).not.toHaveBeenCalled();
  });

  it("un nombre qui ne correspond plus à la liste : rien n'est écrit", async () => {
    connecte("super_admin");
    const r = await validerTousTextesFormateursAction(
      INITIAL,
      form({ confirme: "oui", nombre: "3" }),
    );
    expect(r.ok).toBe(false);
    expect(tx.setting.upsert).not.toHaveBeenCalled();
  });

  it("même nombre, mais un texte remplacé par un autre : rien n'est écrit", async () => {
    connecte("super_admin");
    const cles = TEXTES_FORMATEURS_A_VALIDER.map(cleDuTexte);
    const vue = [...cles.slice(0, -1), "textes_valides.formateur-texte-disparu"].join("\n");
    const r = await validerTousTextesFormateursAction(
      INITIAL,
      form({ confirme: "oui", nombre: N, liste: vue }),
    );
    expect(r.ok).toBe(false);
    expect(tx.setting.upsert).not.toHaveBeenCalled();
    expect(tx.activityLog.create).not.toHaveBeenCalled();
  });

  /**
   * Bug du 17/10 — le navigateur envoie un formulaire en multipart, et la sérialisation
   * multipart change chaque `\n` d'une valeur en `\r\n` (spécification HTML, appliquée
   * par Chromium comme par Node). Le champ caché `liste` arrivait donc TOUJOURS différent
   * de la liste du serveur : le bouton refusait même sur une page fraîche. On applique ici
   * cette règle à la main : passer par `new Response(f)` dépend de l'environnement de test.
   */
  const commeLeNavigateur = async (f: FormData) => {
    const envoye = new FormData();
    for (const [k, v] of f.entries()) {
      envoye.set(k, typeof v === "string" ? v.replace(/\r?\n/g, "\r\n") : v);
    }
    return envoye;
  };

  it("la liste réellement affichée, envoyée comme le navigateur l'envoie : acceptée", async () => {
    connecte("super_admin");
    const envoye = await commeLeNavigateur(form({ confirme: "oui", nombre: N, liste: L }));
    expect(envoye.get("liste")).toContain("\r\n");
    const r = await validerTousTextesFormateursAction(INITIAL, envoye);
    expect(r).toEqual({ ok: true, message: `${N} textes validés.` });
    expect(tx.setting.upsert).toHaveBeenCalledTimes(TEXTES_FORMATEURS_A_VALIDER.length);
  });

  it("envoyée comme le navigateur, mais un texte a changé depuis l'affichage : refusé", async () => {
    connecte("super_admin");
    const lignes = L.split("\n");
    lignes[0] = `${cleDuTexte(TEXTES_FORMATEURS_A_VALIDER[0]!)}=${"0".repeat(64)}`;
    const envoye = await commeLeNavigateur(
      form({ confirme: "oui", nombre: N, liste: lignes.join("\n") }),
    );
    const r = await validerTousTextesFormateursAction(INITIAL, envoye);
    expect(r.ok).toBe(false);
    expect(tx.setting.upsert).not.toHaveBeenCalled();
    expect(tx.activityLog.create).not.toHaveBeenCalled();
  });

  it("sans session : refusé, rien n'est lu ni écrit", async () => {
    auth.mockResolvedValue(null);
    const r = await validerTousTextesFormateursAction(
      INITIAL,
      form({ confirme: "oui", nombre: N, liste: L }),
    );
    expect(r).toEqual({ ok: false, error: "Session expirée." });
    expect(tx.setting.findMany).not.toHaveBeenCalled();
    expect(tx.setting.upsert).not.toHaveBeenCalled();
  });

  it("un administrateur qui n'est pas super-admin est refusé", async () => {
    connecte("admin");
    const r = await validerTousTextesFormateursAction(
      INITIAL,
      form({ confirme: "oui", nombre: N, liste: L }),
    );
    expect(r.ok).toBe(false);
    expect(tx.setting.upsert).not.toHaveBeenCalled();
  });

  it("confirmé : chaque texte non encore validé est écrit, UNE ligne de journal sans targetId", async () => {
    connecte("super_admin");
    const dejaValide = cleDuTexte(TEXTES_FORMATEURS_A_VALIDER[0]!);
    // Lot 8A — « déjà validé » = validé avec l'empreinte du texte actuel.
    tx.setting.findMany.mockResolvedValueOnce([
      {
        key: dejaValide,
        value: { valide: true, empreinte: empreinteDuTexte(TEXTES_FORMATEURS_A_VALIDER[0]!) },
      },
    ]);
    const r = await validerTousTextesFormateursAction(
      INITIAL,
      form({ confirme: "oui", nombre: N, liste: L }),
    );
    expect(r.ok).toBe(true);
    const ecrites = (
      tx.setting.upsert.mock.calls as unknown as Array<[{ where: { key: string } }]>
    ).map((c) => c[0].where.key);
    expect(ecrites).toHaveLength(TEXTES_FORMATEURS_A_VALIDER.length - 1);
    expect(ecrites).not.toContain(dejaValide);
    expect(ecrites).toContain(cleTexteValide("formateur-mission-proposee", "honoraires"));
    expect(logs()).toHaveLength(1);
    expect(logs()[0]).not.toHaveProperty("targetId");
    expect(logs()[0]?.action).toBe("email.textes_formateurs_valides");
    expect(logs()[0]?.changes).toMatchObject({ nombre: TEXTES_FORMATEURS_A_VALIDER.length - 1 });
  });
});
