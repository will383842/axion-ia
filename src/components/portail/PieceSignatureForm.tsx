"use client";
// use-client: pavé de signature (canvas + pointer events) + état local (dont la case des CGV) + Server Action.

/**
 * Canal A — signature d'une PIÈCE contractuelle par un tiers, depuis son lien.
 *
 * ## Ce que cet écran doit garantir, et pourquoi
 *
 * 🔴 Le signataire doit avoir sous les yeux CE QU'IL SIGNE. C'est tout l'objet
 * de la bascule du 2026-07-30 : le circuit précédent lui envoyait un PDF
 * détaillé par e-mail et lui faisait signer, ailleurs, un document à trois
 * champs. Le récapitulatif ci-dessous n'est donc pas décoratif — il porte les
 * lignes, les quantités, les prix unitaires et les totaux, et le lien vers le
 * PDF exact dont l'empreinte sera scellée dans la preuve.
 *
 * ⚠️ Aucune identité n'est saisie ici, et il ne faut pas en ajouter. Le nom, la
 * qualité et l'adresse du signataire ont été figés à l'émission du lien, côté
 * serveur, depuis la fiche client. Ils sont AFFICHÉS pour que le signataire
 * puisse les vérifier — pas édités. Un champ « votre nom » rendrait la signature
 * aussi fiable que ce que le porteur du lien a bien voulu déclarer.
 *
 * ## Accessibilité — le chemin sans tracé est de PLEIN DROIT
 *
 * `confirmation_accessible` n'est pas un mode dégradé : une personne qui ne peut
 * pas tracer confirme nominativement, et sa confirmation a la même valeur. Le
 * PDF le dit explicitement au lieu de laisser un cadre vide qui se lirait comme
 * « pas signé ».
 *
 * FR en dur, comme le reste du portail.
 */

import { useEffect, useMemo, useState, useTransition } from "react";
import { SignaturePad } from "@/components/portail/SignaturePad";

export interface LigneAffichee {
  designation: string;
  quantite: number;
  prixUnitaireHtLisible: string;
  totalHtLisible: string;
}

/** CGV à lire et accepter avant de signer un DEVIS. Absent pour toute autre pièce. */
export interface CgvAffichees {
  /** Version en vigueur (`CGV_VERSION`) : renvoyée telle quelle pour détecter une page périmée. */
  version: string;
  /** Libellé lisible (« 4 octobre 2026 »). */
  libelle: string;
  /** Page publique des CGV (lecture). */
  href: string;
  /** Téléchargement PDF. */
  pdfHref: string;
}

/**
 * Offre à formules telle qu'AFFICHÉE : montants déjà formatés par le serveur (le navigateur n'en
 * calcule aucun). Miroir structurel de `OffreAffichee` (`server/qualiopi/devis/choix-affichage`) :
 * la page, qui passe l'un à l'autre, est le verrou de compatibilité à la compilation. Ce fichier
 * n'importe pas le domaine Qualiopi (cloisonnement, `qualiopi:isolation-check`).
 */
export interface OffreAffichee {
  readonly formules: readonly {
    readonly formule: "achat" | "abonnement";
    readonly libelle: string;
    readonly baseHtLisible: string;
    readonly baseTtcLisible: string;
    readonly lignes: readonly { libelle: string; quantite: number; prixLisible: string }[];
    readonly maintenance: {
      readonly regle: "obligatoire" | "facultative";
      readonly mensuelLisible: string;
      readonly periodes: readonly { mois: number; libelle: string }[];
    } | null;
    readonly abonnement: {
      readonly mensuelLisible: string;
      readonly engagementMois: number;
      readonly periodes: readonly { mois: number; libelle: string }[];
    } | null;
  }[];
  readonly automatisations: readonly {
    readonly code: string;
    readonly libelle: string;
    readonly facultative: boolean;
    readonly dependDe: readonly string[];
    readonly dependDeLibelles: readonly string[];
    readonly prixHtLisible: string;
  }[];
}

/** Récapitulatif de ce que le client signe, calculé par le serveur. Miroir de `RecapChoix`. */
export interface RecapChoix {
  readonly formuleLibelle: string;
  readonly automatisations: readonly string[];
  readonly totalPonctuelHtLisible: string;
  readonly totalPonctuelTtcLisible: string;
  readonly recurrent: readonly string[];
}

/** Ce que le client choisit sur un devis à formules (aucun prix : le serveur recalcule tout). */
export interface ChoixFormules {
  formule: "achat" | "abonnement";
  automatisationsRetenues: string[];
  maintenanceRetenue: boolean | null;
  periodiciteMois: number | null;
}

/** Devis À FORMULES : l'offre affichée et l'action qui en calcule le récapitulatif. */
export interface OffreFormulesProps {
  offre: OffreAffichee;
  apercuAction: (input: {
    token: string;
    choix: ChoixFormules;
  }) => Promise<{ ok: true; recap: RecapChoix } | { ok: false; message: string }>;
}

/** Ajoute `code` et tout ce dont il dépend (fermeture transitive). */
function avecDependances(
  code: string,
  autos: OffreAffichee["automatisations"],
  courant: readonly string[],
): string[] {
  const parCode = new Map(autos.map((a) => [a.code, a]));
  const res = new Set(courant);
  const pile = [code];
  while (pile.length > 0) {
    const c = pile.pop()!;
    if (res.has(c) && c !== code) continue;
    res.add(c);
    for (const d of parCode.get(c)?.dependDe ?? []) if (!res.has(d)) pile.push(d);
  }
  return [...res];
}

/** Retire `code` et tout ce qui en dépend (directement ou non). */
function sansDependants(
  code: string,
  autos: OffreAffichee["automatisations"],
  courant: readonly string[],
): string[] {
  const res = new Set(courant);
  res.delete(code);
  let change = true;
  while (change) {
    change = false;
    for (const a of autos) {
      if (res.has(a.code) && a.dependDe.some((d) => !res.has(d))) {
        res.delete(a.code);
        change = true;
      }
    }
  }
  return [...res];
}

export interface PieceSignatureFormProps {
  token: string;
  /** N° de la PIÈCE générée (AXI-DOC-…) — celui que la signature scelle. */
  numero: string;
  /**
   * N° du DEVIS (AXI-DEV-…), celui que le client a reçu par e-mail et lu sur le PDF.
   * Facultatif : il n'existe que pour un devis. Quand il est présent, c'est lui qui
   * titre la page ; le n° de pièce passe en second plan.
   */
  numeroDevis?: string | null;
  /** Date de validité — un devis en a une, une convention non. */
  dateValiditeLisible: string | null;
  organismeNom: string;
  /**
   * Destinataire de la pièce. `null` quand aucun rattachement ne le résout —
   * la phrase se tait alors, plutôt que de nommer l'organisme lui-même comme
   * elle le faisait avant le 2026-08-15.
   */
  clientRaisonSociale: string | null;
  /** Identité FIGÉE à l'émission. Affichée pour vérification, jamais éditable. */
  signataireNom: string;
  signataireQualite: string | null;
  /**
   * Détail chiffré — RENSEIGNÉ uniquement pour un devis.
   *
   * 🔴 C'est la raison d'être de la bascule pour le devis : le signataire doit
   * avoir les lignes, les quantités et les totaux SOUS LES YEUX. Une convention
   * ou un contrat n'a pas de lignes ; leur substance est dans le PDF, dont le
   * lien est affiché juste en dessous. Rendre un tableau vide sur ces pièces
   * laisserait croire qu'il manque quelque chose.
   */
  lignes?: LigneAffichee[];
  totalHtLisible?: string;
  totalTtcLisible?: string;
  mentionTva?: string | null;
  /** Libellé de la pièce, depuis le SSOT (« convention de formation »…). */
  pieceLibelle: string;
  /** Lien vers le PDF exact qui sera scellé. */
  pdfUrl: string | null;
  /**
   * Mentions affichées AU SIGNATAIRE, dans l'ordre rendu par
   * `mentionCompleteDocument` : attestation, valeur juridique, plafond du canal,
   * consentement, RGPD.
   *
   * 🔴 Lot 3quater — c'était UNE chaîne, produite par un `mentions.join(" ")`
   * chez l'appelant. Une vingtaine de lignes de droit s'écrasaient donc en un
   * seul pavé compact, glissé dans l'étiquette de la case à cocher, juste
   * au-dessus du bouton de signature. Un mur de texte avant un engagement se lit
   * comme un obstacle, pas comme une information — et la phrase qui compte
   * vraiment, celle qu'on accepte en cochant, y devenait la plus difficile à
   * trouver.
   *
   * La structure existait déjà dans la donnée : `mentionCompleteDocument` rend
   * un TABLEAU. C'est l'appelant qui l'aplatissait.
   *
   * ⚠️ AUCUN texte n'est modifié, ajouté ni retiré — seule la mise en page
   * change. C'est ce qui rend l'opération sûre : `mentionVersion` et
   * `consentementVersion` identifient le CONTENU des textes et entrent dans le
   * tuple haché ; le contenu ne bouge pas, donc aucune version à incrémenter et
   * aucune empreinte déjà scellée ne devient invérifiable.
   */
  mentions: readonly string[];
  /**
   * Présente = la pièce est un devis : le bloc des CGV s'affiche et sa case, SÉPARÉE de
   * l'attestation, conditionne le bouton. Absente, l'écran est celui de toujours.
   */
  cgv?: CgvAffichees;
  /** Présente = devis À FORMULES : le client choisit sa formule avant de signer. */
  formules?: OffreFormulesProps;
  /**
   * Vrai = signature « simple renforcée » (lot 4 bis, devis à formules) : le signataire SAISIT son
   * nom et sa fonction et coche « Je déclare avoir le pouvoir d'engager la société ». Jamais
   * préremplis : la déclaration doit être un acte, pas une validation par défaut. Le code reçu par
   * e-mail (`demanderCodeAction`) l'accompagne ; l'instant de la déclaration est posé par le serveur.
   */
  declaration?: boolean;
  signerAction: (input: {
    token: string;
    methode: "trace" | "confirmation_accessible";
    imageDataUrl?: string;
    code?: string;
    cgvAcceptees?: true;
    cgvVersionAffichee?: string;
    choix?: ChoixFormules;
    declaration?: { nom: string; fonction: string; pouvoirEngager: boolean };
  }) => Promise<
    { ok: true; signatureId: string; statutSignature: string } | { ok: false; message: string }
  >;
  /**
   * Présente = la pièce se signe avec un code à usage unique reçu par e-mail
   * (contrat-cadre v3, lot L7c). Absente, l'écran est celui de toujours.
   */
  demanderCodeAction?: (input: {
    token: string;
  }) => Promise<{ ok: true; destinataireMasque: string } | { ok: false; message: string }>;
}

export function PieceSignatureForm({
  token,
  numero,
  numeroDevis,
  dateValiditeLisible,
  organismeNom,
  clientRaisonSociale,
  signataireNom,
  signataireQualite,
  lignes,
  totalHtLisible,
  totalTtcLisible,
  mentionTva,
  pieceLibelle,
  pdfUrl,
  mentions,
  cgv,
  formules,
  declaration,
  signerAction,
  demanderCodeAction,
}: PieceSignatureFormProps): React.ReactElement {
  // La PREMIÈRE mention est l'attestation : c'est ce que la partie déclare
  // accepter, et donc ce qu'on coche. Les suivantes l'encadrent (valeur
  // juridique, consentement, RGPD) — elles s'appliquent, mais ce n'est pas
  // elles qu'on « accepte ». Les mettre toutes dans l'étiquette rendait
  // l'engagement lui-même illisible.
  const [attestation, ...mentionsEncadrantes] = mentions;
  const [trace, setTrace] = useState<string | null>(null);
  const [modeAccessible, setModeAccessible] = useState(false);
  const [consent, setConsent] = useState(false);
  const [cgvOk, setCgvOk] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [signe, setSigne] = useState(false);
  const [enCours, startTransition] = useTransition();

  // 🔴 Le bouton reste inactif tant que le consentement n'est pas donné ET que
  // la modalité choisie n'a pas produit ce qu'elle doit produire. Sans le second
  // test, un clic sur un pavé vide enverrait `trace` sans image — et le service
  // refuserait en `image_requise`, message que personne ne saurait interpréter.
  const avecCode = demanderCodeAction !== undefined;
  const [code, setCode] = useState("");
  const avecDeclaration = declaration === true;
  const [nomSaisi, setNomSaisi] = useState("");
  const [fonctionSaisie, setFonctionSaisie] = useState("");
  const [pouvoirOk, setPouvoirOk] = useState(false);
  const [codeEnvoyeA, setCodeEnvoyeA] = useState<string | null>(null);
  const [envoiCodeEnCours, startEnvoiCode] = useTransition();

  // ── Devis à formules : le choix et son récapitulatif (calculé par le serveur) ──
  const offre = formules?.offre;
  const [formule, setFormule] = useState<"achat" | "abonnement" | null>(
    offre !== undefined && offre.formules.length === 1 ? offre.formules[0]!.formule : null,
  );
  const [autos, setAutos] = useState<string[]>(() =>
    offre === undefined
      ? []
      : offre.automatisations.filter((a) => !a.facultative).map((a) => a.code),
  );
  const [maintenance, setMaintenance] = useState<boolean | null>(null);
  const [periode, setPeriode] = useState<number | null>(null);
  const [recap, setRecap] = useState<{ cle: string; valeur: RecapChoix } | null>(null);

  const formuleChoisie = offre?.formules.find((f) => f.formule === formule) ?? null;
  const maintenanceObligatoire = formuleChoisie?.maintenance?.regle === "obligatoire";
  const maintenanceEffective =
    formule !== "achat" ? false : maintenanceObligatoire ? true : maintenance;

  const choix: ChoixFormules | null = useMemo(() => {
    if (formule === null) return null;
    if (formule === "abonnement") {
      if (periode === null) return null;
      return {
        formule,
        automatisationsRetenues: autos,
        maintenanceRetenue: null,
        periodiciteMois: periode,
      };
    }
    if (maintenanceEffective === null) return null;
    if (maintenanceEffective && periode === null) return null;
    return {
      formule,
      automatisationsRetenues: autos,
      maintenanceRetenue: maintenanceEffective,
      periodiciteMois: maintenanceEffective ? periode : null,
    };
  }, [formule, autos, periode, maintenanceEffective]);
  const cleChoix = choix === null ? null : JSON.stringify(choix);

  const apercuAction = formules?.apercuAction;
  useEffect(() => {
    if (apercuAction === undefined || choix === null || cleChoix === null) return;
    let annule = false;
    void apercuAction({ token, choix }).then((res) => {
      if (annule) return;
      if (res.ok) {
        setRecap({ cle: cleChoix, valeur: res.recap });
        setErreur(null);
      } else {
        setRecap(null);
        setErreur(res.message);
      }
    });
    return () => {
      annule = true;
    };
    // `choix` est dérivé de `cleChoix` : une seule dépendance suffit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleChoix, token, apercuAction]);

  const choixConfirme = formules === undefined || (recap !== null && recap.cle === cleChoix);

  const pretASigner =
    consent &&
    choixConfirme &&
    (cgv === undefined || cgvOk) &&
    (modeAccessible || trace !== null) &&
    (!avecCode || /^\d{6}$/.test(code)) &&
    (!avecDeclaration ||
      (nomSaisi.trim().length >= 2 && fonctionSaisie.trim().length >= 2 && pouvoirOk));

  function demanderCode() {
    if (demanderCodeAction === undefined) return;
    setErreur(null);
    startEnvoiCode(async () => {
      const res = await demanderCodeAction({ token });
      if (res.ok) setCodeEnvoyeA(res.destinataireMasque);
      else setErreur(res.message);
    });
  }

  function soumettre() {
    setErreur(null);
    startTransition(async () => {
      const res = await signerAction({
        token,
        methode: modeAccessible ? "confirmation_accessible" : "trace",
        // ⚠️ Jamais d'image en mode accessible : le service la REFUSE
        // (`image_interdite`), parce que transmettre un tracé présenterait comme
        // manuscrite une signature qui ne l'est pas.
        ...(modeAccessible || trace === null ? {} : { imageDataUrl: trace }),
        ...(avecCode ? { code } : {}),
        ...(avecDeclaration
          ? {
              declaration: {
                nom: nomSaisi.trim(),
                fonction: fonctionSaisie.trim(),
                pouvoirEngager: pouvoirOk,
              },
            }
          : {}),
        ...(cgv !== undefined
          ? { cgvAcceptees: true as const, cgvVersionAffichee: cgv.version }
          : {}),
        ...(formules !== undefined && choix !== null ? { choix } : {}),
      });
      if (res.ok) setSigne(true);
      else setErreur(res.message);
    });
  }

  // Le numéro que le client CONNAÎT : celui du devis quand il existe. Le n° de pièce reste
  // affiché à part, car la case d'acceptation et le registre scellé s'y réfèrent.
  const numeroAffiche = numeroDevis != null && numeroDevis.trim() !== "" ? numeroDevis : numero;
  const numeroPieceSecondaire = numeroAffiche !== numero ? numero : null;

  if (signe) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16">
        <h1 className="text-fg text-xl font-semibold">Votre signature est enregistrée</h1>
        <p className="text-fg-soft mt-3 text-sm">
          {`Merci. Votre signature sur ${pieceLibelle} ${numeroAffiche} a bien été enregistrée, horodatée et
          rattachée au document que vous venez de lire.`}
        </p>
        {formules !== undefined && (
          <p className="text-fg-soft mt-2 text-sm">
            {`Votre choix est enregistré avec votre signature. Le contrat est formé lorsque ${organismeNom} contresigne le devis.`}
          </p>
        )}
        <p className="text-fg-soft mt-2 text-sm">
          {`${organismeNom} vous adressera l'exemplaire contresigné. Vous pouvez fermer cette page.`}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="text-fg text-xl font-semibold">
        {`${pieceLibelle.charAt(0).toUpperCase()}${pieceLibelle.slice(1)} ${numeroAffiche}`}
      </h1>
      {numeroPieceSecondaire !== null && (
        <p className="text-fg-soft mt-1 text-xs" data-testid="numero-piece">
          {`Référence de la pièce : ${numeroPieceSecondaire}`}
        </p>
      )}
      <p className="text-fg-soft mt-1 text-sm">
        {clientRaisonSociale !== null && clientRaisonSociale !== ""
          ? `Établie par ${organismeNom} à l'attention de ${clientRaisonSociale}.`
          : `Établie par ${organismeNom}.`}
        {dateValiditeLisible !== null ? ` Valable jusqu'au ${dateValiditeLisible}.` : ""}
      </p>

      {/* ── Ce qui est signé, sous les yeux du signataire ── */}
      {/* 🔴 Le détail chiffré n'existe QUE pour un devis. Sur une convention ou
          un contrat, la substance est dans le PDF — rendre un tableau vide
          laisserait croire qu'il manque quelque chose. */}
      <section className="mt-8" aria-labelledby="recap-titre">
        {lignes !== undefined && lignes.length > 0 ? (
          <>
            <h2 id="recap-titre" className="text-fg text-sm font-semibold">
              Détail de la prestation
            </h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[32rem] border-collapse text-sm">
                <thead>
                  <tr className="border-border text-fg-soft border-b text-left text-xs uppercase">
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Désignation
                    </th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">
                      Qté
                    </th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">
                      PU HT
                    </th>
                    <th scope="col" className="py-2 text-right font-medium">
                      Total HT
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((l, i) => (
                    <tr key={i} className="border-border border-b align-top">
                      <td className="text-fg py-2 pr-3">{l.designation}</td>
                      <td className="text-fg-soft py-2 pr-3 text-right tabular-nums">
                        {l.quantite}
                      </td>
                      <td className="text-fg-soft py-2 pr-3 text-right tabular-nums">
                        {l.prixUnitaireHtLisible}
                      </td>
                      <td className="text-fg py-2 text-right tabular-nums">{l.totalHtLisible}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <dl className="mt-4 space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-fg-soft">Total HT</dt>
                <dd className="text-fg font-medium tabular-nums">{totalHtLisible ?? ""}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-fg font-semibold">Total TTC</dt>
                <dd className="text-fg font-semibold tabular-nums">{totalTtcLisible ?? ""}</dd>
              </div>
            </dl>
            {mentionTva != null && <p className="text-fg-soft mt-2 text-xs">{mentionTva}</p>}
          </>
        ) : null}

        {pdfUrl !== null && (
          <p className="mt-4 text-sm">
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4"
            >
              {/* 🔴 Disait « le devis » sur TOUTES les pièces — donc sur une
                  convention, un contrat, une tripartite. Le libellé DÉRIVE du
                  SSOT des circuits, il ne se réécrit pas ici. */}
              {`Ouvrir ${pieceLibelle} au format PDF`}
            </a>
            <span className="text-fg-soft block text-xs">
              C&apos;est ce document exact, et son empreinte, que votre signature scelle.
            </span>
          </p>
        )}
      </section>

      {/* ── Devis à formules : le CHOIX du client, avant la signature ── */}
      {offre !== undefined && (
        <section className="mt-8" aria-labelledby="choix-titre">
          <h2 id="choix-titre" className="text-fg text-sm font-semibold">
            Votre choix
          </h2>

          <fieldset className="mt-3">
            <legend className="text-fg-soft text-sm">
              {offre.formules.length > 1
                ? "Ce devis propose deux formules. Choisissez celle que vous signez."
                : "Formule proposée"}
            </legend>
            <div className="mt-2 grid gap-3">
              {offre.formules.map((f) => (
                <label
                  key={f.formule}
                  className={`block rounded border p-4 text-sm ${
                    formule === f.formule ? "border-fg bg-bg" : "border-border"
                  }`}
                >
                  <span className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="formule"
                      value={f.formule}
                      checked={formule === f.formule}
                      onChange={() => {
                        setFormule(f.formule);
                        setPeriode(null);
                        setMaintenance(null);
                      }}
                      disabled={enCours}
                      className="mt-1"
                    />
                    <span className="block">
                      <span className="text-fg block font-medium">{f.libelle}</span>
                      <span className="text-fg-soft mt-1 block">
                        {`À la signature : ${f.baseHtLisible} HT (${f.baseTtcLisible} TTC), hors options.`}
                      </span>
                      {f.lignes.length > 0 && (
                        <ul className="text-fg-soft mt-2 list-disc pl-5 text-xs">
                          {f.lignes.map((l, i) => (
                            <li key={i}>{`${l.libelle} — ${l.quantite} × ${l.prixLisible}`}</li>
                          ))}
                        </ul>
                      )}
                      {f.abonnement !== null && (
                        <span className="text-fg-soft mt-2 block text-xs">
                          {`Abonnement : ${f.abonnement.mensuelLisible}` +
                            (f.abonnement.engagementMois > 0
                              ? `, engagement de ${f.abonnement.engagementMois} mois.`
                              : ".")}
                        </span>
                      )}
                      {f.maintenance !== null && (
                        <span className="text-fg-soft mt-2 block text-xs">
                          {`Maintenance ${
                            f.maintenance.regle === "obligatoire" ? "obligatoire" : "facultative"
                          } : ${f.maintenance.mensuelLisible}.`}
                        </span>
                      )}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {formule !== null && offre.automatisations.length > 0 && (
            <fieldset className="mt-5">
              <legend className="text-fg-soft text-sm">Automatisations</legend>
              <div className="mt-2 space-y-2">
                {offre.automatisations.map((a) => {
                  const coche = autos.includes(a.code);
                  return (
                    <label key={a.code} className="text-fg flex items-start gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={coche}
                        disabled={enCours || !a.facultative}
                        onChange={(e) =>
                          setAutos((cur) =>
                            e.target.checked
                              ? avecDependances(a.code, offre.automatisations, cur)
                              : sansDependants(a.code, offre.automatisations, cur),
                          )
                        }
                        className="mt-1"
                      />
                      <span>
                        {`${a.libelle} — ${a.prixHtLisible}`}
                        {!a.facultative ? " (incluse)" : ""}
                        {a.dependDeLibelles.length > 0 && (
                          <span className="text-fg-soft block text-xs">
                            {`Nécessite : ${a.dependDeLibelles.join(", ")}`}
                          </span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          {formule === "achat" && formuleChoisie?.maintenance != null && (
            <fieldset className="mt-5">
              <legend className="text-fg-soft text-sm">Maintenance</legend>
              {maintenanceObligatoire ? (
                <p className="text-fg mt-2 text-sm">
                  {`La maintenance est incluse dans cette formule (${formuleChoisie.maintenance.mensuelLisible}).`}
                </p>
              ) : (
                <div className="text-fg mt-2 space-y-2 text-sm">
                  <label className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="maintenance"
                      checked={maintenance === true}
                      onChange={() => setMaintenance(true)}
                      disabled={enCours}
                      className="mt-1"
                    />
                    <span>{`Je souscris la maintenance (${formuleChoisie.maintenance.mensuelLisible})`}</span>
                  </label>
                  <label className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="maintenance"
                      checked={maintenance === false}
                      onChange={() => {
                        setMaintenance(false);
                        setPeriode(null);
                      }}
                      disabled={enCours}
                      className="mt-1"
                    />
                    <span>Je ne souscris pas la maintenance</span>
                  </label>
                </div>
              )}
            </fieldset>
          )}

          {(formule === "abonnement" || (formule === "achat" && maintenanceEffective === true)) && (
            <fieldset className="mt-5">
              <legend className="text-fg-soft text-sm">Durée payée d&apos;avance</legend>
              <div className="text-fg mt-2 space-y-2 text-sm">
                {(formule === "abonnement"
                  ? (formuleChoisie?.abonnement?.periodes ?? [])
                  : (formuleChoisie?.maintenance?.periodes ?? [])
                ).map((p) => (
                  <label key={p.mois} className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="periode"
                      checked={periode === p.mois}
                      onChange={() => setPeriode(p.mois)}
                      disabled={enCours}
                      className="mt-1"
                    />
                    <span>{p.libelle}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {recap !== null && recap.cle === cleChoix && (
            <div className="border-fg bg-bg mt-5 rounded border p-4 text-sm" aria-live="polite">
              <h3 className="text-fg font-semibold">Récapitulatif de ce que vous signez</h3>
              <p className="text-fg mt-1">{recap.valeur.formuleLibelle}</p>
              {recap.valeur.automatisations.length > 0 && (
                <p className="text-fg-soft mt-1 text-xs">
                  {`Automatisations : ${recap.valeur.automatisations.join(", ")}`}
                </p>
              )}
              <p className="text-fg mt-2">
                {`À la signature : ${recap.valeur.totalPonctuelHtLisible} HT, soit ${recap.valeur.totalPonctuelTtcLisible} TTC.`}
              </p>
              {recap.valeur.recurrent.map((l) => (
                <p key={l} className="text-fg mt-1">
                  {l}
                </p>
              ))}
              <p className="text-fg-soft mt-2 text-xs">
                La TVA est comprise dans les montants TTC. Votre choix est enregistré avec votre
                signature ; le contrat est formé lorsque {organismeNom} contresigne.
              </p>
            </div>
          )}
        </section>
      )}

      {/* ── Le signataire, tel qu'il a été identifié ── */}
      <section className="border-border bg-bg mt-8 rounded border p-4">
        <h2 className="text-fg text-sm font-semibold">Signataire</h2>
        <p className="text-fg mt-1 text-sm">{signataireNom}</p>
        {signataireQualite !== null && <p className="text-fg-soft text-sm">{signataireQualite}</p>}
        <p className="text-fg-soft mt-2 text-xs">
          Cette identité a été enregistrée par {organismeNom} lors de l&apos;envoi de ce lien. Si
          elle est inexacte, ne signez pas et prévenez votre interlocuteur : un lien corrigé vous
          sera adressé.
        </p>
      </section>

      {/* ── Signature ── */}
      <section className="mt-8" aria-labelledby="signature-titre">
        <h2 id="signature-titre" className="text-fg text-sm font-semibold">
          Bon pour accord
        </h2>

        {!modeAccessible ? (
          <div className="mt-3">
            <SignaturePad
              onChange={setTrace}
              disabled={enCours}
              label="Zone de signature — tracez votre signature"
              onBasculerAccessible={() => {
                setModeAccessible(true);
                setTrace(null);
              }}
            />
          </div>
        ) : (
          <div className="border-border mt-3 rounded border p-4">
            <p className="text-fg text-sm">
              Vous avez choisi de confirmer votre accord sans tracé manuscrit.
            </p>
            <p className="text-fg-soft mt-1 text-xs">
              Cette modalité a exactement la même valeur qu&apos;une signature tracée. Elle sera
              mentionnée comme telle sur le document.
            </p>
            <button
              type="button"
              onClick={() => setModeAccessible(false)}
              disabled={enCours}
              className="mt-3 text-sm underline underline-offset-4 disabled:opacity-50"
            >
              Revenir au tracé manuscrit
            </button>
          </div>
        )}

        {/* L'ENGAGEMENT — court, isolé, et c'est lui qu'on coche. */}
        <label className="text-fg mt-5 flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            disabled={enCours}
            className="mt-1"
          />
          <span>{attestation}</span>
        </label>

        {/* CGV — à lire AVANT de signer un devis. Les liens sont HORS du <label> : cliquer
            sur « Lire » ou « Télécharger » ne doit jamais cocher la case. La case est
            SÉPARÉE de l'attestation : l'acceptation des CGV est un acte distinct, dont la
            version est enregistrée et scellée dans la preuve. */}
        {cgv !== undefined && (
          <div className="border-border mt-5 rounded border p-4">
            <h3 className="text-fg text-sm font-semibold">
              {`Conditions générales de vente (version du ${cgv.libelle})`}
            </h3>
            <p className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <a
                href={cgv.href}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4"
              >
                Lire
                <span className="sr-only"> les conditions générales de vente (nouvel onglet)</span>
              </a>
              <a href={cgv.pdfHref} className="underline underline-offset-4">
                Télécharger (PDF)
                <span className="sr-only"> les conditions générales de vente</span>
              </a>
            </p>
            <label className="text-fg mt-3 flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={cgvOk}
                onChange={(e) => setCgvOk(e.target.checked)}
                disabled={enCours}
                className="mt-1"
              />
              <span>J&apos;ai lu et j&apos;accepte les conditions générales de vente</span>
            </label>
          </div>
        )}

        {/* CE QUI ENCADRE L'ENGAGEMENT — valeur juridique, consentement, RGPD.
            Replié, sur DÉCISION DE WILL du 16/08.

            J'avais d'abord laissé ce bloc déployé, au motif qu'on ne masque pas
            une information légalement due sur l'écran même où l'on recueille un
            consentement. Will a tranché : on replie. C'est sa décision, et elle
            se défend — un pavé que personne ne lit n'informe personne mieux
            qu'un dépli qu'on peut ouvrir.

            🔴 CE QUI REND LE DÉPLI DÉFENDABLE, et qu'il ne faut pas défaire :

            1. `<details>` est un élément NATIF : le texte reste dans le DOM, il
               est atteignable au clavier, annoncé par les lecteurs d'écran, et
               imprimé par certains navigateurs. Un `display:none` piloté en
               JavaScript n'aurait aucune de ces propriétés — ne pas « moderniser »
               ce bloc en composant maison ;
            2. l'ATTESTATION — la phrase qu'on accepte en cochant — reste
               DEHORS, au-dessus. Ce qui est replié encadre l'engagement, ce
               n'est pas l'engagement ;
            3. le résumé ANNONCE ce qu'il contient et combien : « 4 mentions ».
               Un dépli muet se referme sur son contenu ; un dépli qui compte
               dit qu'il y a quelque chose à lire.

            ⚠️ Toujours à faire relire par l'avocat avec les clauses OPCO. Le
            repli est un choix d'affichage, pas un avis juridique. */}
        {mentionsEncadrantes.length > 0 && (
          <details className="group border-border bg-bg mt-4 rounded border">
            <summary className="text-fg-soft hover:bg-sand cursor-pointer list-none p-3 text-xs font-semibold tracking-wide uppercase">
              <span aria-hidden="true" className="mr-1 inline-block group-open:hidden">
                +
              </span>
              <span aria-hidden="true" className="mr-1 hidden group-open:inline-block">
                −
              </span>
              Valeur de cette signature et vos droits ({mentionsEncadrantes.length} mentions)
            </summary>
            <div className="space-y-2 px-3 pt-1 pb-3">
              {mentionsEncadrantes.map((texte) => (
                <p key={texte} className="text-fg-soft text-xs leading-relaxed">
                  {texte}
                </p>
              ))}
            </div>
          </details>
        )}

        {avecDeclaration && (
          <fieldset className="border-border mt-5 rounded border p-4" disabled={enCours}>
            <legend className="text-fg px-1 text-sm font-semibold">Vous signez en votre nom</legend>
            <p className="text-fg-soft text-xs">
              {`Ce lien a été établi pour ${signataireNom}${
                signataireQualite !== null && signataireQualite !== ""
                  ? ` (${signataireQualite})`
                  : ""
              }. Saisissez vos nom et fonction : ils sont enregistrés avec votre signature.`}
            </p>
            <label className="text-fg mt-3 block text-sm" htmlFor="declaration-nom">
              Votre nom et prénom
            </label>
            <input
              id="declaration-nom"
              type="text"
              autoComplete="name"
              maxLength={200}
              value={nomSaisi}
              onChange={(e) => setNomSaisi(e.target.value)}
              className="border-border-field mt-1 min-h-12 w-full rounded border px-3 text-sm"
            />
            <label className="text-fg mt-3 block text-sm" htmlFor="declaration-fonction">
              Votre fonction dans la société
            </label>
            <input
              id="declaration-fonction"
              type="text"
              autoComplete="organization-title"
              maxLength={200}
              value={fonctionSaisie}
              onChange={(e) => setFonctionSaisie(e.target.value)}
              className="border-border-field mt-1 min-h-12 w-full rounded border px-3 text-sm"
            />
            <label className="text-fg mt-4 flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={pouvoirOk}
                onChange={(e) => setPouvoirOk(e.target.checked)}
                className="mt-1"
              />
              <span>Je déclare avoir le pouvoir d&apos;engager la société</span>
            </label>
          </fieldset>
        )}

        {avecCode && (
          <div className="border-border mt-5 rounded border p-4">
            <p className="text-fg text-sm">
              Pour signer, saisissez le code à 6 chiffres que nous vous envoyons par e-mail. Il est
              à usage unique et valable quelques minutes.
            </p>
            <button
              type="button"
              onClick={demanderCode}
              disabled={envoiCodeEnCours || enCours}
              className="border-fg mt-3 min-h-12 rounded border px-4 text-sm font-medium disabled:opacity-40"
            >
              {codeEnvoyeA === null ? "Recevoir mon code" : "Recevoir un nouveau code"}
            </button>
            {codeEnvoyeA !== null && (
              <p className="text-fg-soft mt-2 text-xs" aria-live="polite">
                {`Code envoyé à ${codeEnvoyeA}.`}
              </p>
            )}
            <label className="text-fg mt-3 block text-sm" htmlFor="code-signature">
              Code reçu par e-mail
            </label>
            <input
              id="code-signature"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              disabled={enCours}
              className="border-border-field mt-1 min-h-12 w-40 rounded border px-3 text-lg tracking-widest tabular-nums"
            />
          </div>
        )}

        {erreur !== null && (
          <p role="alert" className="mt-4 text-sm text-red-700">
            {erreur}
          </p>
        )}

        <button
          type="button"
          onClick={soumettre}
          disabled={!pretASigner || enCours}
          className="bg-terracotta hover:bg-terracotta-deep mt-6 rounded px-5 py-2.5 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40"
        >
          {enCours ? "Enregistrement…" : `Signer ${pieceLibelle}`}
        </button>
        {!pretASigner && (
          <p className="text-fg-soft mt-2 text-xs">
            {(modeAccessible
              ? "Cochez la case ci-dessus pour confirmer votre accord."
              : "Tracez votre signature et cochez la case ci-dessus.") +
              (cgv !== undefined
                ? " Cochez aussi la case des conditions générales de vente."
                : "") +
              (formules !== undefined
                ? " Choisissez votre formule et vérifiez le récapitulatif."
                : "") +
              (avecDeclaration
                ? " Renseignez votre nom et votre fonction, et cochez la déclaration de pouvoir."
                : "") +
              (avecCode ? " Saisissez ensuite le code reçu par e-mail." : "")}
          </p>
        )}
      </section>
    </div>
  );
}
