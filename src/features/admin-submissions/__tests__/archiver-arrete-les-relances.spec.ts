/**
 * Archiver CLÔT, marquer traité RANGE — et les relances le savent (2026-09-21).
 *
 * ── Le défaut, et il est invisible depuis la console ──────────────────────
 * « Archiver » posait `status: archived` + `needsAttention: false` et rien
 * d'autre. Les relances « ton dossier t'attend » sont des jobs BullMQ RETARDÉS,
 * posés à J+2 et J+7, qui dorment dans Redis : rien ne les réveillait pour les
 * retirer. Une personne archivée continuait donc d'être relancée pendant une
 * semaine. Ça ne se voit sur aucun écran d'admin — ça se voit dans sa boîte.
 *
 * ── Pourquoi CE test, et pas un test de l'écran ───────────────────────────
 * 🔑 Une garde qui vérifierait « le bouton appelle bien l'action » repasserait
 * au vert le jour où l'action cesse d'annuler quoi que ce soit. Ce qu'il faut
 * prouver, c'est le RETRAIT lui-même, et surtout son ASYMÉTRIE : deux
 * transitions l'exigent, deux autres l'interdisent. Sans les quatre, une
 * implémentation qui annulerait TOUT LE TEMPS passerait — et « marquer traité »
 * couperait alors des relances légitimes.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const update = vi.fn();
const findUnique = vi.fn();
const logCreate = vi.fn();
const annuler = vi.fn();

vi.mock("@/lib/prisma", () => {
  const tx = {
    submission: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      update: (...a: unknown[]) => update(...a),
    },
    activityLog: { create: (...a: unknown[]) => logCreate(...a) },
  };
  return {
    prisma: {
      ...tx,
      $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    },
  };
});
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string | null) => v }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/lib/admin-path", () => ({ adminPath: (_l: string, p: string) => `/fr/adm/${p}` }));
vi.mock("@/features/admin-inbox/cache-tags", () => ({ INBOX_COUNTS_TAG: "tag" }));
vi.mock("@/features/commercial-application/relances-lead-apporteur", () => ({
  annulerRelancesLeadApporteur: (...a: unknown[]) => annuler(...a),
}));

import { appliquerTransition } from "../transitions";

beforeEach(() => {
  vi.clearAllMocks();
  findUnique.mockResolvedValue({
    id: "sub-1",
    contactEmail: "lea@exemple.invalid",
    deletedAt: null,
    // Un DOSSIER APPORTEUR : c'est la seule population dont les relances se
    // retirent. Une fiche ordinaire n'en a pas.
    details: { unifiedType: "recrutement", subType: "candidature-commerciale" },
  });
  update.mockResolvedValue({});
  annuler.mockResolvedValue(2);
});

describe("archiver et sans suite arrêtent les relances", () => {
  it("archiver retire les relances en attente, et le dit", async () => {
    const res = await appliquerTransition("sub-1", "archiver", "admin-1");

    expect(res.ok).toBe(true);
    expect(annuler).toHaveBeenCalledTimes(1);
    expect(annuler.mock.calls[0]?.[0]).toBe("lea@exemple.invalid");
    // Le compte remonte : « 0 » est une réponse, pas un échec, et l'écran doit
    // pouvoir dire « 2 relances retirées ».
    expect(res.relancesRetirees).toBe(2);
  });

  it("sans suite les retire aussi, avec son propre motif au journal des envois", async () => {
    const res = await appliquerTransition("sub-1", "sans-suite", "admin-1");

    expect(res.ok).toBe(true);
    expect(annuler).toHaveBeenCalledTimes(1);
    const motif = String(annuler.mock.calls[0]?.[1] ?? "");
    expect(motif).toContain("sans suite");
    // Le motif ne doit PAS dire « archivée » : c'est le même effet, ce n'est
    // pas la même décision, et ce texte finit sous les yeux d'un auditeur.
    expect(motif).not.toContain("archivée");
  });
});

describe("les transitions qui NE doivent PAS toucher aux relances", () => {
  // 🔴 CE BLOC EST LE TÉMOIN, et c'est lui qui rend le précédent probant.
  // Une implémentation qui annulerait à chaque transition passerait le premier
  // bloc en entier. Ici elle rougit.
  it("marquer traité RANGE sans clore : les relances restent", async () => {
    await appliquerTransition("sub-1", "traite", "admin-1");
    expect(annuler).not.toHaveBeenCalled();
  });

  it("désarchiver ne ressuscite RIEN : une relance retirée reste retirée", async () => {
    await appliquerTransition("sub-1", "desarchiver", "admin-1");
    expect(annuler).not.toHaveBeenCalled();
    // Et rien ne repose de job : faire repartir un « ton dossier t'attend »
    // trois semaines après coup serait pire que le silence.
    expect(update.mock.calls[0]?.[0]).toMatchObject({ data: { archivedAt: null } });
  });
});

describe("🔴 rouvrir DÉFAIT ce que fermer a posé", () => {
  // Le défaut que ce bloc répare : « Remettre à traiter » écrivait
  // `status: in_progress` + `needsAttention: true`, et laissait `archivedAt`
  // NON NUL. Or la liste par défaut filtre sur `archivedAt: null`.
  //
  // 🔑 L'écran répondait donc « La fiche est à traiter » sur une fiche qui
  // restait invisible — dans un état (`in_progress` + archivée) qu'aucun autre
  // chemin ne produit. Un bouton qui annonce un succès sans rien changer se
  // reclique, indéfiniment.
  //
  // C'était aussi la SEULE des transitions qu'aucun test ne couvrait.
  it("remet la fiche dans la liste : `archivedAt` redevient nul", async () => {
    await appliquerTransition("sub-1", "remettre", "admin-1");

    const ecrit = update.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(ecrit.data["archivedAt"]).toBeNull();
    expect(ecrit.data["status"]).toBe("in_progress");
    expect(ecrit.data["needsAttention"]).toBe(true);
  });

  it("🔴 DÉSARCHIVER la retire AUSSI — le défaut jumeau, sur le chemin le plus visible", async () => {
    // Une fiche classée sans suite est AUSSI archivée : la ligne lui propose
    // donc « Désarchiver » en bouton PRINCIPAL, qui ne regarde que `archived`.
    // Corriger « remettre » seul laissait le défaut entier derrière ce
    // bouton-là — celui qu'on clique en premier.
    //
    // 🔑 La règle générale : TOUTE transition qui rouvre défait ce que la
    // fermeture a posé. Il y en a deux, pas une.
    findUnique.mockResolvedValue({
      id: "sub-1",
      contactEmail: "lea@exemple.invalid",
      deletedAt: null,
      details: { sansSuiteAt: "2026-09-10T08:00:00.000Z", unifiedType: "audit" },
    });

    await appliquerTransition("sub-1", "desarchiver", "admin-1");

    const ecrit = update.mock.calls[0]?.[0] as {
      data: { details: Record<string, unknown>; archivedAt: unknown };
    };
    expect(ecrit.data.details["sansSuiteAt"]).toBeUndefined();
    expect(ecrit.data.archivedAt).toBeNull();
  });

  it("retire la marque « sans suite », sinon la pastille ment encore", async () => {
    findUnique.mockResolvedValue({
      id: "sub-1",
      contactEmail: "lea@exemple.invalid",
      deletedAt: null,
      details: { sansSuiteAt: "2026-09-10T08:00:00.000Z", origine: "saisie-manuelle" },
    });

    await appliquerTransition("sub-1", "remettre", "admin-1");

    const ecrit = update.mock.calls[0]?.[0] as { data: { details: Record<string, unknown> } };
    expect(ecrit.data.details["sansSuiteAt"]).toBeUndefined();
    // Et elle ne jette pas le reste de `details` au passage.
    expect(ecrit.data.details["origine"]).toBe("saisie-manuelle");
  });
});

describe("🔴 l'annulation suit l'ADRESSE, le geste suit la FICHE", () => {
  // Les relances sont retrouvées par l'EMPREINTE de l'adresse, jamais par la
  // fiche — et une personne en a souvent deux ou trois.
  //
  // Sans garde, archiver un simple message /contact de quelqu'un tuerait, en
  // silence, les rappels « ton dossier t'attend » programmés par sa candidature
  // d'apporteur — et inscrirait au journal « la fiche a été archivée » en
  // parlant d'une fiche qui n'avait rien programmé.
  it("archiver une fiche qui N'EST PAS un dossier apporteur ne touche à rien", async () => {
    findUnique.mockResolvedValue({
      id: "sub-1",
      contactEmail: "lea@exemple.invalid",
      deletedAt: null,
      details: { unifiedType: "audit" }, // une demande client ordinaire
    });

    const res = await appliquerTransition("sub-1", "archiver", "admin-1");

    expect(res.ok).toBe(true);
    expect(annuler).not.toHaveBeenCalled();
  });

  it("TÉMOIN — sur un dossier apporteur, elles sont bien retirées", async () => {
    // Sans lui, couper l'annulation pour TOUT LE MONDE passerait le test
    // ci-dessus, et le défaut d'origine reviendrait intact.
    findUnique.mockResolvedValue({
      id: "sub-1",
      contactEmail: "lea@exemple.invalid",
      deletedAt: null,
      details: { unifiedType: "recrutement", subType: "candidature-commerciale" },
    });

    await appliquerTransition("sub-1", "archiver", "admin-1");

    expect(annuler).toHaveBeenCalledTimes(1);
  });
});

describe("ce qui ne doit jamais céder", () => {
  it("un retrait qui ÉCHOUE ne défait pas l'archivage", async () => {
    // Redis indisponible. La fiche EST archivée : dire le contraire à l'admin
    // le laisserait devant un bouton qui « ne marche pas » sur une fiche qu'il
    // veut clore, et il recommencerait.
    annuler.mockRejectedValue(new Error("redis down"));

    const res = await appliquerTransition("sub-1", "archiver", "admin-1");

    expect(res.ok).toBe(true);
    expect(res.relancesRetirees).toBe(0);
    expect(update).toHaveBeenCalled();
  });

  it("une fiche EFFACÉE (art. 17) ne se transite plus, et rien n'est écrit", async () => {
    findUnique.mockResolvedValue({
      id: "sub-1",
      contactEmail: "lea@exemple.invalid",
      deletedAt: new Date("2026-09-01"),
      details: { unifiedType: "recrutement", subType: "candidature-commerciale" },
    });

    const res = await appliquerTransition("sub-1", "archiver", "admin-1");

    expect(res.ok).toBe(false);
    expect(res.erreur).toBe("effacee");
    expect(update).not.toHaveBeenCalled();
    expect(annuler).not.toHaveBeenCalled();
  });

  it("l'horodatage est celui du GESTE, pas celui du démarrage du serveur", async () => {
    // La table `EFFETS` porte `new Date(0)` comme simple marqueur de présence.
    // Si ce marqueur partait tel quel en base, toute fiche archivée serait
    // datée du 1er janvier 1970 — et la purge à 24 mois la ramasserait aussitôt.
    const avant = Date.now();
    await appliquerTransition("sub-1", "archiver", "admin-1");
    const ecrit = update.mock.calls[0]?.[0] as { data: { archivedAt: Date } };

    expect(ecrit.data.archivedAt.getTime()).toBeGreaterThanOrEqual(avant);
  });
});

describe("sans suite laisse une trace lisible", () => {
  it("marque la fiche et écrit au journal d'activité, sans donnée personnelle", async () => {
    await appliquerTransition("sub-1", "sans-suite", "admin-1");

    const ecrit = update.mock.calls[0]?.[0] as { data: { details: Record<string, unknown> } };
    expect(typeof ecrit.data.details.sansSuiteAt).toBe("string");

    expect(logCreate).toHaveBeenCalledTimes(1);
    const journal = JSON.stringify(logCreate.mock.calls[0]?.[0] ?? {});
    expect(journal).toContain("submission.sans_suite");
    // Le journal se lit sans droit d'accès aux coordonnées : l'identifiant de
    // la fiche suffit à la retrouver.
    expect(journal).not.toContain("lea@exemple.invalid");
  });

  it("archiver n'écrit PAS au journal : seule la décision explicite mérite une trace", async () => {
    await appliquerTransition("sub-1", "archiver", "admin-1");
    expect(logCreate).not.toHaveBeenCalled();
  });
});
