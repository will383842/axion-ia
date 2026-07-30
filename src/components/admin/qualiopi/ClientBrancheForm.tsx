"use client";
// use-client: formulaire interactif avec état local (useState) + appel Server Action updateClientAction + router.refresh().

/**
 * ClientBrancheForm — Édition de la branche d'un client CRM.
 *
 * Permet de renseigner l'IDCC (code de la convention collective de branche,
 * déclencheur du barème OPCO par dossier) et la taille de l'entreprise
 * (CompanySize), puis appelle `updateClientAction`.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateClientAction } from "@/server/actions/qualiopi/clients";
import { OPCO_IDS, OPCO_LABELS } from "@/server/qualiopi/financements/opco-referentiel";
import type { CompanySize } from "@/server/qualiopi/crm/types";

interface ClientBrancheFormProps {
  id: string;
  idcc?: string | null;
  taille?: CompanySize | null;
  /** OPCO courant (inféré ou saisi). `null` = « à déterminer ». */
  opcoIdentifie?: string | null;
  /**
   * Masque le champ OPCO. Un particulier (B2C) relève d'un contrat de formation
   * professionnelle (C. trav. L6353-3) et n'a PAS d'OPCO : lui en proposer un
   * inviterait à saisir un financeur inexistant, qui remonterait ensuite sur la
   * convention et le dossier de financement.
   */
  estParticulier?: boolean;
}

const TAILLE_OPTIONS: ReadonlyArray<{ value: CompanySize; label: string }> = [
  { value: "TPE", label: "TPE" },
  { value: "PME", label: "PME" },
  { value: "ETI", label: "ETI" },
  { value: "GRANDE_ENTREPRISE", label: "Grande entreprise" },
] as const;

export function ClientBrancheForm({
  id,
  idcc,
  taille,
  opcoIdentifie,
  estParticulier = false,
}: ClientBrancheFormProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [idccValue, setIdccValue] = useState<string>(idcc ?? "");
  const [tailleValue, setTailleValue] = useState<string>(taille ?? "");
  // Valeur d'origine mémorisée : c'est elle qui permet de distinguer « l'admin
  // a délibérément changé l'OPCO » de « l'admin n'a pas touché au select ».
  const opcoInitial = opcoIdentifie ?? "";
  const [opcoValue, setOpcoValue] = useState<string>(opcoInitial);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setOk(false);

    const idccTrim = idccValue.trim();
    startTransition(async () => {
      const result = await updateClientAction({
        id,
        ...(idccTrim !== "" ? { idcc: idccTrim } : {}),
        ...(tailleValue !== "" ? { taille: tailleValue as CompanySize } : {}),
        // 🔴 On n'envoie l'OPCO QUE s'il a changé, et JAMAIS `""`.
        //
        // Envoyer systématiquement la valeur affichée transformerait un OPCO
        // simplement INFÉRÉ en saisie EXPLICITE : le serveur cesserait alors de
        // le recalculer, et renseigner l'IDCC réel dans ce même formulaire
        // laisserait l'ancien OPCO — faux — sur la convention tripartite. En
        // omettant la clé quand rien n'a bougé, la ré-inférence serveur reste
        // armée.
        //
        // L'option vide envoie `null` (« remettre en inféré »), pas `""` : une
        // chaîne vide serait écrite en base, continuerait d'afficher
        // « À déterminer » et désactiverait la ré-inférence à vie. Le schéma Zod
        // la refuse désormais (`.min(1)`) — cette omission est la seconde
        // ceinture.
        ...(!estParticulier && opcoValue !== opcoInitial
          ? { opcoIdentifie: opcoValue === "" ? null : opcoValue }
          : {}),
      });
      if ("error" in result) {
        setError(result.error);
      } else {
        setOk(true);
        router.refresh();
      }
    });
  }

  const labelCls =
    "block text-[length:var(--text-admin-xs)] font-medium text-[color:var(--color-admin-fg-muted)] mb-[var(--space-admin-1)]";
  const inputCls =
    "w-full rounded border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-bg)] px-[var(--space-admin-2)] py-[var(--space-admin-1)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-[var(--space-admin-2)] sm:flex-row sm:items-end"
    >
      <div className="min-w-0">
        <label htmlFor={`idcc-${id}`} className={labelCls}>
          IDCC
        </label>
        <input
          id={`idcc-${id}`}
          type="text"
          inputMode="numeric"
          value={idccValue}
          onChange={(e) => setIdccValue(e.target.value)}
          placeholder="Ex. 1486"
          maxLength={10}
          className={inputCls}
        />
      </div>

      <div className="min-w-0">
        <label htmlFor={`taille-${id}`} className={labelCls}>
          Taille
        </label>
        <select
          id={`taille-${id}`}
          value={tailleValue}
          onChange={(e) => setTailleValue(e.target.value)}
          className={inputCls}
        >
          <option value="">—</option>
          {TAILLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Secours manuel de l'inférence. Six OPCO sur onze ne sont couverts par
          AUCUN code NAF de la table, et l'OPCO se déduit en droit de la
          convention collective : sans ce champ, un client de ces branches
          resterait « à déterminer » pour toujours, y compris sur la demande de
          prise en charge envoyée au financeur. Masqué pour un particulier, qui
          n'a pas d'OPCO. */}
      {!estParticulier && (
        <div className="min-w-0">
          <label htmlFor={`opco-${id}`} className={labelCls}>
            OPCO
          </label>
          <select
            id={`opco-${id}`}
            value={opcoValue}
            onChange={(e) => setOpcoValue(e.target.value)}
            className={inputCls}
          >
            <option value="">— (inféré)</option>
            {OPCO_IDS.map((opco) => (
              <option key={opco} value={opco}>
                {OPCO_LABELS[opco]}
              </option>
            ))}
          </select>
        </div>
      )}

      <button type="submit" disabled={isPending} className="admin-button">
        {isPending ? "Enregistrement…" : "Enregistrer"}
      </button>

      {error && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}
      {ok && !error && (
        <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-success)]">
          Enregistré.
        </p>
      )}
    </form>
  );
}
