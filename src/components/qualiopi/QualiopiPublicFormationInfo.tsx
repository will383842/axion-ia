/**
 * Bloc public « Informations réglementaires » (Qualiopi indicateur 1) — harmonisation
 * Option A : alimente les fiches marketing /interventions/* depuis la formation Qualiopi
 * rattachée à l'offre (tierId). Server Component.
 *
 * Gating STRICT (sinon rend `null`, zéro impact visuel) :
 *   - build stub.invalid (ADR 0026) → null
 *   - Phase A légale (OF_PUBLIC_DISCLOSURE_ENABLED ≠ "true") → null
 *   - aucune formation publiée+active pour cette offre → null
 *
 * Vit en zone allowlistée cloisonnement (src/components/qualiopi/**). Les fiches
 * /interventions l'importent par `@/components/qualiopi/…` + une string tierId : elles
 * NE référencent aucun symbole `@/server/qualiopi/…` → pas de violation d'isolation.
 */

import { Container } from "@/components/layout/Container";
import { isQualiopiPublicDisclosureEnabled } from "@/server/qualiopi/config/flag";
import { getPublicFormationByOffreTier } from "@/server/qualiopi/formations/formations";
import { LEGAL_MENTIONS } from "@/server/qualiopi/legal/legal-mentions";

type ObjectifItem = string | { verbe?: string; description?: string };
type IndicateurPublie = { libelle: string; valeur: number; unite: string; annee: number };

function objectifText(item: ObjectifItem): string {
  if (typeof item === "string") return item;
  return `${item.verbe ? `${item.verbe} ` : ""}${item.description ?? ""}`.trim();
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-border rounded-2xl border bg-white p-5 sm:p-6">
      <h3 className="text-fg mb-2 text-base leading-tight font-semibold tracking-tight">{title}</h3>
      {children}
    </div>
  );
}

/**
 * @param tier   tierId de l'offre rattachée à cette fiche (cf. intervention-path-map).
 */
export async function QualiopiPublicFormationInfo({ tier }: { tier: string }) {
  if (process.env.DATABASE_URL?.includes("stub.invalid")) return null;
  if (!isQualiopiPublicDisclosureEnabled()) return null;

  const f = await getPublicFormationByOffreTier(tier);
  if (!f) return null;

  const objectifs: ObjectifItem[] = Array.isArray(f.objectifsPedagogiques)
    ? (f.objectifsPedagogiques as ObjectifItem[])
    : [];
  const indicateurs: IndicateurPublie[] = Array.isArray(f.indicateursPublies)
    ? (f.indicateursPublies as IndicateurPublie[])
    : [];

  return (
    <section className="bg-sand border-border border-t py-12 sm:py-16">
      <Container>
        <div className="mx-auto max-w-4xl">
          <p className="text-terracotta-deep mb-2 text-[11px] font-bold tracking-[0.16em] uppercase">
            Formation professionnelle continue
          </p>
          <h2 className="text-fg text-2xl leading-tight font-semibold tracking-tight">
            Informations réglementaires
          </h2>
          <p className="text-fg-muted mt-2 text-sm leading-snug">
            Fiche conforme au Référentiel National Qualité — {f.numero} · {f.dureeHeures} h.{" "}
            {LEGAL_MENTIONS.factureExonerationTva}
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {objectifs.length > 0 ? (
              <div className="sm:col-span-2">
                <Block title="Objectifs pédagogiques">
                  <ul className="space-y-2">
                    {objectifs.map((o, i) => (
                      <li
                        key={i}
                        className="text-fg-soft flex items-start gap-2.5 text-[15px] leading-relaxed"
                      >
                        <span
                          aria-hidden="true"
                          className="bg-terracotta mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                        />
                        <span>{objectifText(o)}</span>
                      </li>
                    ))}
                  </ul>
                </Block>
              </div>
            ) : null}

            <Block title="Prérequis">
              <p className="text-fg-soft text-[15px] leading-relaxed">
                Aucun prérequis technique. Une utilisation courante d&apos;un ordinateur suffit.
              </p>
            </Block>

            <Block title="Délai d'accès">
              <p className="text-fg-soft text-[15px] leading-relaxed">
                Nous consulter — sous 11 jours ouvrés minimum à compter de la confirmation
                d&apos;inscription et de la prise en charge financeur.
              </p>
            </Block>

            <Block title="Modalités d'évaluation">
              <p className="text-fg-soft text-[15px] leading-relaxed">
                Évaluation formative continue (exercices pratiques) + quiz de positionnement en
                amont et évaluation à chaud en fin de parcours. Seuil de réussite :{" "}
                {f.seuilReussitePct} %. Une attestation de formation est délivrée.{" "}
                {LEGAL_MENTIONS.attestation}
              </p>
            </Block>

            <Block title="Accessibilité et handicap">
              <p className="text-fg-soft text-[15px] leading-relaxed">
                Un référent handicap étudie toute demande d&apos;adaptation pédagogique ou
                technique. {LEGAL_MENTIONS.referentHandicap}
              </p>
            </Block>

            <div className="sm:col-span-2">
              <Block title="Indicateurs de résultats">
                {indicateurs.length > 0 ? (
                  <ul className="divide-border divide-y">
                    {indicateurs.map((ind, i) => (
                      <li key={i} className="flex items-center justify-between py-2.5">
                        <span className="text-fg-soft text-[15px]">{ind.libelle}</span>
                        <span className="text-fg font-semibold tabular-nums">
                          {ind.valeur}
                          {ind.unite ? <>&nbsp;{ind.unite}</> : null}
                          <span className="text-fg-muted ml-1 text-[11px] font-normal">
                            ({ind.annee})
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-fg-soft text-[15px] leading-relaxed">
                    Taux de satisfaction, de réalisation et d&apos;atteinte des objectifs en cours
                    de constitution sur la base des premières sessions — affichage automatique dès
                    disponibilité.
                  </p>
                )}
              </Block>
            </div>

            {f.certificationType != null && f.certificationType !== "aucune" ? (
              <div className="sm:col-span-2">
                <Block title="Certification">
                  <p className="text-fg-soft text-[15px] leading-relaxed">
                    Formation préparant à une certification{" "}
                    {f.certificationType === "rncp"
                      ? "enregistrée au RNCP"
                      : "enregistrée au Répertoire spécifique"}
                    {f.codeRncp ? ` (${f.codeRncp})` : f.codeRs ? ` (${f.codeRs})` : ""}
                    {f.certificateurNom ? ` — certificateur : ${f.certificateurNom}` : ""}.
                    {f.cpfEligible ? " Éligible CPF." : ""}
                  </p>
                </Block>
              </div>
            ) : null}
          </div>
        </div>
      </Container>
    </section>
  );
}
