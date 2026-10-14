// Banc @formateurs (missions) — AIDES côté serveur : lectures de registres écrits
// dans le code, qu'un spec ne peut pas lire lui-même (son chargeur ne charge pas
// la chaîne de modules serveur). Aucune écriture, aucune logique métier ici.

import { TEXTES_FORMATEURS_A_VALIDER } from "@/server/email/textes-formateurs-a-valider";

/** Les textes formateurs que l'écran des gabarits fait valider (gabarit, variante). */
export function textesFormateursAValider(): Array<{ gabarit: string; variante?: string }> {
  return TEXTES_FORMATEURS_A_VALIDER.map((t) => ({
    gabarit: t.gabarit,
    ...(t.variante !== undefined ? { variante: t.variante } : {}),
  }));
}

/**
 * L'e-mail tel que le worker l'enverra : les données du job lues dans la VRAIE file
 * (Redis — un job terminé y reste sept jours), rendues par le même moteur que le
 * worker (`renderEmailTemplate` après `payloadPourRendu`).
 *
 * Pourquoi pas le puits SMTP : la file des scénarios n'est pas consommée par le
 * worker (cf. `redisDuBanc`, `missions-pilote.ts`). Ce que le banc prouve ici est
 * le CONTENU de ce qui est en file ; la remise au puits est prouvée, une fois pour
 * toutes, par `envois-par-la-file.spec.ts`.
 */
export async function rendreEnvoiEnFile(
  jobId: string,
): Promise<{ template: string; to: string; sujet: string; texte: string } | null> {
  const { emailsQueue } = await import("@/server/queue/queues");
  const { renderEmailTemplate } = await import("@/lib/email/templates");
  const { payloadPourRendu } = await import("@/server/email/code-en-file");
  if (emailsQueue === null) throw new Error("banc @formateurs : aucune file d'e-mails");
  const job = await emailsQueue.getJob(jobId);
  if (!job) return null;
  const d = job.data;
  const rendu = await renderEmailTemplate(
    d.template,
    d.locale,
    payloadPourRendu(d.template, d.payload),
    {
      destinataire: d.to,
    },
  );
  return {
    template: d.template,
    to: d.to,
    sujet: rendu.subject,
    texte: `${rendu.text}\n${rendu.html}`,
  };
}

/**
 * Un contrat-cadre RÉEL (PDF rendu, instantané rangé) dans une version DONNÉE, pour un
 * indépendant du banc — avec les mêmes briques que `preparerContratCadre`
 * (`lireFaitsEmissionContrat`, `donneesContratCadreIndependant`, `generateDocument`),
 * et le composant de CETTE version (`composantGabarit`).
 *
 * Pourquoi pas `preparerContratCadre` : il n'émet que la DERNIÈRE version arrêtée.
 * Le scénario a besoin d'un contrat signé dans une version antérieure, comme en
 * garde un formateur entré avant la nouvelle version. Le registre public est
 * simulé par l'injection prévue (`lire`) : établissement actif, même SIRET.
 */
export async function genererContratCadreBanc(trainerId: string, version: number): Promise<string> {
  const React = (await import("react")).default;
  const { lireFaitsEmissionContrat } =
    await import("@/server/qualiopi/formateurs-independants/contrat-cadre-emission");
  const { donneesContratCadreIndependant } =
    await import("@/server/qualiopi/formateurs-independants/contrat-cadre-emission-regles");
  const { generateDocument } = await import("@/server/qualiopi/documents/documents-service");
  const { getOrganismeIdentite } = await import("@/server/qualiopi/documents/organisme");
  const { getQualiopiConfig } = await import("@/server/qualiopi/config/site-settings");
  const { composantGabarit } =
    await import("@/server/qualiopi/documents/signature/exemplaire-signe");
  const faits = await lireFaitsEmissionContrat(
    trainerId,
    async (siret: string) =>
      ({ ok: true, entreprise: { siret, active: true } }) as unknown as Awaited<
        ReturnType<NonNullable<Parameters<typeof lireFaitsEmissionContrat>[1]>>
      >,
    new Date(),
  );
  if (faits === null) throw new Error("banc : formateur introuvable");
  const identite = await getOrganismeIdentite();
  const axion = {
    regionDeclaration: await getQualiopiConfig("nda_region"),
    adresseFormateurs: await getQualiopiConfig("adresse_formateurs"),
    certificateur: "",
  };
  const Composant = composantGabarit("contrat_sous_traitance", version);
  if (Composant === null) throw new Error(`banc : aucun composant pour la version ${version}`);
  const doc = await generateDocument({
    type: "contrat_sous_traitance",
    identite,
    buildElement: (numero: string) =>
      React.createElement(Composant as never, {
        data: donneesContratCadreIndependant(faits, axion, numero, "14 octobre 2026"),
        identite,
      }),
    refs: { trainerId },
    gabaritVersion: version,
    estCopie: false,
  });
  return doc.id;
}
