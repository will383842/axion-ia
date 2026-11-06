#!/usr/bin/env tsx
/**
 * Verse dans R2 la preuve du devis historique signé via DocuSeal (PDF signé + journal d'audit)
 * et crée la ligne `document_signatures` provider='docuseal'.
 *
 *   tsx scripts/export-docuseal-devis-historique.ts            # DRY-RUN (défaut) : ne fait rien
 *   tsx scripts/export-docuseal-devis-historique.ts --apply    # écrit (explicite)
 *
 * Variables d'environnement requises : DOCUSEAL_BASE_URL, DOCUSEAL_API_KEY (+ DATABASE_URL et
 * les variables R2 du dépôt en --apply). Aucune valeur en dur. Aucune suppression nulle part.
 * Logique et tests : `src/server/qualiopi/documents/signature/export-docuseal-historique.ts`.
 */

import { prisma } from "../src/lib/prisma";
import { uploadToR2 } from "../src/lib/r2-storage";
import { signerDocument } from "../src/server/qualiopi/documents/signature/document-signature-service";
import { partiesRequisesPour } from "../src/server/qualiopi/documents/signature/parties-requises";
import {
  exporterDevisHistorique,
  type DependancesExport,
  type SoumissionDocuSeal,
} from "../src/server/qualiopi/documents/signature/export-docuseal-historique";

function env(nom: string): string {
  const v = process.env[nom];
  if (v === undefined || v.trim() === "")
    throw new Error(`Variable d'environnement absente : ${nom}`);
  return v.trim();
}

async function api<T>(chemin: string): Promise<T> {
  const base = env("DOCUSEAL_BASE_URL").replace(/\/+$/, "");
  const res = await fetch(`${base}${chemin}`, {
    headers: { "X-Auth-Token": env("DOCUSEAL_API_KEY") },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`DocuSeal ${chemin} → ${res.status}`);
  return (await res.json()) as T;
}

const deps: DependancesExport = {
  listerDevis: async () => {
    const rows = await prisma.devis.findMany({
      where: { docusealSubmissionId: { not: null } },
      select: {
        id: true,
        numero: true,
        docusealSubmissionId: true,
        documentGenereId: true,
        acceptedAt: true,
        createdAt: true,
        client: { select: { raisonSociale: true, contactEmail: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      numero: r.numero,
      docusealSubmissionId: r.docusealSubmissionId as string,
      documentGenereId: r.documentGenereId,
      clientNom: r.client.raisonSociale,
      clientEmail: r.client.contactEmail,
      acceptedAt: r.acceptedAt,
      createdAt: r.createdAt,
    }));
  },
  signatureDocusealExiste: async (documentGenereId) =>
    (await prisma.documentSignature.count({
      where: { documentGenereId, provider: "docuseal", revokedAt: null },
    })) > 0,
  lireSoumission: async (id): Promise<SoumissionDocuSeal> => {
    const d = await api<{
      completed_at: string | null;
      audit_log_url: string | null;
      documents: Array<{ url: string; checksum?: string }>;
    }>(`/api/submissions/${encodeURIComponent(id)}`);
    const doc = d.documents[0];
    if (doc === undefined) throw new Error("soumission sans document signé");
    return {
      pdfSigneUrl: doc.url,
      journalAuditUrl: d.audit_log_url,
      checksumPdf: doc.checksum ?? null,
      signeAt: d.completed_at !== null ? new Date(d.completed_at) : null,
    };
  },
  telecharger: async (url) => {
    // L'en-tête d'authentification ne part que vers l'instance DocuSeal elle-même.
    const base = new URL(env("DOCUSEAL_BASE_URL"));
    const cible = new URL(url, base);
    const headers: Record<string, string> =
      cible.origin === base.origin ? { "X-Auth-Token": env("DOCUSEAL_API_KEY") } : {};
    const res = await fetch(cible, { headers, signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`téléchargement → ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  },
  deposerR2: async (key, buffer, metadata) => {
    await uploadToR2(key, buffer, "application/pdf", metadata);
  },
  enregistrerSignature: async ({ devis, soumission }) => {
    const parties = partiesRequisesPour("devis");
    if (parties === null) throw new Error("circuit de signature du devis introuvable");
    const r = await signerDocument({
      documentGenereId: devis.documentGenereId as string,
      porteur: {
        type: "fournisseur",
        provider: "docuseal",
        submissionId: devis.docusealSubmissionId,
        partie: "client",
        signataire: { nom: devis.clientNom, email: devis.clientEmail },
      },
      methode: "confirmation_accessible",
      partiesRequises: parties,
      ...(soumission.signeAt !== null ? { maintenant: soumission.signeAt } : {}),
    });
    if (r.ok) return true;
    if (r.raison === "deja_signe") return false;
    throw new Error(`signerDocument refusé : ${r.raison}`);
  },
};

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  console.log(apply ? "MODE --apply : écriture réelle" : "MODE dry-run (défaut) : aucune écriture");
  const resultats = await exporterDevisHistorique(deps, { apply });
  for (const r of resultats) console.log(JSON.stringify(r));
  if (resultats.some((r) => r.etat === "erreur")) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
