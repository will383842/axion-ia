/**
 * k6 Load Test — Sprint A ville pages
 *
 * Run: k6 run scripts/load-test-sprint-a.js
 * Requires: k6 installed (https://k6.io/docs/getting-started/installation/)
 *
 * Targets:
 *   - p95 latency < 800ms
 *   - error rate < 1%
 *   - 50 VU sustained 3 minutes
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const errorRate = new Rate("errors");
const pageLoad = new Trend("page_load", true);

export const options = {
  stages: [
    { duration: "1m", target: 10 }, // ramp-up to 10 VU
    { duration: "3m", target: 50 }, // sustained 50 VU
    { duration: "1m", target: 0 }, // ramp-down
  ],
  thresholds: {
    http_req_duration: ["p(95)<800"],
    http_req_failed: ["rate<0.01"],
    errors: ["rate<0.01"],
  },
};

const BASE = __ENV.BASE_URL || "http://localhost:3000";

const URLS = [
  // Services principals
  `${BASE}/fr/audit`,
  `${BASE}/fr/interventions`,
  `${BASE}/fr/implementation`,
  `${BASE}/fr/un-a-un`,
  `${BASE}/fr/sites-web-augmentes`,
  // Tier 1 — Paris verticales
  `${BASE}/fr/implantations/ile-de-france/paris/audits`,
  `${BASE}/fr/implantations/ile-de-france/paris/interventions`,
  `${BASE}/fr/implantations/ile-de-france/paris/implementations`,
  `${BASE}/fr/implantations/ile-de-france/paris/un-a-un`,
  `${BASE}/fr/implantations/ile-de-france/paris/sites-web-ia`,
  // Hub Paris
  `${BASE}/fr/implantations/ile-de-france/paris`,
  // Tier 1 — Lyon
  `${BASE}/fr/implantations/auvergne-rhone-alpes/lyon/audits`,
  `${BASE}/fr/implantations/auvergne-rhone-alpes/lyon/interventions`,
  // Tier 2 — Annecy
  `${BASE}/fr/implantations/auvergne-rhone-alpes/annecy/audits`,
];

export default function () {
  const url = URLS[Math.floor(Math.random() * URLS.length)];
  const start = Date.now();

  const res = http.get(url, {
    headers: { Accept: "text/html", "Accept-Encoding": "gzip, br" },
    timeout: "10s",
  });

  const duration = Date.now() - start;
  pageLoad.add(duration);

  const success = check(res, {
    "status 200": (r) => r.status === 200,
    "has h1": (r) => r.body.includes("<h1") || r.body.includes("<H1"),
    "no server error": (r) => !r.body.includes("Internal Server Error"),
    "response time < 2s": (r) => r.timings.duration < 2000,
  });

  errorRate.add(!success);

  sleep(Math.random() * 2 + 0.5); // 0.5-2.5s think time
}

export function handleSummary(data) {
  return {
    "scripts/load-test-sprint-a-results.json": JSON.stringify(data, null, 2),
  };
}
