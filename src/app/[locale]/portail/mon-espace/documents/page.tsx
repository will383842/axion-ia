/**
 * Espace stagiaire — mes documents.
 *
 * Deux familles, séparées parce qu'elles ne servent pas au même moment :
 *
 *  - les **attestations** : ce que le bénéficiaire garde et peut présenter à un
 *    tiers. D'où le lien de vérification à côté du téléchargement — c'est lui qui
 *    permet à un employeur de contrôler la pièce sans passer par nous.
 *  - les **documents de la formation** : programme, règlement intérieur, livret
 *    d'accueil, convocation. Ce que la convocation annonce transmettre.
 *
 * 🔴 Les mélanger était le défaut d'origine : une liste unique où l'attestation
 * finale voisinait avec le règlement intérieur, sans hiérarchie.
 */

import { Download, ShieldCheck } from "lucide-react";
import { Link } from "@/i18n/navigation";

import { CoquilleStagiaire } from "../_coquille";

const LIBELLES_ATTESTATION: Record<string, string> = {
  attestation: "Attestation de formation",
  attestation_partielle: "Attestation de suivi partiel",
  certificat_realisation: "Certificat de réalisation",
};

const LIBELLES_PIECE: Record<string, string> = {
  programme: "Programme de la formation",
  reglement_interieur: "Règlement intérieur",
  livret_accueil: "Livret d’accueil",
  convocation: "Convocation",
};

function formatDateCourte(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function MesDocumentsPage({ params }: PageProps) {
  const { locale } = await params;

  return (
    <CoquilleStagiaire section="documents" locale={locale}>
      {(espace) => {
        const rien = espace.attestations.length === 0 && espace.pieces.length === 0;

        return (
          <>
            <header className="mb-8">
              <h1 className="text-mocha font-serif text-2xl font-semibold sm:text-3xl">
                Mes documents
              </h1>
              <p className="text-fg-soft mt-2 text-sm">
                Vos attestations et les documents de votre formation, téléchargeables à tout moment.
              </p>
            </header>

            {rien ? (
              <div className="bg-paper shadow-card rounded-xl p-8 text-center">
                <p className="text-mocha font-serif text-base font-semibold">
                  Aucun document disponible
                </p>
                <p className="text-fg-soft mx-auto mt-2 max-w-sm text-sm leading-relaxed">
                  Vos documents apparaîtront ici au fur et à mesure : le programme avant la
                  formation, votre attestation à l’issue.
                </p>
              </div>
            ) : null}

            {espace.attestations.length > 0 ? (
              <section className="mb-10">
                <h2 className="text-fg-muted mb-3 text-xs font-semibold tracking-wide uppercase">
                  Attestations
                </h2>
                <ul className="space-y-3">
                  {espace.attestations.map((a) => (
                    <li
                      key={a.numero}
                      className="bg-paper shadow-card flex flex-wrap items-center justify-between gap-4 rounded-xl p-5"
                    >
                      <div className="min-w-0">
                        <p className="text-mocha font-serif text-base font-semibold">
                          {LIBELLES_ATTESTATION[a.type] ?? a.type}
                        </p>
                        <p className="text-fg-muted mt-0.5 font-mono text-xs">{a.numero}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-4">
                        {a.pdfUrl ? (
                          <a
                            href={a.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-terracotta hover:text-terracotta-deep inline-flex items-center gap-1.5 text-sm font-medium"
                          >
                            <Download className="size-4" aria-hidden="true" />
                            Télécharger
                          </a>
                        ) : null}
                        {a.qrToken ? (
                          <a
                            href={`/${locale}/verifier-attestation/${a.qrToken}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-fg-muted hover:text-mocha inline-flex items-center gap-1.5 text-sm"
                          >
                            <ShieldCheck className="size-4" aria-hidden="true" />
                            Vérifier
                          </a>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="text-fg-muted mt-3 text-xs leading-relaxed">
                  Le lien « Vérifier » permet à un employeur de contrôler l’authenticité de votre
                  attestation sans avoir à nous contacter.
                </p>
              </section>
            ) : null}

            {espace.pieces.length > 0 ? (
              <section>
                <h2 className="text-fg-muted mb-3 text-xs font-semibold tracking-wide uppercase">
                  Documents de ma formation
                </h2>
                <ul className="space-y-3">
                  {espace.pieces.map((p) => (
                    <li
                      key={p.numero}
                      className="bg-paper shadow-card flex flex-wrap items-center justify-between gap-4 rounded-xl p-5"
                    >
                      <div className="min-w-0">
                        <p className="text-mocha font-serif text-base font-semibold">
                          {LIBELLES_PIECE[p.type] ?? p.type}
                        </p>
                        <p className="text-fg-muted mt-0.5 text-xs">
                          Remis le {formatDateCourte(p.remiseLe)}
                        </p>
                      </div>
                      {p.pdfUrl ? (
                        <a
                          href={p.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-terracotta hover:text-terracotta-deep inline-flex shrink-0 items-center gap-1.5 text-sm font-medium"
                        >
                          <Download className="size-4" aria-hidden="true" />
                          Télécharger
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <p className="text-fg-muted mt-10 text-sm">
              <Link href="/reglement-interieur" className="hover:text-mocha underline">
                Consulter le règlement intérieur en ligne
              </Link>
            </p>
          </>
        );
      }}
    </CoquilleStagiaire>
  );
}
