/**
 * ⛔ DEUX CLICS SUR LE MODÈLE FIXE NE GARENT QU'UN E-MAIL (vérification V1,
 * V1-02 de #1233).
 *
 * « Utiliser le modèle fixe » gare un e-mail dans « E-mails à valider ». Un
 * double clic (ou un second onglet) en garait deux, pour la même personne et
 * le même rendez-vous : Will aurait pu valider les deux. Tant qu'un e-mail de
 * suivi de cette rencontre vers cette personne attend (`a_valider`), le geste
 * répond « déjà préparé » et ne gare rien.
 *
 * Mutation qui rougit : retirer le comptage `dejaPrepare` d'`emailSuiviGabaritFixe`,
 * ou compter sans `statut: "a_valider"` (le contre-témoin rougit alors).
 * Contre-témoin : l'e-mail écarté (`refuse`), un nouveau clic en prépare un.
 * Angle mort : deux clics STRICTEMENT simultanés passent tous deux le comptage ;
 * le bouton (`BoutonGeste`, désactivé pendant l'envoi) ferme ce cas côté écran.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { chiffrerParole } from "@/lib/chiffrer-parole";
import { emailSuiviGabaritFixe } from "../gestes-suivi";
import { CLE_DE_TEST } from "../../../../tests/outils/fixtures-enregistreur";

type Db = Parameters<typeof emailSuiviGabaritFixe>[0];

beforeEach(() => {
  vi.stubEnv("PII_ENCRYPTION_KEY", CLE_DE_TEST);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

interface LigneSuivi {
  id: string;
  rencontreId: string;
  contactId: string;
  emailOutboxId: string | null;
}

/** Une base en mémoire : la file des e-mails et les lignes `emails_suivi`. */
function base() {
  const outbox = new Map<string, { statut: "a_valider" | "refuse" | "envoye" }>();
  const suivis: LigneSuivi[] = [];
  const db = {
    rencontre: {
      findUnique: vi.fn().mockResolvedValue({
        clientId: "cl",
        titre: "RDV fictif",
        debutReel: null,
        debutPrevu: null,
        participants: [{ contactId: "c", role: "client" }],
      }),
    },
    clientContact: {
      findUnique: vi.fn().mockResolvedValue({
        id: "c",
        nom: "Camille Fictive",
        origine: "saisie",
        statut: "actif",
        clientId: "cl",
        adresses: [{ email: "c@exemple.invalid", nature: "pro" }],
      }),
    },
    fait: {
      findMany: vi.fn().mockImplementation(async () => [
        {
          id: "f",
          type: "engagement_axion",
          enonce: chiffrerParole("Williams envoie le programme vendredi"),
          statut: "valide",
        },
      ]),
    },
    emailOutbox: {
      count: vi.fn().mockImplementation(
        async (a: {
          where: {
            statut: string;
            emailSuivi: { is: { rencontreId: string; contactId: string } };
          };
        }) =>
          suivis.filter(
            (s) =>
              s.rencontreId === a.where.emailSuivi.is.rencontreId &&
              s.contactId === a.where.emailSuivi.is.contactId &&
              s.emailOutboxId !== null &&
              outbox.get(s.emailOutboxId)?.statut === a.where.statut,
          ).length,
      ),
    },
    emailSuivi: {
      // Art. 14 (`premierMessage`) : aucun e-mail n'est jamais PARTI ici.
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
      create: vi.fn().mockImplementation(async (a: { data: Omit<LigneSuivi, "id"> }) => {
        suivis.push({ id: `s-${suivis.length + 1}`, ...a.data });
      }),
    },
    traitementVisio: { findFirst: vi.fn().mockResolvedValue(null) },
  };
  const mettreEnValidation = vi.fn().mockImplementation(async () => {
    const id = `ob-${outbox.size + 1}`;
    outbox.set(id, { statut: "a_valider" });
    return id;
  });
  return { db: db as unknown as Db, outbox, mettreEnValidation };
}

const GESTE = { rencontreId: "r", contactId: "c", parAdminId: "a" } as const;

describe("⛔ deux clics sur le modèle fixe ne garent qu'un e-mail", () => {
  it("le second clic répond « déjà préparé » et ne gare rien", async () => {
    const { db, mettreEnValidation } = base();
    const premier = await emailSuiviGabaritFixe(db, { mettreEnValidation }, GESTE);
    const second = await emailSuiviGabaritFixe(db, { mettreEnValidation }, GESTE);
    expect(premier).toContain("modèle fixe");
    expect(second).toContain("déjà préparé");
    expect(mettreEnValidation).toHaveBeenCalledTimes(1);
  });

  it("contre-témoin : l'e-mail écarté, un nouveau clic en prépare un autre", async () => {
    const { db, outbox, mettreEnValidation } = base();
    await emailSuiviGabaritFixe(db, { mettreEnValidation }, GESTE);
    outbox.set("ob-1", { statut: "refuse" });
    await emailSuiviGabaritFixe(db, { mettreEnValidation }, GESTE);
    expect(mettreEnValidation).toHaveBeenCalledTimes(2);
  });
});
