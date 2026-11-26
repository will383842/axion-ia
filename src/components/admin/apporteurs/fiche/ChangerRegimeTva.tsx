"use client";
// use-client: formulaire à état local (régime, n° de TVA, date, confirmation, retour du serveur).

// Fiche apporteur : « Changer le régime de TVA à compter du JJ/MM/AAAA » (contrat 2.8, art. 4.7 et 6.3).
// Le droit « contresigner », le contrat signé et toutes les règles sont refaits côté serveur
// (`changerRegimeTvaAction`). Les autofactures déjà émises ne sont jamais modifiées.

import { useState, useTransition } from "react";

import {
  annulerChangementRegimeTvaAction,
  changerRegimeTvaAction,
  piecesEmisesDepuisAction,
} from "@/features/apporteurs-reseau/actions-regime-tva";

export interface ChangementAffiche {
  id: string;
  libelle: string;
  effetLe: string;
  saisiLe: string;
  annule: boolean;
  aVenir: boolean;
}

export function ChangerRegimeTva({
  apporteurId,
  regimeActuel,
  historique,
}: {
  apporteurId: string;
  regimeActuel: "assujetti" | "franchise_293b" | null;
  historique: ChangementAffiche[];
}) {
  const [regime, setRegime] = useState<"assujetti" | "franchise_293b">(
    regimeActuel === "assujetti" ? "franchise_293b" : "assujetti",
  );
  const [pieces, setPieces] = useState<Array<{ numero: string; emiseLe: string }>>([]);
  const [confirme, setConfirme] = useState(false);
  const [retour, setRetour] = useState<{ ok: boolean; message: string } | null>(null);
  const [enCours, demarrer] = useTransition();

  const apercu = (effetAu: string) => {
    demarrer(async () => {
      const r = await piecesEmisesDepuisAction({ apporteurId, effetAu });
      setPieces(r.ok ? r.pieces : []);
      setConfirme(false);
    });
  };

  return (
    <details className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
      <summary className="cursor-pointer">Changer le régime de TVA</summary>
      <form
        className="mt-[var(--space-admin-2)] flex flex-col gap-[var(--space-admin-2)]"
        onSubmit={(ev) => {
          ev.preventDefault();
          const fd = new FormData(ev.currentTarget);
          demarrer(async () => {
            const r = await changerRegimeTvaAction({
              apporteurId,
              regimeTva: regime,
              numeroTva: String(fd.get("numeroTva") ?? ""),
              effetAu: String(fd.get("effetAu") ?? ""),
              confirmePiecesEmises: confirme,
            });
            if (!r.ok && r.piecesEmises) setPieces(r.piecesEmises);
            setRetour({ ok: r.ok, message: r.message });
          });
        }}
      >
        <label className="flex flex-col gap-1">
          Nouveau régime
          <select
            className="admin-input"
            value={regime}
            onChange={(e) => setRegime(e.target.value as "assujetti" | "franchise_293b")}
          >
            <option value="assujetti">Facture la TVA</option>
            <option value="franchise_293b">Ne facture pas la TVA (franchise, 293 B)</option>
          </select>
        </label>
        {regime === "assujetti" ? (
          <label className="flex flex-col gap-1">
            Numéro de TVA (obligatoire)
            <input
              name="numeroTva"
              required
              maxLength={20}
              placeholder="FR12345678901"
              className="admin-input"
            />
          </label>
        ) : null}
        <label className="flex flex-col gap-1">
          À compter du (JJ/MM/AAAA)
          <input
            name="effetAu"
            required
            inputMode="numeric"
            pattern="\d{2}/\d{2}/\d{4}"
            placeholder="01/12/2026"
            className="admin-input"
            onBlur={(e) => apercu(e.currentTarget.value)}
          />
        </label>
        <p className="text-[color:var(--color-admin-fg-muted)]">
          S&apos;applique aux autofactures établies à partir de cette date (art. 4.7). Les pièces
          déjà émises ne sont jamais modifiées : une commission facturée sans TVA reste sans TVA au
          virement. La commission reste en hors taxes.
        </p>
        {pieces.length > 0 ? (
          <div role="alert" className="text-[color:var(--color-admin-warning-fg)]">
            Ces {pieces.length} pièces ont déjà été émises depuis cette date et restent au régime
            d&apos;alors : {pieces.map((p) => p.numero).join(", ")}. Toute rectification est une
            décision à part ; l&apos;apporteur supporte les conséquences d&apos;une information
            tardive (art. 6.3).
            <label className="mt-1 flex items-center gap-2">
              <input
                type="checkbox"
                checked={confirme}
                onChange={(e) => setConfirme(e.target.checked)}
              />
              Je confirme
            </label>
          </div>
        ) : null}
        <button type="submit" className="admin-button-secondary" disabled={enCours}>
          Enregistrer
        </button>
        {retour ? (
          <p
            role={retour.ok ? "status" : "alert"}
            className={
              retour.ok
                ? "text-[color:var(--color-admin-success)]"
                : "text-[color:var(--color-admin-destructive)]"
            }
          >
            {retour.message}
          </p>
        ) : null}
      </form>
      {historique.length > 0 ? (
        <ul className="mt-[var(--space-admin-3)] flex flex-col gap-1">
          {historique.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className={c.annule ? "line-through" : undefined}>
                {c.libelle} — à compter du {c.effetLe} (saisi le {c.saisiLe})
              </span>
              {c.aVenir && !c.annule ? (
                <button
                  type="button"
                  className="admin-button-secondary"
                  disabled={enCours}
                  onClick={() =>
                    demarrer(async () =>
                      setRetour(
                        await annulerChangementRegimeTvaAction({ apporteurId, changementId: c.id }),
                      ),
                    )
                  }
                >
                  Annuler ce changement
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </details>
  );
}
