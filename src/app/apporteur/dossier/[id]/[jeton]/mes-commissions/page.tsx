// « Mes commissions » : l'état de compte de l'apporteur, en LECTURE SEULE.
//
// `/apporteur/dossier/<id>/<jeton>/mes-commissions` : même lien personnel que l'espace. La page
// ne calcule rien : elle relit les montants et les états déjà écrits en base, SANS total, compteur,
// objectif ni classement. Composants SERVEUR (aucun JavaScript envoyé au navigateur).
//
//   · interrupteur éteint, lien faux ou révoqué, dossier non signé, mode restreint → 404 neutre ;
//   · le lien d'EXEMPLE de l'aperçu de la console → l'écran d'exemple, jamais un 404 ;
//   · base en panne → `error.tsx` de l'espace, jamais « 0 € » par défaut.

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { lireDossierParLien } from "@/features/apporteurs-reseau/donnees";
import { LIBELLE_ETAT_DECLARATION } from "@/features/apporteurs-reseau/declaration-regles";
import { lireEspaceCommissions } from "@/features/apporteurs-reseau/espace-commissions";
import type {
  CommissionVue,
  VirementAVenirVue,
} from "@/features/apporteurs-reseau/espace-commissions-assemblage";
import { mesCommissionsActive } from "@/features/apporteurs-reseau/interrupteur-mes-commissions";
import { ID_DOSSIER_EXEMPLE } from "@/features/apporteurs-reseau/jeton";
import { etatDeLaPage } from "@/features/apporteurs-reseau/signature";

import { Coquille, EcranEtat } from "../Coquille";
import { TEXTES } from "../textes";
import { TEXTES_COMMISSIONS as T, texteEtat } from "./textes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mes commissions — Axion-IA",
  robots: { index: false, follow: false, nocache: true },
  referrer: "same-origin",
};

const date = (d: Date) =>
  d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  });

const euros = (cents: number) =>
  `${(cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

const LIEN =
  "text-terracotta-deep inline-flex min-h-[44px] items-center gap-2 text-[17px] font-bold underline underline-offset-4";

function lienPiece(base: string, numero: string, libelle: string) {
  return (
    <a href={`${base}/factures/${numero}`} target="_blank" rel="noopener" className={LIEN}>
      ↓ {libelle}
    </a>
  );
}

function Ligne({ c }: { c: CommissionVue }) {
  const texte = texteEtat(c.etat, {
    facture: c.numeroFacture,
    factureLe: c.factureLe ? date(c.factureLe) : null,
    echeanceLe: c.echeanceLe ? date(c.echeanceLe) : null,
    verseeLe: c.verseeLe ? date(c.verseeLe) : null,
    avoir: c.numeroAvoir,
    montant: c.montantCents !== null ? euros(c.montantCents) : null,
  });
  if (!texte) return null;
  const reprise = c.etat === "reprise_a_deduire" || c.etat === "reprise_deduite";
  return (
    <li className="mt-2 text-[16px]">
      {c.nature ? <p className="text-fg-soft">{c.nature}</p> : null}
      {c.montantCents !== null && !reprise ? (
        <p className="font-bold">{T.commission(euros(c.montantCents))}</p>
      ) : null}
      <p>{texte}</p>
    </li>
  );
}

function Virement({ v, base }: { v: VirementAVenirVue; base: string }) {
  const m = v.montants;
  return (
    <div className="bg-paper border-border mt-2 rounded-2xl border p-4 text-[16px]">
      <p className="font-bold">{T.factureDu(v.numero, date(v.factureLe))}</p>
      {m === null ? (
        <p>{T.montantEnVerification}</p>
      ) : (
        <p>
          {v.regime === "assujetti" && m.tvaCents !== null
            ? T.assujetti(euros(m.htCents), euros(m.tvaCents), euros(m.ttcCents))
            : T.franchise(euros(m.htCents))}
        </p>
      )}
      <p className="text-fg-soft">{T.netApresAvoirs}</p>
      <p>{T.echeance(date(v.echeanceLe))}</p>
      {lienPiece(base, v.numero, T.telechargerFacture(v.numero))}
    </div>
  );
}

export default async function MesCommissionsPage({
  params,
}: {
  params: Promise<{ id: string; jeton: string }>;
}) {
  const { id, jeton } = await params;
  if (!mesCommissionsActive()) notFound();
  if (id.toLowerCase() === ID_DOSSIER_EXEMPLE) {
    return (
      <Coquille>
        <EcranEtat
          pastilleTexte={TEXTES.exemplePastille}
          titre={TEXTES.exempleTitre}
          ligne={TEXTES.exempleLigne}
        />
      </Coquille>
    );
  }
  const dossier = await lireDossierParLien(id, jeton);
  if (!dossier || dossier.restreint || etatDeLaPage(dossier.statut) !== "signe") notFound();

  const base = `/apporteur/dossier/${dossier.id}/${jeton}`;
  const vue = await lireEspaceCommissions(
    { id: dossier.id, regimeTva: dossier.regimeTva },
    new Date(),
  );

  return (
    <Coquille titre={T.titre}>
      <a href={base} className={LIEN}>
        {T.retour}
      </a>
      <p className="text-fg-soft mt-2 text-[17px]">{T.sousTitre}</p>

      {vue.virements.length > 0 ? (
        <section className="mt-6" aria-labelledby="virement">
          <h2 id="virement" className="font-serif text-[22px] font-medium">
            {T.virementTitre}
          </h2>
          {vue.virements.map((v) => (
            <Virement key={v.numero} v={v} base={base} />
          ))}
        </section>
      ) : null}

      <section className="mt-6" aria-labelledby="entreprises">
        <h2 id="entreprises" className="font-serif text-[22px] font-medium">
          {T.entreprisesTitre}
        </h2>
        {vue.entreprises.length === 0 ? (
          <p className="text-fg-soft mt-2 text-[16px]">{T.aucuneEntreprise}</p>
        ) : (
          <ul className="mt-2 grid gap-3">
            {vue.entreprises.map((e) => (
              <li key={e.cle} className="bg-paper border-border rounded-2xl border p-4">
                <h3 className="text-[18px] font-bold">{e.denomination}</h3>
                <p className="text-fg-soft text-[16px]">{T.presentee(date(e.presenteeLe))}</p>
                <p className="text-[16px]">
                  {e.valideeLe ? `${T.validee(date(e.valideeLe))} · ` : ""}
                  {e.reserveeJusquAu
                    ? T.reserveeJusquAu(date(e.reserveeJusquAu))
                    : LIBELLE_ETAT_DECLARATION[e.etat]}
                </p>
                {e.commissions.length > 0 ? (
                  <ul>
                    {e.commissions.map((c) => (
                      <Ligne key={c.cle} c={c} />
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {vue.horsEntreprise.length > 0 ? (
        <section className="mt-6" aria-labelledby="hors-entreprise">
          <h2 id="hors-entreprise" className="font-serif text-[22px] font-medium">
            {T.horsEntrepriseTitre}
          </h2>
          <ul className="mt-2 grid gap-2">
            {vue.horsEntreprise.map((c) => (
              <li key={c.cle} className="bg-paper border-border rounded-2xl border p-4 text-[16px]">
                {c.nature === "Parrainage" ? (
                  <p>
                    {T.parrainage(
                      c.numeroFacture ?? "",
                      c.montantCents !== null ? euros(c.montantCents) : null,
                      c.verseeLe ? `Réglée le ${date(c.verseeLe)}` : "Commission due",
                    )}
                  </p>
                ) : (
                  <ul>
                    <Ligne c={c} />
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-6" aria-labelledby="pieces">
        <h2 id="pieces" className="font-serif text-[22px] font-medium">
          {T.piecesTitre}
        </h2>
        {vue.pieces.length === 0 ? (
          <p className="text-fg-soft mt-2 text-[16px]">{T.aucuneFacture}</p>
        ) : (
          <ul className="mt-2 grid gap-1">
            {vue.pieces.map((p) => (
              <li key={p.numero} className="text-[16px]">
                <p>
                  {p.genre === "facture" ? T.factureDu(p.numero, date(p.le!)) : T.avoirDu(p.numero)}
                </p>
                {lienPiece(
                  base,
                  p.numero,
                  p.genre === "facture"
                    ? T.telechargerFacture(p.numero)
                    : T.telechargerAvoir(p.numero),
                )}
              </li>
            ))}
          </ul>
        )}
        {vue.tronque ? <p className="text-fg-soft mt-2 text-[16px]">{T.borne}</p> : null}
      </section>

      <section className="mt-6" aria-labelledby="comment">
        <h2 id="comment" className="font-serif text-[22px] font-medium">
          {T.commentTitre}
        </h2>
        {T.comment.map((l) => (
          <p key={l} className="mt-1 text-[16px]">
            {l}
          </p>
        ))}
        <a href={`${base}/commissions`} className={`${LIEN} mt-2`}>
          {T.grille} →
        </a>
      </section>
    </Coquille>
  );
}
