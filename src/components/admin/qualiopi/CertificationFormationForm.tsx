"use client";
// use-client: formulaire interactif avec état local (useState) + appel Server Action setCertificationAction + router.refresh().

/**
 * CertificationFormationForm — Formulaire de saisie RS/RNCP d'une formation.
 *
 * Permet de définir le type de certification (aucune / RS / RNCP), les codes,
 * le certificateur, la date d&apos;enregistrement et d&apos;échéance, puis
 * appelle `setCertificationAction`. Affiche le statut cpfEligible calculé.
 *
 * Requiert ADMIN_PUBLISH côté action.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setCertificationAction } from "@/server/actions/qualiopi/formations";

type CertificationType = "aucune" | "rs" | "rncp";

interface CertificationFormationFormProps {
  formationId: string;
  /** Valeurs courantes (pré-remplissage). */
  initial: {
    certificationType: CertificationType | null;
    codeRncp: string | null;
    codeRs: string | null;
    numeroEnregistrementFc: string | null;
    certificateurNom: string | null;
    estCertificateur: boolean | null;
    numeroHabilitation: string | null;
    dateEnregistrementCertif: Date | null;
    dateEcheanceCertif: Date | null;
    cpfEligible: boolean | null;
  };
}

/** Formate une date JS en YYYY-MM-DD pour un input[type=date]. */
function toInputDate(d: Date | null): string {
  if (!d) return "";
  return d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
}

export function CertificationFormationForm({
  formationId,
  initial,
}: CertificationFormationFormProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [cpfResult, setCpfResult] = useState<boolean | null>(initial.cpfEligible ?? null);

  const [certType, setCertType] = useState<CertificationType>(
    initial.certificationType ?? "aucune",
  );
  const [codeRncp, setCodeRncp] = useState(initial.codeRncp ?? "");
  const [codeRs, setCodeRs] = useState(initial.codeRs ?? "");
  const [numeroEnregistrement, setNumeroEnregistrement] = useState(
    initial.numeroEnregistrementFc ?? "",
  );
  const [certificateurNom, setCertificateurNom] = useState(initial.certificateurNom ?? "");
  const [estCertificateur, setEstCertificateur] = useState(initial.estCertificateur ?? false);
  const [numeroHabilitation, setNumeroHabilitation] = useState(initial.numeroHabilitation ?? "");
  const [dateEnregistrement, setDateEnregistrement] = useState(
    toInputDate(initial.dateEnregistrementCertif),
  );
  const [dateEcheance, setDateEcheance] = useState(toInputDate(initial.dateEcheanceCertif));

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await setCertificationAction({
        formationId,
        certificationType: certType,
        codeRncp: codeRncp.trim() || null,
        codeRs: codeRs.trim() || null,
        numeroEnregistrementFc: numeroEnregistrement.trim() || null,
        certificateurNom: certificateurNom.trim() || null,
        estCertificateur,
        numeroHabilitation: numeroHabilitation.trim() || null,
        dateEnregistrementCertif: dateEnregistrement ? new Date(dateEnregistrement) : null,
        dateEcheanceCertif: dateEcheance ? new Date(dateEcheance) : null,
      });

      if ("error" in result) {
        setError(result.error);
      } else {
        setCpfResult(result.data.cpfEligible);
        router.refresh();
      }
    });
  }

  const labelCls =
    "block text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg-muted)] mb-[var(--space-admin-1)]";
  const inputCls =
    "w-full rounded border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-bg)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-[var(--space-admin-5)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]"
    >
      <h3 className="text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
        Certification RS / RNCP
      </h3>

      {/* Type de certification */}
      <div>
        <label htmlFor="cert-type" className={labelCls}>
          Type de certification
        </label>
        <select
          id="cert-type"
          value={certType}
          onChange={(e) => setCertType(e.target.value as CertificationType)}
          className={inputCls}
        >
          <option value="aucune">Aucune (non certifiante)</option>
          <option value="rs">RS — Répertoire Spécifique</option>
          <option value="rncp">RNCP — Répertoire National</option>
        </select>
      </div>

      {certType !== "aucune" && (
        <>
          <div className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2">
            {/* Code RNCP */}
            <div>
              <label htmlFor="cert-code-rncp" className={labelCls}>
                Code RNCP
              </label>
              <input
                id="cert-code-rncp"
                type="text"
                value={codeRncp}
                onChange={(e) => setCodeRncp(e.target.value)}
                placeholder="Ex. RNCP37274"
                maxLength={20}
                className={inputCls}
              />
            </div>

            {/* Code RS */}
            <div>
              <label htmlFor="cert-code-rs" className={labelCls}>
                Code RS
              </label>
              <input
                id="cert-code-rs"
                type="text"
                value={codeRs}
                onChange={(e) => setCodeRs(e.target.value)}
                placeholder="Ex. RS6543"
                maxLength={20}
                className={inputCls}
              />
            </div>

            {/* N° enregistrement FC */}
            <div>
              <label htmlFor="cert-numero-enregistrement" className={labelCls}>
                N° enregistrement FC
              </label>
              <input
                id="cert-numero-enregistrement"
                type="text"
                value={numeroEnregistrement}
                onChange={(e) => setNumeroEnregistrement(e.target.value)}
                placeholder="Ex. 202300123456"
                maxLength={40}
                className={inputCls}
              />
            </div>

            {/* Nom du certificateur */}
            <div>
              <label htmlFor="cert-certificateur-nom" className={labelCls}>
                Nom du certificateur
              </label>
              <input
                id="cert-certificateur-nom"
                type="text"
                value={certificateurNom}
                onChange={(e) => setCertificateurNom(e.target.value)}
                placeholder="Ex. France Compétences"
                maxLength={250}
                className={inputCls}
              />
            </div>

            {/* N° habilitation */}
            <div>
              <label htmlFor="cert-numero-habilitation" className={labelCls}>
                N° habilitation (si OF habilité)
              </label>
              <input
                id="cert-numero-habilitation"
                type="text"
                value={numeroHabilitation}
                onChange={(e) => setNumeroHabilitation(e.target.value)}
                placeholder="Ex. HAB-2023-00042"
                maxLength={60}
                className={inputCls}
              />
            </div>

            {/* Date enregistrement */}
            <div>
              <label htmlFor="cert-date-enregistrement" className={labelCls}>
                Date d&apos;enregistrement
              </label>
              <input
                id="cert-date-enregistrement"
                type="date"
                value={dateEnregistrement}
                onChange={(e) => setDateEnregistrement(e.target.value)}
                className={inputCls}
              />
            </div>

            {/* Date échéance */}
            <div>
              <label htmlFor="cert-date-echeance" className={labelCls}>
                Date d&apos;échéance
              </label>
              <input
                id="cert-date-echeance"
                type="date"
                value={dateEcheance}
                onChange={(e) => setDateEcheance(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {/* OF est certificateur */}
          <div className="flex items-center gap-[var(--space-admin-2)]">
            <input
              id="cert-est-certificateur"
              type="checkbox"
              checked={estCertificateur}
              onChange={(e) => setEstCertificateur(e.target.checked)}
              className="h-4 w-4 rounded border-[color:var(--color-admin-border)] text-[color:var(--color-admin-accent)] focus:ring-[color:var(--color-admin-accent)]"
            />
            <label
              htmlFor="cert-est-certificateur"
              className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]"
            >
              L&apos;OF est lui-même certificateur
            </label>
          </div>
        </>
      )}

      {/* Statut CPF calculé */}
      {cpfResult !== null && (
        <div
          className={`inline-flex items-center gap-[var(--space-admin-2)] rounded-full px-[var(--space-admin-3)] py-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] font-semibold ${
            cpfResult
              ? "bg-[color:var(--color-admin-success-soft)] text-[color:var(--color-admin-success)]"
              : "bg-[color:var(--color-admin-surface)] text-[color:var(--color-admin-fg-muted)]"
          }`}
        >
          {cpfResult ? "Éligible CPF" : "Non éligible CPF"}
          {!cpfResult && certType !== "aucune" && (
            <span className="font-normal">
              {" "}
              — vérification EDOF requise pour activer l&apos;éligibilité CPF
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-[var(--space-admin-3)]">
        <button type="submit" disabled={isPending} className="admin-button">
          {isPending ? "Enregistrement…" : "Enregistrer la certification"}
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}
    </form>
  );
}
