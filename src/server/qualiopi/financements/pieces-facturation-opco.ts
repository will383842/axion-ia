/**
 * Qualiopi — les PIÈCES qui accompagnent une facture de formation financée par
 * un OPCO (lot A8c), dans chacun des deux circuits (`circuit-paiement-opco.ts`) :
 *
 * | Circuit         | Qui les présente à l'OPCO | Pièces                                                      |
 * | --------------- | ------------------------- | ----------------------------------------------------------- |
 * | `subrogation`   | l'organisme               | facture + certificat de réalisation + émargement / relevé   |
 * | `remboursement` | l'entreprise              | facture acquittée + certificat de réalisation (+ présences) |
 *
 * La sélection est PURE ; le ZIP reçoit son lecteur de stockage par injection
 * (même doctrine que `dossier-pret-a-deposer-zip.ts`). Une pièce absente du
 * registre ou du stockage n'est jamais simulée : elle est NOMMÉE.
 *
 * 🔑 La feuille d'émargement jointe est le TIRAGE À JOUR
 * (`rendreTirageEmargementAJour`), jamais la pièce scellée du registre : émise
 * avant la session, celle-ci ne porte aucune signature.
 */

import JSZip from "jszip";
import { documentPdfKey, getObjectBufferR2 } from "@/lib/r2-storage";
import { nomFichierArchive, nomFichierDocument } from "@/server/qualiopi/documents/nom-fichier";
import type { DocumentType } from "../../../../prisma/generated/client";
import type { CircuitPaiementOpco } from "./circuit-paiement-opco";

export interface DocumentJustificatif {
  id: string;
  type: DocumentType;
  numero: string;
  createdAt: Date;
  annuleeAt: Date | null;
  traineeId: string | null;
}

export interface Justificatifs {
  certificats: DocumentJustificatif[];
  releves: DocumentJustificatif[];
  /** Libellés des pièces attendues et absentes du registre. */
  manquantes: string[];
}

/** Types du registre lus pour la facturation. */
export const TYPES_JUSTIFICATIFS: readonly DocumentType[] = [
  "certificat_realisation",
  "releve_connexion",
];

/**
 * Les justificatifs du registre qui font foi : non annulés, et pour les
 * certificats le PLUS RÉCENT de chaque stagiaire (une régénération remplace,
 * elle ne s'ajoute pas).
 */
export function selectionnerJustificatifs(
  documents: ReadonlyArray<DocumentJustificatif>,
): Justificatifs {
  const vivants = documents.filter((d) => d.annuleeAt === null);
  const parStagiaire = new Map<string, DocumentJustificatif>();
  for (const d of vivants.filter((x) => x.type === "certificat_realisation")) {
    const cle = d.traineeId ?? `sans-stagiaire:${d.id}`;
    const deja = parStagiaire.get(cle);
    if (deja === undefined || d.createdAt.getTime() > deja.createdAt.getTime()) {
      parStagiaire.set(cle, d);
    }
  }
  const certificats = [...parStagiaire.values()].sort((a, b) => a.numero.localeCompare(b.numero));
  const releves = vivants
    .filter((d) => d.type === "releve_connexion")
    .sort((a, b) => a.numero.localeCompare(b.numero));
  return {
    certificats,
    releves,
    manquantes: certificats.length === 0 ? ["Certificat de réalisation"] : [],
  };
}

/** Ce que l'e-mail de remboursement annonce : exactement ce qui est joint. */
export function libellesPiecesTransmises(p: {
  factureNumero: string;
  certificats: number;
  releves: number;
}): string[] {
  const libelles = [`Facture ${p.factureNumero} (acquittée)`];
  if (p.certificats === 1) libelles.push("Certificat de réalisation");
  if (p.certificats > 1) libelles.push(`Certificats de réalisation (${p.certificats})`);
  if (p.releves === 1) libelles.push("Relevé de connexion");
  if (p.releves > 1) libelles.push(`Relevés de connexion (${p.releves})`);
  return libelles;
}

export type LecteurPdf = (cle: string) => Promise<Buffer | Uint8Array | null>;

export interface EntreePaquet {
  circuit: Exclude<CircuitPaiementOpco, "hors_opco">;
  facture: {
    numero: string;
    document: { type: DocumentType; numero: string; createdAt: Date };
    destinataireNom: string;
    numeroDossierOpco: string | null;
  };
  numeroSession: string;
  /** Raison sociale du client (nommage des fichiers). */
  contexte: string | null;
  justificatifs: Justificatifs;
  /** Tirage à jour de la feuille d'émargement, `null` s'il n'a pas pu être produit. */
  emargement: { buffer: Buffer | Uint8Array; mention: string } | null;
}

export interface PaquetFacturation {
  base64: string;
  filename: string;
  joints: string[];
  manquantes: string[];
}

export async function construirePaquetFacturation(
  e: EntreePaquet,
  lire: LecteurPdf = getObjectBufferR2,
): Promise<PaquetFacturation> {
  const zip = new JSZip();
  const contexte = e.contexte;
  const lignes: string[] = [];
  const joints: string[] = [];
  const manquantes: string[] = [...e.justificatifs.manquantes];

  const facturePdf = await lire(documentPdfKey(e.facture.document));
  if (facturePdf === null) {
    throw new Error(`Le PDF de la facture ${e.facture.numero} est introuvable au stockage.`);
  }
  const nomFacture = nomFichierDocument({
    type: e.facture.document.type,
    numero: e.facture.numero,
    contexte,
  });
  zip.file(nomFacture, facturePdf);
  joints.push(e.facture.numero);
  lignes.push(`  [JOINTE]    Facture — ${nomFacture}`);

  for (const d of [...e.justificatifs.certificats, ...e.justificatifs.releves]) {
    const libelle =
      d.type === "certificat_realisation" ? "Certificat de réalisation" : "Relevé de connexion";
    const pdf = await lire(documentPdfKey(d));
    if (pdf === null) {
      manquantes.push(`${libelle} ${d.numero}`);
      lignes.push(`  [MANQUANTE] ${libelle} ${d.numero} — PDF introuvable au stockage`);
      continue;
    }
    const nom = nomFichierDocument({
      type: d.type,
      numero: d.numero,
      contexte,
    });
    zip.file(nom, pdf);
    joints.push(d.numero);
    lignes.push(`  [JOINTE]    ${libelle} — ${nom}`);
  }
  for (const m of e.justificatifs.manquantes) {
    lignes.push(`  [MANQUANTE] ${m} — aucune pièce en vigueur au registre`);
  }

  if (e.emargement !== null) {
    const nom = `Feuille-emargement-a-jour-${e.numeroSession}.pdf`;
    zip.file(nom, e.emargement.buffer);
    lignes.push(`  [JOINTE]    Feuille d'émargement — ${nom} (${e.emargement.mention})`);
  } else if (e.justificatifs.releves.length === 0) {
    manquantes.push("Feuille d'émargement");
    lignes.push("  [MANQUANTE] Feuille d'émargement — tirage à jour impossible à produire");
  }

  const entete =
    e.circuit === "subrogation"
      ? [
          `Facturation en subrogation — à déposer par l'organisme chez ${e.facture.destinataireNom}`,
          `  N° de dossier OPCO : ${e.facture.numeroDossierOpco ?? "à renseigner"}`,
        ]
      : [
          `Circuit remboursement — pièces que l'entreprise présente à son OPCO`,
          "  L'entreprise a réglé la facture ; l'OPCO la rembourse sur présentation de ces pièces.",
        ];

  zip.file(
    "LISEZMOI.txt",
    [
      `Pièces de facturation — facture ${e.facture.numero}, session ${e.numeroSession}`,
      ...entete,
      "",
      "Pièces :",
      ...lignes,
      "",
      manquantes.length > 0
        ? `Pièces manquantes : ${manquantes.join(", ")}`
        : "Toutes les pièces sont jointes.",
    ].join("\n"),
  );

  return {
    base64: await zip.generateAsync({ type: "base64", compression: "DEFLATE" }),
    filename: nomFichierArchive({
      libelle: e.circuit === "subrogation" ? "Facturation OPCO" : "Pieces remboursement OPCO",
      contexte,
      numero: e.facture.numero,
    }),
    joints,
    manquantes,
  };
}
