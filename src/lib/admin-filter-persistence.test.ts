import { describe, it, expect, beforeEach } from "vitest";
import { loadAdminFilters, saveAdminFilters, clearAdminFilters } from "./admin-filter-persistence";

describe("admin-filter-persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns defaults when nothing stored", () => {
    const result = loadAdminFilters("blog", { status: "all", search: "" });
    expect(result).toEqual({ status: "all", search: "" });
  });

  it("merges stored state over defaults", () => {
    saveAdminFilters("blog", { status: "published", search: "hello" });
    const result = loadAdminFilters("blog", { status: "all", search: "", page: 1 });
    expect(result).toEqual({ status: "published", search: "hello", page: 1 });
  });

  it("falls back to defaults on corrupted JSON", () => {
    window.localStorage.setItem("axion-admin-filters:blog", "{not valid");
    const result = loadAdminFilters("blog", { status: "all" });
    expect(result).toEqual({ status: "all" });
  });

  it("clears stored filters", () => {
    saveAdminFilters("blog", { status: "published" });
    clearAdminFilters("blog");
    const result = loadAdminFilters("blog", { status: "all" });
    expect(result).toEqual({ status: "all" });
  });

  it("namespaces keys by page", () => {
    saveAdminFilters("blog", { status: "published" });
    saveAdminFilters("faq", { status: "draft" });
    const blogState = loadAdminFilters("blog", { status: "all" });
    const faqState = loadAdminFilters("faq", { status: "all" });
    expect(blogState.status).toBe("published");
    expect(faqState.status).toBe("draft");
  });
});
