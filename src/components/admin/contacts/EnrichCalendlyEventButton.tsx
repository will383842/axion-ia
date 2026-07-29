"use client";
// use-client: appel de Server Action + retour d'état inline (ADR 0036).
//
// Rattrapage manuel d'une réservation : demande au serveur d'aller relire le
// nom / email / horaire auprès de Calendly. Sert pour les lignes captées avant
// la pose du jeton API, et pour re-synchroniser après une annulation faite
// côté Calendly.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enrichCalendlyEventAction } from "@/features/admin-calendly/actions";

interface Props {
  readonly id: string;
  /**
   * Faux si aucun jeton n'est configuré. Le bouton reste VISIBLE mais désactivé,
   * avec l'explication : cacher l'action laisserait croire que la complétion
   * manuelle est la seule option possible, alors qu'il ne manque qu'un réglage.
   */
  readonly apiConfigured: boolean;
}

export function EnrichCalendlyEventButton({ id, apiConfigured }: Props): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  function onClick() {
    setResult(null);
    startTransition(async () => {
      // `try/catch` INDISPENSABLE : `enrichCalendlyEventAction` traduit ses
      // propres échecs en `{ ok: false }`, mais la couche Server Action peut
      // elle-même rejeter (erreur réseau, 500, session expirée, réponse
      // illisible). Sans ce filet, la promesse rejetait en silence et le bouton
      // ne rendait AUCUN message : l'admin cliquait, rien ne se passait, et
      // rien n'expliquait pourquoi. Constaté en production le 2026-07-29 sur
      // une réservation qui refusait de s'enrichir sans dire un mot.
      try {
        const r = await enrichCalendlyEventAction({ id });
        if (r.ok) {
          setResult({ ok: true, text: r.message });
          router.refresh();
        } else {
          setResult({ ok: false, text: r.error });
        }
      } catch (e) {
        setResult({
          ok: false,
          text: `La récupération n'a pas abouti (${
            e instanceof Error ? e.message : "erreur inconnue"
          }). Réessayez, ou complétez la fiche à la main.`,
        });
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={isPending || !apiConfigured}
        className="admin-button-ghost"
        title={
          apiConfigured
            ? "Relire le nom, l'email et l'horaire auprès de Calendly"
            : "Nécessite la variable CALENDLY_API_TOKEN"
        }
      >
        {isPending ? "Récupération…" : "⟳ Enrichir depuis Calendly"}
      </button>
      {result ? (
        <p
          role="status"
          className={`max-w-xs text-right text-[length:var(--text-admin-xs)] ${
            result.ok
              ? "text-[color:var(--color-admin-success)]"
              : "text-[color:var(--color-admin-danger)]"
          }`}
        >
          {result.text}
        </p>
      ) : null}
    </div>
  );
}
