// @vitest-environment node
/**
 * Un rendez-vous DÉPLACÉ déplace son alerte : l'échéance de F1 se calcule
 * sur les dates COURANTES de la rencontre (resynchronisées depuis Calendly),
 * jamais sur une date copiée au moment de l'alerte. Reporté à demain, il
 * n'est plus en retard ; son alerte tombe au passage suivant.
 *
 * Contre-témoin : sans déplacement, l'alerte reste.
 */

import { describe, expect, it, vi } from "vitest";

import { attenduF1, passerBalayage } from "../balayage";
import { BORNE, MAINTENANT, rencontreF1, sceneF1 } from "./_scene-f1";

describe("un rendez-vous déplacé déplace son alerte", () => {
  it("la règle : reporté à demain, il n'attend rien", () => {
    expect(attenduF1(rencontreF1(), BORNE, MAINTENANT)).not.toBeNull();
    expect(
      attenduF1(
        rencontreF1({
          debutPrevu: new Date("2026-10-09T08:00:00Z"),
          finPrevue: new Date("2026-10-09T09:00:00Z"),
        }),
        BORNE,
        MAINTENANT,
      ),
    ).toBeNull();
  });

  it("dans le balayage : l'alerte tombe quand la date change", async () => {
    const { base } = sceneF1();
    const notify = vi.fn();
    await passerBalayage(base.client as never, {
      maintenant: MAINTENANT,
      notifier: notify as never,
    });
    expect(base.tables["alerteVisio"]).toHaveLength(1);

    const rdv = base.tables["rencontre"]?.[0] as Record<string, unknown>;
    rdv["debutPrevu"] = new Date("2026-10-09T08:00:00Z");
    rdv["finPrevue"] = new Date("2026-10-09T08:45:00Z");
    const r = await passerBalayage(base.client as never, {
      maintenant: new Date(MAINTENANT.getTime() + 5 * 60_000),
      notifier: notify as never,
    });
    expect(r.f1).toBe(0);
    expect(base.tables["alerteVisio"] ?? []).toHaveLength(0);
  });

  it("contre-témoin : sans déplacement, l'alerte reste", async () => {
    const { base } = sceneF1();
    const notify = vi.fn();
    await passerBalayage(base.client as never, {
      maintenant: MAINTENANT,
      notifier: notify as never,
    });
    await passerBalayage(base.client as never, {
      maintenant: new Date(MAINTENANT.getTime() + 5 * 60_000),
      notifier: notify as never,
    });
    expect(base.tables["alerteVisio"]).toHaveLength(1);
  });
});
