// @vitest-environment node
/**
 * ⛔ Une alerte part UNE fois, et REPART si l'envoi a échoué (plan §3.14).
 *
 *   · marquée dans `alertes_visio` (le témoin vit en base, PA-14) ;
 *   · tenue pour envoyée SEULEMENT si `notify()` répond `sent` sur Telegram ;
 *   · un envoi raté laisse `envoyeeLe` nul : le passage suivant réessaie ;
 *   · une fois partie, les passages suivants ne renvoient rien ;
 *   · le témoin revenu au vert efface sa ligne : une rechute repart.
 *
 * Joué sur l'alerte « rendez-vous tenu sans compte rendu » (F1) avec le canal
 * Telegram FORCÉ (B17 = oui, hypothèse) — et sur une panne du balayage, qui,
 * elle, part toujours sur Telegram.
 *
 * Mutation qui fait rougir : poser `envoyeeLe` sans regarder la réponse
 * (`envoyee = true`) → le 2ᵉ test rougit (l'alerte ne repart pas).
 * Angle mort : un `sent` de `notify()` ne prouve pas la lecture par Will.
 */

import { describe, expect, it, vi } from "vitest";

import { dossierEnMemoire } from "@/features/dossier-client/__tests__/_dossier-en-memoire";
import { canalDesRappels, leverAlerte, signalerAlerte, type Notifier } from "../alertes";
import { cleF1 } from "../balayage";

const ALERTE_F1 = {
  cle: cleF1("3f2a9c1e-7b4d-4e8a-9c2b-1d5e6f7a8b9c"),
  categorie: "circuit" as const,
  canal: canalDesRappels(true),
  message: "Rendez-vous tenu sans compte rendu ni note.",
};

function notifier(reponses: Array<"sent" | "failed">): Notifier & { mock: { calls: unknown[] } } {
  const f = vi.fn(async () => ({
    ok: true,
    channels: { telegram: reponses.shift() ?? "sent" },
  }));
  return f as never;
}

describe("⛔ l'alerte sans compte rendu ne part qu'une fois et repart si l'envoi échoue", () => {
  it("envoyée une fois, puis plus jamais", async () => {
    const base = dossierEnMemoire();
    const n = notifier(["sent"]);
    expect(await signalerAlerte(base.client as never, ALERTE_F1, n)).toBe("envoyee");
    expect(await signalerAlerte(base.client as never, ALERTE_F1, n)).toBe("deja_envoyee");
    expect(await signalerAlerte(base.client as never, ALERTE_F1, n)).toBe("deja_envoyee");
    expect(n.mock.calls).toHaveLength(1);
    expect(base.tables["alerteVisio"]).toHaveLength(1);
  });

  it("un envoi raté repart au passage suivant", async () => {
    const base = dossierEnMemoire();
    const n = notifier(["failed", "sent"]);
    expect(await signalerAlerte(base.client as never, ALERTE_F1, n)).toBe("echec_envoi");
    expect(base.tables["alerteVisio"]?.[0]?.["envoyeeLe"]).toBeNull();
    expect(await signalerAlerte(base.client as never, ALERTE_F1, n)).toBe("envoyee");
    expect(base.tables["alerteVisio"]?.[0]?.["essais"]).toBe(2);
  });

  it("une exception de notify() compte comme un échec, jamais comme un envoi", async () => {
    const base = dossierEnMemoire();
    const n = vi.fn(async () => {
      throw new Error("réseau");
    }) as unknown as Notifier;
    expect(await signalerAlerte(base.client as never, ALERTE_F1, n)).toBe("echec_envoi");
    expect(base.tables["alerteVisio"]?.[0]?.["envoyeeLe"]).toBeNull();
  });

  it("le témoin revenu au vert efface sa ligne ; une rechute repart", async () => {
    const base = dossierEnMemoire();
    const n = notifier(["sent", "sent"]);
    await signalerAlerte(base.client as never, ALERTE_F1, n);
    expect(await leverAlerte(base.client as never, ALERTE_F1.cle)).toBe(true);
    expect(await signalerAlerte(base.client as never, ALERTE_F1, n)).toBe("envoyee");
    expect(n.mock.calls).toHaveLength(2);
  });
});
