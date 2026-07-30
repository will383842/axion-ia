/**
 * RGPD — retrouver toutes les données d'une personne à partir de son email.
 *
 * POURQUOI CE SCRIPT EXISTE
 *
 * Les emails sont chiffrés en base (`encryptPii`, AES-256-GCM avec IV aléatoire).
 * Deux chiffrements du MÊME email donnent deux valeurs différentes : un
 * `WHERE email = '…'` ne peut donc rien trouver, et `pii-crypto.ts` le dit en
 * toutes lettres — « lookups exact-match par champ chiffré IMPOSSIBLES ».
 *
 * Sans outil, une demande d'accès ou d'effacement (RGPD art. 15 et 17) est
 * ininstruisable : on sait que la personne existe, on ne sait pas où.
 *
 * CE QUE FAIT CE SCRIPT, ET CE QU'IL NE FAIT PAS
 *
 * Il lit les tables concernées, DÉCHIFFRE en mémoire et compare. C'est un
 * balayage complet — acceptable aux volumes actuels (quelques dizaines de
 * lignes), pas au-delà. La solution durable est un `emailHash` (SHA-256 + sel)
 * écrit à côté du champ chiffré, que `pii-crypto.ts` annonce déjà comme « V1.5,
 * non livré » ; elle exige une colonne, une migration et un backfill sur des
 * données personnelles en production — donc une décision, pas un script.
 *
 * Il est en LECTURE SEULE. Il n'efface rien : l'effacement se décide au vu de
 * ce qu'il rend, et se fait ensuite pièce par pièce, avec les rétentions
 * légales en tête (une facture se conserve 10 ans, art. L123-22 C. com., même
 * après une demande d'effacement).
 *
 * ⚠️ Sa sortie contient des données personnelles en clair. Ne pas la rediriger
 * vers un fichier qui traînerait, ne pas la coller dans un ticket.
 *
 * Usage :
 *   pnpm tsx scripts/rgpd-rechercher-personne.ts jean.dupont@example.com
 */

import { PrismaClient } from "../prisma/generated/client";
import { decryptPii } from "../src/lib/pii-crypto";

const prisma = new PrismaClient();

/** Comparaison d'emails : insensible à la casse et aux espaces de bord. */
function memeEmail(chiffre: string | null, recherche: string): boolean {
  if (chiffre === null) return false;
  const clair = decryptPii(chiffre);
  if (typeof clair !== "string") return false;
  return clair.trim().toLowerCase() === recherche;
}

interface Trouvaille {
  readonly table: string;
  readonly id: string;
  readonly cree: string;
  readonly apercu: string;
}

async function main(): Promise<void> {
  const argument = process.argv[2];
  if (!argument || !argument.includes("@")) {
    console.error("Usage : pnpm tsx scripts/rgpd-rechercher-personne.ts <email>");
    process.exit(1);
  }
  const recherche = argument.trim().toLowerCase();
  const trouvailles: Trouvaille[] = [];

  // ── Soumissions du formulaire de contact unifié ────────────────────────────
  const soumissions = await prisma.submission.findMany({
    select: { id: true, contactEmail: true, contactName: true, submittedAt: true, type: true },
  });
  for (const s of soumissions) {
    if (memeEmail(s.contactEmail, recherche)) {
      trouvailles.push({
        table: "submissions",
        id: s.id,
        cree: s.submittedAt.toISOString().slice(0, 10),
        apercu: `${decryptPii(s.contactName) ?? "—"} · ${s.type}`,
      });
    }
  }

  // ── Candidatures ──────────────────────────────────────────────────────────
  const candidatures = await prisma.jobApplication.findMany({
    select: { id: true, email: true, firstName: true, lastName: true, submittedAt: true },
  });
  for (const c of candidatures) {
    if (memeEmail(c.email, recherche)) {
      trouvailles.push({
        table: "job_applications",
        id: c.id,
        cree: c.submittedAt.toISOString().slice(0, 10),
        apercu: `${decryptPii(c.firstName) ?? ""} ${decryptPii(c.lastName) ?? ""}`.trim(),
      });
    }
  }

  // ── Demandes podcast ──────────────────────────────────────────────────────
  const podcasts = await prisma.podcastRequest.findMany({
    select: { id: true, email: true, leaderName: true, createdAt: true },
  });
  for (const p of podcasts) {
    if (memeEmail(p.email, recherche)) {
      trouvailles.push({
        table: "podcast_requests",
        id: p.id,
        cree: p.createdAt.toISOString().slice(0, 10),
        apercu: decryptPii(p.leaderName) ?? "—",
      });
    }
  }

  // ── Stagiaires — email NON chiffré, mais on le cherche aussi : une demande
  //    RGPD ne distingue pas les tables, et l'oublier donnerait une réponse
  //    incomplète, ce qui est précisément ce que l'article 15 sanctionne.
  const stagiaires = await prisma.trainee.findMany({
    where: { email: { equals: recherche, mode: "insensitive" } },
    select: { id: true, nom: true, prenom: true, createdAt: true, deletedAt: true },
  });
  for (const t of stagiaires) {
    trouvailles.push({
      table: "trainees",
      id: t.id,
      cree: t.createdAt.toISOString().slice(0, 10),
      apercu: `${t.prenom} ${t.nom}${t.deletedAt ? " (supprimé logiquement)" : ""}`,
    });
  }

  // ── Restitution ───────────────────────────────────────────────────────────
  console.log(`\nRecherche : ${recherche}`);
  console.log(
    `Balayé : ${soumissions.length} soumissions, ${candidatures.length} candidatures, ` +
      `${podcasts.length} demandes podcast, + les stagiaires.\n`,
  );

  if (trouvailles.length === 0) {
    console.log("Aucune donnée trouvée pour cette adresse.");
    console.log(
      "⚠️ Absence de résultat ≠ absence de données : ce script ne couvre que les\n" +
        "   tables à email chiffré recensées ci-dessus. Vérifier aussi les pièces\n" +
        "   nominatives (documents générés, émargements) par le nom.",
    );
  } else {
    for (const t of trouvailles) {
      console.log(`  ${t.table.padEnd(20)} ${t.cree}  ${t.id}  ${t.apercu}`);
    }
    console.log(`\n${trouvailles.length} enregistrement(s).`);
    console.log(
      "\nAvant tout effacement : une facture se conserve 10 ans (art. L123-22 C. com.)\n" +
        "et une pièce Qualiopi 3 ans après la fin de l'action. L'effacement RGPD ne\n" +
        "prime pas sur une obligation légale de conservation — il faut alors répondre\n" +
        "en le motivant, pas supprimer.",
    );
  }

  await prisma.$disconnect();
}

void main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
