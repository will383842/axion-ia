// @vitest-environment jsdom

/**
 * LE SCRIPT DE LA PAGE DE DÉPÔT (L5b) — chargé seulement sur la page de dépôt,
 * jamais sur la page de téléchargement.
 *
 * Joué ici dans un vrai DOM, sur la page que sert le serveur :
 *  - plus de 4 Go → refusé AVANT tout appel ;
 *  - un fichier accepté part en morceaux (commencer → signer → PUT → terminer),
 *    chaque morceau à sa taille exacte, sans cookie ;
 *  - une coupure : « Envoyer » une seconde fois REPREND (seuls les morceaux
 *    manquants repartent).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { pageDepot } from "../page-publique";
import { SCRIPT_DEPOT } from "../script-depot";

/** Le vrai minuteur : celui du script est raccourci (les essais automatiques attendent 2 s, 4 s). */
const vraiSetTimeout = globalThis.setTimeout;

const CHEMIN = "/api/partage/11111111-1111-4111-8111-111111111111/" + "j".repeat(43);

interface Appel {
  url: string;
  methode: string;
  corps: unknown;
  credentials?: string;
}

let appels: Appel[];
let panneSurMorceau: number | null;

function monter(): { form: HTMLFormElement; champ: HTMLInputElement; etat: HTMLElement } {
  const html = pageDepot({
    chemin: CHEMIN,
    expireLe: new Date("2026-10-15T10:00:00Z"),
    recus: [],
  });
  document.documentElement.innerHTML = html.replace(/^<!doctype html>/i, "");
  new Function(SCRIPT_DEPOT)();
  return {
    form: document.getElementById("depot") as HTMLFormElement,
    champ: document.getElementById("fichier") as HTMLInputElement,
    etat: document.getElementById("etat") as HTMLElement,
  };
}

function choisir(champ: HTMLInputElement, f: File | { name: string; size: number }) {
  Object.defineProperty(champ, "files", { configurable: true, value: [f] });
}

async function attendreFin(etat: HTMLElement, motif: RegExp) {
  for (let i = 0; i < 200; i++) {
    if (motif.test(etat.textContent ?? "")) return;
    await new Promise((r) => vraiSetTimeout(r, 1));
  }
  throw new Error(`fin non atteinte : « ${etat.textContent} »`);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.stubGlobal("setTimeout", (fn: () => void) => vraiSetTimeout(fn, 0));
  appels = [];
  panneSurMorceau = null;
  let recus: number[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const methode = init.method ?? "GET";
      if (methode === "PUT") {
        const n = Number(url.split("/").pop());
        const corps = init.body as Blob;
        appels.push({ url, methode, corps: corps.size, credentials: init.credentials as string });
        if (panneSurMorceau === n) {
          panneSurMorceau = null;
          return new Response(null, { status: 500 });
        }
        recus.push(n);
        return new Response(null, { status: 200 });
      }
      const corps = JSON.parse(String(init.body)) as Record<string, unknown>;
      appels.push({ url, methode, corps, credentials: init.credentials as string });
      const json = (() => {
        switch (corps.etape) {
          case "commencer":
            recus = [];
            return { ok: true, fichierId: "f1", tailleMorceau: 4, nombreMorceaux: 3 };
          case "signer":
            return {
              ok: true,
              morceaux: (corps.numeros as number[]).map((n) => ({
                numero: n,
                url: `https://r2/${n}`,
              })),
            };
          case "reprendre":
            return { ok: true, fichierId: "f1", tailleMorceau: 4, nombreMorceaux: 3, recus };
          case "terminer":
            return { ok: true };
          default:
            return { ok: false, erreur: "?" };
        }
      })();
      return new Response(JSON.stringify(json), {
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
});

describe("le script de dépôt", () => {
  it("se lit sans erreur de syntaxe, et la page n'a aucun script en ligne", () => {
    expect(() => new Function(SCRIPT_DEPOT)).not.toThrow();
    const html = pageDepot({ chemin: CHEMIN, expireLe: new Date(), recus: [] });
    expect(html).not.toMatch(/<script>(?!<\/script>)/);
    expect(html).not.toMatch(/\son[a-z]+=/i);
  });

  it("plus de 4 Go → refusé avant tout appel", async () => {
    const { form, champ, etat } = monter();
    choisir(champ, { name: "gros.mp4", size: 4 * 1024 ** 3 + 1 });
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await attendreFin(etat, /4 Go/);
    expect(appels).toEqual([]);
  });

  it("envoie par morceaux puis termine ; une coupure se reprend sans renvoyer ce qui est arrivé", async () => {
    const { form, champ, etat } = monter();
    const fichier = new File(
      [new Uint8Array([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 1, 2])],
      "v.mp4",
    );
    choisir(champ, fichier);

    // Une panne qui persiste après les essais automatiques : on la rend durable.
    const fetchOrigine = globalThis.fetch as unknown as (
      u: string,
      i: RequestInit,
    ) => Promise<Response>;
    let pannes = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (u: string, i: RequestInit) => {
        if (i.method === "PUT" && u.endsWith("/2") && pannes < 10) {
          pannes++;
          appels.push({
            url: u,
            methode: "PUT",
            corps: (i.body as Blob).size,
            credentials: i.credentials as string,
          });
          return new Response(null, { status: 500 });
        }
        return fetchOrigine(u, i);
      }),
    );
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await attendreFin(etat, /Cliquez à nouveau/);

    const commencer = appels.find(
      (a) => a.methode === "POST" && (a.corps as { etape: string }).etape === "commencer",
    );
    expect(commencer?.corps).toMatchObject({ nom: "v.mp4", taille: 10 });
    expect(typeof (commencer?.corps as { entete: string }).entete).toBe("string");
    expect(appels.every((a) => a.credentials === "omit")).toBe(true);
    expect(appels.some((a) => (a.corps as { etape?: string }).etape === "terminer")).toBe(false);

    // Deuxième clic : on reprend ; seul le morceau 2 repart.
    pannes = 10;
    appels = [];
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await attendreFin(etat, /bien arrivé/);
    const etapes = appels
      .filter((a) => a.methode === "POST")
      .map((a) => (a.corps as { etape: string }).etape);
    expect(etapes).toEqual(["reprendre", "signer", "terminer"]);
    const puts = appels.filter((a) => a.methode === "PUT");
    expect(puts.map((p) => [p.url, p.corps])).toEqual([["https://r2/2", 4]]);
  });

  it("chaque morceau a sa taille exacte (le dernier est plus court)", async () => {
    const { form, champ, etat } = monter();
    choisir(champ, new File([new Uint8Array([0x50, 0x4b, 3, 4, 5, 6, 7, 8, 9, 10])], "v.zip"));
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await attendreFin(etat, /bien arrivé/);
    const puts = appels.filter((a) => a.methode === "PUT").map((p) => [p.url, p.corps]);
    expect(puts.sort()).toEqual([
      ["https://r2/1", 4],
      ["https://r2/2", 4],
      ["https://r2/3", 2],
    ]);
  });
});
