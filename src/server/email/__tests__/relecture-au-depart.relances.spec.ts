/**
 * Vérification n° 2 (« parcours et e-mails ») — le FILET DU DÉPART des relances de
 * campagne aux formateurs indépendants (F9, F18, F45, F27, F21, F61) et du code F17.
 *
 * Une relance déjà en file, ou garée puis approuvée tard, est relue avec les règles du
 * passage qui l'a décidée :
 *   · V2-P-3 : ses interrupteurs, mère et filles — coupé, elle ne part pas ;
 *   · V2-P-1 : son objet — contrat signé, lettre signée, numéro transmis, bilan remis ;
 *   · V2-P-2 : la réponse du formateur depuis l'envoi de départ (règle du passage) ;
 *   · V2-P-4 : l'opposition, comme le moteur des campagnes ;
 *   · V2-P-7 : le code F17 expiré, servi ou remplacé ne part pas ;
 *   · V2-P-6 : F18 / F45 retenus alors que le contrat reste à signer rendent le lien
 *     précédent au formateur.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const pz = vi.hoisted(() => ({
  trainer: {} as Record<string, unknown>,
  opposition: null as unknown,
  contrat: null as unknown,
  dernierContrat: null as unknown,
  lettre: null as unknown,
  mission: null as unknown,
  bilan: null as unknown,
  code: null as unknown,
  reponses: [] as Array<{ trainerId: string; candidatureId: null; recuLe: Date }>,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainer: {
      findUnique: async () => pz.trainer,
      findMany: async () => [],
    },
    jobApplication: { findUnique: async () => null },
    emailOpposition: { findUnique: async () => pz.opposition },
    documentGenere: {
      findUnique: async (q: { where: { id: string } }) =>
        q.where.id.startsWith("lettre") ? pz.lettre : pz.contrat,
      findFirst: async () => pz.dernierContrat,
      findMany: async () => [{ id: "c1" }],
    },
    missionFormateur: { findFirst: async () => pz.mission },
    bilanFinFormation: { findUnique: async () => pz.bilan },
    documentSignatureCode: {
      findUnique: async () => pz.code,
      findFirst: async () => pz.code,
    },
    reponseEntranteFormateur: { findMany: async () => pz.reponses },
  },
}));
vi.mock("@/lib/security/email-hash", () => ({
  hashEmailForLookup: (e: string | null | undefined) => (e ? `h:${e}` : null),
}));
const it8 = vi.hoisted(() => ({
  etats: {} as Record<string, boolean>,
  signature: {} as Record<string, boolean>,
  entree: { reponses_formateurs: true, suivi_echange: true } as Record<string, boolean>,
}));
vi.mock("@/server/qualiopi/formateurs-independants/interrupteurs-etat", () => ({
  lireEtatsInterrupteurs: async () => it8.etats,
}));
vi.mock("@/server/qualiopi/formateurs-independants/interrupteur-allume", () => ({
  interrupteurAllume: async (cle: string) => it8.signature[cle] === true,
}));
vi.mock("@/server/qualiopi/formateurs-independants/etats-entree", () => ({
  lireEtatsEntree: async () => it8.entree,
}));
vi.mock("@/server/email/textes-valides-lecture", () => ({ lireTextesValides: async () => ({}) }));
vi.mock("@/server/email/textes-valides", async (original) => ({
  ...(await original<typeof import("@/server/email/textes-valides")>()),
  estTexteValide: () => true,
}));
const lp = vi.hoisted(() => ({
  ligne: null as unknown,
  rendre: vi.fn(),
}));
vi.mock("@/server/qualiopi/documents/signature/lien-precedent", () => ({
  ligneDuLien: async () => lp.ligne,
  rendreLienPrecedent: lp.rendre,
}));

import {
  GABARITS_RELANCE_DE_CAMPAGNE,
  RELECTURES_AU_DEPART,
  estRelanceDeCampagne,
} from "@/server/email/relecture-au-depart";
import { REGISTRE_CAMPAGNES } from "@/server/relances/registre-campagnes";

const T = "22222222-2222-4222-8222-222222222222";
const LIEN = "https://axion-ia.test/fr/portail/signer/jeton-neuf";
const DEPART = new Date(Date.now() - 5 * 86_400_000);

const lire = (template: string, payload: Record<string, unknown> = {}) => {
  const lecteur = RELECTURES_AU_DEPART.get(template);
  if (lecteur === undefined) throw new Error(`aucun lecteur pour ${template}`);
  return lecteur({
    template,
    to: "claire@exemple.fr",
    entityType: "Trainer",
    entityId: T,
    payload,
  });
};

const aSigner = { annuleeAt: null, statutSignature: "en_attente", signatures: [] };

beforeEach(() => {
  it8.etats = {
    textes_valides: true,
    dossier_en_ligne: true,
    relances_auto: true,
    contrat_auto: true,
    lettre_auto: true,
  };
  it8.signature = { nouvelle_version_contrat: true, bilan_fin_formation: true };
  it8.entree = { reponses_formateurs: true, suivi_echange: true };
  pz.trainer = {
    email: "claire@exemple.fr",
    finCollaborationAt: null,
    sousTraitantNda: "en cours",
    dossierStatut: "a_completer",
  };
  pz.opposition = null;
  pz.contrat = { ...aSigner };
  pz.dernierContrat = null;
  pz.lettre = { annuleeAt: null, statutSignature: "en_attente", signatures: [] };
  pz.mission = {
    session: { dateDebut: new Date(Date.now() + 10 * 86_400_000), statut: "planifiee" },
  };
  pz.bilan = null;
  pz.code = {
    expiresAt: new Date(Date.now() + 10 * 60_000),
    utiliseAt: null,
    invalideAt: null,
  };
  pz.reponses = [];
  lp.ligne = { documentGenereId: "c1" };
  lp.rendre.mockReset().mockResolvedValue(true);
});

const f18 = { lien: LIEN, etape: 1, departRelance: DEPART.toISOString() };
const f45relance = { lien: LIEN, etape: 2, departRelance: DEPART.toISOString() };
const f27 = {
  lien: "https://axion-ia.test/fr/espace-formateur?lettre=lettre-1",
  etape: 1,
  departRelance: DEPART.toISOString(),
};
const f61 = {
  lien: "https://axion-ia.test/fr/espace-formateur/sessions/s-1#fin-de-formation",
  etape: 1,
  departRelance: DEPART.toISOString(),
};

describe("le registre : chaque relance de campagne sur fiche a son lecteur au départ", () => {
  const PIECES = new Set(["vigilance", "piece", "seuil-urssaf"]);
  it("chaque campagne sur fiche formateur (hors pièces) est une relance relue", () => {
    for (const c of REGISTRE_CAMPAGNES.filter(
      (x) => x.entityType === "Trainer" && !PIECES.has(x.id),
    )) {
      const etape = c.regle.etapes[0]?.id ?? "";
      const variante = c.variante?.(etape) ?? 1;
      expect(estRelanceDeCampagne(c.gabarit, { etape: variante }), c.id).toBe(true);
      expect(RELECTURES_AU_DEPART.has(c.gabarit), c.id).toBe(true);
    }
  });
  it("F45 : l'envoi de départ (variante 1) n'est pas une relance ; les variantes 2 et 3 si", () => {
    expect(estRelanceDeCampagne("formateur-contrat-nouvelle-version", {})).toBe(false);
    expect(estRelanceDeCampagne("formateur-contrat-nouvelle-version", { etape: 2 })).toBe(true);
    expect(GABARITS_RELANCE_DE_CAMPAGNE.has("formateur-contrat-a-signer")).toBe(false);
  });
});

describe("F18 — relance du contrat-cadre", () => {
  it("rien n'a changé : part", async () => {
    expect(await lire("formateur-contrat-relance", f18)).toBeNull();
    expect(lp.rendre).not.toHaveBeenCalled();
  });
  it("V2-P-3 — `relances_auto` coupé : retenue, et le lien précédent est rendu", async () => {
    it8.etats.relances_auto = false;
    expect(await lire("formateur-contrat-relance", f18)).toMatch(/relances_auto/);
    expect(lp.rendre).toHaveBeenCalledWith(LIEN, "revoquer");
  });
  it("V2-P-3 — `dossier_en_ligne` (mère) coupé : retenue", async () => {
    it8.etats.dossier_en_ligne = false;
    expect(await lire("formateur-contrat-relance", f18)).toMatch(/dossier_en_ligne/);
  });
  it("V2-P-1 — contrat signé pendant l'attente : retenue, aucun lien rendu", async () => {
    pz.contrat = { ...aSigner, statutSignature: "signee" };
    expect(await lire("formateur-contrat-relance", f18)).toMatch(/déjà signé/);
    expect(lp.rendre).not.toHaveBeenCalled();
  });
  it("V2-P-1 — signature du formateur posée (statut encore partiel) : retenue", async () => {
    pz.contrat = { ...aSigner, statutSignature: "partielle", signatures: [{ id: "s" }] };
    expect(await lire("formateur-contrat-relance", f18)).toMatch(/déjà signé/);
  });
  it("V2-P-1 — contrat annulé : retenue", async () => {
    pz.contrat = { ...aSigner, annuleeAt: new Date() };
    expect(await lire("formateur-contrat-relance", f18)).toMatch(/annulé/);
  });
  it("sans lien dans le job : le dernier contrat de la fiche est relu", async () => {
    lp.ligne = null;
    pz.dernierContrat = { ...aSigner, statutSignature: "signee" };
    expect(await lire("formateur-contrat-relance", { etape: 1 })).toMatch(/déjà signé/);
    pz.dernierContrat = null;
    expect(await lire("formateur-contrat-relance", { etape: 1 })).toBeNull();
  });
  it("V2-P-2 — réponse APRÈS l'envoi de départ : retenue", async () => {
    pz.reponses = [{ trainerId: T, candidatureId: null, recuLe: new Date() }];
    expect(await lire("formateur-contrat-relance", f18)).toMatch(/a répondu/);
  });
  it("V2-P-2 — réponse AVANT l'envoi de départ : ne compte pas (règle du passage)", async () => {
    pz.reponses = [
      { trainerId: T, candidatureId: null, recuLe: new Date(DEPART.getTime() - 60_000) },
    ];
    expect(await lire("formateur-contrat-relance", f18)).toBeNull();
  });
  it("V2-P-2 — sans départ dans le job : une réponse récente retient", async () => {
    pz.reponses = [{ trainerId: T, candidatureId: null, recuLe: new Date() }];
    expect(await lire("formateur-contrat-relance", { lien: LIEN, etape: 1 })).toMatch(/a répondu/);
  });
  it("V2-P-2 — relevé des réponses coupé : rien n'est lu (comme le passage)", async () => {
    it8.entree.reponses_formateurs = false;
    pz.reponses = [{ trainerId: T, candidatureId: null, recuLe: new Date() }];
    expect(await lire("formateur-contrat-relance", f18)).toBeNull();
  });
  it("V2-P-4 — opposition pendant l'attente : retenue", async () => {
    pz.opposition = { id: "o" };
    expect(await lire("formateur-contrat-relance", f18)).toMatch(/opposée aux relances/);
  });
  it("fin de collaboration : retenue, aucun lien rendu", async () => {
    pz.trainer = { ...pz.trainer, finCollaborationAt: new Date() };
    expect(await lire("formateur-contrat-relance", f18)).toMatch(/fin de collaboration/);
    expect(lp.rendre).not.toHaveBeenCalled();
  });
});

describe("F45 — nouvelle version du contrat", () => {
  it("relance, rien n'a changé : part", async () => {
    expect(await lire("formateur-contrat-nouvelle-version", f45relance)).toBeNull();
  });
  it("V2-P-3 / V2-P-5 — `nouvelle_version_contrat` coupée : relance ET envoi de départ retenus", async () => {
    it8.signature.nouvelle_version_contrat = false;
    expect(await lire("formateur-contrat-nouvelle-version", f45relance)).toMatch(
      /nouvelle_version_contrat/,
    );
    expect(await lire("formateur-contrat-nouvelle-version", { lien: LIEN })).toMatch(
      /nouvelle_version_contrat/,
    );
  });
  it("V2-P-3 — `relances_auto` coupé : la relance est retenue, pas l'envoi de départ", async () => {
    it8.etats.relances_auto = false;
    expect(await lire("formateur-contrat-nouvelle-version", f45relance)).toMatch(/relances_auto/);
    expect(await lire("formateur-contrat-nouvelle-version", { lien: LIEN })).toBeNull();
  });
  it("V2-P-2 / V2-P-4 — réponse ou opposition : la relance seule est retenue", async () => {
    pz.reponses = [{ trainerId: T, candidatureId: null, recuLe: new Date() }];
    expect(await lire("formateur-contrat-nouvelle-version", f45relance)).toMatch(/a répondu/);
    expect(await lire("formateur-contrat-nouvelle-version", { lien: LIEN })).toBeNull();
    pz.reponses = [];
    pz.opposition = { id: "o" };
    expect(await lire("formateur-contrat-nouvelle-version", f45relance)).toMatch(/opposée/);
    expect(await lire("formateur-contrat-nouvelle-version", { lien: LIEN })).toBeNull();
  });
  it("V2-P-1 — nouvelle version signée : retenue", async () => {
    pz.contrat = { ...aSigner, statutSignature: "signee" };
    expect(await lire("formateur-contrat-nouvelle-version", f45relance)).toMatch(/déjà signé/);
  });
});

describe("F27 — relance de la lettre de mission", () => {
  it("rien n'a changé : part", async () => {
    expect(await lire("formateur-lettre-relance", f27)).toBeNull();
  });
  it("V2-P-3 — `lettre_auto`, ou sa mère `contrat_auto`, coupée : retenue", async () => {
    it8.etats.lettre_auto = false;
    expect(await lire("formateur-lettre-relance", f27)).toMatch(/lettre_auto/);
    it8.etats.lettre_auto = true;
    it8.etats.contrat_auto = false;
    expect(await lire("formateur-lettre-relance", f27)).toMatch(/contrat_auto/);
  });
  it("V2-P-1 — lettre signée par le formateur : retenue", async () => {
    pz.lettre = { annuleeAt: null, statutSignature: "partielle", signatures: [{ id: "s" }] };
    expect(await lire("formateur-lettre-relance", f27)).toMatch(/déjà signée/);
  });
  it("lettre annulée, ou mission commencée : retenue", async () => {
    pz.lettre = { annuleeAt: new Date(), statutSignature: "en_attente", signatures: [] };
    expect(await lire("formateur-lettre-relance", f27)).toMatch(/annulée/);
    pz.lettre = { annuleeAt: null, statutSignature: "en_attente", signatures: [] };
    pz.mission = { session: { dateDebut: new Date(Date.now() - 1000), statut: "planifiee" } };
    expect(await lire("formateur-lettre-relance", f27)).toMatch(/commencé/);
  });
  it("V2-P-2 — le formateur a répondu : retenue", async () => {
    pz.reponses = [{ trainerId: T, candidatureId: null, recuLe: new Date() }];
    expect(await lire("formateur-lettre-relance", f27)).toMatch(/a répondu/);
  });
  // Relecture de la PR #1550, non bloquant 1 — le passage n'écrit que pour une session
  // « planifiée » : le départ relit son statut.
  it("session annulée ou reportée pendant l'attente : retenue", async () => {
    const dans10j = new Date(Date.now() + 10 * 86_400_000);
    pz.mission = { session: { dateDebut: dans10j, statut: "annulee" } };
    expect(await lire("formateur-lettre-relance", f27)).toMatch(/plus planifiée/);
    pz.mission = { session: { dateDebut: dans10j, statut: "reportee" } };
    expect(await lire("formateur-lettre-relance", f27)).toMatch(/plus planifiée/);
  });
});

describe("F21 — numéro de déclaration d'activité", () => {
  it("toujours « en cours » : part", async () => {
    expect(await lire("formateur-nda-a-transmettre", { etape: 1 })).toBeNull();
  });
  it("V2-P-1 — numéro transmis : retenue", async () => {
    pz.trainer = { ...pz.trainer, sousTraitantNda: "84 69 12345 69" };
    expect(await lire("formateur-nda-a-transmettre", { etape: 1 })).toMatch(/plus « en cours »/);
  });
  it("V2-P-3 — `relances_auto` coupé : retenue", async () => {
    it8.etats.relances_auto = false;
    expect(await lire("formateur-nda-a-transmettre", { etape: 1 })).toMatch(/relances_auto/);
  });
});

describe("F61 — bilan de fin de formation", () => {
  it("bilan attendu : part", async () => {
    expect(await lire("formateur-bilan-fin-formation", f61)).toBeNull();
  });
  it("V2-P-3 — `bilan_fin_formation` coupé : retenue", async () => {
    it8.signature.bilan_fin_formation = false;
    expect(await lire("formateur-bilan-fin-formation", f61)).toMatch(/bilan_fin_formation/);
  });
  it("V2-P-1 — bilan terminé, ou « payer quand même » : retenue", async () => {
    pz.bilan = { termineAt: new Date(), payerQuandMemeAt: null };
    expect(await lire("formateur-bilan-fin-formation", f61)).toMatch(/déjà remis/);
    pz.bilan = { termineAt: null, payerQuandMemeAt: new Date() };
    expect(await lire("formateur-bilan-fin-formation", f61)).toMatch(/payer quand même/);
  });
});

describe("F9 — relance du dossier", () => {
  it("V2-P-2 — le formateur a répondu : retenue", async () => {
    expect(await lire("formateur-dossier-relance", { etape: 1 })).toBeNull();
    pz.reponses = [{ trainerId: T, candidatureId: null, recuLe: new Date() }];
    expect(await lire("formateur-dossier-relance", { etape: 1 })).toMatch(/a répondu/);
  });
  it("V2-P-4 — opposition : retenue", async () => {
    pz.opposition = { id: "o" };
    expect(await lire("formateur-dossier-relance", { etape: 1 })).toMatch(/opposée/);
  });
});

describe("F17 — code de signature (V2-P-7)", () => {
  const f17 = { valeurs: { code: "enc:v2:x", durée: "15 minutes" }, codeSignatureId: "k1" };
  it("code vivant : part", async () => {
    expect(await lire("formateur-code-signature", f17)).toBeNull();
  });
  it("code expiré pendant l'attente : retenu", async () => {
    pz.code = { expiresAt: new Date(Date.now() - 1000), utiliseAt: null, invalideAt: null };
    expect(await lire("formateur-code-signature", f17)).toMatch(/expiré/);
  });
  it("code remplacé par un plus récent, ou déjà servi : retenu", async () => {
    pz.code = { expiresAt: new Date(Date.now() + 60_000), utiliseAt: null, invalideAt: new Date() };
    expect(await lire("formateur-code-signature", f17)).toMatch(/remplacé/);
    pz.code = { expiresAt: new Date(Date.now() + 60_000), utiliseAt: new Date(), invalideAt: null };
    expect(await lire("formateur-code-signature", f17)).toMatch(/servi/);
  });
  it("l'opposition ne retient pas un code (obligation demandée par le formateur)", async () => {
    pz.opposition = { id: "o" };
    expect(await lire("formateur-code-signature", f17)).toBeNull();
  });
});
