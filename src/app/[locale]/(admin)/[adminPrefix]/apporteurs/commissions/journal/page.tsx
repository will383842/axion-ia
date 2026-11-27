// Réseau d'apporteurs (point 25) — le JOURNAL des autofactures, pour l'expert-comptable.
// Lecture seule : période « du / au », tableau, totaux, trous de numérotation, exports CSV et FEC.

import { AdminCard, AdminPageHeader } from "@/components/admin/ui";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { jourParis } from "@/features/apporteurs-reseau/autofacture-donnees";
import { lireJournal } from "@/features/apporteurs-reseau/journal-autofactures";
import {
  jourFr,
  LIBELLE_TOTAUX_ABSENTS,
  montantFr,
} from "@/features/apporteurs-reseau/journal-autofactures-csv";
import { JOUR, totauxAbsents } from "@/features/apporteurs-reseau/journal-autofactures-types";
import { gardePage } from "@/server/auth/garde-page";
import { peutEngager } from "@/server/auth/habilitations";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function JournalAutofacturesPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const acces = await gardePage("consultation", `/fr/${adminPrefix}/login`);
  if (!acces.autorise) return <AccesRefuse motif={acces.motif} retourHref={`/fr/${adminPrefix}`} />;
  const peutExporter = peutEngager(acces.role, "facturer");
  const sp = await searchParams;
  const aujourdhui = jourParis(new Date());
  const au = sp.au && JOUR.test(sp.au) ? sp.au : aujourdhui;
  const du = sp.du && JOUR.test(sp.du) ? sp.du : `${au.slice(0, 4)}-01-01`;
  const valide = du <= au;
  const { lignes, trous } = valide ? await lireJournal({ du, au }) : { lignes: [], trous: [] };

  let ht = 0;
  let tva = 0;
  let ttc = 0;
  for (const l of lignes) {
    if (totauxAbsents(l)) continue;
    const s = l.genre === "avoir" ? -1 : 1;
    ht += s * l.totalHtCents!;
    tva += s * l.totalTvaCents!;
    ttc += s * l.totalTtcCents!;
  }
  const signe = (c: number) => `${c < 0 ? "−" : ""}${montantFr(c)} €`;
  const base = `/fr/${adminPrefix}/apporteurs/commissions/journal/export?du=${du}&au=${au}`;
  const absents = lignes.filter(totauxAbsents).length;

  return (
    <div className="flex flex-col gap-[var(--space-admin-5)]">
      <AdminPageHeader
        title="Journal des autofactures"
        description="Les pièces de la série AXI-APP émises sur la période, pour l'expert-comptable."
        actions={
          peutExporter && valide ? (
            <div className="flex flex-wrap gap-[var(--space-admin-2)]">
              <a href={`${base}&format=csv`} className="admin-button-secondary">
                Export CSV
              </a>
              <a href={`${base}&format=fec`} className="admin-button-secondary">
                Export FEC (comptes à confirmer)
              </a>
            </div>
          ) : undefined
        }
      />

      <AdminCard as="section">
        <form method="get" className="flex flex-wrap items-end gap-[var(--space-admin-3)]">
          <label className="flex flex-col text-[length:var(--text-admin-sm)]">
            Du
            <input type="date" name="du" defaultValue={du} className="admin-input" />
          </label>
          <label className="flex flex-col text-[length:var(--text-admin-sm)]">
            Au
            <input type="date" name="au" defaultValue={au} className="admin-input" />
          </label>
          <button type="submit" className="admin-button-secondary">
            Filtrer
          </button>
        </form>
        {!valide ? <p>La date de début doit précéder la date de fin.</p> : null}
      </AdminCard>

      {trous.length > 0 ? (
        <AdminCard as="section">
          <h2 className="font-semibold">Trous de numérotation</h2>
          <p className="text-[length:var(--text-admin-sm)]">
            Numéros absents à l&apos;intérieur de la série (affichage seulement) :{" "}
            {trous.join(", ")}.
          </p>
        </AdminCard>
      ) : null}

      {absents > 0 ? (
        <AdminCard as="section">
          <p className="text-[length:var(--text-admin-sm)]">
            {absents} pièce{absents > 1 ? "s" : ""} reprise{absents > 1 ? "s" : ""} sans totaux : le
            FEC sera refusé tant qu&apos;elles sont dans la période.
          </p>
        </AdminCard>
      ) : null}

      <AdminCard as="section">
        <table className="w-full text-[length:var(--text-admin-sm)]">
          <thead>
            <tr className="text-left">
              <th>Date</th>
              <th>Numéro</th>
              <th>Genre</th>
              <th>Apporteur</th>
              <th>Régime</th>
              <th className="text-right">HT</th>
              <th className="text-right">TVA</th>
              <th className="text-right">TTC</th>
              <th>Virée le</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => {
              const absent = totauxAbsents(l);
              return (
                <tr key={l.numero}>
                  <td>{jourFr(l.emiseAt)}</td>
                  <td>{l.numero}</td>
                  <td>
                    {l.genre === "avoir"
                      ? `Avoir (de ${l.factureRectifiee ?? "?"})`
                      : "Autofacture"}
                  </td>
                  <td>
                    {l.denomination ?? "—"} {l.siren ?? ""}
                  </td>
                  <td>{l.regimeTva === "assujetti" ? "Assujetti" : "Franchise 293 B"}</td>
                  {absent ? (
                    <td colSpan={3}>{LIBELLE_TOTAUX_ABSENTS}</td>
                  ) : (
                    <>
                      <td className="text-right">{montantFr(l.totalHtCents!)}</td>
                      <td className="text-right">{montantFr(l.totalTvaCents!)}</td>
                      <td className="text-right">{montantFr(l.totalTtcCents!)}</td>
                    </>
                  )}
                  <td>{l.viree.map(jourFr).join(" / ")}</td>
                </tr>
              );
            })}
            {lignes.length === 0 ? (
              <tr>
                <td colSpan={9}>Aucune pièce sur la période.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <p className="mt-[var(--space-admin-3)] font-semibold">
          Total net des avoirs : HT {signe(ht)} · TVA {signe(tva)} · TTC {signe(ttc)}
        </p>
      </AdminCard>
    </div>
  );
}
