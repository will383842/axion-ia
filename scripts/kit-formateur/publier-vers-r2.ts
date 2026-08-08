/**
 * PUBLICATION DES KITS FORMATEUR — du dossier `_KIT/` vers R2 et la base.
 *
 * ## Pourquoi ce script existe
 *
 * Les 22 classeurs sont fabriqués hors ligne (`build-kits.ts` puis Chrome pour
 * le PDF) et vivent dans le dépôt. Un formateur n'a pas accès au dépôt — et il
 * ne doit pas l'avoir. Ce script fait le pont : il dépose chaque PDF sur R2 et
 * l'enregistre comme `SupportFormation` de type `kit_formateur_imprime`,
 * rattaché à sa formation par le slug. L'espace formateur le sert ensuite.
 *
 * ## Ce qu'il ne fait pas
 *
 * Il ne stocke JAMAIS d'URL signée. `SupportFormation.pdfUrl` reste vide :
 * une URL R2 signée expire en 900 secondes, et une URL figée en base est un
 * lien mort quinze minutes plus tard. Seule la CLÉ est persistée ; la route
 * `/api/espace-formateur/kit/[sessionId]` re-signe à chaque demande.
 *
 * ## Idempotence
 *
 * Rejouer le script sur un PDF inchangé ne fait rien (le hash SHA-256 est
 * comparé). Un PDF modifié incrémente la version et remplace la clé — l'ancien
 * objet R2 est laissé en place, c'est une trace, pas un déchet.
 *
 * Usage :
 *   pnpm tsx scripts/kit-formateur/publier-vers-r2.ts            # les 22
 *   pnpm tsx scripts/kit-formateur/publier-vers-r2.ts ia-pour-les-rh
 *   pnpm tsx scripts/kit-formateur/publier-vers-r2.ts --dry-run  # sans écrire
 *
 * Requiert `DATABASE_URL` et les variables R2. À lancer depuis le conteneur
 * worker de production, ou en local avec un tunnel.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { prisma } from "@/lib/prisma";
import { isR2Configured, uploadToR2 } from "@/lib/r2-storage";

const RACINE_KIT = "_KIT";
const TYPE_SUPPORT = "kit_formateur_imprime" as const;

interface Resultat {
  slug: string;
  etat: "publie" | "inchange" | "sans-formation" | "sans-pdf";
  version?: number;
}

/**
 * Clé R2 du kit — versionnée.
 *
 * La version est DANS la clé : republier n'écrase pas l'objet précédent. Un
 * formateur qui a gardé un onglet ouvert ne voit pas son lien se transformer en
 * autre chose sous lui, et l'ancienne version reste téléchargeable le temps
 * qu'un classeur déjà imprimé finisse sa vie.
 */
function cleKit(slug: string, version: number): string {
  return `kits-formateur/${slug}/v${version}/kit-formateur.pdf`;
}

async function publierUn(slug: string, sec: boolean): Promise<Resultat> {
  const chemin = join(RACINE_KIT, slug, "kit-formateur.pdf");
  if (!existsSync(chemin)) return { slug, etat: "sans-pdf" };

  const formation = await prisma.formation.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!formation) return { slug, etat: "sans-formation" };

  const pdf = readFileSync(chemin);
  const hash = createHash("sha256").update(pdf).digest("hex");

  const existant = await prisma.supportFormation.findFirst({
    where: { formationId: formation.id, type: TYPE_SUPPORT },
    select: { id: true, version: true, hashSha256: true },
  });

  if (existant && existant.hashSha256 === hash) {
    return { slug, etat: "inchange", version: existant.version };
  }

  const version = (existant?.version ?? 0) + 1;
  const cle = cleKit(slug, version);

  if (sec) return { slug, etat: "publie", version };

  await uploadToR2(cle, pdf, "application/pdf");

  const donnees = {
    type: TYPE_SUPPORT,
    titre: `Kit formateur imprimé — ${slug}`,
    // Le kit n'est pas produit par le Formation Engine : pas de contenu
    // structuré à stocker. Le PDF EST le livrable.
    contenu: {},
    pdfKey: cle,
    // ❌ Jamais d'URL signée en base : elle expire en 900 s. La route re-signe.
    pdfUrl: null,
    hashSha256: hash,
    sizeBytes: pdf.byteLength,
    version,
    aiGenerated: false,
    statut: "genere" as const,
    generatedAt: new Date(),
  };

  if (existant) {
    await prisma.supportFormation.update({ where: { id: existant.id }, data: donnees });
  } else {
    await prisma.supportFormation.create({
      data: { ...donnees, formationId: formation.id },
    });
  }

  return { slug, etat: "publie", version };
}

/**
 * Refuse de démarrer sans une VRAIE base.
 *
 * Sans ce contrôle, l'absence de `DATABASE_URL` produit une trace Prisma de
 * quarante lignes, et une URL stub (`stub.invalid`, injectée aux builds GitHub
 * Actions) est pire encore : le Proxy stub répond `null` à tout, donc le script
 * annoncerait sereinement « 22 formations absentes de la base » alors que la
 * base n'a jamais été interrogée.
 */
function baseInutilisable(): string | null {
  const url = process.env.DATABASE_URL;
  if (!url) return "DATABASE_URL n'est pas défini.";
  if (url.includes("stub.invalid")) {
    return "DATABASE_URL pointe sur le stub de build — aucune requête n'atteindrait la base.";
  }
  return null;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const sec = args.includes("--dry-run");
  const demandes = args.filter((a) => !a.startsWith("--"));

  const souci = baseInutilisable();
  if (souci !== null) {
    console.error(`⛔ ${souci}`);
    console.error("   À lancer depuis le conteneur worker de production, ou avec un tunnel.");
    process.exitCode = 1;
    return;
  }

  if (!sec && !isR2Configured()) {
    console.error("⛔ R2 n'est pas configuré — aucun kit ne peut être publié.");
    process.exitCode = 1;
    return;
  }

  const slugs =
    demandes.length > 0
      ? demandes
      : readdirSync(RACINE_KIT, { withFileTypes: true })
          .filter((e) => e.isDirectory())
          .map((e) => e.name)
          .sort();

  const resultats: Resultat[] = [];
  for (const slug of slugs) {
    resultats.push(await publierUn(slug, sec));
  }

  const par = (e: Resultat["etat"]): Resultat[] => resultats.filter((r) => r.etat === e);

  for (const r of par("publie")) console.log(`  ✅ ${r.slug} — v${r.version}`);
  for (const r of par("inchange")) console.log(`  ·  ${r.slug} — inchangé (v${r.version})`);
  for (const r of par("sans-formation")) console.log(`  ⚠️  ${r.slug} — absent de la base`);
  for (const r of par("sans-pdf")) console.log(`  ⚠️  ${r.slug} — pas de PDF`);

  console.log(
    `\n${par("publie").length} publiés, ${par("inchange").length} inchangés, ` +
      `${par("sans-formation").length + par("sans-pdf").length} ignorés${sec ? " (à sec)" : ""}.`,
  );

  // Un slug de kit sans formation en base est une VRAIE anomalie : soit le
  // catalogue n'a pas été importé, soit un dossier `_KIT/` porte un nom qui ne
  // correspond à rien. Le signaler par le code de sortie, sinon la commande
  // « réussit » en n'ayant rien publié.
  if (par("sans-formation").length > 0 || par("sans-pdf").length > 0) process.exitCode = 1;
}

main()
  .catch((err: unknown) => {
    console.error("⛔ publication interrompue :", err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
