// CAMP-3 — Le passage des campagnes : chaque séquence × chaque motif = aucun envoi ;
// deux passages rejoués = zéro doublon ; une par personne ; plafond ; interrupteurs.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/server/email/outbox-service", () => ({ jobIdDejaGare: vi.fn() }));
vi.mock("@/server/qualiopi/formateurs-independants/envois", () => ({ envoyer: vi.fn() }));

import { ORDRE_MOTIFS_BLOQUANTS, type EtatCampagne } from "@/lib/relances/campagne";
import {
  etatsParDefaut,
  type EtatsInterrupteurs,
} from "@/server/qualiopi/formateurs-independants/interrupteurs";

import {
  PLAFOND_ENVOIS_PAR_PASSAGE,
  PRIORITE_RELANCE,
  passerCampagnes,
  type DependancesPassage,
} from "../passer-campagnes";
import {
  REGISTRE_CAMPAGNES,
  cleRelance,
  type DeclarationCampagne,
  type FaitsCampagne,
} from "../registre-campagnes";

const JOUR = 24 * 60 * 60 * 1000;
// Mardi 13 octobre 2026, 10 h à Paris (08:00 UTC).
const MAINTENANT = new Date("2026-10-13T08:00:00Z");

const REGLE = {
  etapes: [
    { id: "j3", delaiMs: 3 * JOUR },
    { id: "j7", delaiMs: 7 * JOUR },
  ],
  ecartMinMs: 3 * JOUR,
  silenceApresMs: 14 * JOUR,
  max: 2,
  unParJour: true,
  fenetre: { debut: 8, fin: 19, fuseau: "Europe/Paris" },
} as const;

function etat(over: Partial<EtatCampagne> = {}): EtatCampagne {
  return {
    efface: false,
    opposition: false,
    adresseMorte: false,
    close: false,
    actionFaite: false,
    reponseHumaine: false,
    origine: new Date(MAINTENANT.getTime() - 4 * JOUR),
    envois: [],
    derniereRelancePersonne: null,
    ...over,
  };
}

function faits(i: number, over: Partial<FaitsCampagne> = {}): FaitsCampagne {
  return {
    entityId: `t${i}`,
    personneId: `p${i}`,
    origineId: `o${i}`,
    destinataire: `p${i}@exemple.invalid`,
    etat: etat(),
    payload: {},
    ...over,
  };
}

function campagne(
  id: string,
  lignes: readonly FaitsCampagne[],
  over: Partial<DeclarationCampagne> = {},
): DeclarationCampagne {
  return {
    id,
    gabarit: "formateur-dossier-relance",
    entityType: "Trainer",
    classe: "B",
    regle: REGLE,
    interrupteurs: ["dossier_en_ligne", "relances_auto"],
    lireFaits: async () => lignes,
    ...over,
  };
}

function allumes(...cles: string[]): EtatsInterrupteurs {
  const e = etatsParDefaut() as Record<string, unknown>;
  for (const c of cles) e[c] = true;
  return e as EtatsInterrupteurs;
}

const tentes = new Set<string>();
let envoyer: ReturnType<typeof vi.fn>;
function deps(
  registre: DeclarationCampagne[],
  etats = allumes("dossier_en_ligne", "relances_auto"),
): Partial<DependancesPassage> {
  return {
    registre,
    lireInterrupteurs: async () => etats,
    dejaTente: async (k) => tentes.has(k),
    envoyer: envoyer as unknown as DependancesPassage["envoyer"],
  };
}

beforeEach(() => {
  tentes.clear();
  envoyer = vi.fn(async (e: { jobId: string }) => {
    tentes.add(e.jobId);
    return "envoye";
  });
});

describe("livré éteint", () => {
  it("le registre est vide à la livraison", () => {
    expect(REGISTRE_CAMPAGNES).toEqual([]);
  });
  it("interrupteurs absents : aucune campagne active, rien ne part", async () => {
    const b = await passerCampagnes(
      MAINTENANT,
      deps([campagne("dossier", [faits(1)])], etatsParDefaut()),
    );
    expect(b.campagnesActives).toBe(0);
    expect(envoyer).not.toHaveBeenCalled();
  });
  it("clé mère coupée : la campagne fille est suspendue", async () => {
    const b = await passerCampagnes(
      MAINTENANT,
      deps([campagne("dossier", [faits(1)])], allumes("relances_auto")),
    );
    expect(b.campagnesActives).toBe(0);
    expect(envoyer).not.toHaveBeenCalled();
  });
  it("hors de 8 h-19 h (Paris) : rien ne part", async () => {
    const nuit = new Date("2026-10-13T19:30:00Z"); // 21 h 30 à Paris
    const b = await passerCampagnes(nuit, deps([campagne("dossier", [faits(1)])]));
    expect(b.horsFenetre).toBe(true);
    expect(envoyer).not.toHaveBeenCalled();
  });
});

describe("chaque séquence × chaque motif = aucun envoi", () => {
  const DRAPEAU: Record<string, Partial<EtatCampagne>> = {
    efface: { efface: true },
    opposition: { opposition: true },
    "adresse-morte": { adresseMorte: true },
    close: { close: true },
    "action-faite": { actionFaite: true },
    "reponse-humaine": { reponseHumaine: true },
    plafond: {
      envois: [new Date(MAINTENANT.getTime() - 4 * JOUR), new Date(MAINTENANT.getTime() - JOUR)],
    },
    "fenetre-depassee": { origine: new Date(MAINTENANT.getTime() - 15 * JOUR) },
  };
  const SEQUENCES = ["A", "B", "C"] as const;
  it("la table couvre tous les motifs bloquants du moteur", () => {
    expect(Object.keys(DRAPEAU).sort()).toEqual([...ORDRE_MOTIFS_BLOQUANTS].sort());
  });
  for (const classe of SEQUENCES) {
    for (const motif of ORDRE_MOTIFS_BLOQUANTS) {
      it(`classe ${classe} × ${motif}`, async () => {
        const b = await passerCampagnes(
          MAINTENANT,
          deps([campagne(`s-${classe}`, [faits(1, { etat: etat(DRAPEAU[motif]) })], { classe })]),
        );
        expect(envoyer).not.toHaveBeenCalled();
        expect(b.ecartes[motif]).toBe(1);
      });
    }
  }
});

describe("anti-doublon et plafonds", () => {
  it("deux passages rejoués = zéro doublon", async () => {
    const reg = [campagne("dossier", [faits(1), faits(2)])];
    await passerCampagnes(MAINTENANT, deps(reg));
    await passerCampagnes(new Date(MAINTENANT.getTime() + 60 * 60 * 1000), deps(reg));
    expect(envoyer).toHaveBeenCalledTimes(2);
    const cles = envoyer.mock.calls.map((c) => (c[0] as { jobId: string }).jobId);
    expect(new Set(cles).size).toBe(2);
  });
  it("une relance déjà garée (corbeille) n'est jamais regarée", async () => {
    tentes.add(cleRelance("dossier", "t1", "o1", "j3"));
    await passerCampagnes(MAINTENANT, deps([campagne("dossier", [faits(1)])]));
    expect(envoyer).not.toHaveBeenCalled();
  });
  it("anti-doublon illisible : on ne relance pas", async () => {
    const d = { ...deps([campagne("dossier", [faits(1)])]), dejaTente: async () => null };
    const b = await passerCampagnes(MAINTENANT, d);
    expect(envoyer).not.toHaveBeenCalled();
    expect(b.ecartes["anti-doublon-illisible"]).toBe(1);
  });
  it("deux campagnes dues le même jour pour une personne = un seul e-mail, la classe B d'abord", async () => {
    const a = campagne("invit", [faits(1, { entityId: "a1" })], {
      classe: "A",
      gabarit: "formateur-invitation-relance",
    });
    const b = campagne("dossier", [faits(1)], { classe: "B" });
    await passerCampagnes(MAINTENANT, deps([a, b]));
    expect(envoyer).toHaveBeenCalledTimes(1);
    expect((envoyer.mock.calls[0]![0] as { gabarit: string }).gabarit).toBe(
      "formateur-dossier-relance",
    );
  });
  it(`au plus ${PLAFOND_ENVOIS_PAR_PASSAGE} envois par passage`, async () => {
    const lignes = Array.from({ length: 45 }, (_, i) => faits(i));
    const b = await passerCampagnes(MAINTENANT, deps([campagne("dossier", lignes)]));
    expect(envoyer).toHaveBeenCalledTimes(PLAFOND_ENVOIS_PAR_PASSAGE);
    expect(b.plafondAtteint).toBe(true);
  });
  it("chaque relance porte priority: 10, sa clé et son étape", async () => {
    await passerCampagnes(MAINTENANT, deps([campagne("dossier", [faits(1)])]));
    expect(envoyer).toHaveBeenCalledWith(
      expect.objectContaining({
        priority: PRIORITE_RELANCE,
        jobId: "fi-dossier-t1-o1-j3",
        entityType: "Trainer",
        entityId: "t1",
        payload: { etape: 1 },
      }),
    );
  });
  it("une lecture en échec saute la campagne, pas le passage", async () => {
    const casse = campagne("casse", [], {
      lireFaits: async () => {
        throw new Error("base");
      },
    });
    const b = await passerCampagnes(MAINTENANT, deps([casse, campagne("dossier", [faits(1)])]));
    expect(envoyer).toHaveBeenCalledTimes(1);
    expect(b.ecartes["lecture-impossible"]).toBe(1);
  });
});

describe("la clé d'une relance", () => {
  it("sans deux-points, sans adresse, 200 caractères au plus", () => {
    expect(cleRelance("dossier", "a:b", "o", "j3")).toBe("fi-dossier-a-b-o-j3");
    expect(cleRelance("x", "y".repeat(300), "o", "j3")).toHaveLength(200);
  });
});
