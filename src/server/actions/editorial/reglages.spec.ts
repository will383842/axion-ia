/**
 * Console éditoriale — tests des réglages (§8).
 *
 * ## Ce que cet écran promettait sans le tenir
 *
 * 🔴 Trois commentaires du code affirmaient qu'« un seuil se corrige depuis la
 * console sans pull request ». Les règles vivaient bien en base — mais aucun
 * écran ne les modifiait. La passe 5 du protocole l'a relevé.
 *
 * ## Ce que ces tests verrouillent
 *
 * Un écran de réglages est une surface d'écriture **sur les gardes
 * elles-mêmes**. C'est le seul endroit de la console où une faute de frappe
 * peut désarmer un contrôle réglementaire ou geler le serveur. Les tests
 * ci-dessous portent donc moins sur « ça enregistre » que sur « ça refuse ».
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockConformiteFindUnique,
  mockConformiteUpdate,
  mockAlerteFindUnique,
  mockAlerteUpdate,
  mockRequirePermission,
  mockJournaliser,
} = vi.hoisted(() => ({
  mockConformiteFindUnique: vi.fn(),
  mockConformiteUpdate: vi.fn(),
  mockAlerteFindUnique: vi.fn(),
  mockAlerteUpdate: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockJournaliser: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    edRegleConformite: { findUnique: mockConformiteFindUnique, update: mockConformiteUpdate },
    edRegleAlerte: { findUnique: mockAlerteFindUnique, update: mockAlerteUpdate },
  },
}));

vi.mock("@/server/actions/editorial/_guards", () => ({
  requirePermission: mockRequirePermission,
  journaliser: mockJournaliser,
  requireMembreEditorial: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const { modifierRegleConformiteAction, modifierRegleAlerteAction } = await import("./reglages");

const ADMIN = { userId: "u1", membreId: "m1", role: "admin" as const, nom: "Will" };
const ID = "eeeeeeee-0000-4000-8000-000000000001";

/** Une modification plausible, à patcher au cas par cas. */
function patch(sur: Record<string, unknown> = {}) {
  return {
    id: ID,
    actif: true,
    gravite: "bloquant" as const,
    message: "Règle « geo » — mention géographique interdite : {extrait}",
    motifRegex: "(?:grenoble|isère)",
    parametres: { champs: ["corps"] },
    ...sur,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequirePermission.mockResolvedValue(ADMIN);
  mockJournaliser.mockResolvedValue(undefined);
  mockConformiteFindUnique.mockResolvedValue({
    code: "geo",
    actif: true,
    gravite: "bloquant",
    motifRegex: "(?:grenoble)",
    parametres: null,
  });
  mockConformiteUpdate.mockResolvedValue({ id: ID });
  mockAlerteFindUnique.mockResolvedValue({
    code: "canal-muet",
    actif: true,
    gravite: "avertissement",
  });
  mockAlerteUpdate.mockResolvedValue({ id: ID });
});

describe("modifierRegleConformiteAction — écrire sur les gardes elles-mêmes", () => {
  it("exige `reglages.gerer`, que seul l'admin possède", async () => {
    await modifierRegleConformiteAction(patch());
    expect(mockRequirePermission).toHaveBeenCalledWith("reglages.gerer");
  });

  it("🔴 REFUSE un motif à quantificateurs imbriqués, AVANT de l'écrire", async () => {
    // La même garde que l'évaluateur, appliquée à l'écriture. Refuser ici
    // plutôt qu'au moment où le motif gèlera la console : l'auteur est encore
    // devant son écran, il sait ce qu'il vient de taper. Découvrir la panne
    // trois jours plus tard sur une validation qui n'aboutit pas coûte
    // infiniment plus cher.
    const r = await modifierRegleConformiteAction(patch({ motifRegex: "(a+)+$" }));

    expect("error" in r).toBe(true);
    if ("error" in r) expect(r.error).toMatch(/quantificateur/i);
    expect(mockConformiteUpdate).not.toHaveBeenCalled();
  });

  it("🔴 REFUSE un motif illisible plutôt que de le laisser rendre « non évaluée »", async () => {
    // La base l'accepterait sans broncher, et l'évaluateur rendrait
    // « non évaluée » pour toujours — une règle muette qui a l'air posée.
    const r = await modifierRegleConformiteAction(patch({ motifRegex: "(?<non-ferme" }));

    expect("error" in r).toBe(true);
    if ("error" in r) expect(r.error).toMatch(/illisible/i);
    expect(mockConformiteUpdate).not.toHaveBeenCalled();
  });

  it("REFUSE un message vide — c'est ce que l'utilisateur lira", async () => {
    const r = await modifierRegleConformiteAction(patch({ message: "   " }));
    expect("error" in r).toBe(true);
    expect(mockConformiteUpdate).not.toHaveBeenCalled();
  });

  it("REFUSE une gravité inventée", async () => {
    const r = await modifierRegleConformiteAction(patch({ gravite: "catastrophique" as never }));
    expect("error" in r).toBe(true);
    expect(mockConformiteUpdate).not.toHaveBeenCalled();
  });

  it("REFUSE une règle introuvable, sans rien écrire", async () => {
    mockConformiteFindUnique.mockResolvedValue(null);
    const r = await modifierRegleConformiteAction(patch());
    expect("error" in r).toBe(true);
    expect(mockConformiteUpdate).not.toHaveBeenCalled();
  });

  it("enregistre une modification saine, et la JOURNALISE", async () => {
    // Modifier une garde est le geste le plus sensible de la console : il doit
    // laisser une trace avec son auteur.
    const r = await modifierRegleConformiteAction(patch({ gravite: "avertissement" }));

    expect("error" in r).toBe(false);
    expect(mockConformiteUpdate.mock.calls[0]![0].data.gravite).toBe("avertissement");
    expect(mockJournaliser).toHaveBeenCalledTimes(1);
    const trace = mockJournaliser.mock.calls[0]![0];
    expect(trace.entite).toBe("EdRegleConformite");
    // L'avant ET l'après : « qui a désactivé geo, et quand » doit se lire.
    expect(trace.avant).toMatchObject({ code: "geo" });
    expect(trace.apres).toMatchObject({ gravite: "avertissement" });
  });

  it("🔴 permet de DÉSACTIVER une règle — et le journal l'enregistre", async () => {
    // Désactiver n'est pas corriger, mais c'est parfois le bon geste un
    // dimanche soir. Ce qui compte, c'est que ça se voie ensuite.
    await modifierRegleConformiteAction(patch({ actif: false }));

    expect(mockConformiteUpdate.mock.calls[0]![0].data.actif).toBe(false);
    expect(mockJournaliser.mock.calls[0]![0].apres).toMatchObject({ actif: false });
  });

  it("accepte des paramètres nuls — toutes les règles n'en ont pas", async () => {
    const r = await modifierRegleConformiteAction(patch({ parametres: null }));
    expect("error" in r).toBe(false);
    expect(mockConformiteUpdate.mock.calls[0]![0].data.parametres).toBeNull();
  });
});

describe("modifierRegleAlerteAction — une alerte sans seuil ne sonne jamais", () => {
  it("🔴 REFUSE des paramètres nuls", async () => {
    // `EdRegleAlerte.parametres` est NON nullable en base. Écrire `{}` ou
    // `null` désarmerait l'alerte en silence — et le silence d'une alerte
    // ressemble exactement à « tout va bien ».
    const r = await modifierRegleAlerteAction({
      id: ID,
      actif: true,
      gravite: "avertissement",
      parametres: null,
    });

    expect("error" in r).toBe(true);
    if ("error" in r) expect(r.error).toMatch(/seuil/i);
    expect(mockAlerteUpdate).not.toHaveBeenCalled();
  });

  it("exige `reglages.gerer`", async () => {
    await modifierRegleAlerteAction({
      id: ID,
      actif: true,
      gravite: "avertissement",
      parametres: { jours: 3 },
    });
    expect(mockRequirePermission).toHaveBeenCalledWith("reglages.gerer");
  });

  it("enregistre un seuil et le journalise", async () => {
    const r = await modifierRegleAlerteAction({
      id: ID,
      actif: true,
      gravite: "bloquant",
      parametres: { jours: 5 },
    });

    expect("error" in r).toBe(false);
    expect(mockAlerteUpdate.mock.calls[0]![0].data.parametres).toEqual({ jours: 5 });
    expect(mockJournaliser).toHaveBeenCalledTimes(1);
  });

  it("remonte le refus de permission en citant le rôle", async () => {
    mockRequirePermission.mockRejectedValue(
      new Error("Action « reglages.gerer » refusée : le rôle « stratege » ne l'a pas."),
    );

    const r = await modifierRegleAlerteAction({
      id: ID,
      actif: false,
      gravite: "info",
      parametres: { jours: 1 },
    });

    expect("error" in r).toBe(true);
    if ("error" in r) expect(r.error).toContain("stratege");
    expect(mockAlerteUpdate).not.toHaveBeenCalled();
  });
});
