/**
 * Témoin — un jeton n'est marqué REMIS que si l'envoi a été accepté.
 *
 * ## Ce que ces cas gardent
 *
 * `envoyeAt` est la seule chose qui distingue, en base, un lien FABRIQUÉ d'un
 * lien REMIS. Toute la mécanique de rattrapage en dépend : la garde du cron
 * `liens-emargement-j0` lit cette colonne pour savoir s'il reste du travail.
 *
 * Le défaut d'origine (AXI-SESS-2026-001, SCI Invest Sun) venait précisément de
 * l'absence de cette distinction : « Émettre les liens » fabriquait des jetons
 * sans rien expédier, la garde voyait « un jeton vivant existe » et se
 * désarmait. La stagiaire n'a jamais reçu son lien, personne n'a pu émarger, et
 * l'attestation — qui exige une trace de présence — est restée impossible.
 *
 * ## Pourquoi les cas d'ÉCHEC comptent au moins autant que le cas nominal
 *
 * Poser la marque trop tôt reproduirait le défaut à l'identique, dans l'autre
 * sens : un jeton marqué « remis » que personne n'a reçu sortirait du champ du
 * rattrapage POUR TOUJOURS, et cette fois aucun écran ne le dirait. C'est la
 * famille de défaut que ce dépôt paie en boucle — un horodatage posé avant
 * l'acte qu'il atteste. Les deux cas d'échec ci-dessous valent donc garde
 * principale, pas décoration.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

interface ArgUpdate {
  where: { id: string };
  data: { envoyeAt: Date };
}

const update = vi.fn(async (_args: ArgUpdate): Promise<unknown> => ({}));
const findUnique = vi.fn(async (..._a: unknown[]): Promise<unknown> => null);
const enqueueEmail = vi.fn(async (..._a: unknown[]): Promise<unknown> => ({ enqueued: true }));
const creerTokenInscription = vi.fn(async (..._a: unknown[]) => ({
  token: "t".repeat(64),
  tokenId: "jeton-1",
  expiresAt: new Date("2026-09-08T00:00:00Z"),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: {
      get findUnique() {
        return findUnique;
      },
    },
    emargementToken: {
      get update() {
        return update;
      },
    },
  },
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => enqueueEmail(...a),
}));
vi.mock("@/server/qualiopi/emargement/token-service", () => ({
  creerTokenInscription: (...a: unknown[]) => creerTokenInscription(...a),
  TokenEmargementError: class extends Error {},
}));
vi.mock("@/server/qualiopi/inscriptions/inscriptions-actives", () => ({
  inscriptionsActives: () => ({}),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { envoyerLiensPourSession } from "./envoi-liens";

const SESSION = {
  numero: "AXI-SESS-2026-001",
  titreSession: "IA pour bien commencer",
  dateDebut: new Date("2026-09-05T09:00:00Z"),
  dateFin: new Date("2026-09-05T17:00:00Z"),
  enrollments: [
    { id: "insc-1", trainee: { prenom: "Simone", nom: "Blanc", email: "simone@example.test" } },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  findUnique.mockResolvedValue(SESSION);
});

describe("🔴 la marque de remise suit l'envoi", () => {
  it("pose envoyeAt sur LE jeton créé, quand la file accepte", async () => {
    enqueueEmail.mockResolvedValue({ enqueued: true });

    const r = await envoyerLiensPourSession({ sessionId: "s1", origine: "console" });

    expect(r).toMatchObject({ ok: true, envoyes: 1 });
    expect(update).toHaveBeenCalledTimes(1);
    // L'identité du jeton compte : marquer « un » jeton ne prouve rien, c'est
    // CELUI qui porte le lien parti qui doit sortir du champ du rattrapage.
    const arg = update.mock.calls[0]?.[0];
    expect(arg?.where.id).toBe("jeton-1");
    expect(arg?.data.envoyeAt).toBeInstanceOf(Date);
  });

  it("N'ÉCRIT RIEN quand la file est indisponible", async () => {
    enqueueEmail.mockResolvedValue({ enqueued: false });

    const r = await envoyerLiensPourSession({ sessionId: "s1", origine: "cron-j0" });

    expect(update).not.toHaveBeenCalled();
    // Zéro envoi rend `ok: false` avec le motif du premier échec — c'est le
    // contrat existant du service, et il est plus fort que ce que j'attendais :
    // l'appelant ne peut pas confondre « rien n'est parti » avec un succès vide.
    expect(r).toMatchObject({ ok: false });
    expect((r as { motif: string }).motif).toContain("File de messages indisponible");
  });

  it("N'ÉCRIT RIEN quand l'e-mail part en corbeille de validation", async () => {
    // Cas subtil : l'envoi n'a pas échoué, il est SUSPENDU à une approbation
    // humaine. Marquer « remis » ici sortirait le jeton du rattrapage alors que
    // le stagiaire n'a toujours rien — et le rattrapage est justement ce qui
    // couvre une approbation qui ne vient jamais.
    enqueueEmail.mockResolvedValue({ enqueued: false, garePourValidation: true });

    await envoyerLiensPourSession({ sessionId: "s1", origine: "console" });

    expect(update).not.toHaveBeenCalled();
  });
});

describe("🔴 une marque non posée ne fait pas échouer un envoi réussi", () => {
  it("compte l'envoi même si l'écriture de envoyeAt échoue", async () => {
    // L'e-mail EST accepté par la file : le stagiaire recevra son lien. Faire
    // échouer l'envoi pour une marque non posée inverserait le remède et le mal.
    // Le seul coût est qu'un passage du cron pourra réémettre — visible, et sans
    // perte de preuve.
    enqueueEmail.mockResolvedValue({ enqueued: true });
    update.mockRejectedValueOnce(new Error("base indisponible"));

    const r = await envoyerLiensPourSession({ sessionId: "s1", origine: "console" });

    expect(r).toMatchObject({ ok: true, envoyes: 1 });
    expect((r as { echecs: unknown[] }).echecs).toHaveLength(0);
  });

  it("tient aussi quand l'écriture lève de façon SYNCHRONE", async () => {
    // 🔴 Ce cas manquait, et un test voisin l'a attrapé avant la production.
    //
    // La première version protégeait l'écriture par un `.catch()`, qui
    // n'intercepte qu'une promesse REJETÉE. Si l'accès au modèle lève d'abord —
    // client non initialisé, modèle absent d'un double de test —, l'exception est
    // synchrone : aucun `.catch()` n'est encore attaché, elle remonte au `try` de
    // la boucle, et l'envoi RÉUSSI était rapporté « Envoi impossible ».
    //
    // 🔑 Un fail-soft qui ne couvre qu'une des deux façons d'échouer n'est pas un
    // fail-soft — et la moitié non couverte transforme un succès en échec, ce
    // qui est exactement l'inversion que ce garde-fou existe pour empêcher.
    enqueueEmail.mockResolvedValue({ enqueued: true });
    update.mockImplementationOnce(() => {
      throw new Error("client Prisma non initialisé");
    });

    const r = await envoyerLiensPourSession({ sessionId: "s1", origine: "console" });

    expect(r).toMatchObject({ ok: true, envoyes: 1 });
    expect((r as { echecs: unknown[] }).echecs).toHaveLength(0);
  });
});
