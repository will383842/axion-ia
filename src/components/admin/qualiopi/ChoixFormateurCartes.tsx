"use client";
// use-client: cartes de choix interactives (rang 1/2/3, forfait saisi dans le même geste) + server action.

/**
 * Choisir le formateur d'une session en cartes (lots L11b et L11b-ux, écran
 * W-5 de la maquette 6). Remplace la liste déroulante quand l'interrupteur
 * `formateurs.choix_cartes` est allumé.
 *
 * Disponibles triés du plus proche au plus loin ; « 1er choix · 2e · 3e » ;
 * forfait de déplacement saisi dans le même geste hors du département ; les
 * formateurs qui ne peuvent pas sont repliés, avec la raison et ce qui la
 * lèverait. Jamais de taux de refus ni de silence affiché.
 *
 * Toutes les règles sont côté serveur (`choisirFormateursSessionAction`, qui
 * relit la même évaluation : T3) ; l'écran ne fait que les montrer.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { choisirFormateursSessionAction } from "@/server/actions/qualiopi/choix-formateur";
import {
  LIBELLE_PROXIMITE,
  LIBELLE_RANG,
  RANGS,
  deplacementCompris,
  libelleProposer,
  type CarteFormateur,
  type Rang,
} from "@/server/qualiopi/formateurs-independants/choix-formateur";

export interface ChoixActuelVue {
  rang: Rang;
  trainerId: string;
  nomCourt: string;
  etat: string;
}

export interface ChoixFormateurCartesProps {
  sessionId: string;
  ouverte: boolean;
  disponibles: ReadonlyArray<CarteFormateur>;
  indisponibles: ReadonlyArray<CarteFormateur>;
  choixActuels: ReadonlyArray<ChoixActuelVue>;
  /** Aperçu de l'e-mail de proposition chiffrée (F23, variante « honoraires »). */
  lienApercuEmail?: string;
}

/** « 80 » ou « 80,50 » → centimes ; `null` si vide ou illisible. */
function centimes(saisie: string): number | null {
  const t = saisie.trim().replace(",", ".");
  if (t === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

const carteCls =
  "rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]";
const petitCls = "text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]";

export function ChoixFormateurCartes({
  sessionId,
  ouverte,
  disponibles,
  indisponibles,
  choixActuels,
  lienApercuEmail,
}: ChoixFormateurCartesProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rangs, setRangs] = useState<Map<string, Rang>>(new Map());
  const [forfaits, setForfaits] = useState<Map<string, string>>(new Map());
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const parRang = useMemo(() => {
    const m = new Map<Rang, CarteFormateur>();
    for (const c of disponibles) {
      const r = rangs.get(c.trainerId);
      if (r !== undefined) m.set(r, c);
    }
    return m;
  }, [rangs, disponibles]);

  function choisir(trainerId: string, rang: Rang) {
    setErreur(null);
    setMessage(null);
    setRangs((avant) => {
      const apres = new Map(avant);
      if (avant.get(trainerId) === rang) {
        // Retirer ce rang retire aussi les suivants : les choix se suivent.
        for (const [id, r] of avant) if (r >= rang) apres.delete(id);
        return apres;
      }
      for (const [id, r] of avant) if (r === rang || id === trainerId) apres.delete(id);
      apres.set(trainerId, rang);
      return apres;
    });
  }

  const ordonnes = RANGS.map((r) => parRang.get(r)).filter(
    (c): c is CarteFormateur => c !== undefined,
  );
  const suite = ordonnes.length > 0 && ordonnes.length === Math.max(0, ...[...rangs.values()]);

  function proposer() {
    setErreur(null);
    setMessage(null);
    const choix = ordonnes.map((c, i) => ({
      trainerId: c.trainerId,
      rang: i + 1,
      forfaitDeplacementParJourHtCents:
        c.independant && !deplacementCompris(c.proximite)
          ? centimes(forfaits.get(c.trainerId) ?? "")
          : null,
    }));
    startTransition(async () => {
      const r = await choisirFormateursSessionAction({ sessionId, choix });
      if ("error" in r) {
        setErreur(r.error);
        return;
      }
      setMessage(
        r.data.missionProposee
          ? `Mission proposée à ${ordonnes[0]?.nomCourt ?? "votre 1er choix"}.`
          : "Choix enregistré.",
      );
      setRangs(new Map());
      router.refresh();
    });
  }

  return (
    <div className="space-y-[var(--space-admin-4)]">
      {choixActuels.length > 0 && (
        <ul className={`${carteCls} space-y-[var(--space-admin-1)]`} aria-label="Choix en cours">
          {choixActuels.map((c) => (
            <li key={c.trainerId} className="text-[length:var(--text-admin-sm)]">
              <strong>{LIBELLE_RANG[c.rang]}</strong> · {c.nomCourt} · {c.etat}
            </li>
          ))}
        </ul>
      )}

      {!ouverte ? (
        <p className={petitCls}>La session n&apos;est plus à venir : aucun choix à faire.</p>
      ) : (
        <>
          <p className="text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-fg)]">
            Disponibles, du plus proche au plus loin
          </p>
          {disponibles.length === 0 ? (
            <p className={petitCls}>Aucun formateur disponible pour cette session.</p>
          ) : (
            <ul className="grid gap-[var(--space-admin-3)] sm:grid-cols-2">
              {disponibles.map((c) => {
                const rang = rangs.get(c.trainerId);
                const compris = !c.independant || deplacementCompris(c.proximite);
                return (
                  <li key={c.trainerId} className={carteCls}>
                    <p className="font-semibold text-[color:var(--color-admin-fg)]">
                      {c.nomCourt}{" "}
                      <span className="text-[length:var(--text-admin-sm)] font-normal text-[color:var(--color-admin-success)]">
                        Disponible
                      </span>
                    </p>
                    <p className={petitCls}>
                      {c.departement !== null ? `${c.departement} · ` : ""}
                      {LIBELLE_PROXIMITE[c.proximite]}
                    </p>
                    {c.avertissements.length > 0 && (
                      <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-warning)]">
                        {c.avertissements.join(" ")}
                      </p>
                    )}
                    {c.independant && (
                      <div className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
                        Déplacement{" "}
                        {compris ? (
                          <strong>compris</strong>
                        ) : (
                          <label>
                            <input
                              type="text"
                              inputMode="decimal"
                              aria-label={`Forfait de déplacement de ${c.nomCourt}, en euros HT par journée`}
                              value={forfaits.get(c.trainerId) ?? ""}
                              onChange={(e) =>
                                setForfaits((avant) =>
                                  new Map(avant).set(c.trainerId, e.target.value),
                                )
                              }
                              disabled={isPending}
                              placeholder="0"
                              className="w-20 rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] px-[var(--space-admin-2)] py-[var(--space-admin-1)]"
                            />{" "}
                            € HT / jour
                          </label>
                        )}
                      </div>
                    )}
                    <div
                      className="mt-[var(--space-admin-3)] flex gap-[var(--space-admin-2)]"
                      role="group"
                      aria-label={`Rang de ${c.nomCourt}`}
                    >
                      {RANGS.map((r) => {
                        const permis = r === 1 || parRang.has((r - 1) as Rang);
                        return (
                          <button
                            key={r}
                            type="button"
                            aria-pressed={rang === r}
                            disabled={isPending || (!permis && rang !== r)}
                            onClick={() => choisir(c.trainerId, r)}
                            className={
                              rang === r
                                ? "admin-button min-h-[40px]"
                                : "min-h-[40px] rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] px-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] disabled:opacity-40"
                            }
                          >
                            {LIBELLE_RANG[r]}
                          </button>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {indisponibles.length > 0 && (
            <details className={carteCls}>
              <summary className="cursor-pointer text-[length:var(--text-admin-sm)]">
                Voir les {indisponibles.length} formateur{indisponibles.length > 1 ? "s" : ""} qui
                ne peuvent pas (et pourquoi)
              </summary>
              <ul className="mt-[var(--space-admin-3)] space-y-[var(--space-admin-2)]">
                {indisponibles.map((c) => (
                  <li key={c.trainerId} className="text-[length:var(--text-admin-sm)]">
                    <strong>{c.nomCourt}</strong> · {c.refus.map((r) => r.texte).join(" ")}
                    {c.refus.some((r) => r.levee !== null) && (
                      <span className={petitCls}>
                        {" "}
                        —{" "}
                        {c.refus
                          .map((r) => r.levee)
                          .filter((x): x is string => x !== null)
                          .join(" ")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
            <button
              type="button"
              className="admin-button min-h-[44px]"
              disabled={isPending || !suite}
              onClick={proposer}
            >
              {isPending ? "…" : libelleProposer(ordonnes.map((c) => c.nomCourt))}
            </button>
            {lienApercuEmail !== undefined && (
              <a
                href={lienApercuEmail}
                target="_blank"
                rel="noopener"
                className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-accent)] hover:underline"
              >
                Voir l&apos;aperçu de l&apos;e-mail
              </a>
            )}
          </div>
        </>
      )}

      {erreur && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-destructive)]"
        >
          {erreur}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
        >
          {message}
        </p>
      )}
    </div>
  );
}
