"use client";
// use-client: formulaire d'édition avec état local + Server Action updateClientAction + router.refresh().

/**
 * Édition de la fiche client — identité et CONTACT.
 *
 * ## Le manque que cet écran comble
 *
 * `updateClientAction` accepte depuis toujours `raisonSociale`, `siret`,
 * `nafCode`, `adresse`, `contactNom`, `contactEmail`, `contactTelephone` et
 * `contactFonction` — et **aucune interface ne les lui envoyait jamais**. Seul
 * `ClientBrancheForm` l'appelait, avec trois champs (IDCC, taille, OPCO).
 *
 * Conséquence concrète : une fois un client créé, son contact était figé. Or un
 * devis ne part pas sans adresse de contact (`devis.ts` : `signatureAttendue`
 * exige `contactEmail`), et c'est à cette adresse que part le lien de signature.
 * Une faute de frappe à la création bloquait donc tout le circuit commercial,
 * sans aucun moyen de la corriger depuis l'interface.
 *
 * C'est le cas d'école du code que rien n'appelle : l'action était écrite,
 * testée, et inatteignable. Aucun des 20 000 tests ne pouvait le voir, parce
 * qu'aucun test ne teste ce qui n'est jamais appelé.
 *
 * ## 🔴 Envoi DIFFÉRENTIEL — on n'envoie que ce qui a changé
 *
 * Ce n'est pas une optimisation, c'est une garde. `updateClientAction` déclenche
 * la **ré-inférence OPCO** dès que `nafCode` ou `idcc` est transmis, et sa
 * protection (« seulement si l'OPCO est vide en base ») serait la seule chose
 * qui empêcherait, sur un envoi systématique, d'annuler en silence une
 * correction manuelle d'OPCO à chaque enregistrement d'un champ sans rapport.
 *
 * C'est exactement le raisonnement déjà tenu dans `ClientBrancheForm` : « en
 * omettant la clé quand rien n'a bougé, la ré-inférence serveur reste armée ».
 * On ne le contourne pas par une autre porte.
 *
 * ⚠️ Cet écran ne touche NI l'OPCO, NI l'IDCC, NI la taille, NI l'effectif : ils
 * restent sur `ClientBrancheForm`, qui porte leur logique. Deux écrans écrivant
 * la même donnée avec deux règles différentes, c'est l'endroit où les deux
 * copies divergent en silence. Le nombre de salariés s'affiche ici en lecture.
 *
 * ## Lot A2 — formulaire complet
 *
 * Entreprise, adresse en trois champs, origine du client, contact, facturation :
 * tout passe par `updateClientAction`, aucun nouvel écrivain de `clients`.
 * « Secteur public » reste en lecture : il déclenche le dépôt Chorus Pro
 * (`facture-libre.ts`), donc il ne se change pas d'ici.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateClientAction } from "@/server/actions/qualiopi/clients";
import { checkSiretFormat } from "@/lib/siret";
import { DELAI_PAIEMENT_MAX_JOURS } from "@/server/qualiopi/financements/conditions-client";
import { AdminBloc } from "@/components/admin/ui/AdminBloc";

export interface ClientEditValues {
  raisonSociale: string;
  siret: string;
  tvaIntracom: string;
  nafCode: string;
  secteur: string;
  source: string;
  adresseRue: string;
  adresseCodePostal: string;
  adresseVille: string;
  contactNom: string;
  contactEmail: string;
  contactTelephone: string;
  contactFonction: string;
  /** Nombre de jours, en chaîne (« » = non défini). */
  delaiPaiementJours: string;
  /** Pourcentage entier, en chaîne (« » = non défini). */
  tauxAcomptePct: string;
  /** `acompte_solde` | `solde_unique` | « » = non défini. */
  modeFacturation: string;
}

/**
 * Réglages booléens du client, tenus à part des champs texte.
 *
 * Les champs texte se comparent au `trim()` pour décider quoi transmettre ; un
 * booléen n'a pas de trim. Les mélanger obligerait à encoder « true »/« false »
 * en chaînes, et un jour quelqu'un lirait `"false"` comme une valeur vraie.
 */
export interface ClientEditFlags {
  /** Applique-t-on les pénalités de retard à ce client ? Faux par défaut. */
  penalitesRetardActives: boolean;
}

/** Valeurs affichées en lecture seule (écrites ailleurs). */
export interface ClientEditLecture {
  siren: string | null;
  effectif: number | null;
  estPublic: boolean;
  /** Ancienne adresse en texte libre, montrée tant que les 3 champs sont vides. */
  adresseHistorique: string | null;
  /** Lien vers la fiche, onglet Résumé (bloc « Branche et OPCO »). */
  brancheHref: string;
}

export interface ClientEditFormProps {
  clientId: string;
  /** `true` pour un particulier : les champs entreprise sont masqués. */
  estParticulier: boolean;
  initial: ClientEditValues;
  /** Réglages booléens (pénalités de retard). Défaut : tout à faux. */
  initialFlags?: ClientEditFlags;
  lecture?: ClientEditLecture;
  /** Où revenir après enregistrement. */
  retourHref: string;
}

const FLAGS_PAR_DEFAUT: ClientEditFlags = { penalitesRetardActives: false };

/** Chaîne de saisie → entier, ou `null` si vide ; `NaN` si non numérique. */
function entierOuNull(saisie: string): number | null {
  const t = saisie.trim();
  return t === "" ? null : Number(t);
}

export function ClientEditForm({
  clientId,
  estParticulier,
  initial,
  initialFlags = FLAGS_PAR_DEFAUT,
  lecture,
  retourHref,
}: ClientEditFormProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  // Lot A9 : SIREN en base conservé parce que le SIRET saisi le contredit.
  const [avertissement, setAvertissement] = useState<string | null>(null);

  const [v, setV] = useState<ClientEditValues>(initial);
  const [flags, setFlags] = useState<ClientEditFlags>(initialFlags);

  function set<K extends keyof ClientEditValues>(cle: K, valeur: string) {
    setV((p) => ({ ...p, [cle]: valeur }));
    setOk(false);
  }

  function setFlag<K extends keyof ClientEditFlags>(cle: K, valeur: boolean) {
    setFlags((p) => ({ ...p, [cle]: valeur }));
    setOk(false);
  }

  // Contrôle LOCAL du SIRET, purement indicatif : le serveur reste l'autorité
  // (même module). On n'en fait délibérément PAS un gate du bouton — un
  // formulaire indébloquable sur une divergence client/serveur coûterait plus
  // cher que la saisie fautive qu'il éviterait.
  const siretSaisi = v.siret.trim();
  const siretCheck = siretSaisi === "" ? null : checkSiretFormat(siretSaisi);
  const siretErreur = siretCheck !== null && !siretCheck.ok ? siretCheck.message : null;

  const modifie =
    (Object.keys(initial) as Array<keyof ClientEditValues>).some(
      (k) => v[k].trim() !== initial[k].trim(),
    ) ||
    (Object.keys(initialFlags) as Array<keyof ClientEditFlags>).some(
      (k) => flags[k] !== initialFlags[k],
    );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);

    /** Vrai si ce champ a bougé — seul cas où on le transmet. */
    const change = (k: keyof ClientEditValues) => v[k].trim() !== initial[k].trim();
    /** Texte vidé volontairement → `null` (efface), jamais `""`. */
    const texteOuNull = (k: keyof ClientEditValues) => (v[k].trim() === "" ? null : v[k].trim());

    // Les chiffres sont contrôlés ici AVANT l'envoi : `Number("abc")` donnerait
    // `NaN`, que le schéma refuse avec un message moins clair.
    const delai = entierOuNull(v.delaiPaiementJours);
    const acompte = entierOuNull(v.tauxAcomptePct);
    if (change("delaiPaiementJours") && delai !== null && !Number.isInteger(delai)) {
      setError("Délai de paiement : un nombre entier de jours est attendu.");
      return;
    }
    if (change("tauxAcomptePct") && acompte !== null && !Number.isInteger(acompte)) {
      setError("Acompte : un pourcentage entier est attendu.");
      return;
    }

    const adresseChangee =
      change("adresseRue") || change("adresseCodePostal") || change("adresseVille");
    // L'ancienne adresse en texte libre suit les trois champs : deux vérités
    // différentes sur la même adresse seraient lues par des écrans différents.
    const adresseLibre = [
      v.adresseRue.trim(),
      `${v.adresseCodePostal.trim()} ${v.adresseVille.trim()}`.trim(),
    ]
      .filter((x) => x !== "")
      .join(", ");

    startTransition(async () => {
      const result = await updateClientAction({
        id: clientId,
        ...(change("raisonSociale") ? { raisonSociale: v.raisonSociale.trim() } : {}),
        ...(change("adresseRue") ? { adresseRue: texteOuNull("adresseRue") } : {}),
        ...(change("adresseCodePostal")
          ? { adresseCodePostal: texteOuNull("adresseCodePostal") }
          : {}),
        ...(change("adresseVille") ? { adresseVille: texteOuNull("adresseVille") } : {}),
        // 🔴 L'ancienne adresse libre n'est recomposée QUE si la rue est saisie :
        // l'écran de création y range la rue seule, et la réécrire sans rue
        // (ville ou code postal seuls) la perdrait. Trois champs vidés : rien
        // n'est envoyé pour `adresse`, jamais `""`.
        ...(adresseChangee && v.adresseRue.trim() !== "" ? { adresse: adresseLibre } : {}),
        ...(change("secteur") ? { secteur: v.secteur.trim() } : {}),
        ...(change("source") ? { source: v.source.trim() } : {}),
        ...(change("contactNom") ? { contactNom: v.contactNom.trim() } : {}),
        // 🔴 Vidé volontairement → `null`, pas `""`. Le schéma refuse `""`
        // (`.email()`), et une chaîne vide écrite en base ne serait pas
        // « pas d'adresse » : `devis.ts` teste `contactEmail !== null`, et un
        // `""` passerait ce test pour échouer plus loin, à l'envoi.
        ...(change("contactEmail") ? { contactEmail: texteOuNull("contactEmail") } : {}),
        ...(change("contactTelephone") ? { contactTelephone: v.contactTelephone.trim() } : {}),
        ...(change("contactFonction") ? { contactFonction: v.contactFonction.trim() } : {}),
        // Champs entreprise uniquement — jamais transmis pour un particulier,
        // où ils n'ont pas de sens et où les masquer sans les exclure de l'envoi
        // les écraserait à vide.
        ...(!estParticulier && change("siret")
          ? { siret: siretSaisi === "" ? null : siretSaisi }
          : {}),
        ...(!estParticulier && change("tvaIntracom")
          ? { tvaIntracom: texteOuNull("tvaIntracom") }
          : {}),
        // 🔴 Le NAF n'est transmis que s'il a bougé : l'envoyer relancerait la
        // ré-inférence OPCO (voir l'en-tête).
        ...(!estParticulier && change("nafCode") ? { nafCode: v.nafCode.trim() } : {}),
        ...(change("delaiPaiementJours") ? { delaiPaiementJours: delai } : {}),
        ...(change("tauxAcomptePct") ? { tauxAcomptePct: acompte } : {}),
        ...(change("modeFacturation")
          ? {
              modeFacturation:
                v.modeFacturation === "acompte_solde" || v.modeFacturation === "solde_unique"
                  ? v.modeFacturation
                  : null,
            }
          : {}),
        // Même règle différentielle que les champs texte : transmis seulement
        // si l'utilisateur y a touché.
        ...(flags.penalitesRetardActives !== initialFlags.penalitesRetardActives
          ? { penalitesRetardActives: flags.penalitesRetardActives }
          : {}),
      });
      if ("error" in result) {
        setError(result.error);
      } else {
        setOk(true);
        setAvertissement(result.data.avertissement ?? null);
        router.refresh();
      }
    });
  }

  const labelCls =
    "block text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-[var(--space-admin-1)]";
  const inputCls =
    "min-h-11 w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";
  const fieldCls = "flex flex-col gap-[var(--space-admin-1)]";
  const aideCls = "text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]";
  const gridCls = "grid gap-[var(--space-admin-4)] sm:grid-cols-2";
  const blocsCls = "flex flex-col gap-[var(--space-admin-4)]";
  const rueVide = v.adresseRue.trim() === "";

  return (
    <form onSubmit={handleSubmit} className={blocsCls}>
      <AdminBloc teinte="gris" titre={estParticulier ? "Le client" : "Entreprise"}>
        <div className={gridCls}>
          <div className={`${fieldCls} sm:col-span-2`}>
            <label className={labelCls} htmlFor="edit-raisonSociale">
              {estParticulier ? "Prénom et nom" : "Nom de l\u2019entreprise"}{" "}
              <span className="text-[color:var(--color-admin-error)]">*</span>
            </label>
            <input
              id="edit-raisonSociale"
              value={v.raisonSociale}
              onChange={(e) => set("raisonSociale", e.target.value)}
              disabled={isPending}
              required
              className={inputCls}
            />
          </div>

          {!estParticulier && (
            <>
              <div className={fieldCls}>
                <label className={labelCls} htmlFor="edit-siret">
                  SIRET
                </label>
                <input
                  id="edit-siret"
                  value={v.siret}
                  onChange={(e) => set("siret", e.target.value)}
                  disabled={isPending}
                  className={inputCls}
                  inputMode="numeric"
                />
                {siretErreur !== null && (
                  <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-warning)]">
                    {siretErreur}
                  </p>
                )}
              </div>

              <div className={fieldCls}>
                <p className={labelCls}>SIREN</p>
                <p className="min-h-11 py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
                  {lecture?.siren ?? "Non renseigné"}
                </p>
                <p className={aideCls}>
                  Les 9 premiers chiffres du SIRET : il se met à jour avec lui.
                </p>
              </div>

              <div className={fieldCls}>
                <label className={labelCls} htmlFor="edit-tva">
                  Numéro de TVA
                </label>
                <input
                  id="edit-tva"
                  value={v.tvaIntracom}
                  onChange={(e) => set("tvaIntracom", e.target.value)}
                  disabled={isPending}
                  className={inputCls}
                />
                <p className={aideCls}>Numéro de TVA intracommunautaire, s&apos;il est connu.</p>
              </div>

              <div className={fieldCls}>
                <label className={labelCls} htmlFor="edit-naf">
                  Code NAF
                </label>
                <input
                  id="edit-naf"
                  value={v.nafCode}
                  onChange={(e) => set("nafCode", e.target.value)}
                  disabled={isPending}
                  className={inputCls}
                />
                <p className={aideCls}>
                  Modifier le NAF relance le calcul de l&apos;OPCO — uniquement si aucun OPCO
                  n&apos;a été saisi manuellement.
                </p>
              </div>
            </>
          )}

          <div className={fieldCls}>
            <label className={labelCls} htmlFor="edit-secteur">
              Secteur d&apos;activité
            </label>
            <input
              id="edit-secteur"
              value={v.secteur}
              onChange={(e) => set("secteur", e.target.value)}
              disabled={isPending}
              className={inputCls}
            />
          </div>

          {!estParticulier && lecture !== undefined && (
            <>
              <div className={fieldCls}>
                <p className={labelCls}>Nombre de salariés</p>
                <p className="text-[length:var(--text-admin-sm)]">
                  {lecture.effectif === null ? "Non renseigné" : lecture.effectif}
                </p>
                <Link
                  href={lecture.brancheHref}
                  className="inline-flex min-h-11 items-center text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline underline-offset-2"
                >
                  Modifier dans Branche et OPCO
                </Link>
              </div>

              <div className={fieldCls}>
                <p className={labelCls}>Secteur public</p>
                <p className="text-[length:var(--text-admin-sm)]">
                  {lecture.estPublic ? "Oui" : "Non"}
                </p>
                <p className={aideCls}>
                  Il décide du dépôt des factures sur Chorus Pro : il se change avec Will.
                </p>
              </div>
            </>
          )}
        </div>
      </AdminBloc>

      <AdminBloc teinte="gris" titre="Adresse">
        <div className={gridCls}>
          <div className={`${fieldCls} sm:col-span-2`}>
            <label className={labelCls} htmlFor="edit-adresseRue">
              Numéro et rue
            </label>
            <input
              id="edit-adresseRue"
              value={v.adresseRue}
              onChange={(e) => set("adresseRue", e.target.value)}
              disabled={isPending}
              className={inputCls}
            />
          </div>
          <div className={fieldCls}>
            <label className={labelCls} htmlFor="edit-adresseCodePostal">
              Code postal
            </label>
            <input
              id="edit-adresseCodePostal"
              value={v.adresseCodePostal}
              onChange={(e) => set("adresseCodePostal", e.target.value)}
              disabled={isPending}
              className={inputCls}
              inputMode="numeric"
            />
          </div>
          <div className={fieldCls}>
            <label className={labelCls} htmlFor="edit-adresseVille">
              Ville
            </label>
            <input
              id="edit-adresseVille"
              value={v.adresseVille}
              onChange={(e) => set("adresseVille", e.target.value)}
              disabled={isPending}
              className={inputCls}
            />
          </div>
          {rueVide && lecture?.adresseHistorique ? (
            <p className={`${aideCls} sm:col-span-2`}>
              Adresse saisie jusqu&apos;ici en texte libre : {lecture.adresseHistorique}.
              Recopiez-la dans les trois champs ci-dessus ; elle reste conservée tant que la rue est
              vide.
            </p>
          ) : null}
        </div>
      </AdminBloc>

      <AdminBloc teinte="gris" titre="Comment ce client est arrivé">
        <div className={fieldCls}>
          <label className={labelCls} htmlFor="edit-source">
            Origine
          </label>
          <input
            id="edit-source"
            value={v.source}
            onChange={(e) => set("source", e.target.value)}
            disabled={isPending}
            className={inputCls}
          />
          <p className={aideCls}>
            Par exemple : bouche-à-oreille, site, salon, recommandation d&apos;un client.
          </p>
        </div>
      </AdminBloc>

      <AdminBloc teinte="gris" titre="Contact principal">
        <div className={gridCls}>
          <div className={fieldCls}>
            <label className={labelCls} htmlFor="edit-contactNom">
              Nom et prénom
            </label>
            <input
              id="edit-contactNom"
              value={v.contactNom}
              onChange={(e) => set("contactNom", e.target.value)}
              disabled={isPending}
              className={inputCls}
            />
          </div>

          <div className={fieldCls}>
            <label className={labelCls} htmlFor="edit-contactFonction">
              Fonction
            </label>
            <input
              id="edit-contactFonction"
              value={v.contactFonction}
              onChange={(e) => set("contactFonction", e.target.value)}
              disabled={isPending}
              className={inputCls}
            />
            <p className={aideCls}>
              Figée comme qualité du signataire au moment de la signature du devis — c&apos;est elle
              qui atteste le pouvoir d&apos;engager la structure.
            </p>
          </div>

          <div className={fieldCls}>
            <label className={labelCls} htmlFor="edit-contactEmail">
              E-mail
            </label>
            <input
              id="edit-contactEmail"
              type="email"
              value={v.contactEmail}
              onChange={(e) => set("contactEmail", e.target.value)}
              disabled={isPending}
              className={inputCls}
            />
            {/* Dit AVANT l'erreur, pas après : sans adresse, l'envoi du devis
                marche mais part sans lien de signature, et l'admin ne l'apprend
                que dans une note de retour. */}
            <p className={aideCls}>
              Sans adresse, le devis part sans lien de signature — le client ne peut pas signer en
              ligne.
            </p>
          </div>

          <div className={fieldCls}>
            <label className={labelCls} htmlFor="edit-contactTelephone">
              Téléphone
            </label>
            <input
              id="edit-contactTelephone"
              value={v.contactTelephone}
              onChange={(e) => set("contactTelephone", e.target.value)}
              disabled={isPending}
              className={inputCls}
            />
          </div>
        </div>
      </AdminBloc>

      <AdminBloc teinte="gris" titre="Facturation">
        <div className={gridCls}>
          <div className={fieldCls}>
            <label className={labelCls} htmlFor="edit-delai">
              Délai de paiement (jours)
            </label>
            <input
              id="edit-delai"
              type="number"
              min={0}
              max={DELAI_PAIEMENT_MAX_JOURS}
              step={1}
              inputMode="numeric"
              value={v.delaiPaiementJours}
              onChange={(e) => set("delaiPaiementJours", e.target.value)}
              disabled={isPending}
              className={inputCls}
            />
            <p className={aideCls}>De 0 à 60 jours. Laissez vide pour le délai habituel.</p>
          </div>

          <div className={fieldCls}>
            <label className={labelCls} htmlFor="edit-acompte">
              Acompte (%)
            </label>
            <input
              id="edit-acompte"
              type="number"
              min={0}
              max={100}
              step={1}
              inputMode="numeric"
              value={v.tauxAcomptePct}
              onChange={(e) => set("tauxAcomptePct", e.target.value)}
              disabled={isPending}
              className={inputCls}
            />
            <p className={aideCls}>De 0 à 100 %. Laissez vide pour l&apos;acompte habituel.</p>
          </div>

          <div className={`${fieldCls} sm:col-span-2`}>
            <label className={labelCls} htmlFor="edit-mode">
              Mode de facturation
            </label>
            <select
              id="edit-mode"
              value={v.modeFacturation}
              onChange={(e) => set("modeFacturation", e.target.value)}
              disabled={isPending}
              className={inputCls}
            >
              <option value="">Non défini</option>
              <option value="acompte_solde">Acompte puis solde</option>
              <option value="solde_unique">Solde unique</option>
            </select>
            {v.modeFacturation === "solde_unique" ? (
              <p className={aideCls}>En solde unique, l&apos;acompte n&apos;est pas appliqué.</p>
            ) : null}
          </div>

          <label
            htmlFor="edit-penalites-retard"
            className="flex min-h-11 items-start gap-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] sm:col-span-2"
          >
            <input
              id="edit-penalites-retard"
              type="checkbox"
              checked={flags.penalitesRetardActives}
              onChange={(e) => setFlag("penalitesRetardActives", e.target.checked)}
              disabled={isPending}
              aria-describedby="edit-penalites-retard-aide"
              className="mt-[var(--space-admin-1)]"
            />
            <span>
              Appliquer les pénalités de retard à ce client
              <span
                id="edit-penalites-retard-aide"
                className="mt-[var(--space-admin-1)] block text-[length:var(--text-admin-xs)] font-normal text-[color:var(--color-admin-fg-muted)]"
              >
                Désactivé par défaut. N&apos;activez ceci que pour un client précis : les pénalités
                chiffrées apparaîtront alors dans le texte des relances qui lui sont adressées. Les
                mentions légales de pénalités restent imprimées sur toutes les factures dans tous
                les cas, que cette case soit cochée ou non.
              </span>
            </span>
          </label>
        </div>
      </AdminBloc>

      {error !== null && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}
      {ok && (
        <p
          role="status"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
        >
          Fiche enregistrée.
        </p>
      )}
      {ok && avertissement !== null && (
        <p
          role="status"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-warning)]"
        >
          {avertissement}
        </p>
      )}

      <div className="flex items-center gap-[var(--space-admin-4)]">
        <button
          type="submit"
          disabled={isPending || !modifie}
          className="min-h-11 rounded-[var(--radius-admin-sm)] bg-[color:var(--color-admin-fg)] px-[var(--space-admin-4)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-paper)] disabled:opacity-40"
        >
          {isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
        <a
          href={retourHref}
          className="inline-flex min-h-11 items-center text-[length:var(--text-admin-sm)] underline underline-offset-4"
        >
          Retour
        </a>
        {!modifie && !ok && (
          <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            Aucune modification.
          </span>
        )}
      </div>
    </form>
  );
}
