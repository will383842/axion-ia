/**
 * Archive immuable de chaque version des CGV (preuve d'acceptation, P2).
 *
 * `assurerArchiveCgvCourante()` est IDEMPOTENTE :
 *   · ligne présente → vérifie que le texte en mémoire a la même empreinte que l'archive ;
 *     sinon `CgvArchiveIncoherente` (le texte a changé sans changer `CGV_VERSION`) ;
 *   · ligne absente → rend le PDF UNE fois, le dépose dans R2 sous une clé tirée de son
 *     empreinte (`legal/cgv/<version>/<sha256>.pdf`, jamais écrasable par un autre contenu),
 *     insère sans écraser (`ON CONFLICT DO NOTHING`), puis RELIT la ligne : si deux
 *     conteneurs archivent ensemble, le premier gagne et le second utilise ses octets.
 *
 * Le PDF `@react-pdf` n'est pas reproductible (date de création) : aucune empreinte de PDF
 * n'est opposable tant qu'il n'est pas figé. Les octets servis sont toujours revérifiés.
 * Un objet R2 orphelin (perdant d'une course) n'est jamais supprimé.
 */
import "server-only";

import { CGV_VERSION, CGV_VERSION_LIBELLE } from "@/content/cgv-version";
import { empreinteTexteCgv, sha256Hex, texteCanoniqueCgv } from "@/content/cgv-empreinte";
import { prisma } from "@/lib/prisma";
import { getObjectBufferR2, isR2Configured, uploadToR2 } from "@/lib/r2-storage";
import { rendreCgvPdf } from "@/server/cgv-pdf";

export interface ArchiveCgv {
  version: string;
  libelle: string;
  texteSha256: string;
  pdfR2Key: string;
  pdfSha256: string;
  pdfTaille: number;
  archiveeAt: Date;
}

export class CgvArchiveIncoherente extends Error {
  constructor(version: string) {
    super(
      `cgv_archive_incoherente : le texte des CGV ${version} a changé sans changement de version`,
    );
    this.name = "CgvArchiveIncoherente";
  }
}

export class CgvArchiveIndisponible extends Error {
  constructor(motif: string) {
    super(`cgv_archive_indisponible : ${motif}`);
    this.name = "CgvArchiveIndisponible";
  }
}

export class CgvArchiveAltere extends Error {
  constructor(version: string, motif: string) {
    super(`cgv_archive_altere : PDF archivé ${version} (${motif})`);
    this.name = "CgvArchiveAltere";
  }
}

const SELECTION = {
  version: true,
  libelle: true,
  texteSha256: true,
  pdfR2Key: true,
  pdfSha256: true,
  pdfTaille: true,
  archiveeAt: true,
} as const;

async function lireLigne(version: string): Promise<ArchiveCgv | null> {
  return prisma.cgvArchive.findUnique({ where: { version }, select: SELECTION });
}

export async function assurerArchiveCgvCourante(): Promise<ArchiveCgv> {
  const empreinte = empreinteTexteCgv();
  const existante = await lireLigne(CGV_VERSION);
  if (existante !== null) {
    if (existante.texteSha256 !== empreinte) throw new CgvArchiveIncoherente(CGV_VERSION);
    return existante;
  }

  if (!isR2Configured()) throw new CgvArchiveIndisponible("stockage R2 non configuré");
  const pdf = await rendreCgvPdf();
  const pdfSha256 = sha256Hex(pdf);
  const cle = `legal/cgv/${CGV_VERSION}/${pdfSha256}.pdf`;
  await uploadToR2(cle, pdf, "application/pdf");

  await prisma.cgvArchive.createMany({
    data: [
      {
        version: CGV_VERSION,
        libelle: CGV_VERSION_LIBELLE,
        texteCanonique: texteCanoniqueCgv(),
        texteSha256: empreinte,
        pdfR2Key: cle,
        pdfSha256,
        pdfTaille: pdf.length,
      },
    ],
    skipDuplicates: true,
  });

  const relue = await lireLigne(CGV_VERSION);
  if (relue === null) throw new CgvArchiveIndisponible("ligne introuvable après insertion");
  if (relue.texteSha256 !== empreinte) throw new CgvArchiveIncoherente(CGV_VERSION);
  return relue;
}

/** Octets archivés, revérifiés (SHA-256 + taille). Altérés ou absents : jamais servis. */
export async function lireOctetsArchives(
  archive: Pick<ArchiveCgv, "version" | "pdfR2Key" | "pdfSha256" | "pdfTaille">,
): Promise<Buffer> {
  const octets = await getObjectBufferR2(archive.pdfR2Key);
  if (octets === null) throw new CgvArchiveAltere(archive.version, "objet introuvable");
  if (octets.length !== archive.pdfTaille || sha256Hex(octets) !== archive.pdfSha256) {
    throw new CgvArchiveAltere(archive.version, "empreinte différente");
  }
  return octets;
}
