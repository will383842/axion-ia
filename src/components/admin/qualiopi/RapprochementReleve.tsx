"use client";
// use-client: lecture d'un CSV côté client (file.text()), analyse via Server
// Action, puis encaissements ligne à ligne avec confirmation à deux clics.

/**
 * RapprochementReleve — rapprochement bancaire Finom v1 (sans persistance).
 *
 * L'admin dépose l'export CSV Finom du mois, « Analyser » appelle
 * `analyserReleveAction` (lecture seule : parse + suggestions contre les
 * factures ouvertes). Chaque crédit suggéré porte un bouton « Rapprocher » qui
 * appelle `enregistrerPaiementFactureAction` EXISTANTE (transaction complète :
 * Payment + statut + dossier de financement) avec le montant DU CRÉDIT, la
 * date de la ligne et la référence du relevé — confirmation à deux clics.
 *
 * Les débits (sorties) sont hors périmètre : restitués repliés, pour que
 * l'admin voie que rien n'a été perdu à la lecture du fichier.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { analyserReleveAction } from "@/server/actions/qualiopi/rapprochement";
import type { AnalyseReleveResult, LigneReleveDto } from "@/server/actions/qualiopi/rapprochement";
import { enregistrerPaiementFactureAction } from "@/server/actions/qualiopi/facturation-hub";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { formatDateFrShort } from "@/lib/format-date-fr";

function eur(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

/** Clé stable d'une ligne de relevé (pas d'id : le relevé n'est pas persisté). */
function cleLigne(l: LigneReleveDto): string {
  return `${l.dateIso}|${l.contrepartie}|${l.montantCents}|${l.reference ?? ""}`;
}

export function RapprochementReleve(): React.ReactElement {
  const router = useRouter();
  const [analyseEnCours, startAnalyse] = useTransition();
  const [encaissementEnCours, startEncaissement] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<AnalyseReleveResult | null>(null);
  /** Clé de la ligne dont la confirmation est ouverte (1er clic effectué). */
  const [aConfirmer, setAConfirmer] = useState<string | null>(null);
  /** Lignes déjà encaissées pendant cette session d'analyse. */
  const [encaissees, setEncaissees] = useState<ReadonlySet<string>>(new Set());
  const [erreursLigne, setErreursLigne] = useState<Readonly<Record<string, string>>>({});

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null);
    setErreur(null);
    setResultat(null);
    setAConfirmer(null);
    setEncaissees(new Set());
    setErreursLigne({});
  }

  function analyser(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setResultat(null);
    if (!file) {
      setErreur("Sélectionnez l'export CSV Finom.");
      return;
    }
    startAnalyse(async () => {
      let csvText: string;
      try {
        csvText = await file.text();
      } catch {
        setErreur("Impossible de lire le fichier.");
        return;
      }
      const res = await analyserReleveAction({ csvText });
      if ("error" in res) {
        setErreur(res.error);
        return;
      }
      setResultat(res.data);
    });
  }

  function rapprocher(ligne: LigneReleveDto, factureId: string) {
    const cle = cleLigne(ligne);
    setErreursLigne((prev) => {
      if (!(cle in prev)) return prev;
      const reste: Record<string, string> = { ...prev };
      delete reste[cle];
      return reste;
    });
    startEncaissement(async () => {
      const res = await enregistrerPaiementFactureAction({
        factureId,
        montantCents: ligne.montantCents,
        paidAt: ligne.dateIso,
        mode: "manual_wire",
        reference: ligne.reference ?? ligne.contrepartie,
      });
      setAConfirmer(null);
      if ("error" in res) {
        setErreursLigne((prev) => ({ ...prev, [cle]: res.error }));
        return;
      }
      setEncaissees((prev) => new Set(prev).add(cle));
      router.refresh();
    });
  }

  const fileCls =
    "mt-1 block w-full text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] file:mr-4 file:rounded file:border-0 file:bg-[color:var(--color-admin-surface)] file:px-[var(--space-admin-3)] file:py-[var(--space-admin-2)] file:text-[length:var(--text-admin-sm)] file:font-medium file:text-[color:var(--color-admin-fg)]";
  const sectionHeadCls =
    "text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)] mb-[var(--space-admin-3)]";

  return (
    <div className="space-y-[var(--space-admin-6)]">
      <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]">
        <form onSubmit={analyser} className="space-y-[var(--space-admin-4)]">
          <div>
            <label
              htmlFor="rapprochement-releve-file"
              className="block text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)]"
            >
              Export CSV Finom du compte
            </label>
            <input
              id="rapprochement-releve-file"
              type="file"
              accept=".csv,.txt"
              onChange={handleFileChange}
              disabled={analyseEnCours}
              className={fileCls}
            />
            <p className="mt-1 text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
              Colonnes attendues :{" "}
              <span className="font-mono">
                Date Complété UTC, Nom Contrepartie, Référence, Montant payé
              </span>
              . Rien n&apos;est enregistré à l&apos;analyse — chaque encaissement est un clic
              confirmé, ligne par ligne.
            </p>
          </div>

          {erreur !== null && (
            <p
              role="alert"
              className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
            >
              {erreur}
            </p>
          )}

          <AdminButton type="submit" loading={analyseEnCours} disabled={!file}>
            Analyser le relevé
          </AdminButton>
        </form>
      </div>

      {resultat !== null && (
        <>
          {resultat.erreursParse.length > 0 && (
            <div className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-4)]">
              <p className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-warning)] uppercase">
                Lignes illisibles ({resultat.erreursParse.length})
              </p>
              <ul className="space-y-1">
                {resultat.erreursParse.slice(0, 20).map((er, i) => (
                  <li
                    key={i}
                    className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]"
                  >
                    {er}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <section>
            <h2 className={sectionHeadCls}>
              Encaissements avec facture suggérée ({resultat.suggestions.length})
            </h2>
            {resultat.suggestions.length === 0 ? (
              <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                Aucun crédit du relevé ne correspond à une facture ouverte (
                {resultat.nbFacturesOuvertes} facture{resultat.nbFacturesOuvertes > 1 ? "s" : ""}{" "}
                ouverte{resultat.nbFacturesOuvertes > 1 ? "s" : ""} considérée
                {resultat.nbFacturesOuvertes > 1 ? "s" : ""}).
              </p>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Contrepartie</th>
                    <th scope="col" className="text-right">
                      Montant
                    </th>
                    <th scope="col">Facture suggérée</th>
                    <th scope="col">Niveau</th>
                    <th scope="col">
                      <span className="sr-only">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {resultat.suggestions.map((s) => {
                    const cle = cleLigne(s.ligne);
                    const dejaEncaissee = encaissees.has(cle);
                    const erreurLigne = erreursLigne[cle];
                    return (
                      <tr key={cle}>
                        <td>{formatDateFrShort(s.ligne.dateIso)}</td>
                        <td>{s.ligne.contrepartie}</td>
                        <td className="text-right tabular-nums">{eur(s.ligne.montantCents)}</td>
                        <td>
                          <span className="font-mono text-[length:var(--text-admin-xs)]">
                            {s.facture.numero}
                          </span>{" "}
                          — {s.facture.clientLabel}
                          <span className="text-[color:var(--color-admin-fg-muted)]">
                            {" "}
                            (reste dû {eur(s.facture.resteDuCents)})
                          </span>
                        </td>
                        <td>
                          <AdminBadge tone={s.niveau === "exact" ? "success" : "warning"} dot>
                            {s.niveau === "exact" ? "Exact" : "Probable"}
                          </AdminBadge>
                        </td>
                        <td>
                          {dejaEncaissee ? (
                            <span
                              role="status"
                              className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
                            >
                              Encaissé
                            </span>
                          ) : aConfirmer === cle ? (
                            <span className="inline-flex items-center gap-[var(--space-admin-2)]">
                              <AdminButton
                                size="sm"
                                loading={encaissementEnCours}
                                onClick={() => rapprocher(s.ligne, s.facture.id)}
                              >
                                Confirmer {eur(s.ligne.montantCents)}
                              </AdminButton>
                              <AdminButton
                                variant="ghost"
                                size="sm"
                                disabled={encaissementEnCours}
                                onClick={() => setAConfirmer(null)}
                              >
                                Annuler
                              </AdminButton>
                            </span>
                          ) : (
                            <AdminButton
                              variant="secondary"
                              size="sm"
                              disabled={encaissementEnCours}
                              onClick={() => setAConfirmer(cle)}
                            >
                              Rapprocher
                            </AdminButton>
                          )}
                          {erreurLigne !== undefined && (
                            <p
                              role="alert"
                              className="mt-1 text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
                            >
                              {erreurLigne}
                            </p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>

          <section>
            <h2 className={sectionHeadCls}>
              Encaissements sans correspondance ({resultat.sansCorrespondance.length})
            </h2>
            {resultat.sansCorrespondance.length === 0 ? (
              <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                Tous les crédits du relevé ont une facture suggérée.
              </p>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Contrepartie</th>
                    <th scope="col">Référence</th>
                    <th scope="col" className="text-right">
                      Montant
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {resultat.sansCorrespondance.map((l) => (
                    <tr key={cleLigne(l)}>
                      <td>{formatDateFrShort(l.dateIso)}</td>
                      <td>{l.contrepartie}</td>
                      <td>{l.reference ?? "—"}</td>
                      <td className="text-right tabular-nums">{eur(l.montantCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <details className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-4)]">
            <summary className="cursor-pointer text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)]">
              Sorties — hors rapprochement ({resultat.debits.length})
            </summary>
            {resultat.debits.length === 0 ? (
              <p className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                Aucune sortie sur ce relevé.
              </p>
            ) : (
              <table className="admin-table mt-[var(--space-admin-3)]">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Contrepartie</th>
                    <th scope="col">Référence</th>
                    <th scope="col" className="text-right">
                      Montant
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {resultat.debits.map((l) => (
                    <tr key={cleLigne(l)}>
                      <td>{formatDateFrShort(l.dateIso)}</td>
                      <td>{l.contrepartie}</td>
                      <td>{l.reference ?? "—"}</td>
                      <td className="text-right tabular-nums">{eur(l.montantCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </details>
        </>
      )}
    </div>
  );
}
