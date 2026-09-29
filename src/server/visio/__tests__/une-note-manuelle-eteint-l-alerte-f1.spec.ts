// @vitest-environment node
/**
 * Une note manuelle ÉTEINT l'alerte F1 (« rendez-vous tenu sans compte
 * rendu », plan vérification C10) : elle produit un compte rendu `manuel`
 * validé, et F1 se calcule sur `CompteRendu` seul. La ligne de l'alerte
 * disparaît au passage suivant du balayage.
 *
 * Contre-témoin : avant la note, F1 vaut 1 et l'alerte est marquée.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CLE_TEST } from "@/features/dossier-client/__tests__/_dossier-en-memoire";
import { enregistrerNoteManuelle } from "@/features/dossier-client/note-manuelle";
import { passerBalayage } from "../balayage";
import { MAINTENANT, sceneF1 } from "./_scene-f1";

const CLE_INITIALE = process.env["PII_ENCRYPTION_KEY"];
beforeEach(() => {
  process.env["PII_ENCRYPTION_KEY"] = CLE_TEST;
});
afterEach(() => {
  if (CLE_INITIALE === undefined) delete process.env["PII_ENCRYPTION_KEY"];
  else process.env["PII_ENCRYPTION_KEY"] = CLE_INITIALE;
});

describe("une note manuelle éteint l'alerte F1", () => {
  it("F1 = 1 avant la note, 0 après, et la ligne d'alerte disparaît", async () => {
    const { base, f, rencontreId } = sceneF1();
    const notify = vi.fn();
    const avant = await passerBalayage(base.client as never, {
      maintenant: MAINTENANT,
      notifier: notify as never,
    });
    expect(avant.f1).toBe(1);
    expect(base.tables["alerteVisio"]).toHaveLength(1);

    await base.client.$transaction((tx) =>
      enregistrerNoteManuelle(tx as never, {
        rencontreId,
        clientId: f["id"] as string,
        projetId: null,
        saisie: { activite: "Menuiserie" },
        parAdminId: "00000000-0000-4000-8000-0000000000ad",
        constateLe: new Date("2026-10-06T08:00:00Z"),
      }),
    );

    const apres = await passerBalayage(base.client as never, {
      maintenant: new Date(MAINTENANT.getTime() + 5 * 60_000),
      notifier: notify as never,
    });
    expect(apres.f1).toBe(0);
    expect(base.tables["alerteVisio"] ?? []).toHaveLength(0);
    expect(base.tables["compteRendu"]?.[0]?.["origine"]).toBe("manuel");
  });
});
