// ⚠️ PAS de `import "server-only"` : aucune raison d'interdire ce module à un
// script `tsx` (vérification manuelle de l'antivirus depuis un conteneur).

/**
 * CLIENT CLAMAV — protocole `INSTREAM` de clamd, sur TCP (2026-09-28).
 *
 * Le conteneur `axion-clamav` vit sur le réseau Docker privé « coolify », sans
 * port publié sur l'hôte. Le fichier lui est ENVOYÉ en flux (il n'a pas accès
 * au volume des CV) : `zINSTREAM\0`, puis des blocs `[longueur uint32 BE][données]`,
 * puis un bloc de longueur 0. Réponse : `stream: OK` ou `stream: <nom> FOUND`.
 *
 * 🔑 Trois issues, jamais deux. « Sain » et « infecté » sont des verdicts ;
 * « indisponible » (antivirus absent, délai, réponse illisible) N'EN EST PAS UN :
 * la vidéo reste en analyse et n'est JAMAIS montrée sans verdict. Une panne de
 * l'antivirus lue comme « sain » serait exactement la porte qu'il doit fermer.
 */

import { createReadStream } from "node:fs";
import { connect } from "node:net";

export type VerdictAntivirus =
  | { readonly issue: "sain" }
  | { readonly issue: "infecte"; readonly signature: string }
  | { readonly issue: "indisponible"; readonly raison: string };

const HOTE = process.env.CLAMAV_HOST ?? "axion-clamav";
const PORT = Number(process.env.CLAMAV_PORT ?? 3310);
const DELAI_MS = 5 * 60 * 1000;

/** Lit la réponse brute de clamd (pure, testée). */
export function lireReponseClamd(brut: string): VerdictAntivirus {
  const r = brut.replace(/\0/g, "").trim();
  if (/^stream: OK$/.test(r)) return { issue: "sain" };
  const trouve = /^stream: (.+) FOUND$/.exec(r);
  if (trouve) return { issue: "infecte", signature: trouve[1]!.slice(0, 200) };
  return { issue: "indisponible", raison: r ? r.slice(0, 200) : "réponse vide" };
}

/**
 * Même protocole `zINSTREAM`, sur des OCTETS en mémoire (ADR 0063, documents
 * du projet stockés en base : il n'y a pas de chemin à lire). Blocs de 1 Mo ;
 * mêmes trois issues ; `analyserFichier` est inchangé.
 */
export function analyserOctets(
  octets: Uint8Array,
  delaiMs: number = DELAI_MS,
): Promise<VerdictAntivirus> {
  return new Promise((resolve) => {
    let fini = false;
    let reponse = "";
    const finir = (v: VerdictAntivirus) => {
      if (fini) return;
      fini = true;
      socket.destroy();
      resolve(v);
    };
    const socket = connect({ host: HOTE, port: PORT });
    socket.setTimeout(delaiMs, () => finir({ issue: "indisponible", raison: "délai dépassé" }));
    socket.on("error", (e) => finir({ issue: "indisponible", raison: e.message }));
    socket.on("data", (d) => {
      reponse += d.toString("utf8");
      if (reponse.includes("\0")) finir(lireReponseClamd(reponse));
    });
    socket.on("end", () => finir(lireReponseClamd(reponse)));
    socket.on("connect", () => {
      socket.write("zINSTREAM\0");
      const BLOC = 1024 * 1024;
      let position = 0;
      const ecrire = (): void => {
        while (position < octets.length && !fini) {
          const bloc = octets.subarray(position, Math.min(position + BLOC, octets.length));
          position += bloc.length;
          const entete = Buffer.alloc(4);
          entete.writeUInt32BE(bloc.length, 0);
          if (!socket.write(Buffer.concat([entete, bloc]))) {
            socket.once("drain", ecrire);
            return;
          }
        }
        if (!fini) socket.write(Buffer.alloc(4));
      };
      ecrire();
    });
  });
}

export function analyserFichier(chemin: string): Promise<VerdictAntivirus> {
  return new Promise((resolve) => {
    let fini = false;
    let reponse = "";
    const finir = (v: VerdictAntivirus) => {
      if (fini) return;
      fini = true;
      socket.destroy();
      resolve(v);
    };
    const socket = connect({ host: HOTE, port: PORT });
    socket.setTimeout(DELAI_MS, () => finir({ issue: "indisponible", raison: "délai dépassé" }));
    socket.on("error", (e) => finir({ issue: "indisponible", raison: e.message }));
    socket.on("data", (d) => {
      reponse += d.toString("utf8");
      if (reponse.includes("\0")) finir(lireReponseClamd(reponse));
    });
    socket.on("end", () => finir(lireReponseClamd(reponse)));
    socket.on("connect", () => {
      socket.write("zINSTREAM\0");
      const flux = createReadStream(chemin, { highWaterMark: 1024 * 1024 });
      flux.on("data", (bloc) => {
        const b = typeof bloc === "string" ? Buffer.from(bloc) : bloc;
        const entete = Buffer.alloc(4);
        entete.writeUInt32BE(b.length, 0);
        if (!socket.write(Buffer.concat([entete, b]))) {
          flux.pause();
          socket.once("drain", () => flux.resume());
        }
      });
      flux.on("error", (e) => finir({ issue: "indisponible", raison: `lecture : ${e.message}` }));
      flux.on("end", () => socket.write(Buffer.alloc(4)));
    });
  });
}
