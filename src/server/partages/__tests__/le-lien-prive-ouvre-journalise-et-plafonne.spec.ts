// @vitest-environment node

/**
 * LE LIEN PRIVÉ — CE QUE VOIT LA PERSONNE, CE QUE L'ÉQUIPE APPREND (Candidatures unifiées L5).
 *
 *  - jeton faux, lien expiré, lien retiré, fonction éteinte → la MÊME page neutre,
 *    et un jeton faux ne coûte aucune requête en base ;
 *  - la page liste un bouton par fichier, sans aucun script ; ouvrir la page
 *    s'écrit au journal (`page_ouverte`), sous un compteur par quart d'heure ;
 *  - télécharger écrit l'accès PUIS redirige vers une adresse R2 signée courte
 *    (12 h au-delà de 1 Go) ; HEAD n'écrit rien ;
 *  - 20 téléchargements d'un même fichier : le 20ᵉ prévient Will, le 21ᵉ est
 *    refusé (retour à la page, bouton remplacé) ; prolonger rouvre ;
 *  - premier téléchargement de rushs par une personne → une alerte « rushs téléchargés » ;
 *  - stockage injoignable → page « momentanément indisponibles », rien d'écrit.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { ouvrirPageLien, telechargerFichierLien, type DepsAcces } from "../acces";
import { jetonLien } from "../jeton";
import { PLAFOND_TELECHARGEMENTS } from "../liens";

const ENV = {
  R2_ACCOUNT_ID: "compte",
  R2_PARTAGES_BUCKET_NAME: "axion-ia-partages",
  R2_PARTAGES_ACCESS_KEY_ID: "cle",
  R2_PARTAGES_SECRET_ACCESS_KEY: "secret-cle",
  PARTAGES_SECRET: "s".repeat(40),
  DATABASE_URL: "postgresql://x@localhost/x",
};

const LIEN = "11111111-1111-4111-8111-111111111111";
const APP = "22222222-2222-4222-8222-222222222222";
const F_RUSHS = "33333333-3333-4333-8333-333333333333";
const F_LUT = "44444444-4444-4444-8444-444444444444";
const F_EXT = "55555555-5555-4555-8555-555555555555";
const MAINTENANT = new Date("2026-10-08T10:00:00Z");
const JETON = jetonLien(LIEN, ENV)!;

const NAVIGATEUR = new Headers({
  "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1",
  "sec-fetch-user": "?1",
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
});

interface Acces {
  lienId: string;
  fichierId: string | null;
  type: string;
  origine: string;
  survenuLe: Date;
}

function fichier(id: string, extra: Record<string, unknown>) {
  return {
    id,
    titre: `Titre ${id.slice(0, 4)}`,
    nature: "fichier",
    categorie: "lut",
    nomFichier: `f-${id.slice(0, 4)}.bin`,
    tailleOctets: BigInt(2_000_000),
    etatDepot: "disponible",
    analyse: "sain",
    r2Cle: `partages/${id}/f.bin`,
    urlExterne: null,
    ...extra,
  };
}

let lien: Record<string, unknown> | null;
let journal: Acces[];
let requetes: number;
let notifications: Array<{ category: string; payload: Record<string, unknown>; dedupKey?: string }>;
let r2Panne: boolean;
let signatures: Array<{ cle: string; duree: number }>;

function deps(extra: Partial<DepsAcces> = {}): DepsAcces {
  const db = {
    lienPartage: {
      findUnique: async () => {
        requetes++;
        return lien;
      },
    },
    lienPartageAcces: {
      groupBy: async (a: { where: { lienId: string; survenuLe: { gte: Date } } }) => {
        const parFichier = new Map<string, number>();
        for (const x of journal) {
          if (x.lienId !== a.where.lienId || x.type !== "telechargement") continue;
          if (x.survenuLe < a.where.survenuLe.gte) continue;
          parFichier.set(x.fichierId!, (parFichier.get(x.fichierId!) ?? 0) + 1);
        }
        return [...parFichier].map(([fichierId, n]) => ({ fichierId, _count: { _all: n } }));
      },
      count: async (a: {
        where: {
          lienId: string;
          type: string;
          fichierId: string | { in: string[] };
          origine?: string;
          survenuLe?: { gte: Date };
        };
      }) =>
        journal.filter(
          (x) =>
            x.lienId === a.where.lienId &&
            x.type === a.where.type &&
            (typeof a.where.fichierId === "string"
              ? x.fichierId === a.where.fichierId
              : a.where.fichierId.in.includes(x.fichierId!)) &&
            (!a.where.origine || x.origine === a.where.origine) &&
            (!a.where.survenuLe || x.survenuLe >= a.where.survenuLe.gte),
        ).length,
      create: async (a: { data: Omit<Acces, "survenuLe"> }) => {
        journal.push({ ...a.data, survenuLe: MAINTENANT });
        return a.data;
      },
    },
    $executeRaw: async () => 1,
  };
  return {
    db: {
      ...db,
      $transaction: async <T>(fn: (tx: typeof db) => Promise<T>) => fn(db),
    } as unknown as DepsAcces["db"],
    env: ENV,
    maintenant: () => MAINTENANT,
    limiter: async () => ({ allowed: true }),
    notifier: async (e) => {
      notifications.push(e as never);
    },
    stockage: {
      existe: async () => {
        if (r2Panne) throw new Error("R2 injoignable");
        return true;
      },
      signer: async (cle, _nom, duree) => {
        signatures.push({ cle, duree });
        return `https://r2.example/${cle}?sig=1`;
      },
    },
    ...extra,
  };
}

beforeEach(() => {
  journal = [];
  requetes = 0;
  notifications = [];
  r2Panne = false;
  signatures = [];
  lien = {
    id: LIEN,
    applicationId: APP,
    expireLe: new Date("2026-10-15T10:00:00Z"),
    revoqueLe: null,
    application: { offerTitleSnap: "Monteur vidéo freelance" },
    fichiers: [
      {
        fichier: fichier(F_RUSHS, {
          categorie: "rushs",
          tailleOctets: BigInt(6_000_000_000),
          analyse: "hors_limite",
          titre: "Rushs projet A",
        }),
      },
      { fichier: fichier(F_LUT, {}) },
      {
        fichier: fichier(F_EXT, {
          nature: "lien_externe",
          r2Cle: null,
          nomFichier: null,
          tailleOctets: null,
          analyse: null,
          urlExterne: "https://drive.example/x",
        }),
      },
    ],
  };
});

describe("la page du lien", () => {
  it("jeton faux : page neutre SANS requête en base", async () => {
    const r = await ouvrirPageLien(
      { id: LIEN, jeton: "x".repeat(43), methode: "GET", entetes: NAVIGATEUR },
      deps(),
    );
    expect(r.issue).toBe("neutre");
    expect(requetes).toBe(0);
  });

  it("fonction éteinte (secret absent) : page neutre, rien lu", async () => {
    const { PARTAGES_SECRET: _retire, ...sansSecret } = ENV;
    const r = await ouvrirPageLien(
      { id: LIEN, jeton: JETON, methode: "GET", entetes: NAVIGATEUR },
      deps({ env: sansSecret }),
    );
    expect(r.issue).toBe("neutre");
    expect(requetes).toBe(0);
  });

  it("base factice du build : page neutre", async () => {
    const r = await ouvrirPageLien(
      { id: LIEN, jeton: JETON, methode: "GET", entetes: NAVIGATEUR },
      deps({ env: { ...ENV, DATABASE_URL: "postgresql://stub:stub@stub.invalid:5432/stub" } }),
    );
    expect(r.issue).toBe("neutre");
  });

  it("lien expiré ou retiré : la même page neutre", async () => {
    lien = { ...lien!, expireLe: new Date("2026-10-08T09:59:59Z") };
    expect(
      (
        await ouvrirPageLien(
          { id: LIEN, jeton: JETON, methode: "GET", entetes: NAVIGATEUR },
          deps(),
        )
      ).issue,
    ).toBe("neutre");
    lien = {
      ...lien,
      expireLe: new Date("2026-10-15T10:00:00Z"),
      revoqueLe: new Date("2026-10-07T10:00:00Z"),
    };
    expect(
      (
        await ouvrirPageLien(
          { id: LIEN, jeton: JETON, methode: "GET", entetes: NAVIGATEUR },
          deps(),
        )
      ).issue,
    ).toBe("neutre");
    expect(journal).toHaveLength(0);
  });

  it("lien valide : un bouton par fichier, mention des rushs, aucun script, ouverture journalisée", async () => {
    const r = await ouvrirPageLien(
      { id: LIEN, jeton: JETON, methode: "GET", entetes: NAVIGATEUR },
      deps(),
    );
    expect(r.issue).toBe("page");
    if (r.issue !== "page") return;
    expect(r.html).not.toMatch(/<script/i);
    expect(r.html).toContain(
      "Fichiers confiés pour l'essai uniquement, à ne pas diffuser ni réutiliser.",
    );
    expect(r.html.match(/class="bouton"/g)).toHaveLength(3);
    expect(r.html).toContain(`/api/partage/${LIEN}/${JETON}/${F_RUSHS}`);
    expect(r.html).toContain("15/10/2026");
    expect(journal).toEqual([
      {
        lienId: LIEN,
        fichierId: null,
        type: "page_ouverte",
        origine: "navigateur",
        survenuLe: MAINTENANT,
      },
    ]);
  });

  it("HEAD n'écrit rien ; au-delà du compteur, l'ouverture n'est plus écrite mais la page s'affiche", async () => {
    await ouvrirPageLien({ id: LIEN, jeton: JETON, methode: "HEAD", entetes: NAVIGATEUR }, deps());
    const r = await ouvrirPageLien(
      { id: LIEN, jeton: JETON, methode: "GET", entetes: NAVIGATEUR },
      deps({ limiter: async () => ({ allowed: false }) }),
    );
    expect(r.issue).toBe("page");
    expect(journal).toHaveLength(0);
  });

  it("un aperçu automatique (robot de messagerie) est noté comme tel", async () => {
    await ouvrirPageLien(
      {
        id: LIEN,
        jeton: JETON,
        methode: "GET",
        entetes: new Headers({ "user-agent": "Microsoft Office Outlook SafeLinks" }),
      },
      deps(),
    );
    expect(journal[0]!.origine).toBe("apercu_automatique");
  });

  it("un fichier sans verdict antivirus n'a pas de bouton", async () => {
    (lien!.fichiers as Array<{ fichier: Record<string, unknown> }>)[1]!.fichier.analyse =
      "en_attente";
    const r = await ouvrirPageLien(
      { id: LIEN, jeton: JETON, methode: "GET", entetes: NAVIGATEUR },
      deps(),
    );
    if (r.issue !== "page") throw new Error("page attendue");
    expect(r.html).not.toContain(`/${F_LUT}"`);
    expect(r.html).toContain("En cours de vérification");
  });
});

describe("le téléchargement", () => {
  const demande = (fichierId: string, entetes = NAVIGATEUR) => ({
    id: LIEN,
    jeton: JETON,
    fichierId,
    entetes,
  });

  it("écrit l'accès puis redirige vers une adresse signée — 12 h au-delà de 1 Go, 1 h sinon", async () => {
    const r1 = await telechargerFichierLien(demande(F_RUSHS), deps());
    expect(r1).toEqual({
      issue: "redirection",
      url: `https://r2.example/partages/${F_RUSHS}/f.bin?sig=1`,
    });
    const r2 = await telechargerFichierLien(demande(F_LUT), deps());
    expect(r2.issue).toBe("redirection");
    expect(signatures.map((s) => s.duree)).toEqual([12 * 3600, 3600]);
    expect(journal.map((a) => [a.type, a.fichierId])).toEqual([
      ["telechargement", F_RUSHS],
      ["telechargement", F_LUT],
    ]);
  });

  it("un lien externe redirige vers son adresse d'origine, journalisé", async () => {
    const r = await telechargerFichierLien(demande(F_EXT), deps());
    expect(r).toEqual({ issue: "redirection", url: "https://drive.example/x" });
    expect(journal).toHaveLength(1);
  });

  it("un fichier étranger au lien, ou un jeton faux : neutre, rien d'écrit", async () => {
    expect(
      (await telechargerFichierLien(demande("66666666-6666-4666-8666-666666666666"), deps())).issue,
    ).toBe("neutre");
    expect(
      (await telechargerFichierLien({ ...demande(F_LUT), jeton: "y".repeat(43) }, deps())).issue,
    ).toBe("neutre");
    expect(journal).toHaveLength(0);
  });

  it("stockage injoignable : « momentanément indisponibles », rien d'écrit", async () => {
    r2Panne = true;
    expect((await telechargerFichierLien(demande(F_LUT), deps())).issue).toBe("indisponible");
    expect(journal).toHaveLength(0);
  });

  it(`plafond : le ${PLAFOND_TELECHARGEMENTS}ᵉ prévient Will, le suivant est refusé ; prolonger rouvre`, async () => {
    for (let i = 0; i < PLAFOND_TELECHARGEMENTS; i++) {
      expect((await telechargerFichierLien(demande(F_LUT), deps())).issue).toBe("redirection");
    }
    const alertes = notifications.filter((n) => n.payload.kind === "plafond_atteint");
    expect(alertes).toHaveLength(1);
    expect(alertes[0]!.category).toBe("FICHIERS_PARTAGES");
    expect((await telechargerFichierLien(demande(F_LUT), deps())).issue).toBe("retour");
    expect(journal).toHaveLength(PLAFOND_TELECHARGEMENTS);

    const page = await ouvrirPageLien(
      { id: LIEN, jeton: JETON, methode: "GET", entetes: NAVIGATEUR },
      deps(),
    );
    if (page.issue !== "page") throw new Error("page attendue");
    expect(page.html).toContain("limite de téléchargements");

    // Prolonger : la date limite repart de maintenant → nouvelle période, compteur à zéro.
    lien = { ...lien!, expireLe: new Date(MAINTENANT.getTime() + 7 * 86_400_000 + 1) };
    const apres = deps({ maintenant: () => new Date(MAINTENANT.getTime() + 1) });
    // Les accès précédents datent d'AVANT la nouvelle période.
    expect((await telechargerFichierLien(demande(F_LUT), apres)).issue).toBe("redirection");
  });

  it("premier téléchargement de rushs par une personne : UNE alerte, sans nom ni adresse", async () => {
    await telechargerFichierLien(demande(F_RUSHS, new Headers({ "user-agent": "curl/8" })), deps());
    expect(notifications).toHaveLength(0);
    await telechargerFichierLien(demande(F_RUSHS), deps());
    await telechargerFichierLien(demande(F_RUSHS), deps());
    await telechargerFichierLien(demande(F_LUT), deps());
    const rushs = notifications.filter((n) => n.payload.kind === "rushs_telecharges");
    expect(rushs).toHaveLength(1);
    expect(rushs[0]!.payload).toEqual({
      kind: "rushs_telecharges",
      offre: "Monteur vidéo freelance",
      fichier: "Rushs projet A",
      applicationId: APP,
    });
    expect(JSON.stringify(rushs[0])).not.toMatch(/@|drive\.example/);
  });
});
