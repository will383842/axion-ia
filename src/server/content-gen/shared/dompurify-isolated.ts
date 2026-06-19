/**
 * Content Generator — instance DOMPurify ISOLÉE (anti-pollution globals).
 *
 * ⚠️ **NE JAMAIS réimporter `isomorphic-dompurify` dans le graphe du worker.**
 *
 * **Pourquoi ce module existe** (incident 2026-06-19) :
 * `isomorphic-dompurify` importe `jsdom` d'une manière qui **écrase les globals
 * Node natifs** (`Headers`, `Request`, `Response`, `Blob`…) par les
 * implémentations jsdom. Or le SDK `openai` (comme toute lib bâtie sur `fetch`
 * natif / undici) s'appuie sur ces globals pour sérialiser ses requêtes et
 * calculer l'en-tête `Content-Length`. Les versions jsdom produisent un
 * content-length invalide → undici rejette la requête avec
 * `UND_ERR_INVALID_ARG: invalid content-length header`, surfacé comme
 * « OpenAI API error undefined: Connection error. » → **TOUS les jobs
 * content-gen échouent dès le premier appel LLM**, parce que le sanitizer est
 * chargé au boot du process worker (content-gen-worker → generators →
 * v7-phase8-shared → html-sanitizer).
 *
 * **Le fix** : construire DOMPurify sur une fenêtre `jsdom` créée
 * explicitement et **gardée locale** — on ne touche jamais à `globalThis`. Les
 * globals natifs (`Headers`/`Request`/`fetch`) restent intacts pour le SDK
 * OpenAI. Vérifié en prod : `jsdom` + `dompurify` manuels → appels OpenAI OK +
 * sanitisation identique ; `isomorphic-dompurify` → « invalid content-length ».
 *
 * Les deux sanitizers content-gen (`html-sanitizer`, `faq-sanitizer`) importent
 * leur instance DOMPurify d'ici, jamais directement d'`isomorphic-dompurify`.
 */

import { JSDOM } from "jsdom";
import createDOMPurify, { type WindowLike } from "dompurify";

// Fenêtre jsdom isolée : NON assignée à globalThis (c.-à-d. aucune pollution
// des globals natifs Node consommés par le SDK OpenAI / undici).
const { window } = new JSDOM("");

const DOMPurify = createDOMPurify(window as unknown as WindowLike);

export default DOMPurify;
