// Import des CV reçus sur Indeed dans les fiches APPORTEURS (2026-09-28).
//
// Pourquoi un script dans le dépôt : l'import Indeed du 23/09 avait été fait
// hors du code, et plus personne ne savait d'où venaient ces fiches. Celui-ci
// reste lisible.
//
// Tourne DANS le conteneur de l'app web (le seul qui monte /var/data/cv) :
//
//   node scripts/import-cv-apporteurs.mjs <manifeste.json> <dossier des CV> [--apply]
//
// Sans `--apply` : ne fait RIEN, affiche seulement ce qui serait fait (par
// numéro d'entrée et identifiant de fiche — aucune donnée personnelle).
//
// Le manifeste (hors dépôt : il contient des données personnelles) est une
// liste de { fichier, cible, cv } :
//   · `cible` = id de la fiche à compléter, ou null ;
//   · `cv` = ce que dit le CV + l'analyse (voir lib/commercial-application/cv-candidat.ts).
//
// Pour chaque entrée :
//   1. fiches visées = `cible` + toute fiche apporteur dont l'empreinte d'adresse
//      égale celle de l'e-mail lu sur le CV (la même personne a pu remplir le
//      dossier complet sous une autre fiche) ;
//   2. aucune fiche → on en CRÉE une (statut « new », aucun e-mail envoyé) ;
//   3. le fichier est copié sur le volume, et `details.cv` +
//      `details.candidatureSalariee` sont posés. Le téléphone et la ville ne
//      sont remplis que s'ils manquent : on ne remplace jamais une donnée saisie.
//
// Idempotent : une fiche qui porte déjà un CV du même nom est laissée telle quelle.

import { randomUUID, createCipheriv, randomBytes, createHmac } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { createRequire } from "node:module";

// Le client que l'app utilise (src/lib/prisma.ts), pas `@prisma/client`.
const { PrismaClient } = createRequire(import.meta.url)("../prisma/generated/client");

const [manifestPath, dossierCv] = process.argv.slice(2);
const APPLY = process.argv.includes("--apply");
if (!manifestPath || !dossierCv) {
  console.error(
    "usage : node scripts/import-cv-apporteurs.mjs <manifeste.json> <dossier> [--apply]",
  );
  process.exit(2);
}

const ANNONCE = "Commercial(e) B2B - Développement de portefeuille clients H/F";
const BASE_CV = process.env.CV_STORAGE_PATH ?? "/var/data/cv";
const KEY_HEX = process.env.PII_ENCRYPTION_KEY?.trim();
if (!KEY_HEX || !/^[0-9a-fA-F]{64}$/.test(KEY_HEX)) {
  console.error("PII_ENCRYPTION_KEY absente : rien ne sera écrit en clair.");
  process.exit(2);
}

// Miroirs EXACTS de src/lib/pii-crypto.ts et src/lib/security/email-hash.ts.
function encryptPii(clair) {
  if (clair == null || clair === "") return clair;
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", Buffer.from(KEY_HEX, "hex"), iv);
  const ct = Buffer.concat([c.update(clair, "utf8"), c.final()]);
  return `enc:v1:${iv.toString("hex")}:${ct.toString("hex")}:${c.getAuthTag().toString("hex")}`;
}
function hashEmail(email) {
  const n = (email ?? "").trim().toLowerCase();
  if (!n) return null;
  return createHmac("sha256", KEY_HEX).update(`submission-email-index-v1:${n}`).digest("hex");
}
// Miroir de sanitizeCvFileName (src/server/careers/cv-storage.ts).
function nomSain(name) {
  const ext = extname(name).toLowerCase();
  const base =
    name
      .slice(0, name.length - ext.length)
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "cv";
  return `${base}${ext}`;
}
const MIME = { ".pdf": "application/pdf", ".doc": "application/msword" };

const prisma = new PrismaClient();
const manifeste = JSON.parse(await readFile(manifestPath, "utf8"));
const fiches = await prisma.submission.findMany({
  where: { details: { path: ["subType"], equals: "candidature-commerciale" } },
  select: { id: true, details: true, contactEmailHash: true, contactPhone: true },
});
const parId = new Map(fiches.map((f) => [f.id, f]));

let crees = 0;
let completees = 0;
let deja = 0;
for (const [i, e] of manifeste.entries()) {
  const cv = e.cv;
  const empreinte = hashEmail(cv.email);
  const ids = new Set();
  if (e.cible) {
    if (!parId.has(e.cible)) {
      console.log(`#${i} ERREUR fiche cible introuvable ${e.cible}`);
      continue;
    }
    ids.add(e.cible);
  }
  if (empreinte) for (const f of fiches) if (f.contactEmailHash === empreinte) ids.add(f.id);

  const octets = await readFile(join(dossierCv, e.fichier));
  const ext = extname(e.fichier).toLowerCase();
  const blocCv = (storagePath) => ({
    fichier: {
      storagePath,
      nomOriginal: nomSain(e.fichier),
      mimeType: MIME[ext] ?? null,
      tailleOctets: octets.byteLength,
    },
    extrait: {
      email: cv.email ?? null,
      telephone: cv.telephone ?? null,
      ville: cv.ville ?? null,
      pays: cv.pays ?? null,
      linkedin: cv.linkedin ?? null,
      titre: cv.titre ?? null,
      experienceCommercialeAnnees: cv.experienceCommercialeAnnees ?? null,
      experienceB2B: cv.experienceB2B ?? null,
      experiences: cv.experiences ?? [],
      formations: cv.formations ?? [],
      competences: cv.competences ?? [],
      langues: cv.langues ?? [],
      permis: cv.permis ?? null,
      vehicule: cv.vehicule ?? null,
    },
    analyse: cv.analyse,
    analyseLe: new Date().toISOString(),
  });
  const candidatureSalariee = { canal: "indeed", annonce: ANNONCE };
  const villeCv = [cv.ville, cv.codePostal ? `(${cv.codePostal})` : null].filter(Boolean).join(" ");

  async function stocker() {
    const dir = join(BASE_CV, randomUUID());
    await mkdir(dir, { recursive: true });
    const p = join(dir, nomSain(e.fichier));
    await writeFile(p, octets);
    return p;
  }

  if (ids.size === 0) {
    // Même garde d'idempotence qu'en mise à jour : une fiche déjà CRÉÉE par ce
    // script pour ce fichier ne se recrée pas.
    const existe = fiches.some((f) => f.details?.cv?.fichier?.nomOriginal === nomSain(e.fichier));
    if (existe) {
      console.log(`#${i} déjà créée — rien`);
      deja++;
      continue;
    }
    console.log(`#${i} CRÉER une fiche${empreinte ? "" : " (sans e-mail sur le CV)"}`);
    if (APPLY) {
      const storagePath = await stocker();
      const s = await prisma.submission.create({
        data: {
          type: "contact",
          locale: "fr",
          companyName: "—",
          contactName: encryptPii(`${cv.prenom} ${cv.nom}`.trim()),
          contactEmail: encryptPii(cv.email ?? ""),
          contactEmailHash: empreinte,
          contactPhone: encryptPii(cv.telephone ?? null) ?? null,
          details: {
            nom: cv.nom,
            prenom: cv.prenom,
            ville: villeCv || cv.pays || "",
            message: `Candidature reçue via l'annonce Indeed « ${ANNONCE} ». Fiche créée le ${new Date().toLocaleDateString("fr-FR")} à partir du CV — aucun e-mail n'a été envoyé.${cv.email ? "" : " Pas d'adresse e-mail sur le CV : la joindre par la messagerie Indeed."}`,
            subType: "candidature-commerciale",
            unifiedType: "recrutement",
            sourceConnaissance: "indeed",
            candidatureSalariee,
            cv: blocCv(storagePath),
          },
        },
        select: { id: true },
      });
      console.log(`#${i}   → créée ${s.id}`);
    }
    crees++;
    continue;
  }

  for (const id of ids) {
    const f = parId.get(id);
    if (f.details?.cv?.fichier?.nomOriginal === nomSain(e.fichier)) {
      console.log(`#${i} ${id} a déjà ce CV — rien`);
      deja++;
      continue;
    }
    const origine = id === e.cible ? "cible" : "même e-mail";
    console.log(
      `#${i} COMPLÉTER ${id} (${origine})${f.contactPhone ? "" : " + téléphone"}${f.details?.ville ? "" : " + ville"}`,
    );
    if (APPLY) {
      const storagePath = await stocker();
      const details = {
        ...f.details,
        ...(f.details?.ville || !villeCv ? {} : { ville: villeCv }),
        candidatureSalariee,
        cv: blocCv(storagePath),
      };
      await prisma.submission.update({
        where: { id },
        data: {
          details,
          ...(f.contactPhone || !cv.telephone ? {} : { contactPhone: encryptPii(cv.telephone) }),
        },
      });
    }
    completees++;
  }
}
console.log(
  `${APPLY ? "FAIT" : "SIMULATION"} : ${completees} fiche(s) complétée(s), ${crees} créée(s), ${deja} déjà à jour.`,
);
await prisma.$disconnect();
