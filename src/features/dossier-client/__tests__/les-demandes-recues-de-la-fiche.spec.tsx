/**
 * Carte « Demandes reçues » de la fiche client : le message du formulaire, l'accusé automatique et
 * les réponses de l'équipe, lus par `Submission.ficheClientId` (+ fiches absorbées) puis par
 * l'empreinte exacte de l'adresse. Aucun corps dans le fil, accusé jamais compté comme réponse.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  submission: { findMany: vi.fn() },
  submissionReply: { findMany: vi.fn() },
  emailLogContent: { findMany: vi.fn(), findFirst: vi.fn() },
  client: { findUnique: vi.fn() },
  clientFusion: { findMany: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
const accusesMock = vi.hoisted(() => vi.fn());
vi.mock("@/features/admin-submissions/accuse-reception", () => ({
  lireAccusesMessages: accusesMock,
}));

import { lireDemandesDeLaFiche } from "../demandes-de-la-fiche";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import {
  CarteDemandesRecues,
  masqueAdresses,
} from "@/components/admin/dossier-client/fiche/CarteDemandesRecues";
import { demandesEnEchanges } from "../demandes-de-la-fiche";
import { resumeDemandesRecues } from "@/components/admin/dossier-client/fiche/CarteDemandesRecues";
import { compterEmails } from "@/components/admin/dossier-client/fiche/TuilesEmails";

const FICHE = "11111111-1111-4111-8111-111111111111";
const ABSORBEE = "22222222-2222-4222-8222-222222222222";

const sub = (id: string, iso: string, extra: Record<string, unknown> = {}) => ({
  id,
  type: "contact",
  source: null,
  submittedAt: new Date(iso),
  deletedAt: null,
  contactEmail: "marie@exemple.fr",
  details: { unifiedType: "audit", message: `Message ${id}` },
  ...extra,
});

function accuseEnvoye(logId: string, iso: string) {
  return {
    etat: "envoye" as const,
    date: new Date(iso),
    essais: 1,
    motif: null,
    rebond: null,
    rattachement: "exact" as const,
    emailLogId: logId,
    absenceVoulue: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.clientFusion.findMany.mockResolvedValue([]);
  prismaMock.client.findUnique.mockResolvedValue({ contactEmail: "marie@exemple.fr" });
  prismaMock.submission.findMany.mockResolvedValue([]);
  prismaMock.submissionReply.findMany.mockResolvedValue([]);
  prismaMock.emailLogContent.findMany.mockResolvedValue([]);
  prismaMock.emailLogContent.findFirst.mockResolvedValue(null);
  accusesMock.mockResolvedValue(new Map());
});

describe("lireDemandesDeLaFiche", () => {
  it("rend deux demandes avec message, accusé et réponse, la plus récente d'abord", async () => {
    prismaMock.submission.findMany.mockResolvedValue([
      sub("s-ancien", "2026-10-01T09:00:00Z"),
      sub("s-recent", "2026-11-03T09:00:00Z"),
    ]);
    accusesMock.mockResolvedValue(
      new Map([
        ["s-ancien", accuseEnvoye("l1", "2026-10-01T09:00:05Z")],
        ["s-recent", accuseEnvoye("l2", "2026-11-03T09:00:05Z")],
      ]),
    );
    prismaMock.emailLogContent.findMany.mockResolvedValue([
      { emailLogId: "l1", subject: "Nous avons bien reçu", text: "Accusé 1" },
      { emailLogId: "l2", subject: "Nous avons bien reçu", text: "Accusé 2" },
    ]);
    prismaMock.submissionReply.findMany.mockResolvedValue([
      {
        id: "r1",
        submissionId: "s-recent",
        repliedByName: "Will",
        repliedAt: new Date("2026-11-04T08:00:00Z"),
        subject: "Votre audit",
        bodyText: "Bonjour, voici ma réponse",
        deliveryStatus: "sent",
      },
    ]);

    const lu = await lireDemandesDeLaFiche(FICHE, "admin");

    expect(lu.pannes).toEqual({ messages: false, accuses: false, reponses: false });
    expect(lu.demandes.map((d) => d.id)).toEqual(["s-recent", "s-ancien"]);
    const recente = lu.demandes[0]!;
    expect(recente.message).toBe("Message s-recent");
    expect(recente.accuse?.texte).toBe("Accusé 2");
    expect(recente.reponses.map((r) => r.texte)).toEqual(["Bonjour, voici ma réponse"]);
    expect(lu.demandes[1]!.reponses).toEqual([]);
  });

  it("lit aussi les demandes liées aux fiches absorbées par une fusion", async () => {
    prismaMock.clientFusion.findMany
      .mockResolvedValueOnce([{ absorbeId: ABSORBEE }])
      .mockResolvedValue([]);
    prismaMock.submission.findMany.mockResolvedValue([sub("s1", "2026-10-01T09:00:00Z")]);
    await lireDemandesDeLaFiche(FICHE, "super_admin");
    const where = prismaMock.submission.findMany.mock.calls[0]![0].where;
    const hash = hashEmailForLookup("marie@exemple.fr");
    expect(hash).not.toBeNull();
    expect(where.AND).toHaveLength(1);
    expect(where.AND[0].OR).toEqual([
      { ficheClientId: { in: [FICHE, ABSORBEE] } },
      { contactEmailHash: hash, ficheClientId: null },
    ]);
    // ET entre l'OR des types et le lien à la fiche : deux OR distincts, jamais fondus.
    expect(Array.isArray(where.OR)).toBe(true);
    expect(where.OR).toHaveLength(6);
    expect(where.OR).not.toEqual(where.AND[0].OR);
  });

  it("sans adresse sur la fiche : aucune branche par empreinte", async () => {
    prismaMock.client.findUnique.mockResolvedValue({ contactEmail: null });
    await lireDemandesDeLaFiche(FICHE, "admin");
    const where = prismaMock.submission.findMany.mock.calls[0]![0].where;
    expect(where.AND[0].OR).toEqual([{ ficheClientId: { in: [FICHE] } }]);
  });

  it("garde une demande archivée : le where ne filtre pas archivedAt", async () => {
    prismaMock.submission.findMany.mockResolvedValue([
      sub("arch", "2026-10-01T09:00:00Z", { archivedAt: new Date("2026-10-05T09:00:00Z") }),
    ]);
    const lu = await lireDemandesDeLaFiche(FICHE, "admin");
    expect(lu.demandes.map((d) => d.id)).toEqual(["arch"]);
    const where = prismaMock.submission.findMany.mock.calls[0]![0].where;
    expect(JSON.stringify(where)).not.toContain("archivedAt");
    expect(where.deletedAt).toBeNull();
  });

  it("ne lit jamais un type de demande exclu : filtré dans la requête, puis par le prédicat", async () => {
    prismaMock.submission.findMany.mockResolvedValue([
      sub("ok", "2026-10-01T09:00:00Z"),
      // Une ligne exclue qui franchirait la requête (type, corbeille, apporteur) ne passe pas.
      sub("recrut", "2026-10-02T09:00:00Z", {
        details: { unifiedType: "recrutement", message: "CV" },
      }),
      sub("corbeille", "2026-10-03T09:00:00Z", { deletedAt: new Date() }),
    ]);
    const lu = await lireDemandesDeLaFiche(FICHE, "admin");
    expect(lu.demandes.map((d) => d.id)).toEqual(["ok"]);
    const where = JSON.stringify(prismaMock.submission.findMany.mock.calls[0]![0].where);
    for (const t of [
      "audit",
      "implementation",
      "formation",
      "un_a_un",
      "devis",
      "simulateur_roi",
    ]) {
      expect(where).toContain(t);
    }
    expect(where).not.toContain("recrutement");
    // Les messages exclus ne sont pas passés à la lecture des accusés ni des réponses.
    expect(prismaMock.submissionReply.findMany.mock.calls[0]![0].where.submissionId.in).toEqual([
      "ok",
    ]);
  });

  it("plafonne à 20 demandes APRÈS filtrage, et lit plus large que 21", async () => {
    // 25 lignes lues, dont 4 écartées par le prédicat (corbeille) : 21 restent -> plafond atteint.
    prismaMock.submission.findMany.mockResolvedValue([
      ...Array.from({ length: 21 }, (_, i) =>
        sub(`s${i}`, `2026-10-${String(i + 1).padStart(2, "0")}T09:00:00Z`),
      ),
      ...Array.from({ length: 4 }, (_, i) =>
        sub(`c${i}`, "2026-09-01T09:00:00Z", { deletedAt: new Date() }),
      ),
    ]);
    const lu = await lireDemandesDeLaFiche(FICHE, "admin");
    expect(prismaMock.submission.findMany.mock.calls[0]![0].take).toBe(60);
    expect(lu.demandes).toHaveLength(20);
    expect(lu.plafondAtteint).toBe(true);
  });

  it("ne déclare pas le plafond atteint quand le filtre ramène à 20 ou moins", async () => {
    prismaMock.submission.findMany.mockResolvedValue([
      ...Array.from({ length: 20 }, (_, i) =>
        sub(`s${i}`, `2026-10-${String(i + 1).padStart(2, "0")}T09:00:00Z`),
      ),
      sub("c", "2026-09-01T09:00:00Z", { deletedAt: new Date() }),
    ]);
    const lu = await lireDemandesDeLaFiche(FICHE, "admin");
    expect(lu.demandes).toHaveLength(20);
    expect(lu.plafondAtteint).toBe(false);
  });

  it("n'envoie aucune requête pour un rôle sans droit sur les échanges", async () => {
    const lu = await lireDemandesDeLaFiche(FICHE, "commercial_junior");
    expect(lu.demandes).toEqual([]);
    for (const m of [
      prismaMock.submission.findMany,
      prismaMock.submissionReply.findMany,
      prismaMock.emailLogContent.findMany,
      prismaMock.client.findUnique,
      prismaMock.clientFusion.findMany,
    ]) {
      expect(m).not.toHaveBeenCalled();
    }
    expect(accusesMock).not.toHaveBeenCalled();
  });

  it("signale la panne d'une source sans masquer les autres", async () => {
    prismaMock.submission.findMany.mockResolvedValue([sub("s1", "2026-10-01T09:00:00Z")]);
    accusesMock.mockRejectedValue(new Error("boom"));
    prismaMock.submissionReply.findMany.mockResolvedValue([
      {
        id: "r1",
        submissionId: "s1",
        repliedByName: "Will",
        repliedAt: new Date("2026-10-02T08:00:00Z"),
        subject: "Re",
        bodyText: "Réponse lisible",
        deliveryStatus: "sent",
      },
    ]);
    const lu = await lireDemandesDeLaFiche(FICHE, "admin");
    expect(lu.pannes).toEqual({ messages: false, accuses: true, reponses: false });
    expect(lu.demandes[0]!.message).toBe("Message s1");
    expect(lu.demandes[0]!.reponses[0]!.texte).toBe("Réponse lisible");
    const html = renderToStaticMarkup(<CarteDemandesRecues lu={lu} adminPrefix="adm" />);
    expect(html).toContain("lecture impossible");
    expect(html).toContain("Message s1");
    expect(html).toContain("Réponse lisible");
  });

  it("panne de la lecture des messages : la carte le dit, sans lever", async () => {
    prismaMock.submission.findMany.mockRejectedValue(new Error("boom"));
    const lu = await lireDemandesDeLaFiche(FICHE, "admin");
    expect(lu.pannes.messages).toBe(true);
    const html = renderToStaticMarkup(<CarteDemandesRecues lu={lu} adminPrefix="adm" />);
    expect(html).toContain("lecture impossible");
  });

  it("pour un accusé sans copie, dit la raison au lieu d'un vide", async () => {
    prismaMock.submission.findMany.mockResolvedValue([sub("s1", "2026-08-01T09:00:00Z")]);
    accusesMock.mockResolvedValue(new Map([["s1", accuseEnvoye("l1", "2026-08-01T09:00:05Z")]]));
    const lu = await lireDemandesDeLaFiche(FICHE, "admin");
    expect(lu.demandes[0]!.accuse?.texte).toBeNull();
    expect(lu.demandes[0]!.accuse?.raisonSansCopie).toMatch(/copie/i);
  });
});

describe("CarteDemandesRecues", () => {
  it("rend TOUT texte de personne en TEXTE : un <script> s'affiche tel quel", async () => {
    const X = "<script>alert(1)</script>";
    prismaMock.submission.findMany.mockResolvedValue([
      sub("s1", "2026-10-01T09:00:00Z", { details: { unifiedType: "audit", message: X } }),
    ]);
    accusesMock.mockResolvedValue(new Map([["s1", accuseEnvoye("l1", "2026-10-01T09:00:05Z")]]));
    prismaMock.emailLogContent.findMany.mockResolvedValue([
      { emailLogId: "l1", subject: X, text: X },
    ]);
    prismaMock.submissionReply.findMany.mockResolvedValue([
      {
        id: "r1",
        submissionId: "s1",
        repliedByName: X,
        repliedAt: new Date("2026-10-02T08:00:00Z"),
        subject: X,
        bodyText: X,
        deliveryStatus: "sent",
      },
    ]);
    const lu = await lireDemandesDeLaFiche(FICHE, "admin");
    const html = renderToStaticMarkup(<CarteDemandesRecues lu={lu} adminPrefix="adm" />);
    expect(html).not.toContain("<script");
    // message, accusé, sujet + texte de la réponse, auteur : au moins 5 occurrences échappées.
    expect(html.split("&lt;script&gt;alert(1)&lt;/script&gt;").length - 1).toBeGreaterThanOrEqual(
      5,
    );
  });

  it("masque toute adresse e-mail dans le motif de l'accusé", async () => {
    prismaMock.submission.findMany.mockResolvedValue([sub("s1", "2026-10-01T09:00:00Z")]);
    accusesMock.mockResolvedValue(
      new Map([
        [
          "s1",
          {
            ...accuseEnvoye("l1", "2026-10-01T09:00:05Z"),
            etat: "rebond" as const,
            motif: "550 5.1.1 jean.dupont@client.fr: user unknown",
          },
        ],
      ]),
    );
    const lu = await lireDemandesDeLaFiche(FICHE, "admin");
    const html = renderToStaticMarkup(<CarteDemandesRecues lu={lu} adminPrefix="adm" />);
    expect(html).not.toContain("jean.dupont");
    expect(html).not.toContain("client.fr");
    expect(html).toContain("user unknown");
    expect(masqueAdresses("a@b.fr et c@d.com")).toBe("[adresse masquée] et [adresse masquée]");
  });

  it("affiche les réponses du plus ancien au plus récent, lues du plus récent au plus ancien", async () => {
    prismaMock.submission.findMany.mockResolvedValue([sub("s1", "2026-10-01T09:00:00Z")]);
    const r = (id: string, iso: string) => ({
      id,
      submissionId: "s1",
      repliedByName: "Will",
      repliedAt: new Date(iso),
      subject: id,
      bodyText: id,
      deliveryStatus: "sent",
    });
    prismaMock.submissionReply.findMany.mockResolvedValue([
      r("recente", "2026-10-05T08:00:00Z"),
      r("ancienne", "2026-10-02T08:00:00Z"),
    ]);
    const lu = await lireDemandesDeLaFiche(FICHE, "admin");
    expect(prismaMock.submissionReply.findMany.mock.calls[0]![0].orderBy).toEqual({
      repliedAt: "desc",
    });
    expect(lu.demandes[0]!.reponses.map((x) => x.id)).toEqual(["ancienne", "recente"]);
  });
});

describe("le fil des échanges", () => {
  it("porte les demandes, accusés et réponses SANS corps, et ne compte pas l'accusé comme une réponse", async () => {
    prismaMock.submission.findMany.mockResolvedValue([sub("s1", "2026-10-01T09:00:00Z")]);
    accusesMock.mockResolvedValue(new Map([["s1", accuseEnvoye("l1", "2026-10-01T09:00:05Z")]]));
    prismaMock.emailLogContent.findMany.mockResolvedValue([
      { emailLogId: "l1", subject: "Bien reçu", text: "CORPS-ACCUSE" },
    ]);
    prismaMock.submissionReply.findMany.mockResolvedValue([
      {
        id: "r1",
        submissionId: "s1",
        repliedByName: "Will",
        repliedAt: new Date("2026-10-02T08:00:00Z"),
        subject: "Re : audit",
        bodyText: "CORPS-REPONSE",
        deliveryStatus: "sent",
      },
    ]);
    const lu = await lireDemandesDeLaFiche(FICHE, "admin");
    const fil = demandesEnEchanges(lu);
    expect(fil.map((x) => x.genre).sort()).toEqual(["accuse", "demande", "reponse"]);
    const json = JSON.stringify(fil);
    expect(json).not.toContain("Message s1");
    expect(json).not.toContain("CORPS-ACCUSE");
    expect(json).not.toContain("CORPS-REPONSE");
    expect(json).not.toContain("exemple.fr");
    // Ni "envoyés" ni "à valider" : ce ne sont pas des e-mails du journal de la fiche.
    expect(compterEmails(fil)).toEqual({ envoyes: 0, aValider: 0 });
    expect(fil.filter((x) => x.genre === "reponse")).toHaveLength(1);
  });
});

describe("l'emplacement du Résumé", () => {
  it("ne lit rien quand le rôle ne voit pas les échanges", async () => {
    const r = await resumeDemandesRecues({
      clientId: FICHE,
      adminPrefix: "adm",
      role: "commercial_junior",
      voitEchanges: false,
    } as never);
    expect(r).toBeNull();
    expect(prismaMock.submission.findMany).not.toHaveBeenCalled();
    expect(prismaMock.client.findUnique).not.toHaveBeenCalled();
  });
});
