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
let relancees: ReadonlySet<string> | null = new Set();
let envoyer: ReturnType<typeof vi.fn>;
function deps(
  registre: DeclarationCampagne[],
  etats = allumes("dossier_en_ligne", "relances_auto"),
): Partial<DependancesPassage> {
  return {
    registre,
    lireInterrupteurs: async () => etats,
    relanceesAujourdhui: async () => relancees,
    dejaTente: async (k) => tentes.has(k),
    envoyer: envoyer as unknown as DependancesPassage["envoyer"],
  };
}

beforeEach(() => {
  tentes.clear();
  relancees = new Set();
  envoyer = vi.fn(async (e: { jobId: string }) => {
    tentes.add(e.jobId);
    return "envoye";
  });
});

describe("livré éteint", () => {
  // Le registre était vide à la livraison de CAMP-3 ; chaque lot y inscrit sa séquence
  // (L6 : S3 ; L13b : S6 et S6 bis). Ce qui reste vrai : interrupteurs absents, aucune
  // campagne déclarée n'est active.
  it("chaque campagne déclarée est éteinte quand ses interrupteurs sont absents", () => {
    const etats = etatsParDefaut() as Record<string, unknown>;
    for (const c of REGISTRE_CAMPAGNES) {
      expect(c.interrupteurs.some((cle) => etats[cle] !== true)).toBe(true);
    }
  });
  it("le registre ne porte que des campagnes déclarées par leur lot (S3 : L6, S6 : L13b, S1 : L-INV), toutes sous interrupteur", () => {
    expect(REGISTRE_CAMPAGNES.map((c) => c.id)).toEqual([
      "dossier-relance",
      "vigilance",
      "piece",
      "invit-relance",
      "contrat-relance",
      "contrat-version-relance",
      "lettre-1re",
      "lettre-j3",
      "nda-a-transmettre",
    ]);
    for (const c of REGISTRE_CAMPAGNES) expect(c.interrupteurs.length).toBeGreaterThan(0);
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
  it("lot C : le payload est complété AU MOMENT de l'envoi ; `null` = rien ne part", async () => {
    const complet = vi.fn(async (p: Record<string, unknown>) => ({
      ...p,
      lien: "https://x.invalid/l",
    }));
    await passerCampagnes(
      MAINTENANT,
      deps([
        campagne("dossier", [faits(1, { payload: { prenom: "A" }, completerPayload: complet })]),
      ]),
    );
    expect(complet).toHaveBeenCalledTimes(1);
    expect(envoyer).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { prenom: "A", lien: "https://x.invalid/l", etape: 1 } }),
    );
    envoyer.mockClear();
    const b = await passerCampagnes(
      MAINTENANT,
      deps([campagne("dossier", [faits(2, { completerPayload: async () => null })])]),
    );
    expect(envoyer).not.toHaveBeenCalled();
    expect(b.ecartes["payload-indisponible"]).toBe(1);
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

describe("une relance par personne et par jour, toutes campagnes", () => {
  it("une fiche déjà relancée aujourd'hui (journal ou corbeille) n'est pas relancée", async () => {
    relancees = new Set(["t1"]);
    await passerCampagnes(MAINTENANT, deps([campagne("dossier", [faits(1), faits(2)])]));
    expect(envoyer).toHaveBeenCalledTimes(1);
    expect((envoyer.mock.calls[0]![0] as { entityId: string }).entityId).toBe("t2");
  });
  it("journal illisible : rien ne part", async () => {
    relancees = null;
    const b = await passerCampagnes(MAINTENANT, deps([campagne("dossier", [faits(1)])]));
    expect(envoyer).not.toHaveBeenCalled();
    expect(b.ecartes["journal-illisible"]).toBe(1);
  });
});

describe("bilan et pannes", () => {
  it("une relance garée est comptée à part", async () => {
    envoyer.mockResolvedValue("en-validation");
    const b = await passerCampagnes(MAINTENANT, deps([campagne("dossier", [faits(1)])]));
    expect(b.envoyes).toBe(0);
    expect(b.gares).toBe(1);
  });
  it("au premier « indisponible », le passage s'arrête", async () => {
    envoyer.mockResolvedValue("indisponible");
    await passerCampagnes(MAINTENANT, deps([campagne("dossier", [faits(1), faits(2), faits(3)])]));
    expect(envoyer).toHaveBeenCalledTimes(1);
  });
  it("une décision qui lève n'emporte pas le passage", async () => {
    const casse = faits(1, { etat: etat({ envois: null as unknown as Date[] }) });
    const b = await passerCampagnes(MAINTENANT, deps([campagne("dossier", [casse, faits(2)])]));
    expect(envoyer).toHaveBeenCalledTimes(1);
    expect(b.ecartes["decision-impossible"]).toBe(1);
  });
});

describe("la clé d'une relance", () => {
  it("sans deux-points, sans adresse, 200 caractères au plus", () => {
    expect(cleRelance("dossier", "a:b", "o", "j3")).toBe("fi-dossier-a-b-o-j3");
    expect(cleRelance("x", "y".repeat(300), "o", "j3")).toHaveLength(200);
  });
});
