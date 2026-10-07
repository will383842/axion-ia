// Lot L3 (2026-10-07) — le BRANCHEMENT du relevé des réponses des candidats :
// programme du worker, alerte, notice, lecture de la fiche, schéma, RGPD.
//
// 🔴 Et ce qu'il ne touche PAS : la file `apporteur-crons` et son relevé.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { LEGAL_PAGES } from "@/content/legal";
import { shouldNotifyWhatsApp, telegramGroupFor, getRouting } from "@/server/notifications/routing";
import { formatNotificationPlain } from "@/server/notifications/format";

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), "utf8");

describe("le programme du worker", () => {
  const queues = lire("src/server/queue/queues.ts");
  const worker = lire("src/server/queue/workers/qualiopi-formation-crons-worker.ts");

  it("le relevé des candidats tourne toutes les 15 minutes dans `formation-crons`, jobId stable", () => {
    expect(queues).toMatch(
      /type: "formation-crons\.reponses-entrantes-candidatures",\s*pattern: "7,22,37,52 \* \* \* \*",\s*jobId: "formation-crons-reponses-entrantes-candidatures-cron"/,
    );
    expect(worker).toMatch(
      /"formation-crons\.reponses-entrantes-candidatures": handleReponsesEntrantesCandidatures/,
    );
  });

  it("🔴 la file `apporteur-crons` garde EXACTEMENT ses cinq passages, sans celui des candidats", () => {
    const debut = queues.indexOf("if (apporteurCronsQueue) {");
    const programme = queues.slice(debut, queues.indexOf("];", debut));
    const types = [...programme.matchAll(/type: "([^"]+)" as const/g)].map((m) => m[1]);
    expect(types).toEqual([
      "relance-invitation",
      "reponses-entrantes",
      "invitation-auto",
      "reseau-quotidien",
      "reseau-facturation",
    ]);
    expect(lire("src/server/queue/workers/apporteur-crons-worker.ts")).not.toMatch(
      /reponses-entrantes-candidature|passerReponsesEntrantesCandidats/,
    );
  });

  it("le passage s'arrête au build `stub.invalid` avant tout import", () => {
    const corps = worker.slice(
      worker.indexOf("async function handleReponsesEntrantesCandidatures"),
    );
    expect(corps.slice(0, 300)).toMatch(/stub\.invalid/);
  });

  it("🔴 le passage est ÉTEINT PAR DÉFAUT : il sort avant tout import sans l'interrupteur à \"true\"", () => {
    const corps = worker.slice(
      worker.indexOf("async function handleReponsesEntrantesCandidatures"),
    );
    const avantImport = corps.slice(0, corps.indexOf("await import("));
    expect(avantImport).toMatch(
      /process\.env\["CANDIDATS_REPONSES_RECUES_ENABLED"\] !== "true"\) return;/,
    );
  });
});

describe("l'alerte `CANDIDAT_REPLIED`", () => {
  it("va au salon des candidatures, jamais à celui des apporteurs, et pas sur WhatsApp", () => {
    expect(telegramGroupFor("CANDIDAT_REPLIED")).toBe("candidatures");
    expect(telegramGroupFor("APPORTEUR_REPLIED")).toBe("commercial-memo");
    expect(shouldNotifyWhatsApp("CANDIDAT_REPLIED")).toBe(false);
    expect(getRouting("CANDIDAT_REPLIED").channels).toEqual(["telegram"]);
  });

  it("dit le nom, le poste, l'objet et le lien vers la fiche", () => {
    const { text: texte } = formatNotificationPlain(
      {
        category: "CANDIDAT_REPLIED",
        payload: {
          applicationId: "cand-a",
          contactName: "Sarah L.",
          offerTitle: "Monteur vidéo freelance",
          subject: "Re: Votre candidature",
          receivedAt: "2026-10-07T09:14:00.000Z",
        },
      },
      "info",
    );
    expect(texte).toContain("Sarah L.");
    expect(texte).toContain("Monteur vidéo freelance");
    expect(texte).toContain("Re: Votre candidature");
    expect(texte).toMatch(/contacts\/candidatures\/cand-a#reponses-recues/);
  });
});

describe("la notice annonce la lecture des réponses [I2]", () => {
  const section = (locale: "fr" | "en", titre: string) =>
    LEGAL_PAGES.find((p) => p.slug === "politique-confidentialite")?.[locale].sections.find(
      (s) => s.title === titre,
    )?.body ?? "";

  it("en français, dans « Candidatures et recrutement »", () => {
    const fr = section("fr", "Candidatures et recrutement");
    expect(fr).toMatch(
      /Si vous répondez par e-mail à l'un de nos messages, votre réponse, reçue dans notre messagerie Zoho Mail, est lue automatiquement et rattachée à votre dossier/,
    );
    expect(fr).toMatch(/jamais le message entier ni ses pièces jointes/);
    expect(fr).toMatch(/Telegram/);
  });

  it("en anglais, dans « Job applications and recruitment »", () => {
    const en = section("en", "Job applications and recruitment");
    expect(en).toMatch(
      /If you reply by email to one of our messages, your reply, received in our Zoho Mail mailbox, is read automatically and attached to your file/,
    );
    expect(en).toMatch(/never the whole message or its attachments/);
  });
});

describe("la lecture de la fiche, le schéma, le RGPD", () => {
  it("la lecture applique le prédicat d'ouverture du dossier (l'extrait porte les mots de la personne)", () => {
    const src = lire("src/features/admin-job-applications/reponses-recues.ts");
    expect(src).toMatch(/if \(!peutOuvrirDossierCandidat\(acteur\.role\)\) return \[\];/);
    // Monde « emploi » seulement : jamais la table des apporteurs.
    expect(src).not.toMatch(/submissionInboundReply/);
  });

  const schema = lire("prisma/schema.prisma");
  const modele = /model JobApplicationInboundReply \{([\s\S]*?)\n\}/.exec(schema)?.[1] ?? "";

  it("le modèle suit son dossier en cascade, sans adresse en clair ni corps", () => {
    expect(modele).toMatch(
      /application\s+JobApplication\s+@relation\(fields: \[applicationId\], references: \[id\], onDelete: Cascade\)/,
    );
    expect(modele).toMatch(/fromEmailHash\s+String/);
    expect(modele).toMatch(/zohoMessageId\s+String\s+@unique/);
    expect(modele).not.toMatch(/^\s*(email|fromEmail|fromAddress|body\w*|html|text)\s/m);
  });

  it("🔴 aucune purge automatique ne vise la nouvelle table (ordre de Will)", () => {
    const purge = lire("src/server/queue/workers/retention-purge-worker.ts");
    expect(purge).not.toMatch(/jobApplicationInboundReply|job_application_inbound_replies/);
  });

  it("art. 15 et 17 : restituées avec la candidature, effacées avec elle", () => {
    const rgpd = lire("src/server/careers/candidature-rgpd.ts");
    expect(rgpd).toMatch(
      /jobApplicationInboundReply\.deleteMany\(\{ where: \{ fromEmailHash: empreinte \} \}\)/,
    );
    expect(rgpd).toMatch(/reponsesRecues: reponses/);
    expect(rgpd).toMatch(/extrait: r\.excerpt \? decryptPii\(r\.excerpt\) : null/);
  });
});
