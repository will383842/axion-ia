// @vitest-environment node

/**
 * LE CANDIDAT RENVOIE SA VERSION PAR SON LIEN (Candidatures unifiées L5b, plan [B2]).
 *
 *  - le bloc « Déposer votre version » n'existe que si le lien l'autorise ; la
 *    page de téléchargement reste SANS script ;
 *  - chaque appel public revérifie le jeton : jeton faux, lien expiré, retiré,
 *    sans dépôt autorisé, fonction éteinte ou base factice → refus neutre ;
 *  - l'envoi est BORNÉ AU LIEN : un fichier déposé par un autre lien (ou par
 *    l'équipe) ne se signe, ne se reprend ni ne se termine par celui-ci ;
 *  - plus de 4 Go, ou un fichier qui n'est ni une vidéo ni un ZIP (signature des
 *    premiers octets) → refusé AVANT le premier morceau, sans rien écrire ;
 *  - un dépôt terminé prévient Will (« Un candidat a rendu son essai »), SANS nom
 *    ni adresse ;
 *  - la demande doit être du JSON (une page tierce ne peut pas poster à l'aveugle).
 */

import { beforeEach, describe, expect, it } from "vitest";

import {
  ouvrirPageDepot,
  traiterDepot,
  type DepsDepot,
  DEPOTS_PAR_LIEN_MAX,
} from "../depot-public";
import { jetonLien } from "../jeton";
import {
  verifierDemandeDepotPersonne,
  familleSignature,
  TAILLE_MAX_DEPOT_PERSONNE_OCTETS,
} from "../regles";
import { pageLien } from "../page-publique";

const ENV = {
  R2_ACCOUNT_ID: "compte",
  R2_PARTAGES_BUCKET_NAME: "axion-ia-partages",
  R2_PARTAGES_ACCESS_KEY_ID: "cle",
  R2_PARTAGES_SECRET_ACCESS_KEY: "secret-cle",
  PARTAGES_SECRET: "s".repeat(40),
  DATABASE_URL: "postgresql://x@localhost/x",
};

const LIEN = "11111111-1111-4111-8111-111111111111";
const AUTRE_LIEN = "99999999-9999-4999-8999-999999999999";
const APP = "22222222-2222-4222-8222-222222222222";
const F_SIEN = "33333333-3333-4333-8333-333333333333";
const F_AUTRE = "44444444-4444-4444-8444-444444444444";
const F_EQUIPE = "55555555-5555-4555-8555-555555555555";
const MAINTENANT = new Date("2026-10-08T10:00:00Z");
const JETON = jetonLien(LIEN, ENV)!;

/** Les 16 premiers octets d'un MP4 (`....ftypisom`). */
const ENTETE_MP4 = Buffer.from([
  0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 2, 0,
]);
const ENTETE_ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0, 0, 0, 8, 0, 0, 0, 0, 0, 0, 0]);
const ENTETE_EXE = Buffer.from([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0, 0xff, 0xff, 0, 0]);

let lien: Record<string, unknown> | null;
let fichiers: Map<string, { lienDepotId: string | null; origine: string }>;
let moteur: string[];
let requetes: number;
let notifications: Array<{ category: string; payload: Record<string, unknown> }>;
let limiteAtteinte: boolean;
let verrous: string[];

/** Un verrou par lien, comme `pg_advisory_xact_lock` : les sections se suivent. */
function verrouEnMemoire(): DepsDepot["sousVerrouLien"] {
  const files = new Map<string, Promise<unknown>>();
  return (lienId, fn) => {
    verrous.push(lienId);
    const avant = files.get(lienId) ?? Promise.resolve();
    const suite = avant.then(() => fn(deps().db));
    files.set(
      lienId,
      suite.catch(() => undefined),
    );
    return suite;
  };
}

function deps(extra: Partial<DepsDepot> = {}): DepsDepot {
  return {
    sousVerrouLien: async (lienId, fn) => {
      verrous.push(lienId);
      return fn(deps().db);
    },
    db: {
      lienPartage: {
        findUnique: async () => {
          requetes++;
          return lien;
        },
      },
      fichierPartage: {
        findUnique: async (a: { where: { id: string } }) => fichiers.get(a.where.id) ?? null,
        count: async (a: { where: { lienDepotId: string } }) =>
          [...fichiers.values()].filter((f) => f.lienDepotId === a.where.lienDepotId).length,
        findMany: async () => [
          {
            nomFichier: "version-1.mp4",
            tailleOctets: BigInt(3_000_000_000),
            disponibleLe: MAINTENANT,
          },
        ],
      },
    } as unknown as DepsDepot["db"],
    env: ENV,
    maintenant: () => MAINTENANT,
    limiter: async () => ({ allowed: !limiteAtteinte }),
    notifier: async (e) => {
      notifications.push(e as never);
    },
    moteur: {
      commencer: async (d, lienId) => {
        moteur.push(`commencer:${lienId}:${d.nom}`);
        return { ok: true, valeur: { fichierId: F_SIEN, tailleMorceau: 64, nombreMorceaux: 3 } };
      },
      signer: async (id, numeros) => {
        moteur.push(`signer:${id}`);
        return { ok: true, valeur: numeros.map((n) => ({ numero: n, url: `https://r2/${n}` })) };
      },
      reprendre: async (id) => {
        moteur.push(`reprendre:${id}`);
        return {
          ok: true,
          valeur: { fichierId: id, taille: 150, tailleMorceau: 64, nombreMorceaux: 3, recus: [1] },
        };
      },
      terminer: async (id) => {
        moteur.push(`terminer:${id}`);
        return { ok: true, valeur: { fichierId: id } };
      },
    },
    ...extra,
  };
}

function lienActif(extra: Record<string, unknown> = {}) {
  return {
    id: LIEN,
    applicationId: APP,
    expireLe: new Date("2026-10-15T10:00:00Z"),
    revoqueLe: null,
    depotAutorise: true,
    application: { offerTitleSnap: "Monteur vidéo freelance" },
    ...extra,
  };
}

const JSON_CT = "application/json";

function appel(corps: unknown, opts: { jeton?: string; id?: string; ct?: string } = {}) {
  return traiterDepot(
    {
      id: opts.id ?? LIEN,
      jeton: opts.jeton ?? JETON,
      contentType: opts.ct ?? JSON_CT,
      corps,
    },
    deps(),
  );
}

beforeEach(() => {
  lien = lienActif();
  fichiers = new Map([
    [F_SIEN, { lienDepotId: LIEN, origine: "personne" }],
    [F_AUTRE, { lienDepotId: AUTRE_LIEN, origine: "personne" }],
    [F_EQUIPE, { lienDepotId: null, origine: "equipe" }],
  ]);
  moteur = [];
  requetes = 0;
  notifications = [];
  limiteAtteinte = false;
  verrous = [];
});

describe("la page de téléchargement", () => {
  const base = {
    chemin: `/api/partage/${LIEN}/${JETON}`,
    expireLe: new Date("2026-10-15T10:00:00Z"),
    rushs: true,
    fichiers: [],
  };

  it("propose « Déposer votre version » seulement si le lien l'autorise, sans aucun script", () => {
    const avec = pageLien({ ...base, depotAutorise: true });
    expect(avec).toContain("Déposer votre version");
    expect(avec).toContain(`href="/api/partage/${LIEN}/${JETON}/deposer"`);
    expect(avec).not.toMatch(/<script/i);

    const sans = pageLien({ ...base, depotAutorise: false });
    expect(sans).not.toContain("Déposer votre version");
    expect(sans).not.toContain("/deposer");
  });
});

describe("la page de dépôt", () => {
  it("s'ouvre pour un lien valide qui autorise le dépôt : formulaire, 4 Go, script chargé à part", async () => {
    const r = await ouvrirPageDepot({ id: LIEN, jeton: JETON }, deps());
    expect(r.issue).toBe("page");
    if (r.issue !== "page") return;
    expect(r.html).toContain('id="depot"');
    expect(r.html).toContain(`data-action="/api/partage/${LIEN}/${JETON}/deposer"`);
    expect(r.html).toContain(`data-max="${TAILLE_MAX_DEPOT_PERSONNE_OCTETS}"`);
    expect(r.html).toContain('<script src="/api/partage/script-depot" defer></script>');
    // Aucun script en ligne : la CSP de la page n'autorise que `'self'`.
    expect(r.html.match(/<script/g)?.length).toBe(1);
    expect(r.html).toContain("4 Go");
    // Ce qui est déjà arrivé, sans lien de téléchargement.
    expect(r.html).toContain("version-1.mp4");
  });

  it.each([
    ["jeton faux", { jeton: "x".repeat(43) }],
    ["jeton d'un autre lien", { jeton: jetonLien(AUTRE_LIEN, ENV)! }],
  ])("%s → page neutre, sans requête", async (_n, o) => {
    const r = await ouvrirPageDepot({ id: LIEN, jeton: o.jeton }, deps());
    expect(r.issue).toBe("neutre");
    expect(requetes).toBe(0);
  });

  it.each([
    ["dépôt non autorisé", { depotAutorise: false }],
    ["lien retiré", { revoqueLe: new Date("2026-10-07T10:00:00Z") }],
    ["lien expiré", { expireLe: new Date("2026-10-01T10:00:00Z") }],
    ["lien d'un futur apporteur", { applicationId: null }],
  ])("%s → page neutre", async (_n, extra) => {
    lien = lienActif(extra);
    const r = await ouvrirPageDepot({ id: LIEN, jeton: JETON }, deps());
    expect(r.issue).toBe("neutre");
  });

  it("bibliothèque éteinte ou base factice du build → neutre, sans requête", async () => {
    const eteinte = await ouvrirPageDepot(
      { id: LIEN, jeton: JETON },
      deps({ env: { ...ENV, R2_PARTAGES_BUCKET_NAME: "" } }),
    );
    expect(eteinte.issue).toBe("neutre");
    const stub = await ouvrirPageDepot(
      { id: LIEN, jeton: JETON },
      deps({ env: { ...ENV, DATABASE_URL: "postgresql://stub:stub@stub.invalid:5432/stub" } }),
    );
    expect(stub.issue).toBe("neutre");
    expect(requetes).toBe(0);
  });
});

describe("les actions publiques de dépôt", () => {
  it("commencer : un MP4 de 3 Go est accepté, rattaché à CE lien", async () => {
    const r = await appel({
      etape: "commencer",
      nom: "ma-version.mp4",
      taille: 3_000_000_000,
      entete: ENTETE_MP4.toString("base64"),
    });
    expect(r.statut).toBe(200);
    expect(r.json).toMatchObject({ ok: true, fichierId: F_SIEN, nombreMorceaux: 3 });
    expect(moteur).toEqual([`commencer:${LIEN}:ma-version.mp4`]);
  });

  it("commencer : 4,1 Go → refusé AVANT le premier morceau (le moteur n'est pas appelé)", async () => {
    const r = await appel({
      etape: "commencer",
      nom: "trop-gros.mp4",
      taille: 4_100_000_000,
      entete: ENTETE_MP4.toString("base64"),
    });
    expect(r.statut).toBe(400);
    expect(String(r.json.erreur)).toContain("4 Go");
    expect(moteur).toEqual([]);
  });

  it("commencer : un exécutable renommé en .mp4 → refusé par la signature, sans rien écrire", async () => {
    const r = await appel({
      etape: "commencer",
      nom: "piege.mp4",
      taille: 1000,
      entete: ENTETE_EXE.toString("base64"),
    });
    expect(r.statut).toBe(400);
    expect(moteur).toEqual([]);
  });

  it("commencer : au-delà de 10 dépôts par lien → refusé", async () => {
    for (let i = 0; i < DEPOTS_PAR_LIEN_MAX; i++) {
      fichiers.set(`f-${i}`, { lienDepotId: LIEN, origine: "personne" });
    }
    const r = await appel({
      etape: "commencer",
      nom: "encore.zip",
      taille: 1000,
      entete: ENTETE_ZIP.toString("base64"),
    });
    expect(r.statut).toBe(409);
    expect(moteur).toEqual([]);
  });

  it("commencer : le compte et l'ouverture se font SOUS le verrou du lien", async () => {
    const r = await appel({
      etape: "commencer",
      nom: "montage.zip",
      taille: 1000,
      entete: ENTETE_ZIP.toString("base64"),
    });
    expect(r.statut).toBe(200);
    expect(verrous).toEqual([LIEN]);
  });

  it("commencer : deux envois simultanés au 10e fichier → un seul passe (pas de course)", async () => {
    // F_SIEN + 8 autres = 9 : il reste UNE place.
    for (let i = 0; i < DEPOTS_PAR_LIEN_MAX - 2; i++) {
      fichiers.set(`f-${i}`, { lienDepotId: LIEN, origine: "personne" });
    }
    let n = 0;
    const d = deps({ sousVerrouLien: verrouEnMemoire() });
    const lent: DepsDepot = {
      ...d,
      moteur: {
        ...d.moteur,
        commencer: async (_dem, lienId) => {
          await new Promise((ok) => setTimeout(ok, 5));
          fichiers.set(`nouveau-${n++}`, { lienDepotId: lienId, origine: "personne" });
          return { ok: true, valeur: { fichierId: F_SIEN, tailleMorceau: 64, nombreMorceaux: 1 } };
        },
      },
    };
    const corps = {
      etape: "commencer",
      nom: "montage.zip",
      taille: 1000,
      entete: ENTETE_ZIP.toString("base64"),
    };
    const issues = await Promise.all(
      [1, 2].map(() => traiterDepot({ id: LIEN, jeton: JETON, contentType: JSON_CT, corps }, lent)),
    );
    expect(issues.map((x) => x.statut).sort()).toEqual([200, 409]);
    expect([...fichiers.values()].filter((f) => f.lienDepotId === LIEN)).toHaveLength(
      DEPOTS_PAR_LIEN_MAX,
    );
  });

  it("signer / reprendre / terminer un fichier de CE lien : accepté", async () => {
    expect((await appel({ etape: "signer", fichierId: F_SIEN, numeros: [1, 2, 3] })).statut).toBe(
      200,
    );
    expect((await appel({ etape: "reprendre", fichierId: F_SIEN })).json).toMatchObject({
      ok: true,
      recus: [1],
    });
    expect((await appel({ etape: "terminer", fichierId: F_SIEN })).statut).toBe(200);
    expect(moteur).toEqual([`signer:${F_SIEN}`, `reprendre:${F_SIEN}`, `terminer:${F_SIEN}`]);
  });

  it.each([
    ["déposé par un autre lien", F_AUTRE],
    ["déposé par l'équipe", F_EQUIPE],
    ["inconnu", "66666666-6666-4666-8666-666666666666"],
  ])("un fichier %s ne se signe, ne se reprend ni ne se termine par ce lien", async (_n, id) => {
    for (const etape of ["signer", "reprendre", "terminer"]) {
      const r = await appel({ etape, fichierId: id, numeros: [1] });
      expect(r.statut).toBe(404);
    }
    expect(moteur).toEqual([]);
  });

  it("le jeton d'un autre lien est refusé à CHAQUE appel", async () => {
    const autre = jetonLien(AUTRE_LIEN, ENV)!;
    for (const corps of [
      { etape: "commencer", nom: "a.mp4", taille: 10, entete: ENTETE_MP4.toString("base64") },
      { etape: "signer", fichierId: F_SIEN, numeros: [1] },
      { etape: "terminer", fichierId: F_SIEN },
    ]) {
      const r = await appel(corps, { jeton: autre });
      expect(r.statut).toBe(404);
    }
    expect(moteur).toEqual([]);
    expect(requetes).toBe(0);
  });

  it("un lien sans dépôt autorisé refuse tout", async () => {
    lien = lienActif({ depotAutorise: false });
    const r = await appel({ etape: "terminer", fichierId: F_SIEN });
    expect(r.statut).toBe(404);
    expect(moteur).toEqual([]);
  });

  it("une demande qui n'est pas du JSON est refusée", async () => {
    const r = await appel({ etape: "terminer", fichierId: F_SIEN }, { ct: "text/plain" });
    expect(r.statut).toBe(415);
    expect(moteur).toEqual([]);
  });

  it("trop d'appels en peu de temps → 429", async () => {
    limiteAtteinte = true;
    const r = await appel({ etape: "terminer", fichierId: F_SIEN });
    expect(r.statut).toBe(429);
    expect(moteur).toEqual([]);
  });

  it("un dépôt terminé prévient Will, sans nom ni adresse", async () => {
    await appel({ etape: "terminer", fichierId: F_SIEN });
    expect(notifications).toHaveLength(1);
    const n = notifications[0]!;
    expect(n.category).toBe("FICHIERS_PARTAGES");
    expect(n.payload).toEqual({
      kind: "essai_rendu",
      offre: "Monteur vidéo freelance",
      fichier: "Essai rendu",
      applicationId: APP,
    });
    expect(JSON.stringify(n)).not.toContain(JETON);
  });

  it("un dépôt refusé à la fin ne prévient personne", async () => {
    const d = deps();
    const r = await traiterDepot(
      {
        id: LIEN,
        jeton: JETON,
        contentType: JSON_CT,
        corps: { etape: "terminer", fichierId: F_SIEN },
      },
      {
        ...d,
        moteur: { ...d.moteur, terminer: async () => ({ ok: false, erreur: "pas une vidéo" }) },
      },
    );
    expect(r.statut).toBe(400);
    expect(notifications).toHaveLength(0);
  });
});

describe("les règles pures du dépôt d'un candidat", () => {
  it("reconnaît les vidéos et le ZIP par leurs premiers octets", () => {
    expect(familleSignature(ENTETE_MP4)).toBe("isobmff");
    expect(familleSignature(ENTETE_ZIP)).toBe("zip");
    expect(familleSignature(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0]))).toBe("ebml");
    expect(familleSignature(Buffer.from("RIFF\0\0\0\0AVI LIST", "latin1"))).toBe("avi");
    expect(familleSignature(ENTETE_EXE)).toBeNull();
    expect(familleSignature(Buffer.from([]))).toBeNull();
  });

  it("l'extension doit correspondre à la signature ; le type vient de l'extension, jamais du navigateur", () => {
    const ok = verifierDemandeDepotPersonne({ nom: "v.mov", taille: 10, entete: ENTETE_MP4 });
    expect(ok).toMatchObject({ ok: true, typeMime: "video/quicktime" });
    expect(verifierDemandeDepotPersonne({ nom: "v.zip", taille: 10, entete: ENTETE_MP4 }).ok).toBe(
      false,
    );
    expect(verifierDemandeDepotPersonne({ nom: "v.exe", taille: 10, entete: ENTETE_EXE }).ok).toBe(
      false,
    );
    expect(verifierDemandeDepotPersonne({ nom: "v.mp4", taille: 10, entete: null }).ok).toBe(false);
  });

  it("4 Go (tels qu'affichés) passent, un octet de plus non", () => {
    expect(
      verifierDemandeDepotPersonne({
        nom: "v.mp4",
        taille: TAILLE_MAX_DEPOT_PERSONNE_OCTETS,
        entete: ENTETE_MP4,
      }).ok,
    ).toBe(true);
    expect(
      verifierDemandeDepotPersonne({
        nom: "v.mp4",
        taille: TAILLE_MAX_DEPOT_PERSONNE_OCTETS + 1,
        entete: ENTETE_MP4,
      }).ok,
    ).toBe(false);
  });
});
