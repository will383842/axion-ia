// Banc @formateurs — le STOCKAGE R2 SIMULÉ.
//
// Le contrat-cadre, sa copie de signature (F10) et l'exemplaire contresigné (F19)
// passent par R2 : le moteur de signature y archive le PDF, et le worker d'e-mails y
// relit la pièce jointe au départ. Sans stockage, ces trois envois ne peuvent pas
// partir et le banc ne peut pas les constater.
//
// Ce serveur répond, en HTTPS, aux quatre verbes S3 que le code utilise (PUT, GET,
// HEAD, DELETE d'un objet), sous le nom même de R2 : le job du banc fait pointer
// `banc.r2.cloudflarestorage.com` et `<seau>.banc.r2.cloudflarestorage.com` vers
// 127.0.0.1 (`/etc/hosts`) et fait confiance à son certificat (`NODE_EXTRA_CA_CERTS`).
// Le SDK S3 RÉEL parle donc à ce serveur, sans une ligne de code modifiée — comme le
// registre et Calendly simulés. Aucun objet ne sort de la machine.
//
// Les signatures S3 ne sont pas vérifiées (les clés du banc sont fictives). Les objets
// vivent sur disque, dans le dossier donné, effacés avec le job.
//
// Usage : node stockage-r2-simule.mjs <cert.pem> <cle.pem> <dossier> [port]

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { readFile, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:https";
import path from "node:path";

const [cert, cle, dossier, port = "443"] = process.argv.slice(2);
if (!cert || !cle || !dossier) {
  console.error("usage : stockage-r2-simule.mjs <cert.pem> <cle.pem> <dossier> [port]");
  process.exit(2);
}
mkdirSync(dossier, { recursive: true });

/** `<seau>.banc.r2.cloudflarestorage.com/<clé>` ou `banc.r2…/<seau>/<clé>` → fichier. */
function fichierDe(requete) {
  const hote = (requete.headers.host ?? "").split(":")[0];
  const url = new URL(requete.url ?? "/", "https://banc.invalid");
  let chemin = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  const seauVirtuel = hote.split(".").length > 4 ? hote.split(".")[0] : null;
  if (seauVirtuel) chemin = `${seauVirtuel}/${chemin}`;
  if (chemin === "" || chemin.includes("..")) return null;
  return path.join(dossier, chemin.replace(/\//g, "__"));
}

const serveur = createServer(
  { cert: readFileSync(cert), key: readFileSync(cle) },
  async (requete, reponse) => {
    const fichier = fichierDe(requete);
    const methode = requete.method ?? "GET";
    try {
      if (fichier === null) {
        reponse.writeHead(400).end();
        return;
      }
      if (methode === "PUT") {
        const morceaux = [];
        for await (const m of requete) morceaux.push(m);
        const corps = Buffer.concat(morceaux);
        await writeFile(fichier, corps);
        await writeFile(
          `${fichier}.type`,
          requete.headers["content-type"] ?? "application/octet-stream",
        );
        const etag = `"${createHash("md5").update(corps).digest("hex")}"`;
        reponse.writeHead(200, { ETag: etag }).end();
        console.log(`[r2-simule] PUT ${path.basename(fichier)} (${corps.length} o)`);
        return;
      }
      if (methode === "GET" || methode === "HEAD") {
        const infos = await stat(fichier).catch(() => null);
        if (infos === null) {
          reponse
            .writeHead(404, { "Content-Type": "application/xml" })
            .end(methode === "HEAD" ? undefined : "<Error><Code>NoSuchKey</Code></Error>");
          return;
        }
        const type = await readFile(`${fichier}.type`, "utf8").catch(
          () => "application/octet-stream",
        );
        reponse.writeHead(200, { "Content-Type": type, "Content-Length": infos.size });
        reponse.end(methode === "HEAD" ? undefined : await readFile(fichier));
        return;
      }
      if (methode === "DELETE") {
        await rm(fichier, { force: true });
        await rm(`${fichier}.type`, { force: true });
        reponse.writeHead(204).end();
        return;
      }
      reponse.writeHead(501).end();
    } catch (e) {
      console.error(`[r2-simule] ${methode} en échec :`, e instanceof Error ? e.message : e);
      reponse.writeHead(500).end();
    }
  },
);

serveur.listen(Number(port), "127.0.0.1", () => {
  console.log(`[r2-simule] prêt sur 127.0.0.1:${port}, objets dans ${dossier}`);
});
