/**
 * V1-A-6 (vérification n° 1, bloquant) — une pièce déposée dans le DOSSIER EN LIGNE n'a
 * pas d'adresse : seulement ses octets (`TrainerDocumentContenu`). Les lecteurs de W-4,
 * de la contresignature et de l'activation la tenaient pour absente (`fichierUrl` seul) :
 * aucun formateur passé par le dossier en ligne ne pouvait être contresigné ni activé.
 *
 * La base est simulée comme Prisma répond : la relation `contenu` n'est rendue QUE si la
 * lecture la demande. Un lecteur qui oublie de la charger retombe donc dans le défaut.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  trainer: { findUnique: vi.fn() },
  documentGenere: { findUnique: vi.fn(), findMany: vi.fn() },
  documentSignature: { findMany: vi.fn() },
  preuveVigilance: { findMany: vi.fn() },
  verificationRegistreSousTraitance: { findMany: vi.fn() },
  formation: { findMany: vi.fn() },
  objectionContratCadre: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainer: h.trainer,
    documentGenere: h.documentGenere,
    documentSignature: h.documentSignature,
    preuveVigilance: h.preuveVigilance,
    verificationRegistreSousTraitance: h.verificationRegistreSousTraitance,
    formation: h.formation,
  },
}));
vi.mock("../vigilance-seuil-lecture", () => ({ lireCumulHonorairesHtCents: async () => 0 }));
vi.mock("@/server/qualiopi/documents/templates/versions-arretees", () => ({
  derniereVersionArretee: () => 4,
}));
vi.mock("@/server/qualiopi/documents/signature/contrat-cadre-signature", () => ({
  estContratCadre: () => true,
  objectionContratCadre: h.objectionContratCadre,
  siretDuContrat: () => "98765432400019",
}));

import { lireFaitsActivationComplete } from "../faits-activation";
import { cvProbant } from "../garde-activation-complete";
import { objectionContresignatureContratCadre } from "../garde-contresignature-contrat-cadre";
import { lireEcranVerifierContresigner } from "../verifier-contresigner-lecture";

const MAINTENANT = new Date("2026-10-15T10:00:00Z");
const TRAINER = "11111111-1111-4111-8111-111111111111";
const CV = "22222222-2222-4222-8222-222222222222";
const RIB = "33333333-3333-4333-8333-333333333333";

/** Les pièces d'un dossier en ligne : AUCUNE adresse, les octets seuls. */
const DEPOSEES = [
  { id: CV, type: "cv", statutValidation: "valide", dateEmission: new Date("2026-09-01") },
  { id: RIB, type: "rib", statutValidation: "valide", dateEmission: null },
];

/** Ce que Prisma rend pour ce `select` : `contenu` seulement s'il est demandé. */
function documentsSelon(select: Record<string, unknown> | undefined) {
  const demande = select?.["contenu"] !== undefined;
  return DEPOSEES.map((d) => ({
    ...d,
    fichierUrl: null,
    dateExpiration: null,
    numeroPiece: null,
    ...(demande ? { contenu: { trainerDocumentId: d.id } } : {}),
    // Date du CV (15/10) : rendue, elle aussi, seulement si la lecture la demande.
    ...(select?.["dateCvDeclaree"] !== undefined
      ? { dateCvDeclaree: d.type === "cv" ? d.dateEmission : null }
      : {}),
  }));
}

function ficheIndependante(args: { select: { documents?: { select?: Record<string, unknown> } } }) {
  return {
    id: TRAINER,
    prenom: "Maël",
    nom: "Banc",
    statut: "sous_traitant",
    actif: false,
    finCollaborationAt: null,
    dossierStatut: "a_verifier",
    siret: "98765432400019",
    sousTraitantNda: "84691234569",
    ndaVerifieListeAt: null,
    regimeTvaHonoraires: "franchise_293b",
    iban: "enc:v2:x",
    declarationsVersion: "1",
    habilitations: [],
    documents: documentsSelon(args.select.documents?.select),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.trainer.findUnique.mockImplementation(ficheIndependante);
  h.preuveVigilance.findMany.mockResolvedValue([]);
  h.verificationRegistreSousTraitance.findMany.mockResolvedValue([]);
  h.documentGenere.findMany.mockResolvedValue([]);
  h.formation.findMany.mockResolvedValue([]);
  h.documentGenere.findUnique.mockResolvedValue({ trainerId: TRAINER, annuleeAt: null });
  h.documentSignature.findMany.mockResolvedValue([{ partie: "sous_traitant" }]);
  h.objectionContratCadre.mockResolvedValue(null);
});

describe("V1-A-6 — une pièce déposée en ligne compte comme un fichier", () => {
  it("le CV déposé (octets, sans adresse) est probant ; sans octets, il ne l'est pas", () => {
    const cv = {
      id: CV,
      type: "cv" as const,
      statutValidation: "valide" as const,
      fichierUrl: null,
      dateEmission: new Date("2026-09-01"),
      dateExpiration: null,
    };
    expect(cvProbant([{ ...cv, contenu: { trainerDocumentId: CV } }], MAINTENANT)).toBe(true);
    expect(cvProbant([{ ...cv, contenu: null }], MAINTENANT)).toBe(false);
  });

  it("W-4 voit le CV et le RIB déposés, et donne le lien de la route console", async () => {
    const base = "/fr/console/qualiopi/formateurs/x/pieces";
    const ecran = await lireEcranVerifierContresigner(TRAINER, MAINTENANT, {
      basePiecesDeposees: base,
      voitRib: false,
    });
    expect(ecran?.faits.pieces.cv?.fichierPresent).toBe(true);
    expect(ecran?.faits.pieces.rib?.fichierPresent).toBe(true);
    expect(ecran?.faits.dossier.cvDate).toBe(true);
    // Le RIB ne s'ouvre qu'avec le droit de rémunérer (la route le refuse sinon).
    expect(ecran?.liens).toEqual([{ libelle: "Voir le CV", url: `${base}/${CV}` }]);
  });

  it("date du CV (15/10) — W-4 affiche, à côté du CV, la date déclarée par le formateur", async () => {
    const ecran = await lireEcranVerifierContresigner(TRAINER, MAINTENANT);
    expect(ecran?.dateDuCv).toBe("Date du CV déclarée par le formateur : septembre 2026");
  });

  it("la porte de contresignature ne réclame pas les pièces déposées", async () => {
    const o = await objectionContresignatureContratCadre({
      documentGenereId: "44444444-4444-4444-8444-444444444444",
      type: "contrat_sous_traitance",
      metadata: { renderData: { gabaritVersion: 4 } },
      maintenant: MAINTENANT,
    });
    expect(o).toBeNull();
    expect(h.objectionContratCadre).toHaveBeenCalledTimes(1);
  });

  it("les faits de l'activation complète tiennent le CV déposé pour probant", async () => {
    const db = {
      trainer: h.trainer,
      documentGenere: h.documentGenere,
      verificationRegistreSousTraitance: h.verificationRegistreSousTraitance,
      preuveVigilance: h.preuveVigilance,
    };
    const faits = await lireFaitsActivationComplete(TRAINER, db as never);
    expect(faits).not.toBeNull();
    expect(cvProbant(faits!.pieces, MAINTENANT)).toBe(true);
  });
});
