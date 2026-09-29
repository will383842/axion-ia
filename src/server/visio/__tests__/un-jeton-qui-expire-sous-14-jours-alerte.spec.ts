/**
 * ⛔ UN JETON QUI EXPIRE SOUS 14 JOURS ALERTE (PR 5).
 *
 * Le balayage envoie UNE alerte technique à J-14, puis UNE à J-3, par appareil
 * (table `alertes_visio`). Une alerte dont l'envoi a échoué est retentée ; une
 * alerte envoyée ne repart jamais. Aucun nom de personne dans le texte.
 *
 * Mutation qui rougit : dans `seuilAlerteJeton`, rendre `null` quand il reste
 * 10 jours → aucune alerte (1er cas). Contre-témoins : à 30 jours, rien ; un
 * jeton révoqué n'alerte plus.
 * Angle mort : sans la PR 4, `balayerEnregistreur` n'est pas encore appelé
 * toutes les 5 minutes ; la console montre le badge J-14 / J-3 dès cette PR.
 */

import { describe, expect, it, vi } from "vitest";

import { balayerEnregistreur } from "../balayage-enregistreur";
import { seuilAlerteJeton } from "../jeton";
import {
  commePrisma,
  fausseBase,
  JOUR,
  semerAppareil,
  T0,
} from "../../../../tests/outils/fixtures-enregistreur";

const ENV = { ENREGISTREMENT_VISIO_PILOTE: "true" };

describe("⛔ un jeton qui expire sous 14 jours alerte", () => {
  it("seuils purs : 30 j rien, 10 j → 14, 2 j → 3, expiré ou révoqué → rien", () => {
    const a = (jours: number, revoqueLe: Date | null = null) => ({
      expireLe: new Date(T0.getTime() + jours * JOUR),
      revoqueLe,
    });
    expect(seuilAlerteJeton(a(30), T0)).toBeNull();
    expect(seuilAlerteJeton(a(14), T0)).toBe(14);
    expect(seuilAlerteJeton(a(10), T0)).toBe(14);
    expect(seuilAlerteJeton(a(2), T0)).toBe(3);
    expect(seuilAlerteJeton(a(-1), T0)).toBeNull();
    expect(seuilAlerteJeton(a(2, T0), T0)).toBeNull();
  });

  it("une alerte à J-14, pas deux ; retentée si l'envoi échoue", async () => {
    const db = fausseBase();
    semerAppareil(db, { expireLe: new Date(T0.getTime() + 10 * JOUR) });
    const notifier = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);

    await balayerEnregistreur(commePrisma(db), notifier, {
      maintenant: T0,
      version: "t",
      env: ENV,
    });
    await balayerEnregistreur(commePrisma(db), notifier, {
      maintenant: T0,
      version: "t",
      env: ENV,
    });
    await balayerEnregistreur(commePrisma(db), notifier, {
      maintenant: T0,
      version: "t",
      env: ENV,
    });

    expect(notifier).toHaveBeenCalledTimes(2); // échec, puis succès, puis plus rien
    const alerte = db.lignes("alerteVisio")[0];
    expect(String(alerte?.["cle"])).toMatch(/^jeton-expire:.+:j14$/);
    expect(alerte?.["envoyeeLe"]).toBeInstanceOf(Date);
    expect(alerte?.["essais"]).toBe(2);
  });

  it("puis une seconde à J-3", async () => {
    const db = fausseBase();
    semerAppareil(db, { expireLe: new Date(T0.getTime() + 10 * JOUR) });
    const notifier = vi.fn().mockResolvedValue(true);
    await balayerEnregistreur(commePrisma(db), notifier, {
      maintenant: T0,
      version: "t",
      env: ENV,
    });
    await balayerEnregistreur(commePrisma(db), notifier, {
      maintenant: new Date(T0.getTime() + 8 * JOUR),
      version: "t",
      env: ENV,
    });
    expect(notifier).toHaveBeenCalledTimes(2);
    expect(db.lignes("alerteVisio").map((a) => String(a["cle"]).split(":")[2])).toEqual([
      "j14",
      "j3",
    ]);
  });

  it("contre-témoin : un jeton à 30 jours n'alerte pas", async () => {
    const db = fausseBase();
    semerAppareil(db, { expireLe: new Date(T0.getTime() + 30 * JOUR) });
    const notifier = vi.fn().mockResolvedValue(true);
    await balayerEnregistreur(commePrisma(db), notifier, {
      maintenant: T0,
      version: "t",
      env: ENV,
    });
    expect(notifier).not.toHaveBeenCalled();
  });
});
