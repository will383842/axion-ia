/**
 * Page de vérification publique d'un document Qualiopi.
 *
 * URL : /{locale}/verifier-attestation/{token}
 * Accès : public, server component, force-dynamic.
 *
 * Cherche le DocumentGenere par qrToken (unique). Affiche la validité du
 * document en lecture seule : type, numéro, date émission, session, stagiaire
 * (prénom + initiale nom uniquement pour préserver la vie privée).
 *
 * Stub-aware : si DATABASE_URL = stub.invalid → notFound() immédiat.
 * PAS de gate flag OF_PUBLIC_DISCLOSURE_ENABLED : la vérification doit
 * marcher même en phase A car le stagiaire a déjà reçu le document.
 * Aucune mention Qualiopi/financement marketing — uniquement validité doc.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/layout/Container";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ locale: string; token: string }>;
}

/** Labels FR pour les types de documents (pas d'interpolation marketing). */
const DOC_TYPE_LABELS: Record<string, string> = {
  convention: "Convention de formation",
  convention_tripartite: "Convention tripartite",
  convocation: "Convocation",
  emargement: "Feuille d'émargement",
  releve_connexion: "Relevé de connexion",
  positionnement: "Questionnaire de positionnement",
  grille_evaluation: "Grille d'évaluation",
  satisfaction: "Enquête de satisfaction",
  attestation: "Attestation de fin de formation",
  attestation_partielle: "Attestation de suivi partiel",
  certificat_realisation: "Certificat de réalisation",
  facture: "Facture",
  kit_opco: "Kit OPCO",
  kit_cpf: "Kit CPF",
  kit_france_travail: "Kit France Travail",
  lettre_mission: "Lettre de mission",
  reglement_interieur: "Règlement intérieur",
  livret_accueil: "Livret d'accueil",
};

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
}

/** Masque le nom : "Dupont" → "D." */
function initialeNom(nom: string | null | undefined): string {
  if (!nom) return "";
  return `${nom.charAt(0).toUpperCase()}.`;
}

export default async function VerifierAttestationPage({ params }: Props) {
  const { token } = await params;

  // Stub-aware early-exit.
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    notFound();
  }

  // Rate-limit léger best-effort (header CF-Connecting-IP non disponible côté
  // Server Component sans next/headers — acceptable ici car token est un secret
  // non-guessable 64 hex : brute-force est computationnellement irréaliste).

  // Recherche par token unique.
  const doc = await prisma.documentGenere.findUnique({
    where: { qrToken: token },
    select: {
      id: true,
      type: true,
      numero: true,
      estCopie: true,
      createdAt: true,
      session: {
        select: {
          id: true,
          titreSession: true,
          dateDebut: true,
        },
      },
      trainee: {
        select: {
          prenom: true,
          nom: true,
        },
      },
    },
  });

  if (!doc) {
    notFound();
  }

  const typeLabel = DOC_TYPE_LABELS[doc.type] ?? doc.type;

  return (
    <Container>
      <div className="mx-auto max-w-xl px-4 py-16">
        {/* Bandeau validité */}
        <div className="mb-8 rounded-lg border border-green-200 bg-green-50 px-6 py-4">
          <p className="text-sm font-semibold text-green-800">Document authentique vérifié</p>
          <p className="mt-1 text-xs text-green-700">
            Ce document a bien été émis par notre organisme de formation.
          </p>
        </div>

        {/* Détails document */}
        <h1 className="mb-6 text-xl font-bold text-gray-900">Vérification de document</h1>

        <dl className="divide-y divide-gray-100 rounded-lg border border-gray-200">
          <div className="flex px-4 py-3">
            <dt className="w-44 shrink-0 text-sm font-medium text-gray-500">Type</dt>
            <dd className="text-sm text-gray-900">{typeLabel}</dd>
          </div>

          <div className="flex px-4 py-3">
            <dt className="w-44 shrink-0 text-sm font-medium text-gray-500">Numéro</dt>
            <dd className="font-mono text-sm text-gray-900">{doc.numero}</dd>
          </div>

          <div className="flex px-4 py-3">
            <dt className="w-44 shrink-0 text-sm font-medium text-gray-500">
              Date d&apos;émission
            </dt>
            <dd className="text-sm text-gray-900">{formatDate(doc.createdAt)}</dd>
          </div>

          {doc.estCopie && (
            <div className="flex px-4 py-3">
              <dt className="w-44 shrink-0 text-sm font-medium text-gray-500">Statut</dt>
              <dd className="text-sm text-amber-700">Copie</dd>
            </div>
          )}

          {doc.session && (
            <div className="flex px-4 py-3">
              <dt className="w-44 shrink-0 text-sm font-medium text-gray-500">Formation</dt>
              <dd className="text-sm text-gray-900">
                {doc.session.titreSession ?? "—"}
                {doc.session.dateDebut && (
                  <span className="ml-2 text-gray-500">({formatDate(doc.session.dateDebut)})</span>
                )}
              </dd>
            </div>
          )}

          {doc.trainee && (
            <div className="flex px-4 py-3">
              <dt className="w-44 shrink-0 text-sm font-medium text-gray-500">Stagiaire</dt>
              <dd className="text-sm text-gray-900">
                {doc.trainee.prenom} {initialeNom(doc.trainee.nom)}
              </dd>
            </div>
          )}
        </dl>

        <p className="mt-6 text-xs text-gray-400">
          Cette page de vérification confirme l&apos;authenticité du document. Pour toute question,
          contactez directement l&apos;organisme de formation.
        </p>
      </div>
    </Container>
  );
}
