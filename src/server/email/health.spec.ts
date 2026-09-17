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
const findFirstMock = vi.fn();
const findManyMock = vi.fn();
const creerOuDedupMock = vi.fn();
const resoudreParCodeMock = vi.fn();
const notifyMock = vi.fn();

// Le battement du webhook lit Redis. Sans cette doublure, les tests mesurent
// un vrai client absent : la lecture est bornée à 1,5 s (cf.
// `webhook-battement.ts`), mais neuf tests à 1,5 s dépassent le délai de
// vitest. On simule donc la lecture, comme prisma l'est juste en dessous.
vi.mock("@/lib/redis", () => ({
  redis: { get: vi.fn(async () => null), set: vi.fn(async () => "OK") },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailLog: {
      count: (...a: unknown[]) => countMock(...a),
      findFirst: (...a: unknown[]) => findFirstMock(...a),
      findMany: (...a: unknown[]) => findManyMock(...a),
    },
  },
}));
// ⚠️ `creerOuActualiser` DOIT figurer ici : la sonde l'importe depuis le
// 2026-09-17, et un module doublé sans l'un de ses exports rend `undefined` —
// donc un `TypeError` avalé par le `catch` fail-soft, c'est-à-dire un fichier
// entier vert qui ne mesure plus rien.
vi.mock("@/server/qualiopi/alertes/alertes-service", () => ({
  creerOuDedup: (...a: unknown[]) => creerOuDedupMock(...a),
  creerOuActualiser: (...a: unknown[]) => creerOuDedupMock(...a),
  resoudreAlertesParCode: (...a: unknown[]) => resoudreParCodeMock(...a),
}));
vi.mock("@/server/notifications", () => ({
  notify: (...a: unknown[]) => notifyMock(...a),
}));

import {
  verifierSanteEmails,
  SEUIL_ECHECS,
  FENETRE_ECHECS_H,
  AGE_BLOCAGE_MIN,
  whereEnvoisBloques,
  whereEchecsDeLaSerie,
} from "./health";
import { SEUIL_ECHECS_CONSECUTIFS } from "./serie-echecs";

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

/** Le dernier envoi RÉUSSI, et les échecs qui le suivent. */
function serie(dernierSucces: Date | null, echecs: readonly unknown[]): void {
  findFirstMock.mockResolvedValue(dernierSucces ? { sentAt: dernierSucces } : null);
  findManyMock.mockResolvedValue(echecs);
}

const T = new Date("2026-09-17T08:40:00.000Z");
const echecLigne = (recipient: string, heures: number, error = "535 Authentication Failed") => ({
  recipient,
  template: "candidature-accuse-reception",
  error,
  failedAt: new Date(T.getTime() - heures * 3600_000),
  createdAt: new Date(T.getTime() - heures * 3600_000),
});

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env["DATABASE_URL"];
  // Par défaut : un envoi a réussi il y a une minute, aucun échec derrière.
  // Sans cette ligne, chaque test hériterait d'une série indéfinie — vraie,
  // mais sans rapport avec ce qu'il mesure.
  serie(new Date(T.getTime() - 60_000), []);
  resoudreParCodeMock.mockResolvedValue(0);
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

/**
 * 🔴 L'incident du 2026-09-15 — 43 heures, 19 échecs, personne de prévenu.
 *
 * Ce bloc garde les trois propriétés qui manquaient, et RIEN d'autre :
 *   1. une série d'échecs consécutifs lève une alerte, même quand le taux sur
 *      six heures ne l'aurait jamais levée (week-end, file calme) ;
 *   2. l'alerte ouverte est RAFRAÎCHIE à chaque passage — sinon son titre reste
 *      figé sur le compte du premier tour et, comme aucun de ces codes ne se
 *      referme seul, toutes les pannes suivantes sont dé-dupliquées en silence ;
 *   3. elle se referme d'elle-même, mais seulement sur PREUVE POSITIVE.
 */
describe("verifierSanteEmails — la série d'échecs consécutifs", () => {
  it("🔴 lève « emails_echecs_consecutifs » au troisième échec d'affilée", async () => {
    compteurs(0, 0);
    serie(new Date(T.getTime() - 40 * 3600_000), [
      echecLigne("a@exemple.fr", 30),
      echecLigne("b@exemple.fr", 20),
      echecLigne("c@exemple.fr", 10),
    ]);

    const r = await verifierSanteEmails(T);

    expect(r.serieEchecs.chaine).toBe(SEUIL_ECHECS_CONSECUTIFS);
    expect(r.alertesLevees).toContain("emails_echecs_consecutifs");
    expect(creerOuDedupMock).toHaveBeenCalledWith(
      expect.objectContaining({ code: "emails_echecs_consecutifs", niveau: "critique" }),
    );
  });

  it("🔴 crie là où le TAUX sur 6 h se serait tu — trois échecs espacés de 10 h", async () => {
    // `echecsRecents` vaut 0 : aucune fenêtre de six heures n'en contient trois.
    // C'est exactement le cas que l'ancien critère ne pouvait pas voir.
    compteurs(0, 0);
    serie(new Date(T.getTime() - 40 * 3600_000), [
      echecLigne("a@exemple.fr", 30),
      echecLigne("b@exemple.fr", 20),
      echecLigne("c@exemple.fr", 10),
    ]);

    const r = await verifierSanteEmails(T);

    expect(r.echecsRecents, "le taux ne voit rien, et c'est le point").toBe(0);
    expect(r.alertesLevees).not.toContain("emails_en_echec");
    expect(r.alertesLevees).toContain("emails_echecs_consecutifs");
  });

  it("dit COMBIEN de personnes et DEPUIS QUAND, dans le message et les métadonnées", async () => {
    compteurs(0, 0);
    serie(new Date(T.getTime() - 44 * 3600_000), [
      echecLigne("a@exemple.fr", 43),
      echecLigne("b@exemple.fr", 20),
      echecLigne("c@exemple.fr", 1),
    ]);

    await verifierSanteEmails(T);

    const appel = creerOuDedupMock.mock.calls.find(
      (c) => (c[0] as { code: string }).code === "emails_echecs_consecutifs",
    )?.[0] as { titre: string; message: string; metadata: Record<string, unknown> };

    expect(appel.titre).toContain("3 destinataires");
    expect(appel.message).toContain("43 h");
    expect(appel.message).toContain("535");
    expect(appel.metadata["destinatairesDistincts"]).toBe(3);
  });

  it("🔴 trois rebonds d'ADRESSE d'affilée ne lèvent PAS la panne de chaîne", async () => {
    compteurs(0, 0);
    serie(new Date(T.getTime() - 40 * 3600_000), [
      echecLigne("mort@x.fr", 30, "550 5.1.1 User unknown"),
      echecLigne("parti@y.fr", 20, "550 5.1.1 Recipient address rejected"),
      echecLigne("plein@z.fr", 10, "552 5.2.2 Mailbox full"),
    ]);

    const r = await verifierSanteEmails(T);

    expect(r.serieEchecs.total).toBe(3);
    expect(r.serieEchecs.destinataire).toBe(3);
    expect(r.alertesLevees).not.toContain("emails_echecs_consecutifs");
  });

  it("🔴 RAFRAÎCHIT l'alerte ouverte au lieu de la dé-dupliquer en silence", async () => {
    // Le fusible qui ne fondait qu'une fois : `creerOuDedup` rend `null` dès
    // qu'une alerte du même code est ouverte, et aucun de ces codes ne se
    // referme tout seul. Le compte affiché restait donc celui du premier
    // passage — 3 — pendant que la panne montait à 19.
    compteurs(0, 0);
    serie(
      new Date(T.getTime() - 44 * 3600_000),
      Array.from({ length: 19 }, (_, i) => echecLigne(`c${i}@exemple.fr`, 43 - i * 2)),
    );

    await verifierSanteEmails(T);

    const appel = creerOuDedupMock.mock.calls.find(
      (c) => (c[0] as { code: string }).code === "emails_echecs_consecutifs",
    )?.[0] as { titre: string; metadata: Record<string, unknown> };

    expect(
      appel.titre,
      "le titre doit porter le compte COURANT, pas celui du premier tour",
    ).toContain("19");
    expect(appel.metadata["chaine"]).toBe(19);
  });

  it("🔴 se referme d'elle-même quand les envois repartent", async () => {
    compteurs(0, 0);
    resoudreParCodeMock.mockResolvedValue(1);
    serie(new Date(T.getTime() - 60_000), []); // un succès, aucun échec derrière

    const r = await verifierSanteEmails(T);

    expect(resoudreParCodeMock).toHaveBeenCalledWith(["emails_echecs_consecutifs"]);
    expect(r.alertesResolues).toContain("emails_echecs_consecutifs");
  });

  it("🔑 CONTRE-TÉMOIN : ne referme RIEN tant qu'aucun envoi n'a réussi", async () => {
    // Refermer sur « je ne vois plus d'échec » effacerait l'alerte le jour où
    // plus RIEN ne s'envoie — le pire des cas, pas le meilleur.
    compteurs(0, 0);
    serie(null, []);

    const r = await verifierSanteEmails(T);

    expect(resoudreParCodeMock).not.toHaveBeenCalled();
    expect(r.alertesResolues).toEqual([]);
  });

  it("🔑 CONTRE-TÉMOIN : ne referme rien tant que la série dure", async () => {
    compteurs(0, 0);
    serie(new Date(T.getTime() - 40 * 3600_000), [echecLigne("a@exemple.fr", 1)]);

    const r = await verifierSanteEmails(T);

    expect(resoudreParCodeMock).not.toHaveBeenCalled();
    expect(r.alertesResolues).toEqual([]);
  });
});

describe("whereEchecsDeLaSerie — la borne de la série, éprouvée sur des lignes", () => {
  const succes = new Date("2026-09-15T13:00:00.000Z");

  /** Applique le `where` rendu à une ligne, comme le ferait la base. */
  function retenue(l: { failedAt: Date | null; createdAt: Date }, borne: Date | null): boolean {
    const w = whereEchecsDeLaSerie(borne);
    if (!w.OR) return true; // aucune borne : toute la table
    return w.OR.some((c) =>
      "createdAt" in c
        ? l.failedAt === null && l.createdAt > c.createdAt.gt
        : l.failedAt !== null && l.failedAt > c.failedAt.gt,
    );
  }

  it("retient les échecs POSTÉRIEURS au dernier succès", () => {
    const apres = { failedAt: new Date("2026-09-15T13:17:00.000Z"), createdAt: succes };
    expect(retenue(apres, succes)).toBe(true);
  });

  it("🔑 CONTRE-TÉMOIN : écarte ceux qui le PRÉCÈDENT — sinon la série ne se remet jamais à zéro", () => {
    const avant = { failedAt: new Date("2026-09-14T09:00:00.000Z"), createdAt: succes };
    expect(retenue(avant, succes)).toBe(false);
  });

  it("n'oublie pas les lignes anciennes sans failedAt — elles comptent par createdAt", () => {
    const heritee = { failedAt: null, createdAt: new Date("2026-09-15T14:00:00.000Z") };
    expect(retenue(heritee, succes)).toBe(true);
    const herriteeAvant = { failedAt: null, createdAt: new Date("2026-09-14T14:00:00.000Z") };
    expect(retenue(herriteeAvant, succes)).toBe(false);
  });

  it("sans aucun succès au journal, tout échec appartient à la série", () => {
    expect(whereEchecsDeLaSerie(null).OR).toBeUndefined();
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
    // 🔴 2026-09-09 — cette assertion portait sur `where.createdAt.lt`, et
    // c'est CE QU'ELLE FIGEAIT qui était le défaut : la borne s'appliquait à la
    // date de CRÉATION, donc un envoi différé à J+7 comptait comme bloqué dès
    // la 16e minute. Le test était vert sur une condition fausse parce qu'il
    // vérifiait la forme qu'elle avait, pas la question qu'elle posait.
    // La borne est la même ; elle porte désormais sur l'ÉCHÉANCE, avec un repli
    // sur `createdAt` pour les lignes antérieures au champ.
    const bornee = new Date(maintenant.getTime() - AGE_BLOCAGE_MIN * 60_000);
    const where = (appelBloques?.[0] as { where: ReturnType<typeof whereEnvoisBloques> }).where;
    expect(where).toEqual(whereEnvoisBloques(bornee));
    expect(where.OR[0].dueAt.lt).toEqual(bornee);
    expect(where.OR[1].createdAt.lt).toEqual(bornee);
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

/**
 * 🔴 Le faux positif du 2026-09-09 — et le témoin qui manquait pour l'attraper.
 *
 * Une alerte CRITIQUE est restée ouverte deux jours en annonçant « AUCUN e-mail
 * ne part — convocations comprises », pendant que 137 e-mails partaient sans un
 * seul échec. Les quatre lignes `pending` incriminées étaient les relances
 * apporteur J+2 et J+7 : elles attendaient leur date.
 *
 * 🔑 Pourquoi AUCUN test n'a rougi pendant ces deux jours : la condition vivait
 * à l'intérieur d'un `count()` dont le mock ne regarde pas l'argument. Un test
 * qui ne lit pas ce que la requête DIT ne mesure pas la requête. La condition
 * est donc sortie dans `whereEnvoisBloques()`, et on l'éprouve ici en
 * l'APPLIQUANT à des lignes, pas en comparant sa forme.
 */
describe("whereEnvoisBloques — un envoi différé n'est pas un envoi bloqué", () => {
  const maintenant = new Date("2026-09-09T08:00:00.000Z");
  const avant = new Date(maintenant.getTime() - AGE_BLOCAGE_MIN * 60_000);

  /** Applique le `where` rendu à une ligne, comme le ferait la base. */
  function retenue(ligne: { dueAt: Date | null; createdAt: Date }): boolean {
    const w = whereEnvoisBloques(avant);
    return w.OR.some((clause) =>
      "createdAt" in clause
        ? ligne.dueAt === null && ligne.createdAt < clause.createdAt.lt
        : ligne.dueAt !== null && ligne.dueAt < clause.dueAt.lt,
    );
  }

  const relanceJ7NonEchue = {
    createdAt: new Date("2026-09-08T13:11:00.000Z"),
    dueAt: new Date("2026-09-15T13:11:00.000Z"),
  };
  const relanceEchueDepuisLongtemps = {
    createdAt: new Date("2026-09-01T10:00:00.000Z"),
    dueAt: new Date("2026-09-03T10:00:00.000Z"),
  };
  const ligneHeritee = { createdAt: new Date("2026-09-07T10:07:00.000Z"), dueAt: null };
  const ligneTouteFraiche = { createdAt: new Date("2026-09-09T07:59:00.000Z"), dueAt: null };

  it("NE COMPTE PAS une relance différée dont l'échéance est dans le futur", () => {
    // Le défaut exact : créée il y a 19 heures, donc « ancienne » au sens de
    // `createdAt` — mais elle n'est due que le 15.
    expect(retenue(relanceJ7NonEchue)).toBe(false);
  });

  it("COMPTE une ligne dont l'échéance est dépassée depuis plus de 15 min", () => {
    // Témoin POSITIF : sans lui, une condition qui ne retient JAMAIS rien
    // passerait le test précédent en paraissant correcte.
    expect(retenue(relanceEchueDepuisLongtemps)).toBe(true);
  });

  it("COMPTE encore les lignes antérieures au champ, via createdAt", () => {
    // Échanger un faux positif contre un faux négatif serait le mauvais côté du
    // marché : l'enjeu est « aucune convocation ne part ».
    expect(retenue(ligneHeritee)).toBe(true);
    expect(retenue(ligneTouteFraiche)).toBe(false);
  });

  it("l'ANCIENNE condition aurait retenu la relance non échue — la garde discrimine", () => {
    // Rejoue littéralement la condition d'avant (`createdAt < avant`, sans
    // égard pour l'échéance) sur la MÊME ligne. Si elle ne rougissait pas ici,
    // ce fichier ne prouverait pas que quelque chose a changé.
    const ancienneCondition = (l: { createdAt: Date }): boolean => l.createdAt < avant;
    expect(ancienneCondition(relanceJ7NonEchue)).toBe(true);
    expect(retenue(relanceJ7NonEchue)).toBe(false);
  });
});
