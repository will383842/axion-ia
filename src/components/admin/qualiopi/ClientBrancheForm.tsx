"use client";
// use-client: formulaire interactif avec état local (useState) + appel Server Action updateClientAction + router.refresh().

/**
 * ClientBrancheForm — Édition de la branche d'un client CRM.
 *
 * Permet de renseigner l'IDCC (code de la convention collective de branche,
 * déclencheur du barème OPCO par dossier) et la taille de l'entreprise
 * (CompanySize), puis appelle `updateClientAction`.
 *
 * Lot OPCO A1 : effectif salarié (seuils OPCO < 11 / 11-49 / 50+) et OPCO TYPÉ
 * (l'un des 11 du référentiel). Quand l'OPCO typé est vide et que le texte
 * libre désigne un OPCO sans ambiguïté, l'écran AFFICHE
 * « OPCO suggéré : X » — il n'écrit rien : seul un choix explicite le pose.
 *
 * Lot OPCO A7b : UN SEUL sélecteur d'OPCO, le champ typé `opco`. L'ancien
 * second sélecteur (texte libre `opcoIdentifie`, option « — (inféré) ») est
 * retiré : son seul geste propre, « remettre en inféré », est porté par l'option
 * « — » (cf. `branche-opco-saisie.ts`). La suggestion se retient d'un clic.
 * `complet` (fiche client) ajoute enveloppe, n° d'adhérent, offre Mobilités et
 * versement volontaire.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateClientAction } from "@/server/actions/qualiopi/clients";
import {
  OPCO_IDS,
  OPCO_LABELS,
  type OpcoId,
} from "@/server/qualiopi/financements/opco-referentiel";
import {
  chargeBrancheOpco,
  saisieInitiale,
  type BrancheOpcoInitiale,
  type BrancheOpcoSaisie,
  type Tristate,
} from "@/server/qualiopi/financements/branche-opco-saisie";
import type { CompanySize } from "@/server/qualiopi/crm/types";

interface ClientBrancheFormProps {
  id: string;
  idcc?: string | null;
  taille?: CompanySize | null;
  /**
   * OPCO suggéré par le texte libre historique (`suggererOpco`, calculé par la
   * page) : affiché, jamais écrit sans le clic « Retenir ».
   */
  suggestion?: OpcoId | null;
  /** OPCO typé (`Client.opco`). `null` = non choisi. */
  opco?: string | null;
  /** Effectif salarié de l'entreprise (niveau SIREN). `null` = inconnu. */
  effectif?: number | null;
  /** Fiche client : enveloppe, adhérent, offre Mobilités, versement volontaire. */
  complet?: boolean;
  enveloppeCents?: number | null;
  numeroAdherent?: string | null;
  adhesionMobilites?: boolean | null;
  versementVolontaire?: boolean | null;
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

const TRISTATE: ReadonlyArray<{ value: Tristate; label: string }> = [
  { value: "", label: "Non renseigné" },
  { value: "oui", label: "Oui" },
  { value: "non", label: "Non" },
];

export function ClientBrancheForm({
  id,
  idcc,
  taille,
  suggestion = null,
  opco,
  effectif,
  complet = false,
  enveloppeCents,
  numeroAdherent,
  adhesionMobilites,
  versementVolontaire,
  estParticulier = false,
}: ClientBrancheFormProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  // État d'origine mémorisé : n'envoyer que ce qui a changé, pour qu'un simple
  // « Enregistrer » ne re-date pas l'effectif ni ne fige un OPCO inféré.
  const initial: BrancheOpcoInitiale = {
    idcc: idcc ?? null,
    taille: taille ?? null,
    opco: opco ?? null,
    effectif: effectif ?? null,
    enveloppeCents: enveloppeCents ?? null,
    numeroAdherent: numeroAdherent ?? null,
    adhesionMobilites: adhesionMobilites ?? null,
    versementVolontaire: versementVolontaire ?? null,
  };
  const [saisie, setSaisie] = useState<BrancheOpcoSaisie>(() => saisieInitiale(initial));

  function poser<K extends keyof BrancheOpcoSaisie>(champ: K, valeur: BrancheOpcoSaisie[K]) {
    setSaisie((s) => ({ ...s, [champ]: valeur }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setOk(false);
    // 🔴 Le serveur valide et pose lui-même la source et la date de l'effectif
    // (`saisie`), comme celle de l'offre Mobilités / du versement volontaire.
    const r = chargeBrancheOpco(initial, saisie, { estParticulier });
    if ("erreur" in r) {
      setError(r.erreur);
      return;
    }
    startTransition(async () => {
      const result = await updateClientAction({ id, ...r.charge });
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

  /**
   * 🔴 CE FORMULAIRE ÉTAIT DÉPLIÉ DANS CHAQUE LIGNE du tableau des clients.
   * Trois champs de saisie et un bouton, répétés autant de fois qu'il y a de
   * clients, dans la dernière colonne : la liste cessait de se lire comme une
   * liste. Vu à l'écran le 2026-08-03 — la ligne faisait trois champs de large.
   *
   * La logique du formulaire n'est PAS touchée (elle est délicate : l'OPCO
   * n'est envoyé que s'il a changé, cf. plus haut). Seul l'affichage change :
   * replié derrière « Modifier », déplié à la demande. Le `<details>` natif
   * garde l'état par ligne sans état React supplémentaire, et fonctionne même
   * si le JavaScript n'a pas encore pris la main.
   */
  return (
    <details className="group">
      <summary className="admin-button-ghost cursor-pointer list-none whitespace-nowrap select-none">
        Modifier
      </summary>
      <form
        onSubmit={handleSubmit}
        className={
          complet
            ? "mt-[var(--space-admin-3)] grid grid-cols-1 items-end gap-[var(--space-admin-3)] sm:grid-cols-2 lg:grid-cols-4"
            : "mt-[var(--space-admin-3)] flex flex-col gap-[var(--space-admin-2)] sm:flex-row sm:items-end"
        }
      >
        <div className="min-w-0">
          <label htmlFor={`idcc-${id}`} className={labelCls}>
            IDCC
          </label>
          <input
            id={`idcc-${id}`}
            type="text"
            inputMode="numeric"
            value={saisie.idcc}
            onChange={(e) => poser("idcc", e.target.value)}
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
            value={saisie.taille}
            onChange={(e) => poser("taille", e.target.value)}
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

        {/* UN SEUL OPCO (lot A7b) : le champ typé. Six OPCO sur onze ne sont
          couverts par AUCUN code NAF de la table, et l'OPCO se déduit en droit
          de la convention collective : sans ce champ, un client de ces branches
          resterait « à déterminer ». Masqué pour un particulier, qui n'a pas
          d'OPCO. */}
        {!estParticulier && (
          <div className="min-w-0">
            <label htmlFor={`opco-${id}`} className={labelCls}>
              OPCO
            </label>
            <select
              id={`opco-${id}`}
              value={saisie.opco}
              onChange={(e) => poser("opco", e.target.value)}
              className={inputCls}
            >
              <option value="">— (à déterminer)</option>
              {OPCO_IDS.map((o) => (
                <option key={o} value={o}>
                  {OPCO_LABELS[o]}
                </option>
              ))}
            </select>
            {suggestion !== null && saisie.opco === "" && (
              <p className="mt-[var(--space-admin-1)] flex items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                {`OPCO suggéré : ${OPCO_LABELS[suggestion]}`}
                <button
                  type="button"
                  onClick={() => poser("opco", suggestion)}
                  className="admin-button-ghost"
                >
                  Retenir
                </button>
              </p>
            )}
          </div>
        )}

        {!estParticulier && (
          <div className="min-w-0">
            <label htmlFor={`effectif-${id}`} className={labelCls}>
              Effectif
            </label>
            <input
              id={`effectif-${id}`}
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={saisie.effectif}
              onChange={(e) => poser("effectif", e.target.value)}
              placeholder="Salariés"
              className={inputCls}
            />
          </div>
        )}

        {complet && !estParticulier && (
          <>
            <div className="min-w-0">
              <label htmlFor={`enveloppe-${id}`} className={labelCls}>
                Enveloppe annuelle (€)
              </label>
              <input
                id={`enveloppe-${id}`}
                type="text"
                inputMode="decimal"
                value={saisie.enveloppeEuros}
                onChange={(e) => poser("enveloppeEuros", e.target.value)}
                placeholder="Ex. 3 000"
                className={inputCls}
              />
            </div>
            <div className="min-w-0">
              <label htmlFor={`adherent-${id}`} className={labelCls}>
                N° d&apos;adhérent
              </label>
              <input
                id={`adherent-${id}`}
                type="text"
                value={saisie.numeroAdherent}
                onChange={(e) => poser("numeroAdherent", e.target.value)}
                maxLength={80}
                className={inputCls}
              />
            </div>
            {saisie.opco === "mobilites" && (
              <div className="min-w-0">
                <label htmlFor={`mobilites-${id}`} className={labelCls}>
                  Offre de services Mobilités
                </label>
                <select
                  id={`mobilites-${id}`}
                  value={saisie.adhesionMobilites}
                  onChange={(e) => poser("adhesionMobilites", e.target.value as Tristate)}
                  className={inputCls}
                >
                  {TRISTATE.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="min-w-0">
              <label htmlFor={`versement-${id}`} className={labelCls}>
                Versement volontaire
              </label>
              <select
                id={`versement-${id}`}
                value={saisie.versementVolontaire}
                onChange={(e) => poser("versementVolontaire", e.target.value as Tristate)}
                className={inputCls}
              >
                {TRISTATE.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </>
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
    </details>
  );
}
