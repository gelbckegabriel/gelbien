import { afterEach, describe, expect, it, vi } from "vitest";
import { TAB_KEYS, TABS } from "@/lib/sheet-schema";
import { GoogleApiError, googleErrorCode } from "./google";
import { explainRefusal, readDataset } from "./sheets";

vi.mock("server-only", () => ({}));

const refused = () => new GoogleApiError(403, "The caller does not have permission");
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** Fake Google: `routes` maps a URL fragment to its response; first match wins. */
function google(routes: [string, () => Response][]) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      calls.push(url);
      const hit = routes.find(([part]) => decodeURIComponent(url).includes(part));
      if (!hit) throw new Error(`unexpected request ${url}`);
      return hit[1]();
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("explainRefusal", () => {
  it("blames a full Drive", async () => {
    google([["/drive/v3/about", () => json({ storageQuota: { limit: "100", usage: "101" } })]]);
    expect(googleErrorCode(await explainRefusal("at", "sheet", refused()))).toBe("storage");
  });

  it("blames a spreadsheet the app can't reach anymore", async () => {
    google([
      ["/drive/v3/about", () => json({ storageQuota: { limit: "100", usage: "10" } })],
      ["/drive/v3/files/sheet", () => json({ error: { code: 404, message: "File not found" } }, 404)],
    ]);
    expect(googleErrorCode(await explainRefusal("at", "sheet", refused()))).toBe("lost");
  });

  it("leaves a refusal it can't explain, and other errors, as they are", async () => {
    google([
      ["/drive/v3/about", () => json({ storageQuota: { usage: "10" } })],
      ["/drive/v3/files/sheet", () => json({ id: "sheet" })],
    ]);
    expect(googleErrorCode(await explainRefusal("at", "sheet", refused()))).toBe("access");
    const busy = new GoogleApiError(429, "Quota exceeded");
    expect(await explainRefusal("at", "sheet", busy)).toBe(busy);
  });
});

describe("readDataset", () => {
  it("still reads the sheet when adding new columns is refused, and says why", async () => {
    const calls = google([
      ["?fields=sheets.properties.title", () => json({ sheets: TAB_KEYS.map((k) => ({ properties: { title: TABS[k].title } })) })],
      // header rows from an older version: one column short everywhere
      ["!A1:", () => json({ valueRanges: TAB_KEYS.map((k) => ({ values: [TABS[k].headers.slice(0, -1)] })) })],
      ["values:batchUpdate", () => json({ error: { code: 403, message: "The caller does not have permission", status: "PERMISSION_DENIED" } }, 403)],
      ["/drive/v3/about", () => json({ storageQuota: { limit: "100", usage: "100" } })],
      ["!A2:", () => json({ valueRanges: TAB_KEYS.map(() => ({ values: [] })) })],
    ]);
    const { data, warning } = await readDataset("at", "old-sheet", "en");
    expect(warning).toBe("storage");
    expect(data.transactions).toEqual([]);
    expect(calls.some((u) => decodeURIComponent(u).includes("!A2:"))).toBe(true);
  });
});
