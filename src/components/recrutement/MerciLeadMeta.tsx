"use client";
// use-client: lit `?c=` (useSearchParams) et tire l'événement pixel côté navigateur.
//
// Page merci du tunnel Facebook — tire l'événement standard `Lead` du pixel
// Meta avec, en `eventID`, l'identifiant de la Submission passé par le
// formulaire. L'action serveur envoie le même identifiant à l'API Conversions :
// Meta ne compte qu'une conversion.
//
// Ne rend rien. Ne fait rien si le pixel n'est pas là (pas de consentement,
// pas d'identifiant, route hors tunnel) : `trackMetaLead` est un no-op sans
// `window.fbq`. Le pixel arrivant APRÈS l'hydratation (afterInteractive), on
// réessaie quelques fois pendant trois secondes avant de laisser tomber.
//
// `useSearchParams` est enveloppé ICI dans un <Suspense> : sans lui, Next
// ferait basculer toute la page en rendu client (bailout CSR) — garde
// `usesearchparams-bailout-guard.test.ts`.

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { trackMetaLead } from "@/lib/analytics/meta-pixel";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function MerciLeadMeta() {
  return (
    <React.Suspense fallback={null}>
      <MerciLeadMetaInner />
    </React.Suspense>
  );
}

function MerciLeadMetaInner() {
  const params = useSearchParams();
  const id = params.get("c");

  React.useEffect(() => {
    if (!id || !UUID_RE.test(id)) return;
    let essais = 0;
    const tenter = (): boolean => {
      essais += 1;
      const present = typeof (window as unknown as { fbq?: unknown }).fbq === "function";
      if (present) trackMetaLead(id);
      return present;
    };
    if (tenter()) return;
    const timer = window.setInterval(() => {
      if (tenter() || essais >= 6) window.clearInterval(timer);
    }, 500);
    return () => window.clearInterval(timer);
  }, [id]);

  return null;
}
