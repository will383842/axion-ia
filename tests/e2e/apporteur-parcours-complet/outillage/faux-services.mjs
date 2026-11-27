// Faux services du bac à sable — AUCUN appel réseau réel. Données entièrement fictives.
//   · HTTPS :443  → faux stockage R2 (S3, en mémoire) + faux registre SIRENE (toujours « actif »)
//   · TCP   :3310 → faux ClamAV (clamd INSTREAM, toujours « stream: OK »)
// Les noms d'hôte réels (…r2.cloudflarestorage.com, recherche-entreprises.api.gouv.fr) sont
// renvoyés vers 127.0.0.1 par /etc/hosts DU BAC À SANDBOX ; le certificat est auto-signé et
// annoncé à Node par NODE_EXTRA_CA_CERTS. Usage : node faux-services.mjs <dossier-certs>
import { createServer } from "node:https";
import { createServer as tcp } from "node:net";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const dossier = process.argv[2];
const stock = new Map();
const journal = [];

function siretDe(siren) {
  const luhn = (s) =>
    [...s].reverse().reduce((a, c, i) => {
      let d = +c;
      if (i % 2 === 1) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      return a + d;
    }, 0) %
      10 ===
    0;
  for (let i = 1; i < 100000; i++) {
    const c = siren + String(i).padStart(5, "0");
    if (luhn(c)) return c;
  }
}

function registre(q) {
  const siren = q.replace(/\D/g, "").slice(0, 9);
  const siret = q.replace(/\D/g, "").length === 14 ? q.replace(/\D/g, "") : siretDe(siren);
  const adresse = "12 RUE DE L'EXEMPLE 69001 LYON";
  const etab = {
    siret,
    adresse,
    activite_principale: "70.22Z",
    etat_administratif: "A",
    code_postal: "69001",
  };
  return {
    results: [
      {
        siren,
        nom_complet: "CAMILLE EXEMPLAIRE (ENTREPRISE FICTIVE)",
        nom_raison_sociale: null,
        etat_administratif: "A",
        nature_juridique: "1000",
        activite_principale: "70.22Z",
        complements: { est_entrepreneur_individuel: true },
        dirigeants: [
          {
            type_dirigeant: "personne physique",
            nom: "EXEMPLAIRE",
            prenoms: "CAMILLE",
            qualite: null,
          },
        ],
        siege: etab,
        matching_etablissements: [etab],
      },
    ],
    total_results: 1,
  };
}

const srv = createServer(
  { key: readFileSync(join(dossier, "cle.pem")), cert: readFileSync(join(dossier, "cert.pem")) },
  (req, res) => {
    const url = new URL(req.url, "https://x");
    const hote = (req.headers.host ?? "").toLowerCase();
    if (hote.startsWith("recherche-entreprises")) {
      journal.push(`SIRENE ${url.search}`);
      res.setHeader("content-type", "application/json");
      return res.end(JSON.stringify(registre(url.searchParams.get("q") ?? "")));
    }
    // S3 : la clé est le chemin (style « virtual host » → /<clé> ; style chemin → /<bucket>/<clé>).
    const cle = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    const corps = [];
    req.on("data", (c) => corps.push(c));
    req.on("end", () => {
      journal.push(`S3 ${req.method} ${cle}`);
      if (url.pathname === "/__journal") return res.end(journal.join("\n"));
      if (req.method === "PUT") {
        let buf = Buffer.concat(corps);
        // Décodage aws-chunked éventuel (en-têtes de taille de morceaux).
        if (
          (req.headers["content-encoding"] ?? "").includes("aws-chunked") ||
          req.headers["x-amz-content-sha256"]?.startsWith("STREAMING")
        ) {
          const parts = [];
          let i = 0;
          while (i < buf.length) {
            const fin = buf.indexOf("\r\n", i);
            if (fin < 0) break;
            const taille = parseInt(buf.slice(i, fin).toString().split(";")[0], 16);
            if (!taille) break;
            parts.push(buf.slice(fin + 2, fin + 2 + taille));
            i = fin + 2 + taille + 2;
          }
          buf = Buffer.concat(parts);
        }
        stock.set(cle, {
          octets: buf,
          type: req.headers["content-type"] ?? "application/octet-stream",
        });
        res.setHeader("etag", '"fictif"');
        return res.end();
      }
      if (req.method === "DELETE") {
        stock.delete(cle);
        res.statusCode = 204;
        return res.end();
      }
      const o = stock.get(cle);
      if (!o) {
        res.statusCode = 404;
        res.setHeader("content-type", "application/xml");
        return res.end(
          '<?xml version="1.0"?><Error><Code>NoSuchKey</Code><Message>absent</Message></Error>',
        );
      }
      res.setHeader("content-type", o.type);
      res.setHeader("content-length", o.octets.length);
      res.setHeader("etag", '"fictif"');
      return res.end(req.method === "HEAD" ? undefined : o.octets);
    });
  },
);
srv.listen(443, "127.0.0.1", () => console.log("faux R2 + faux SIRENE : https://127.0.0.1:443"));

tcp((s) => {
  let vu = Buffer.alloc(0);
  s.on("data", (d) => {
    vu = Buffer.concat([vu, d]);
    // fin de flux INSTREAM : un bloc de longueur 0 (quatre octets nuls) en queue
    if (vu.length >= 4 && vu.subarray(vu.length - 4).equals(Buffer.alloc(4))) {
      s.end("stream: OK\0");
    }
  });
  s.on("error", () => {});
}).listen(3310, "127.0.0.1", () => console.log("faux ClamAV : tcp://127.0.0.1:3310"));
