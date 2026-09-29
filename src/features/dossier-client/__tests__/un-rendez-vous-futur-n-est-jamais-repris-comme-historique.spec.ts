// @vitest-environment node
/**
 * ⛔ Un rendez-vous À VENIR n'est jamais repris comme historique.
 *
 * La reprise est lancée AVANT d'allumer le balayage, donc quand la borne vaut
 * encore la constante `DEBUT_BALAYAGE_DOSSIER_PAR_DEFAUT` (03/10/2026). Si la
 * PR atterrit plus tôt, un « Discutons » déjà réservé pour le 02/10 serait
 * marqué `repriseHistorique` : hors F1, hors badge « À classer », hors
 * couverture du mois — pour toujours. La limite de l'historique est donc
 * `min(borne, maintenant)`.
 *
 * Mutation qui fait rougir : dans `limiteDeLHistorique`, rendre la borne
 * seule → les deux premiers tests rougissent.
 * Contre-témoin : un rendez-vous passé, avant la borne, reste repris.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { assurerRencontrePourCalendly, limiteDeLHistorique } from "../rencontre-calendly";
import { reprendreHistoriqueCalendly } from "../reprise-historique";
import { CLE_TEST, dossierEnMemoire, rendezVousCalendly } from "./_dossier-en-memoire";

const CLE_INITIALE = process.env["PII_ENCRYPTION_KEY"];
beforeEach(() => {
  process.env["PII_ENCRYPTION_KEY"] = CLE_TEST;
});
afterEach(() => {
  if (CLE_INITIALE === undefined) delete process.env["PII_ENCRYPTION_KEY"];
  else process.env["PII_ENCRYPTION_KEY"] = CLE_INITIALE;
});

/** L'atterrissage AVANT le jour cible : le balayage n'a jamais tourné. */
const MAINTENANT = new Date("2026-09-30T09:00:00Z");

function scene() {
  const passe = rendezVousCalendly({ startTime: new Date("2026-09-22T08:00:00Z") });
  const futur = rendezVousCalendly({ startTime: new Date("2026-10-02T08:00:00Z") });
  return { passe, futur, base: dossierEnMemoire({ calendlyEvent: [passe, futur] }) };
}

describe("⛔ un rendez-vous futur n'est jamais repris comme historique", () => {
  it("la reprise ne compte ni ne crée le rendez-vous de demain", async () => {
    const { base, passe } = scene();
    const bilan = await reprendreHistoriqueCalendly(base.client as never, {
      appliquer: true,
      maintenant: MAINTENANT,
    });
    expect(bilan.eligibles).toBe(1);
    expect(bilan.rencontresCreees).toBe(1);
    expect(base.tables["rencontre"]?.map((r) => r["calendlyEventId"])).toEqual([passe["id"]]);
    // Contre-témoin : le rendez-vous passé est bien repris comme historique.
    expect(base.tables["rencontre"]?.[0]?.["repriseHistorique"]).toBe(true);
  });

  it("créé par la console avant le balayage, un rendez-vous à venir n'est pas historique", async () => {
    const { base, futur } = scene();
    await assurerRencontrePourCalendly(base.client as never, futur["id"] as string, {
      maintenant: MAINTENANT,
    });
    expect(base.tables["rencontre"]?.[0]?.["repriseHistorique"]).toBe(false);
  });

  it("un marquage posé à tort se corrige au passage suivant", async () => {
    const { base, futur } = scene();
    await assurerRencontrePourCalendly(base.client as never, futur["id"] as string, {
      maintenant: MAINTENANT,
    });
    const r = base.tables["rencontre"]?.[0];
    if (r) r["repriseHistorique"] = true;
    await assurerRencontrePourCalendly(base.client as never, futur["id"] as string, {
      maintenant: MAINTENANT,
    });
    expect(base.tables["rencontre"]?.[0]?.["repriseHistorique"]).toBe(false);
  });

  it("la limite ne dépasse jamais maintenant, et suit la borne quand elle est passée", () => {
    const borne = new Date("2026-10-03T10:00:00Z");
    expect(limiteDeLHistorique(null, MAINTENANT)).toEqual(MAINTENANT);
    expect(limiteDeLHistorique(borne, MAINTENANT)).toEqual(MAINTENANT);
    const plusTard = new Date("2026-10-05T10:00:00Z");
    expect(limiteDeLHistorique(borne, plusTard)).toEqual(borne);
  });
});
