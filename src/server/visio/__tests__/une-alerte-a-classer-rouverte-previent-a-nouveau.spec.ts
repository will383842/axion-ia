// @vitest-environment node
/**
 * L'alerte « N rendez-vous à classer » prévient Will à CHAQUE ouverture, avec la VRAIE règle
 * de dé-duplication (`creerOuDedup`) : une alerte RÉSOLUE de même message n'est jamais
 * recréée. Sans élément qui change (l'heure d'ouverture), 1 -> 0 -> 1 la même raison ne
 * préviendrait plus personne.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { dossierEnMemoire } from "@/features/dossier-client/__tests__/_dossier-en-memoire";

const base = vi.hoisted(() => ({ courante: null as null | { client: unknown } }));
vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return base.courante?.client;
  },
}));

// L'évaluateur n'est pas l'objet du test (et tire toute la chaîne d'authentification) ;
// `creerOuDedup` et le catalogue, eux, sont les VRAIS.
vi.mock("@/server/qualiopi/alertes/evaluateur", () => ({ evaluerAlertesDetaille: vi.fn() }));

import { signalerRendezVousAClasser } from "../alertes";

const envoye = () => ({ channels: { telegram: "sent" } });

describe("l'alerte « à classer » prévient à chaque ouverture", () => {
  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "postgresql://reel:reel@base.exemple:5432/axion");
    base.courante = dossierEnMemoire();
  });

  it("1 -> 0 -> 1 pour la même raison : une alerte est rouverte ET envoyée", async () => {
    const memoire = base.courante as unknown as ReturnType<typeof dossierEnMemoire>;
    const notifier = vi.fn(async () => envoye()) as never;
    const etat = { nombre: 1, raisons: { refus_porte: 1 } };

    await signalerRendezVousAClasser(memoire.client as never, etat, {
      notifier,
      maintenant: new Date("2026-10-25T09:00:00Z"),
    });
    expect(notifier).toHaveBeenCalledTimes(1);

    // Même nombre, alerte ouverte : pas de doublon, pas de nouvel envoi.
    await signalerRendezVousAClasser(memoire.client as never, etat, {
      notifier,
      maintenant: new Date("2026-10-25T09:05:00Z"),
    });
    expect(notifier).toHaveBeenCalledTimes(1);
    expect(memoire.tables["alerteSysteme"]).toHaveLength(1);

    // Will classe tout : l'alerte est résolue.
    expect(
      await signalerRendezVousAClasser(
        memoire.client as never,
        { nombre: 0, raisons: {} },
        { notifier, maintenant: new Date("2026-10-25T10:00:00Z") },
      ),
    ).toBe("resolue");
    expect(memoire.tables["alerteSysteme"]?.[0]).toMatchObject({ resolue: true });

    // Un nouveau rendez-vous, MÊME raison : Will doit être prévenu de nouveau.
    await signalerRendezVousAClasser(memoire.client as never, etat, {
      notifier,
      maintenant: new Date("2026-10-26T09:00:00Z"),
    });
    const alertes = memoire.tables["alerteSysteme"] ?? [];
    expect(alertes).toHaveLength(2);
    expect(alertes.filter((a) => a["resolue"] === false)).toHaveLength(1);
    expect(notifier).toHaveBeenCalledTimes(2);
    // (Le premier import du vrai service d'alertes charge tout l'évaluateur : délai large.)
  }, 60_000);
});
