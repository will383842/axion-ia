/**
 * Émission des balises de tunnel vers `POST /api/funnel`.
 *
 * ── Pourquoi doubler Plausible ────────────────────────────────────────────
 * Plausible donne des totaux par événement. Il ne permet pas de reconstituer
 * un parcours individuel — donc pas de savoir À QUEL ÉCRAN partent ceux qui
 * abandonnent, ni si les décrocheurs viennent d'une campagne précise. C'est
 * pourtant la seule lecture qui indique quoi corriger. Le chaînage par
 * identifiant de session, côté base, le permet.
 *
 * ── Contraintes tenues ici ────────────────────────────────────────────────
 * 1. **INP.** L'envoi passe par `navigator.sendBeacon`, qui rend la main
 *    immédiatement et survit à la navigation. Aucun `await` n'est possible sur
 *    ce chemin : le budget d'interactivité du dépôt (INP ≤ 100 ms p75, 150 ms
 *    sur les pages lourdes) ne tolérerait pas un aller-retour réseau dans un
 *    gestionnaire de clic.
 * 2. **Silence total en cas de panne.** Toute erreur est avalée. Une mesure
 *    cassée ne doit jamais casser un tunnel de vente.
 * 3. **Vie privée.** L'identifiant de session vit dans `sessionStorage`, JAMAIS
 *    dans un cookie : il meurt à la fermeture de l'onglet et ne suit personne
 *    d'un site à l'autre. C'est une condition de l'exemption de consentement
 *    sous laquelle les pages de tunnel se passent volontairement de bannière.
 *    🔴 Ne pas migrer vers un cookie ni vers `localStorage` : `localStorage`
 *    persiste et transformerait cette mesure en suivi durable, ce qui exigerait
 *    une bannière sur les pages qui n'en ont pas.
 */

import {
  FUNNEL_EVENT_NAMES,
  type FunnelEventInput,
  type FunnelKey,
} from "@/lib/schemas/funnel-event-schema";
import type { FunnelEvent, FunnelProps } from "@/lib/tracking";

const STORAGE_KEY = "axion-funnel-session";
const ENDPOINT = "/api/funnel";

/** Ensemble des événements journalisés côté serveur, pour un test en O(1). */
const EVENEMENTS_JOURNALISES: ReadonlySet<string> = new Set(FUNNEL_EVENT_NAMES);

/**
 * Détermine le tunnel à partir du chemin courant.
 *
 * Fonction PURE et exportée pour être testable sans navigateur : c'est elle
 * qui décide si une balise part ou non, et une erreur ici rendrait tout un
 * tunnel invisible sans lever la moindre exception.
 *
 * Le préfixe de langue est ignoré : `/fr/diagnostic` et `/diagnostic` sont le
 * même tunnel.
 */
export function funnelKeyFromPath(pathname: string | null | undefined): FunnelKey | null {
  if (!pathname) return null;
  // Un `includes` nu ferait correspondre `/interventions/diagnostic-express`.
  // On exige donc un segment de chemin entier.
  const segments = pathname.split("/").filter((s) => s.length > 0);
  if (segments.includes("diagnostic")) return "diagnostic";
  if (segments.includes("simulateur")) return "simulateur";
  if (segments.includes("roi")) return "roi";
  return null;
}

/** Identifiant de session éphémère, créé à la première balise de l'onglet. */
function sessionId(): string | null {
  try {
    const existant = window.sessionStorage.getItem(STORAGE_KEY);
    if (existant && existant.length >= 8 && existant.length <= 64) return existant;

    // `randomUUID` n'existe pas hors contexte sécurisé ni sur les navigateurs
    // anciens. Le repli n'a pas besoin d'être cryptographique : cet identifiant
    // ne protège rien, il ne fait que relier entre elles les balises d'un même
    // onglet. Une collision ne coûte qu'un parcours mal chaîné.
    const brut =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    const id = `s-${brut}`.slice(0, 64);
    window.sessionStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    // `sessionStorage` lève en navigation privée sur certains navigateurs, et
    // quand l'utilisateur a interdit le stockage. Dans ce cas on renonce à la
    // mesure — pas question de replier sur un cookie.
    return null;
  }
}

/** Famille d'appareil, déduite de la largeur d'affichage. */
function deviceType(): FunnelEventInput["deviceType"] {
  const largeur = window.innerWidth;
  if (largeur < 768) return "mobile";
  if (largeur < 1024) return "tablet";
  return "desktop";
}

/**
 * Envoie une balise, si et seulement si l'événement est journalisé ET la page
 * appartient à un tunnel. Ne lève jamais, ne rend jamais rien.
 *
 * 🔴 Les champs d'attribution publicitaire (`utm*`) ne sont volontairement PAS
 * envoyés : le serveur les relit depuis le cookie déposé à l'arrivée. Une
 * valeur venue du client serait falsifiable, et fausserait l'attribution des
 * campagnes payantes — précisément la donnée qu'on veut fiable.
 */
export function sendFunnelBeacon(event: FunnelEvent, props: FunnelProps = {}): void {
  if (typeof window === "undefined") return;
  if (!EVENEMENTS_JOURNALISES.has(event)) return;

  const funnel = funnelKeyFromPath(window.location?.pathname);
  if (!funnel) return;

  const id = sessionId();
  if (!id) return;

  // Construction explicite plutôt qu'un étalement de `props` : le schéma
  // serveur REFUSE toute clé inconnue. Un étalement ferait donc rejeter
  // silencieusement la balise dès qu'une propriété propre à Plausible
  // (`intervention`, `priceBucket`…) serait présente.
  const charge: FunnelEventInput = {
    funnel,
    event: event as FunnelEventInput["event"],
    sessionId: id,
    deviceType: deviceType(),
    route: window.location.pathname.slice(0, 255),
    ...(document.documentElement.lang
      ? { locale: document.documentElement.lang.slice(0, 10) }
      : {}),
    ...(props.step ? { step: props.step.slice(0, 60) } : {}),
    ...(typeof props.stepIndex === "number" ? { stepIndex: props.stepIndex } : {}),
    ...(typeof props.stepTotal === "number" ? { stepTotal: props.stepTotal } : {}),
    ...(props.sector ? { sector: props.sector.slice(0, 60) } : {}),
    ...(props.headcount ? { headcount: props.headcount.slice(0, 40) } : {}),
    ...(props.gainBucket ? { gainBucket: props.gainBucket } : {}),
    ...(props.landing ? { landing: props.landing.slice(0, 60) } : {}),
    ...(props.placement ? { placement: props.placement.slice(0, 40) } : {}),
  };

  try {
    const corps = JSON.stringify(charge);
    // `sendBeacon` rend la main immédiatement et survit à la navigation — c'est
    // ce qui permet de mesurer un clic de bouton qui quitte la page.
    if (typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon(ENDPOINT, new Blob([corps], { type: "application/json" }));
      return;
    }
    // Repli : `keepalive` obtient la même survie à la navigation. Le `catch`
    // porte sur la promesse, pas seulement sur l'appel.
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: corps,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Mesure perdue. Jamais de propagation : le tunnel prime.
  }
}
