/**
 * route-coordonnees.spec.ts — INT-T27-A (chantier Axion Partners) : la route par laquelle
 * Partners TIRE les coordonnées d'un candidat émis vers lui (REQ-INT-032, REQ-INT-029,
 * partners/ADR-0023).
 *
 *   `GET /api/partners/candidatures/{candidatureId}/coordonnees`
 *
 * Ce que ce fichier prouve, chaque fois par un témoin à deux faces :
 *   (1) une requête non signée, mal signée, hors fenêtre ou venue d'une adresse non autorisée
 *       est refusée et n'a LU aucune ligne ;
 *   (2) une candidature NON émise vers Partners rend EXACTEMENT la réponse d'un identifiant
 *       inexistant — statut, corps et en-têtes comparés ;
 *   (3) la réponse est fermée : quatre champs, rien d'autre, signée comme un envoi, sans cache ;
 *   (4) le journal porte l'identifiant, l'empreinte de l'adresse et le résultat — jamais une
 *       coordonnée ;
 *   (5) canal fermé : la réponse d'un identifiant inexistant, sans rien lire ;
 *   (7) au plus 5 lectures réussies par candidature sur 24 h : la sixième ne rend rien, est
 *       journalisée et alertée ; la première lecture d'une AUTRE candidature passe.
 */
import { createHash, createHmac } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  PLAFOND_LECTURES_COORDONNEES,
  repondreCoordonnees,
  type DependancesCoordonnees,
  type LigneJournalCoordonnees,
} from "@/server/partners-sync/coordonnees";
import { signerCibleRelecture } from "@/server/partners-sync/relecture";

import { fautes, resoudre } from "../../partners/__tests__/contrat-schema";

const SECRET_RELECTURE = "r".repeat(40);
const SECRET_EMISSION = "e".repeat(40);
const IP_PARTNERS = "203.0.113.7";
const MAINTENANT_MS = Date.UTC(2026, 8, 29, 12, 0, 0);
const T = String(Math.floor(MAINTENANT_MS / 1000));

const EMISE = "0a1b2c3d-0001-4000-8000-000000000001";
const AUTRE_EMISE = "0a1b2c3d-0002-4000-8000-000000000002";
const NON_EMISE = "0a1b2c3d-0003-4000-8000-000000000003";
const INEXISTANTE = "0a1b2c3d-0004-4000-8000-000000000004";

/** Les coordonnées stockées CHIFFRÉES — le faux déchiffreur retire le préfixe. */
const SUBMISSIONS: Record<
  string,
  { contactName: string; contactEmail: string; contactPhone: string | null }
> = {
  [EMISE]: {
    contactName: "enc:Camille Durand",
    contactEmail: "enc:camille@example.test",
    contactPhone: "enc:0600000000",
  },
  [AUTRE_EMISE]: {
    contactName: "enc:Alex Martin",
    contactEmail: "enc:alex@example.test",
    contactPhone: null,
  },
  [NON_EMISE]: {
    contactName: "enc:Sam Petit",
    contactEmail: "enc:sam@example.test",
    contactPhone: "enc:0611111111",
  },
};
const EMISES = new Set([EMISE, AUTRE_EMISE]);

type Monde = {
  lectures: string[];
  journal: LigneJournalCoordonnees[];
  alertes: string[];
  compteurs: Map<string, number>;
  panneDuLimiteur: boolean;
};

function monde(): Monde {
  return { lectures: [], journal: [], alertes: [], compteurs: new Map(), panneDuLimiteur: false };
}

function dependances(m: Monde): DependancesCoordonnees {
  return {
    maintenantMs: MAINTENANT_MS,
    prisma: {
      partnersSyncOutbox: {
        findFirst: async (args) => {
          m.lectures.push(`outbox:${args.where.subjectRef}`);
          const id = args.where.subjectRef.replace(/^submission:/, "");
          return EMISES.has(id) && args.where.eventType === "candidature.recue"
            ? { id: "o1" }
            : null;
        },
      },
      submission: {
        findUnique: async (args) => {
          m.lectures.push(`submission:${args.where.id}`);
          return SUBMISSIONS[args.where.id] ?? null;
        },
      },
    },
    dechiffrer: (v) => (v === null ? null : v.replace(/^enc:/, "")),
    limiteur: {
      consulter: async (cle) => ({
        allowed:
          !m.panneDuLimiteur && (m.compteurs.get(cle) ?? 0) < PLAFOND_LECTURES_COORDONNEES.limit,
        panne: m.panneDuLimiteur,
      }),
      enregistrer: async (cle) => {
        m.compteurs.set(cle, (m.compteurs.get(cle) ?? 0) + 1);
      },
    },
    journaliser: (ligne) => m.journal.push(ligne),
    alerter: async (candidatureId) => {
      m.alertes.push(candidatureId);
    },
  };
}

const chemin = (id: string) => `/api/partners/candidatures/${id}/coordonnees`;

function requete(
  id: string,
  options: { signature?: string | null; horodatage?: string; ip?: string } = {},
): Request {
  const horodatage = options.horodatage ?? T;
  const signature =
    options.signature === undefined
      ? signerCibleRelecture(SECRET_RELECTURE, horodatage, chemin(id))
      : options.signature;
  const h = new Headers({
    "x-partners-timestamp": horodatage,
    "x-real-ip": options.ip ?? IP_PARTNERS,
  });
  if (signature !== null) h.set("x-partners-signature", signature);
  return new Request(`https://axion-ia.com${chemin(id)}`, { headers: h });
}

async function lue(r: Response) {
  return {
    statut: r.status,
    corps: await r.text(),
    entetes: [...r.headers.entries()].sort(([a], [b]) => a.localeCompare(b)),
  };
}

const ENV_AVANT = { ...process.env };
beforeEach(() => {
  process.env.PARTNERS_SYNC_ENABLED = "true";
  process.env.PARTNERS_SYNC_SECRET = SECRET_EMISSION;
  process.env.PARTNERS_RELECTURE_SECRET = SECRET_RELECTURE;
  process.env.PARTNERS_IP_AUTORISEES = `${IP_PARTNERS}, 198.51.100.0/24`;
  process.env.DATABASE_URL = "postgresql://u:p@localhost:5432/db";
});
afterEach(() => {
  process.env = { ...ENV_AVANT };
});

describe("REQ-INT-032 — (3) une candidature émise rend ses quatre champs, et rien d'autre", () => {
  it("200, {nom, prenom, email, telephone} déchiffrés, signé comme un envoi, jamais mis en cache", async () => {
    const m = monde();
    const r = await repondreCoordonnees(requete(EMISE), EMISE, dependances(m));
    expect(r.status).toBe(200);
    const corps = await r.text();
    expect(JSON.parse(corps)).toEqual({
      // Le formulaire enregistre « prénom nom » en un seul champ : la séparation n'est pas
      // récupérable sans deviner. Le nom complet est rendu tel que saisi, le prénom est nul.
      nom: "Camille Durand",
      prenom: null,
      email: "camille@example.test",
      telephone: "0600000000",
    });
    // Jugé par le `$defs` PUBLIÉ du contrat copié, pas seulement par la forme tapée ci-dessus.
    expect(
      fautes(resoudre("#/$defs/api_coordonnees_candidature_reponse"), JSON.parse(corps)),
    ).toEqual([]);
    expect(r.headers.get("cache-control")).toBe("no-store");
    const t = r.headers.get("x-axionia-timestamp")!;
    expect(r.headers.get("x-axionia-signature")).toBe(
      createHmac("sha256", SECRET_EMISSION).update(`${t}.${corps}`).digest("hex"),
    );
  });

  it("un champ absent est nul, jamais une chaîne vide", async () => {
    const r = await repondreCoordonnees(requete(AUTRE_EMISE), AUTRE_EMISE, dependances(monde()));
    expect(JSON.parse(await r.text())).toMatchObject({ telephone: null });
  });
});

describe("REQ-INT-029 — (2) non émise = inexistante, octet pour octet", () => {
  it("TÉMOIN — une candidature NON émise ne rend aucune coordonnée, et la même réponse qu'un identifiant inexistant", async () => {
    const nonEmise = await lue(
      await repondreCoordonnees(requete(NON_EMISE), NON_EMISE, dependances(monde())),
    );
    const inexistante = await lue(
      await repondreCoordonnees(requete(INEXISTANTE), INEXISTANTE, dependances(monde())),
    );
    expect(nonEmise.statut).toBe(404);
    expect(nonEmise).toEqual(inexistante);
    expect(nonEmise.corps).not.toMatch(/sam|0611/i);
  });

  it("la submission d'une candidature non émise n'est même pas lue", async () => {
    const m = monde();
    await repondreCoordonnees(requete(NON_EMISE), NON_EMISE, dependances(m));
    expect(m.lectures).toEqual([`outbox:submission:${NON_EMISE}`]);
  });
});

describe("REQ-INT-032 — (1) authentification : refusée, et rien n'est lu", () => {
  it.each([
    ["signature absente", { signature: null }],
    ["signature fausse", { signature: "0".repeat(64) }],
    ["hors de la fenêtre de 300 s", { horodatage: String(Number(T) - 301) }],
    ["adresse non autorisée", { ip: "192.0.2.99" }],
  ] as const)("TÉMOIN — %s : 401, aucune lecture, aucune coordonnée", async (_nom, options) => {
    const m = monde();
    const r = await repondreCoordonnees(requete(EMISE, options), EMISE, dependances(m));
    expect(r.status).toBe(401);
    expect(await r.text()).not.toMatch(/camille|0600/i);
    expect(m.lectures).toEqual([]);
  });

  it("une adresse de la plage autorisée passe", async () => {
    const r = await repondreCoordonnees(
      requete(EMISE, { ip: "198.51.100.42" }),
      EMISE,
      dependances(monde()),
    );
    expect(r.status).toBe(200);
  });

  it("aucune adresse autorisée configurée : tout est refusé (échec fermé)", async () => {
    delete process.env.PARTNERS_IP_AUTORISEES;
    const m = monde();
    const r = await repondreCoordonnees(requete(EMISE), EMISE, dependances(m));
    expect(r.status).toBe(401);
    expect(m.lectures).toEqual([]);
  });
});

describe("REQ-INT-029 — un identifiant qui n'est pas un UUID n'est même pas cherché", () => {
  it("TÉMOIN — la même réponse qu'un identifiant inexistant, sans aucune lecture", async () => {
    const reference = await lue(
      await repondreCoordonnees(requete(INEXISTANTE), INEXISTANTE, dependances(monde())),
    );
    const m = monde();
    const r = await lue(
      await repondreCoordonnees(requete("pas-un-uuid"), "pas-un-uuid", dependances(m)),
    );
    expect(r).toEqual(reference);
    expect(m.lectures).toEqual([]);
  });
});

describe("REQ-INT-032 — (5) inertie : canal fermé = identifiant inexistant", () => {
  it("sans le drapeau, la réponse est celle d'un identifiant inexistant, sans rien lire", async () => {
    const reference = await lue(
      await repondreCoordonnees(requete(INEXISTANTE), INEXISTANTE, dependances(monde())),
    );
    delete process.env.PARTNERS_SYNC_ENABLED;
    const m = monde();
    const fermee = await lue(await repondreCoordonnees(requete(EMISE), EMISE, dependances(m)));
    expect(fermee).toEqual(reference);
    expect(m.lectures).toEqual([]);
  });
});

describe("REQ-INT-029 — (4) le journal ne porte jamais une coordonnée", () => {
  it("identifiant, empreinte de l'adresse, résultat — et rien de ce qui a été rendu", async () => {
    const m = monde();
    await repondreCoordonnees(requete(EMISE), EMISE, dependances(m));
    await repondreCoordonnees(requete(NON_EMISE), NON_EMISE, dependances(m));
    expect(m.journal.map((l) => [l.candidatureId, l.resultat])).toEqual([
      [EMISE, "rendue"],
      [NON_EMISE, "non_emise"],
    ]);
    const texte = JSON.stringify(m.journal);
    expect(texte).not.toMatch(/camille|durand|example\.test|0600|sam|petit/i);
    expect(texte).not.toContain(IP_PARTNERS);
    expect(m.journal[0]!.adresseEmpreinte).toMatch(/^[0-9a-f]{16}$/);
    // SALÉE : l'empreinte nue d'une IPv4 se retrouve en 2^32 essais (relevé securite).
    expect(m.journal[0]!.adresseEmpreinte).not.toBe(
      createHash("sha256").update(IP_PARTNERS).digest("hex").slice(0, 16),
    );
  });
});

describe("REQ-INT-032 — (7) débit plafonné par candidature", () => {
  it("TÉMOIN — la sixième lecture d'une même candidature ne rend rien, est journalisée et alertée ; une autre candidature passe", async () => {
    const m = monde();
    const d = dependances(m);
    for (let i = 0; i < PLAFOND_LECTURES_COORDONNEES.limit; i++) {
      expect((await repondreCoordonnees(requete(EMISE), EMISE, d)).status).toBe(200);
    }
    const sixieme = await lue(await repondreCoordonnees(requete(EMISE), EMISE, d));
    const inexistante = await lue(await repondreCoordonnees(requete(INEXISTANTE), INEXISTANTE, d));
    expect(sixieme).toEqual(inexistante);
    expect(m.journal.filter((l) => l.resultat === "plafond_atteint")).toHaveLength(1);
    expect(m.alertes).toEqual([EMISE]);
    expect((await repondreCoordonnees(requete(AUTRE_EMISE), AUTRE_EMISE, d)).status).toBe(200);
  });

  it("le plafond est de 5 sur 24 heures glissantes, refusé si le compteur est en panne", async () => {
    expect(PLAFOND_LECTURES_COORDONNEES).toEqual({
      limit: 5,
      windowSec: 24 * 3600,
      surPanne: "refuser",
    });
    const m = monde();
    m.panneDuLimiteur = true;
    const r = await repondreCoordonnees(requete(EMISE), EMISE, dependances(m));
    expect(r.status).toBe(404);
    expect(m.journal.at(-1)?.resultat).toBe("limiteur_en_panne");
  });
});
