/**
 * ⛔ L'E-MAIL DE SUIVI PART TOUJOURS EN ATTENTE DE VALIDATION (PR 7).
 *
 * Ordre permanent de Will : rien ne part à un client sans son clic. L'e-mail
 * de suivi — rédigé par l'étape ou par le modèle fixe — est mis en file
 * `exigerValidation: true`, donc garé dans « E-mails à valider » quelles que
 * soient les règles d'automatisation.
 *
 *   1. le port réel appelle `enqueueEmail("visio-email-suivi", …,
 *      { exigerValidation: true })` et ne rend un identifiant QUE si l'e-mail
 *      est garé ;
 *   2. tout appel du gabarit `visio-email-suivi` sous `src/` passe par ce port
 *      (aucun autre `enqueueEmail` de ce gabarit) ;
 *   3. un brouillon rédigé qui porte un prix, un lien ou un nombre absent des
 *      faits est refusé en entier.
 *
 * Mutation qui rougit : retirer `exigerValidation: true` du port réel ; ou
 * appeler `enqueueEmail("visio-email-suivi", …)` ailleurs sans lui.
 * Contre-témoin : un brouillon propre passe la vérification.
 * Angle mort : l'écran « E-mails à valider » lui-même (existant, hors PR).
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

const enqueueEmail = vi.fn();
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: (...a: unknown[]) => enqueueEmail(...a) }));

import { envoiEmailSuiviReel } from "../etapes-a-la-demande";
import { verifierEmail } from "../email-suivi";

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((n) => {
    const c = join(dossier, n);
    if (statSync(c).isDirectory()) return n === "__tests__" ? [] : fichiers(c);
    return /\.(ts|tsx)$/.test(n) ? [c] : [];
  });
}

describe("⛔ l'e-mail de suivi part toujours en attente de validation", () => {
  it("le port réel exige la validation", async () => {
    enqueueEmail.mockResolvedValueOnce({
      enqueued: false,
      garePourValidation: true,
      outboxId: "ob-1",
    });
    const id = await envoiEmailSuiviReel.mettreEnValidation({
      to: "contact@exemple.invalid",
      payload: {},
      clientId: "c",
      sujet: "Suite",
      rencontreId: "r",
    });
    expect(id).toBe("ob-1");
    expect(enqueueEmail).toHaveBeenCalledWith(
      "visio-email-suivi",
      "contact@exemple.invalid",
      "fr",
      {},
      expect.objectContaining({ exigerValidation: true }),
    );
  });

  it("un e-mail qui n'est pas garé ne rend aucun identifiant", async () => {
    enqueueEmail.mockResolvedValueOnce({ enqueued: true });
    const id = await envoiEmailSuiviReel.mettreEnValidation({
      to: "x@exemple.invalid",
      payload: {},
      clientId: "c",
      sujet: "s",
      rencontreId: "r",
    });
    expect(id).toBeNull();
  });

  it("aucun autre appel du gabarit ne contourne le port", () => {
    const appels = fichiers(join(process.cwd(), "src")).filter((f) =>
      /enqueueEmail\(\s*["']visio-email-suivi["']/.test(readFileSync(f, "utf8")),
    );
    expect(appels.map((f) => f.replace(/\\/g, "/").split("/src/")[1])).toEqual([
      "server/visio/passes/etapes-a-la-demande.ts",
    ]);
  });

  const faits = [
    {
      id: "a",
      ref: "F01",
      type: "engagement_axion" as const,
      enonce: "Williams envoie le programme vendredi",
    },
  ];

  it.each([
    ["Le devis sera de 1 900 € HT.", "prix"],
    ["Voir https://exemple.invalid", "adresse"],
    ["Nous serons 40 le 3 mars.", "nombre_absent_des_faits"],
  ])("un brouillon « %s » est refusé (%s)", (texte, motif) => {
    const v = verifierEmail(
      {
        objet: "Suite à notre échange",
        paragraphes: [{ texte, faits_refs: ["F01"] }],
        formule_de_fin: "Bien à vous",
      },
      faits,
    );
    expect(v).toEqual({ ok: false, motif });
  });

  it("contre-témoin : un brouillon propre passe", () => {
    const v = verifierEmail(
      {
        objet: "Suite à notre échange",
        paragraphes: [
          { texte: "Comme convenu, je vous envoie le programme vendredi.", faits_refs: ["F01"] },
        ],
        formule_de_fin: "Bien à vous",
      },
      faits,
    );
    expect(v.ok).toBe(true);
  });
});
