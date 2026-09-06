"use client";
// use-client: fieldset contrôlé (état remonté au parent). Aucun appel serveur ici.

/**
 * LieuFieldset — Saisie du lieu de déroulement d&apos;une session.
 *
 * Partagé par `SessionForm` (création) et `SessionLieuForm` (correction depuis la
 * fiche session) : une seule définition des champs, des libellés et des règles
 * d&apos;affichage. Les faire diverger reviendrait à ce qu&apos;une session créée
 * et une session corrigée ne décrivent pas le même objet.
 *
 * Composant CONTRÔLÉ : il ne détient aucun état et n&apos;appelle aucune action.
 */

import type { LieuValues } from "@/components/admin/qualiopi/lieu-values";
import { libellesAcces } from "@/server/qualiopi/lieu/libelles-acces";

export interface LieuFieldsetProps {
  value: LieuValues;
  onChange: (patch: Partial<LieuValues>) => void;
  disabled?: boolean;
  /** Préfixe des `id` HTML — deux instances peuvent coexister sur une page. */
  idPrefix?: string;
  /**
   * Modalité de la session. Nécessaire parce que `LieuType` ne porte PAS
   * l&apos;hybride : une session hybride se déroule dans une salle ET en visio,
   * et son lieu ne se décrit donc pas par un seul des deux blocs.
   */
  modalite?: "presentiel" | "distanciel" | "hybride" | undefined;
}

const TYPE_OPTIONS = [
  { value: "", label: "— Non précisé —" },
  { value: "sur_site", label: "Sur site (chez le client)" },
  { value: "nos_locaux", label: "Nos locaux" },
  { value: "distanciel", label: "Distanciel (visioconférence)" },
] as const;

export function LieuFieldset({
  value,
  onChange,
  disabled = false,
  idPrefix = "lieu",
  modalite,
}: LieuFieldsetProps): React.ReactElement {
  const labelCls =
    "block text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-[var(--space-admin-1)]";
  const inputCls =
    "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";

  // Le distanciel n'a pas d'adresse postale, le présentiel n'a pas d'URL de
  // visio. Afficher les deux inviterait à remplir les deux, et la convention
  // annoncerait un lieu qui se contredit lui-même.
  //
  // 🔴 L'HYBRIDE est l'exception, et elle manquait (recette 2026-09-03) : une
  // session hybride se tient dans une salle ET en visio. Comme `LieuType` ne
  // porte que trois valeurs — aucune ne dit « les deux » — le fieldset la
  // rendait indescriptible : « Sur site » masquait le lien de visio, et les
  // participants à distance n'avaient aucune manière d'entrer ; « Distanciel »
  // masquait l'adresse, et ceux sur place non plus. On affiche donc les deux
  // blocs quand la modalité est hybride — le seul cas où ils ne se
  // contredisent pas.
  const estDistanciel = value.lieuType === "distanciel";
  const estHybride = modalite === "hybride";
  const afficherAdresse = !estDistanciel;
  const afficherVisio = estDistanciel || estHybride;

  // 🔴 F4 — les mots de la porte survivaient en visioconférence.
  //
  // Recette du 2026-09-04, session AXI-SESS-2026-001, modalité « Distanciel » :
  // les CHAMPS adresse / CP / ville / salle disparaissaient bien, mais trois
  // LIBELLÉS restaient ceux du présentiel — « Contact sur place », « Consignes
  // d'accès », et l'aide qui promettait un envoi « avec l'adresse, la salle et
  // le contact » alors qu'il n'y a ni adresse ni salle.
  //
  // C'est le même défaut que l'alerte de la PR 980 : l'écran de SORTIE avait été rendu
  // par modalité, l'écran de SAISIE qui l'alimente ne l'avait pas été. Les cinq
  // chaînes viennent donc d'UNE fonction, et sa garde exige qu'elles bougent
  // TOUTES ensemble — trois ternaires côte à côte se corrigent une par une, et
  // on en oublie une : c'est précisément ce qui s'était produit.
  const mots = libellesAcces(value.lieuType, modalite);

  return (
    <fieldset className="mb-[var(--space-admin-5)] rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]">
      <legend className="px-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
        Lieu de déroulement
      </legend>
      <p className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
        Imprimé sur la convention, la convocation et la feuille d&apos;émargement. Laissé vide, ces
        documents retombent sur l&apos;adresse de l&apos;organisme.
      </p>

      <div className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor={`${idPrefix}-type`}>
            Type de lieu
          </label>
          <select
            id={`${idPrefix}-type`}
            value={value.lieuType}
            onChange={(e) => onChange({ lieuType: e.target.value as LieuValues["lieuType"] })}
            disabled={disabled}
            className={inputCls}
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls} htmlFor={`${idPrefix}-intitule`}>
            Intitulé du lieu
          </label>
          <input
            id={`${idPrefix}-intitule`}
            value={value.lieuIntitule}
            onChange={(e) => onChange({ lieuIntitule: e.target.value })}
            disabled={disabled}
            maxLength={200}
            placeholder="Ex. : Siège du client"
            className={inputCls}
          />
        </div>

        {afficherAdresse && (
          <>
            <div className="sm:col-span-2">
              <label className={labelCls} htmlFor={`${idPrefix}-adresse`}>
                Adresse
              </label>
              <input
                id={`${idPrefix}-adresse`}
                value={value.lieuAdresse}
                onChange={(e) => onChange({ lieuAdresse: e.target.value })}
                disabled={disabled}
                maxLength={500}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor={`${idPrefix}-cp`}>
                Code postal
              </label>
              <input
                id={`${idPrefix}-cp`}
                value={value.lieuCodePostal}
                onChange={(e) => onChange({ lieuCodePostal: e.target.value })}
                disabled={disabled}
                maxLength={10}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor={`${idPrefix}-ville`}>
                Ville
              </label>
              <input
                id={`${idPrefix}-ville`}
                value={value.lieuVille}
                onChange={(e) => onChange({ lieuVille: e.target.value })}
                disabled={disabled}
                maxLength={120}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor={`${idPrefix}-salle`}>
                Salle
              </label>
              <input
                id={`${idPrefix}-salle`}
                value={value.lieuSalle}
                onChange={(e) => onChange({ lieuSalle: e.target.value })}
                disabled={disabled}
                maxLength={120}
                // Les documents PRÉFIXENT « Salle » (cf. `formatLieu`). Sans
                // exemple, on saisit « Salle Vercors » et la convention imprime
                // « Salle Salle Vercors ». Vu en recette le 2026-09-03.
                placeholder="Ex. : Vercors, 2e étage"
                className={inputCls}
              />
            </div>
          </>
        )}

        {afficherVisio && (
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor={`${idPrefix}-visio`}>
              Lien de visioconférence
            </label>
            <input
              id={`${idPrefix}-visio`}
              type="url"
              inputMode="url"
              value={value.lieuVisioUrl}
              onChange={(e) => onChange({ lieuVisioUrl: e.target.value })}
              disabled={disabled}
              maxLength={2000}
              placeholder="https://meet.google.com/…"
              className={inputCls}
            />
            <p className="mt-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
              Seul l&apos;hôte (ex. « meet.google.com ») apparaît sur les documents — jamais le lien
              complet, qui vaut souvent clé d&apos;accès.
              {estHybride
                ? " Session hybride : les participants sur place ont l'adresse ci-dessus, ceux à distance ce lien."
                : ""}
            </p>
          </div>
        )}

        {/* ── Accès pour le formateur (2026-09-03) ───────────────────────────
            Ces trois champs partent dans la convocation J-7 et le rappel J-1
            du FORMATEUR, et s'affichent dans son espace. Ils ne figurent sur
            aucun document remis au client. Toujours visibles : en distanciel
            aussi, il y a quelqu'un à joindre si le lien ne s'ouvre pas —
            seuls leurs LIBELLÉS changent (cf. `mots`, plus haut). */}
        <div>
          <label className={labelCls} htmlFor={`${idPrefix}-contact-nom`}>
            {mots.contactNom}
          </label>
          <input
            id={`${idPrefix}-contact-nom`}
            value={value.contactSurPlaceNom}
            onChange={(e) => onChange({ contactSurPlaceNom: e.target.value })}
            disabled={disabled}
            maxLength={160}
            placeholder="Ex. : Camille Dupont, accueil"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor={`${idPrefix}-contact-tel`}>
            {mots.contactTelephone}
          </label>
          <input
            id={`${idPrefix}-contact-tel`}
            type="tel"
            inputMode="tel"
            value={value.contactSurPlaceTelephone}
            onChange={(e) => onChange({ contactSurPlaceTelephone: e.target.value })}
            disabled={disabled}
            maxLength={40}
            className={inputCls}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls} htmlFor={`${idPrefix}-consignes`}>
            {mots.consignes}
          </label>
          <textarea
            id={`${idPrefix}-consignes`}
            value={value.consignesAcces}
            onChange={(e) => onChange({ consignesAcces: e.target.value })}
            disabled={disabled}
            maxLength={2000}
            rows={3}
            placeholder={mots.consignesPlaceholder}
            className={inputCls}
          />
          <p className="mt-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            {mots.aide}
          </p>
        </div>
      </div>
    </fieldset>
  );
}
