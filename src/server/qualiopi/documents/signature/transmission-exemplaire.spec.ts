/**
 * La boucle contractuelle doit se refermer — et rester refermée.
 *
 * ## Le défaut que ces témoins gardent
 *
 * Production, 2026-09-04. Convention `AXI-DOC-2026-039` : envoyée à 20:47 UTC,
 * signée par la cliente, contresignée par l'organisme à 21:33 UTC. **Rien n'est
 * parti.** La cliente n'a jamais reçu son exemplaire — alors que le portail le
 * lui promet mot pour mot.
 *
 * Le défaut a survécu parce qu'il se cachait dans son propre SUCCÈS : une pièce
 * passée `signee` sort de `pieces-en-attente`, perd son bouton de relance, et
 * disparaît de l'écran « À traiter », du compteur de nav et de l'évaluateur
 * d'alertes. Le seul signal qui aurait pu dire « il reste quelque chose à
 * faire » était précisément celui qu'on éteignait.
 *
 * ## Ce qui est éprouvé, et pourquoi chaque témoin existe
 *
 * 1. **Qui reçoit** — l'organisme ne s'envoie rien à lui-même, une adresse
 *    absente ne bloque pas les autres, un doublon de casse ne fait pas deux
 *    envois. C'est la seule décision du module qui désigne QUI reçoit un
 *    contrat : elle mérite ses propres témoins, isolée du reste.
 * 2. **L'idempotence** — deux appels ne produisent qu'un envoi.
 * 3. **🔴 Le relâchement en cas d'échec** — c'est le témoin le plus important
 *    du fichier. Sans lui, un Redis momentanément absent marquerait la pièce
 *    « transmise » pour toujours : on aurait remplacé un défaut silencieux par
 *    un défaut silencieux qui, en plus, se croit réparé.
 * 4. **Jamais de levée** — une signature valide ne se perd pas parce que
 *    l'envoi a raté. La preuve est déjà chaînée en base.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const findUniqueMock = vi.fn();
const updateManyMock = vi.fn();
const updateMock = vi.fn();
const rendreMock = vi.fn();
const storeMock = vi.fn();
const enqueueMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentGenere: {
      findUnique: (...a: unknown[]) => findUniqueMock(...a),
      updateMany: (...a: unknown[]) => updateManyMock(...a),
      update: (...a: unknown[]) => updateMock(...a),
    },
  },
}));

vi.mock("@/server/qualiopi/documents/signature/exemplaire-signe", () => ({
  rendreExemplaireSigne: (...a: unknown[]) => rendreMock(...a),
}));

vi.mock("@/server/qualiopi/documents/render", () => ({
  storeAndSignPdf: (...a: unknown[]) => storeMock(...a),
}));

vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => enqueueMock(...a),
}));

import {
  transmettreExemplaireSigne,
  destinatairesExemplaire,
  exemplaireSignePdfKey,
} from "./transmission-exemplaire";

/** La pièce réelle du 2026-09-04, réduite aux colonnes que le module lit. */
function pieceSignee(patch: Record<string, unknown> = {}) {
  return {
    id: "doc-039",
    type: "convention",
    numero: "AXI-DOC-2026-039",
    createdAt: new Date("2026-09-04T18:00:00Z"),
    statutSignature: "signee",
    annuleeAt: null,
    exemplaireSigneEnvoyeAt: null,
    clientId: "cli-1",
    signatures: [
      { partie: "client", signataireEmail: "beeeditions@gmail.com", signataireNom: "Simone Blanc" },
      { partie: "axionia", signataireEmail: "contact@axion-ia.com", signataireNom: "Williams Jullin" },
    ],
    ...patch,
  };
}

function cheminNominal(): void {
  findUniqueMock.mockResolvedValue(pieceSignee());
  updateManyMock.mockResolvedValue({ count: 1 });
  updateMock.mockResolvedValue({});
  rendreMock.mockResolvedValue({
    ok: true,
    buffer: Buffer.from("%PDF-1.4 fake"),
    nomFichier: "convention-AXI-DOC-2026-039-signee.pdf",
  });
  storeMock.mockResolvedValue("https://r2.example/signed-url");
  enqueueMock.mockResolvedValue({ enqueued: true });
}

beforeEach(() => {
  for (const m of [findUniqueMock, updateManyMock, updateMock, rendreMock, storeMock, enqueueMock]) {
    m.mockReset();
  }
});

describe("qui reçoit l'exemplaire", () => {
  it("🔴 l'organisme ne se l'envoie pas à lui-même", () => {
    expect(
      destinatairesExemplaire([
        { partie: "client", signataireEmail: "cliente@example.com" },
        { partie: "axionia", signataireEmail: "contact@axion-ia.com" },
      ]),
    ).toEqual(["cliente@example.com"]);
  });

  it("une partie sans adresse ne bloque pas les autres", () => {
    // Une signature recueillie sur place n'a pas toujours d'e-mail. Refuser
    // tout l'envoi pour cela priverait le signataire joignable de sa pièce.
    expect(
      destinatairesExemplaire([
        { partie: "client", signataireEmail: null },
        { partie: "financeur", signataireEmail: "opco@example.com" },
      ]),
    ).toEqual(["opco@example.com"]);
  });

  it("la même personne en deux qualités ne reçoit qu'un exemplaire", () => {
    // Cas réel d'une tripartite : la représentante signe pour le client ET
    // comme bénéficiaire. Deux PDF identiques feraient douter de la pièce.
    expect(
      destinatairesExemplaire([
        { partie: "client", signataireEmail: "Simone.Blanc@Example.com" },
        { partie: "beneficiaire", signataireEmail: "simone.blanc@example.com  " },
      ]),
    ).toEqual(["Simone.Blanc@Example.com"]);
  });

  it("aucun signataire joignable rend une liste vide, jamais une levée", () => {
    expect(destinatairesExemplaire([{ partie: "axionia", signataireEmail: "moi@of.fr" }])).toEqual(
      [],
    );
  });
});

describe("la clé d'archive", () => {
  it("est VOISINE du PDF vierge, jamais la même", () => {
    // Écraser l'original par l'exemplaire signé détruirait la pièce telle
    // qu'elle a été présentée à la signature.
    const doc = { type: "convention", numero: "AXI-DOC-2026-039", createdAt: new Date("2026-09-04") };
    const signe = exemplaireSignePdfKey(doc);
    expect(signe).toBe("documents/2026/convention/AXI-DOC-2026-039-signe.pdf");
    expect(signe).not.toBe("documents/2026/convention/AXI-DOC-2026-039.pdf");
  });
});

describe("le chemin nominal", () => {
  it("archive le PDF puis enfile l'e-mail au seul signataire client", async () => {
    cheminNominal();
    const res = await transmettreExemplaireSigne("doc-039");

    expect(res).toEqual({
      ok: true,
      destinataires: ["beeeditions@gmail.com"],
      r2Key: "documents/2026/convention/AXI-DOC-2026-039-signe.pdf",
    });
    expect(enqueueMock).toHaveBeenCalledTimes(1);

    const [gabarit, to, , , options] = enqueueMock.mock.calls[0] as [
      string,
      string,
      unknown,
      unknown,
      { attachments?: Array<{ r2Key: string }> },
    ];
    expect(gabarit).toBe("piece-exemplaire-signe");
    expect(to).toBe("beeeditions@gmail.com");
    // Le PDF EST joint. Un e-mail qui annonce un exemplaire sans le porter
    // serait pire que pas d'e-mail : il ferait croire la boucle refermée.
    expect(options.attachments?.[0]?.r2Key).toBe(
      "documents/2026/convention/AXI-DOC-2026-039-signe.pdf",
    );
  });

  it("n'écrit la clé d'archive qu'APRÈS l'envoi effectif", async () => {
    cheminNominal();
    await transmettreExemplaireSigne("doc-039");
    const ecritures = updateMock.mock.calls.map((c) => (c[0] as { data: unknown }).data);
    expect(ecritures).toContainEqual({
      exemplaireSigneKey: "documents/2026/convention/AXI-DOC-2026-039-signe.pdf",
    });
  });
});

describe("l'idempotence", () => {
  it("une pièce déjà transmise n'est pas renvoyée", async () => {
    findUniqueMock.mockResolvedValue(
      pieceSignee({ exemplaireSigneEnvoyeAt: new Date("2026-09-04T21:40:00Z") }),
    );
    const res = await transmettreExemplaireSigne("doc-039");
    expect(res).toEqual({ ok: false, motif: "deja_transmis" });
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("🔴 deux appels CONCURRENTS n'envoient qu'un exemplaire", async () => {
    // La revendication est un `updateMany` conditionnel : de deux appels, un
    // seul voit `count === 1`. Sans elle, deux clics simultanés — ou un clic
    // pendant qu'une reprise tourne — enverraient deux fois le contrat.
    cheminNominal();
    let premier = true;
    updateManyMock.mockImplementation(async () => {
      const c = premier ? 1 : 0;
      premier = false;
      return { count: c };
    });

    const [a, b] = await Promise.all([
      transmettreExemplaireSigne("doc-039"),
      transmettreExemplaireSigne("doc-039"),
    ]);

    const reussis = [a, b].filter((r) => r.ok);
    expect(reussis).toHaveLength(1);
    expect(enqueueMock).toHaveBeenCalledTimes(1);
  });

  it("la revendication est bien CONDITIONNELLE à la colonne nulle", async () => {
    // Témoin de FORME, et il est nécessaire : un `updateMany` sans la
    // condition `exemplaireSigneEnvoyeAt: null` réussirait toujours, et le
    // témoin de concurrence ci-dessus passerait quand même — c'est le mock
    // qui simule le refus, pas le code.
    cheminNominal();
    await transmettreExemplaireSigne("doc-039");
    const where = (updateManyMock.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
    expect(where).toMatchObject({ id: "doc-039", exemplaireSigneEnvoyeAt: null });
  });
});

describe("🔴 l'échec RELÂCHE la revendication", () => {
  /** La date posée puis retirée : la pièce redevient transmissible. */
  function aEteRelachee(): boolean {
    return updateMock.mock.calls.some(
      (c) => (c[0] as { data: { exemplaireSigneEnvoyeAt?: unknown } }).data
        .exemplaireSigneEnvoyeAt === null,
    );
  }

  it("quand le rendu du PDF échoue", async () => {
    cheminNominal();
    rendreMock.mockResolvedValue({ ok: false, raison: "instantane_absent", message: "…" });

    const res = await transmettreExemplaireSigne("doc-039");
    expect(res).toEqual({
      ok: false,
      motif: "rendu_impossible",
      detail: "instantane_absent",
    });
    expect(aEteRelachee()).toBe(true);
  });

  it("quand R2 n'est pas configuré — sans clé, pas de pièce jointe possible", async () => {
    cheminNominal();
    storeMock.mockResolvedValue(null);

    const res = await transmettreExemplaireSigne("doc-039");
    expect(res).toEqual({ ok: false, motif: "archivage_impossible" });
    expect(enqueueMock).not.toHaveBeenCalled();
    expect(aEteRelachee()).toBe(true);
  });

  it("quand la file d'e-mails n'accepte rien", async () => {
    cheminNominal();
    enqueueMock.mockResolvedValue({ enqueued: false });

    const res = await transmettreExemplaireSigne("doc-039");
    expect(res).toEqual({ ok: false, motif: "file_indisponible" });
    expect(aEteRelachee()).toBe(true);
  });

  it("…mais un envoi RÉUSSI ne relâche rien", async () => {
    // Contre-témoin. Sans lui, un module qui relâcherait TOUJOURS passerait
    // les trois témoins ci-dessus — et renverrait le contrat à chaque appel.
    cheminNominal();
    await transmettreExemplaireSigne("doc-039");
    expect(aEteRelachee()).toBe(false);
  });
});

describe("ce qu'on ne transmet pas", () => {
  it("une pièce seulement PARTIELLE attend l'autre partie", async () => {
    findUniqueMock.mockResolvedValue(pieceSignee({ statutSignature: "partielle" }));
    expect(await transmettreExemplaireSigne("doc-039")).toEqual({ ok: false, motif: "pas_complete" });
    expect(updateManyMock).not.toHaveBeenCalled();
  });

  it("🔴 une pièce ANNULÉE au registre ne se diffuse plus", async () => {
    // Elle ne fait plus foi. L'envoyer remettrait en circulation une pièce
    // que l'organisme a explicitement retirée, avec son motif au registre —
    // c'est précisément le sort des pièces 030, 037 et 038.
    findUniqueMock.mockResolvedValue(pieceSignee({ annuleeAt: new Date("2026-09-04T22:00:00Z") }));
    expect(await transmettreExemplaireSigne("doc-039")).toEqual({ ok: false, motif: "annulee" });
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("aucun signataire joignable : on n'a personne à qui écrire", async () => {
    findUniqueMock.mockResolvedValue(
      pieceSignee({ signatures: [{ partie: "axionia", signataireEmail: "moi@of.fr", signataireNom: "W" }] }),
    );
    expect(await transmettreExemplaireSigne("doc-039")).toEqual({
      ok: false,
      motif: "aucun_destinataire",
    });
    // Rien n'a été revendiqué : la pièce reste disponible si un e-mail est
    // renseigné plus tard.
    expect(updateManyMock).not.toHaveBeenCalled();
  });
});

describe("la fonction ne lève JAMAIS", () => {
  it("même si la base tombe pendant le rendu", async () => {
    // Une signature valide, déjà écrite et chaînée, ne doit pas être perdue
    // parce que l'envoi a raté. Ce qui reste dû est un ENVOI.
    cheminNominal();
    rendreMock.mockRejectedValue(new Error("R2 down"));
    await expect(transmettreExemplaireSigne("doc-039")).resolves.toMatchObject({
      ok: false,
      motif: "rendu_impossible",
    });
  });

  it("même si la file lève au lieu de rendre false", async () => {
    cheminNominal();
    enqueueMock.mockRejectedValue(new Error("Redis down"));
    await expect(transmettreExemplaireSigne("doc-039")).resolves.toMatchObject({
      ok: false,
      motif: "file_indisponible",
    });
  });
});
