/**
 * Tests — lettre-mission-queries.ts
 *
 * Cette lecture décide de ce que le formateur VOIT et de ce qu'il peut faire sur
 * le contrat qui lui confie une mission. Quatre invariants, et les rater ne se
 * voit pas en revue de diff :
 *
 *  1. **La règle de mandat est CELLE de la Server Action.** L'action n'autorise
 *     que `resolvePrincipalTrainerId(session)`. Une lecture plus large
 *     proposerait un bouton à un co-formateur que l'action refuse à coup sûr, et
 *     le refus se lirait comme une panne.
 *  2. **On ne propose jamais un bouton qui refusera.** Spécimen, signature déjà
 *     posée, rôle insuffisant : dits AVANT le clic, avec leur motif.
 *  3. **Le texte affiché vient du module VERSIONNÉ.** Prouver « ce qu'il a
 *     signé » suppose que l'écran et l'empreinte concordent.
 *  4. **Aucune donnée personnelle au-delà du nom et de la qualité.**
 *     `signataireEmail` reste scellé en base, il ne sort pas.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { documentGenere: { findFirst: vi.fn(), findMany: vi.fn() } },
}));
vi.mock("@/server/qualiopi/documents/organisme", () => ({
  getOrganismeIdentite: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import {
  lireLettresMissionDuFormateur,
  lireEtatSignatureLettreMissionConsole,
} from "./lettre-mission-queries";
import { MENTION_VERSION_DOCUMENT } from "./mentions-document";

type Mock = ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as {
  documentGenere: { findFirst: Mock; findMany: Mock };
};
const mockIdentite = getOrganismeIdentite as unknown as Mock;

const SESSION = "11111111-1111-4111-8111-111111111111";
const TRAINER = "22222222-2222-4222-8222-222222222222";
const AUTRE_TRAINER = "44444444-4444-4444-8444-444444444444";

function piece(over: Record<string, unknown> = {}) {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    numero: "AXI-LM-2026-0004",
    statutSignature: "en_attente",
    metadata: {},
    // Ancre directe absente par défaut : les fixtures historiques décrivent des
    // lettres LEGACY, résolues par la session — et doivent le rester.
    trainerId: null,
    signatures: [] as Array<Record<string, unknown>>,
    session: {
      id: SESSION,
      numero: "AXI-SES-2026-0011",
      titreSession: "Prompt engineering — niveau 1",
      formateurPrincipalId: TRAINER,
      coFormateurs: [],
    },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.documentGenere.findFirst.mockResolvedValue(piece());
  mockPrisma.documentGenere.findMany.mockResolvedValue([piece()]);
  mockIdentite.mockResolvedValue({ raisonSociale: "Axion-IA" });
});

describe("lecture côté FORMATEUR", () => {
  it("rend une liste VIDE quand aucune lettre n'existe — cas normal, pas une erreur", async () => {
    // Un formateur salarié permanent n'a pas de lettre de mission. L'accueil
    // doit pouvoir ne rien afficher plutôt qu'un bloc vide qui se lirait comme
    // une pièce manquante.
    mockPrisma.documentGenere.findMany.mockResolvedValue([]);
    expect(await lireLettresMissionDuFormateur(TRAINER)).toStrictEqual([]);
  });

  it("🔴 ne lit QUE les lettres de mission, jamais une autre pièce de la session", async () => {
    // Sans le filtre de type, l'écran proposerait de signer « en qualité de
    // formateur » la convention ou la facture de la même session — la partie
    // `formateur` est acceptable sur d'autres circuits.
    await lireLettresMissionDuFormateur(TRAINER);
    const arg = mockPrisma.documentGenere.findMany.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
      orderBy: unknown;
    };
    expect(arg.where["type"]).toBe("lettre_mission");
    expect(arg.orderBy).toStrictEqual([{ createdAt: "desc" }, { id: "desc" }]);
  });

  it("ne lit que les signatures NON révoquées", async () => {
    // Une révocation est précisément le geste par lequel une preuve cesse de
    // valoir : l'afficher comme valable serait un mensonge.
    await lireLettresMissionDuFormateur(TRAINER);
    const arg = mockPrisma.documentGenere.findMany.mock.calls[0]?.[0] as {
      select: { signatures: { where: Record<string, unknown> } };
    };
    expect(arg.select.signatures.where["revokedAt"]).toBeNull();
  });

  it("🔴 ne passe JAMAIS de chaîne vide au filtre `trainerId`", async () => {
    // Une chaîne vide sur une colonne `@db.Uuid` fait échouer la requête côté
    // PostgreSQL — une erreur 500, pas un refus propre. On lui substitue un UUID
    // nul, qui rend zéro ligne : exactement le sens voulu.
    await lireLettresMissionDuFormateur("");
    const arg = mockPrisma.documentGenere.findMany.mock.calls[0]?.[0] as {
      where: { OR: Array<Record<string, unknown>> };
    };
    // Les DEUX branches (ancre directe + détour session) sont assainies.
    const clauses = JSON.stringify(arg.where.OR);
    expect(clauses).not.toContain('""');
    expect(clauses).toContain("00000000-0000-0000-0000-000000000000");
  });

  it("expose les deux parties du circuit, dans l'ordre du SSOT", async () => {
    // `["formateur", "axionia"]` — l'organisme CONCLUT, il signe en dernier.
    const [etat] = await lireLettresMissionDuFormateur(TRAINER);
    expect(etat?.parties.map((p) => p.partie)).toStrictEqual(["formateur", "axionia"]);
  });

  it("rattache la lettre à sa session — le formateur doit savoir laquelle il signe", async () => {
    const [etat] = await lireLettresMissionDuFormateur(TRAINER);
    expect(etat?.sessionNumero).toBe("AXI-SES-2026-0011");
    expect(etat?.sessionTitre).toBe("Prompt engineering — niveau 1");
  });

  it("🔴 ne retient que la lettre la PLUS RÉCENTE par session (réémission)", async () => {
    // Les précédentes restent en base avec leurs signatures — une preuve ne
    // disparaît pas parce qu'une pièce a été réémise. Mais les afficher côte à
    // côte ferait signer la périmée aussi souvent que la bonne.
    mockPrisma.documentGenere.findMany.mockResolvedValue([
      piece({ id: "recente", numero: "AXI-LM-2026-0009" }),
      piece({ id: "ancienne", numero: "AXI-LM-2026-0004" }),
    ]);
    const etats = await lireLettresMissionDuFormateur(TRAINER);
    expect(etats).toHaveLength(1);
    expect(etats[0]?.numero).toBe("AXI-LM-2026-0009");
  });
});

describe("🔴 le MANDAT — la même règle que la Server Action", () => {
  it("le formateur nommé par la FK peut signer", async () => {
    const [etat] = await lireLettresMissionDuFormateur(TRAINER);
    expect(etat?.peutAgir).toBe(true);
    expect(etat?.motifBlocage).toBeNull();
  });

  it("le formateur nommé par le repli Json `coFormateurs` peut signer", async () => {
    // `resolvePrincipalTrainerId` retombe sur le Json quand la FK est nulle —
    // c'est ce même résolveur qui a IMPRIMÉ son nom sur la pièce. Une lecture
    // qui ne regarderait que la FK refuserait celui que la lettre nomme.
    mockPrisma.documentGenere.findMany.mockResolvedValue([
      piece({
        session: {
          id: SESSION,
          numero: "AXI-SES-2026-0011",
          titreSession: "Session legacy",
          formateurPrincipalId: null,
          coFormateurs: [{ trainerId: TRAINER, role: "principal" }],
        },
      }),
    ]);
    const [etat] = await lireLettresMissionDuFormateur(TRAINER);
    expect(etat?.peutAgir).toBe(true);
  });

  it("🔴 un CO-FORMATEUR ne voit même pas la lettre — elle nomme quelqu'un d'autre", async () => {
    // Le pré-filtre SQL le laisse passer (il est membre de la session), le
    // recoupement mémoire l'écarte. Lui proposer un bouton produirait une pièce
    // dont le nom imprimé et l'identité scellée divergent — la contradiction
    // exacte qu'un contrôle relève.
    mockPrisma.documentGenere.findMany.mockResolvedValue([
      piece({
        session: {
          id: SESSION,
          numero: "AXI-SES-2026-0011",
          titreSession: "Session à deux formateurs",
          formateurPrincipalId: AUTRE_TRAINER,
          coFormateurs: [{ trainerId: TRAINER, role: "co_formateur" }],
        },
      }),
    ]);
    expect(await lireLettresMissionDuFormateur(TRAINER)).toStrictEqual([]);
  });

  it("🔴 aucun formateur résolvable ⇒ personne ne signe", async () => {
    // Le générateur a alors imprimé la raison sociale de l'organisme à la place
    // d'un nom : la pièce ne mandate personne d'identifiable. Elle doit être
    // régénérée, pas signée.
    mockPrisma.documentGenere.findMany.mockResolvedValue([
      piece({
        session: {
          id: SESSION,
          numero: "AXI-SES-2026-0011",
          titreSession: "Session sans formateur",
          formateurPrincipalId: null,
          coFormateurs: [],
        },
      }),
    ]);
    expect(await lireLettresMissionDuFormateur(TRAINER)).toStrictEqual([]);
  });
});

describe("🔴 ce qu'on refuse AVANT le clic, et pourquoi", () => {
  it("un SPÉCIMEN bloque, et le motif dit quoi faire", async () => {
    // `signerDocument` refusera de toute façon. Proposer le bouton ferait passer
    // un refus légitime pour une panne, et le formateur réessaierait au lieu de
    // faire compléter l'identité de l'organisme.
    mockPrisma.documentGenere.findMany.mockResolvedValue([
      piece({ metadata: { specimen: true, champsManquants: ["SIRET"] } }),
    ]);
    const [etat] = await lireLettresMissionDuFormateur(TRAINER);
    expect(etat?.peutAgir).toBe(false);
    expect(etat?.motifBlocage).toContain("SPÉCIMEN");
  });

  it("ne se laisse pas berner par un `metadata` qui n'est pas un objet", async () => {
    // Colonne `Json` : le type n'est PAS garanti côté application.
    mockPrisma.documentGenere.findMany.mockResolvedValue([piece({ metadata: ["specimen"] })]);
    const [etat] = await lireLettresMissionDuFormateur(TRAINER);
    expect(etat?.peutAgir).toBe(true);
  });

  it("ne peut plus signer une fois qu'il a signé — et on le lui dit", async () => {
    mockPrisma.documentGenere.findMany.mockResolvedValue([
      piece({
        signatures: [
          {
            partie: "formateur",
            signataireNom: "Williams Jullin",
            signataireQualite: "Formateur",
            signeAt: new Date("2026-06-10T08:15:00.000Z"),
            selfHash: "a".repeat(64),
          },
        ],
      }),
    ]);
    const [etat] = await lireLettresMissionDuFormateur(TRAINER);
    expect(etat?.peutAgir).toBe(false);
    expect(etat?.motifBlocage).toContain("déjà signé");
  });

  it("🔴 le SPÉCIMEN prime sur « déjà signé » dans le motif affiché", async () => {
    // Le geste correctif est le même dans les deux cas — régénérer la pièce.
    // Annoncer d'abord « vous avez déjà signé » ferait croire que tout va bien
    // sur une pièce qui n'a aucune valeur juridique.
    mockPrisma.documentGenere.findMany.mockResolvedValue([
      piece({
        metadata: { specimen: true },
        signatures: [
          {
            partie: "formateur",
            signataireNom: "Williams Jullin",
            signataireQualite: "Formateur",
            signeAt: new Date("2026-06-10T08:15:00.000Z"),
            selfHash: "a".repeat(64),
          },
        ],
      }),
    ]);
    const [etat] = await lireLettresMissionDuFormateur(TRAINER);
    expect(etat?.motifBlocage).toContain("SPÉCIMEN");
  });
});

describe("🔴 ce qui est présenté au signataire", () => {
  it("rend le signataire, son horodatage en heure de PARIS, et son empreinte", async () => {
    // « Signé » tout court n'est pas une preuve, c'est une affirmation.
    mockPrisma.documentGenere.findMany.mockResolvedValue([
      piece({
        signatures: [
          {
            partie: "axionia",
            signataireNom: "Williams Jullin",
            signataireQualite: null,
            // 08:15 UTC = 10:15 à Paris en juin. Un affichage UTC ferait
            // constater au formateur une heure qui n'est pas la sienne.
            signeAt: new Date("2026-06-10T08:15:00.000Z"),
            selfHash: "b".repeat(64),
          },
        ],
      }),
    ]);
    const [etat] = await lireLettresMissionDuFormateur(TRAINER);
    const organisme = etat?.parties.find((p) => p.partie === "axionia");
    expect(organisme?.signee).toBe(true);
    expect(organisme?.signataireNom).toBe("Williams Jullin");
    expect(organisme?.signeAtLisible).toContain("10:15");
    expect(organisme?.empreinte).toBe("b".repeat(64));
  });

  it("🔴 n'expose JAMAIS l'e-mail du signataire", async () => {
    // Il reste scellé en base — il sert au recalcul de l'empreinte, pas à
    // l'affichage. Le sélectionner ici le ferait fuiter vers le navigateur, par
    // les props d'un composant client.
    const etats = await lireLettresMissionDuFormateur(TRAINER);
    expect(JSON.stringify(etats)).not.toContain("@");
    const select = (
      mockPrisma.documentGenere.findMany.mock.calls[0]?.[0] as {
        select: { signatures: { select: Record<string, unknown> } };
      }
    ).select.signatures.select;
    expect(select["signataireEmail"]).toBeUndefined();
  });

  it("🔴 la mention affichée vient du module VERSIONNÉ, pas d'un texte local", async () => {
    // Si l'écran affichait un texte réécrit à la main, `MENTION_VERSION_DOCUMENT`
    // scellerait une version qui ne correspondrait à rien de ce qui a été lu.
    const [etat] = await lireLettresMissionDuFormateur(TRAINER);
    expect(etat?.mentions.length).toBeGreaterThan(3);
    expect(etat?.mentions[0]).toContain("En qualité de formateur");
    expect(etat?.mentions.join(" ")).toContain("article 1366");
    expect(etat?.mentions.join(" ")).toContain("lettre de mission n° AXI-LM-2026-0004");
    // Le canal maison DOIT porter son plafond probant : la chaîne ne remet aucun
    // certificat au signataire, et le taire serait une survente.
    expect(etat?.mentions.join(" ")).toContain("certificat délivré par un prestataire");
    expect(MENTION_VERSION_DOCUMENT).toBe("doc-v1");
  });

  it("🔴 dit que le registre est tenu par l'autre partie", async () => {
    // Les deux signataires sont ici deux personnes distinctes — contrairement au
    // relevé — mais le registre qui porte la preuve appartient à l'une d'elles.
    // Le taire laisserait croire à un tiers neutre qui n'existe pas.
    const [etat] = await lireLettresMissionDuFormateur(TRAINER);
    expect(etat?.plafondProbant).toContain("l'une des deux parties");
    expect(etat?.plafondProbant).toContain("registre scellé");
  });
});

describe("🔴 chemin CONSOLE — contreseing de l'organisme", () => {
  it("rend `null` quand aucune lettre n'a été générée", async () => {
    mockPrisma.documentGenere.findFirst.mockResolvedValue(null);
    expect(await lireEtatSignatureLettreMissionConsole(SESSION, "admin")).toBeNull();
  });

  it("un `super_admin` peut contresigner, au titre `axionia`", async () => {
    // ⚠️ `axionia`, PAS `responsable_pedagogique` : l'organisme MANDATE ici, il
    // n'atteste pas un fait pédagogique. Le SSOT tranche.
    const etat = await lireEtatSignatureLettreMissionConsole(SESSION, "super_admin");
    expect(etat?.peutAgir).toBe(true);
    expect(etat?.pourPartie).toBe("axionia");
  });

  it("🔴 un `editor` ne peut PAS contresigner — cela engage l'organisme", async () => {
    // `requireAdminWrite` l'admet, `signerDocument` non. Le vérifier ici évite de
    // lui proposer un bouton qui échouera : contresigner confie une mission, un
    // tarif journalier et une clause de confidentialité de cinq ans.
    const etat = await lireEtatSignatureLettreMissionConsole(SESSION, "editor");
    expect(etat?.peutAgir).toBe(false);
    expect(etat?.motifBlocage).toContain("engage l'organisme");
  });

  it("ne peut plus contresigner une fois le contreseing posé", async () => {
    mockPrisma.documentGenere.findFirst.mockResolvedValue(
      piece({
        signatures: [
          {
            partie: "axionia",
            signataireNom: "Williams Jullin",
            signataireQualite: null,
            signeAt: new Date("2026-06-10T08:15:00.000Z"),
            selfHash: "c".repeat(64),
          },
        ],
      }),
    );
    const etat = await lireEtatSignatureLettreMissionConsole(SESSION, "admin");
    expect(etat?.peutAgir).toBe(false);
    expect(etat?.motifBlocage).toContain("déjà contresigné");
  });

  it("un SPÉCIMEN bloque AUSSI le contreseing", async () => {
    mockPrisma.documentGenere.findFirst.mockResolvedValue(
      piece({ metadata: { specimen: true, champsManquants: ["SIRET"] } }),
    );
    const etat = await lireEtatSignatureLettreMissionConsole(SESSION, "super_admin");
    expect(etat?.peutAgir).toBe(false);
  });

  it("🔴 la console ne dépend PAS du mandat du formateur", async () => {
    // L'organisme contresigne quel que soit le formateur nommé : c'est lui la
    // partie `axionia`. Un contrôle de mandat ici bloquerait le contreseing
    // d'une lettre parfaitement valable.
    mockPrisma.documentGenere.findFirst.mockResolvedValue(
      piece({
        session: {
          id: SESSION,
          numero: "AXI-SES-2026-0011",
          titreSession: "Session confiée à un autre",
          formateurPrincipalId: AUTRE_TRAINER,
          coFormateurs: [],
        },
      }),
    );
    const etat = await lireEtatSignatureLettreMissionConsole(SESSION, "admin");
    expect(etat?.peutAgir).toBe(true);
  });

  it("la mention affichée est celle de l'ORGANISME, pas du formateur", async () => {
    // L'un accepte une mission, l'autre la confie et conclut. Leur faire signer
    // le même texte serait faux sur une pièce contractuelle.
    const console_ = await lireEtatSignatureLettreMissionConsole(SESSION, "admin");
    const [formateur] = await lireLettresMissionDuFormateur(TRAINER);
    expect(console_?.mentions[0]).toContain("je la conclus");
    expect(console_?.mentions[0]).not.toBe(formateur?.mentions[0]);
  });

  it("🔴 retient la lettre la PLUS RÉCENTE, comme le fait l'écran du formateur", async () => {
    // Deux tris différents feraient contresigner à l'organisme une pièce que le
    // formateur n'a pas sous les yeux.
    await lireEtatSignatureLettreMissionConsole(SESSION, "admin");
    const arg = mockPrisma.documentGenere.findFirst.mock.calls[0]?.[0] as {
      orderBy: unknown;
      where: Record<string, unknown>;
    };
    expect(arg.orderBy).toStrictEqual([{ createdAt: "desc" }, { id: "desc" }]);
    expect(arg.where["type"]).toBe("lettre_mission");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Lettres-CADRE (2026-08-01) — mandat par ancre directe, sans session
// ─────────────────────────────────────────────────────────────────────────────

function pieceCadre(over: Record<string, unknown> = {}) {
  return piece({
    id: "55555555-5555-4555-8555-555555555555",
    numero: "AXI-LM-2026-0009",
    session: null,
    trainerId: TRAINER,
    metadata: {
      lettreCadre: {
        du: "2026-09-01",
        au: "2026-12-31",
        sessionIds: [SESSION],
      },
    },
    ...over,
  });
}

describe("lettres-CADRE", () => {
  it("le formateur ancré la voit, avec sa période lisible", async () => {
    mockPrisma.documentGenere.findMany.mockResolvedValue([pieceCadre()]);

    const [etat] = await lireLettresMissionDuFormateur(TRAINER);

    expect(etat).toBeDefined();
    expect(etat!.estCadre).toBe(true);
    expect(etat!.periodeLisible).toContain("septembre 2026");
    expect(etat!.periodeLisible).toContain("décembre 2026");
    // Pas de session : le rattachement affiché est la période, rien d'autre.
    expect(etat!.sessionTitre).toBe("");
    expect(etat!.peutAgir).toBe(true);
  });

  it("🔴 refuse le bouton à un formateur qui n'est PAS l'ancre — même sans session à résoudre", async () => {
    mockPrisma.documentGenere.findMany.mockResolvedValue([
      pieceCadre({ trainerId: AUTRE_TRAINER }),
    ]);

    // La pièce ne le concerne pas : elle ne doit pas APPARAÎTRE du tout.
    expect(await lireLettresMissionDuFormateur(TRAINER)).toStrictEqual([]);
  });

  it("🔴 l'ancre directe PRIME sur la résolution par session", async () => {
    // Pièce ancrée sur AUTRE_TRAINER mais dont la session résout vers TRAINER
    // (réaffectation après émission). C'est l'ancre — ce que le générateur a
    // imprimé — qui fait foi : TRAINER ne doit PAS pouvoir signer un mandat qui
    // nomme quelqu'un d'autre.
    mockPrisma.documentGenere.findMany.mockResolvedValue([piece({ trainerId: AUTRE_TRAINER })]);

    expect(await lireLettresMissionDuFormateur(TRAINER)).toStrictEqual([]);
  });

  it("une réémission de la MÊME période remplace la précédente ; une autre période coexiste", async () => {
    const t2 = { du: "2027-01-01", au: "2027-03-31", sessionIds: [] };
    mockPrisma.documentGenere.findMany.mockResolvedValue([
      // Tri createdAt desc simulé : la plus récente d'abord.
      pieceCadre({ id: "66666666-6666-4666-8666-666666666666" }),
      pieceCadre(), // même période → écartée
      pieceCadre({ id: "77777777-7777-4777-8777-777777777777", metadata: { lettreCadre: t2 } }),
    ]);

    const etats = await lireLettresMissionDuFormateur(TRAINER);
    expect(etats).toHaveLength(2);
    expect(etats[0]!.documentGenereId).toBe("66666666-6666-4666-8666-666666666666");
  });

  it("métadonnée illisible : la pièce reste visible, en lettre de session dégradée", async () => {
    mockPrisma.documentGenere.findMany.mockResolvedValue([
      pieceCadre({ metadata: { lettreCadre: "corrompu" } }),
    ]);

    const [etat] = await lireLettresMissionDuFormateur(TRAINER);
    expect(etat).toBeDefined();
    expect(etat!.estCadre).toBe(false);
    expect(etat!.periodeLisible).toBeNull();
  });

  it("la console la rapproche des sessions couvertes (metadata), jamais pour l'autorisation", async () => {
    mockPrisma.documentGenere.findFirst.mockResolvedValue(pieceCadre());

    const etat = await lireEtatSignatureLettreMissionConsole(SESSION, "admin");

    expect(etat?.estCadre).toBe(true);
    expect(etat?.peutAgir).toBe(true);
    const arg = mockPrisma.documentGenere.findFirst.mock.calls[0]?.[0] as {
      where: { OR: unknown[] };
    };
    // La requête cherche la lettre de session OU la lettre-cadre qui couvre
    // cette session par ses métadonnées.
    expect(arg.where.OR).toHaveLength(2);
  });
});
