"use client";
// use-client: composant chargé à la demande par l étape 4 ; reste client pour son lien et son cadre.

/**
 * Aperçu du devis tel que le client le lit (fiche E16). Rend la `VueApercuDevis` calculée par
 * le SERVEUR : aucun montant n'est calculé ici, les centimes reçus sont seulement formatés.
 * La mention de TVA et la version des CGV viennent de la vue (jamais écrites en dur).
 * Contrat C4 simulé : le type exact sera aligné sur celui du serveur au branchement (E17).
 */
export interface VueApercuDevis {
  numero: string;
  clientNom: string;
  validiteLibelle: string;
  objectif: string | null;
  lignes: Array<{ libelle: string; totalHtCents: number }>;
  totalHtCents: number;
  tvaCents: number;
  totalTtcCents: number;
  phases: Array<{
    rang: number;
    libelle: string;
    livrable: string;
    pourcentage: number;
    montantCents: number;
  }>;
  formules: Array<{
    cle: "A" | "B";
    titre: string;
    lignes: Array<{ libelle: string; montantHtCents: number }>;
    /** TVA et TTC de la mise en place, recopiés du serveur (jamais recalculés ici). */
    totalTvaCents?: number | undefined;
    totalTtcCents?: number | undefined;
  }>;
  /** Plafond de frais à confirmer, tel que fourni par le serveur ; absent ou null = aucun. */
  plafondAConfirmer?: { montantHtCents: number; texte: string } | null | undefined;
  servicesExterieurs: Array<{ nom: string; obligatoire: boolean; estimation: string }>;
  mentionTva: string | null;
  versionCgv: string;
}

const EUROS = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const euros = (c: number): string => EUROS.format(c / 100);

export function ApercuDevis({ vue, urlPdf }: { vue: VueApercuDevis; urlPdf: string }) {
  // Plusieurs formules : le total dépend du choix du client, aucun total global n'existe.
  const totauxGlobaux = vue.formules.length <= 1;
  return (
    <article
      aria-label="Aperçu du devis"
      className="m-[var(--space-admin-5)] rounded-[var(--radius-admin-md)] border-t-4 border-[color:var(--color-admin-accent)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-6)] shadow-[var(--shadow-admin-1)]"
    >
      <header className="mb-[var(--space-admin-6)] flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[length:var(--text-admin-lg)] font-semibold">
            Proposition n° {vue.numero}
          </p>
          <p>
            Préparée pour {vue.clientNom} · valable jusqu&apos;au {vue.validiteLibelle}
          </p>
        </div>
        <a
          href={urlPdf}
          target="_blank"
          rel="noopener noreferrer"
          className="admin-button-secondary"
        >
          Ouvrir le PDF
        </a>
      </header>

      {vue.objectif ? (
        <section className="mb-[var(--space-admin-6)]">
          <h4 className="mb-[var(--space-admin-2)] font-semibold">Votre objectif</h4>
          <p>{vue.objectif}</p>
        </section>
      ) : null}

      {totauxGlobaux || vue.lignes.length > 0 ? (
        <section className="mb-[var(--space-admin-6)]">
          <h4 className="mb-[var(--space-admin-2)] font-semibold">Ce que vous recevez</h4>
          <ul className="list-none p-0">
            {vue.lignes.map((l, i) => (
              <li
                key={i}
                className="flex justify-between gap-[var(--space-admin-3)] py-[var(--space-admin-1)]"
              >
                <span>{l.libelle}</span>
                <span className="text-right whitespace-nowrap tabular-nums">
                  {euros(l.totalHtCents)}
                </span>
              </li>
            ))}
          </ul>
          {totauxGlobaux ? (
            <>
              <p className="mt-[var(--space-admin-2)] flex justify-between border-t border-[color:var(--color-admin-border)] pt-[var(--space-admin-2)] font-semibold">
                <span>Total hors taxes</span>
                <span className="text-right whitespace-nowrap tabular-nums">
                  {euros(vue.totalHtCents)}
                </span>
              </p>
              <p className="flex justify-between">
                <span>TVA</span>
                <span className="text-right whitespace-nowrap tabular-nums">
                  {euros(vue.tvaCents)}
                </span>
              </p>
              <p className="flex justify-between">
                <span>Total TTC</span>
                <span className="text-right whitespace-nowrap tabular-nums">
                  {euros(vue.totalTtcCents)}
                </span>
              </p>
            </>
          ) : null}
        </section>
      ) : null}

      {vue.phases.length > 0 ? (
        <section className="mb-[var(--space-admin-6)]">
          <h4 className="mb-[var(--space-admin-2)] font-semibold">Les phases et vos versements</h4>
          <ol className="list-none p-0">
            {vue.phases.map((p) => (
              <li
                key={p.rang}
                className="flex justify-between gap-[var(--space-admin-3)] py-[var(--space-admin-1)]"
              >
                <span>
                  {p.rang}. {p.libelle}
                  {p.livrable !== "" ? ` · ${p.livrable}` : ""} · {p.pourcentage} %
                </span>
                <span className="text-right whitespace-nowrap tabular-nums">
                  {euros(p.montantCents)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {vue.formules.map((f) => (
        <section key={f.cle} className="mb-[var(--space-admin-6)]" aria-label={`Formule ${f.cle}`}>
          <h4 className="mb-[var(--space-admin-2)] font-semibold">
            Formule {f.cle} · {f.titre}
          </h4>
          <ul className="list-none p-0">
            {f.lignes.map((l, i) => (
              <li
                key={i}
                className="flex justify-between gap-[var(--space-admin-3)] py-[var(--space-admin-1)]"
              >
                <span>{l.libelle}</span>
                <span className="text-right whitespace-nowrap tabular-nums">
                  {euros(l.montantHtCents)} HT
                </span>
              </li>
            ))}
          </ul>
          {f.totalTvaCents !== undefined ? (
            <p className="flex justify-between">
              <span>TVA sur la mise en place</span>
              <span className="text-right whitespace-nowrap tabular-nums">
                {euros(f.totalTvaCents)}
              </span>
            </p>
          ) : null}
          {f.totalTtcCents !== undefined ? (
            <p className="flex justify-between">
              <span>Mise en place TTC</span>
              <span className="text-right whitespace-nowrap tabular-nums">
                {euros(f.totalTtcCents)}
              </span>
            </p>
          ) : null}
        </section>
      ))}

      {vue.plafondAConfirmer ? (
        <p role="note" className="mb-[var(--space-admin-6)]">
          {vue.plafondAConfirmer.texte} ({euros(vue.plafondAConfirmer.montantHtCents)} HT)
        </p>
      ) : null}

      {vue.servicesExterieurs.length > 0 ? (
        <section className="mb-[var(--space-admin-6)]">
          <h4 className="mb-[var(--space-admin-2)] font-semibold">
            Services extérieurs nécessaires
          </h4>
          <ul className="list-none p-0">
            {vue.servicesExterieurs.map((s, i) => (
              <li
                key={i}
                className="flex justify-between gap-[var(--space-admin-3)] py-[var(--space-admin-1)]"
              >
                <span>
                  {s.nom} · {s.obligatoire ? "obligatoire" : "facultatif"}
                </span>
                <span className="text-right whitespace-nowrap">{s.estimation}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="border-t border-[color:var(--color-admin-border)] pt-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        {vue.mentionTva ? <p>{vue.mentionTva}</p> : null}
        <p>Conditions générales de vente : {vue.versionCgv}, à accepter lors de la signature.</p>
      </footer>
    </article>
  );
}
