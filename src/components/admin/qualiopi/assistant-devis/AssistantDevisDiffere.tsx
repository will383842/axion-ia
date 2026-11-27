"use client";
// use-client: `next/dynamic` ne découpe un composant client que depuis un fichier client (guide lazy-loading).

/**
 * Chargement différé de l'assistant « Nouveau devis ». La page serveur importe CE fichier :
 * le JS de `AssistantDevisPage` sort du chunk de la route et n'est téléchargé que si
 * l'interrupteur monte l'assistant. Page éteinte = poids d'avant.
 */

import dynamic from "next/dynamic";

import type { PropsAssistantDevisPage } from "./AssistantDevisPage";

const AssistantDevisPage = dynamic(
  () => import("./AssistantDevisPage").then((m) => m.AssistantDevisPage),
  { loading: () => null },
);

export function AssistantDevisDiffere(props: PropsAssistantDevisPage) {
  return <AssistantDevisPage {...props} />;
}
