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
 * 🔴 2026-08-15 — la mention d'ANNULATION avait été perdue entre le registre
 * admin et cette page : le `select` ne demandait ni `annuleeAt`, ni
 * `annuleeMotif`, ni `remplaceeParNumero`, et le bandeau « Document
 * authentique » était inconditionnel. Une attestation annulée par l'organisme
 * lui-même obtenait donc, sur le site de l'organisme, exactement le même feu
 * vert qu'une pièce valable — un financeur ou un auditeur qui scanne le QR
 * d'une pièce périmée était trompé. Trois états sont désormais rendus :
 * annulé (rouge) > remplacé (ambre) > authentique (vert).
 *
 * Le token d'une pièce annulée est CONSERVÉ, volontairement : un 404 sur un QR
 * déjà imprimé ferait croire à un faux document, alors qu'un bandeau
 * « annulé, remplacé par X » renseigne le porteur et le renvoie vers la pièce
 * qui fait foi. Toute régression est gardée par `__tests__/page.test.tsx`.
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

/**
 * Validité opposable de la pièce, dans l'ordre de gravité.
 *
 * `annule` prime sur `remplace` : une pièce annulée ET remplacée ne fait plus
 * foi du tout, le remplacement n'est alors qu'une information de renvoi.
 */
type StatutVerification = "annule" | "remplace" | "valide";

function resolveStatut(doc: {
  annuleeAt: Date | null;
  remplaceeParNumero: string | null;
}): StatutVerification {
  if (doc.annuleeAt !== null) return "annule";
  if (doc.remplaceeParNumero !== null && doc.remplaceeParNumero.trim() !== "") {
    return "remplace";
  }
  return "valide";
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
      // 🔴 NE PAS RETIRER — sans ces trois colonnes la page ne peut pas savoir
      // qu'une pièce a cessé de faire foi, et rend un feu vert mensonger.
      annuleeAt: true,
      annuleeMotif: true,
      remplaceeParNumero: true,
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
  const statut = resolveStatut(doc);

  // Mentions de statut cumulables affichées dans le tableau : « Copie » n'est
  // pas exclusif d'une annulation, une copie d'une pièce annulée reste une
  // copie d'une pièce annulée.
  const mentionsStatut: string[] = [];
  if (statut === "annule") mentionsStatut.push("Annulé");
  if (doc.remplaceeParNumero !== null && doc.remplaceeParNumero.trim() !== "") {
    mentionsStatut.push(`Remplacé par ${doc.remplaceeParNumero}`);
  }
  if (doc.estCopie) mentionsStatut.push("Copie");

  return (
    <Container>
      <div className="mx-auto max-w-xl px-4 py-16">
        {/* Bandeau validité — trois états, jamais inconditionnel. */}
        {statut === "annule" && (
          <div role="alert" className="mb-8 rounded-lg border-2 border-red-300 bg-red-50 px-6 py-4">
            <p className="text-sm font-bold tracking-wide text-red-900 uppercase">
              Document annulé — ne fait plus foi
            </p>
            <p className="mt-2 text-xs text-red-800">
              Ce document a bien été émis par notre organisme de formation, mais il a été annulé
              {doc.annuleeAt ? ` le ${formatDate(doc.annuleeAt)}` : ""}. Il ne peut plus être
              produit comme justificatif, ni auprès d&apos;un financeur, ni auprès d&apos;un
              auditeur.
            </p>
            {doc.annuleeMotif !== null && doc.annuleeMotif.trim() !== "" && (
              <p className="mt-2 text-xs text-red-800">
                <span className="font-semibold">Motif de l&apos;annulation :</span>{" "}
                {doc.annuleeMotif}
              </p>
            )}
            {doc.remplaceeParNumero !== null && doc.remplaceeParNumero.trim() !== "" && (
              <p className="mt-2 text-xs text-red-800">
                Document qui fait foi désormais :{" "}
                <span className="font-mono font-semibold">{doc.remplaceeParNumero}</span>.
              </p>
            )}
          </div>
        )}

        {statut === "remplace" && (
          <div
            role="status"
            className="mb-8 rounded-lg border-2 border-amber-300 bg-amber-50 px-6 py-4"
          >
            <p className="text-sm font-bold tracking-wide text-amber-900 uppercase">
              Document remplacé par {doc.remplaceeParNumero} — cette version n&apos;est plus en
              vigueur
            </p>
            <p className="mt-2 text-xs text-amber-900">
              Ce document a bien été émis par notre organisme de formation, mais une version
              rectifiée lui a succédé. Demandez le document{" "}
              <span className="font-mono font-semibold">{doc.remplaceeParNumero}</span> à son
              porteur : c&apos;est celui-là qui fait foi.
            </p>
          </div>
        )}

        {statut === "valide" && (
          <div
            role="status"
            className="mb-8 rounded-lg border border-green-200 bg-green-50 px-6 py-4"
          >
            <p className="text-sm font-semibold text-green-800">Document authentique</p>
            <p className="mt-1 text-xs text-green-700">
              Ce document a bien été émis par notre organisme de formation, et il est toujours en
              vigueur à ce jour.
            </p>
          </div>
        )}

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

          {mentionsStatut.length > 0 && (
            <div className="flex px-4 py-3">
              <dt className="w-44 shrink-0 text-sm font-medium text-gray-500">Statut</dt>
              <dd
                className={
                  statut === "annule"
                    ? "text-sm font-semibold text-red-800"
                    : "text-sm text-amber-800"
                }
              >
                {mentionsStatut.join(" · ")}
              </dd>
            </div>
          )}

          {statut === "annule" && doc.annuleeAt !== null && (
            <div className="flex px-4 py-3">
              <dt className="w-44 shrink-0 text-sm font-medium text-gray-500">
                Date d&apos;annulation
              </dt>
              <dd className="text-sm text-red-800">{formatDate(doc.annuleeAt)}</dd>
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

        {/* Cette phrase de bas de page affirmait l'authenticité quel que soit
            le statut : elle devenait mensongère dès qu'un bandeau rouge ou
            ambre la surplombait. Elle suit désormais l'état réel de la pièce. */}
        <p className="mt-6 text-xs text-gray-500">
          {statut === "valide"
            ? "Cette page de vérification confirme l’origine et la validité du document."
            : "Cette page de vérification confirme l’origine du document, mais celui-ci n’est plus opposable."}{" "}
          Pour toute question, contactez directement l&apos;organisme de formation.
        </p>
      </div>
    </Container>
  );
}
