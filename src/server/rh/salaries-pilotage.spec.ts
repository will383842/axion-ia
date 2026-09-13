// @vitest-environment node

/**
 * Tests — le pilotage des SALARIÉS, la vue employeur.
 *
 * Ce que cet écran décide n'est pas de l'affichage : c'est **ce qu'il reste à
 * faire**. Un état mal dérivé fait croire qu'un contrat est signé quand il ne
 * l'est qu'à moitié, ou fait disparaître un CDD dont le délai de remise court.
 *
 * ⚠️ Ces tests ne re-testent pas `remiseCddEnSouffrance` — il a les siens. On
 * vérifie le BRANCHEMENT : que cette lecture l'appelle avec les bonnes entrées
 * et rende son verdict sans le retoucher.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTrainerFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { trainer: { findMany: (...a: unknown[]) => mockTrainerFindMany(...a) } },
}));

import { listSalaries, synthetiserSalaries } from "./salaries-pilotage";

/** 15 septembre 2026. L'embauche par défaut est au 10 : le délai court. */
const MAINTENANT = new Date("2026-09-15T12:00:00.000Z");

function personne(o: Record<string, unknown> = {}) {
  return {
    id: "trn-1",
    nom: "Martin",
    prenom: "Camille",
    email: "camille@exemple.invalid",
    statut: "salarie",
    actif: true,
    contratPoste: "Secrétaire",
    contratType: "cdi",
    dateEmbauche: new Date("2026-09-10T00:00:00.000Z"),
    contratRemisAt: null,
    documentsGeneres: [],
    ...o,
  };
}

function piece(o: Record<string, unknown> = {}) {
  return {
    numero: "AXI-DOC-2026-050",
    metadata: {},
    statutSignature: "en_attente",
    signatures: [],
    ...o,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTrainerFindMany.mockResolvedValue([]);
});

describe("listSalaries — l'état dit le geste qui reste", () => {
  it("rend [] quand la base est absente (stub de build)", async () => {
    mockTrainerFindMany.mockRejectedValue(new Error("no db"));
    await expect(listSalaries(MAINTENANT)).resolves.toEqual([]);
  });

  it("🔴 sans pièce produite : « à établir »", async () => {
    mockTrainerFindMany.mockResolvedValue([personne()]);
    const [l] = await listSalaries(MAINTENANT);
    expect(l?.etat).toBe("a_etablir");
    expect(l?.numeroPiece).toBeNull();
    expect(l?.prevenu).toBe(false);
  });

  it("pièce produite, personne n'a signé : « à signer »", async () => {
    mockTrainerFindMany.mockResolvedValue([personne({ documentsGeneres: [piece()] })]);
    const [l] = await listSalaries(MAINTENANT);
    expect(l?.etat).toBe("a_signer");
    expect(l?.signatures).toBe(0);
    expect(l?.numeroPiece).toBe("AXI-DOC-2026-050");
  });

  it("une seule partie a signé : « partiel »", async () => {
    mockTrainerFindMany.mockResolvedValue([
      personne({ documentsGeneres: [piece({ signatures: [{ partie: "formateur" }] })] }),
    ]);
    const [l] = await listSalaries(MAINTENANT);
    expect(l?.etat).toBe("partiel");
    expect(l?.signatures).toBe(1);
  });

  it("les deux parties ont signé : « signé »", async () => {
    mockTrainerFindMany.mockResolvedValue([
      personne({
        documentsGeneres: [piece({ signatures: [{ partie: "formateur" }, { partie: "axionia" }] })],
      }),
    ]);
    const [l] = await listSalaries(MAINTENANT);
    expect(l?.etat).toBe("signe");
    expect(l?.signatures).toBe(2);
  });

  it("🔴 DEUX LIGNES DE LA MÊME PARTIE NE FONT PAS DEUX SIGNATURES", async () => {
    // Le piège : une révocation suivie d'une nouvelle signature, ou un doublon
    // en base, afficherait « 2/2 » — donc « signé » — sur un contrat que
    // l'employeur n'a jamais contresigné. On compte les parties DISTINCTES.
    mockTrainerFindMany.mockResolvedValue([
      personne({
        documentsGeneres: [
          piece({ signatures: [{ partie: "formateur" }, { partie: "formateur" }] }),
        ],
      }),
    ]);
    const [l] = await listSalaries(MAINTENANT);
    expect(l?.signatures).toBe(1);
    expect(l?.etat).toBe("partiel");
  });

  it("⚠️ le DIRIGEANT est « sans objet » — il relève de son mandat social", async () => {
    // Une case vide se lirait comme un oubli à combler, alors que c'est un état
    // normal et définitif : un dirigeant n'a pas de contrat de travail.
    mockTrainerFindMany.mockResolvedValue([personne({ statut: "dirigeant" })]);
    const [l] = await listSalaries(MAINTENANT);
    expect(l?.etat).toBe("sans_objet");
  });

  it("🔴 une pièce SPÉCIMEN est signalée — elle ne se signera jamais", async () => {
    // Le service de signature refuse un spécimen. Le taire ferait attendre une
    // signature qui ne viendra pas.
    mockTrainerFindMany.mockResolvedValue([
      personne({ documentsGeneres: [piece({ metadata: { specimen: true } })] }),
    ]);
    const [l] = await listSalaries(MAINTENANT);
    expect(l?.estSpecimen).toBe(true);
  });

  it("🔑 une métadonnée MALFORMÉE ne passe pas pour un spécimen", async () => {
    // ⚠️ `metadata` est une colonne Json : sa forme n'est pas garantie. On la
    // teste au lieu de caster — un cast ferait planter l'écran entier sur une
    // valeur inattendue.
    mockTrainerFindMany.mockResolvedValue([
      personne({ documentsGeneres: [piece({ metadata: ["inattendu"] })] }),
    ]);
    const [l] = await listSalaries(MAINTENANT);
    expect(l?.estSpecimen).toBe(false);
  });

  it("🔴 un CDD établi et non remis est signalé URGENT", async () => {
    mockTrainerFindMany.mockResolvedValue([
      personne({ contratType: "cdd", documentsGeneres: [piece()] }),
    ]);
    const [l] = await listSalaries(MAINTENANT);
    expect(l?.remiseUrgente).toBe(true);
    expect(l?.joursDepuisEmbauche).toBe(5);
  });

  it("🔑 un CDI non remis n'est PAS urgent — aucun délai ne le vise", async () => {
    // Témoin discriminant : sans lui, un « toujours urgent » passerait le test
    // ci-dessus et peindrait tout l'écran en rouge.
    mockTrainerFindMany.mockResolvedValue([
      personne({ contratType: "cdi", documentsGeneres: [piece()] }),
    ]);
    const [l] = await listSalaries(MAINTENANT);
    expect(l?.remiseUrgente).toBe(false);
  });

  it("une remise consignée éteint l'urgence", async () => {
    mockTrainerFindMany.mockResolvedValue([
      personne({
        contratType: "cdd",
        contratRemisAt: new Date("2026-09-11T00:00:00.000Z"),
        documentsGeneres: [piece()],
      }),
    ]);
    const [l] = await listSalaries(MAINTENANT);
    expect(l?.remiseUrgente).toBe(false);
    expect(l?.remisAt).not.toBeNull();
  });

  it("⚠️ un compte DÉSACTIVÉ reste listé", async () => {
    // Un contrat non remis ne cesse pas de l'être parce qu'on a fermé l'accès.
    // C'est l'écran qui décide de replier, pas la lecture — filtrer ici
    // priverait l'appelant d'une information qu'il ne pourrait plus retrouver.
    mockTrainerFindMany.mockResolvedValue([personne({ actif: false })]);
    const lignes = await listSalaries(MAINTENANT);
    expect(lignes).toHaveLength(1);
    expect(lignes[0]?.actif).toBe(false);
  });

  it("🔑 la requête ne demande QUE les salariés et le dirigeant", async () => {
    /*
      Avec un mock, la seule façon d'éprouver un filtre est de LIRE l'argument
      passé : le mock rend ce qu'on lui dit quel que soit le `where`.

      🔴 ET C'EST LE CŒUR DU SUJET. `listTrainers({ actifOnly: true })` — le
      lecteur historique — ne filtre PAS sur les habilitations : il n'a jamais
      promis « les intervenants pédagogiques », il promet « les Trainer actifs ».
      Une secrétaire n'y apparaîtrait pas par erreur, elle y apparaîtrait parce
      que la fonction répond à une question voisine de celle qu'on croit lui
      poser. Ce témoin nomme ce que CETTE lecture-ci promet.
    */
    await listSalaries(MAINTENANT);
    const where = (mockTrainerFindMany.mock.calls[0]?.[0] as { where: Record<string, unknown> })
      .where;
    expect(where["statut"]).toStrictEqual({ in: ["salarie", "dirigeant"] });
    // ⚠️ AUCUN filtre sur `actif` : cf. le témoin du compte désactivé.
    expect(where).not.toHaveProperty("actif");
  });

  it("🔑 ne retient que le DERNIER tirage du contrat", async () => {
    // Une réémission laisse la précédente au registre. Compter les deux
    // afficherait l'état de la périmée aussi souvent que celui de la bonne.
    await listSalaries(MAINTENANT);
    const select = (
      mockTrainerFindMany.mock.calls[0]?.[0] as {
        select: { documentsGeneres: { take: number; where: Record<string, unknown> } };
      }
    ).select;
    expect(select.documentsGeneres.take).toBe(1);
    expect(select.documentsGeneres.where["annuleeAt"]).toBeNull();
  });
});

describe("synthetiserSalaries — les compteurs ne comptent que les actifs", () => {
  it("🔴 un ancien salarié sans contrat ne gonfle pas « à établir »", () => {
    /*
      Un chiffre qui ne redescend jamais finit par être ignoré — avec les vrais
      retards qu'il contient. Un ancien salarié dont le contrat n'a jamais été
      établi est un fait historique, pas une tâche.
    */
    const lignes = [
      { actif: true, etat: "a_etablir", remiseUrgente: false },
      { actif: false, etat: "a_etablir", remiseUrgente: false },
    ] as never;
    const s = synthetiserSalaries(lignes);
    expect(s.total).toBe(2);
    expect(s.actifs).toBe(1);
    expect(s.sansContrat).toBe(1);
  });

  it("⚠️ le dirigeant ne compte PAS comme « contrat à établir »", () => {
    // Il n'a rien à établir. L'y compter ferait un compteur qui ne redescend
    // jamais, sur quelqu'un pour qui il n'y a rien à faire.
    const lignes = [{ actif: true, etat: "sans_objet", remiseUrgente: false }] as never;
    expect(synthetiserSalaries(lignes).sansContrat).toBe(0);
  });

  it("« en attente de signature » couvre à signer ET partiel", () => {
    const lignes = [
      { actif: true, etat: "a_signer", remiseUrgente: false },
      { actif: true, etat: "partiel", remiseUrgente: false },
      { actif: true, etat: "signe", remiseUrgente: false },
    ] as never;
    expect(synthetiserSalaries(lignes).enAttenteDeSignature).toBe(2);
  });

  it("compte les remises urgentes des seuls actifs", () => {
    const lignes = [
      { actif: true, etat: "a_signer", remiseUrgente: true },
      { actif: false, etat: "a_signer", remiseUrgente: true },
    ] as never;
    expect(synthetiserSalaries(lignes).remisesUrgentes).toBe(1);
  });
});
