/**
 * ⛔ UNE REPRISE DE L'ÉTAPE E-MAIL NE GARE PAS DEUX E-MAILS (vérification V1,
 * V1-01 de #1233).
 *
 * L'étape `email_suivi` gare l'e-mail dans « E-mails à valider » PUIS le relie
 * à sa ligne `emails_suivi`, dans la transaction de l'étape. Le garage, lui,
 * tourne hors de cette transaction : une exécution annulée après lui (arrêt du
 * worker, écriture en échec) laissait un e-mail « à valider » sans lien, et la
 * reprise en garait un second. Will avait deux e-mails à valider pour un seul.
 *
 *   1. première exécution annulée après le garage : un e-mail, sans lien ;
 *   2. la reprise relie CET e-mail et n'en gare pas d'autre ;
 *   3. le dépôt réel ne reprend qu'un e-mail « à valider » de ce gabarit, de
 *      cette rencontre, vers ce destinataire, et jamais relié à un suivi.
 *
 * Mutation qui rougit : garer sans consulter `emailGareSansSuivi` ; ou
 * retirer `statut: "a_valider"` / `emailSuivi: { is: null }` du dépôt réel.
 * Contre-témoin : sans reste d'une exécution précédente, l'étape gare bien.
 * Angle mort : le filtre du dépôt réel est vérifié sur sa forme, pas contre
 * PostgreSQL (la chaîne de la Gate D gare et relie en vrai).
 */

import { describe, expect, it, vi } from "vitest";

import type { ContexteEtape } from "../../etapes";
import { depotDemandesPrisma, emailSuivi, type DonneesEmail } from "../etapes-a-la-demande";

const DONNEES: DonneesEmail = {
  emailSuiviId: "suivi-1",
  clientId: "cl",
  rencontre: { titre: "RDV fictif", date: null },
  contact: {
    id: "c",
    nom: "Camille Fictive",
    origine: "saisie",
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
  premierMessage: false,
};

/** La file et les liens, en mémoire, partagés par les exécutions successives. */
function monde() {
  const outbox = new Map<string, { to: string; relie: boolean }>();
  const mettreEnValidation = vi.fn().mockImplementation(async (a: { to: string }) => {
    const id = `ob-${outbox.size + 1}`;
    outbox.set(id, { to: a.to, relie: false });
    return id;
  });
  let annulerLeLien = false;
  const lierEmail = vi.fn().mockImplementation(async (_tx: unknown, _s: string, id: string) => {
    if (annulerLeLien) throw new Error("exécution interrompue après le garage");
    const ligne = outbox.get(id);
    if (ligne) ligne.relie = true;
  });
  const depot = {
    pourEmail: async () => DONNEES,
    lierEmail,
    emailGareSansSuivi: async (_tx: unknown, a: { to: string }) =>
      [...outbox.entries()].find(([, o]) => !o.relie && o.to === a.to)?.[0] ?? null,
  };
  const ctx = {
    t: { rencontreId: "r" },
    jobId: "visio-email_suivi-r-1",
    deps: {
      openai: () => ({
        repondre: async () => ({
          statut: "completed",
          raisonIncomplete: null,
          modele: "gpt-6-sol",
          texte: JSON.stringify({
            objet: "Suite à notre échange",
            paragraphes: [{ texte: "Je vous envoie le programme vendredi.", faits_refs: ["F01"] }],
            formule_de_fin: "Bien à vous",
          }),
          refus: null,
          jetonsEntree: 10,
          jetonsEntreeEnCache: 0,
          jetonsSortie: 10,
        }),
        transcrire: vi.fn(),
      }),
      cout: { verifierPlafond: async () => undefined, enregistrer: async () => undefined },
      catalogue: async () => ({ texte: "", refs: new Set(), empreinte: "x" }),
      demandes: { depot, envoi: { mettreEnValidation }, mode: () => "ouvert" },
    },
  } as unknown as ContexteEtape;
  return {
    outbox,
    mettreEnValidation,
    lierEmail,
    ctx,
    interrompre: (oui: boolean) => {
      annulerLeLien = oui;
    },
  };
}

async function executer(ctx: ContexteEtape): Promise<void> {
  const r = await emailSuivi(ctx);
  await r.ecrire({} as never);
}

describe("⛔ une reprise de l'étape e-mail ne gare pas deux e-mails", () => {
  it("annulée après le garage, la reprise relie le même e-mail", async () => {
    const m = monde();
    m.interrompre(true);
    await expect(executer(m.ctx)).rejects.toThrow("interrompue");
    expect(m.outbox.size).toBe(1);

    m.interrompre(false);
    await executer(m.ctx);
    expect(m.mettreEnValidation).toHaveBeenCalledTimes(1);
    expect(m.outbox.size).toBe(1);
    expect(m.lierEmail).toHaveBeenLastCalledWith(expect.anything(), "suivi-1", "ob-1");
  });

  it("contre-témoin : sans reste d'une exécution précédente, l'étape gare", async () => {
    const m = monde();
    await executer(m.ctx);
    expect(m.mettreEnValidation).toHaveBeenCalledTimes(1);
    expect(m.lierEmail).toHaveBeenCalledWith(expect.anything(), "suivi-1", "ob-1");
  });

  it("le dépôt réel ne reprend qu'un e-mail à valider, de ce gabarit, jamais relié", async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: "ob-9" });
    const depot = depotDemandesPrisma({} as never);
    const id = await depot.emailGareSansSuivi({ emailOutbox: { findFirst } } as never, {
      rencontreId: "r",
      to: "c@exemple.invalid",
    });
    expect(id).toBe("ob-9");
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          template: "visio-email-suivi",
          entityType: "Rencontre",
          entityId: "r",
          recipient: "c@exemple.invalid",
          statut: "a_valider",
          emailSuivi: { is: null },
        },
      }),
    );
  });
});
