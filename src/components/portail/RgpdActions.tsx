"use client";
// use-client: boutons RGPD (export / suppression) avec confirmation + useTransition.
/**
 * RgpdActions — Droits RGPD depuis le portail stagiaire.
 *
 * Deux actions :
 *   - Droit d&apos;accès (export) : crée une demande d&apos;export RGPD.
 *   - Droit à l&apos;effacement (suppression) : crée une demande de suppression.
 *     Confirmation obligatoire (fenêtre confirm) avant envoi.
 *
 * Les demandes sont traitées manuellement par l&apos;équipe (délai légal 30j).
 *
 * Sobre (charte publique — PAS de tokens admin).
 * Français, apostrophes JSX échappées.
 */

import { useState, useTransition } from "react";

type ActionResult<T> = { data: T } | { error: string };

interface RgpdActionsProps {
  demanderExportAction: () => Promise<ActionResult<{ id: string }>>;
  demanderSuppressionAction: () => Promise<ActionResult<{ id: string }>>;
}

export function RgpdActions({
  demanderExportAction,
  demanderSuppressionAction,
}: RgpdActionsProps): React.ReactElement {
  const [isPendingExport, startExport] = useTransition();
  const [isPendingSuppression, startSuppression] = useTransition();
  const [exportDone, setExportDone] = useState(false);
  const [suppressionDone, setSuppressionDone] = useState(false);
  const [errorExport, setErrorExport] = useState<string | null>(null);
  const [errorSuppression, setErrorSuppression] = useState<string | null>(null);

  function handleExport() {
    setErrorExport(null);
    startExport(async () => {
      const result = await demanderExportAction();
      if ("error" in result) {
        setErrorExport(result.error);
      } else {
        setExportDone(true);
      }
    });
  }

  function handleSuppression() {
    const confirmMsg =
      "Êtes-vous certain de vouloir demander la suppression de vos données ?\n\n" +
      "Cette demande sera traitée dans un délai de 30 jours. " +
      "Les données liées à des obligations légales seront conservées.";
    if (!window.confirm(confirmMsg)) return;

    setErrorSuppression(null);
    startSuppression(async () => {
      const result = await demanderSuppressionAction();
      if ("error" in result) {
        setErrorSuppression(result.error);
      } else {
        setSuppressionDone(true);
      }
    });
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="mb-4 text-sm text-gray-700">
        Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez
        d&apos;un droit d&apos;accès à vos données personnelles et d&apos;un droit à
        l&apos;effacement. Toute demande sera traitée dans un délai maximum de 30 jours.
      </p>

      <div className="space-y-3">
        {/* Export */}
        <div>
          {exportDone ? (
            <p className="text-sm text-green-700">
              Votre demande d&apos;accès à vos données a bien été enregistrée. Vous serez contacté
              dans les 30 jours.
            </p>
          ) : (
            <>
              <button
                type="button"
                onClick={handleExport}
                disabled={isPendingExport || isPendingSuppression}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {isPendingExport ? "Envoi..." : "Demander l’accès à mes données"}
              </button>
              {errorExport && (
                <p role="alert" className="mt-1 text-xs text-red-600">
                  {errorExport}
                </p>
              )}
            </>
          )}
        </div>

        {/* Suppression */}
        <div>
          {suppressionDone ? (
            <p className="text-sm text-green-700">
              Votre demande de suppression a bien été enregistrée. Elle sera traitée dans les 30
              jours, dans le respect des obligations légales de conservation.
            </p>
          ) : (
            <>
              <button
                type="button"
                onClick={handleSuppression}
                disabled={isPendingExport || isPendingSuppression}
                className="rounded-md border border-red-200 bg-white px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                {isPendingSuppression ? "Envoi..." : "Demander la suppression de mes données"}
              </button>
              {errorSuppression && (
                <p role="alert" className="mt-1 text-xs text-red-600">
                  {errorSuppression}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
