/**
 * Espace stagiaire — mon compte : situation particulière et données personnelles.
 *
 * ## Pourquoi ces deux blocs ensemble, et à l'écart
 *
 * Ce sont les deux seuls endroits où le bénéficiaire nous confie quelque chose
 * sur LUI. Les laisser au milieu de la page d'accueil, entre les questionnaires
 * et les attestations, les noyait — alors que la déclaration d'un besoin
 * d'adaptation doit se trouver sans chercher, et que les droits RGPD doivent
 * rester visibles sans être mis en avant au point d'inquiéter.
 *
 * La déclaration passe AVANT les données personnelles : elle peut changer le
 * déroulement de la formation, l'autre non.
 */

import { Accessibility, DatabaseZap } from "lucide-react";

import { HandicapDeclarationForm } from "@/components/portail/HandicapDeclarationForm";
import { RgpdActions } from "@/components/portail/RgpdActions";
import {
  declarerHandicapAction,
  demanderExportRgpdAction,
  demanderSuppressionRgpdAction,
} from "@/server/actions/qualiopi/portail";

import { CoquilleStagiaire } from "../_coquille";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function MonComptePage({ params }: PageProps) {
  const { locale } = await params;

  return (
    <CoquilleStagiaire section="compte" locale={locale}>
      {(espace) => (
        <>
          <header className="mb-8">
            <h1 className="text-mocha font-serif text-2xl font-semibold sm:text-3xl">Mon compte</h1>
            <p className="text-fg-soft mt-2 text-sm">
              {espace.trainee.prenom} {espace.trainee.nom}
            </p>
          </header>

          <section className="border-border bg-paper mb-6 rounded-xl border p-5 sm:p-6">
            <div className="mb-4 flex items-start gap-3">
              <span
                aria-hidden="true"
                className="bg-terracotta-soft text-terracotta-deep flex size-9 shrink-0 items-center justify-center rounded-full"
              >
                <Accessibility className="size-5" strokeWidth={1.8} />
              </span>
              <div>
                <h2 className="text-mocha font-serif text-lg font-semibold">
                  Besoin d’une adaptation
                </h2>
                <p className="text-fg-soft mt-1 text-sm leading-relaxed">
                  Si une situation particulière nécessite un aménagement — salle, rythme, supports,
                  matériel — dites-le nous. Nous en tiendrons compte avant la formation.
                </p>
              </div>
            </div>
            <HandicapDeclarationForm
              situationDeclaree={espace.situationHandicap.declaree}
              declarerHandicapAction={declarerHandicapAction}
            />
          </section>

          <section className="border-border bg-paper rounded-xl border p-5 sm:p-6">
            <div className="mb-4 flex items-start gap-3">
              <span
                aria-hidden="true"
                className="bg-sand-deep text-mocha flex size-9 shrink-0 items-center justify-center rounded-full"
              >
                <DatabaseZap className="size-5" strokeWidth={1.8} />
              </span>
              <div>
                <h2 className="text-mocha font-serif text-lg font-semibold">
                  Mes données personnelles
                </h2>
                <p className="text-fg-soft mt-1 text-sm leading-relaxed">
                  Vous pouvez à tout moment obtenir une copie de vos données, ou en demander la
                  suppression.
                </p>
              </div>
            </div>
            <RgpdActions
              demanderExportAction={demanderExportRgpdAction}
              demanderSuppressionAction={demanderSuppressionRgpdAction}
            />
          </section>
        </>
      )}
    </CoquilleStagiaire>
  );
}
