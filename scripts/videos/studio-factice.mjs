#!/usr/bin/env node
/**
 * STUDIO FACTICE — outil de DÉVELOPPEMENT (plan PLAN-W1-W4 §13). Jamais déployé,
 * jamais appelé en production : il ne contient aucun secret et refuse de viser
 * autre chose qu'une adresse explicitement donnée.
 *
 * Il fait ce que fera le vrai studio, au même format :
 *   1. fabrique une vidéo de test (31 s, libre de droits : `ffmpeg -f lavfi`) et
 *      trois vignettes ;
 *   2. les sert comme le ferait la règle Cloudflare, requêtes `Range` en 206
 *      comprises (sans elles Safari iOS ne lit pas la vidéo) ;
 *   3. SIGNE ses requêtes en HMAC-SHA256 selon le contrat v1 (le code ci-dessous
 *      est volontairement indépendant de `src/server/videos/signature.ts` : un test
 *      d'intégration vérifie que les deux s'accordent).
 *
 * Usage en bibliothèque : voir tests/integration/videos/bout-en-bout.spec.ts.
 * Usage en ligne de commande (site de test local) :
 *   VIDEOS_STUDIO_HMAC_SECRET=… node scripts/videos/studio-factice.mjs \
 *     --site http://127.0.0.1:3000 --action publier --slug ma-video-de-test
 *   (actions : reglages | publier | retirer)
 */
import { createHash, createHmac, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createReadStream, mkdirSync, statSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const sha256Hex = (corps) => createHash("sha256").update(corps).digest("hex");

/** Valeur de l'en-tête `X-Axion-Signature`. */
export function signer({ secret, horodatage, nonce, methode, chemin, corps }) {
  const chaine = ["v1", horodatage, nonce, methode.toUpperCase(), chemin, sha256Hex(corps)].join(
    "\n",
  );
  return `v1=${createHmac("sha256", secret).update(chaine).digest("hex")}`;
}

/** En-têtes signés pour une requête (horodatage et nonce modifiables pour les tests d'attaque). */
export function entetesSignes({
  secret,
  methode,
  chemin,
  corps = "",
  horodatage = Math.floor(Date.now() / 1000),
  nonce = randomBytes(16).toString("hex"),
}) {
  const h = String(horodatage);
  return {
    "x-axion-horodatage": h,
    "x-axion-nonce": nonce,
    "x-axion-signature": signer({ secret, horodatage: h, nonce, methode, chemin, corps }),
    ...(methode === "GET" ? {} : { "content-type": "application/json" }),
  };
}

/** Fabrique les fichiers de test dans `dossier` (ffmpeg requis). Retourne leurs tailles. */
export function fabriquerFichiers(dossier) {
  mkdirSync(dossier, { recursive: true });
  const ff = (...args) => execFileSync("ffmpeg", ["-loglevel", "error", "-y", ...args]);
  if (!existsSync(join(dossier, "video-1080p.mp4"))) {
    ff(
      "-f",
      "lavfi",
      "-i",
      "testsrc=duration=31:size=320x180:rate=10",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=31",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-shortest",
      "-movflags",
      "+faststart",
      join(dossier, "video-1080p.mp4"),
    );
  }
  for (const [nom, taille] of [
    ["affiche-16x9.jpg", "1280x720"],
    ["vignette-4x3.jpg", "960x720"],
    ["vignette-1x1.jpg", "720x720"],
  ]) {
    if (!existsSync(join(dossier, nom)))
      ff("-f", "lavfi", "-i", `testsrc=size=${taille}`, "-frames:v", "1", join(dossier, nom));
  }
  return Object.fromEntries(
    ["video-1080p.mp4", "affiche-16x9.jpg", "vignette-4x3.jpg", "vignette-1x1.jpg"].map((n) => [
      n,
      statSync(join(dossier, n)).size,
    ]),
  );
}

const TYPES = { ".mp4": "video/mp4", ".jpg": "image/jpeg", ".vtt": "text/vtt" };

/**
 * Sert `racine` sous `/medias/...` comme la règle Cloudflare : HEAD, GET, et `Range`
 * en 206. `compteurs` permet aux tests de constater les requêtes reçues.
 */
export function servirFichiers(racine) {
  const compteurs = { head: 0, get: 0, range: 0 };
  const serveur = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    const chemin = resolve(racine, "." + decodeURIComponent(url.pathname));
    if (!chemin.startsWith(resolve(racine)) || !existsSync(chemin) || !statSync(chemin).isFile()) {
      res.writeHead(404).end();
      return;
    }
    const taille = statSync(chemin).size;
    const ext = chemin.slice(chemin.lastIndexOf("."));
    const base = {
      "content-type": TYPES[ext] ?? "application/octet-stream",
      "accept-ranges": "bytes",
    };
    if (req.method === "HEAD") {
      compteurs.head += 1;
      res.writeHead(200, { ...base, "content-length": taille }).end();
      return;
    }
    compteurs.get += 1;
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
    if (m) {
      compteurs.range += 1;
      const debut = m[1] === "" ? Math.max(0, taille - Number(m[2])) : Number(m[1]);
      const fin = m[1] === "" || m[2] === "" ? taille - 1 : Math.min(Number(m[2]), taille - 1);
      res.writeHead(206, {
        ...base,
        "content-range": `bytes ${debut}-${fin}/${taille}`,
        "content-length": fin - debut + 1,
      });
      createReadStream(chemin, { start: debut, end: fin }).pipe(res);
      return;
    }
    res.writeHead(200, { ...base, "content-length": taille });
    createReadStream(chemin).pipe(res);
  });
  return new Promise((ok) =>
    serveur.listen(0, "127.0.0.1", () =>
      ok({
        origine: `http://127.0.0.1:${serveur.address().port}`,
        compteurs,
        arreter: () => new Promise((fin) => serveur.close(() => fin())),
      }),
    ),
  );
}

/** Une publication `schemaVersion: 1` valide pour les fichiers de `fabriquerFichiers`. */
export function construirePublication({
  slug,
  version = 1,
  studioVideoId,
  tailles,
  theme = "automatisation",
  sousTitresOctets = 120,
  surcharge = {},
}) {
  const base = `/medias/videos/${slug}/v${version}`;
  return {
    schemaVersion: 1,
    studioVideoId:
      studioVideoId ??
      `vs_${slug
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 20)
        .padEnd(8, "0")}`,
    version,
    slug,
    langue: "fr",
    titre: `Vidéo de test ${slug} pour vérifier la chaîne complète`,
    description:
      "Une vidéo factice de trente et une secondes, produite pour vérifier de bout en bout la chaîne de publication entre le studio et le site.",
    resume:
      "Cette vidéo n'existe que pour les tests. Elle sert à vérifier que la réception signée accepte une publication complète, que les fichiers sont joignables par requête de tête, que les requêtes d'intervalle répondent bien en 206, puis que la page, le plan du site et les encarts apparaissent, et disparaissent tous ensemble au retrait. Rien de ce qu'elle dit ne doit jamais être publié sur le vrai site.",
    aRetenir: [
      "Une publication complète passe tous les contrôles du contrat.",
      "Un rejeu du même envoi ne produit aucun effet supplémentaire.",
      "Le retrait enlève la vidéo de toutes les surfaces à la fois.",
    ],
    questions: [
      {
        question: "Cette vidéo est-elle réelle ?",
        reponse:
          "Non, c'est une mire de test générée par un outil libre, sans aucune valeur éditoriale ni personne à l'image.",
      },
      {
        question: "Où sont servis les fichiers ?",
        reponse:
          "Sous le chemin des médias du site, avec prise en charge des requêtes d'intervalle pour la lecture et l'avance rapide.",
      },
    ],
    theme,
    serie: null,
    lien: { type: "service", chemin: "/fr/implementation" },
    dureeSecondes: 31,
    chapitres: [
      { titre: "Introduction", debutSecondes: 0 },
      { titre: "Suite du test", debutSecondes: 15 },
    ],
    fichiers: {
      video: {
        chemin: `${base}/video-1080p.mp4`,
        type: "video/mp4",
        octets: tailles["video-1080p.mp4"],
        sha256: "0".repeat(64),
        largeur: 320,
        hauteur: 180,
      },
      affiche169: {
        chemin: `${base}/affiche-16x9.jpg`,
        type: "image/jpeg",
        octets: tailles["affiche-16x9.jpg"],
        largeur: 1280,
        hauteur: 720,
      },
      vignette43: {
        chemin: `${base}/vignette-4x3.jpg`,
        type: "image/jpeg",
        octets: tailles["vignette-4x3.jpg"],
        largeur: 960,
        hauteur: 720,
      },
      vignette11: {
        chemin: `${base}/vignette-1x1.jpg`,
        type: "image/jpeg",
        octets: tailles["vignette-1x1.jpg"],
        largeur: 720,
        hauteur: 720,
      },
      sousTitres: {
        chemin: `${base}/sous-titres.fr.vtt`,
        type: "text/vtt",
        octets: sousTitresOctets,
      },
    },
    transcription: null,
    ia: { voixGeneree: true, doubleNumerique: false },
    personnesALImage: { williams: false },
    attestations: { aucunNomNiLogoDeClient: true },
    ...surcharge,
  };
}

/** Dépose les fichiers fabriqués à l'endroit où la publication les annonce. */
export function deposer({ racineServie, slug, version = 1, dossierSource }) {
  const cible = join(racineServie, "medias", "videos", slug, `v${version}`);
  mkdirSync(cible, { recursive: true });
  for (const n of ["video-1080p.mp4", "affiche-16x9.jpg", "vignette-4x3.jpg", "vignette-1x1.jpg"]) {
    execFileSync("cp", [join(dossierSource, n), join(cible, n)]);
  }
  const vtt = "WEBVTT\n\n00:00.000 --> 00:05.000\nVidéo de test.\n";
  execFileSync("sh", [
    "-c",
    `printf '%s' "$1" > "$2"`,
    "sh",
    vtt,
    join(cible, "sous-titres.fr.vtt"),
  ]);
  return Buffer.byteLength(vtt);
}

async function principal() {
  const arg = (n, d) => {
    const i = process.argv.indexOf(`--${n}`);
    return i > -1 ? process.argv[i + 1] : d;
  };
  const site = arg("site");
  const secret = process.env.VIDEOS_STUDIO_HMAC_SECRET;
  if (!site || !secret) {
    console.error(
      "usage : VIDEOS_STUDIO_HMAC_SECRET=… studio-factice.mjs --site <url> --action reglages|publier|retirer [--slug …]",
    );
    process.exit(2);
  }
  const action = arg("action", "reglages");
  const slug = arg("slug", "video-de-test");
  let methode = "GET";
  let chemin = "/api/interne/reglages-publics";
  let corps = "";
  if (action === "publier" || action === "retirer") {
    chemin = "/api/interne/videos";
    methode = action === "publier" ? "POST" : "DELETE";
    const studioVideoId = `vs_${slug
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 20)
      .padEnd(8, "0")}`;
    if (action === "retirer") {
      corps = JSON.stringify({ schemaVersion: 1, studioVideoId, motif: "autre" });
    } else {
      console.error(
        "« publier » en ligne de commande suppose les fichiers déjà servis sous /medias ; voir le test de bout en bout.",
      );
      process.exit(2);
    }
  }
  const r = await fetch(new URL(chemin, site), {
    method: methode,
    headers: entetesSignes({ secret, methode, chemin, corps }),
    body: methode === "GET" ? undefined : corps,
  });
  console.log(r.status, await r.text());
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await principal();
