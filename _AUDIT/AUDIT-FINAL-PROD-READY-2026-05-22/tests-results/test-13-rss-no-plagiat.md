# Test 13 — RSS sans plagiat (exigence Will : NE PAS citer la source)

## Date : 2026-05-22

## blog-from-rss.ts

-rw-r--r-- 1 willi 197609 20028 May 22 17:32 src/server/content-gen/generators/blog-from-rss.ts

## Grep 'Source' / 'source:' dans generator

13: \* - Anti-plagiat RSS source : `checkRssSimilarity(body, rssItemSummary, 0.10)`
434: sourceUrl: input.rssSourceUrl,

## SimHash + cosine similarity dedup

**tests**
embedding-similarity.ts
openai-embedder.ts
outline-simhash.ts
persist-article-embedding.ts
topic-fingerprint.ts

src/server/content-gen/dedup/embedding-similarity.ts:22:export { cosineSimilarity } from "@/lib/knowledge/embeddings";
src/server/content-gen/dedup/outline-simhash.ts:133:function simhash64(tokens: ReadonlyArray<string>): bigint {
src/server/content-gen/dedup/outline-simhash.ts:174: return bigintToHex16(simhash64(tokens));
src/server/content-gen/dedup/**tests**/embedding-similarity.spec.ts:4: cosineSimilarity,
src/server/content-gen/dedup/**tests**/embedding-similarity.spec.ts:8:describe("cosineSimilarity", () => {
src/server/content-gen/dedup/**tests**/embedding-similarity.spec.ts:10: expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 6);
src/server/content-gen/dedup/**tests**/embedding-similarity.spec.ts:14: expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0, 6);
src/server/content-gen/dedup/**tests**/embedding-similarity.spec.ts:18: expect(cosineSimilarity([1, 1], [-1, -1])).toBeCloseTo(-1, 6);
src/server/content-gen/dedup/**tests**/embedding-similarity.spec.ts:24: expect(cosineSimilarity(a, b)).toBeCloseTo(0.96, 4);
src/server/content-gen/dedup/**tests**/embedding-similarity.spec.ts:28: expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
src/server/content-gen/dedup/**tests**/embedding-similarity.spec.ts:32: expect(cosineSimilarity([], [])).toBe(0);
src/server/content-gen/dedup/**tests**/embedding-similarity.spec.ts:36: expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow(/dimension mismatch/);
src/server/content-gen/dedup/**tests**/embedding-similarity.spec.ts:40: expect(cosineSimilarity([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 6);
src/server/content-gen/dedup/**tests**/outline-simhash.spec.ts:2: \* B.7 P0-6 — Tests outline-simhash.ts
src/server/content-gen/dedup/**tests**/outline-simhash.spec.ts:23:} from "../outline-simhash";
