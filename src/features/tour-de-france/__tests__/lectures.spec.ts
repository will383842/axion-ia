import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  groupBy: vi.fn(),
  findMany: vi.fn(),
  rdv: vi.fn(),
  crm: vi.fn(),
  decrypt: vi.fn((v: string) => v.replace(/^enc:/, "")),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tourDemande: { groupBy: m.groupBy, findMany: m.findMany },
    calendlyEvent: { findMany: m.rdv },
    crmSyncOutbox: { findMany: m.crm },
  },
}));
vi.mock("@/lib/pii-crypto", () => ({
  decryptPii: m.decrypt,
  encryptPii: (v: string) => `enc:${v}`,
}));

import { hashEmailForLookup } from "@/lib/security/email-hash";
import {
  compteurParVille,
  etatsCrm,
  lireCompteursPublics,
  lireDemandesConsole,
  lireFicheVille,
} from "../lectures";

const ligne = (id: string, email: string, extra: Record<string, unknown> = {}) => ({
  id,
  nom: `enc:Personne ${id}`,
  email: `enc:${email}`,
  telephone: "enc:0612345678",
  emailHash: hashEmailForLookup(email),
  villeSaisie: "lyon",
  villeCle: "lyon",
  villeNom: "Lyon",
  statut: "recue",
  rattachement: "sans_fiche",
  clientId: null,
  fichesProches: null,
  compte: true,
  doublonDeId: null,
  depuis: null,
  creeLe: new Date("2026-10-27T10:00:00Z"),
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  m.decrypt.mockImplementation((v: string) => v.replace(/^enc:/, ""));
  m.rdv.mockResolvedValue([]);
  m.crm.mockResolvedValue([]);
});

describe("lectures : une base qui échoue rend une liste vide, jamais une page en erreur", () => {
  it("lireCompteursPublics", async () => {
    m.groupBy.mockRejectedValue(new Error("table absente"));
    await expect(lireCompteursPublics()).resolves.toEqual([]);
  });

  it("compteurParVille", async () => {
    m.groupBy.mockRejectedValue(new Error("table absente"));
    await expect(compteurParVille()).resolves.toEqual([]);
  });

  it("lireDemandesConsole", async () => {
    m.findMany.mockRejectedValue(new Error("table absente"));
    const r = await lireDemandesConsole();
    expect(r.demandes).toEqual([]);
    expect(r.tronquee).toBe(false);
  });
});

describe("lectures : le compteur public", () => {
  it("compte les demandes comptées et écarte celles que l'équipe a écartées", async () => {
    m.groupBy.mockResolvedValue([{ villeCle: "lyon", villeNom: "Lyon", _count: { _all: 4 } }]);
    const r = await lireCompteursPublics();
    expect(r).toEqual([{ villeCle: "lyon", villeNom: "Lyon", total: 4 }]);
    const arg = m.groupBy.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    expect(arg.where).toEqual({ compte: true, statut: { not: "ecartee" } });
  });
});

describe("lectures : la console", () => {
  it("déchiffre la personne et calcule « rendez-vous pris » par l'empreinte de l'e-mail", async () => {
    m.findMany.mockResolvedValue([ligne("a", "alice@exemple.fr"), ligne("b", "bob@exemple.fr")]);
    m.rdv.mockResolvedValue([{ inviteeEmail: "Alice@Exemple.fr" }]);
    const r = await lireDemandesConsole();
    expect(r.demandes.map((d) => [d.nom, d.statut])).toEqual([
      ["Personne a", "rdv_pris"],
      ["Personne b", "recue"],
    ]);
    expect(r.demandes[0]?.email).toBe("alice@exemple.fr");
    expect(r.rapprochementIndisponible).toBe(false);
    const rdv = m.rdv.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
      take?: unknown;
    };
    expect(rdv.where["typeRendezVous"]).toBe("tour_de_france_ia");
    expect(rdv.where["status"]).toEqual({ not: "canceled" });
    // Les rendez-vous sont cherchés POUR les adresses affichées, sans plafond arbitraire.
    expect(rdv.where["inviteeEmail"]).toEqual({ in: ["alice@exemple.fr", "bob@exemple.fr"] });
    expect(rdv).not.toHaveProperty("take");
  });

  it("ne cherche aucun rendez-vous pour une liste vide ou une demande vidée à la demande de la personne", async () => {
    m.findMany.mockResolvedValue([]);
    await lireDemandesConsole();
    expect(m.rdv).not.toHaveBeenCalled();
    m.findMany.mockResolvedValue([ligne("x", "efface@exemple.fr", { emailHash: null })]);
    const r = await lireDemandesConsole();
    expect(m.rdv).not.toHaveBeenCalled();
    expect(r.rapprochementIndisponible).toBe(false);
  });

  it("une adresse illisible n'empêche pas de chercher les autres rendez-vous", async () => {
    m.findMany.mockResolvedValue([ligne("a", "alice@exemple.fr"), ligne("b", "bob@exemple.fr")]);
    m.decrypt.mockImplementation((v: string) => {
      if (v === "enc:alice@exemple.fr") throw new Error("illisible");
      return v.replace(/^enc:/, "");
    });
    await lireDemandesConsole();
    const rdv = m.rdv.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    expect(rdv.where["inviteeEmail"]).toEqual({ in: ["bob@exemple.fr"] });
  });

  it("une panne de la lecture des rendez-vous est dite, sans casser la liste", async () => {
    m.findMany.mockResolvedValue([ligne("a", "alice@exemple.fr")]);
    m.rdv.mockRejectedValue(new Error("calendly_events"));
    const r = await lireDemandesConsole();
    expect(r.demandes).toHaveLength(1);
    expect(r.demandes[0]?.statut).toBe("recue");
    expect(r.demandes[0]?.telephoneVisio).toBeNull();
    expect(r.rapprochementIndisponible).toBe(true);
  });

  it("place le téléphone de la visio sur la demande de même empreinte d'e-mail, sans écriture", async () => {
    m.findMany.mockResolvedValue([
      ligne("a", "alice@exemple.fr", { telephone: "enc:" }),
      ligne("b", "bob@exemple.fr"),
    ]);
    m.rdv.mockResolvedValue([
      { inviteeEmail: "Alice@Exemple.fr", inviteePhone: "  " },
      { inviteeEmail: "Alice@Exemple.fr", inviteePhone: "+33611223344" },
      { inviteeEmail: "Alice@Exemple.fr", inviteePhone: "+33699999999" },
    ]);
    const r = await lireDemandesConsole();
    expect(r.demandes.map((d) => d.telephoneVisio)).toEqual(["+33611223344", null]);
    const rdv = m.rdv.mock.calls[0]?.[0] as { select: unknown; orderBy: unknown };
    expect(rdv.select).toEqual({ inviteeEmail: true, inviteePhone: true });
    expect(rdv.orderBy).toEqual({ startTime: "desc" });
  });

  it("une demande effacée (effacee_rgpd) ne reçoit aucun téléphone de visio", async () => {
    m.findMany.mockResolvedValue([ligne("a", "alice@exemple.fr", { statut: "effacee_rgpd" })]);
    m.rdv.mockResolvedValue([{ inviteeEmail: "alice@exemple.fr", inviteePhone: "+33611223344" }]);
    const r = await lireDemandesConsole();
    expect(r.demandes[0]?.telephoneVisio).toBeNull();
  });

  it("filtre par statut affiché et par ville", async () => {
    m.findMany.mockResolvedValue([
      ligne("a", "alice@exemple.fr"),
      ligne("b", "bob@exemple.fr", { statut: "ecartee" }),
    ]);
    const r = await lireDemandesConsole({ statut: "ecartee", ville: "lyon" });
    expect(r.demandes.map((d) => d.id)).toEqual(["b"]);
    const arg = m.findMany.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    // Le filtre de statut est dans la requête : il s'applique AVANT le plafond de 500 lignes.
    expect(arg.where).toEqual({ villeCle: "lyon", statut: { in: ["ecartee"] } });
  });

  it("« rendez-vous pris » vient d'une demande reçue ou relancée : les deux sont lues", async () => {
    m.findMany.mockResolvedValue([]);
    await lireDemandesConsole({ statut: "rdv_pris" });
    const arg = m.findMany.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    expect(arg.where).toEqual({ statut: { in: ["recue", "relancee_main"] } });
  });

  it("sans filtre, aucune condition de statut ni de ville", async () => {
    m.findMany.mockResolvedValue([]);
    await lireDemandesConsole();
    const arg = m.findMany.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    expect(arg.where).toEqual({});
  });

  it("une valeur chiffrée illisible s'affiche « illisible », sans lever", async () => {
    m.findMany.mockResolvedValue([ligne("a", "alice@exemple.fr")]);
    m.decrypt.mockImplementation(() => {
      throw new Error("clé absente");
    });
    const r = await lireDemandesConsole();
    expect(r.demandes[0]?.nom).toBe("illisible");
  });
});

describe("lectures : le compteur de la console", () => {
  it("regroupe par ville : toutes les demandes, et celles qui comptent", async () => {
    m.groupBy.mockResolvedValue([
      { villeCle: "lyon", villeNom: "Lyon", compte: true, _count: { _all: 3 } },
      { villeCle: "lyon", villeNom: "Lyon", compte: false, _count: { _all: 2 } },
      { villeCle: "?annecy", villeNom: null, compte: true, _count: { _all: 1 } },
    ]);
    const r = await compteurParVille();
    expect(r[0]).toEqual({ villeCle: "lyon", ville: "Lyon", demandes: 5, comptees: 3 });
    expect(r[1]).toEqual({ villeCle: "?annecy", ville: "annecy", demandes: 1, comptees: 1 });
  });
});

describe("lectures : la fiche d'une ville", () => {
  it("base en panne : une fiche vide, sans exception", async () => {
    m.findMany.mockRejectedValue(new Error("table absente"));
    m.rdv.mockRejectedValue(new Error("calendly_events"));
    const f = await lireFicheVille("lyon");
    expect(f.personnes).toEqual([]);
    expect(f.visiosSansDemande).toEqual([]);
    expect(f.comptees).toBe(0);
    expect(f.ouverte).toBe(false);
    expect(f.visiosIndisponibles).toBe(true);
  });

  it("lit les demandes de la ville et les visios du Tour (tous statuts), sans écriture", async () => {
    m.findMany.mockResolvedValue([ligne("a", "alice@exemple.fr")]);
    m.rdv.mockResolvedValue([
      {
        id: "v1",
        inviteeEmail: "Alice@Exemple.fr",
        startTime: new Date("2099-01-01T09:00:00Z"),
        status: "active",
        rawPayload: {
          invitee: {
            questions_and_answers: [
              { question: "Quel est votre secteur d'activité ?", answer: "Commerce" },
            ],
          },
        },
      },
    ]);
    const f = await lireFicheVille("lyon");
    expect(f.visiosIndisponibles).toBe(false);
    expect(f.personnes[0]?.demande.statut).toBe("rdv_pris");
    expect(f.personnes[0]?.visio?.profil?.secteur).toBe("Commerce");
    expect(f.visiosPrises).toBe(1);
    const demandes = m.findMany.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    expect(demandes.where).toEqual({ villeCle: "lyon" });
    const visios = m.rdv.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
      take: number;
      orderBy: unknown;
      select: Record<string, unknown>;
    };
    expect(visios.where).toEqual({ typeRendezVous: "tour_de_france_ia" });
    expect(visios.take).toBe(300);
    expect(visios.orderBy).toEqual({ startTime: "desc" });
    expect(visios.select).toEqual({
      id: true,
      inviteeEmail: true,
      startTime: true,
      status: true,
      rawPayload: true,
    });
  });

  it("une panne des visios seules laisse les demandes et le dit", async () => {
    m.findMany.mockResolvedValue([ligne("a", "alice@exemple.fr")]);
    m.rdv.mockRejectedValue(new Error("calendly_events"));
    const f = await lireFicheVille("lyon");
    expect(f.personnes).toHaveLength(1);
    expect(f.visiosIndisponibles).toBe(true);
  });
});

describe("lectures : l'état d'envoi au CRM Pro", () => {
  it("ne sélectionne jamais le corps ni l'erreur (données personnelles en clair)", async () => {
    m.crm.mockResolvedValue([]);
    await etatsCrm(["site:tour-demande:a"]);
    const arg = m.crm.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
      select: Record<string, unknown>;
    };
    expect(arg.where).toEqual({ subjectRef: { in: ["site:tour-demande:a"] } });
    expect(arg.select).toEqual({
      subjectRef: true,
      status: true,
      crmResult: true,
      sentAt: true,
      attempts: true,
    });
    expect(arg.select).not.toHaveProperty("payload");
    expect(arg.select).not.toHaveProperty("lastError");
  });

  it("aucune référence : aucune requête ; panne : null, sans exception", async () => {
    await expect(etatsCrm([])).resolves.toEqual([]);
    expect(m.crm).not.toHaveBeenCalled();
    m.crm.mockRejectedValue(new Error("crm_sync_outbox"));
    await expect(etatsCrm(["site:tour-demande:a"])).resolves.toBeNull();
  });

  it("la fiche lit les références de la demande et de chaque visio, et place l'état par personne", async () => {
    m.findMany.mockResolvedValue([ligne("a", "alice@exemple.fr"), ligne("b", "bob@exemple.fr")]);
    m.rdv.mockResolvedValue([
      {
        id: "v1",
        inviteeEmail: "alice@exemple.fr",
        startTime: new Date("2099-01-01T09:00:00Z"),
        status: "active",
        rawPayload: {},
      },
    ]);
    m.crm.mockResolvedValue([
      {
        subjectRef: "site:tour-demande:a",
        status: "sent",
        crmResult: "pending_match",
        sentAt: new Date("2026-10-28T08:00:00Z"),
        attempts: 1,
      },
      {
        subjectRef: "site:calendly_event:v1",
        status: "failed",
        crmResult: null,
        sentAt: null,
        attempts: 3,
      },
    ]);
    const f = await lireFicheVille("lyon");
    const arg = m.crm.mock.calls[0]?.[0] as { where: { subjectRef: { in: string[] } } };
    expect(arg.where.subjectRef.in).toEqual([
      "site:tour-demande:a",
      "site:tour-demande:b",
      "site:calendly_event:v1",
    ]);
    expect(f.personnes[0]?.crmDemande.statut).toBe("sent");
    expect(f.personnes[0]?.crmDemande.crmResult).toBe("pending_match");
    expect(f.personnes[0]?.crmVisio?.statut).toBe("failed");
    expect(f.personnes[1]?.crmDemande.statut).toBe("absente");
  });

  it("une panne de l'outbox laisse la fiche et dit « état indisponible »", async () => {
    m.findMany.mockResolvedValue([ligne("a", "alice@exemple.fr")]);
    m.crm.mockRejectedValue(new Error("crm_sync_outbox"));
    const f = await lireFicheVille("lyon");
    expect(f.personnes).toHaveLength(1);
    expect(f.personnes[0]?.crmDemande.statut).toBe("indisponible");
  });
});

describe("lectures : la fiche d'une ville, rendez-vous pris et visios d'une autre ville", () => {
  it("« rendez-vous pris » vient des adresses affichées, pas des 300 visios les plus récentes", async () => {
    m.findMany.mockResolvedValue([ligne("a", "alice@exemple.fr")]);
    // La liste des 300 visios n'a pas la visio d'Alice ; la recherche par adresse, si.
    m.rdv.mockImplementation(async (arg: { where: Record<string, unknown> }) =>
      arg.where["inviteeEmail"] !== undefined
        ? [{ inviteeEmail: "Alice@Exemple.fr", inviteePhone: null }]
        : [],
    );
    const f = await lireFicheVille("lyon");
    expect(f.personnes[0]?.demande.statut).toBe("rdv_pris");
    const parAdresse = m.rdv.mock.calls
      .map((c) => c[0] as { where: Record<string, unknown> })
      .find((a) => a.where["inviteeEmail"] !== undefined);
    expect(parAdresse?.where["inviteeEmail"]).toEqual({ in: ["alice@exemple.fr"] });
    expect(parAdresse?.where["status"]).toEqual({ not: "canceled" });
  });

  it("une panne de cette recherche se rabat sur les visios déjà lues", async () => {
    m.findMany.mockResolvedValue([ligne("a", "alice@exemple.fr")]);
    m.rdv.mockImplementation(async (arg: { where: Record<string, unknown> }) => {
      if (arg.where["inviteeEmail"] !== undefined) throw new Error("calendly_events");
      return [
        {
          id: "v1",
          inviteeEmail: "alice@exemple.fr",
          startTime: new Date("2099-01-01T09:00:00Z"),
          status: "active",
          rawPayload: {},
        },
      ];
    });
    const f = await lireFicheVille("lyon");
    expect(f.personnes[0]?.demande.statut).toBe("rdv_pris");
  });

  it("une visio qui déclare la ville mais dont l'adresse est celle d'une demande d'une autre ville n'est pas orpheline", async () => {
    // La ville lue (lyon) n'a aucune demande ; l'adresse de la visio est celle d'une demande ailleurs.
    m.findMany.mockImplementation(async (arg: { select: Record<string, unknown> }) =>
      Object.keys(arg.select).length === 1
        ? [{ emailHash: hashEmailForLookup("zoe@exemple.fr") }]
        : [],
    );
    m.rdv.mockResolvedValue([
      {
        id: "v7",
        inviteeEmail: "zoe@exemple.fr",
        startTime: new Date("2099-01-01T09:00:00Z"),
        status: "active",
        rawPayload: {
          invitee: {
            questions_and_answers: [{ question: "Ville de l'entreprise", answer: "Lyon" }],
          },
        },
      },
    ]);
    const f = await lireFicheVille("lyon");
    expect(f.visiosSansDemande).toEqual([]);
    expect(f.visiosPrises).toBe(0);
  });
});
