// @vitest-environment node
/**
 * L'alerte « N rendez-vous à classer » est identifiée par l'EMPREINTE de l'ensemble des
 * rendez-vous à classer, avec la VRAIE règle de dé-duplication (`creerOuDedup` : une alerte
 * RÉSOLUE de même message n'est jamais recréée).
 *
 *   · fermée à la main + même ensemble → aucune alerte, aucun envoi ;
 *   · un rendez-vous de plus, ou 1 -> 0 -> 1 avec un AUTRE rendez-vous → une alerte, un envoi ;
 *   · un envoi Telegram raté est retenté, sans créer une seconde ligne.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { dossierEnMemoire } from "@/features/dossier-client/__tests__/_dossier-en-memoire";
import { empreinteDe } from "@/features/dossier-client/fiche-auto";

const base = vi.hoisted(() => ({ courante: null as null | { client: unknown } }));
vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return base.courante?.client;
  },
}));
// L'évaluateur n'est pas l'objet du test (et tire toute la chaîne d'authentification) ;
// `creerOuDedup` et le catalogue, eux, sont les VRAIS.
vi.mock("@/server/qualiopi/alertes/evaluateur", () => ({ evaluerAlertesDetaille: vi.fn() }));
// Le porte-client tire Prisma réel : seul l'import de `empreinteDe` nous intéresse ici.
vi.mock("@/server/qualiopi/crm/porte-client", () => ({}));
vi.mock("@/server/visio/gestes-compte-rendu", () => ({}));

import { signalerRendezVousAClasser } from "../alertes";

const envoye = { channels: { telegram: "sent" } };
const rate = { channels: { telegram: "failed" } };

const etatDe = (ids: string[]) => ({
  nombre: ids.length,
  raisons: { refus_porte: ids.length } as Record<string, number>,
  empreinte: empreinteDe(ids),
});

describe("l'alerte « à classer » : une empreinte, pas une heure", () => {
  let memoire: ReturnType<typeof dossierEnMemoire>;
  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "postgresql://reel:reel@base.exemple:5432/axion");
    memoire = dossierEnMemoire();
    base.courante = memoire;
  });
  const signaler = (
    etat: ReturnType<typeof etatDe>,
    notifier: ReturnType<typeof vi.fn>,
    heure = "2026-10-25T09:00:00Z",
  ) =>
    signalerRendezVousAClasser(memoire.client as never, etat, {
      notifier: notifier as never,
      maintenant: new Date(heure),
    });

  it("l'empreinte est stable, triée, courte et sans rien de lisible", () => {
    expect(empreinteDe(["b", "a"])).toBe(empreinteDe(["a", "b"]));
    expect(empreinteDe(["a"])).not.toBe(empreinteDe(["b"]));
    expect(empreinteDe(["a", "b"])).toMatch(/^[0-9a-f]{12}$/);
  });

  it("fermée à la main, même ensemble : aucune alerte, aucun envoi", async () => {
    const notifier = vi.fn(async () => envoye);
    const etat = etatDe(["r1"]);
    await signaler(etat, notifier);
    expect(notifier).toHaveBeenCalledTimes(1);
    const ligne = memoire.tables["alerteSysteme"]?.[0];
    expect(ligne?.["metadata"]).toMatchObject({ empreinte: etat.empreinte });
    expect(String(ligne?.["message"])).toContain(etat.empreinte);
    if (ligne) {
      ligne["resolue"] = true; // Will l'a fermée.
      ligne["resolueAt"] = new Date();
    }
    await signaler(etat, notifier, "2026-10-25T09:05:00Z");
    await signaler(etat, notifier, "2026-10-25T09:10:00Z");
    expect(memoire.tables["alerteSysteme"]).toHaveLength(1);
    expect(notifier).toHaveBeenCalledTimes(1);
  });

  it("un rendez-vous de plus : une nouvelle alerte, un envoi, pas de doublon ouvert", async () => {
    const notifier = vi.fn(async () => envoye);
    await signaler(etatDe(["r1"]), notifier);
    await signaler(etatDe(["r1", "r2"]), notifier, "2026-10-25T09:05:00Z");
    const alertes = memoire.tables["alerteSysteme"] ?? [];
    expect(alertes).toHaveLength(2);
    expect(alertes.filter((a) => a["resolue"] === false)).toHaveLength(1);
    expect(notifier).toHaveBeenCalledTimes(2);
  });

  it("1 -> 0 -> 1 avec un AUTRE rendez-vous : une nouvelle alerte est envoyée", async () => {
    const notifier = vi.fn(async () => envoye);
    await signaler(etatDe(["r1"]), notifier);
    expect(await signaler({ nombre: 0, raisons: {}, empreinte: "" }, notifier)).toBe("resolue");
    await signaler(etatDe(["r2"]), notifier, "2026-10-26T09:00:00Z");
    expect(memoire.tables["alerteSysteme"]).toHaveLength(2);
    expect(notifier).toHaveBeenCalledTimes(2);
  });

  it("un envoi raté est retenté au passage suivant, sur la MÊME ligne", async () => {
    const notifier = vi.fn().mockResolvedValueOnce(rate).mockResolvedValue(envoye);
    const etat = etatDe(["r1"]);
    expect(await signaler(etat, notifier)).toBe("echec_envoi");
    expect(memoire.tables["alerteSysteme"]?.[0]?.["notifiedAt"] ?? null).toBeNull();
    await signaler(etat, notifier, "2026-10-25T09:05:00Z");
    expect(notifier).toHaveBeenCalledTimes(2);
    expect(memoire.tables["alerteSysteme"]).toHaveLength(1);
    expect(memoire.tables["alerteSysteme"]?.[0]?.["notifiedAt"]).toBeTruthy();
    // Parti : plus rien au passage d'après.
    await signaler(etat, notifier, "2026-10-25T09:10:00Z");
    expect(notifier).toHaveBeenCalledTimes(2);
  }, 60_000);
});
