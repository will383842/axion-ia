"use client";
// use-client: assemble les étapes de l'assistant et branche les actions serveur côté navigateur.

/**
 * Page « Nouveau devis » par l'assistant (fiche E17b). Reçoit les données sérialisables de la
 * page serveur et monte `AssistantDevisBranche` avec les étapes 1, 1b, 2 et 3. Aucun montant
 * n'est calculé ici : tout vient du serveur ou du moteur déjà branché dans les étapes.
 */
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";

import { createClientAction } from "@/server/actions/qualiopi/clients";
import { lireBandeauAttributionAction } from "@/server/actions/qualiopi/devis";
import type { BibliothequeAssistant } from "@/server/qualiopi/devis/assistant/charger";
import type { PayloadAssistantV1 } from "@/server/qualiopi/devis/assistant/payload";

import type { TexteCopie } from "../devis-formules/saisie";
import { AssistantDevisBranche } from "./AssistantDevisBranche";
import { EtapeFormules } from "./etapes/formules/EtapeFormules";
import { EtapePaiement } from "./etapes/paiement/EtapePaiement";
import { EtapePhases } from "./etapes/phases/EtapePhases";
import { EtapeClientProjet } from "./etapes/un/EtapeClientProjet";
import type { ClientOption } from "./etapes/un/BlocClient";
import type { OffreCatalogue } from "./lignes";

export interface OffreSerialisee {
  tierId: string | null;
  code: string;
  titreFr: string;
  prixHtCents: number | null;
  noteDevisFr: string | null;
}

export interface PropsAssistantDevisPage {
  payloadInitial: PayloadAssistantV1;
  brouillon: { id: string; revision: number } | null;
  clients: readonly (ClientOption & { salutation?: string })[];
  offres: readonly OffreSerialisee[];
  textesParDefaut: readonly TexteCopie[];
  bibliotheque: BibliothequeAssistant;
  tauxStandard: number;
  formulesActives: boolean;
  validiteParDefaut: string;
  versionCgv: string;
  aujourdhui: string;
  urlAssistant: string;
  /** Panneau « Ce que le client a dit », rendu par le serveur. */
  aide?: ReactNode;
  /** Interrupteur en « essai » : aucune création de fiche, seules les fiches d'essai sont proposées. */
  modeEssai?: boolean | undefined;
  /** Chemin de la fiche d'un devis, sans identifiant final (`…/qualiopi/devis`). */
  baseDevis: string;
}

/** Salutation d'un contact créé ici : la fiche la fixe, l'écran ne l'invente pas. */
export const SALUTATION_SUIT_LA_FICHE = "La salutation suit la fiche du client.";

export function AssistantDevisPage(p: PropsAssistantDevisPage) {
  const router = useRouter();
  // Contacts créés à l'étape 1 : tenus ICI pour que l'envoi les retrouve.
  const [crees, setCrees] = useState<ClientOption[]>([]);
  const clients = useMemo(() => [...p.clients, ...crees], [p.clients, crees]);
  const offres = useMemo<OffreCatalogue[]>(
    () =>
      p.offres.map((o) => ({
        tierId: o.tierId,
        code: o.code,
        titreFr: o.titreFr,
        prixHtCents: o.prixHtCents,
        noteDevisFr: o.noteDevisFr ?? "",
      })),
    [p.offres],
  );
  const salutations = useMemo(() => {
    const r: Record<string, string> = {};
    for (const c of p.clients) if (c.salutation !== undefined) r[c.id] = c.salutation;
    for (const c of crees) r[c.id] = SALUTATION_SUIT_LA_FICHE;
    return r;
  }, [p.clients, crees]);

  return (
    <AssistantDevisBranche
      payloadInitial={p.payloadInitial}
      brouillon={p.brouillon}
      clients={clients}
      textesParDefaut={p.textesParDefaut}
      tauxStandard={p.tauxStandard}
      formulesActives={p.formulesActives}
      validiteParDefaut={p.validiteParDefaut}
      versionCgv={p.versionCgv}
      urlAssistant={p.urlAssistant}
      salutations={salutations}
      onEnvoye={({ devisId }) => router.push(`${p.baseDevis}/${devisId}`)}
      rendreEtape={({ etape, etat, dispatch }) => {
        if (etape === 1)
          return (
            <EtapeClientProjet
              etat={etat}
              dispatch={dispatch}
              clients={clients}
              onClientCree={(c) => setCrees((a) => [...a, c])}
              offres={offres}
              tvaStandardPct={p.tauxStandard}
              lireBandeau={lireBandeauAttributionAction}
              {...(p.modeEssai ? {} : { creerClient: createClientAction })}
              aujourdhui={p.aujourdhui}
              aide={p.aide}
            />
          );
        if (etape === "1b")
          return (
            <EtapePhases
              etape={etape}
              etat={etat}
              dispatch={dispatch}
              texteDelais={p.bibliotheque.delais}
              phraseGarantie={p.bibliotheque.garantie}
            />
          );
        if (etape === 2)
          return (
            <EtapeFormules
              etape={etape}
              etat={etat}
              dispatch={dispatch}
              tvaStandardPct={p.tauxStandard}
              avantagesPossibles={p.bibliotheque.avantages}
              aSavoirPossibles={p.bibliotheque.aSavoir}
              textePlafond={p.bibliotheque.plafond}
            />
          );
        if (etape === 3)
          return (
            <EtapePaiement
              etape={etape}
              etat={etat}
              dispatch={dispatch}
              tvaStandardPct={p.tauxStandard}
            />
          );
        return null;
      }}
    />
  );
}
