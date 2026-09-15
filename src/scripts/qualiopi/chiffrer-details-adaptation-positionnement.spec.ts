// @vitest-environment node
/**
 * T7 à T13 — script de rattrapage : chiffrer en place la précision de santé des
 * anciens positionnements (RGPD art. 9). Base SIMULÉE en mémoire, chiffrement
 * RÉEL (`pii-crypto`) avec une clé de test.
 */

import { readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { decryptPii, encryptPii, isEncryptedPii } from "@/lib/pii-crypto";
import {
  CLE_DETAIL_ADAPTATION_CHIFFRE,
  CLE_DETAIL_ADAPTATION_CLAIR,
} from "@/server/qualiopi/positionnement/lecture-positionnement";
import {
  ACTION_LIGNE,
  ACTION_PASSE,
  POLITIQUE,
  main,
  type ClientRattrapage,
  type CryptoRattrapage,
  type EntreeJournal,
} from "./chiffrer-details-adaptation-positionnement";

const CLE_TEST = "0123456789abcdef".repeat(4);
const AUTRE_CLE = "fedcba9876543210".repeat(4);
const URL_TEST = "postgresql://test:test@localhost:5432/rattrapage_test";
/** Texte volontairement reconnaissable : il ne doit sortir NULLE PART. */
const TEXTE_SANTE = "Fauteuil roulant, salle au rez-de-chaussée";
const AUTRE_TEXTE = "Documents en gros caractères";

const ID1 = "00000000-0000-0000-0000-000000000001";
const ID2 = "00000000-0000-0000-0000-000000000002";
const ID3 = "00000000-0000-0000-0000-000000000003";
const ID4 = "00000000-0000-0000-0000-000000000004";

interface Ligne {
  id: string;
  type: string;
  reponses: Record<string, unknown>;
}

interface OptionsBase {
  temoin?: string | null;
  /** L'UPDATE rend 0 ligne touchée. */
  zeroLigne?: boolean;
  /** L'UPDATE lève une erreur dont le MESSAGE recopie ce texte (comme Prisma). */
  leverAvecMessage?: string;
}

function porte(r: unknown, cle: string): boolean {
  return typeof r === "object" && r !== null && Object.prototype.hasOwnProperty.call(r, cle);
}

function marqueur(requete: TemplateStringsArray): string {
  return /\/\* rattrapage:([a-z-]+) \*\//.exec(requete.join("$x"))?.[1] ?? "inconnue";
}

/** Base simulée : applique à la main ce que chaque requête marquée fait en SQL. */
function creerBase(lignes: Ligne[], options: OptionsBase = {}) {
  const etat = {
    lignes: new Map(lignes.map((l) => [l.id, structuredClone(l)])),
    journal: [] as EntreeJournal[],
  };
  const sqlEcritures: string[] = [];
  const sqlLectures: string[] = [];

  const trier = () => [...etat.lignes.values()].sort((a, b) => (a.id < b.id ? -1 : 1));

  const $queryRaw = vi.fn(async (requete: TemplateStringsArray, ...valeurs: unknown[]) => {
    sqlLectures.push(requete.join("$x"));
    const m = marqueur(requete);
    const positionnementsAvec = (cle: string, curseur: unknown, lot: unknown) =>
      trier()
        .filter(
          (l) => l.type === "positionnement" && porte(l.reponses, cle) && l.id > String(curseur),
        )
        .slice(0, Number(lot));
    switch (m) {
      case "temoin":
        return options.temoin ? [{ valeur: options.temoin }] : [];
      case "lister-ids":
        return positionnementsAvec(CLE_DETAIL_ADAPTATION_CLAIR, valeurs[0], valeurs[1]).map(
          (l) => ({ id: l.id }),
        );
      case "lister-reponses":
        return positionnementsAvec(CLE_DETAIL_ADAPTATION_CLAIR, valeurs[0], valeurs[1]).map(
          (l) => ({
            id: l.id,
            reponses: structuredClone(l.reponses),
          }),
        );
      case "lister-chiffres":
        return positionnementsAvec(CLE_DETAIL_ADAPTATION_CHIFFRE, valeurs[0], valeurs[1]).map(
          (l) => ({
            id: l.id,
            chiffre: l.reponses[CLE_DETAIL_ADAPTATION_CHIFFRE],
          }),
        );
      case "verrouiller": {
        const l = etat.lignes.get(String(valeurs[0]));
        return l && l.type === "positionnement" ? [{ reponses: structuredClone(l.reponses) }] : [];
      }
      case "etat":
        return [
          {
            deja_chiffres: BigInt(
              trier().filter(
                (l) =>
                  l.type === "positionnement" && porte(l.reponses, CLE_DETAIL_ADAPTATION_CHIFFRE),
              ).length,
            ),
            hors_positionnement: 0n,
          },
        ];
      case "fiches":
        return [
          {
            fiche_porte_deja_un_detail: 0n,
            fiche_vide: 1n,
            situation_handicap_non_posee: 1n,
            stagiaire_anonymise: 0n,
          },
        ];
      default:
        throw new Error(`requête inconnue du simulacre : ${m}`);
    }
  });

  const $executeRaw = vi.fn(async (requete: TemplateStringsArray, ...valeurs: unknown[]) => {
    sqlEcritures.push(requete.join("$x"));
    if (marqueur(requete) !== "chiffrer") throw new Error("écriture inconnue du simulacre");
    if (options.leverAvecMessage !== undefined) {
      throw new Error(
        `Invalid prisma.$executeRaw() invocation: params ${options.leverAvecMessage}`,
      );
    }
    if (options.zeroLigne) return 0;
    const [chiffre, id] = valeurs;
    const l = etat.lignes.get(String(id));
    if (
      !l ||
      l.type !== "positionnement" ||
      !porte(l.reponses, CLE_DETAIL_ADAPTATION_CLAIR) ||
      porte(l.reponses, CLE_DETAIL_ADAPTATION_CHIFFRE)
    ) {
      return 0;
    }
    const { [CLE_DETAIL_ADAPTATION_CLAIR]: _retire, ...reste } = l.reponses;
    l.reponses = { ...reste, [CLE_DETAIL_ADAPTATION_CHIFFRE]: chiffre };
    return 1;
  });

  const create = vi.fn(async (args: { data: EntreeJournal }) => {
    etat.journal.push(structuredClone(args.data));
    return { id: "log" };
  });

  const tx = { $queryRaw, $executeRaw, activityLog: { create } };

  const $transaction = vi.fn(
    async <R>(traitement: (t: typeof tx) => Promise<R>, _options?: { timeout?: number }) => {
      const lignesAvant = structuredClone([...etat.lignes]);
      const journalAvant = structuredClone(etat.journal);
      try {
        return await traitement(tx);
      } catch (err) {
        etat.lignes = new Map(lignesAvant);
        etat.journal = journalAvant;
        throw err;
      }
    },
  );

  const client = { ...tx, $transaction, $disconnect: vi.fn(async () => undefined) };
  return {
    client: client as unknown as ClientRattrapage,
    etat,
    $queryRaw,
    $executeRaw,
    create,
    $transaction,
    sqlEcritures,
    sqlLectures,
  };
}

const vraiCrypto: CryptoRattrapage = { encryptPii, decryptPii, isEncryptedPii };

function lignesDeDepart(): Ligne[] {
  return [
    {
      id: ID1,
      type: "positionnement",
      reponses: { besoinAdaptation: true, [CLE_DETAIL_ADAPTATION_CLAIR]: TEXTE_SANTE },
    },
    {
      id: ID2,
      type: "positionnement",
      reponses: { besoinAdaptation: true, [CLE_DETAIL_ADAPTATION_CLAIR]: AUTRE_TEXTE },
    },
    {
      id: ID3,
      type: "positionnement",
      reponses: { besoinAdaptation: true, [CLE_DETAIL_ADAPTATION_CLAIR]: "  " },
    },
    { id: ID4, type: "positionnement", reponses: { besoinAdaptation: false } },
  ];
}

/** Témoin écrit « par le site » avec la clé en vigueur. */
function temoinDuSite(): string {
  return encryptPii("valeur écrite par le site");
}

let espions: Array<ReturnType<typeof vi.spyOn>> = [];

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", URL_TEST);
  vi.stubEnv("PII_ENCRYPTION_KEY", CLE_TEST);
  espions = (["log", "error", "warn", "info", "debug"] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation(() => undefined),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function sortieConsole(): string {
  return JSON.stringify(espions.map((e) => e.mock.calls));
}

describe("T7 — essai à blanc par défaut : aucune écriture", () => {
  it("sans --appliquer : 0 $executeRaw, 0 journal, 0 transaction, et les compteurs sortent", async () => {
    const base = creerBase(lignesDeDepart(), { temoin: temoinDuSite() });

    const code = await main([], { prisma: base.client, crypto: vraiCrypto });

    expect(code).toBe(0);
    expect(base.$executeRaw).not.toHaveBeenCalled();
    expect(base.create).not.toHaveBeenCalled();
    expect(base.$transaction).not.toHaveBeenCalled();
    expect(sortieConsole()).toContain("a_chiffrer=2");
    expect(sortieConsole()).toContain("anomalie_vide=1");
    expect(base.etat.lignes.get(ID1)!.reponses[CLE_DETAIL_ADAPTATION_CLAIR]).toBe(TEXTE_SANTE);
  });
});

describe("T8 — refus au démarrage : sortie en erreur, 0 écriture", () => {
  const cas: Array<[string, () => void]> = [
    [
      "DATABASE_URL du stub de build",
      () => vi.stubEnv("DATABASE_URL", "postgresql://stub:stub@stub.invalid:5432/stub"),
    ],
    ["DATABASE_URL absente", () => vi.stubEnv("DATABASE_URL", "")],
    ["clé absente", () => vi.stubEnv("PII_ENCRYPTION_KEY", "")],
    ["clé mal formée", () => vi.stubEnv("PII_ENCRYPTION_KEY", "abc123")],
  ];

  for (const [nom, preparer] of cas) {
    it(`${nom} → code 2, aucune requête`, async () => {
      const base = creerBase(lignesDeDepart(), { temoin: temoinDuSite() });
      preparer();

      const code = await main(["--appliquer"], { prisma: base.client, crypto: vraiCrypto });

      expect(code).toBe(2);
      expect(base.$queryRaw).not.toHaveBeenCalled();
      expect(base.$executeRaw).not.toHaveBeenCalled();
      expect(base.create).not.toHaveBeenCalled();
    });
  }

  it("clé différente de celle du site (le témoin ne se déchiffre pas) → code 2, 0 écriture", async () => {
    vi.stubEnv("PII_ENCRYPTION_KEY", AUTRE_CLE);
    const temoinAutreCle = encryptPii("valeur écrite par le site");
    vi.stubEnv("PII_ENCRYPTION_KEY", CLE_TEST);
    const base = creerBase(lignesDeDepart(), { temoin: temoinAutreCle });

    const code = await main(["--appliquer"], { prisma: base.client, crypto: vraiCrypto });

    expect(code).toBe(2);
    expect(base.$executeRaw).not.toHaveBeenCalled();
    expect(base.create).not.toHaveBeenCalled();
  });

  it("sonde : un chiffrement qui rend le clair est refusé avant toute lecture", async () => {
    const base = creerBase(lignesDeDepart(), { temoin: temoinDuSite() });
    const code = await main(["--appliquer"], {
      prisma: base.client,
      crypto: { ...vraiCrypto, encryptPii: (s) => s },
    });
    expect(code).toBe(2);
    expect(base.$queryRaw).not.toHaveBeenCalled();
  });

  it("aucun mode inverse : --dechiffrer et --annuler sont refusés", async () => {
    for (const arg of ["--dechiffrer", "--annuler"]) {
      const base = creerBase(lignesDeDepart(), { temoin: temoinDuSite() });
      expect(await main([arg], { prisma: base.client, crypto: vraiCrypto })).toBe(2);
      expect(base.$queryRaw).not.toHaveBeenCalled();
    }
  });
});

describe("T9 — la clé disparaît entre la sonde et la ligne : arrêt, 0 écriture", () => {
  it("encryptPii rend du clair au 2ᵉ appel → passe arrêtée, ligne intacte, aucun journal de ligne", async () => {
    const base = creerBase(lignesDeDepart(), { temoin: temoinDuSite() });
    let appels = 0;
    const crypto: CryptoRattrapage = {
      ...vraiCrypto,
      encryptPii: (s) => (appels++ === 0 ? encryptPii(s) : s),
    };

    const code = await main(["--appliquer"], { prisma: base.client, crypto });

    expect(code).toBe(1);
    expect(base.$executeRaw).not.toHaveBeenCalled();
    expect(base.etat.journal.filter((j) => j.action === ACTION_LIGNE)).toEqual([]);
    expect(base.etat.lignes.get(ID1)!.reponses[CLE_DETAIL_ADAPTATION_CLAIR]).toBe(TEXTE_SANTE);
    expect(base.etat.lignes.get(ID1)!.reponses).not.toHaveProperty(CLE_DETAIL_ADAPTATION_CHIFFRE);
  });
});

describe("T10 — UPDATE qui ne touche aucune ligne : erreur, annulation, pas de journal", () => {
  it("0 ligne touchée → code 1, transaction annulée, ligne intacte, aucun journal de ligne", async () => {
    const base = creerBase(lignesDeDepart(), { temoin: temoinDuSite(), zeroLigne: true });

    const code = await main(["--appliquer"], { prisma: base.client, crypto: vraiCrypto });

    expect(code).toBe(1);
    expect(base.$transaction).toHaveBeenCalledTimes(1);
    expect(base.etat.lignes.get(ID1)!.reponses[CLE_DETAIL_ADAPTATION_CLAIR]).toBe(TEXTE_SANTE);
    expect(base.etat.journal.filter((j) => j.action === ACTION_LIGNE)).toEqual([]);
    expect(base.etat.journal).toEqual([
      expect.objectContaining({
        action: ACTION_PASSE,
        changes: expect.objectContaining({ echecs: 1, chiffres: 0 }),
      }),
    ]);
  });
});

describe("chemin nominal — chiffrer en place, vérifier", () => {
  it("--appliquer chiffre les deux textes, laisse l'anomalie, journalise chaque ligne ; --verifier rend ok=2", async () => {
    const base = creerBase(lignesDeDepart(), { temoin: temoinDuSite() });

    expect(await main(["--appliquer"], { prisma: base.client, crypto: vraiCrypto })).toBe(0);

    const l1 = base.etat.lignes.get(ID1)!.reponses;
    expect(l1).not.toHaveProperty(CLE_DETAIL_ADAPTATION_CLAIR);
    expect(l1["besoinAdaptation"]).toBe(true);
    expect(isEncryptedPii(l1[CLE_DETAIL_ADAPTATION_CHIFFRE])).toBe(true);
    expect(decryptPii(l1[CLE_DETAIL_ADAPTATION_CHIFFRE] as string)).toBe(TEXTE_SANTE);
    expect(base.etat.lignes.get(ID3)!.reponses[CLE_DETAIL_ADAPTATION_CLAIR]).toBe("  ");
    expect(
      base.etat.journal.filter((j) => j.action === ACTION_LIGNE).map((j) => j.targetId),
    ).toEqual([ID1, ID2]);

    espions.forEach((e) => e.mockClear());
    expect(await main(["--verifier"], { prisma: base.client, crypto: vraiCrypto })).toBe(0);
    expect(sortieConsole()).toContain("ok=2 ko=0 en_clair_restant=0");
  });

  it("--limite=1 : une seule ligne chiffrée", async () => {
    const base = creerBase(lignesDeDepart(), { temoin: temoinDuSite() });
    expect(
      await main(["--appliquer", "--limite=1"], { prisma: base.client, crypto: vraiCrypto }),
    ).toBe(0);
    expect(base.etat.journal.filter((j) => j.action === ACTION_LIGNE)).toHaveLength(1);
    expect(base.etat.lignes.get(ID2)!.reponses[CLE_DETAIL_ADAPTATION_CLAIR]).toBe(AUTRE_TEXTE);
  });

  it("--verifier compte ko une valeur qui ne se déchiffre pas", async () => {
    const base = creerBase(
      [
        {
          id: ID1,
          type: "positionnement",
          reponses: { [CLE_DETAIL_ADAPTATION_CHIFFRE]: "enc:v1:00:11:22" },
        },
      ],
      { temoin: temoinDuSite() },
    );
    expect(await main(["--verifier"], { prisma: base.client, crypto: vraiCrypto })).toBe(1);
    expect(sortieConsole()).toContain("ok=0 ko=1");
  });

  it("le SQL écrit ne vise que les clés nommées, exige FOR UPDATE et n'emploie pas l'opérateur `?`", async () => {
    const base = creerBase(lignesDeDepart(), { temoin: temoinDuSite() });
    await main(["--appliquer"], { prisma: base.client, crypto: vraiCrypto });

    const update = base.sqlEcritures[0]!;
    expect(update).toContain(`reponses - '${CLE_DETAIL_ADAPTATION_CLAIR}'`);
    expect(update).toContain(`jsonb_build_object('${CLE_DETAIL_ADAPTATION_CHIFFRE}'`);
    expect(update).toContain(`reponses->'${CLE_DETAIL_ADAPTATION_CHIFFRE}' IS NULL`);
    expect(
      base.sqlLectures.some(
        (s) => s.includes("rattrapage:verrouiller") && s.includes("FOR UPDATE"),
      ),
    ).toBe(true);
    for (const sql of [...base.sqlEcritures, ...base.sqlLectures])
      expect(sql).not.toMatch(/\?\s*'/);
  });
});

describe("🔴 T11 — le texte d'origine ne sort NULLE PART", () => {
  it("ni console, ni journal, ni message d'erreur — y compris quand Prisma recopie ses paramètres", async () => {
    const scenarios: Array<{ argv: string[]; options: OptionsBase; crypto?: CryptoRattrapage }> = [
      { argv: [], options: {} },
      { argv: ["--appliquer"], options: {} },
      { argv: ["--verifier"], options: {} },
      { argv: ["--appliquer"], options: { zeroLigne: true } },
      { argv: ["--appliquer"], options: { leverAvecMessage: TEXTE_SANTE } },
    ];

    for (const s of scenarios) {
      espions.forEach((e) => e.mockClear());
      const base = creerBase(lignesDeDepart(), { temoin: temoinDuSite(), ...s.options });

      await main(s.argv, { prisma: base.client, crypto: s.crypto ?? vraiCrypto });

      const sortie = sortieConsole();
      expect(sortie, `console (${s.argv.join(" ")})`).not.toContain(TEXTE_SANTE);
      expect(sortie).not.toContain(AUTRE_TEXTE);
      expect(sortie).not.toContain("enc:v1:");

      const journaux = JSON.stringify(base.create.mock.calls);
      expect(journaux).not.toContain(TEXTE_SANTE);
      expect(journaux).not.toContain("enc:v1:");
      // Ni texte, ni longueur, ni extrait : la forme des `changes` est FERMÉE.
      for (const entree of base.etat.journal) {
        if (entree.action === ACTION_LIGNE) {
          expect(entree.changes).toEqual({ chiffre: true, politique: POLITIQUE });
        } else {
          expect(Object.keys(entree.changes).sort()).toEqual([
            "anomalies",
            "chiffres",
            "dejaChiffres",
            "echecs",
            "politique",
          ]);
        }
      }
    }
  });
});

describe("T12 — idempotence", () => {
  it("une deuxième exécution sur des lignes déjà chiffrées n'écrit rien", async () => {
    const base = creerBase(lignesDeDepart(), { temoin: temoinDuSite() });
    expect(await main(["--appliquer"], { prisma: base.client, crypto: vraiCrypto })).toBe(0);
    const apresPremiere = structuredClone([...base.etat.lignes]);
    base.$executeRaw.mockClear();
    base.create.mockClear();

    expect(await main(["--appliquer"], { prisma: base.client, crypto: vraiCrypto })).toBe(0);

    expect(base.$executeRaw).not.toHaveBeenCalled();
    expect(base.create).not.toHaveBeenCalled();
    expect([...base.etat.lignes]).toEqual(apresPremiere);
  });
});

describe("T13 — le graphe d'import du script reste exécutable par le worker", () => {
  const RACINE = resolve(__dirname, "../../..");
  const SRC = join(RACINE, "src");

  function resoudre(spec: string): string | null {
    if (!spec.startsWith("@/")) return null;
    const base = join(SRC, spec.slice(2));
    for (const cand of [`${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) {
      try {
        if (statSync(cand).isFile()) return cand;
      } catch {
        /* candidat suivant */
      }
    }
    return null;
  }

  function atteignables(depart: string): string[] {
    const vus = new Set<string>();
    const file = [depart];
    while (file.length > 0) {
      const f = file.pop()!;
      if (vus.has(f)) continue;
      vus.add(f);
      const source = readFileSync(f, "utf8");
      for (const re of [/\bfrom\s+["']([^"']+)["']/g, /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g]) {
        let m: RegExpExecArray | null;
        while ((m = re.exec(source)) !== null) {
          const cible = resoudre(m[1]!);
          if (cible !== null) file.push(cible);
        }
      }
    }
    return [...vus].map((f) => f.slice(RACINE.length + 1).replace(/\\/g, "/"));
  }

  it('ni `server-only`, ni `next/headers`, ni `"use server"` dans la fermeture transitive', () => {
    const modules = atteignables(join(__dirname, "chiffrer-details-adaptation-positionnement.ts"));

    // Témoin positif : la marche atteint vraiment les modules attendus.
    expect(modules).toContain("src/lib/pii-crypto.ts");
    expect(modules).toContain("src/lib/prisma.ts");
    expect(modules).toContain("src/server/qualiopi/positionnement/detail-adaptation-chiffre.ts");
    expect(modules).toContain("src/server/qualiopi/positionnement/lecture-positionnement.ts");

    const fautifs = modules.filter((f) => {
      const source = readFileSync(join(RACINE, f), "utf8");
      return (
        /^\s*import\s+["']server-only["']/m.test(source) ||
        /from\s+["']next\/headers["']/.test(source) ||
        /^\s*["']use server["']/m.test(source)
      );
    });
    expect(fautifs).toEqual([]);
  });
});
