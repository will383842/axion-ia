// @vitest-environment node

/**
 * LES DOSSIERS EN SOMMEIL — ce que la requête doit ramener, et ce qu'elle ne
 * doit JAMAIS laisser sortir.
 *
 * ## Les deux pannes possibles, et elles ne se ressemblent pas
 *
 * **La requête tranche à la place de la règle.** Le pré-filtre SQL doit être un
 * SUR-ENSEMBLE : borner sur `submittedAt` et sur les statuts ouverts, rien de
 * plus. Le jour où une clause `WHERE` déciderait aussi, il y aurait deux
 * écritures de la règle — et c'est toujours la seconde qui dérive. Ce fichier
 * lit les arguments réellement passés à Prisma, pas le résultat : c'est le seul
 * niveau où « la requête a essayé de décider » s'observe.
 *
 * **L'identité fuit.** La même fonction sert l'écran (où un recruteur a le
 * droit de voir un nom) et le cron (qui écrit sur Telegram). Un masquage qui
 * dépendrait de l'appelant serait faux le jour où un appelant l'oublie. Le
 * contre-témoin est ici : le rôle `reader`, et l'absence de rôle.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

/** Les arguments réellement passés à Prisma — la requête est le sujet du test. */
const requetes: Array<Record<string, unknown>> = [];
let lignesRendues: unknown[] = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobApplication: {
      findMany: vi.fn(async (args: Record<string, unknown>) => {
        requetes.push(args);
        return lignesRendues;
      }),
    },
  },
}));

// Le déchiffrement est l'identité en test : ce fichier ne teste pas la crypto.
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string) => v }));

const notifie: unknown[] = [];
vi.mock("@/server/notifications", () => ({
  notify: vi.fn(async (e: unknown) => {
    notifie.push(e);
  }),
}));

const { listerDossiersEnSommeil, signalerDossiersEnSommeil, PLAFOND_EXAMEN } =
  await import("../dossiers-en-sommeil");
const { SEUIL_LE_PLUS_COURT_JOURS, SEUIL_SANS_ACTIVITE_JOURS, SEUIL_SANS_REPONSE_JOURS } =
  await import("@/content/recrutement/oubli");
const { STATUTS_OUVERTS } = await import("@/content/recrutement/statuts");

const MAINTENANT = new Date("2026-09-03T12:00:00.000Z");
const JOUR = 24 * 60 * 60 * 1000;
const ilYA = (j: number) => new Date(MAINTENANT.getTime() - j * JOUR);

function ligne(p: Record<string, unknown> = {}) {
  return {
    id: "a1",
    offerTitleSnap: "Formateur IA",
    status: "reviewing",
    submittedAt: ilYA(SEUIL_SANS_REPONSE_JOURS + 1),
    firstResponseAt: null,
    lastActivityAt: null,
    firstName: "Camille",
    lastName: "Dupont",
    ...p,
  };
}

beforeEach(() => {
  requetes.length = 0;
  notifie.length = 0;
  lignesRendues = [];
});

describe("la requête BORNE, elle ne décide pas", () => {
  it("ne filtre que sur les statuts ouverts et une date de dépôt", async () => {
    lignesRendues = [];
    await listerDossiersEnSommeil(MAINTENANT, "admin");

    const where = requetes[0]!["where"] as Record<string, unknown>;
    // 🔴 Exactement DEUX clés. Une troisième signifierait que la requête a
    // commencé à trancher — et la règle pure ne serait plus la seule à décider.
    expect(Object.keys(where).sort()).toEqual(["status", "submittedAt"]);
    expect(where["status"]).toEqual({ in: [...STATUTS_OUVERTS] });
  });

  it("borne sur le PLUS COURT des deux seuils — jamais sur le plus long", async () => {
    lignesRendues = [];
    await listerDossiersEnSommeil(MAINTENANT, "admin");

    const where = requetes[0]!["where"] as { submittedAt: { lt: Date } };
    // Borner sur 21 jours écarterait en SQL les « jamais répondu » de 8 jours :
    // la règle ne les verrait jamais, et l'écran serait faux sans rien dire.
    expect(where.submittedAt.lt.getTime()).toBe(
      MAINTENANT.getTime() - SEUIL_LE_PLUS_COURT_JOURS * JOUR,
    );
    expect(SEUIL_LE_PLUS_COURT_JOURS).toBeLessThan(SEUIL_SANS_ACTIVITE_JOURS);
  });

  it("prend les PLUS ANCIENS d'abord — si le plafond tronque, il tronque les moins urgents", async () => {
    lignesRendues = [];
    await listerDossiersEnSommeil(MAINTENANT, "admin");
    expect(requetes[0]!["orderBy"]).toEqual([{ submittedAt: "asc" }]);
    expect(requetes[0]!["take"]).toBe(PLAFOND_EXAMEN);
  });

  it("écarte les lignes que la RÈGLE refuse, même si SQL les a ramenées", async () => {
    // Le pré-filtre est volontairement large : une ligne suivie hier en sort.
    lignesRendues = [
      ligne({ id: "vivant", firstResponseAt: ilYA(30), lastActivityAt: ilYA(1) }),
      ligne({ id: "oublie" }),
    ];
    const bilan = await listerDossiersEnSommeil(MAINTENANT, "admin");
    expect(bilan.dossiers.map((d) => d.id)).toEqual(["oublie"]);
  });
});

describe("le cloisonnement de l'identité", () => {
  it("rend le nom à un rôle qui a le droit d'ouvrir un dossier", async () => {
    lignesRendues = [ligne()];
    const bilan = await listerDossiersEnSommeil(MAINTENANT, "admin");
    expect(bilan.dossiers[0]!.contactName).toBe("Camille Dupont");
  });

  it("le MASQUE pour `reader` — le contre-témoin qui prouve que le test précédent teste quelque chose", async () => {
    lignesRendues = [ligne()];
    const bilan = await listerDossiersEnSommeil(MAINTENANT, "reader");
    expect(bilan.dossiers[0]!.contactName).toBeNull();
    // Le reste de la ligne reste : compteurs et chronologie doivent être justes
    // pour tout le monde. C'est l'identité qui est cloisonnée, pas le décompte.
    expect(bilan.dossiers[0]!.offerTitleSnap).toBe("Formateur IA");
  });

  it("le masque aussi SANS rôle — un cron n'en a pas, et c'est le cas par défaut", async () => {
    lignesRendues = [ligne()];
    const bilan = await listerDossiersEnSommeil(MAINTENANT, null);
    expect(bilan.dossiers[0]!.contactName).toBeNull();
  });
});

describe("l'alerte Telegram", () => {
  it("ne porte AUCUNE identité — ni nom, ni adresse", async () => {
    lignesRendues = [ligne()];
    await signalerDossiersEnSommeil(MAINTENANT);

    expect(notifie).toHaveLength(1);
    // 🔴 On sérialise TOUT l'événement et on cherche le nom dedans. Vérifier
    // l'absence d'un champ nommé « contactName » ne prouverait rien : le nom
    // pourrait revenir demain sous une autre clé, ou dans un texte composé.
    const serialise = JSON.stringify(notifie[0]);
    expect(serialise).not.toContain("Camille");
    expect(serialise).not.toContain("Dupont");
    expect(serialise).toContain("Formateur IA");
  });

  it("ne dit rien quand il n'y a rien à dire", async () => {
    lignesRendues = [];
    await signalerDossiersEnSommeil(MAINTENANT);
    // Une alerte quotidienne qui part même vide finit par être ignorée, et
    // c'est le jour où elle compte qu'on ne la lira pas.
    expect(notifie).toHaveLength(0);
  });

  it("déduplique par JOUR — un rejeu BullMQ ne renvoie pas l'alerte", async () => {
    lignesRendues = [ligne()];
    await signalerDossiersEnSommeil(MAINTENANT);
    const e = notifie[0] as { dedupKey: string };
    expect(e.dedupKey).toBe("job-applications-stale-2026-09-03");
  });
});
