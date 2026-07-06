// Bloc « Scannez pour laisser un avis » — QR code vers le formulaire /avis/deposer.
//
// Server component pur (0 JS client → aucun impact First Load / INP), CLS-safe
// (dimensions image fixes). L'asset SVG est statique dans /public (exclu du proxy
// i18n par le matcher `.svg`, cf. src/proxy.ts). Réutilisé sur le hub /avis et
// sur /avis/deposer (usage cross-device + partage pour recueillir d'autres avis).
//
// ⚠️ Le QR encode https://axion-ia.com/fr/avis/deposer?utm_source=qr&utm_medium=
// onsite&utm_campaign=avis-clients — si l'URL de dépôt change, régénérer le SVG
// (lib `qrcode`, ecLevel H, margin 4).

import { QrCode } from "lucide-react";

interface ReviewQrCtaProps {
  /** Ajuste le sous-titre selon l'emplacement (hub vs page formulaire). */
  context?: "hub" | "form";
  className?: string;
}

const QR_SRC = "/qr/laisser-un-avis.svg";
const FALLBACK_URL = "axion-ia.com/fr/avis/deposer";

export function ReviewQrCta({ context = "hub", className }: ReviewQrCtaProps) {
  return (
    <div
      className={`border-border bg-paper flex flex-col items-center gap-6 rounded-2xl border p-6 text-center sm:flex-row sm:text-left ${className ?? ""}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG statique, pas d'optimisation next/image */}
      <img
        src={QR_SRC}
        alt="QR code à scanner pour laisser un avis client sur Axion-IA"
        width={160}
        height={160}
        className="h-40 w-40 flex-shrink-0 rounded-lg"
      />
      <div>
        <p className="text-terracotta mb-2 inline-flex items-center gap-2 font-semibold">
          <QrCode aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
          Scannez pour laisser un avis
        </p>
        <p className="text-fg-soft text-sm">
          {context === "form"
            ? "Vous préférez sur mobile ? Scannez ce code — ou partagez-le autour de vous pour inviter d'autres clients à témoigner."
            : "Depuis votre téléphone, scannez ce code pour partager votre expérience en une minute. Imprimable et partageable pour recueillir d'autres avis."}
        </p>
        <p className="text-fg-muted mt-2 text-xs">{FALLBACK_URL}</p>
      </div>
    </div>
  );
}
