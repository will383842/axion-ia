/**
 * Harnais : charge le VRAI `service-worker.js` avec un faux `chrome` et un faux
 * `fetch` (liste du jour), pour éprouver le parcours « Oui, enregistrer » →
 * panneau, sans navigateur. Ce qui touche indexedDB (file, captures) n'est pas
 * joué ici.
 */

import { vi } from "vitest";

export interface RencontreDeTest {
  readonly rencontreId: string;
  readonly calendlyEventId?: string;
}

type Ecouteur = (msg: unknown, envoyeur: unknown, repondre: (r?: unknown) => void) => boolean;

export const ID_EXTENSION = "extension-axion";
export const DEPUIS_LA_CONSOLE = {
  id: ID_EXTENSION,
  tab: { id: 7, windowId: 3 },
  origin: "https://axion-ia.com",
};
export const DEPUIS_LE_PANNEAU = { id: ID_EXTENSION };

function zone(m: Map<string, unknown>) {
  return {
    get: async (cles: string[]) =>
      Object.fromEntries(cles.filter((c) => m.has(c)).map((c) => [c, m.get(c)])),
    set: async (o: Record<string, unknown>) => {
      for (const [c, v] of Object.entries(o)) m.set(c, v);
    },
    setAccessLevel: async () => undefined,
  };
}

/** Laisse filer les promesses en vol. */
export async function filer(): Promise<void> {
  for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0));
}

export async function chargerServiceWorker(o: {
  rencontres: RencontreDeTest[];
  ouvertureRefusee?: boolean;
  /** Capture déjà en cours au chargement (stockage de session). */
  captureInitiale?: Record<string, unknown>;
  /** 1.4.0 — `null` : aucun jeton enregistré (poste à relier). */
  jetonInitial?: string | null;
}) {
  vi.resetModules();
  // Le stockage local (indexedDB) est remplacé : seule la décision est éprouvée.
  vi.doMock("../../../extensions/enregistreur-meet/stockage-local.js", () => ({
    ajouterALaFile: async () => undefined,
    detruireCapture: async () => undefined,
    ecrireCapture: async () => undefined,
    lireCaptures: async () => ({}),
    lireLaFile: async () => [],
    mesurerLaFile: async () => ({ fileEnAttente: 0, agePlusVieuxMs: null }),
    mettreAJourElement: async () => undefined,
    retirerDeLaFile: async () => undefined,
  }));
  const session = new Map<string, unknown>(
    o.captureInitiale ? [["capture", o.captureInitiale]] : [],
  );
  const local = new Map<string, unknown>(
    o.jetonInitial === null
      ? []
      : [
          ["jeton", o.jetonInitial ?? "a".repeat(64)],
          ["jetonExpireLe", new Date(Date.now() + 60 * 86_400_000).toISOString()],
        ],
  );
  const ecouteurs: Ecouteur[] = [];
  const alarmes: Array<(a: { name: string }) => Promise<void> | void> = [];
  const alarmesCreees: Array<{ nom: string; when: number | undefined }> = [];
  const etats: Array<Record<string, unknown>> = [];
  const badges: string[] = [];
  let ouvertures = 0;
  let optionsOuvertes = 0;
  const rien = { addListener: () => undefined };
  vi.stubGlobal("chrome", {
    runtime: {
      id: ID_EXTENSION,
      onMessage: { addListener: (f: Ecouteur) => ecouteurs.push(f) },
      onInstalled: rien,
      onStartup: rien,
      onUpdateAvailable: rien,
      sendMessage: async (m: Record<string, unknown>) => {
        if (m["type"] === "etat") etats.push(m);
      },
      reload: () => undefined,
      openOptionsPage: async () => {
        optionsOuvertes++;
      },
    },
    storage: { local: zone(local), session: zone(session) },
    alarms: {
      create: (nom: string, x: { when?: number }) => alarmesCreees.push({ nom, when: x?.when }),
      onAlarm: { addListener: (f: (a: { name: string }) => void) => alarmes.push(f) },
    },
    sidePanel: {
      open: async () => {
        ouvertures++;
        if (o.ouvertureRefusee) throw new Error("geste utilisateur requis");
      },
      setPanelBehavior: async () => undefined,
    },
    action: {
      setBadgeText: async ({ text }: { text: string }) => {
        badges.push(text);
      },
      setBadgeBackgroundColor: async () => undefined,
    },
    notifications: { create: () => undefined },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            mode: "ouvert",
            serveurLe: new Date().toISOString(),
            jetonExpireLe: new Date(Date.now() + 60 * 86_400_000).toISOString(),
            rencontres: o.rencontres,
          }),
          { status: 200 },
        ),
    ),
  );
  await import("../../../extensions/enregistreur-meet/service-worker.js");
  await filer();

  const envoyer = async (msg: unknown, envoyeur: unknown = DEPUIS_LE_PANNEAU) => {
    let reponse: unknown;
    await new Promise<void>((fin) => {
      const asynchrone = ecouteurs[0]?.(msg, envoyeur, (r?: unknown) => {
        reponse = r;
        fin();
      });
      if (!asynchrone) fin();
    });
    await filer();
    return reponse;
  };
  const alarme = async (name: string) => {
    for (const f of alarmes) await f({ name });
    await filer();
  };
  return {
    envoyer,
    alarme,
    session,
    local,
    get optionsOuvertes() {
      return optionsOuvertes;
    },
    badges,
    alarmesCreees,
    get ouvertures() {
      return ouvertures;
    },
    dernierEtat: () => etats[etats.length - 1] ?? {},
  };
}
