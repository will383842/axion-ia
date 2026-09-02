import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * **LE CLOISONNEMENT DU DOSSIER DE CANDIDAT, MESURÉ SUR LE COMPORTEMENT.**
 *
 * La garde `server/auth/dossier-candidat-cloisonne.spec.ts` est SYNTAXIQUE :
 * elle vérifie que cette surface mentionne le prédicat commun et journalise.
 * Elle ne peut pas dire si le masquage marche — une analyse statique ne le peut
 * pas honnêtement. Ce fichier ferme l'autre moitié : il exécute la lecture avec
 * chaque rôle admin réel et regarde ce qui sort.
 *
 * ═══ CE QUE CE FICHIER EXISTE POUR EMPÊCHER ═══
 *
 * Le 2026-09-02, extraire `listApplications` de son action (lot 4a, lecture
 * sans session) lui a retiré `requireAdminRead()`, donc le prédicat. La Boîte
 * de réception a servi de nouveau le nom et l'adresse déchiffrés de chaque
 * candidat à TOUS les rôles — le défaut du 2026-08-25, rouvert quatre mois
 * plus tard par un refactor qui n'y touchait pas en apparence.
 */

const findManyMock = vi.fn();
const countMock = vi.fn();
const activityCreateMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobApplication: {
      findMany: (...a: unknown[]) => findManyMock(...a),
      count: (...a: unknown[]) => countMock(...a),
    },
    activityLog: { create: (...a: unknown[]) => activityCreateMock(...a) },
  },
}));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string) => `clair:${v}` }));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "203.0.113.7" }));

import { ROLES_ADMIN, peutOuvrirDossierCandidat } from "@/server/auth/habilitations";

import { listApplications } from "../reads";

const LIGNE = {
  id: "a1",
  offerId: "o1",
  offerTitleSnap: "Formateur IA",
  firstName: "Jean",
  lastName: "Témoin",
  email: "jean@exemple-temoin.fr",
  status: "new" as const,
  cvStoragePath: "cv/a1.pdf",
  needsAttention: true,
  submittedAt: new Date("2026-09-01T10:00:00Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  countMock.mockResolvedValue(1);
  findManyMock.mockResolvedValue([LIGNE]);
  activityCreateMock.mockResolvedValue({});
});

describe("chaque rôle admin réel, confronté un par un", () => {
  it("rend l'identité EXACTEMENT aux rôles que le prédicat commun admet", async () => {
    let admis = 0;
    let refuses = 0;

    for (const role of ROLES_ADMIN) {
      const res = await listApplications({}, { role, acteurId: "u1" });
      const item = res.items[0];
      const attendu = peutOuvrirDossierCandidat(role);

      // La ligne est TOUJOURS là : compteurs et chronologie ne mentent pas.
      expect(res.total, role).toBe(1);
      expect(item?.id, role).toBe("a1");
      expect(item?.offerTitleSnap, role).toBe("Formateur IA");
      expect(item?.needsAttention, role).toBe(true);

      if (attendu) {
        expect(item?.contactName, role).toBe("clair:Jean clair:Témoin");
        expect(item?.contactEmail, role).toBe("clair:jean@exemple-temoin.fr");
        expect(item?.hasCv, role).toBe(true);
        admis += 1;
      } else {
        expect(item?.contactName, role).toBeNull();
        expect(item?.contactEmail, role).toBeNull();
        // Savoir qu'un CV existe est déjà une information sur la personne.
        expect(item?.hasCv, role).toBe(false);
        refuses += 1;
      }
    }

    console.info(
      `[cloisonnement] ${String(ROLES_ADMIN.length)} rôle(s) confronté(s) : ` +
        `${String(admis)} admis, ${String(refuses)} refusés`,
    );
    // 🔑 CONTRE-TÉMOIN. Une boucle qui n'admettrait personne, ou qui admettrait
    //    tout le monde, passerait les assertions ci-dessus sans rien cloisonner.
    expect(admis, "aucun rôle n'ouvre le dossier — la lecture ne sert plus à rien").toBeGreaterThan(
      0,
    );
    expect(refuses, "tous les rôles ouvrent le dossier — rien n'est cloisonné").toBeGreaterThan(0);
  });

  it("refuse un rôle absent, nul, ou inventé — le défaut est le refus", async () => {
    for (const role of [null, "", "inconnu", "Reader", "super_admin "]) {
      const res = await listApplications({}, { role, acteurId: null });
      expect(res.items[0]?.contactName, JSON.stringify(role)).toBeNull();
      expect(res.items[0]?.contactEmail, JSON.stringify(role)).toBeNull();
    }
  });

  it("« reader » — le rôle qui lisait tout jusqu'au 2026-08-25 — ne lit plus rien", async () => {
    const res = await listApplications({}, { role: "reader", acteurId: "u1" });
    expect(res.items[0]?.contactName).toBeNull();
    // Et le déchiffrement n'a même pas eu lieu : rien ne doit pouvoir fuir
    // d'une valeur qu'on n'a pas produite.
    expect(JSON.stringify(res)).not.toContain("clair:");
  });
});

describe("la trace — écrite quand une identité sort, et seulement là", () => {
  it("journalise l'accès pour un rôle admis, avec l'acteur et l'action nommée", async () => {
    await listApplications({}, { role: "secretaire", acteurId: "u-42" });

    expect(activityCreateMock).toHaveBeenCalledOnce();
    const donnees = (activityCreateMock.mock.calls[0]?.[0] as { data: Record<string, unknown> })
      .data;
    console.info(`[cloisonnement] trace → ${String(donnees["action"])}`);
    expect(donnees["action"]).toBe("careers.candidature.liste.consultee");
    expect(donnees["adminUserId"]).toBe("u-42");
    expect(donnees["ipAddress"]).toBe("203.0.113.7");
  });

  it("n'écrit RIEN quand rien n'est montré — sinon la trace devient du bruit", async () => {
    await listApplications({}, { role: "reader", acteurId: "u1" });
    expect(activityCreateMock).not.toHaveBeenCalled();
  });

  it("n'écrit rien sur une liste VIDE, même pour un rôle admis", async () => {
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);
    await listApplications({}, { role: "admin", acteurId: "u1" });
    expect(activityCreateMock).not.toHaveBeenCalled();
  });

  it("un journal en panne ne prive PAS le recruteur de sa liste", async () => {
    activityCreateMock.mockRejectedValue(new Error("table indisponible"));
    const res = await listApplications({}, { role: "admin", acteurId: "u1" });
    expect(res.items[0]?.contactName).toBe("clair:Jean clair:Témoin");
  });
});
