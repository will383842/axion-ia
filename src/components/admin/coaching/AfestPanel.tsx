"use client";
// use-client: formulaire interactif (useState/useTransition) appelant les Server Actions AFEST.

/**
 * Coaching 1-to-1 — panneau AFEST (console admin Qualiopi).
 *
 * Cadrage AFEST (estAfest, heures prévues, tuteur) + financement (OPCO / CPF /
 * France Travail) + certification France Compétences (RNCP / RS) + génération
 * des documents légaux (protocole, attestation en heures, émargement, kits
 * financeurs, convention tripartite, certificat de réalisation). Appelle les
 * Server Actions `coaching-afest`. Affiche les heures réelles et les documents.
 */

import { useState, useTransition } from "react";
import {
  setAfestCadrageAction,
  setFinancementCoachingAction,
  setCertificationCoachingAction,
  genererProtocoleAfestAction,
  genererAttestation1to1Action,
  genererEmargement1to1Action,
  genererPositionnement1to1Action,
  genererSatisfaction1to1Action,
  genererFactureCoachingAction,
  genererKitCoachingAction,
  acterPresenceSeance1to1Action,
} from "@/server/actions/qualiopi/coaching-afest";

const DOC_LABELS: Record<string, string> = {
  protocole_afest: "Protocole AFEST",
  attestation: "Attestation de réalisation",
  attestation_partielle: "Attestation partielle",
  emargement: "Feuille d'émargement",
  positionnement: "Positionnement",
  satisfaction: "Satisfaction",
  facture: "Facture",
  kit_opco: "Kit OPCO",
  kit_cpf: "Kit CPF / EDOF",
  kit_france_travail: "Kit France Travail",
  convention_tripartite: "Convention tripartite",
  certificat_realisation: "Certificat de réalisation",
};

export interface AfestFinancement {
  financementType: string;
  montantHtCents: number;
  subrogation: boolean;
  numeroDossierOpco: string | null;
  conventionTripartiteSigneeAt: string | null;
  priseEnChargeMontantCents: number | null;
  priseEnChargeUnite: string | null;
  edofVerifieAt: string | null;
  resteAChargeCents: number | null;
  ftDispositif: string | null;
  ftAifPrescriptionDate: string | null;
  ftPoeiOffreEmploiNumero: string | null;
}

export interface AfestCertification {
  certificationType: string;
  codeRncp: string | null;
  codeRs: string | null;
  cpfEligible: boolean;
}

export interface AfestPanelProps {
  coachingSessionId: string;
  revalidatePath: string;
  estAfest: boolean;
  heuresReelles: number;
  heuresPrevues: number | null;
  tuteurNom: string | null;
  tuteurEmail: string | null;
  attestationResultat: string | null;
  coachingContractId: string | null;
  financement: AfestFinancement | null;
  certification: AfestCertification;
  seances: ReadonlyArray<{ id: string; date: string; presenceSignee: boolean }>;
  documents: ReadonlyArray<{ id: string; type: string; numero: string; pdfUrl: string | null }>;
}

const eurosFromCents = (c: number | null | undefined): string =>
  c != null ? String(Math.round(c) / 100) : "";
const centsFromEuros = (v: string): number | undefined =>
  v.trim() === "" ? undefined : Math.round(Number(v) * 100);

export function AfestPanel(props: AfestPanelProps): React.ReactElement {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [estAfest, setEstAfest] = useState(props.estAfest);
  const [heuresPrevues, setHeuresPrevues] = useState(
    props.heuresPrevues != null ? String(props.heuresPrevues) : "",
  );
  const [tuteurNom, setTuteurNom] = useState(props.tuteurNom ?? "");
  const [tuteurEmail, setTuteurEmail] = useState(props.tuteurEmail ?? "");

  // Financement
  const f = props.financement;
  const [finType, setFinType] = useState(f?.financementType ?? "direct");
  const [montant, setMontant] = useState(eurosFromCents(f?.montantHtCents));
  const [subrogation, setSubrogation] = useState(f?.subrogation ?? false);
  const [numDossier, setNumDossier] = useState(f?.numeroDossierOpco ?? "");
  const [conventionDate, setConventionDate] = useState(f?.conventionTripartiteSigneeAt ?? "");
  const [priseMontant, setPriseMontant] = useState(eurosFromCents(f?.priseEnChargeMontantCents));
  const [priseUnite, setPriseUnite] = useState(f?.priseEnChargeUnite ?? "euro_heure");
  const [edofDate, setEdofDate] = useState(f?.edofVerifieAt ?? "");
  const [resteCharge, setResteCharge] = useState(eurosFromCents(f?.resteAChargeCents));
  const [ftDispositif, setFtDispositif] = useState(f?.ftDispositif ?? "aif");
  const [ftAifDate, setFtAifDate] = useState(f?.ftAifPrescriptionDate ?? "");
  const [ftPoeiNum, setFtPoeiNum] = useState(f?.ftPoeiOffreEmploiNumero ?? "");

  // Certification France Compétences
  const c = props.certification;
  const [certifType, setCertifType] = useState(c.certificationType);
  const [codeRncp, setCodeRncp] = useState(c.codeRncp ?? "");
  const [codeRs, setCodeRs] = useState(c.codeRs ?? "");
  // CPF non modifiable (2026-07-04) — Axion-IA non habilité CPF : plus de setter,
  // la valeur existante est préservée en lecture (soumise telle quelle au submit).
  const [cpfEligible] = useState(c.cpfEligible);

  function saveFinancement() {
    const montantCents = centsFromEuros(montant);
    const priseCents = centsFromEuros(priseMontant);
    const resteCents = centsFromEuros(resteCharge);
    run(
      () =>
        setFinancementCoachingAction({
          coachingContractId: props.coachingContractId as string,
          financementType: finType as "direct" | "opco" | "cpf" | "france_travail" | "mixte",
          ...(montantCents !== undefined ? { montantHtCents: montantCents } : {}),
          subrogation,
          numeroDossierOpco: numDossier,
          ...(conventionDate ? { conventionTripartiteSigneeAt: conventionDate } : {}),
          ...(priseCents !== undefined ? { priseEnChargeMontantCents: priseCents } : {}),
          priseEnChargeUnite: priseUnite as
            "euro_heure" | "euro_jour" | "euro_formation" | "euro_an_salarie",
          ...(edofDate ? { edofVerifieAt: edofDate } : {}),
          ...(resteCents !== undefined ? { resteAChargeCents: resteCents } : {}),
          ftDispositif: ftDispositif as "aif" | "poei" | "csp",
          ...(ftAifDate ? { ftAifPrescriptionDate: ftAifDate } : {}),
          ftPoeiOffreEmploiNumero: ftPoeiNum,
          revalidate: props.revalidatePath,
        }),
      "Financement enregistré.",
    );
  }

  function run(action: () => Promise<{ ok: boolean; error?: string }>, okText: string) {
    setMessage(null);
    startTransition(async () => {
      const res = await action();
      // ok+error = avertissement non bloquant (pré-requis dispositif).
      if (res.ok && res.error) setMessage({ kind: "err", text: `${okText} ⚠️ ${res.error}` });
      else if (res.ok) setMessage({ kind: "ok", text: okText });
      else setMessage({ kind: "err", text: res.error ?? "Erreur" });
    });
  }

  const inputCls =
    "border-border w-full rounded-md border px-2 py-1 text-sm focus:outline-none focus:ring-1";
  const btnSecondary =
    "border-border rounded-md border px-3 py-1 text-xs font-medium disabled:opacity-50";
  const labelCls = "text-fg-muted text-xs";

  return (
    <section className="border-border bg-cream rounded-lg border p-4">
      <h2 className="text-mocha mb-2 text-sm font-semibold">AFEST · documents légaux</h2>

      <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
        <p>
          <span className="text-fg-muted">Heures réalisées (Σ séances) : </span>
          <span className="text-mocha font-medium">{props.heuresReelles} h</span>
        </p>
        <p>
          <span className="text-fg-muted">Heures prévues : </span>
          {props.heuresPrevues != null ? `${props.heuresPrevues} h` : "—"}
        </p>
        <p>
          <span className="text-fg-muted">Attestation : </span>
          {props.attestationResultat ?? "non émise"}
        </p>
      </div>

      {/* Cadrage AFEST */}
      <div className="border-border mb-3 space-y-2 border-t pt-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={estAfest}
            onChange={(e) => setEstAfest(e.target.checked)}
          />
          <span>Parcours cadré en AFEST (action de formation en situation de travail)</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className={labelCls}>
            Heures prévues (convention)
            <input
              type="number"
              min={0}
              step={0.5}
              value={heuresPrevues}
              onChange={(e) => setHeuresPrevues(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className={labelCls}>
            Tuteur entreprise (nom)
            <input
              type="text"
              value={tuteurNom}
              onChange={(e) => setTuteurNom(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className={`${labelCls} col-span-2`}>
            Tuteur entreprise (email)
            <input
              type="email"
              value={tuteurEmail}
              onChange={(e) => setTuteurEmail(e.target.value)}
              className={inputCls}
            />
          </label>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(
              () =>
                setAfestCadrageAction({
                  coachingSessionId: props.coachingSessionId,
                  estAfest,
                  ...(heuresPrevues !== ""
                    ? { heuresPrevuesConvention: Number(heuresPrevues) }
                    : {}),
                  tuteurEntrepriseNom: tuteurNom,
                  tuteurEntrepriseEmail: tuteurEmail,
                  revalidate: props.revalidatePath,
                }),
              "Cadrage AFEST enregistré.",
            )
          }
          className="bg-terracotta rounded-md px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
        >
          Enregistrer le cadrage
        </button>
      </div>

      {/* Financement (contrat de coaching requis) */}
      {props.coachingContractId ? (
        <div className="border-border mb-3 space-y-2 border-t pt-3">
          <p className="text-mocha text-xs font-semibold">Financement</p>
          <div className="grid grid-cols-2 gap-2">
            <label className={labelCls}>
              Dispositif
              <select
                value={finType}
                onChange={(e) => setFinType(e.target.value)}
                className={inputCls}
              >
                <option value="direct">Direct (entreprise / particulier)</option>
                <option value="opco">OPCO</option>
                {/* CPF retiré (2026-07-04) — Axion-IA non habilité CPF. */}
                <option value="france_travail">France Travail</option>
                <option value="mixte">Mixte</option>
              </select>
            </label>
            <label className={labelCls}>
              Montant HT (€)
              <input
                type="number"
                min={0}
                step={1}
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
                className={inputCls}
              />
            </label>
          </div>

          {finType === "opco" || finType === "mixte" ? (
            <div className="grid grid-cols-2 gap-2">
              <label className="col-span-2 flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={subrogation}
                  onChange={(e) => setSubrogation(e.target.checked)}
                />
                <span>Subrogation OPCO (paiement direct à l&apos;organisme)</span>
              </label>
              <label className={labelCls}>
                N° dossier OPCO
                <input
                  type="text"
                  value={numDossier}
                  onChange={(e) => setNumDossier(e.target.value)}
                  className={inputCls}
                />
              </label>
              <label className={labelCls}>
                Convention tripartite signée le
                <input
                  type="date"
                  value={conventionDate}
                  onChange={(e) => setConventionDate(e.target.value)}
                  className={inputCls}
                />
              </label>
              <label className={labelCls}>
                Barème prise en charge (€)
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={priseMontant}
                  onChange={(e) => setPriseMontant(e.target.value)}
                  className={inputCls}
                />
              </label>
              <label className={labelCls}>
                Unité du barème
                <select
                  value={priseUnite}
                  onChange={(e) => setPriseUnite(e.target.value)}
                  className={inputCls}
                >
                  <option value="euro_heure">€ / heure</option>
                  <option value="euro_jour">€ / jour</option>
                  <option value="euro_formation">€ / formation</option>
                  <option value="euro_an_salarie">€ / an / salarié</option>
                </select>
              </label>
            </div>
          ) : null}

          {finType === "cpf" ? (
            <div className="grid grid-cols-2 gap-2">
              <label className={labelCls}>
                EDOF vérifié le
                <input
                  type="date"
                  value={edofDate}
                  onChange={(e) => setEdofDate(e.target.value)}
                  className={inputCls}
                />
              </label>
              <label className={labelCls}>
                Reste à charge bénéficiaire (€)
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={resteCharge}
                  onChange={(e) => setResteCharge(e.target.value)}
                  className={inputCls}
                />
              </label>
            </div>
          ) : null}

          {finType === "france_travail" ? (
            <div className="grid grid-cols-2 gap-2">
              <label className={labelCls}>
                Dispositif France Travail
                <select
                  value={ftDispositif}
                  onChange={(e) => setFtDispositif(e.target.value)}
                  className={inputCls}
                >
                  <option value="aif">AIF</option>
                  <option value="poei">POEI</option>
                  <option value="csp">CSP</option>
                </select>
              </label>
              <label className={labelCls}>
                Reste à charge (€)
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={resteCharge}
                  onChange={(e) => setResteCharge(e.target.value)}
                  className={inputCls}
                />
              </label>
              {ftDispositif === "aif" ? (
                <label className={labelCls}>
                  Date de prescription (AIF)
                  <input
                    type="date"
                    value={ftAifDate}
                    onChange={(e) => setFtAifDate(e.target.value)}
                    className={inputCls}
                  />
                </label>
              ) : null}
              {ftDispositif === "poei" ? (
                <label className={labelCls}>
                  N° offre d&apos;emploi (POEI)
                  <input
                    type="text"
                    value={ftPoeiNum}
                    onChange={(e) => setFtPoeiNum(e.target.value)}
                    className={inputCls}
                  />
                </label>
              ) : null}
            </div>
          ) : null}

          <button
            type="button"
            disabled={pending}
            onClick={saveFinancement}
            className="bg-terracotta rounded-md px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
          >
            Enregistrer le financement
          </button>
        </div>
      ) : (
        <p className="text-fg-muted border-border mb-3 border-t pt-3 text-xs">
          Aucun contrat de coaching rattaché : le financement et les kits financeurs ne sont pas
          disponibles pour ce parcours.
        </p>
      )}

      {/* Certification France Compétences (RNCP / RS) */}
      <div className="border-border mb-3 space-y-2 border-t pt-3">
        <p className="text-mocha text-xs font-semibold">Certification France Compétences</p>
        <div className="grid grid-cols-2 gap-2">
          <label className={labelCls}>
            Type
            <select
              value={certifType}
              onChange={(e) => setCertifType(e.target.value)}
              className={inputCls}
            >
              <option value="aucune">Aucune (action non certifiante)</option>
              <option value="rs">Répertoire spécifique (RS)</option>
              <option value="rncp">RNCP</option>
            </select>
          </label>
          {certifType === "rncp" ? (
            <label className={labelCls}>
              Code RNCP
              <input
                type="text"
                value={codeRncp}
                onChange={(e) => setCodeRncp(e.target.value)}
                className={inputCls}
              />
            </label>
          ) : null}
          {certifType === "rs" ? (
            <label className={labelCls}>
              Code RS
              <input
                type="text"
                value={codeRs}
                onChange={(e) => setCodeRs(e.target.value)}
                className={inputCls}
              />
            </label>
          ) : null}
          {/* Checkbox « Éligible CPF » RETIRÉE (2026-07-04) — Axion-IA n'a pas
              l'habilitation CPF ; une formation ne peut pas être marquée éligible
              CPF. La valeur existante (cpfEligible) est préservée en lecture. */}
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(
              () =>
                setCertificationCoachingAction({
                  coachingSessionId: props.coachingSessionId,
                  certificationType: certifType as "aucune" | "rs" | "rncp",
                  codeRncp,
                  codeRs,
                  cpfEligible,
                  revalidate: props.revalidatePath,
                }),
              "Certification enregistrée.",
            )
          }
          className={btnSecondary}
        >
          Enregistrer la certification
        </button>
      </div>

      {/* Génération de documents pédagogiques */}
      <div className="border-border mb-3 flex flex-wrap gap-2 border-t pt-3">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(
              () =>
                genererProtocoleAfestAction({
                  coachingSessionId: props.coachingSessionId,
                  revalidate: props.revalidatePath,
                }),
              "Protocole AFEST généré.",
            )
          }
          className={btnSecondary}
        >
          Générer le protocole AFEST
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(
              () =>
                genererAttestation1to1Action({
                  coachingSessionId: props.coachingSessionId,
                  force: true,
                  revalidate: props.revalidatePath,
                }),
              "Attestation générée.",
            )
          }
          className={btnSecondary}
        >
          {"Générer l'attestation en heures"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(
              () =>
                genererEmargement1to1Action({
                  coachingSessionId: props.coachingSessionId,
                  revalidate: props.revalidatePath,
                }),
              "Émargement généré.",
            )
          }
          className={btnSecondary}
        >
          {"Générer l'émargement"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(
              () =>
                genererPositionnement1to1Action({
                  coachingSessionId: props.coachingSessionId,
                  revalidate: props.revalidatePath,
                }),
              "Positionnement généré.",
            )
          }
          className={btnSecondary}
        >
          Générer le positionnement
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(
              () =>
                genererSatisfaction1to1Action({
                  coachingSessionId: props.coachingSessionId,
                  revalidate: props.revalidatePath,
                }),
              "Satisfaction générée.",
            )
          }
          className={btnSecondary}
        >
          Générer la satisfaction
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(
              () =>
                genererKitCoachingAction({
                  coachingSessionId: props.coachingSessionId,
                  kit: "certificat",
                  revalidate: props.revalidatePath,
                }),
              "Certificat de réalisation généré.",
            )
          }
          className={btnSecondary}
        >
          Générer le certificat de réalisation
        </button>
      </div>

      {/* Kits financeurs + facture (contrat requis) */}
      {props.coachingContractId ? (
        <div className="border-border mb-3 flex flex-wrap gap-2 border-t pt-3">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  genererKitCoachingAction({
                    coachingSessionId: props.coachingSessionId,
                    kit: "kit_opco",
                    revalidate: props.revalidatePath,
                  }),
                "Kit OPCO généré.",
              )
            }
            className={btnSecondary}
          >
            Kit OPCO
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  genererKitCoachingAction({
                    coachingSessionId: props.coachingSessionId,
                    kit: "kit_cpf",
                    revalidate: props.revalidatePath,
                  }),
                "Kit CPF généré.",
              )
            }
            className={btnSecondary}
          >
            Kit CPF / EDOF
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  genererKitCoachingAction({
                    coachingSessionId: props.coachingSessionId,
                    kit: "kit_france_travail",
                    revalidate: props.revalidatePath,
                  }),
                "Kit France Travail généré.",
              )
            }
            className={btnSecondary}
          >
            Kit France Travail
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  genererKitCoachingAction({
                    coachingSessionId: props.coachingSessionId,
                    kit: "convention_tripartite",
                    revalidate: props.revalidatePath,
                  }),
                "Convention tripartite générée.",
              )
            }
            className={btnSecondary}
          >
            Convention tripartite
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  genererFactureCoachingAction({
                    coachingContractId: props.coachingContractId as string,
                    revalidate: props.revalidatePath,
                  }),
                "Facture générée.",
              )
            }
            className={btnSecondary}
          >
            Générer la facture
          </button>
        </div>
      ) : null}

      {/* Présence par séance — DÉCLARÉE par l'organisme, pas signée.
          Cet écran affichait « présence signée » et proposait « Signer la
          présence » sur un bouton qui ne recueillait aucune signature : ni
          signataire, ni tracé, ni empreinte. Les vraies signatures se recueillent
          auprès des parties (bénéficiaire, formateur, tuteur), pas dans la
          console de l'organisme. */}
      {props.seances.length > 0 ? (
        <div className="border-border mb-3 space-y-1 border-t pt-3">
          <p className="text-fg-muted text-xs">
            {"Présence des séances (déclarée par l'organisme) :"}
          </p>
          {props.seances.map((s) => (
            <div key={s.id} className="flex items-center justify-between text-sm">
              <span>
                {s.date}{" "}
                {s.presenceSignee ? (
                  <span className="text-success text-xs">présence actée</span>
                ) : (
                  <span className="text-terracotta text-xs">non actée</span>
                )}
              </span>
              {!s.presenceSignee ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () =>
                        acterPresenceSeance1to1Action({
                          compteRenduId: s.id,
                          beneficiairePresent: true,
                          revalidate: props.revalidatePath,
                        }),
                      "Présence actée.",
                    )
                  }
                  className="border-border rounded-md border bg-[color:var(--color-admin-paper)] px-2 py-0.5 text-xs disabled:opacity-50"
                >
                  Acter la présence
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {message ? (
        <p className={`mb-2 text-xs ${message.kind === "ok" ? "text-success" : "text-terracotta"}`}>
          {message.text}
        </p>
      ) : null}

      {/* Documents émis */}
      {props.documents.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {props.documents.map((d) => (
            <li key={d.id} className="flex items-center justify-between">
              <span>
                {DOC_LABELS[d.type] ?? d.type}{" "}
                <span className="text-fg-muted font-mono text-xs">{d.numero}</span>
              </span>
              {/* `pdfUrl` = témoin d'upload R2, pas cible : l'URL stockée est
                  pré-signée 900 s et périmée. Cf. `/api/qualiopi/documents/[id]`. */}
              {d.pdfUrl ? (
                <a
                  href={`/api/qualiopi/documents/${d.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-terracotta text-xs hover:underline"
                >
                  PDF
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-fg-muted text-sm">Aucun document AFEST émis.</p>
      )}
    </section>
  );
}
