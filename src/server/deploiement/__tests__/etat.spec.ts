import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { commitEnService, ETATS, lireEtatDuDeploiement } from "../etat";

/**
 * **CE QUE CETTE GARDE VERROUILLE, ET POURQUOI CHAQUE CAS EXISTE.**
 *
 * Le piège de tout indicateur de déploiement est de rendre « tout va bien »
 * quand il n'a rien pu vérifier. Trois états servent précisément à l'empêcher —
 * `non-configure`, `indisponible`, `en-retard` — et chacun a son témoin ici.
 *
 * ⚠️ `fetch` est simulé, pas le module. Simuler `lireEtatDuDeploiement`
 *    reviendrait à tester le mock. Ce qu'on veut mesurer, c'est la LECTURE de
 *    ce que GitHub rend, y compris quand il rend une horreur.
 */

const SHA_DEPLOYE = "0a1b2c3d4e5f60718293a4b5c6d7e8f901234567";
const SHA_ANCIEN = "ffffffffffffffffffffffffffffffffffffffff";

const ENV_ORIGINE = { ...process.env };

function run(surcharge: Record<string, unknown> = {}): unknown {
  return {
    workflow_runs: [
      {
        id: 1,
        run_number: 4321,
        head_sha: SHA_DEPLOYE,
        head_branch: "main",
        status: "completed",
        conclusion: "success",
        created_at: "2026-09-02T02:35:00Z",
        updated_at: "2026-09-02T03:00:00Z",
        display_title: "feat: quelque chose",
        ...surcharge,
      },
    ],
  };
}

function reponse(corps: unknown, status = 200): Response {
  return new Response(JSON.stringify(corps), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  process.env["GITHUB_READ_TOKEN"] = "jeton-de-garde-sans-valeur-reelle";
  process.env["BUILD_SHA"] = SHA_DEPLOYE;
});

afterEach(() => {
  process.env = { ...ENV_ORIGINE };
});

describe("sans jeton, l'état est « non-configure » — jamais une panne, jamais un succès", () => {
  it("ne fait AUCUN appel réseau et dit quelle variable poser", async () => {
    delete process.env["GITHUB_READ_TOKEN"];
    delete process.env["GH_DISPATCH_TOKEN"];
    const espion = vi.spyOn(globalThis, "fetch");

    const etat = await lireEtatDuDeploiement();

    console.info(`[deploiement] sans jeton → ${etat.etat}`);
    expect(etat.etat).toBe("non-configure");
    expect(etat.resume).toContain("GITHUB_READ_TOKEN");
    // ⚠️ Le point qui compte : on n'appelle pas une API privée sans jeton pour
    //    « voir ce qu'elle dit ». Elle dirait 404, et on lirait une absence de
    //    droit comme une absence de déploiement.
    expect(espion).not.toHaveBeenCalled();
  });

  it("se rabat sur le jeton de dispatch quand le jeton de lecture manque", async () => {
    delete process.env["GITHUB_READ_TOKEN"];
    process.env["GH_DISPATCH_TOKEN"] = "jeton-de-repli";
    const espion = vi.spyOn(globalThis, "fetch").mockResolvedValue(reponse(run()));

    const etat = await lireEtatDuDeploiement();

    expect(etat.etat).toBe("a-jour");
    expect(espion).toHaveBeenCalledOnce();
  });
});

describe("la concordance des commits — la seule question qui compte", () => {
  it("« a-jour » quand le commit déployé est celui qui est servi", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(reponse(run()));
    const etat = await lireEtatDuDeploiement();
    expect(etat.etat).toBe("a-jour");
    expect(etat.commit).toBe(SHA_DEPLOYE);
    expect(etat.commitEnService).toBe(SHA_DEPLOYE);
    expect(etat.dureeSecondes).toBe(1500);
    expect(etat.numeroDeRun).toBe(4321);
  });

  it("« en-retard » quand le run a réussi mais qu'un AUTRE commit est servi", async () => {
    process.env["BUILD_SHA"] = SHA_ANCIEN;
    vi.spyOn(globalThis, "fetch").mockResolvedValue(reponse(run()));

    const etat = await lireEtatDuDeploiement();

    console.info(`[deploiement] run vert + commit différent → ${etat.etat}`);
    // ⚠️ C'EST LE CAS QUI JUSTIFIE L'OUTIL. Un run vert seul dirait « déployé »,
    //    et Will chercherait sa modification dans une page qui ne l'a pas.
    expect(etat.etat).toBe("en-retard");
    expect(etat.resume).toContain("autre commit");
  });

  it("un BUILD_SHA abrégé concorde avec le SHA complet de GitHub", async () => {
    process.env["BUILD_SHA"] = SHA_DEPLOYE.slice(0, 7);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(reponse(run()));
    expect((await lireEtatDuDeploiement()).etat).toBe("a-jour");
  });

  it("« dev » n'est pas un commit : la concordance est DÉCLARÉE non vérifiée", async () => {
    process.env["BUILD_SHA"] = "dev";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(reponse(run()));

    const etat = await lireEtatDuDeploiement();

    expect(commitEnService()).toBeNull();
    expect(etat.etat).toBe("a-jour");
    // Le mot compte : « n'est pas vérifiée » plutôt qu'un silence.
    expect(etat.resume).toContain("n'est pas vérifiée");
    expect(etat.commitEnService).toBeNull();
  });
});

describe("les états que GitHub impose", () => {
  it("« en-cours » tant que le run n'est pas terminé, et « echec » sur toute autre conclusion", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      reponse(run({ status: "in_progress", conclusion: null })),
    );
    const enCours = await lireEtatDuDeploiement();
    expect(enCours.etat).toBe("en-cours");
    expect(enCours.termineLe).toBeNull();

    for (const conclusion of ["failure", "cancelled", "timed_out", "startup_failure"]) {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(reponse(run({ conclusion })));
      const echec = await lireEtatDuDeploiement();
      expect(echec.etat, conclusion).toBe("echec");
      expect(echec.resume, conclusion).toContain(conclusion);
    }
    console.info("[deploiement] 4 conclusion(s) d'échec confrontée(s), toutes en « echec »");
  });
});

describe("ce que rend une API qui ne coopère pas — jamais « a-jour » par défaut", () => {
  const cas: readonly [string, () => void, string][] = [
    [
      "404 (dépôt privé, jeton sans portée actions:read)",
      () => void vi.spyOn(globalThis, "fetch").mockResolvedValue(reponse({}, 404)),
      "actions: read",
    ],
    [
      "500",
      () => void vi.spyOn(globalThis, "fetch").mockResolvedValue(reponse({}, 500)),
      "HTTP 500",
    ],
    [
      "corps illisible",
      () =>
        void vi
          .spyOn(globalThis, "fetch")
          .mockResolvedValue(new Response("pas du json", { status: 200 })),
      "illisible",
    ],
    [
      "aucun run",
      () => void vi.spyOn(globalThis, "fetch").mockResolvedValue(reponse({ workflow_runs: [] })),
      "aucun run",
    ],
    [
      "réseau coupé",
      () =>
        void vi
          .spyOn(globalThis, "fetch")
          .mockRejectedValue(Object.assign(new Error("timeout"), { name: "TimeoutError" })),
      "n'a pas répondu",
    ],
  ];

  it("rend « indisponible » dans les cinq cas, en DISANT lequel", async () => {
    let mesures = 0;
    for (const [nom, poser, attendu] of cas) {
      vi.restoreAllMocks();
      poser();
      const etat = await lireEtatDuDeploiement();
      expect(etat.etat, nom).toBe("indisponible");
      expect(etat.resume, nom).toContain(attendu);
      // Aucun état de panne ne doit inventer un commit.
      expect(etat.commit, nom).toBeNull();
      mesures += 1;
    }
    console.info(`[deploiement] ${String(mesures)} panne(s) confrontée(s), toutes nommées`);
    expect(mesures).toBe(cas.length);
  });
});

describe("l'appel lui-même", () => {
  it("interroge le workflow de DÉPLOIEMENT par son nom de fichier, pas « le dernier run »", async () => {
    const espion = vi.spyOn(globalThis, "fetch").mockResolvedValue(reponse(run()));
    await lireEtatDuDeploiement();

    const url = String(espion.mock.calls[0]?.[0]);
    console.info(`[deploiement] ${url}`);
    // ⚠️ Le défaut déjà payé dans ce dossier : une veille qui désigne sa cible
    //    par « le dernier » verrouille le mauvais run. Ici la cible est épinglée
    //    par le NOM du workflow.
    expect(url).toContain("/actions/workflows/deploy-coolify.yml/runs");
    expect(url).toContain("per_page=1");

    const options = espion.mock.calls[0]?.[1] as RequestInit;
    const entetes = options.headers as Record<string, string>;
    expect(entetes["X-GitHub-Api-Version"]).toBe("2022-11-28");
    expect(options.cache).toBe("no-store");
    expect(options.signal).toBeDefined();
  });

  it("ne fait JAMAIS fuiter le jeton dans ce qu'il rend", async () => {
    process.env["GITHUB_READ_TOKEN"] = "jeton-tres-secret-a-ne-pas-voir";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(reponse({}, 404));

    const etat = await lireEtatDuDeploiement();

    // Le nom de la variable a le droit de sortir — il dit quoi corriger.
    // Sa VALEUR, jamais.
    expect(JSON.stringify(etat)).not.toContain("jeton-tres-secret");
    expect(etat.resume).toContain("GITHUB_READ_TOKEN");
  });
});

describe("l'énumération des états", () => {
  it("porte exactement les six états, et aucun n'est un fourre-tout muet", () => {
    expect([...ETATS]).toEqual([
      "a-jour",
      "en-retard",
      "en-cours",
      "echec",
      "non-configure",
      "indisponible",
    ]);
  });
});
