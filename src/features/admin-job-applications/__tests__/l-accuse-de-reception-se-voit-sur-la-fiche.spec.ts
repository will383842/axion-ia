import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * **L'ACCUSÉ DE RÉCEPTION AUTOMATIQUE SE VOIT SUR LA FICHE DU CANDIDAT.**
 *
 * ═══ LE DÉFAUT, MESURÉ EN PRODUCTION LE 2026-09-18 ═══
 *
 * Maxime Jouffrey a candidaté le 16/09. Son accusé (`candidature-recue`) a
 * échoué pendant la panne du relais, a été renvoyé le 18/09 à 15:48, est
 * « Envoyé » dans « E-mails envoyés » et « Livré » chez ZeptoMail. Sa fiche,
 * elle, disait : « Historique — Rien n'a encore été consigné ». Rien, sur
 * l'écran où l'on traite le candidat, ne disait qu'il avait reçu un message.
 * Et rien n'aurait dit non plus, pendant les 43 heures de panne, que dix-huit
 * accusés n'étaient PAS partis.
 *
 * ═══ CE QUE CE FICHIER VERROUILLE ═══
 *
 *  1. Le rattachement EXACT (entité liée à l'enfilage) prime ;
 *  2. à défaut — tous les envois antérieurs à ce correctif — le rattachement
 *     par ADRESSE et HEURE de dépôt, au plus proche, sans voler l'accusé d'une
 *     autre candidature (même personne, deux offres, deux minutes d'écart :
 *     cas réel du 18/09) ;
 *  3. l'état RÉEL : envoyé, en file, en échec (avec motif), rebond, annulé ;
 *  4. l'ABSENCE dite comme telle — jamais une fiche muette qui laisse croire
 *     qu'un accusé est parti ;
 *  5. le cloisonnement : un rôle qui n'ouvre pas le dossier n'obtient rien.
 */

const findManyMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailLog: { findMany: (...a: unknown[]) => findManyMock(...a) },
  },
}));

import { ROLES_ADMIN, peutOuvrirDossierCandidat } from "@/server/auth/habilitations";

import {
  ENTITE_CANDIDATURE,
  choisirAccuse,
  decrireAccuse,
  lireAccuseReception,
  type LigneEnvoiAccuse,
} from "../accuse-reception";

const DEPOT = new Date("2026-09-16T07:59:00Z");

function ligne(p: Partial<LigneEnvoiAccuse> & { id: string }): LigneEnvoiAccuse {
  return {
    template: "candidature-recue",
    status: "sent",
    entityType: null,
    entityId: null,
    attempts: 1,
    error: null,
    sentAt: new Date(DEPOT.getTime() + 5_000),
    failedAt: null,
    bouncedAt: null,
    bounceReason: null,
    createdAt: new Date(DEPOT.getTime() + 2_000),
    ...p,
  };
}

const ROLE_OUVRANT = ROLES_ADMIN.find((r) => peutOuvrirDossierCandidat(r));
const ROLE_FERME = ROLES_ADMIN.find((r) => !peutOuvrirDossierCandidat(r));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("choisirAccuse — à quelle candidature appartient un accusé", () => {
  it("le rattachement EXACT prime sur l'adresse et l'heure", () => {
    const proche = ligne({ id: "proche", createdAt: new Date(DEPOT.getTime() + 1_000) });
    const exact = ligne({
      id: "exact",
      entityType: ENTITE_CANDIDATURE,
      entityId: "app-1",
      createdAt: new Date(DEPOT.getTime() + 30_000),
    });
    const r = choisirAccuse([proche, exact], { id: "app-1", submittedAt: DEPOT });
    expect(r?.ligne.id).toBe("exact");
    expect(r?.rattachement).toBe("exact");
  });

  it("sans lien exact : l'envoi le plus proche du dépôt, dans la fenêtre", () => {
    const r = choisirAccuse(
      [
        ligne({ id: "loin", createdAt: new Date(DEPOT.getTime() + 50 * 60_000) }),
        ligne({ id: "pres", createdAt: new Date(DEPOT.getTime() + 3_000) }),
      ],
      { id: "app-1", submittedAt: DEPOT },
    );
    expect(r?.ligne.id).toBe("pres");
    expect(r?.rattachement).toBe("adresse_et_date");
  });

  it("MÊME personne, DEUX offres à deux minutes : chacune garde SON accusé", () => {
    const depot2 = new Date(DEPOT.getTime() + 2 * 60_000);
    const accuse1 = ligne({ id: "accuse-1", createdAt: new Date(DEPOT.getTime() + 2_000) });
    const accuse2 = ligne({ id: "accuse-2", createdAt: new Date(depot2.getTime() + 2_000) });
    expect(choisirAccuse([accuse1, accuse2], { id: "a1", submittedAt: DEPOT })?.ligne.id).toBe(
      "accuse-1",
    );
    expect(choisirAccuse([accuse1, accuse2], { id: "a2", submittedAt: depot2 })?.ligne.id).toBe(
      "accuse-2",
    );
  });

  it("ne vole JAMAIS l'accusé exactement rattaché à une autre candidature", () => {
    const autre = ligne({
      id: "autre",
      entityType: ENTITE_CANDIDATURE,
      entityId: "app-2",
      createdAt: new Date(DEPOT.getTime() + 1_000),
    });
    expect(choisirAccuse([autre], { id: "app-1", submittedAt: DEPOT })).toBeNull();
  });

  it("hors fenêtre : rien (un envoi d'une autre époque n'est pas cet accusé)", () => {
    const vieux = ligne({ id: "vieux", createdAt: new Date(DEPOT.getTime() - 3 * 3600_000) });
    const tardif = ligne({ id: "tardif", createdAt: new Date(DEPOT.getTime() + 5 * 3600_000) });
    expect(choisirAccuse([vieux, tardif], { id: "app-1", submittedAt: DEPOT })).toBeNull();
  });
});

describe("decrireAccuse — l'état réel, jamais arrondi", () => {
  it("envoyé du premier coup", () => {
    const d = decrireAccuse({ ligne: ligne({ id: "l" }), rattachement: "exact" });
    expect(d.etat).toBe("envoye");
    expect(d.essais).toBe(1);
    expect(d.date?.toISOString()).toBe(new Date(DEPOT.getTime() + 5_000).toISOString());
  });

  it("envoyé APRÈS un échec (renvoi) : la date du DERNIER envoi réussi et le nombre d'essais", () => {
    const renvoye = new Date("2026-09-18T15:48:37Z");
    const d = decrireAccuse({
      ligne: ligne({
        id: "l",
        attempts: 6,
        error: "Invalid login: 535 Authentication Failed",
        sentAt: renvoye,
      }),
      rattachement: "adresse_et_date",
    });
    expect(d.etat).toBe("envoye");
    expect(d.essais).toBe(6);
    expect(d.date?.toISOString()).toBe(renvoye.toISOString());
  });

  it("en échec : dit NON PARTI, avec un motif court", () => {
    const d = decrireAccuse({
      ligne: ligne({
        id: "l",
        status: "failed",
        sentAt: null,
        attempts: 5,
        failedAt: new Date("2026-09-16T08:30:00Z"),
        error: `Invalid login: 535 Authentication Failed\n${"x".repeat(500)}`,
      }),
      rattachement: "exact",
    });
    expect(d.etat).toBe("echec");
    expect(d.motif).toBe("Invalid login: 535 Authentication Failed");
    expect(d.date?.toISOString()).toBe("2026-09-16T08:30:00.000Z");
  });

  it("rebond : dit REFUSÉ par le destinataire, avec le motif du relais", () => {
    const d = decrireAccuse({
      ligne: ligne({
        id: "l",
        status: "bounced",
        bouncedAt: new Date("2026-09-16T08:01:00Z"),
        bounceReason: "Mailbox does not exist",
      }),
      rattachement: "exact",
    });
    expect(d.etat).toBe("rebond");
    expect(d.motif).toBe("Mailbox does not exist");
  });

  it("en file et annulé sont distincts de « envoyé »", () => {
    expect(
      decrireAccuse({
        ligne: ligne({ id: "l", status: "pending", sentAt: null }),
        rattachement: "exact",
      }).etat,
    ).toBe("en_attente");
    expect(
      decrireAccuse({
        ligne: ligne({ id: "l", status: "cancelled", sentAt: null }),
        rattachement: "exact",
      }).etat,
    ).toBe("annule");
  });

  it("aucun envoi trouvé : l'ABSENCE est un état, pas un silence", () => {
    const d = decrireAccuse(null);
    expect(d.etat).toBe("absent");
    expect(d.date).toBeNull();
  });
});

describe("lireAccuseReception — la lecture en base", () => {
  const CANDIDATURE = { id: "app-1", email: "maxime@exemple-temoin.fr", submittedAt: DEPOT };

  it("cherche le lien exact OU l'adresse du candidat dans la fenêtre, gabarits d'accusé seulement", async () => {
    findManyMock.mockResolvedValue([ligne({ id: "l" })]);
    const r = await lireAccuseReception(CANDIDATURE, { role: ROLE_OUVRANT });
    expect(r?.etat).toBe("envoye");

    const arg = findManyMock.mock.calls[0]?.[0] as {
      where: { template: { in: string[] }; OR: Array<Record<string, unknown>> };
    };
    expect(arg.where.template.in).toContain("candidature-recue");
    expect(arg.where.OR).toContainEqual({ entityType: ENTITE_CANDIDATURE, entityId: "app-1" });
    expect(JSON.stringify(arg.where.OR)).toContain("maxime@exemple-temoin.fr");
  });

  it("aucune ligne : rend « absent », pas null", async () => {
    findManyMock.mockResolvedValue([]);
    const r = await lireAccuseReception(CANDIDATURE, { role: ROLE_OUVRANT });
    expect(r?.etat).toBe("absent");
  });

  it("adresse indéchiffrable : ne cherche QUE le lien exact (jamais un OR sur une chaîne vide)", async () => {
    findManyMock.mockResolvedValue([]);
    await lireAccuseReception({ ...CANDIDATURE, email: "" }, { role: ROLE_OUVRANT });
    const arg = findManyMock.mock.calls[0]?.[0] as { where: { OR: unknown[] } };
    expect(arg.where.OR).toEqual([{ entityType: ENTITE_CANDIDATURE, entityId: "app-1" }]);
  });

  it.skipIf(ROLE_FERME === undefined)(
    "un rôle qui n'ouvre pas le dossier n'obtient RIEN, sans lire la base",
    async () => {
      const r = await lireAccuseReception(CANDIDATURE, { role: ROLE_FERME });
      expect(r).toBeNull();
      expect(findManyMock).not.toHaveBeenCalled();
    },
  );

  it("rôle inconnu : refusé par défaut", async () => {
    const r = await lireAccuseReception(CANDIDATURE, { role: "inconnu" });
    expect(r).toBeNull();
  });
});

describe("le câblage — l'accusé est enfilé AVEC le lien exact", () => {
  /**
   * Garde de câblage, lue dans la source : sans l'entité liée à l'enfilage,
   * la lecture retombe sur l'adresse et l'heure pour TOUTES les candidatures
   * futures — et rien d'autre ne rougirait. Même doctrine que la garde de
   * `api/zeptomail/webhook/route.spec.ts`, qui exige l'appel du battement.
   */
  it("`candidature-recue` porte entityType JobApplication et l'id de la candidature", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("src/features/job-application/actions.ts", "utf8");
    const appel = source.slice(source.indexOf('"candidature-recue"'));
    const fin = appel.indexOf(");");
    const argumentsDeLAppel = appel.slice(0, fin);
    expect(argumentsDeLAppel).toContain(`entityType: "${ENTITE_CANDIDATURE}"`);
    expect(argumentsDeLAppel).toContain("entityId: app.id");
  });
});
