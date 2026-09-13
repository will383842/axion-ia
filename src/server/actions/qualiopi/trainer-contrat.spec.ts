// @vitest-environment node

/**
 * Tests — `notifierContratTravailAction`, le message qui envoie un salarié lire
 * et signer son contrat de travail.
 *
 * ## Ce qui se joue ici, et pourquoi ce sont les REFUS qu'on teste
 *
 * Cette action écrit à une personne réelle, au sujet de la pièce la plus
 * engageante qu'on lui adresse. Un envoi n'est pas rattrapable : on ne peut pas
 * reprendre un message parti.
 *
 * Les cas nominaux sont faciles à voir à l'œil nu ; ce sont les refus qui se
 * perdent au premier remaniement, et chacun d'eux évite une situation précise :
 *
 *  · annoncer un contrat qui N'EXISTE PAS envoie quelqu'un ouvrir un espace
 *    vide — pire que le silence qu'on corrige, parce que le silence n'engage
 *    rien tandis que l'annonce fausse abîme la confiance dans ce qui suivra ;
 *  · annoncer un SPÉCIMEN l'envoie buter sur un refus de signature, sur le
 *    document le plus engageant qu'on lui adresse ;
 *  · écrire à un SOUS-TRAITANT lui affirmerait qu'il est salarié — la
 *    qualification juridique exacte que le contrat de sous-traitance existe
 *    pour ne pas avoir.
 *
 * ⚠️ Ce fichier ne teste PAS le gabarit d'e-mail : son texte et ses champs sont
 * gardés par `payloads-exemple.spec.ts` et les tests de familles. On vérifie ce
 * que l'action DÉCIDE, et ce qu'elle passe à la file.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTrainerFindUnique = vi.fn();
const mockTrainerUpdate = vi.fn();
const mockDocFindFirst = vi.fn();
const mockEnqueueEmail = vi.fn();
const mockLog = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainer: {
      findUnique: (...a: unknown[]) => mockTrainerFindUnique(...a),
      update: (...a: unknown[]) => mockTrainerUpdate(...a),
    },
    documentGenere: { findFirst: (...a: unknown[]) => mockDocFindFirst(...a) },
  },
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireHabilitation: () => Promise.resolve({ userId: "admin-1", role: "super_admin" }),
  requireAdminWrite: () => Promise.resolve({ userId: "admin-1", role: "super_admin" }),
  logQualiopiActivity: (...a: unknown[]) => mockLog(...a),
}));

vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => mockEnqueueEmail(...a),
}));

import {
  consignerRemiseContratAction,
  notifierContratTravailAction,
  updateTrainerContratAction,
} from "./trainer-contrat";

import { empreinteMentions, CLE_EMPREINTE_MENTIONS } from "@/server/rh/contrat-piece-en-cours";
import { dureeEssaiDe, type SalarieContrat } from "@/server/qualiopi/trainers/contrat-travail";

/**
 * La fixture Prisma → `SalarieContrat`, comme l'action le fait elle-même.
 *
 * 🔴 REMPLACE UN `as unknown as SalarieContrat`. Le cast masquait que les deux
 * formes avaient divergé : la fixture porte `contratPeriodeEssaiValeur` +
 * `…Unite` (ce que le `select` rend), le domaine attend `contratPeriodeEssai`
 * (le couple). Trois témoins sont tombés là où le compilateur l'aurait dit.
 */
function versSalarieContrat(o: Record<string, unknown>): SalarieContrat {
  return {
    ...(o as unknown as Omit<SalarieContrat, "contratPeriodeEssai">),
    contratPeriodeEssai: dureeEssaiDe(o as unknown as Parameters<typeof dureeEssaiDe>[0]),
  };
}

const ID = "11111111-1111-4111-8111-111111111111";

/**
 * ⚠️ CETTE FIXTURE DOIT PORTER TOUT CE QUE LE `select` RÉEL DEMANDE.
 *
 * Elle n'en portait que huit champs quand l'action n'en lisait que huit. Le jour
 * où l'action a eu besoin de TOUTES les mentions du contrat — pour recalculer
 * l'empreinte et vérifier que la pièce annoncée les porte encore — huit tests
 * sont tombés sur `Cannot read properties of undefined`.
 *
 * 🔑 C'est le bon comportement, et `empreinteMentions` reste volontairement
 * STRICTE là-dessus : un repli `?? null` aurait rendu une empreinte calculée sur
 * des trous, donc un contrôle qui laisse passer exactement ce qu'il doit
 * attraper — en silence, et sans qu'aucun test ne bouge.
 */
function salarie(o: Record<string, unknown> = {}) {
  return {
    email: "camille@exemple.invalid",
    nom: "Martin",
    prenom: "Camille",
    statut: "salarie",
    actif: true,
    dateNaissance: new Date("1992-04-03T00:00:00.000Z"),
    lieuNaissance: "Lyon",
    adressePersonnelle: "12 rue des Lilas, 69003 Lyon",
    dateEmbauche: new Date("2026-10-01T00:00:00.000Z"),
    contratType: "cdi",
    contratPoste: "Formateur en intelligence artificielle",
    contratClassification: "Cadre position 2.1",
    contratDureeHebdoHeures: 35,
    contratPeriodeEssaiValeur: 3,
    contratPeriodeEssaiUnite: "mois",
    contratLieuTravail: "Lyon",
    contratDateFin: null,
    contratMotifCdd: null,
    fixeMensuelBrutCents: 300000,
    ...o,
  };
}

function piece(o: Record<string, unknown> = {}) {
  return { numero: "AXI-DOC-2026-050", metadata: {}, statutSignature: "en_attente", ...o };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTrainerFindUnique.mockResolvedValue(salarie());
  mockTrainerUpdate.mockResolvedValue({});
  mockDocFindFirst.mockResolvedValue(piece());
  mockEnqueueEmail.mockResolvedValue({ enqueued: true });
  mockLog.mockResolvedValue(undefined);
});

describe("notifierContratTravailAction — le cas où le message part", () => {
  it("envoie au salarié, et rend son adresse", async () => {
    const res = await notifierContratTravailAction({ trainerId: ID });
    expect("data" in res && res.data.destinataire).toBe("camille@exemple.invalid");
    expect(mockEnqueueEmail).toHaveBeenCalledTimes(1);
  });

  it("🔑 le message nomme la PIÈCE, pas seulement le salarié", async () => {
    // Sans le numéro, le destinataire n'a aucune référence à citer si une
    // mention lui paraît fausse — et c'est précisément ce qu'on lui demande de
    // faire avant de signer.
    await notifierContratTravailAction({ trainerId: ID });
    const payload = mockEnqueueEmail.mock.calls[0]?.[3] as Record<string, unknown>;
    expect(payload["numeroPiece"]).toBe("AXI-DOC-2026-050");
    expect(payload["natureContrat"]).toBe("CDI");
    expect(payload["poste"]).toBe("Formateur en intelligence artificielle");
  });

  it("🔴 un CDD est annoncé comme tel, jamais comme un CDI", async () => {
    // La nature change ce que le salarié doit vérifier — un terme, un motif.
    // Lui annoncer « CDI » sur un CDD le ferait signer sans les chercher.
    mockTrainerFindUnique.mockResolvedValue(salarie({ contratType: "cdd" }));
    await notifierContratTravailAction({ trainerId: ID });
    const payload = mockEnqueueEmail.mock.calls[0]?.[3] as Record<string, unknown>;
    expect(payload["natureContrat"]).toBe("CDD");
  });

  it("🔑 l'envoi est RETROUVABLE : il porte l'entité du salarié", async () => {
    // C'est ce que l'écran relit pour afficher « prévenu le … ». Sans ces deux
    // champs, la trace existerait dans le journal des e-mails sans qu'aucune
    // surface ne sache la rattacher à ce salarié — et l'opérateur réenverrait
    // par prudence, ou n'enverrait rien en croyant que c'est fait.
    await notifierContratTravailAction({ trainerId: ID });
    const opts = mockEnqueueEmail.mock.calls[0]?.[4] as Record<string, unknown>;
    expect(opts["entityType"]).toBe("Trainer");
    expect(opts["entityId"]).toBe(ID);
  });

  it("⚠️ AUCUN jobId fixe : réenvoyer doit rester possible", async () => {
    // Un identifiant stable rendrait l'envoi idempotent, donc un SECOND envoi
    // serait silencieusement avalé — alors que réenvoyer est légitime : le
    // premier message s'est perdu, ou le contrat a été refait.
    await notifierContratTravailAction({ trainerId: ID });
    const opts = mockEnqueueEmail.mock.calls[0]?.[4] as Record<string, unknown>;
    expect(opts["jobId"]).toBeUndefined();
  });
});

describe("🔴 les refus — chacun évite une situation précise", () => {
  it("refuse un SOUS-TRAITANT : il n'a pas de contrat de travail", async () => {
    mockTrainerFindUnique.mockResolvedValue(salarie({ statut: "sous_traitant" }));
    const res = await notifierContratTravailAction({ trainerId: ID });
    expect("error" in res && res.error).toMatch(/pas salarié/i);
    expect(mockEnqueueEmail).not.toHaveBeenCalled();
  });

  it("refuse un DIRIGEANT : il relève de son mandat social", async () => {
    mockTrainerFindUnique.mockResolvedValue(salarie({ statut: "dirigeant" }));
    const res = await notifierContratTravailAction({ trainerId: ID });
    expect("error" in res).toBe(true);
    expect(mockEnqueueEmail).not.toHaveBeenCalled();
  });

  it("🔴 refuse quand AUCUN contrat n'a été établi", async () => {
    mockDocFindFirst.mockResolvedValue(null);
    const res = await notifierContratTravailAction({ trainerId: ID });
    expect("error" in res && res.error).toMatch(/Aucun contrat/i);
    expect(mockEnqueueEmail).not.toHaveBeenCalled();
  });

  it("🔴 refuse d'annoncer un SPÉCIMEN", async () => {
    // Le service de signature le rejette : l'annoncer enverrait le salarié
    // buter sur un refus, et le message dit le geste qui répare.
    mockDocFindFirst.mockResolvedValue(piece({ metadata: { specimen: true } }));
    const res = await notifierContratTravailAction({ trainerId: ID });
    expect("error" in res && res.error).toMatch(/SPÉCIMEN/);
    expect("error" in res && res.error).toMatch(/convention collective/i);
    expect(mockEnqueueEmail).not.toHaveBeenCalled();
  });

  it("🔑 une métadonnée MALFORMÉE ne passe pas pour un spécimen", async () => {
    // ⚠️ `metadata` est une colonne Json : rien ne garantit sa forme. Un tableau
    // ou une chaîne ne doit pas bloquer l'envoi — on teste la forme plutôt que
    // de caster, et l'absence de marquage vaut « pas un spécimen ».
    mockDocFindFirst.mockResolvedValue(piece({ metadata: ["inattendu"] }));
    const res = await notifierContratTravailAction({ trainerId: ID });
    expect("data" in res).toBe(true);
  });

  it("refuse un compte DÉSACTIVÉ", async () => {
    // Il ne pourrait pas se connecter pour lire la pièce : le message
    // l'enverrait sur une porte fermée.
    mockTrainerFindUnique.mockResolvedValue(salarie({ actif: false }));
    const res = await notifierContratTravailAction({ trainerId: ID });
    expect("error" in res && res.error).toMatch(/désactivé/i);
    expect(mockEnqueueEmail).not.toHaveBeenCalled();
  });

  it("refuse une adresse e-mail VIDE, en disant où la renseigner", async () => {
    mockTrainerFindUnique.mockResolvedValue(salarie({ email: "   " }));
    const res = await notifierContratTravailAction({ trainerId: ID });
    expect("error" in res && res.error).toMatch(/adresse e-mail/i);
    expect(mockEnqueueEmail).not.toHaveBeenCalled();
  });

  it("refuse un formateur introuvable", async () => {
    mockTrainerFindUnique.mockResolvedValue(null);
    const res = await notifierContratTravailAction({ trainerId: ID });
    expect("error" in res).toBe(true);
    expect(mockEnqueueEmail).not.toHaveBeenCalled();
  });

  it("🔴 une file INDISPONIBLE rend une erreur, jamais un faux succès", async () => {
    // Le pire cas possible : annoncer « salarié prévenu » alors que rien n'est
    // parti. L'écran afficherait la trace, personne ne relancerait, et
    // l'intéressé attendrait un message qui n'existe pas.
    mockEnqueueEmail.mockResolvedValue({ enqueued: false });
    const res = await notifierContratTravailAction({ trainerId: ID });
    expect("error" in res && res.error).toMatch(/n'a PAS été prévenu/i);
  });

  it("un message GARÉ en validation le dit, sans faire croire qu'il est parti", async () => {
    mockEnqueueEmail.mockResolvedValue({ enqueued: false, garePourValidation: true });
    const res = await notifierContratTravailAction({ trainerId: ID });
    expect("error" in res && res.error).toMatch(/garé/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// consignerRemiseContratAction — le seul fait que le logiciel ne voyait pas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 🔴 Ce geste ferme l'alerte `contrat_cdd_non_remis`, qui est `critique` et
 * `resolutionAuto: true` : elle ne s'éteint QUE si cette date se pose. Sans lui,
 * elle ordonnerait l'impossible — le défaut exact du 2026-09-06 sur
 * `exemplaire_signe_non_transmis`.
 *
 * ⛔ Et il est SÉPARÉ de la notification. « On lui a dit » et « il l'a » sont
 * deux faits ; les confondre donnerait une remise consignée pour quelqu'un qui
 * n'a jamais ouvert le message — une trace fausse, pire qu'une trace absente
 * parce qu'elle se défend.
 */
describe("consignerRemiseContratAction — la remise devient observable", () => {
  it("consigne la date, à minuit UTC", async () => {
    // ⚠️ UTC : une date de remise n'a pas d'heure, et la traiter en heure locale
    // la décalerait d'un jour pour la moitié de l'année — sur une valeur qui
    // sert de preuve.
    const res = await consignerRemiseContratAction({ trainerId: ID, remisLe: "2026-09-11" });
    expect("data" in res && res.data.efface).toBe(false);
    const data = mockTrainerUpdate.mock.calls[0]?.[0] as { data: { contratRemisAt: Date } };
    expect(data.data.contratRemisAt.toISOString()).toBe("2026-09-11T00:00:00.000Z");
  });

  it("🔑 `null` EFFACE — on doit pouvoir revenir sur une saisie fausse", async () => {
    // Une date consignée par erreur éteindrait l'alerte sur un contrat jamais
    // remis. Sans chemin de retour, la seule correction serait en base.
    const res = await consignerRemiseContratAction({ trainerId: ID, remisLe: null });
    expect("data" in res && res.data.efface).toBe(true);
    const data = mockTrainerUpdate.mock.calls[0]?.[0] as { data: { contratRemisAt: Date | null } };
    expect(data.data.contratRemisAt).toBeNull();
  });

  it("🔴 refuse une date DANS LE FUTUR", async () => {
    // Elle éteindrait l'alerte par anticipation — très exactement ce que cette
    // alerte existe pour empêcher.
    const demain = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
    const res = await consignerRemiseContratAction({ trainerId: ID, remisLe: demain });
    expect("error" in res && res.error).toMatch(/futur/i);
    expect(mockTrainerUpdate).not.toHaveBeenCalled();
  });

  it("accepte une date PASSÉE : la remise a pu avoir lieu la veille", async () => {
    // 🔑 Témoin discriminant du précédent. Une garde qui refuserait tout sauf
    // aujourd'hui passerait le test du futur en cassant le cas normal — celui
    // où l'on saisit le lendemain ce qu'on a remis la veille.
    const hier = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const res = await consignerRemiseContratAction({ trainerId: ID, remisLe: hier });
    expect("data" in res).toBe(true);
  });

  it("refuse un formateur qui n'est pas SALARIÉ", async () => {
    mockTrainerFindUnique.mockResolvedValue(salarie({ statut: "sous_traitant" }));
    const res = await consignerRemiseContratAction({ trainerId: ID, remisLe: "2026-09-11" });
    expect("error" in res).toBe(true);
    expect(mockTrainerUpdate).not.toHaveBeenCalled();
  });

  it("refuse une date mal formée, sans rien écrire", async () => {
    const res = await consignerRemiseContratAction({ trainerId: ID, remisLe: "11/09/2026" });
    expect("error" in res && res.error).toMatch(/invalide/i);
    expect(mockTrainerUpdate).not.toHaveBeenCalled();
  });

  it("refuse un formateur introuvable", async () => {
    mockTrainerFindUnique.mockResolvedValue(null);
    const res = await consignerRemiseContratAction({ trainerId: ID, remisLe: "2026-09-11" });
    expect("error" in res).toBe(true);
    expect(mockTrainerUpdate).not.toHaveBeenCalled();
  });

  it("🔑 le journal DISTINGUE consigner et effacer", async () => {
    // Consigner une remise est un fait opposable ; l'effacer revient à dire
    // qu'on s'était trompé. Les ranger sous la même action rendrait le second
    // invisible à la relecture.
    await consignerRemiseContratAction({ trainerId: ID, remisLe: "2026-09-11" });
    expect((mockLog.mock.calls[0]?.[0] as { action: string }).action).toBe(
      "qualiopi.trainer.remise_contrat",
    );
    mockLog.mockClear();
    await consignerRemiseContratAction({ trainerId: ID, remisLe: null });
    expect((mockLog.mock.calls[0]?.[0] as { action: string }).action).toBe(
      "qualiopi.trainer.remise_contrat.effacee",
    );
  });
});

describe("🔴 la pièce annoncée doit porter les mentions de la fiche", () => {
  /*
    Le message décrit `trainer` — la fiche VIVANTE — alors qu'il annonce
    `piece.numero`. Rien n'empêchait les deux de diverger : corriger le poste
    après l'émission, sans ré-établir, faisait partir « votre CDD pour le poste
    de Secrétaire administrative… Référence : AXI-DOC-2026-050 » pendant que le
    PDF de cette même pièce portait « Formatrice IA ».

    ⚠️ Et c'est l'E-MAIL que l'intéressée produirait si elle contestait : en
    signant, elle scelle une mention affirmant avoir pris connaissance de la
    pièce dans son intégralité.
  */

  it("🔴 refuse quand le POSTE a changé depuis l'établissement", async () => {
    const empreinteAncienne = empreinteMentions(
      versSalarieContrat(salarie({ contratPoste: "Formatrice IA" })),
    );
    mockDocFindFirst.mockResolvedValue(
      piece({ metadata: { [CLE_EMPREINTE_MENTIONS]: empreinteAncienne } }),
    );
    const res = await notifierContratTravailAction({ trainerId: ID });
    expect("error" in res && res.error).toContain("AXI-DOC-2026-050");
    expect("error" in res && res.error).toContain("Établissez-le à nouveau");
    expect(mockEnqueueEmail).not.toHaveBeenCalled();
  });

  it("🔑 LAISSE PASSER quand la pièce porte bien les mentions actuelles", async () => {
    // Témoin discriminant. Sans lui, un « toujours refuser » passerait le test
    // ci-dessus et empêcherait toute annonce — le bouton deviendrait mort.
    const empreinteJuste = empreinteMentions(versSalarieContrat(salarie()));
    mockDocFindFirst.mockResolvedValue(
      piece({ metadata: { [CLE_EMPREINTE_MENTIONS]: empreinteJuste } }),
    );
    const res = await notifierContratTravailAction({ trainerId: ID });
    expect("data" in res).toBe(true);
    expect(mockEnqueueEmail).toHaveBeenCalledTimes(1);
  });

  it("⚠️ laisse passer une pièce SANS empreinte — les tirages d'avant ce module", async () => {
    // Un correctif qui bloque l'existant n'en est pas un : les contrats déjà en
    // cours de signature ne portent aucune empreinte.
    mockDocFindFirst.mockResolvedValue(piece({ metadata: {} }));
    expect("data" in (await notifierContratTravailAction({ trainerId: ID }))).toBe(true);
  });

  it("🔑 une métadonnée MALFORMÉE ne bloque pas l'annonce", async () => {
    // `metadata` est une colonne Json : sa forme n'est pas garantie. La traiter
    // comme une empreinte fausse ferait refuser toute annonce sans recours.
    mockDocFindFirst.mockResolvedValue(piece({ metadata: ["inattendu"] }));
    expect("data" in (await notifierContratTravailAction({ trainerId: ID }))).toBe(true);
  });

  it("🔴 l'HEURE d'une saisie ne rend pas une pièce périmée", async () => {
    // Sans la réduction au jour, une date ressaisie à une autre heure — ou lue
    // dans un autre fuseau — déclarerait périmée une pièce identique à l'écrit,
    // et l'avertissement finirait cliqué sans être lu.
    const empreinteMinuit = empreinteMentions(versSalarieContrat(salarie()));
    mockTrainerFindUnique.mockResolvedValue(
      salarie({ dateEmbauche: new Date("2026-10-01T18:45:00.000Z") }),
    );
    mockDocFindFirst.mockResolvedValue(
      piece({ metadata: { [CLE_EMPREINTE_MENTIONS]: empreinteMinuit } }),
    );
    expect("data" in (await notifierContratTravailAction({ trainerId: ID }))).toBe(true);
  });
});

describe("🔴 une date d'embauche ne s'efface pas sous un contrat établi", () => {
  /*
    Recette du 13/09. Effacer ce champ éteignait EN SILENCE l'alerte CRITIQUE de
    remise du CDD et remettait le compteur d'urgence à zéro : sans origine,
    `remiseCddEnSouffrance` n'a plus de retard à compter. Le geste qui aurait dû
    crier devenait celui qui fait taire.

    ⚠️ Et la pièce PORTE cette date : le PDF l'imprime, le délai de
    l'art. L.1242-13 s'en déduit, et la requalification en CDI qui le sanctionne
    aussi. Un champ vide côté fiche pendant qu'un contrat signé affirme le
    contraire n'est pas une donnée manquante, c'est une contradiction.
  */

  it("🔴 REFUSE l'effacement quand une pièce existe, et NOMME la pièce", async () => {
    mockDocFindFirst.mockResolvedValue({ numero: "AXI-DOC-2026-050" });
    const res = await updateTrainerContratAction({ id: ID, dateEmbauche: null });
    expect("error" in res && res.error).toContain("AXI-DOC-2026-050");
    expect("error" in res && res.error).toContain("L.1242-13");
    expect(mockTrainerUpdate).not.toHaveBeenCalled();
  });

  it("🔑 AUTORISE l'effacement quand aucune pièce n'a été établie", async () => {
    // Témoin discriminant : sans lui, un « toujours refuser » passerait le test
    // ci-dessus et interdirait de corriger une date saisie par erreur avant
    // même qu'un contrat existe.
    mockDocFindFirst.mockResolvedValue(null);
    const res = await updateTrainerContratAction({ id: ID, dateEmbauche: null });
    expect("data" in res).toBe(true);
    expect(mockTrainerUpdate).toHaveBeenCalledTimes(1);
  });

  it("🔑 n'entrave pas une CORRECTION de date — on ne bloque que l'EFFACEMENT", async () => {
    // L'autre témoin discriminant. Corriger une date fausse reste le geste
    // normal ; c'est la faire disparaître qui efface le délai avec elle.
    mockDocFindFirst.mockResolvedValue({ numero: "AXI-DOC-2026-050" });
    const res = await updateTrainerContratAction({ id: ID, dateEmbauche: "2026-10-05" });
    expect("data" in res).toBe(true);
    expect(mockTrainerUpdate).toHaveBeenCalledTimes(1);
  });
});
