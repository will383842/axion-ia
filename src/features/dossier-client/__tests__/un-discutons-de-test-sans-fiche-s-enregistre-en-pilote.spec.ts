// @vitest-environment node
/**
 * ⛔ P-2 (V1, 30/09) — Un « Discutons » de TEST, réservé par une adresse de
 * test, s'enregistre en mode `pilote` SANS fiche client (ADR 0061).
 *
 * Avant : une rencontre de test ne naissait que saisie dans la console, sur
 * la fiche fictive (`creerRencontre`). Le chemin « nouveau prospect »
 * (Calendly → rencontre à classer → P2 sautée → « Créer la fiche prospect »)
 * ne pouvait donc tourner en réel qu'avec le premier vrai prospect.
 *
 * Ce que le test prouve, dans l'ordre du chemin réel :
 *   1. `assurerRencontrePourCalendly` marque `estTestInterne` quand l'adresse
 *      du titulaire est dans `VISIO_ADRESSES_DE_TEST` — rencontre Calendly,
 *      sans client, et le contrôle miroir de la base (CHECK
 *      `rencontres_test_interne_saisie` assoupli) l'accepte ;
 *   2. la session d'enregistrement de cette rencontre est ACCEPTÉE en pilote ;
 *   3. « Créer la fiche prospect » depuis elle inscrit la fiche créée parmi
 *      les fiches fictives (`clients_test_interne`) : la purge du pilote et le
 *      filtre des synthèses la traitent comme le client fictif.
 *
 * Contre-témoins : une adresse hors liste (ou variable absente) ne marque
 * rien, et la session est refusée en pilote ; une rencontre DÉJÀ créée n'est
 * jamais marquée après coup (la purge du pilote la supprimerait).
 *
 * Mutations qui font rougir :
 *   · retirer `estTestInterne: …` de la création dans `rencontre-calendly.ts`
 *     → le test 1 rougit ;
 *   · remettre dans `_dossier-en-memoire.ts` le contrôle d'avant
 *     (`source !== "saisie_manuelle"`) → le test 1 rougit (ErreurControle) ;
 *   · retirer l'inscription `clientTestInterne.create` de `creer-prospect.ts`
 *     → le test 3 rougit.
 * Angle mort : le CHECK réel n'est prouvé qu'en Gate D
 * (`tests/sql/dossier-client-comportement.sql`, cas 19).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/qualiopi/crm/porte-client", async () => {
  const { porteSimulee } = await import("./_porte-simulee");
  return { creerOuRetrouverClient: porteSimulee };
});

import { VARIABLE_ADRESSES_DE_TEST } from "@/server/visio/adresses-de-test";
import { creerOuReprendreSession } from "@/server/visio/sessions";
import {
  commePrisma,
  corpsSession,
  fausseBase,
  semerAppareil,
  T0,
} from "../../../../tests/outils/fixtures-enregistreur";
import { creerProspectDepuisRencontre } from "../creer-prospect";
import { assurerRencontrePourCalendly } from "../rencontre-calendly";
import { appelsPorte } from "./_porte-simulee";
import { CLE_TEST, dossierEnMemoire, rendezVousCalendly } from "./_dossier-en-memoire";

const ADMIN = "00000000-0000-4000-8000-0000000000ad";
const BORNE = new Date("2026-10-01T00:00:00Z");
const MAINTENANT = new Date("2026-10-05T08:00:00Z");
const ADRESSE_DE_TEST = "essai-pilote@exemple-fictif.test";
const ENV_TEST = { [VARIABLE_ADRESSES_DE_TEST]: `autre@exemple-fictif.test, ${ADRESSE_DE_TEST}` };

const CLE_INITIALE = process.env["PII_ENCRYPTION_KEY"];
beforeEach(() => {
  process.env["PII_ENCRYPTION_KEY"] = CLE_TEST;
  appelsPorte.length = 0;
});
afterEach(() => {
  if (CLE_INITIALE === undefined) delete process.env["PII_ENCRYPTION_KEY"];
  else process.env["PII_ENCRYPTION_KEY"] = CLE_INITIALE;
});

async function assurer(inviteeEmail: string, env: Readonly<Record<string, string | undefined>>) {
  const ev = rendezVousCalendly({ inviteeEmail });
  const base = dossierEnMemoire({ calendlyEvent: [ev] });
  const a = await assurerRencontrePourCalendly(base.client as never, ev["id"] as string, {
    borne: BORNE,
    maintenant: MAINTENANT,
    env,
  });
  if (a.statut !== "creee") throw new Error(`rencontre non créée : ${a.statut}`);
  return { base, ev, rencontreId: a.rencontreId };
}

/** Rejoue la rencontre produite dans la base de l'enregistreur, puis ouvre la session. */
async function sessionEnPilote(ev: Record<string, unknown>, rencontre: Record<string, unknown>) {
  const db = fausseBase();
  const { appareilId, adminUserId } = semerAppareil(db);
  db.semer("calendlyEvent", { ...ev });
  db.semer("rencontre", { ...rencontre });
  return creerOuReprendreSession(commePrisma(db), {
    appareil: { id: appareilId, adminUserId },
    corps: corpsSession(String(rencontre["id"])),
    mode: "pilote",
    maintenant: T0,
  });
}

describe("⛔ un « Discutons » de test sans fiche s'enregistre en pilote (P-2)", () => {
  it("1. l'adresse de test marque la rencontre Calendly, sans client (la base l'accepte)", async () => {
    // Casse et espaces : l'empreinte normalise comme partout.
    const { base } = await assurer("  Essai-Pilote@Exemple-Fictif.test ", ENV_TEST);
    const r = base.tables["rencontre"]?.[0];
    expect(r?.["source"]).toBe("calendly");
    expect(r?.["estTestInterne"]).toBe(true);
    expect(r?.["clientId"]).toBeNull();
  });

  it("2. sa session est ACCEPTÉE en mode pilote", async () => {
    const { base, ev } = await assurer(ADRESSE_DE_TEST, ENV_TEST);
    const r = await sessionEnPilote(ev, base.tables["rencontre"]?.[0] as Record<string, unknown>);
    expect(r.statut).toBe(200);
  });

  it("3. la fiche créée depuis elle rejoint les fiches fictives du pilote", async () => {
    const { base, rencontreId } = await assurer(ADRESSE_DE_TEST, ENV_TEST);
    const cree = await creerProspectDepuisRencontre(base.client as never, {
      rencontreId,
      raisonSociale: "Entreprise d'essai fictive",
      parAdminId: ADMIN,
    });
    if (cree.statut !== "cree") throw new Error(cree.statut);
    expect(base.tables["clientTestInterne"]?.map((l) => l["clientId"])).toEqual([cree.clientId]);
    expect(base.tables["rencontre"]?.[0]?.["clientId"]).toBe(cree.clientId);
  });

  it("contre-témoin : une adresse hors liste ne marque rien, et le pilote la refuse", async () => {
    const { base, ev } = await assurer("vrai-prospect@exemple-fictif.test", ENV_TEST);
    const r = base.tables["rencontre"]?.[0] as Record<string, unknown>;
    expect(r["estTestInterne"]).toBe(false);
    const s = await sessionEnPilote(ev, r);
    expect(s.statut).toBe(409);
    expect(s.corps["erreur"]).toBe("pilote_rencontre_non_test");
  });

  it("contre-témoin : variable absente ou vide, aucune adresse n'est de test", async () => {
    for (const env of [
      {},
      { [VARIABLE_ADRESSES_DE_TEST]: "" },
      { [VARIABLE_ADRESSES_DE_TEST]: " , " },
    ]) {
      const { base } = await assurer(ADRESSE_DE_TEST, env);
      expect(base.tables["rencontre"]?.[0]?.["estTestInterne"]).toBe(false);
    }
  });

  it("contre-témoin : une fiche créée depuis une vraie rencontre n'est pas fictive", async () => {
    const { base, rencontreId } = await assurer("vrai-prospect@exemple-fictif.test", ENV_TEST);
    await creerProspectDepuisRencontre(base.client as never, {
      rencontreId,
      raisonSociale: "Entreprise fictive",
      parAdminId: ADMIN,
    });
    expect(base.tables["clientTestInterne"] ?? []).toEqual([]);
  });

  it("une rencontre déjà créée n'est jamais marquée après coup", async () => {
    const ev = rendezVousCalendly({ inviteeEmail: ADRESSE_DE_TEST });
    const base = dossierEnMemoire({ calendlyEvent: [ev] });
    const options = { borne: BORNE, maintenant: MAINTENANT };
    await assurerRencontrePourCalendly(base.client as never, ev["id"] as string, {
      ...options,
      env: {},
    });
    const a = await assurerRencontrePourCalendly(base.client as never, ev["id"] as string, {
      ...options,
      env: ENV_TEST,
    });
    expect(a.statut).toBe("existante");
    expect(base.tables["rencontre"]?.[0]?.["estTestInterne"]).toBe(false);
  });
});
