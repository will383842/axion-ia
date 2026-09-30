// @vitest-environment node
/**
 * ⛔ Une panne du balayage part UNE fois, et REPART si l'envoi a échoué
 * (plan §3.14) — sur le magasin d'alertes EXISTANT (correction anti-doublon A3).
 *
 *   · l'alerte vit dans `AlerteSysteme` (code `visio.balayage_en_panne`),
 *     créée par `creerOuDedup` (ici rejoué en mémoire) ; `AlerteVisio` reste vide ;
 *   · tenue pour envoyée SEULEMENT si `notify()` répond `sent` sur Telegram ;
 *   · un envoi raté laisse `notifiedAt` nul (V1 C3 : la même colonne que
 *     l'enregistreur, par `signalerUneFois`) : le passage suivant réessaie,
 *     et `metadata.essais` compte les essais ;
 *   · une fois partie, les passages suivants ne renvoient rien ;
 *   · toutes les étapes revenues au vert : l'alerte est RÉSOLUE ; une rechute
 *     ouvre une nouvelle alerte, qui repart.
 *
 * Mutation qui fait rougir : poser `notifiedAt` sans regarder la réponse →
 * le 2ᵉ test rougit (l'alerte ne repart pas).
 * Angle mort : un `sent` de `notify()` ne prouve pas la lecture par Will.
 */

import { describe, expect, it, vi } from "vitest";

import { dossierEnMemoire } from "@/features/dossier-client/__tests__/_dossier-en-memoire";
import { ALERTE_CATALOGUE } from "@/server/qualiopi/alertes/catalogue";
import {
  CODES_ALERTES_VISIO,
  leverPanneDuBalayage,
  signalerPanneDuBalayage,
  VISIO_BALAYAGE_EN_PANNE,
  type Notifier,
} from "../alertes";
import { creerEnMemoire } from "./_alertes-en-memoire";

const PANNE = { etape: "suites", erreur: "Error" };

function notifier(reponses: Array<"sent" | "failed">): Notifier {
  return vi.fn(async () => ({
    ok: true,
    channels: { telegram: reponses.shift() ?? "sent" },
  })) as never;
}

function scene() {
  const base = dossierEnMemoire();
  return { base, db: base.client as never, creer: creerEnMemoire(base) };
}

const ouvertes = (base: ReturnType<typeof dossierEnMemoire>) =>
  (base.tables["alerteSysteme"] ?? []).filter((a) => !a["resolue"]);

describe("⛔ une panne du balayage ne part qu'une fois et repart si l'envoi échoue", () => {
  it("envoyée une fois, puis plus jamais ; une seule ligne, dans AlerteSysteme", async () => {
    const { base, db, creer } = scene();
    const n = notifier(["sent"]);
    expect(await signalerPanneDuBalayage(db, PANNE, { notifier: n, creer })).toBe("envoyee");
    expect(await signalerPanneDuBalayage(db, PANNE, { notifier: n, creer })).toBe("deja_envoyee");
    expect(await signalerPanneDuBalayage(db, PANNE, { notifier: n, creer })).toBe("deja_envoyee");
    expect(n).toHaveBeenCalledTimes(1);
    expect(base.tables["alerteSysteme"]).toHaveLength(1);
    expect(base.tables["alerteSysteme"]?.[0]?.["code"]).toBe(VISIO_BALAYAGE_EN_PANNE);
    expect(base.tables["alerteVisio"] ?? []).toHaveLength(0);
  });

  it("une alerte ouverte avant C3 (`metadata.telegramLe`, `notifiedAt` vide) ne repart pas", async () => {
    const { base, db, creer } = scene();
    await creer({
      code: VISIO_BALAYAGE_EN_PANNE,
      niveau: "important",
      titre: "t",
      message: "m",
      metadata: { etapes: ["suites"], essais: 1, telegramLe: "2026-09-29T08:00:00.000Z" },
    });
    expect(base.tables["alerteSysteme"]?.[0]?.["notifiedAt"] ?? null).toBeNull();
    const n = notifier(["sent"]);
    expect(await signalerPanneDuBalayage(db, PANNE, { notifier: n, creer })).toBe("deja_envoyee");
    expect(n).not.toHaveBeenCalled();
  });

  it("un envoi raté repart au passage suivant, et les essais sont comptés", async () => {
    const { base, db, creer } = scene();
    const n = notifier(["failed", "sent"]);
    expect(await signalerPanneDuBalayage(db, PANNE, { notifier: n, creer })).toBe("echec_envoi");
    const meta = () => base.tables["alerteSysteme"]?.[0]?.["metadata"] as Record<string, unknown>;
    const envoyeeLe = () => base.tables["alerteSysteme"]?.[0]?.["notifiedAt"] ?? null;
    expect(envoyeeLe()).toBeNull();
    expect(meta()["telegramLe"]).toBeUndefined();
    expect(await signalerPanneDuBalayage(db, PANNE, { notifier: n, creer })).toBe("envoyee");
    expect(meta()["essais"]).toBe(2);
    expect(envoyeeLe()).toBeInstanceOf(Date);
  });

  it("toutes les étapes au vert : résolue ; une rechute rouvre et repart", async () => {
    const { base, db, creer } = scene();
    const n = notifier(["sent", "sent"]);
    await signalerPanneDuBalayage(db, PANNE, { notifier: n, creer });
    await signalerPanneDuBalayage(
      db,
      { etape: "veille", erreur: "Error" },
      {
        notifier: n,
        creer,
      },
    );
    expect(await leverPanneDuBalayage(db, "suites")).toBe(false); // « veille » encore en panne
    expect(ouvertes(base)).toHaveLength(1);
    expect(await leverPanneDuBalayage(db, "veille")).toBe(true);
    expect(ouvertes(base)).toHaveLength(0);
    expect(
      await signalerPanneDuBalayage(db, PANNE, {
        notifier: n,
        creer,
        maintenant: new Date(Date.now() + 60_000),
      }),
    ).toBe("envoyee");
    expect(ouvertes(base)).toHaveLength(1);
    expect(n).toHaveBeenCalledTimes(2);
  });

  it("chaque code visio est au catalogue, jamais auto-résolu (levé hors du balayage quotidien)", () => {
    for (const code of Object.values(CODES_ALERTES_VISIO)) {
      expect(code.startsWith("visio.")).toBe(true);
      expect(ALERTE_CATALOGUE[code]?.resolutionAuto).toBe(false);
    }
  });
});
