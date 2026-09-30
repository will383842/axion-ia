/**
 * ⛔ UN PREMIER MESSAGE À UNE PERSONNE CITÉE PORTE L'INFORMATION (PR 7, art. 14).
 *
 * Une personne dont Axion-IA a appris l'existence par un tiers (contact
 * `origine = mention`) reçoit, au PREMIER message, une ligne qui dit d'où
 * vient son adresse et renvoie à la politique de confidentialité.
 *
 *   · l'étape pose `informationArt14` pour un contact « mention » sans message
 *     antérieur, et pas au second ;
 *   · le gabarit rend la ligne et le lien quand le drapeau est posé.
 *
 * La règle (et la lecture de `premierMessage`) n'est écrite qu'UNE fois :
 * `payloadEmailSuivi` et `lireDonneesEmailSuivi`, appelés par l'étape comme
 * par le geste « modèle fixe ».
 *
 * `premierMessage` ne compte que les e-mails réellement PARTIS (`envoye`) : un
 * e-mail garé peut être écarté au profit d'un second, préparé pendant qu'il
 * attendait — ce second doit porter la ligne, sinon la personne reçoit son
 * premier message sans l'information.
 *
 * Mutation qui rougit : oublier la condition `origine === "mention"` ou
 * `premierMessage` ; la recopier dans le geste ; ne pas rendre la ligne dans
 * le gabarit ; ou compter un e-mail garé (`a_valider`, `approuve`) comme parti.
 * Contre-témoin : un contact saisi par Will ne reçoit pas la ligne.
 * Angle mort : un premier contact par un autre canal (téléphone) n'est pas vu.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "@react-email/components";
import { describe, expect, it, vi } from "vitest";

import {
  INFORMATION_ART14,
  URL_POLITIQUE_SUIVI,
  VisioEmailSuiviEmail,
} from "@/lib/email/templates/visio-email-suivi";
import type { ContexteEtape } from "../../etapes";
import { emailSuivi, lireDonneesEmailSuivi, type DonneesEmail } from "../etapes-a-la-demande";

function ctx(donnees: DonneesEmail, mettreEnValidation: ReturnType<typeof vi.fn>) {
  const sortie = {
    objet: "Suite à notre échange",
    paragraphes: [{ texte: "Je vous envoie le programme vendredi.", faits_refs: ["F01"] }],
    formule_de_fin: "Bien à vous",
  };
  return {
    t: { rencontreId: "r" },
    jobId: "visio-email_suivi-r-1",
    deps: {
      openai: () => ({
        repondre: async () => ({
          statut: "completed",
          raisonIncomplete: null,
          modele: "gpt-6-sol",
          texte: JSON.stringify(sortie),
          refus: null,
          jetonsEntree: 10,
          jetonsEntreeEnCache: 0,
          jetonsSortie: 10,
        }),
        transcrire: vi.fn(),
      }),
      cout: { verifierPlafond: async () => undefined, enregistrer: async () => undefined },
      catalogue: async () => ({ texte: "", refs: new Set(), empreinte: "x" }),
      demandes: {
        depot: {
          pourEmail: async () => donnees,
          lierEmail: async () => undefined,
          emailGareSansSuivi: async () => null,
        },
        envoi: { mettreEnValidation },
        mode: () => "ouvert",
      },
    },
  } as unknown as ContexteEtape;
}

function donnees(origine: string, premierMessage: boolean): DonneesEmail {
  return {
    emailSuiviId: "e",
    clientId: "cl",
    rencontre: { titre: "RDV fictif", date: null },
    contact: {
      id: "c",
      nom: "Camille Fictive",
      origine,
      adresses: [{ email: "c@exemple.invalid", nature: "pro" }],
    },
    participants: [{ contactId: "c", role: "client", contactActif: true }],
    faits: [
      {
        id: "f",
        type: "engagement_axion",
        enonce: "Williams envoie le programme vendredi",
        statut: "valide",
      },
    ],
    premierMessage,
  };
}

async function payloadPour(origine: string, premier: boolean) {
  const mettre = vi.fn().mockResolvedValue("ob-1");
  const r = await emailSuivi(ctx(donnees(origine, premier), mettre));
  await r.ecrire({} as never);
  return mettre.mock.calls[0]?.[0]?.payload as Record<string, unknown>;
}

type Statut = "a_valider" | "approuve" | "envoye" | "refuse";

/** Une base minimale : `count` applique VRAIMENT le filtre de statut demandé. */
function baseAvecEmails(statuts: ReadonlyArray<Statut>) {
  const emails = statuts.map((statut, i) => ({ contactId: "c", emailOutboxId: `ob-${i}`, statut }));
  const correspond = (statut: Statut, f: unknown): boolean => {
    if (f === undefined) return true;
    if (typeof f === "string") return statut === f;
    const o = f as { not?: string; in?: string[] };
    if (o.not !== undefined) return statut !== o.not;
    if (o.in !== undefined) return o.in.includes(statut);
    throw new Error(`filtre de statut non simulé : ${JSON.stringify(f)}`);
  };
  return {
    rencontre: {
      findUnique: async () => ({
        clientId: "cl",
        titre: "RDV fictif",
        debutReel: null,
        debutPrevu: null,
        participants: [{ contactId: "c", role: "client" }],
      }),
    },
    clientContact: {
      findUnique: async () => ({
        id: "c",
        nom: "Camille Fictive",
        origine: "mention",
        statut: "actif",
        clientId: "cl",
        adresses: [{ email: "c@exemple.invalid", nature: "pro" }],
      }),
    },
    fait: { findMany: async () => [] },
    emailSuivi: {
      count: async ({ where }: { where: Record<string, unknown> }) =>
        emails.filter(
          (e) =>
            e.contactId === where["contactId"] &&
            e.emailOutboxId !== null &&
            correspond(e.statut, (where["emailOutbox"] as { statut?: unknown })?.statut),
        ).length,
    },
  } as unknown as Parameters<typeof lireDonneesEmailSuivi>[0];
}

async function premierMessageAvec(statuts: ReadonlyArray<Statut>): Promise<boolean> {
  const lu = await lireDonneesEmailSuivi(baseAvecEmails(statuts), "r", "c");
  if (!lu.ok) throw new Error(lu.motif);
  return lu.donnees.premierMessage;
}

describe("⛔ un premier message à une personne citée porte l'information", () => {
  it("un e-mail garé, puis un second préparé : le second porte encore la ligne", async () => {
    // Scénario : A (avec la ligne) attend en « E-mails à valider » ; B est
    // préparé pendant ce temps ; Will écarte A et envoie B.
    expect(await premierMessageAvec(["a_valider"])).toBe(true);
    expect(await premierMessageAvec(["approuve"])).toBe(true);
    expect(await premierMessageAvec(["refuse", "a_valider"])).toBe(true);
  });

  it("contre-témoin : un e-mail réellement parti, le suivant n'a plus la ligne", async () => {
    expect(await premierMessageAvec(["envoye"])).toBe(false);
    expect(await premierMessageAvec(["refuse", "envoye", "a_valider"])).toBe(false);
  });

  it("contact « mention », premier message : la ligne est demandée", async () => {
    expect((await payloadPour("mention", true))["informationArt14"]).toBe(true);
  });

  it("second message : plus de ligne", async () => {
    expect(await payloadPour("mention", false)).not.toHaveProperty("informationArt14");
  });

  it("contre-témoin : contact saisi par Will, pas de ligne", async () => {
    expect(await payloadPour("saisie", true)).not.toHaveProperty("informationArt14");
  });

  it("le gabarit rend la ligne et le lien vers la politique", async () => {
    const html = await render(
      <VisioEmailSuiviEmail
        locale="fr"
        payload={{ contactName: "Camille", paragraphes: ["Texte."], informationArt14: true }}
      />,
    );
    expect(html).toContain(INFORMATION_ART14.slice(0, 29));
    expect(html).toContain(URL_POLITIQUE_SUIVI);
    const sans = await render(
      <VisioEmailSuiviEmail locale="fr" payload={{ paragraphes: ["Texte."] }} />,
    );
    expect(sans).not.toContain(INFORMATION_ART14.slice(0, 29));
  });

  it("la règle et la lecture ne sont écrites qu'une fois dans le circuit", () => {
    const racine = join(process.cwd(), "src/server/visio");
    const sources: string[] = [];
    const parcourir = (d: string): void => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        if (e.isDirectory()) {
          if (e.name !== "__tests__") parcourir(join(d, e.name));
        } else if (/\.tsx?$/.test(e.name)) sources.push(readFileSync(join(d, e.name), "utf8"));
      }
    };
    parcourir(racine);
    const compter = (motif: RegExp) =>
      sources.reduce((n, s) => n + (s.match(motif)?.length ?? 0), 0);
    expect(compter(/origine === "mention"/g)).toBe(1);
    expect(compter(/emailSuivi\.count\(/g)).toBe(1);
    expect(compter(/contactActif: p\.contactId ===/g)).toBe(1);
  });
});
