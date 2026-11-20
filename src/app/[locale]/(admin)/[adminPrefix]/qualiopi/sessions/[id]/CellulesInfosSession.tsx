import Link from "next/link";

const infoLabelCls =
  "text-[length:var(--text-admin-xs)] tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase";
const infoValueCls =
  "m-0 mt-0.5 text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)]";
const sousCls = "m-0 text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]";
const lienCls = "text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline";

/**
 * Cellules d'identité de la session (présentation seulement). Structure figée
 * par l'E2E 01-presentiel : `#infos > div > div` = une cellule (libellé puis
 * valeur, texte commençant par le libellé). Ne pas passer en `<dl>`.
 */
export function CellulesInfosSession(props: {
  locale: string;
  adminPrefix: string;
  base: string;
  formation: { id: string; numero: string; titre: string };
  client: { id: string; numero: string; raisonSociale: string } | null;
  /** Lien vers la fiche client, construit par la page. */
  hrefClient?: string | null;
  modaliteLibelle: string;
  financementLibelle: string;
  inscrits: number;
  prevus: number;
  reels: number | null;
  montantHtCents: number;
  mentionTva: string | null;
  dureeReelleHeures: number | null;
  sessionParentId: string | null;
  sessionReporteeId: string | null;
}) {
  const {
    locale,
    adminPrefix,
    base,
    formation,
    client,
    hrefClient = null,
    modaliteLibelle,
    financementLibelle,
    inscrits,
    prevus,
    reels,
    montantHtCents,
    mentionTva,
    dureeReelleHeures,
    sessionParentId,
    sessionReporteeId,
  } = props;
  return (
    <div className="grid grid-cols-2 gap-[var(--space-admin-4)] sm:grid-cols-4">
      {/* Formation */}
      <div>
        <p className={infoLabelCls}>Formation</p>
        <p className={infoValueCls}>
          <Link
            href={`/${locale}/${adminPrefix}/qualiopi/formations/${formation.id}`}
            className={lienCls}
          >
            {formation.numero}
          </Link>
        </p>
        <p className={sousCls}>{formation.titre}</p>
      </div>

      {/* Modalité */}
      <div>
        <p className={infoLabelCls}>Modalité</p>
        <p className={infoValueCls}>{modaliteLibelle}</p>
      </div>

      {/* Stagiaires — « participant » reste au marketing public, jamais en console. */}
      <div>
        <p className={infoLabelCls}>Stagiaires</p>
        <p className={infoValueCls}>
          {inscrits} inscrits / {prevus} prévus
        </p>
        {reels !== null && <p className={sousCls}>{reels} réels</p>}
      </div>

      {/* Montant HT */}
      <div>
        <p className={infoLabelCls}>Montant HT</p>
        <p className={infoValueCls}>
          {(montantHtCents / 100).toLocaleString("fr-FR", {
            style: "currency",
            currency: "EUR",
          })}
        </p>
        {/* Vérification E2E 2026-07-26 — cet écran affirmait « Exonéré TVA »
                    en dur, juste sous un Montant HT que le PDF facture à 20 %. La
                    mention suit désormais `qualiopi.regime_tva` et disparaît en
                    régime assujetti, comme sur les documents. */}
        {mentionTva !== null && <p className={sousCls}>{mentionTva}</p>}
      </div>

      {/* Client */}
      {client !== null && (
        <div>
          <p className={infoLabelCls}>Client</p>
          <p className={infoValueCls}>
            {/* 🔴 L2 — menait à la LISTE des clients : on y cherchait le sien. */}
            {hrefClient !== null ? (
              <Link href={hrefClient} className={lienCls}>
                {client.numero}
              </Link>
            ) : (
              client.numero
            )}
          </p>
          <p className={sousCls}>{client.raisonSociale}</p>
        </div>
      )}

      {/* Financement */}
      <div>
        <p className={infoLabelCls}>Financement</p>
        <p className={infoValueCls}>{financementLibelle}</p>
      </div>

      {/* Durée réelle */}
      {dureeReelleHeures !== null && (
        <div>
          <p className={infoLabelCls}>Durée réelle</p>
          <p className={infoValueCls}>{dureeReelleHeures} h</p>
        </div>
      )}

      {/* Session parente (récurrence) */}
      {sessionParentId !== null && (
        <div>
          <p className={infoLabelCls}>Session parente</p>
          <p className={infoValueCls}>
            <Link href={`${base}/${sessionParentId}`} className={lienCls}>
              Voir la session parente
            </Link>
          </p>
        </div>
      )}

      {/* Session reportée */}
      {sessionReporteeId !== null && (
        <div>
          <p className={infoLabelCls}>Reporte la session</p>
          <p className={infoValueCls}>
            <Link href={`${base}/${sessionReporteeId}`} className={lienCls}>
              Voir la session d&apos;origine
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
