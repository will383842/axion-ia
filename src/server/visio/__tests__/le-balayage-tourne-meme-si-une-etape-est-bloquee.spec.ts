// @vitest-environment node
/**
 * Le balayage tourne même si une étape est bloquée : l'erreur est comptée,
 * signalée une fois, et les AUTRES étapes passent ; le battement est écrit
 * quand même (un balayage qui tourne n'est pas un balayage arrêté).
 *
 * Contre-témoin : sans panne, aucune étape en échec et aucun envoi.
 */

import { describe, expect, it, vi } from "vitest";

import { dossierEnMemoire } from "@/features/dossier-client/__tests__/_dossier-en-memoire";
import { VISIO_BALAYAGE_EN_PANNE } from "../alertes";
import { passerBalayage } from "../balayage";
import { creerEnMemoire } from "./_alertes-en-memoire";

const MAINTENANT = new Date("2026-10-08T14:00:00Z");

function avecPanne(base: ReturnType<typeof dossierEnMemoire>, modele: string) {
  const client = base.client as unknown as Record<string, unknown>;
  return new Proxy(client, {
    get(c, nom: string) {
      if (nom === modele) {
        return new Proxy(
          {},
          {
            get() {
              return async () => {
                throw new Error("verrou");
              };
            },
          },
        );
      }
      return c[nom];
    },
  });
}

describe("le balayage tourne même si une étape est bloquée", () => {
  it("une étape en panne n'arrête pas les autres, et le battement est écrit", async () => {
    const base = dossierEnMemoire();
    const notify = vi.fn(async () => ({ ok: true, channels: { telegram: "sent" as const } }));
    const r = await passerBalayage(avecPanne(base, "calendlyEvent") as never, {
      maintenant: MAINTENANT,
      notifier: notify,
      creerAlerte: creerEnMemoire(base),
      drapeauBrut: "true",
    });
    expect(r.etapesEnEchec).toEqual(["rencontres"]);
    expect(base.tables["alerteSysteme"]?.map((a) => a["code"])).toEqual([VISIO_BALAYAGE_EN_PANNE]);
    expect(r.couverture).not.toBeNull();
    expect(base.tables["battementCircuit"]?.[0]?.["dernierLe"]).toEqual(MAINTENANT);
    expect(base.tables["battementCircuit"]?.[0]?.["drapeauVuParWorker"]).toBe("true");
  });

  it("contre-témoin : sans panne, rien en échec, rien envoyé", async () => {
    const base = dossierEnMemoire();
    const notify = vi.fn();
    const r = await passerBalayage(base.client as never, {
      maintenant: MAINTENANT,
      notifier: notify as never,
    });
    expect(r.etapesEnEchec).toEqual([]);
    expect(notify).not.toHaveBeenCalled();
  });

  it("la borne s'écrit une fois : au premier passage", async () => {
    const base = dossierEnMemoire();
    const notify = vi.fn();
    await passerBalayage(base.client as never, {
      maintenant: MAINTENANT,
      notifier: notify as never,
    });
    const plusTard = new Date(MAINTENANT.getTime() + 5 * 60_000);
    await passerBalayage(base.client as never, { maintenant: plusTard, notifier: notify as never });
    const b = base.tables["battementCircuit"]?.[0];
    expect(b?.["premierLe"]).toEqual(MAINTENANT);
    expect(b?.["dernierLe"]).toEqual(plusTard);
  });
});
