/**
 * Tests — surveillance de la chaîne d'envoi (audit du 2026-08-16).
 *
 * Ce qui est vérifié ici n'est pas « la fonction compte bien » mais les trois
 * propriétés dont dépend la valeur de la surveillance :
 *
 *   1. elle CRIE quand il faut — sinon on retombe exactement dans le défaut
 *      qu'elle corrige, un silence indistinguable du calme ;
 *   2. elle NE CRIE PAS quand tout va bien — une alerte qui se déclenche pour
 *      rien est désarmée en trois jours, et c'est pire que pas d'alerte ;
 *   3. elle n'emprunte JAMAIS l'e-mail pour signaler une panne d'e-mail.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const countMock = vi.fn();
const creerOuDedupMock = vi.fn();
const notifyMock = vi.fn();

// Le battement du webhook lit Redis. Sans cette doublure, les tests mesurent
// un vrai client absent : la lecture est bornée à 1,5 s (cf.
// `webhook-battement.ts`), mais neuf tests à 1,5 s dépassent le délai de
// vitest. On simule donc la lecture, comme prisma l'est juste en dessous.
vi.mock("@/lib/redis", () => ({
  redis: { get: vi.fn(async () => null), set: vi.fn(async () => "OK") },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { emailLog: { count: (...a: unknown[]) => countMock(...a) } },
}));
vi.mock("@/server/qualiopi/alertes/alertes-service", () => ({
  creerOuDedup: (...a: unknown[]) => creerOuDedupMock(...a),
}));
vi.mock("@/server/notifications", () => ({
  notify: (...a: unknown[]) => notifyMock(...a),
}));

import { verifierSanteEmails, SEUIL_ECHECS, FENETRE_ECHECS_H, AGE_BLOCAGE_MIN } from "./health";

/**
 * `count` est appelé TROIS fois depuis le 2026-08-31 : échecs, bloqués, puis
 * rebonds. Le troisième argument est optionnel pour ne pas réécrire les appels
 * existants, dont aucun ne portait sur les rebonds.
 */
function compteurs(echecs: number, bloques: number, rebonds = 0): void {
  countMock
    .mockResolvedValueOnce(echecs)
    .mockResolvedValueOnce(bloques)
    .mockResolvedValueOnce(rebonds);
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env["DATABASE_URL"];
  // 🔑 Par défaut, on se place dans le cas où la détection de rebonds EST
  // branchée. Sans cette ligne, chaque test hériterait de l'alerte
  // `emails_rebonds_non_detectes` — vraie, mais sans rapport avec ce qu'il
  // mesure. L'absence de clé se teste explicitement, dans son propre bloc.
  process.env["ZEPTOMAIL_WEBHOOK_KEY"] = "cle-de-test";
  creerOuDedupMock.mockResolvedValue(null);
  notifyMock.mockResolvedValue({ ok: true, channels: {} });
});

describe("verifierSanteEmails — quand tout va bien", () => {
  it("ne lève rien sur une chaîne saine", async () => {
    compteurs(0, 0);
    const r = await verifierSanteEmails();
    expect(r.alertesLevees).toEqual([]);
    expect(creerOuDedupMock).not.toHaveBeenCalled();
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("tolère un échec isolé — un rebond n'est pas une panne de chaîne", async () => {
    compteurs(SEUIL_ECHECS - 1, 0);
    const r = await verifierSanteEmails();
    expect(r.alertesLevees).toEqual([]);
    expect(creerOuDedupMock).not.toHaveBeenCalled();
  });
});

/**
 * 🔴 Le zéro qui ne mesurait rien — corrigé le 2026-08-31.
 *
 * `bounced` n'est écrit que par `/api/zeptomail/webhook`, et cette route sort
 * en `skipped: not_configured` avant de rien lire quand la clé manque. Mesuré
 * en production : 141 e-mails `sent`, 0 `bounced` — un zéro qui se lisait
 * « aucun destinataire injoignable » alors qu'il fallait lire « je n'ai aucun
 * moyen de le savoir ». Un rebond dur sur l'adresse d'un prospect, donc sur une
 * confirmation de rendez-vous ou une convocation, était strictement invisible.
 */
describe("verifierSanteEmails — les rebonds", () => {
  it("🔴 crie quand AUCUN rebond ne peut être détecté, faute de clé de webhook", async () => {
    delete process.env["ZEPTOMAIL_WEBHOOK_KEY"];
    compteurs(0, 0, 0);

    const r = await verifierSanteEmails();

    expect(r.detectionRebondsDebranchee).toBe(true);
    expect(r.alertesLevees).toContain("emails_rebonds_non_detectes");
    expect(creerOuDedupMock).toHaveBeenCalled();
  });

  it("ne crie plus une fois la clé posée, et compte alors réellement", async () => {
    compteurs(0, 0, 0);

    const r = await verifierSanteEmails();

    expect(r.detectionRebondsDebranchee).toBe(false);
    expect(r.alertesLevees).toEqual([]);
  });

  it("un seul rebond suffit à alerter — il est définitif, là où un échec se rejoue", async () => {
    compteurs(0, 0, 1);

    const r = await verifierSanteEmails();

    expect(r.rebondsRecents).toBe(1);
    expect(r.alertesLevees).toContain("emails_rebonds");
  });

  it("🔑 CONTRE-TÉMOIN : sans clé, on n'annonce PAS un compte de rebonds rassurant", async () => {
    // Le piège serait de lever l'alerte « instrument débranché » ET de laisser
    // croire, par un `rebondsRecents: 0` d'apparence normale, qu'on a compté.
    // Les deux alertes s'excluent : tant que l'instrument est débranché, le
    // compteur n'est pas une mesure et ne doit pas déclencher son alerte à lui.
    delete process.env["ZEPTOMAIL_WEBHOOK_KEY"];
    compteurs(0, 0, 0);

    const r = await verifierSanteEmails();

    expect(r.alertesLevees).not.toContain("emails_rebonds");
    expect(r.detectionRebondsDebranchee).toBe(true);
  });
});

describe("verifierSanteEmails — quand la chaîne casse", () => {
  it("lève « emails_en_echec » au seuil", async () => {
    compteurs(SEUIL_ECHECS, 0);
    const r = await verifierSanteEmails();
    expect(r.alertesLevees).toContain("emails_en_echec");
    expect(creerOuDedupMock).toHaveBeenCalledWith(
      expect.objectContaining({ code: "emails_en_echec", niveau: "critique" }),
    );
  });

  // 🔴 Le cas que RIEN ne pouvait voir avant ce chantier : la file n'est pas
  // consommée, donc aucun envoi n'échoue — il ne se passe simplement rien.
  it("lève « emails_bloques_en_file » dès UN seul envoi jamais traité", async () => {
    compteurs(0, 1);
    const r = await verifierSanteEmails();
    expect(r.alertesLevees).toContain("emails_bloques_en_file");
    expect(creerOuDedupMock).toHaveBeenCalledWith(
      expect.objectContaining({ code: "emails_bloques_en_file", niveau: "critique" }),
    );
  });

  it("lève les deux alertes quand les deux symptômes coexistent", async () => {
    compteurs(SEUIL_ECHECS + 5, 3);
    const r = await verifierSanteEmails();
    expect(r.alertesLevees).toEqual(["emails_en_echec", "emails_bloques_en_file"]);
    expect(notifyMock).toHaveBeenCalledTimes(2);
  });
});

describe("verifierSanteEmails — les fenêtres interrogées", () => {
  it("cherche les échecs sur la fenêtre annoncée et les blocages sur l'âge annoncé", async () => {
    compteurs(0, 0);
    const maintenant = new Date("2026-08-16T12:00:00.000Z");
    await verifierSanteEmails(maintenant);

    const [appelEchecs, appelBloques] = countMock.mock.calls;
    expect((appelEchecs?.[0] as { where: { failedAt: { gte: Date } } }).where.failedAt.gte).toEqual(
      new Date(maintenant.getTime() - FENETRE_ECHECS_H * 3600_000),
    );
    expect(
      (appelBloques?.[0] as { where: { createdAt: { lt: Date } } }).where.createdAt.lt,
    ).toEqual(new Date(maintenant.getTime() - AGE_BLOCAGE_MIN * 60_000));
  });
});

describe("verifierSanteEmails — robustesse", () => {
  // 🔴 Prévenir d'une panne d'e-mail PAR e-mail, c'est écrire au destinataire
  // qu'on ne peut pas le joindre. Les deux canaux doivent rester hors bande.
  it("n'emprunte jamais l'e-mail pour signaler une panne d'e-mail", async () => {
    compteurs(SEUIL_ECHECS, 2);
    await verifierSanteEmails();
    for (const appel of notifyMock.mock.calls) {
      expect((appel[0] as { category: string }).category).toBe("MONITORING_ALERT");
    }
  });

  it("une alerte console en échec n'empêche pas la notification hors bande", async () => {
    compteurs(SEUIL_ECHECS, 0);
    creerOuDedupMock.mockRejectedValueOnce(new Error("base indisponible"));
    const r = await verifierSanteEmails();
    expect(r.alertesLevees).toContain("emails_en_echec");
    expect(notifyMock).toHaveBeenCalledTimes(1);
  });

  it("une base illisible ne fait pas tomber le cron — mais ne se tait plus", async () => {
    // 🔴 2026-08-25 — CE TEST VERROUILLAIT LE DÉFAUT QU'IL PRÉTENDAIT COUVRIR.
    //
    // Son TITRE est juste : une surveillance qui casse le cron qui la porte
    // ferait taire tout ce que ce cron surveille par ailleurs. Le *fail-soft*
    // est la bonne décision, et il reste.
    //
    // Mais son ASSERTION exigeait `alertesLevees: []` — c'est-à-dire le
    // SILENCE. Or le rendu `{ 0, 0, [] }` est **exactement** celui d'une chaîne
    // en parfait état : aucun consommateur ne pouvait distinguer « rien ne va
    // mal » de « je n'ai rien pu regarder ». Le test photographiait ce que le
    // code FAISAIT, pas ce qu'il DEVAIT faire — et lui donnait par là
    // l'apparence d'une décision réfléchie.
    //
    // 🔑 Ne pas lever d'exception n'oblige pas à rendre un résultat rassurant.
    // Ce qui est verrouillé désormais : la promesse RÉSOUT (le cron survit) ET
    // l'impossibilité de mesurer est DITE.
    countMock.mockRejectedValueOnce(new Error("connexion perdue"));

    const r = await verifierSanteEmails();

    expect(r.mesureIndisponible, "l'impossibilité de mesurer n'est pas signalée").toBe(true);
    expect(
      r.alertesLevees,
      "une base illisible reste silencieuse : l'absence d'alerte se lira comme " +
        "« la chaîne va bien »",
    ).toContain("emails_sante_non_mesurable");
    // Les compteurs ne veulent rien dire dans ce cas — on vérifie seulement
    // qu'ils n'inventent pas un chiffre.
    expect(r.echecsRecents).toBe(0);
    expect(r.bloquesEnFile).toBe(0);
  });

  it("🔑 CONTRE-TÉMOIN : une mesure RÉUSSIE ne lève jamais le drapeau d'indisponibilité", () => {
    // Sans ceci, on satisferait le test précédent en levant le drapeau toujours
    // — et « je n'ai rien pu regarder » deviendrait le rendu normal, donc du
    // bruit qu'on apprendrait à ignorer.
    return (async () => {
      compteurs(0, 0);
      const r = await verifierSanteEmails();
      expect(r.mesureIndisponible).toBe(false);
      expect(r.alertesLevees).toEqual([]);
    })();
  });

  it("reste muette au build (base stub)", async () => {
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    const r = await verifierSanteEmails();
    expect(r.alertesLevees).toEqual([]);
    expect(countMock).not.toHaveBeenCalled();
  });
});
