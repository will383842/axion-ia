"use client";
// use-client: gestion interactive inter-entreprises (toggle + financement/facture par inscription) avec useTransition.

/**
 * InterEntreprisesSection — pilotage inter-entreprises sur la page session (R-INTER).
 * Toggle session inter + financement PAR participant + génération facture par inscrit.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setSessionInterEntreprisesAction,
  setEnrollmentFinancementAction,
} from "@/server/actions/qualiopi/inter-entreprises";
import { genererFactureParInscriptionAction } from "@/server/actions/qualiopi/factures-inter";

type Financement = "direct" | "opco" | "cpf" | "france_travail" | "mixte";

export interface InterEnrollmentRow {
  id: string;
  traineeNom: string;
  financementType: Financement | null;
  clientId: string | null;
  numeroDossierOpco: string | null;
  edofVerifie: boolean;
  montantHtEuros: number | null;
}

export interface InterEntreprisesSectionProps {
  sessionId: string;
  interEntreprises: boolean;
  enrollments: InterEnrollmentRow[];
  clients: Array<{ id: string; label: string }>;
}

const inputCls =
  "rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-2)] py-[var(--space-admin-1)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]";

function EnrollmentRow({
  row,
  clients,
}: {
  row: InterEnrollmentRow;
  clients: Array<{ id: string; label: string }>;
}): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [financementType, setFinancementType] = useState<string>(row.financementType ?? "");
  const [clientId, setClientId] = useState<string>(row.clientId ?? "");
  const [numeroDossierOpco, setNumeroDossierOpco] = useState<string>(row.numeroDossierOpco ?? "");
  const [edofVerifie, setEdofVerifie] = useState<boolean>(row.edofVerifie);
  const [montant, setMontant] = useState<string>(
    row.montantHtEuros != null ? String(row.montantHtEuros) : "",
  );

  function save() {
    setMsg(null);
    setError(null);
    startTransition(async () => {
      const r = await setEnrollmentFinancementAction({
        enrollmentId: row.id,
        financementType: financementType ? (financementType as Financement) : null,
        clientId: clientId || null,
        numeroDossierOpco: numeroDossierOpco || null,
        edofVerifie,
        montantHtEuros: montant.trim() !== "" ? Number(montant) : null,
      });
      if ("error" in r) setError(r.error);
      else {
        setMsg("Financement enregistré.");
        router.refresh();
      }
    });
  }

  function genererFacture() {
    setMsg(null);
    setError(null);
    startTransition(async () => {
      const r = await genererFactureParInscriptionAction({ enrollmentId: row.id });
      if ("error" in r) setError(r.error);
      else {
        setMsg(`Facture ${r.data.numero} générée.`);
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-3)]">
      <div className="mb-[var(--space-admin-2)] font-medium">{row.traineeNom}</div>
      <div className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
        <select
          value={financementType}
          onChange={(e) => setFinancementType(e.target.value)}
          disabled={isPending}
          className={inputCls}
          aria-label="Financement du participant"
        >
          <option value="">— Financement —</option>
          <option value="direct">Direct (employeur)</option>
          <option value="opco">OPCO</option>
          {/* 🔴 CPF a été retiré de la vente le 2026-07-04, mais des
              dossiers l'ont en base : pour eux le <select> ne trouvait
              AUCUNE option correspondante et s'affichait VIDE. Un simple
              « Enregistrer » réécrivait alors le dispositif en silence.
              L'option reste donc listée, non sélectionnable : on ne peut
              plus la choisir, on ne peut plus la perdre. */}
          <option value="cpf" disabled>
            CPF (dispositif retiré)
          </option>
          <option value="france_travail">France Travail</option>
          <option value="mixte">Mixte</option>
        </select>
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          disabled={isPending}
          className={inputCls}
          aria-label="Payeur (employeur)"
        >
          <option value="">— Payeur —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={0}
          step="0.01"
          value={montant}
          onChange={(e) => setMontant(e.target.value)}
          disabled={isPending}
          placeholder="Prix siège € HT"
          className={`${inputCls} w-32`}
          aria-label="Prix du siège HT"
        />
        {financementType === "opco" && (
          <input
            aria-label="N° dossier OPCO"
            value={numeroDossierOpco}
            onChange={(e) => setNumeroDossierOpco(e.target.value)}
            disabled={isPending}
            placeholder="N° dossier OPCO"
            maxLength={60}
            className={inputCls}
          />
        )}
        {financementType === "cpf" && (
          <label className="flex items-center gap-[var(--space-admin-1)] text-[length:var(--text-admin-sm)]">
            <input
              type="checkbox"
              checked={edofVerifie}
              onChange={(e) => setEdofVerifie(e.target.checked)}
              disabled={isPending}
              className="h-4 w-4 accent-[color:var(--color-admin-accent)]"
            />
            EDOF vérifié
          </label>
        )}
        <button type="button" onClick={save} disabled={isPending} className="admin-button">
          {isPending ? "…" : "Enregistrer"}
        </button>
        <button
          type="button"
          onClick={genererFacture}
          disabled={isPending}
          className="admin-button"
        >
          Générer facture
        </button>
      </div>
      {error && (
        <p
          role="alert"
          className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}
      {msg && (
        <p
          role="status"
          className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
        >
          {msg}
        </p>
      )}
    </div>
  );
}

export function InterEntreprisesSection({
  sessionId,
  interEntreprises,
  enrollments,
  clients,
}: InterEntreprisesSectionProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    startTransition(async () => {
      const r = await setSessionInterEntreprisesAction({
        sessionId,
        interEntreprises: !interEntreprises,
      });
      if ("error" in r) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]">
      <label className="flex cursor-pointer items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
        <input
          type="checkbox"
          checked={interEntreprises}
          onChange={toggle}
          disabled={isPending}
          className="h-4 w-4 accent-[color:var(--color-admin-accent)]"
        />
        Session inter-entreprises (financement &amp; facture par participant)
      </label>

      {error && (
        <p
          role="alert"
          className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}

      {interEntreprises && (
        <div className="mt-[var(--space-admin-4)] flex flex-col gap-[var(--space-admin-3)]">
          {enrollments.length === 0 ? (
            <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
              Aucun inscrit. Ajoutez des stagiaires pour gérer leur financement individuel.
            </p>
          ) : (
            enrollments.map((row) => <EnrollmentRow key={row.id} row={row} clients={clients} />)
          )}
        </div>
      )}
    </div>
  );
}
