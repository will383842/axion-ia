// L-ENV — L'adaptateur d'envoi des formateurs indépendants : un texte non validé ne
// s'enfile JAMAIS (cron compris), une fin de collaboration ne laisse passer que l'argent,
// le lien d'espace n'est jamais repris du payload.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  enqueueEmail: vi.fn(),
  settings: vi.fn(),
  trainer: vi.fn(),
  render: vi.fn(),
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => h.enqueueEmail(...a),
  emailsQueue: null,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    setting: { findMany: (...a: unknown[]) => h.settings(...a) },
    trainer: { findUnique: (...a: unknown[]) => h.trainer(...a) },
  },
}));
vi.mock("@/lib/email/templates", () => ({
  renderEmailTemplate: (...a: unknown[]) => h.render(...a),
}));

import { GABARITS_FORMATEUR, apercu, envoyer, type EnvoiFormateur } from "../envois";
import {
  GABARITS_FORMATEUR_INDEPENDANT,
  TEXTES_FORMATEUR,
} from "@/lib/email/templates/formateur-independant-textes";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";

/** Les lignes `settings` lues par l'adaptateur : interrupteurs puis registre des textes. */
function reglages(o: { interrupteur?: boolean; valides?: string[] }) {
  h.settings.mockImplementation(async (q: { where: { key: { startsWith: string } } }) => {
    const p = q.where.key.startsWith;
    if (p === "formateurs.") {
      return o.interrupteur === undefined
        ? []
        : [{ key: "formateurs.textes_valides", value: { actif: o.interrupteur } }];
    }
    if (p === "textes_valides.") {
      return (o.valides ?? []).map((g) => ({
        key: `textes_valides.${g}`,
        value: { valide: true },
      }));
    }
    return [];
  });
}

/** Une valeur pour chaque [crochet] du texte d'un gabarit. */
function valeursPour(g: keyof typeof TEXTES_FORMATEUR): Record<string, string> {
  const t = TEXTES_FORMATEUR[g].variantes[0];
  const cles = [...`${t.objet}\n${t.paragraphes.join("\n")}`.matchAll(/\[([^[\]]+)\]/g)].map(
    (m) => m[1]!,
  );
  return Object.fromEntries(cles.map((c) => [c, "x"]));
}

const envoi = (over: Partial<EnvoiFormateur> = {}) =>
  envoyer({
    gabarit: "formateur-dossier-relance",
    destinataire: "claire@exemple.invalid",
    payload: { prenom: "Claire" },
    entityType: "Trainer",
    entityId: ID,
    ...over,
  });

beforeEach(() => {
  vi.clearAllMocks();
  h.enqueueEmail.mockResolvedValue({ enqueued: true });
  h.trainer.mockResolvedValue({ finCollaborationAt: null });
  h.render.mockResolvedValue({ subject: "Objet", html: "<p>x</p>" });
});

describe("la liste littérale de l'adaptateur est celle des textes", () => {
  it("mêmes gabarits, dans le même ordre", () => {
    expect([...GABARITS_FORMATEUR]).toEqual([...GABARITS_FORMATEUR_INDEPENDANT]);
  });
});

describe("rien ne part tant que le texte n'est pas validé", () => {
  it("interrupteur absent : rien n'est enfilé, même gabarit inscrit au registre", async () => {
    reglages({ valides: ["formateur-dossier-relance"] });
    expect(await envoi()).toBe("texte-non-valide");
    expect(h.enqueueEmail).not.toHaveBeenCalled();
  });
  it("interrupteur éteint : rien n'est enfilé", async () => {
    reglages({ interrupteur: false, valides: ["formateur-dossier-relance"] });
    expect(await envoi()).toBe("texte-non-valide");
    expect(h.enqueueEmail).not.toHaveBeenCalled();
  });
  it("interrupteur allumé mais gabarit non validé : rien n'est enfilé", async () => {
    reglages({ interrupteur: true, valides: ["formateur-dossier-lien"] });
    expect(await envoi()).toBe("texte-non-valide");
    expect(h.enqueueEmail).not.toHaveBeenCalled();
  });
  it("base injoignable : rien n'est enfilé", async () => {
    h.settings.mockRejectedValue(new Error("base"));
    expect(await envoi()).toBe("texte-non-valide");
    expect(h.enqueueEmail).not.toHaveBeenCalled();
  });
  it("interrupteur allumé et texte validé : l'e-mail est enfilé, avec sa priorité", async () => {
    reglages({ interrupteur: true, valides: ["formateur-dossier-relance"] });
    expect(await envoi({ jobId: "fi:dossier:1", priority: 10 })).toBe("envoye");
    expect(h.enqueueEmail).toHaveBeenCalledWith(
      "formateur-dossier-relance",
      "claire@exemple.invalid",
      "fr",
      { prenom: "Claire" },
      { entityType: "Trainer", entityId: ID, jobId: "fi-dossier-1", priority: 10 },
    );
  });
});

describe("un [crochet] non rempli ne part jamais", () => {
  beforeEach(() => reglages({ interrupteur: true, valides: ["formateur-virement-fait"] }));
  it("sans ses valeurs : rien n'est enfilé", async () => {
    expect(await envoi({ gabarit: "formateur-virement-fait" })).toBe("valeurs-manquantes");
    expect(h.enqueueEmail).not.toHaveBeenCalled();
  });
  it("avec toutes ses valeurs : l'e-mail part", async () => {
    const t = TEXTES_FORMATEUR["formateur-virement-fait"].variantes[0];
    const cles = [...`${t.objet}\n${t.paragraphes.join("\n")}`.matchAll(/\[([^[\]]+)\]/g)].map(
      (m) => m[1]!,
    );
    const valeurs = Object.fromEntries(cles.map((c) => [c, "x"]));
    expect(await envoi({ gabarit: "formateur-virement-fait", payload: { valeurs } })).toBe(
      "envoye",
    );
  });
});

describe("le lien d'espace n'est jamais repris du payload", () => {
  it("un lienEspace reçu est retiré", async () => {
    reglages({ interrupteur: true, valides: ["formateur-dossier-relance"] });
    await envoi({ payload: { prenom: "Claire", lienEspace: "https://pirate.invalid" } });
    expect(h.enqueueEmail.mock.calls[0]![3]).toEqual({ prenom: "Claire" });
  });
});

describe("après une fin de collaboration, seuls les e-mails d'argent partent", () => {
  beforeEach(() => {
    reglages({
      interrupteur: true,
      valides: ["formateur-dossier-relance", "formateur-virement-fait"],
    });
    h.trainer.mockResolvedValue({ finCollaborationAt: new Date("2026-10-01") });
  });
  it("une relance de dossier est retenue", async () => {
    expect(await envoi()).toBe("fin-de-collaboration");
    expect(h.enqueueEmail).not.toHaveBeenCalled();
  });
  it("le virement part", async () => {
    expect(
      await envoi({
        gabarit: "formateur-virement-fait",
        payload: { valeurs: valeursPour("formateur-virement-fait") },
      }),
    ).toBe("envoye");
    expect(h.enqueueEmail).toHaveBeenCalledTimes(1);
  });
  it("fiche illisible : rien ne part (on ne sait pas)", async () => {
    h.trainer.mockRejectedValue(new Error("base"));
    expect(await envoi()).toBe("indisponible");
    expect(h.enqueueEmail).not.toHaveBeenCalled();
  });
});

describe("l'aperçu s'ouvre pour chaque gabarit, et rien ne part", () => {
  it.each(GABARITS_FORMATEUR_INDEPENDANT)("%s", async (g) => {
    reglages({});
    const r = await apercu({ gabarit: g, destinataire: "a@exemple.invalid", payload: {} });
    expect(r.gabarit).toBe(g);
    expect(r.texteDefaut?.length ?? 0).toBeGreaterThan(0);
    expect(h.enqueueEmail).not.toHaveBeenCalled();
  });
});

describe("lexique des textes formateurs", () => {
  const INTERDITS =
    /\b(poste|entretien|recrutement|salaire|rémunération|bienvenue|vous devez|obligatoire|agent commercial|grenoble|embauche)\b/i;
  it.each(GABARITS_FORMATEUR_INDEPENDANT)("%s : aucun mot interdit", (g) => {
    const t = TEXTES_FORMATEUR[g];
    const tout = [
      t.titre,
      ...t.variantes.flatMap((v) => [v.objet, ...v.paragraphes, ...v.boutons]),
    ].join("\n");
    expect(tout).not.toMatch(INTERDITS);
  });
  it.each(GABARITS_FORMATEUR_INDEPENDANT)("%s : aucun paragraphe vide", (g) => {
    for (const v of TEXTES_FORMATEUR[g].variantes) {
      for (const p of v.paragraphes) expect(p.trim()).not.toBe("");
    }
  });
  it.each(GABARITS_FORMATEUR_INDEPENDANT)("%s : objet de 45 caractères au plus", (g) => {
    for (const v of TEXTES_FORMATEUR[g].variantes) expect(v.objet.length).toBeLessThanOrEqual(45);
  });
});

describe("L11e — une variante neuve se valide à part", () => {
  const f30 = (etape: number) =>
    envoi({
      gabarit: "formateur-mission-retiree",
      payload: {
        prenom: "Claire",
        etape,
        valeurs: { intitulé: "x", date: "x", motif: "x" },
      },
    });

  it("F30 validé, mais pas sa variante « lettre non signée » : elle ne part pas", async () => {
    reglages({ interrupteur: true, valides: ["formateur-mission-retiree"] });
    expect(await f30(2)).toBe("texte-non-valide");
    expect(h.enqueueEmail).not.toHaveBeenCalled();
  });

  it("variante validée à part : elle part", async () => {
    reglages({
      interrupteur: true,
      valides: ["formateur-mission-retiree", "formateur-mission-retiree#lettre-non-signee"],
    });
    expect(await f30(2)).toBe("envoye");
  });
});
