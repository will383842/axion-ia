"use client";
// use-client: presse-papiers (navigator.clipboard) + état local « copié ». Aucune donnée n'est lue ici — l'URL arrive en prop du Server Component.

/**
 * DevisSignatureLinkCopy — expose le lien de signature DocuSeal du CLIENT
 * SANS le rendre cliquable.
 *
 * 🔴 POURQUOI PAS UN `<a href>` : `docusealEmbedUrl` est l'`embed_src` du 1er
 * signataire, c'est-à-dire le porteur de jeton PERSONNEL du client — exactement
 * la même URL que le CTA de son email. Un admin qui l'ouvre peut signer À SA
 * PLACE, et l'audit trail eIDAS-SES enregistrerait l'adresse IP et le
 * navigateur d'Axion-IA sous la signature du client : la non-répudiation du
 * « bon pour accord » serait détruite, et c'est précisément la pièce qu'une
 * auditrice Qualiopi vient vérifier. On copie, on ne clique pas — et le champ
 * est en lecture seule pour qu'un clic distrait ne navigue nulle part.
 */

import { useState } from "react";

export interface DevisSignatureLinkCopyProps {
  /** `Devis.docusealEmbedUrl` — jeton de signature personnel du client. */
  url: string;
}

export function DevisSignatureLinkCopy({ url }: DevisSignatureLinkCopyProps): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  function handleCopy() {
    setCopyError(false);
    // 🔴 `navigator.clipboard` est ABSENT hors contexte sécurisé : sans ce
    // garde, l'appel lève un TypeError SYNCHRONE que le `.catch()` n'attrape
    // pas, et l'admin reste devant un bouton muet. Le champ ci-dessus reste
    // sélectionnable pour la copie manuelle.
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      setCopyError(true);
      return;
    }
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2500);
      })
      .catch(() => {
        setCopied(false);
        setCopyError(true);
      });
  }

  return (
    <div className="mt-[var(--space-admin-4)] flex flex-col gap-[var(--space-admin-2)]">
      <label
        htmlFor="devis-signature-url"
        className="text-[length:var(--text-admin-xs)] tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase"
      >
        Lien de signature du client
      </label>
      <div className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
        <input
          id="devis-signature-url"
          type="text"
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] font-mono text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg)]"
        />
        <button
          type="button"
          onClick={handleCopy}
          className="admin-button"
          aria-label="Copier le lien de signature du client dans le presse-papiers"
        >
          {copied ? "Copié" : "Copier le lien"}
        </button>
      </div>
      <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-warning)]">
        Ne l&apos;ouvrez pas vous-même : ce lien est le jeton personnel du client. Une signature
        déposée depuis la console serait horodatée avec l&apos;adresse IP d&apos;Axion-IA et
        n&apos;aurait aucune valeur probante.
      </p>
      {copyError && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
        >
          Copie automatique impossible — sélectionnez le lien ci-dessus et copiez-le à la main.
        </p>
      )}
    </div>
  );
}
