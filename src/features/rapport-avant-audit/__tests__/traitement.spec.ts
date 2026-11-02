/**
 * Traitement d'un lancement par le worker : interrupteur, fournisseur non branché, arrêt
 * (reprise propre, sans erreur), succès (résultat chiffré), aucune écriture sur `clients`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
// La chaîne lire-collecte → serveur → message-affichable atteint `@/auth` (next-auth) : hors sujet ici.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
const exec = vi.hoisted(() => ({ executerRapport: vi.fn() }));
vi.mock("../executer", async (orig) => ({
  ...(await orig<typeof import("../executer")>()),
  executerRapport: exec.executerRapport,
}));

import type { CollecteReponses } from "../collecte";
import { FournisseurNonBranche, obtenirFournisseur } from "../fournisseur";
import { creerRapport, lireBaseAudit, type BaseRapports } from "../persistance";
import { traiterRapport, type DepsTraitement } from "../traitement";
import { baseValide, CLIENT_FIXTURE, fausseTable } from "./base.fixture";

const ENV0 = { ...process.env };
beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...ENV0, PII_ENCRYPTION_KEY: "d".repeat(64) };
});
afterEach(() => {
  process.env = { ...ENV0 };
});

function monter(over: Partial<DepsTraitement> = {}) {
  const table = fausseTable();
  const clientUpdate = vi.fn();
  const base = {
    rapportAvantAudit: table,
    client: {
      findUnique: vi.fn(async () => ({ raisonSociale: "Société d'exemple" })),
      update: clientUpdate,
      updateMany: clientUpdate,
    },
  } as unknown as DepsTraitement["base"];
  const fournisseur = vi.fn();
  const deps: DepsTraitement = {
    base,
    actif: () => true,
    lireCollecte: vi.fn(async (clientId: string) => ({
      clientId,
      fiches: [clientId],
      collecte: { questionnaires: [{ id: "q1" }] } as unknown as CollecteReponses,
    })),
    lireSuivi: vi.fn(async () => new Map()),
    obtenirFournisseur: async () => fournisseur,
    arretDemande: () => false,
    maintenant: () => new Date("2026-11-02T10:00:00Z"),
    ...over,
  };
  return { table, deps, clientUpdate, fournisseur, db: base as unknown as BaseRapports };
}

async function lancement(db: BaseRapports) {
  return (
    await creerRapport({ clientId: CLIENT_FIXTURE, questionnaireIds: ["q1"], lanceParId: null }, db)
  ).id;
}

describe("traiterRapport", () => {
  it("interrupteur éteint côté worker : la ligne passe en erreur, rien n'est lu ni appelé", async () => {
    const { deps, table, db } = monter({ actif: () => false });
    const id = await lancement(db);
    expect(await traiterRapport(id, deps)).toBe("eteint");
    expect(table.lignes[0]!.statut).toBe("erreur");
    expect(deps.lireCollecte).not.toHaveBeenCalled();
    expect(exec.executerRapport).not.toHaveBeenCalled();
  });

  it("fournisseur non branché : erreur lisible, aucun appel au moteur", async () => {
    const { deps, table, db } = monter({ obtenirFournisseur });
    const id = await lancement(db);
    expect(await traiterRapport(id, deps)).toBe("erreur");
    expect(table.lignes[0]!.erreur).toBe(new FournisseurNonBranche().message);
    expect(exec.executerRapport).not.toHaveBeenCalled();
  });

  it("succès : résultat chiffré, relu à l'identique ; la fiche client n'est jamais écrite", async () => {
    exec.executerRapport.mockImplementation(async (_d, opts) => {
      opts.surProgression?.({ etape: "Croisement", fait: 3, total: 6 });
      return { base: baseValide(), jetonsEntree: 1, jetonsSortie: 2, nbRecherches: 0 };
    });
    const { deps, table, clientUpdate, db } = monter();
    const id = await lancement(db);
    expect(await traiterRapport(id, deps)).toBe("termine");
    expect(table.lignes[0]!.statut).toBe("termine");
    expect(await lireBaseAudit(id, db)).toEqual(baseValide());
    expect(clientUpdate).not.toHaveBeenCalled();
  });

  it("arrêt demandé (SIGTERM) : la ligne repasse en attente, SANS erreur", async () => {
    let arret = false;
    exec.executerRapport.mockImplementation(async (_d, opts) => {
      arret = true;
      return opts.fournisseur({ system: "", user: "", modele: "m", recherche: false });
    });
    const { deps, table, db } = monter({ arretDemande: () => arret });
    const id = await lancement(db);
    expect(await traiterRapport(id, deps)).toBe("interrompu");
    expect(table.lignes[0]!.statut).toBe("en_attente");
    expect(table.lignes[0]!.erreur).toBeNull();
  });

  it("une erreur inconnue n'écrit que son NOM (jamais un message qui pourrait porter une réponse)", async () => {
    exec.executerRapport.mockRejectedValue(new TypeError("réponse de Sandra : je déteste Excel"));
    const { deps, table, db } = monter();
    const id = await lancement(db);
    expect(await traiterRapport(id, deps)).toBe("erreur");
    expect(String(table.lignes[0]!.erreur)).not.toContain("Sandra");
    expect(String(table.lignes[0]!.erreur)).toContain("TypeError");
  });

  it("un doublon de file ne refait pas un lancement déjà pris", async () => {
    exec.executerRapport.mockResolvedValue({
      base: baseValide(),
      jetonsEntree: 0,
      jetonsSortie: 0,
      nbRecherches: 0,
    });
    const { deps, db } = monter();
    const id = await lancement(db);
    expect(await traiterRapport(id, deps)).toBe("termine");
    expect(await traiterRapport(id, deps)).toBe("deja_pris");
    expect(exec.executerRapport).toHaveBeenCalledTimes(1);
  });
});
