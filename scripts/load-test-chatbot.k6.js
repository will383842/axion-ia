// Test de charge chatbot (T-32, REQ-057/059) — k6.
//
// Simule une montée jusqu'à ~200 conversations simultanées contre la route SSE
// POST /api/chatbot/message, et vérifie les cibles du cahier (A1) :
//   - 1er token < 1,5 s (approximé par le TTFB, k6 ne stream pas le SSE finement)
//   - réponse totale < 6 s
//   - taux d'erreur < 2 %, pas de tempête de 429 (token-bucket = message d'attente)
//
// ⚠️ À lancer sur un ENVIRONNEMENT DÉPLOYÉ (staging) avec CHATBOT_ENABLED=true.
//   NE PAS lancer contre la prod publique sans fenêtre dédiée.
//
// Coût LLM : les requêtes ci-dessous empruntent le chemin CATALOGUE DÉTERMINISTE
// (recherche d'offre, RDV, recadrage) → AUCUN appel LLM, donc 0 € de facture LLM
// pendant le test. Pour stresser aussi le chemin RAG/LLM, ajouter des questions
// d'explication dans QUERIES (mais cela génère du coût Anthropic réel).
//
// Usage :
//   CHATBOT_BASE_URL=https://staging.axion-ia.com k6 run scripts/load-test-chatbot.k6.js
//   (override de la cible et de la charge via variables d'env -e VUS, -e DURATION)

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";

const BASE = __ENV.CHATBOT_BASE_URL || "http://localhost:3000";
const PEAK_VUS = Number(__ENV.PEAK_VUS || 200);

// Proxy du « 1er token » = temps d'attente serveur (TTFB) ; k6 http bufferise le
// SSE, donc on ne mesure pas le streaming token-par-token mais le délai avant la
// 1re donnée, qui est une borne supérieure acceptable.
const firstToken = new Trend("first_token_ms", true);
const rate429 = new Rate("rate_429");

export const options = {
  scenarios: {
    ramp_to_peak: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: Math.round(PEAK_VUS / 4) },
        { duration: "2m", target: PEAK_VUS },
        { duration: "3m", target: PEAK_VUS },
        { duration: "1m", target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.02"], // < 2 % d'erreurs HTTP
    http_req_duration: ["p(95)<6000"], // réponse totale < 6 s (cahier A1)
    first_token_ms: ["p(95)<1500"], // 1er token < 1,5 s (cahier A1)
    rate_429: ["rate<0.05"], // backpressure rare ; jamais de 429 « brut » massif
  },
};

// Chemins DÉTERMINISTES (catalogue) → pas d'appel LLM.
const QUERIES = [
  "Quelles formations entre 2000 et 3000 € ?",
  "Quelle est votre offre la moins chère ?",
  "Une formation de 2 jours pour 8 personnes",
  "Je voudrais prendre rendez-vous",
  "Quelle différence entre l'audit et l'implémentation ?",
  "Vous faites de l'audit IA ?",
];

export default function () {
  const message = QUERIES[Math.floor(Math.random() * QUERIES.length)];
  const res = http.post(`${BASE}/api/chatbot/message`, JSON.stringify({ message }), {
    headers: { "Content-Type": "application/json" },
    timeout: "30s",
  });

  firstToken.add(res.timings.waiting);
  rate429.add(res.status === 429);

  check(res, {
    "statut 200 ou 429 propre": (r) => r.status === 200 || r.status === 429,
    "pas d'erreur 5xx": (r) => r.status < 500,
    "flux SSE": (r) =>
      r.status !== 200 || String(r.headers["Content-Type"]).includes("text/event-stream"),
  });

  sleep(Math.random() * 2 + 1); // 1–3 s entre deux tours (cadence humaine)
}
