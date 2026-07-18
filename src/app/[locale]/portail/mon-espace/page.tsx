/**
 * Portail stagiaire — Espace personnel.
 *
 * URL : /{locale}/portail/mon-espace
 * Accès : stagiaire authentifié via cookie portail (HttpOnly).
 *
 * Server Component — lit le cookie → getEspaceStagiaire → affiche :
 *   - Mes formations (liste sessions + statut)
 *   - Mes attestations (liens téléchargement + vérification QR)
 *   - Questionnaires de satisfaction à remplir
 *   - Déclaration de situation de handicap
 *   - Droits RGPD (export / suppression)
 *   - Bouton quitter la session
 *
 * Règles non négociables :
 * - Sobre (Tailwind public standard — PAS de tokens admin var(--color-admin-*)).
 * - robots noindex (espace privé).
 * - force-dynamic (cookie session).
 * - AUCUNE mention Qualiopi / CPF / financement.
 * - Français, apostrophes JSX échappées.
 */

import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { getPortailToken } from "@/server/qualiopi/portail/cookie";
import { verifierToken, getEspaceStagiaire } from "@/server/qualiopi/portail/portail-service";
import {
  demanderExportRgpdAction,
  demanderSuppressionRgpdAction,
  declarerHandicapAction,
  soumettreSatisfactionPortailAction,
  quitterPortailAction,
} from "@/server/actions/qualiopi/portail";
import { SatisfactionPortailForm } from "@/components/portail/SatisfactionPortailForm";
import { HandicapDeclarationForm } from "@/components/portail/HandicapDeclarationForm";
import { RgpdActions } from "@/components/portail/RgpdActions";
import { QuitterPortailButton } from "@/components/portail/QuitterPortailButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mon espace",
  robots: { index: false, follow: false },
};

const DOC_TYPE_LABELS: Record<string, string> = {
  attestation: "Attestation de formation",
  attestation_partielle: "Attestation de suivi partiel",
  certificat_realisation: "Certificat de réalisation",
};

const ENROLLMENT_STATUT_LABELS: Record<string, string> = {
  planifiee: "Inscrit",
  presente: "En cours",
  abandon: "Abandon",
  exclu: "Exclu",
};

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
}

const QUESTIONNAIRE_TYPE_LABELS: Record<string, string> = {
  positionnement: "Questionnaire de positionnement",
  satisfaction_chaud: "Évaluation à chaud",
  satisfaction_froid: "Évaluation à froid",
};

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function PortailMonEspacePage({ params }: PageProps) {
  const { locale } = await params;

  // Lire le cookie portail
  const cookieToken = await getPortailToken();

  if (!cookieToken) {
    return <AccesRefuse locale={locale} raison="absente" />;
  }

  // Vérifier la validité du token
  const tokenResult = await verifierToken(cookieToken);
  if (!tokenResult) {
    return <AccesRefuse locale={locale} raison="expiree" />;
  }

  // Charger l'espace stagiaire
  let espace;
  try {
    espace = await getEspaceStagiaire(tokenResult.traineeId);
  } catch {
    return <AccesRefuse locale={locale} raison="introuvable" />;
  }

  const questionnairesNonRepondus = espace.questionnaires.filter((q) => q.reponduAt === null);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-10">
        {/* En-tête */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bonjour, {espace.trainee.prenom}</h1>
            <p className="mt-1 text-sm text-gray-500">Votre espace personnel</p>
          </div>
          <QuitterPortailButton quitterAction={quitterPortailAction} locale={locale} />
        </div>

        {/* Mes formations */}
        <Section titre="Mes formations">
          {espace.formations.length === 0 ? (
            <p className="text-sm text-gray-500">Aucune formation enregistrée.</p>
          ) : (
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
              {espace.formations.map((f, i) => (
                <li key={i} className="px-4 py-3">
                  <div className="font-medium text-gray-900">{f.titre}</div>
                  <div className="mt-0.5 text-xs text-gray-500">
                    {formatDate(f.dateDebut)}
                    {f.dateFin ? ` → ${formatDate(f.dateFin)}` : ""}
                    <span className="ml-2 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      {ENROLLMENT_STATUT_LABELS[f.statut] ?? f.statut}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Mes attestations */}
        <Section titre="Mes documents">
          {espace.attestations.length === 0 ? (
            <p className="text-sm text-gray-500">Aucun document disponible pour le moment.</p>
          ) : (
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
              {espace.attestations.map((a) => (
                <li key={a.numero} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {DOC_TYPE_LABELS[a.type] ?? a.type}
                    </div>
                    <div className="text-xs text-gray-500">N° {a.numero}</div>
                  </div>
                  <div className="flex gap-3">
                    {a.pdfUrl && (
                      <a
                        href={a.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 underline hover:no-underline"
                      >
                        Télécharger
                      </a>
                    )}
                    {a.qrToken && (
                      <a
                        href={`/${locale}/verifier-attestation/${a.qrToken}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-gray-500 underline hover:no-underline"
                      >
                        Vérifier
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-sm">
            <Link
              href="/reglement-interieur"
              className="text-blue-600 underline hover:no-underline"
            >
              Consulter le règlement intérieur
            </Link>
          </p>
        </Section>

        {/* Questionnaires de satisfaction */}
        {questionnairesNonRepondus.length > 0 && (
          <Section titre="Évaluations à remplir">
            <ul className="space-y-4">
              {questionnairesNonRepondus.map((q) => (
                <li key={q.token} className="rounded-lg border border-gray-200 bg-white p-4">
                  <p className="mb-3 text-sm font-medium text-gray-900">
                    {QUESTIONNAIRE_TYPE_LABELS[q.type] ?? q.type}
                  </p>
                  <SatisfactionPortailForm
                    questionnaireToken={q.token}
                    soumettreSatisfactionAction={soumettreSatisfactionPortailAction}
                  />
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Déclaration handicap */}
        <Section titre="Situation particulière">
          <HandicapDeclarationForm
            situationDeclaree={espace.situationHandicap.declaree}
            declarerHandicapAction={declarerHandicapAction}
          />
        </Section>

        {/* Droits RGPD */}
        <Section titre="Mes données personnelles">
          <RgpdActions
            demanderExportAction={demanderExportRgpdAction}
            demanderSuppressionAction={demanderSuppressionRgpdAction}
          />
        </Section>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sous-composants serveur (internes — pas exportés)
// ─────────────────────────────────────────────────────────────────────────────

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-base font-semibold text-gray-800">{titre}</h2>
      {children}
    </section>
  );
}

function AccesRefuse({
  locale: _locale,
  raison,
}: {
  locale: string;
  raison: "absente" | "expiree" | "introuvable";
}) {
  const messages: Record<typeof raison, string> = {
    absente: "Vous n’êtes pas connecté. Veuillez utiliser le lien qui vous a été transmis.",
    expiree: "Votre session a expiré ou a été révoquée. Veuillez demander un nouveau lien.",
    introuvable: "Votre profil est introuvable. Veuillez contacter l’organisme de formation.",
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md text-center">
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-6 py-4">
          <p className="text-sm font-semibold text-amber-800">Accès non autorisé</p>
          <p className="mt-1 text-sm text-amber-700">{messages[raison]}</p>
        </div>
      </div>
    </div>
  );
}
