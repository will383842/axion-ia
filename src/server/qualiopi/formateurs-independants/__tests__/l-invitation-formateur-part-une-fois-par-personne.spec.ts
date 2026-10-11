/**
 * L-INV — l'invitation automatique (F1), ses rappels (S1) et le rattrapage (F55).
 * Une base factice en mémoire : chaque table répond à ses filtres réels.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Cand {
  id: string;
  email: string;
  emailHash: string | null;
  firstName: string;
  lastName: string;
  status: string;
  origine: string;
  submittedAt: Date;
  offerTitleSnap: string | null;
  natureCollaboration: string | null;
  invitationFormateurAt: Date | null;
  rattrapageAt: Date | null;
  clotureSansSuiteAt: Date | null;
  trainerId: string | null;
  offer: null;
}
const base = {
  candidatures: [] as Cand[],
  rdv: [] as Array<{ linkedJobApplicationId: string | null }>,
  demandes: [] as Array<{ contactEmailHash: string; calendlyEvents: Array<{ id: string }> }>,
  reponses: [] as Array<{ applicationId: string; receivedAt: Date }>,
  reponsesFormateur: [] as Array<{ candidatureId: string; recuLe: Date }>,
  fiches: [] as Array<{ candidatureId: string; verificationsRegistre: Array<{ verdict: string }> }>,
  oppositions: [] as Array<{ emailHash: string }>,
  rebonds: [] as Array<{ recipient: string }>,
};
const updateMany = vi.fn(async (a: { where: { id: string }; data: Record<string, Date> }) => {
  const c = base.candidatures.find((x) => x.id === a.where.id);
  if (c) Object.assign(c, a.data);
  return { count: c ? 1 : 0 };
});

function dans(v: Date, b?: { gte?: Date; lte?: Date; lt?: Date }): boolean {
  if (!b) return true;
  if (b.gte && v < b.gte) return false;
  if (b.lte && v > b.lte) return false;
  if (b.lt && v >= b.lt) return false;
  return true;
}
vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobApplication: {
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        if (where.emailHash) {
          const ins = (where.emailHash as { in: string[] }).in;
          return base.candidatures.filter((c) => c.emailHash && ins.includes(c.emailHash));
        }
        return base.candidatures.filter((c) => {
          for (const k of [
            "invitationFormateurAt",
            "rattrapageAt",
            "clotureSansSuiteAt",
          ] as const) {
            if (where[k] === null && c[k] !== null) return false;
            if (where[k] && typeof where[k] === "object") {
              if (!c[k] || !dans(c[k]!, where[k] as { gte?: Date; lte?: Date })) return false;
            }
          }
          if (where.status && c.status !== where.status) return false;
          if (where.origine && c.origine !== where.origine) return false;
          if (where.submittedAt && !dans(c.submittedAt, where.submittedAt as { gte?: Date }))
            return false;
          return true;
        });
      }),
      updateMany: (a: never) => updateMany(a),
    },
    calendlyEvent: { findMany: vi.fn(async () => base.rdv) },
    submission: { findMany: vi.fn(async () => base.demandes) },
    jobApplicationInboundReply: { findMany: vi.fn(async () => base.reponses) },
    reponseEntranteFormateur: { findMany: vi.fn(async () => base.reponsesFormateur) },
    trainer: { findMany: vi.fn(async () => base.fiches) },
    emailOpposition: { findMany: vi.fn(async () => base.oppositions) },
    emailLog: { findMany: vi.fn(async () => base.rebonds) },
    emailOutbox: { findMany: vi.fn(async () => []) },
  },
}));
const suiviEchange = { valeur: true };
vi.mock("../etats-entree", () => ({
  lireEtatsEntree: async () => ({ suivi_echange: suiviEchange.valeur }),
  lireEtatsFormateurs: async () => ({}),
  invitationAutoFormateursAllumee: async () => false,
}));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string) => v.replace(/^enc:/, "") }));

import { decisionCampagne } from "@/lib/relances/campagne";
import {
  CAMPAGNE_S1,
  envoyerRattrapage,
  listerRattrapage,
  lireFaitsS1,
  passerInvitationsFormateurs,
} from "../invitation-formateurs";
import { motifRetenueInvitationFormateur } from "../invitation-formateurs-faits";

const MAINTENANT = new Date("2026-10-20T10:00:00.000Z");
const MIN = 60_000;
let n = 0;
function cand(o: Partial<Cand> = {}): Cand {
  n += 1;
  const id = `0b7c3a52-4a0e-4d4c-9f43-${String(n).padStart(12, "0")}`;
  return {
    id,
    email: `enc:p${n}@example.com`,
    emailHash: `h${n}`,
    firstName: "enc:Camille",
    lastName: "enc:Martin",
    status: "new",
    origine: "formulaire",
    submittedAt: new Date(MAINTENANT.getTime() - 16 * MIN),
    offerTitleSnap: "Formateur IA freelance",
    natureCollaboration: "freelance",
    invitationFormateurAt: null,
    rattrapageAt: null,
    clotureSansSuiteAt: null,
    trainerId: null,
    offer: null,
    ...o,
  };
}
const allume = async () => true;
// Interrupteurs allumés le 01/10 ; aucun F1 dans l'heure.
const ALLUME_LE = new Date("2026-10-01T00:00:00Z");
const etat = {
  allumeLe: async () => ALLUME_LE,
  envoyesDerniereHeure: async () => 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  n = 0;
  base.candidatures = [];
  base.rdv = [];
  base.demandes = [];
  base.reponses = [];
  base.reponsesFormateur = [];
  base.fiches = [];
  base.oppositions = [];
  base.rebonds = [];
  suiviEchange.valeur = true;
});

describe("F1 — le balayage", () => {
  it("interrupteurs coupés : rien n'est lu ni envoyé", async () => {
    base.candidatures = [cand()];
    const envoyer = vi.fn();
    const b = await passerInvitationsFormateurs(MAINTENANT, {
      allume: async () => false,
      ...etat,
      envoyer,
    });
    expect(b.allume).toBe(false);
    expect(envoyer).not.toHaveBeenCalled();
  });

  it("15 min après la candidature : F1, avec le lien marqué fa-<id>, puis la date d'invitation", async () => {
    const c = cand();
    base.candidatures = [c, cand({ submittedAt: new Date(MAINTENANT.getTime() - 10 * MIN) })];
    const envoyer = vi.fn().mockResolvedValue("envoye");
    const b = await passerInvitationsFormateurs(MAINTENANT, { allume, ...etat, envoyer });
    expect(b.invitees).toBe(1);
    const e = envoyer.mock.calls[0]![0];
    expect(e).toMatchObject({
      gabarit: "formateur-invitation-echange",
      destinataire: "p1@example.com",
      entityType: "JobApplication",
      entityId: c.id,
      jobId: "fi-invit-h1",
    });
    expect(e.priority).toBeUndefined();
    expect(String(e.payload.lien)).toMatch(
      new RegExp(`formateur-independant\\?depuis=fa-${c.id}$`),
    );
    expect(c.invitationFormateurAt).toEqual(MAINTENANT);
  });

  it("une invitation par personne : deux candidatures à la même adresse → un seul F1", async () => {
    base.candidatures = [cand({ emailHash: "meme" }), cand({ emailHash: "meme" })];
    const envoyer = vi.fn().mockResolvedValue("envoye");
    await passerInvitationsFormateurs(MAINTENANT, { allume, ...etat, envoyer });
    expect(envoyer).toHaveBeenCalledTimes(1);
    // Le passage suivant ne réinvite pas la sœur.
    await passerInvitationsFormateurs(MAINTENANT, { allume, ...etat, envoyer });
    expect(envoyer).toHaveBeenCalledTimes(1);
  });

  it("registre rouge, réservation (même apporteur), opposition, salarié : aucune invitation", async () => {
    const rouge = cand();
    const reserve = cand();
    const apporteur = cand();
    const oppose = cand();
    base.candidatures = [
      rouge,
      reserve,
      apporteur,
      oppose,
      cand({ natureCollaboration: "salarie" }),
    ];
    base.fiches = [{ candidatureId: rouge.id, verificationsRegistre: [{ verdict: "rouge" }] }];
    base.rdv = [{ linkedJobApplicationId: reserve.id }];
    base.demandes = [{ contactEmailHash: apporteur.emailHash!, calendlyEvents: [{ id: "e" }] }];
    base.oppositions = [{ emailHash: oppose.emailHash! }];
    const envoyer = vi.fn().mockResolvedValue("envoye");
    const b = await passerInvitationsFormateurs(MAINTENANT, { allume, ...etat, envoyer });
    expect(envoyer).not.toHaveBeenCalled();
    expect(b.ecartees).toMatchObject({
      "registre-rouge": 1,
      "deja-reserve": 2,
      opposition: 1,
      "pas-freelance": 1,
    });
  });

  it("spontanée « Formateur IA indépendant » → invitée ; « Formateur » sans indice → jamais", async () => {
    base.candidatures = [
      cand({ natureCollaboration: null, offerTitleSnap: "Formateur IA indépendant" }),
      cand({ natureCollaboration: null, offerTitleSnap: "Formateur" }),
    ];
    const envoyer = vi.fn().mockResolvedValue("envoye");
    await passerInvitationsFormateurs(MAINTENANT, { allume, ...etat, envoyer });
    expect(envoyer).toHaveBeenCalledTimes(1);
    expect(envoyer.mock.calls[0]![0].entityId).toBe(base.candidatures[0]!.id);
  });

  it("texte non validé : rien n'est marqué, on retentera", async () => {
    const c = cand();
    base.candidatures = [c, cand()];
    const envoyer = vi.fn().mockResolvedValue("texte-non-valide");
    await passerInvitationsFormateurs(MAINTENANT, { allume, ...etat, envoyer });
    expect(envoyer).toHaveBeenCalledTimes(1);
    expect(c.invitationFormateurAt).toBeNull();
  });

  it("à l'allumage, seul ce qui arrive APRÈS est invité : le stock passe par le rattrapage", async () => {
    const avant = cand({ submittedAt: new Date(MAINTENANT.getTime() - 60 * MIN) });
    base.candidatures = [avant];
    const envoyer = vi.fn().mockResolvedValue("envoye");
    await passerInvitationsFormateurs(MAINTENANT, {
      allume,
      ...etat,
      allumeLe: async () => new Date(MAINTENANT.getTime() - 30 * MIN),
      envoyer,
    });
    expect(envoyer).not.toHaveBeenCalled();
  });

  it("budget horaire : jamais plus de 20 F1 dans l'heure, toutes passes confondues", async () => {
    base.candidatures = Array.from({ length: 10 }, () => cand());
    const envoyer = vi.fn().mockResolvedValue("envoye");
    await passerInvitationsFormateurs(MAINTENANT, {
      allume,
      ...etat,
      envoyesDerniereHeure: async () => 17,
      envoyer,
    });
    expect(envoyer).toHaveBeenCalledTimes(3);
  });

  it("état illisible (date d'allumage ou budget) : rien ne part", async () => {
    base.candidatures = [cand()];
    const envoyer = vi.fn();
    await passerInvitationsFormateurs(MAINTENANT, {
      allume,
      ...etat,
      allumeLe: async () => null,
      envoyer,
    });
    await passerInvitationsFormateurs(MAINTENANT, {
      allume,
      ...etat,
      envoyesDerniereHeure: async () => null,
      envoyer,
    });
    expect(envoyer).not.toHaveBeenCalled();
  });

  it("refus définitif (adresse retenue) : close sans suite, jamais retentée", async () => {
    const c = cand();
    base.candidatures = [c];
    const envoyer = vi.fn().mockResolvedValue("retenu");
    await passerInvitationsFormateurs(MAINTENANT, { allume, ...etat, envoyer });
    expect(c.clotureSansSuiteAt).toEqual(MAINTENANT);
    await passerInvitationsFormateurs(MAINTENANT, { allume, ...etat, envoyer });
    expect(envoyer).toHaveBeenCalledTimes(1);
  });

  it("rebond dur connu ou réponse déjà échangée : aucune invitation", async () => {
    const morte = cand();
    const repondu = cand();
    base.candidatures = [morte, repondu];
    base.rebonds = [{ recipient: "P1@example.com" }];
    base.reponses = [{ applicationId: repondu.id, receivedAt: new Date("2026-10-19T10:00:00Z") }];
    const envoyer = vi.fn();
    const b = await passerInvitationsFormateurs(MAINTENANT, { allume, ...etat, envoyer });
    expect(envoyer).not.toHaveBeenCalled();
    expect(b.ecartees).toMatchObject({ "adresse-morte": 1, "deja-repondu": 1 });
  });

  it("plafond : 30 invitations par passage", async () => {
    base.candidatures = Array.from({ length: 35 }, () => cand());
    const envoyer = vi.fn().mockResolvedValue("envoye");
    const b = await passerInvitationsFormateurs(MAINTENANT, {
      allume,
      ...etat,
      envoyesDerniereHeure: async () => -100, // budget neutralisé : seul le plafond joue
      envoyer,
    });
    expect(envoyer).toHaveBeenCalledTimes(30);
    expect(b.plafondAtteint).toBe(true);
  });

  it("J+30 sans rien : close « sans suite », sans e-mail", async () => {
    const c = cand({
      submittedAt: new Date("2026-09-15T10:00:00Z"),
      invitationFormateurAt: new Date("2026-09-15T10:20:00Z"),
    });
    base.candidatures = [c];
    const envoyer = vi.fn();
    const b = await passerInvitationsFormateurs(MAINTENANT, { allume, ...etat, envoyer });
    expect(b.closes).toBe(1);
    expect(c.clotureSansSuiteAt).toEqual(MAINTENANT);
    expect(envoyer).not.toHaveBeenCalled();
  });
});

describe("S1 — les rappels au registre commun", () => {
  it("déclarée classe A, F2, sous l'interrupteur de l'invitation", () => {
    expect(CAMPAGNE_S1).toMatchObject({
      id: "invit-relance",
      gabarit: "formateur-invitation-relance",
      classe: "A",
      entityType: "JobApplication",
    });
    expect(CAMPAGNE_S1.interrupteurs[0]).toBe("invitation_auto");
    expect(CAMPAGNE_S1.regle).toMatchObject({ max: 2, silenceApresMs: 14 * 24 * 3600 * 1000 });
  });

  it("J+3 sans rien : un rappel ; réservation arrivée après l'invitation : arrêt ; réponse humaine : arrêt", async () => {
    const invit = new Date(MAINTENANT.getTime() - 3 * 24 * 3600 * 1000 - MIN);
    const libre = cand({ invitationFormateurAt: invit });
    const reserve = cand({ invitationFormateurAt: invit });
    const repondu = cand({ invitationFormateurAt: invit });
    const reponduAvant = cand({ invitationFormateurAt: invit });
    base.candidatures = [libre, reserve, repondu, reponduAvant];
    base.rdv = [{ linkedJobApplicationId: reserve.id }];
    base.reponses = [
      { applicationId: repondu.id, receivedAt: new Date(invit.getTime() + MIN) },
      { applicationId: reponduAvant.id, receivedAt: new Date(invit.getTime() - MIN) },
    ];
    const faits = await lireFaitsS1(MAINTENANT);
    const decision = (id: string) =>
      decisionCampagne({
        etat: faits.find((f) => f.entityId === id)!.etat,
        maintenant: MAINTENANT,
        regle: CAMPAGNE_S1.regle,
      });
    expect(decision(libre.id)).toMatchObject({ envoyer: true, etape: "j3" });
    expect(decision(reserve.id)).toMatchObject({ envoyer: false, motif: "action-faite" });
    expect(decision(repondu.id)).toMatchObject({ envoyer: false, motif: "reponse-humaine" });
    // Une réponse ANTÉRIEURE à l'invitation n'arrête rien.
    expect(decision(reponduAvant.id)).toMatchObject({ envoyer: true });
  });

  it("suivi de l'échange coupé : aucun rappel (S1 lit aussi le registre de l'entrée)", async () => {
    base.candidatures = [cand({ invitationFormateurAt: new Date("2026-10-16T10:00:00Z") })];
    suiviEchange.valeur = false;
    expect(await lireFaitsS1(MAINTENANT)).toEqual([]);
  });

  it("« J'ai répondu ailleurs » arrête les rappels", async () => {
    const invit = new Date(MAINTENANT.getTime() - 4 * 24 * 3600 * 1000);
    const c = cand({ invitationFormateurAt: invit });
    base.candidatures = [c];
    base.reponsesFormateur = [{ candidatureId: c.id, recuLe: new Date(invit.getTime() + MIN) }];
    const [f] = await lireFaitsS1(MAINTENANT);
    expect(f!.etat.reponseHumaine).toBe(true);
  });

  it("au départ, un rappel déjà en file est retenu si la personne a réservé entre-temps", async () => {
    const c = cand({ invitationFormateurAt: new Date("2026-10-15T10:00:00Z") });
    base.candidatures = [c];
    const { prisma } = await import("@/lib/prisma");
    (prisma.jobApplication as unknown as { findUnique: unknown }).findUnique = vi.fn(async () => c);
    expect(await motifRetenueInvitationFormateur(c.id, "formateur-invitation-relance")).toBeNull();
    base.rdv = [{ linkedJobApplicationId: c.id }];
    expect(await motifRetenueInvitationFormateur(c.id, "formateur-invitation-relance")).toBe(
      "échange déjà réservé",
    );
  });
});

describe("F55 — le rattrapage unique du stock", () => {
  it("candidature de 5 jours, jamais invitée : dans la liste ; rien ne part sans la liste vue", async () => {
    const vieille = cand({ submittedAt: new Date("2026-10-15T10:00:00Z") });
    const recente = cand(); // dans la fenêtre du balayage : pas au rattrapage
    const avantLe9 = cand({ submittedAt: new Date("2026-10-05T10:00:00Z") });
    base.candidatures = [vieille, recente, avantLe9];
    const liste = await listerRattrapage(MAINTENANT, async () => new Date("2026-10-18T00:00:00Z"));
    expect(liste.lignes.map((l) => l.candidatureId)).toEqual([vieille.id]);
    expect(liste.lignes[0]!.nom).toBe("Camille M.");

    const envoyer = vi.fn().mockResolvedValue("envoye");
    expect(
      await envoyerRattrapage(MAINTENANT, "0".repeat(64), {
        allume,
        ...etat,
        allumeLe: async () => new Date("2026-10-18T00:00:00Z"),
        envoyer,
      }),
    ).toEqual({
      ok: false,
      motif: "liste-changee",
    });
    expect(envoyer).not.toHaveBeenCalled();

    const r = await envoyerRattrapage(MAINTENANT, liste.empreinte, {
      allume,
      ...etat,
      allumeLe: async () => new Date("2026-10-18T00:00:00Z"),
      envoyer,
    });
    expect(r).toMatchObject({ ok: true, envoyes: 1 });
    expect(envoyer.mock.calls[0]![0]).toMatchObject({
      gabarit: "formateur-invitation-rattrapage",
      priority: 10,
      jobId: `fi-rattrapage-${vieille.emailHash}`,
    });
    expect(vieille.rattrapageAt).toEqual(MAINTENANT);
    // Une seule fois : la liste suivante est vide.
    expect(
      (await listerRattrapage(MAINTENANT, async () => new Date("2026-10-18T00:00:00Z"))).lignes,
    ).toEqual([]);
  });

  it("interrupteurs coupés : rien ne part", async () => {
    const envoyer = vi.fn();
    expect(
      await envoyerRattrapage(MAINTENANT, "x", { allume: async () => false, ...etat, envoyer }),
    ).toEqual({
      ok: false,
      motif: "coupe",
    });
  });
});
