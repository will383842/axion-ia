// @vitest-environment node

/**
 * `analyserOctets` (ADR 0063, D8) parle le même `zINSTREAM` que
 * `analyserFichier`, sur des octets en mémoire. Un faux clamd local reçoit le
 * flux et le relit : blocs `[uint32 BE][données]`, terminés par un bloc nul.
 *
 * Trois issues, jamais deux : « sain », « infecté », et « indisponible »
 * (personne n'écoute, ou délai dépassé) — qui n'est PAS un verdict.
 */

import { createServer, type Server } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";

let serveur: Server | null = null;

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.resetModules();
  if (serveur) await new Promise<void>((r) => serveur!.close(() => r()));
  serveur = null;
});

/** Un faux clamd : relit le flux, puis répond selon `repondre(contenu)`. */
async function fauxClamd(repondre: (contenu: Buffer) => string | null): Promise<number> {
  serveur = createServer((socket) => {
    let tampon = Buffer.alloc(0);
    socket.on("data", (d) => {
      tampon = Buffer.concat([tampon, d]);
      const entete = Buffer.from("zINSTREAM\0");
      if (tampon.length < entete.length) return;
      let pos = entete.length;
      const blocs: Buffer[] = [];
      while (pos + 4 <= tampon.length) {
        const n = tampon.readUInt32BE(pos);
        if (n === 0) {
          const r = repondre(Buffer.concat(blocs));
          if (r !== null) socket.end(`${r}\0`);
          return;
        }
        if (pos + 4 + n > tampon.length) return;
        blocs.push(tampon.subarray(pos + 4, pos + 4 + n));
        pos += 4 + n;
      }
    });
  });
  await new Promise<void>((r) => serveur!.listen(0, "127.0.0.1", () => r()));
  const adresse = serveur.address();
  return typeof adresse === "object" && adresse ? adresse.port : 0;
}

async function charger(port: number) {
  vi.stubEnv("CLAMAV_HOST", "127.0.0.1");
  vi.stubEnv("CLAMAV_PORT", String(port));
  return import("../clamav");
}

describe("l'antivirus analyse des octets en mémoire", () => {
  it("transmet TOUS les octets (plusieurs blocs de 1 Mo) et rend « sain »", async () => {
    let recu = 0;
    const port = await fauxClamd((c) => {
      recu = c.length;
      return "stream: OK";
    });
    const { analyserOctets } = await charger(port);
    const octets = new Uint8Array(2.5 * 1024 * 1024).fill(7);
    expect(await analyserOctets(octets, 5_000)).toEqual({ issue: "sain" });
    expect(recu).toBe(octets.length);
  });

  it("rend « infecté » avec la signature", async () => {
    const port = await fauxClamd(() => "stream: Eicar-Signature FOUND");
    const { analyserOctets } = await charger(port);
    expect(await analyserOctets(new TextEncoder().encode("X5O!P%@AP"), 5_000)).toEqual({
      issue: "infecte",
      signature: "Eicar-Signature",
    });
  });

  it("personne n'écoute → « indisponible », jamais « sain »", async () => {
    const port = await fauxClamd(() => "stream: OK");
    await new Promise<void>((r) => serveur!.close(() => r()));
    serveur = null;
    const { analyserOctets } = await charger(port);
    const v = await analyserOctets(new Uint8Array([1, 2, 3]), 2_000);
    expect(v.issue).toBe("indisponible");
  });

  it("aucune réponse dans le délai → « indisponible »", async () => {
    const port = await fauxClamd(() => null);
    const { analyserOctets } = await charger(port);
    const v = await analyserOctets(new Uint8Array([1, 2, 3]), 200);
    expect(v).toEqual({ issue: "indisponible", raison: "délai dépassé" });
  });
});
