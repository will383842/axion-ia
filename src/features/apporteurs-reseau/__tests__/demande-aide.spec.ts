// Demande d'aide depuis l'espace de l'apporteur : le jeton est revérifié côté serveur, le
// message est validé, les envois sont limités par dossier, et l'équipe est prévenue par
// l'alerte interne EXISTANTE — sans donnée bancaire, sans e-mail à l'apporteur.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const h = vi.hoisted(() => ({
  lireDossierParLien: vi.fn(),
  limite: vi.fn(),
  enqueueEmail: vi.fn(),
  sentry: vi.fn(),
}));

vi.mock("@/features/apporteurs-reseau/donnees", () => ({
  lireDossierParLien: (...a: unknown[]) => h.lireDossierParLien(...a),
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: (...a: unknown[]) => h.limite(...a) }));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "203.0.113.9" }));
vi.mock("@/lib/security/ip-hash", () => ({ hashIp: () => "ip-hachee" }));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => h.enqueueEmail(...a),
}));
vi.mock("@/lib/destinataires-internes", () => ({
  destinataireAlertesInternes: () => "equipe@exemple.fr",
}));
vi.mock("@sentry/nextjs", () => ({ captureException: (...a: unknown[]) => h.sentry(...a) }));

import { envoyerDemandeAide } from "../demande-aide";
import { TEXTES_AIDE } from "../demande-aide-textes";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const JETON = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCdE";
const IBAN = "FR76 3000 6000 0112 3456 7890 189";
const DOSSIER = {
  id: ID,
  statut: "signe",
  prenom: "Claire",
  nom: "Martin",
  email: "claire@exemple.fr",
  ibanMasque: "FR76 •••• 0189",
};
const MESSAGE = "Bonjour, je ne retrouve pas mon contrat signé.";

function demande(champs: Record<string, string>, id = ID, jeton = JETON) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(champs)) fd.set(k, v);
  return envoyerDemandeAide(id, jeton, undefined, fd);
}

beforeEach(() => {
  vi.clearAllMocks();
  h.lireDossierParLien.mockResolvedValue(DOSSIER);
  h.limite.mockResolvedValue({ allowed: true });
  h.enqueueEmail.mockResolvedValue({ enqueued: true });
});

describe("le lien est revérifié côté serveur", () => {
  it("jeton invalide : refusé, aucune alerte", async () => {
    h.lireDossierParLien.mockResolvedValue(null);
    const r = await demande({ sujet: "contrat", message: MESSAGE }, ID, "jeton-faux");
    expect(r).toMatchObject({ ok: false, message: TEXTES_AIDE.lienInvalide });
    expect(h.lireDossierParLien).toHaveBeenCalledWith(ID, "jeton-faux");
    expect(h.enqueueEmail).not.toHaveBeenCalled();
  });

  it.each(["refuse", "resilie"])("dossier « %s » (page neutre) : refusé", async (statut) => {
    h.lireDossierParLien.mockResolvedValue({ ...DOSSIER, statut });
    expect((await demande({ sujet: "contrat", message: MESSAGE })).ok).toBe(false);
    expect(h.enqueueEmail).not.toHaveBeenCalled();
  });

  it("apporteur retiré avec de l'argent en jeu (mode restreint) : il peut écrire", async () => {
    h.lireDossierParLien.mockResolvedValue({ ...DOSSIER, restreint: true });
    expect(await demande({ sujet: "commissions", message: MESSAGE })).toEqual({ ok: true });
    expect(h.enqueueEmail).toHaveBeenCalledTimes(1);
  });
});

describe("la saisie est validée", () => {
  it("message trop court : refusé, la saisie est rendue, aucune alerte", async () => {
    const r = await demande({ sujet: "dossier", message: "  court  " });
    expect(r).toEqual({
      ok: false,
      champ: "message",
      message: TEXTES_AIDE.messageCourt,
      saisie: { sujet: "dossier", message: "court" },
    });
    expect(h.enqueueEmail).not.toHaveBeenCalled();
  });

  it("message trop long : refusé", async () => {
    const r = await demande({ sujet: "dossier", message: "a".repeat(2001) });
    expect(r).toMatchObject({ ok: false, champ: "message", message: TEXTES_AIDE.messageLong });
    expect(h.enqueueEmail).not.toHaveBeenCalled();
  });

  it("sujet inconnu ou absent : refusé", async () => {
    for (const sujet of ["", "virement"]) {
      const r = await demande({ sujet, message: MESSAGE });
      expect(r).toMatchObject({ ok: false, champ: "sujet", message: TEXTES_AIDE.sujetManquant });
    }
    expect(h.enqueueEmail).not.toHaveBeenCalled();
  });

  it("une saisie refusée ne consomme pas la limite du dossier", async () => {
    await demande({ sujet: "dossier", message: "court" });
    expect(h.limite.mock.calls.map((c) => c[0])).not.toContain(`apporteur:aide:dossier:${ID}`);
  });
});

describe("les envois sont limités", () => {
  it("5 par dossier et par heure, refus si le compteur est en panne", async () => {
    await demande({ sujet: "contrat", message: MESSAGE });
    expect(h.limite).toHaveBeenCalledWith(`apporteur:aide:dossier:${ID}`, {
      limit: 5,
      windowSec: 3600,
      surPanne: "refuser",
    });
  });

  it("limite du dossier atteinte : refusé, aucune alerte, la saisie est rendue", async () => {
    h.limite.mockImplementation(async (cle: string) => ({
      allowed: !cle.startsWith("apporteur:aide:dossier:"),
    }));
    const r = await demande({ sujet: "contrat", message: MESSAGE });
    expect(r).toEqual({
      ok: false,
      message: TEXTES_AIDE.tropDEnvois,
      saisie: { sujet: "contrat", message: MESSAGE },
    });
    expect(h.enqueueEmail).not.toHaveBeenCalled();
  });

  it("trop d'essais depuis une même connexion : refusé avant toute lecture du dossier", async () => {
    h.limite.mockResolvedValue({ allowed: false });
    expect((await demande({ sujet: "contrat", message: MESSAGE })).ok).toBe(false);
    expect(h.lireDossierParLien).not.toHaveBeenCalled();
    expect(h.limite.mock.calls[0]?.[0]).toBe("apporteur:aide:ip:ip-hachee");
  });
});

describe("l'équipe est prévenue par l'alerte interne existante", () => {
  it("gabarit interne, destinataire interne, lien vers la fiche console", async () => {
    expect(await demande({ sujet: "commissions", message: MESSAGE })).toEqual({ ok: true });
    expect(h.enqueueEmail).toHaveBeenCalledTimes(1);
    const [gabarit, destinataire, locale, payload, options] = h.enqueueEmail.mock.calls[0]!;
    expect(gabarit).toBe("qualiopi-alerte-interne");
    // Jamais l'adresse de l'apporteur : aucun e-mail ne lui part.
    expect(destinataire).toBe("equipe@exemple.fr");
    expect(locale).toBe("fr");
    expect(payload).toMatchObject({
      niveau: "important",
      code: "apporteur_demande_aide",
      titre: "Demande d'aide : Claire Martin",
      cibleType: "ApporteurReseau",
      cibleId: ID,
      rubrique: "apporteurs",
      chemin: `apporteurs/${ID}`,
    });
    expect(payload.message).toContain("Mes commissions");
    expect(payload.message).toContain(MESSAGE);
    expect(options).toEqual({ entityType: "ApporteurReseau", entityId: ID });
  });

  it("aucune donnée bancaire : ni celle du dossier, ni un IBAN tapé dans le message", async () => {
    const r = await demande({
      sujet: "commissions",
      message: `Versez sur ${IBAN} merci, ou sur fr7630006000011234567890189.`,
    });
    expect(r).toEqual({ ok: true });
    const charge = JSON.stringify(h.enqueueEmail.mock.calls[0]);
    expect(charge).not.toContain("3000 6000");
    expect(charge).not.toContain("30006000011234567890189");
    expect(charge).not.toContain(DOSSIER.ibanMasque);
    expect(charge).toContain("[coordonnées bancaires retirées]");
  });

  it("un numéro SIRET n'est pas pris pour un IBAN", async () => {
    await demande({
      sujet: "entreprise",
      message: "L'entreprise 552 100 554 00013 est-elle prise ?",
    });
    expect(h.enqueueEmail.mock.calls[0]![3].message).toContain("552 100 554 00013");
  });

  it.each([
    ["le devis AX26-118 de la société Dupont", "le devis AX26-118 de la société Dupont"],
    ["facture FA26-0001234567 non reçue", "facture FA26-0001234567 non reçue"],
  ])("une référence n'est pas un IBAN : %s", async (message, attendu) => {
    await demande({ sujet: "autre", message });
    expect(h.enqueueEmail.mock.calls[0]![3].message).toContain(attendu);
    expect(h.enqueueEmail.mock.calls[0]![3].message).not.toContain("retirées");
  });

  it.each([
    ["espace après le code pays", "FR 76 3000 6000 0112 3456 7890 189"],
    ["espaces doubles", "FR76  3000  6000  0112  3456  7890  189"],
    ["points", "FR76.3000.6000.0112.3456.7890.189"],
    ["minuscules collées", "fr7630006000011234567890189"],
  ])("IBAN retiré, le reste du message gardé : %s", async (_nom, iban) => {
    await demande({ sujet: "commissions", message: `Versez sur ${iban} merci beaucoup` });
    const { message } = h.enqueueEmail.mock.calls[0]![3];
    expect(message).toContain("Versez sur [coordonnées bancaires retirées] merci beaucoup");
    expect(message).not.toContain("0112");
    expect(message).not.toContain("7890");
  });

  it("RIB français retiré", async () => {
    await demande({ sujet: "commissions", message: "Mon RIB : 30006 00001 12345678901 89 voilà" });
    const { message } = h.enqueueEmail.mock.calls[0]![3];
    expect(message).toContain("Mon RIB : [coordonnées bancaires retirées] voilà");
  });

  it("le texte libre part tel quel, sans être interprété, sur une seule ligne", async () => {
    const brut = "<script>alert(1)</script>\n\n[lien](https://exemple.fr)\u0000 fin";
    await demande({ sujet: "autre", message: brut });
    const { titre, message } = h.enqueueEmail.mock.calls[0]![3];
    expect(message).toContain("<script>alert(1)</script> [lien](https://exemple.fr) fin");
    // Le texte libre ne va jamais dans le titre (donc jamais dans l'objet de l'e-mail).
    expect(titre).not.toContain("script");
  });

  it("alerte garée pour relecture : elle est enregistrée, l'apporteur a sa confirmation", async () => {
    h.enqueueEmail.mockResolvedValue({ enqueued: false, garePourValidation: true });
    expect(await demande({ sujet: "contrat", message: MESSAGE })).toEqual({ ok: true });
  });

  it("la file refuse l'alerte : l'apporteur est prévenu, sa saisie est rendue", async () => {
    h.enqueueEmail.mockResolvedValue({ enqueued: false });
    const r = await demande({ sujet: "contrat", message: MESSAGE });
    expect(r).toEqual({
      ok: false,
      message: TEXTES_AIDE.echec,
      saisie: { sujet: "contrat", message: MESSAGE },
    });
  });

  it("une panne ne met jamais le texte libre dans Sentry ni dans la console", async () => {
    const espions = (["log", "info", "warn", "error"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    h.enqueueEmail.mockRejectedValue(new Error(`Redis KO pour ${MESSAGE}`));
    const r = await demande({ sujet: "contrat", message: MESSAGE });
    expect(r).toMatchObject({ ok: false, message: TEXTES_AIDE.echec });
    expect(h.sentry).toHaveBeenCalledTimes(1);
    const traces = JSON.stringify([
      h.sentry.mock.calls.map(([e, ctx]) => [(e as Error).message, ctx]),
      espions.flatMap((e) => e.mock.calls),
    ]);
    expect(traces).not.toContain("contrat signé");
    espions.forEach((e) => e.mockRestore());
  });
});

describe("compteur de limite en panne", () => {
  it("panne sur la limite par connexion : texte d'échec, jamais « déjà envoyé »", async () => {
    h.limite.mockResolvedValue({ allowed: false, panne: true });
    const r = await demande({ sujet: "contrat", message: MESSAGE });
    expect(r).toMatchObject({ ok: false, message: TEXTES_AIDE.echec });
    expect(h.enqueueEmail).not.toHaveBeenCalled();
  });

  it("panne sur la limite par dossier : texte d'échec", async () => {
    h.limite
      .mockResolvedValueOnce({ allowed: true })
      .mockResolvedValueOnce({ allowed: false, panne: true });
    const r = await demande({ sujet: "contrat", message: MESSAGE });
    expect(r).toMatchObject({ ok: false, message: TEXTES_AIDE.echec });
  });

  it("limite par connexion atteinte : texte sans durée ni « déjà envoyé »", async () => {
    h.limite.mockResolvedValue({ allowed: false });
    const r = await demande({ sujet: "contrat", message: MESSAGE });
    expect(r).toMatchObject({ ok: false, message: TEXTES_AIDE.tropDEssais });
    expect(TEXTES_AIDE.tropDEssais).not.toMatch(/heure|minute|déjà envoy/i);
  });

  it("limite par dossier atteinte : texte « déjà envoyé »", async () => {
    h.limite.mockResolvedValueOnce({ allowed: true }).mockResolvedValueOnce({ allowed: false });
    const r = await demande({ sujet: "contrat", message: MESSAGE });
    expect(r).toMatchObject({ ok: false, message: TEXTES_AIDE.tropDEnvois });
  });
});

describe("retours à la ligne", () => {
  it("CRLF compte pour un caractère, comme dans le navigateur", async () => {
    const message = "a".repeat(1980) + "\r\n".repeat(20); // 2 020 bruts, 2 000 pour le navigateur
    const r = await demande({ sujet: "autre", message });
    expect(r).toEqual({ ok: true });
  });
});
