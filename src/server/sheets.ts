import "server-only";
import { defaultCategories, defaultSettings } from "@/lib/defaults";
import {
  categoriesToRows,
  colLetter,
  dataRange,
  datasetFromRanges,
  datasetToRanges,
  accountToRow,
  balanceToRow,
  goalToRow,
  rowToBalance,
  rowToGoal,
  rowToTransaction,
  settingsToRows,
  subscriptionToRow,
  TAB_KEYS,
  TABS,
  transactionToRow,
  budgetToRow,
  incomeToRow,
  type Row,
  type TabKey,
} from "@/lib/sheet-schema";
import type { Dataset, Locale, Mutation, Transaction } from "@/lib/types";
import { gfetch, GoogleApiError, googleErrorCode, type GoogleErrorCode } from "./google";

const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";
const DRIVE = "https://www.googleapis.com/drive/v3/files";
const DRIVE_ABOUT = "https://www.googleapis.com/drive/v3/about";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const APP_KEY = "gelbien";
const DATA_MARK = "data-v1";
const RECEIPTS_MARK = "receipts";

export const sheetUrl = (id: string) => `https://docs.google.com/spreadsheets/d/${id}/edit`;

/**
 * Google Sheets answers a bare 403 "The caller does not have permission" for different causes.
 * Find the likely one so the user can be told what to do: a full Drive (Google then refuses
 * edits to the owner's files), or a spreadsheet out of the app's reach (deleted for good, or
 * the app's access removed in the Google account). Otherwise the error is returned unchanged.
 */
export async function explainRefusal(at: string, id: string, err: GoogleApiError): Promise<GoogleApiError> {
  if (err.status !== 403 || googleErrorCode(err) !== "access") return err;
  const as = (reason: string) => new GoogleApiError(err.status, err.message, reason);
  try {
    const { storageQuota: q } = await gfetch<{ storageQuota?: { limit?: string; usage?: string } }>(at, `${DRIVE_ABOUT}?fields=storageQuota`);
    // no limit: unlimited storage
    if (q?.limit && Number(q.usage) >= Number(q.limit)) return as("storageQuotaExceeded");
  } catch {
    /* can't tell from here — check the file itself */
  }
  try {
    await gfetch(at, `${DRIVE}/${id}?fields=id`);
  } catch (e) {
    if (e instanceof GoogleApiError && (e.status === 403 || e.status === 404)) return as("fileNotAccessible");
  }
  return err;
}

// ---------------------------------------------------------------------------
// Locating / creating the spreadsheet
// ---------------------------------------------------------------------------

export async function findSpreadsheet(at: string): Promise<string | null> {
  const q = `appProperties has { key='${APP_KEY}' and value='${DATA_MARK}' } and trashed = false`;
  const res = await gfetch<{ files: { id: string }[] }>(
    at,
    `${DRIVE}?q=${encodeURIComponent(q)}&fields=files(id)&orderBy=modifiedTime%20desc&pageSize=1&spaces=drive`,
  );
  return res.files?.[0]?.id ?? null;
}

export async function createSpreadsheet(at: string, locale: Locale, ownerName: string): Promise<string> {
  const title = ownerName ? `Gelbien — ${ownerName}` : "Gelbien — Finance";
  const file = await gfetch<{ id: string }>(at, `${DRIVE}?fields=id`, {
    method: "POST",
    body: JSON.stringify({
      name: title,
      mimeType: "application/vnd.google-apps.spreadsheet",
      appProperties: { [APP_KEY]: DATA_MARK },
      description: "Managed by Gelbien. Edit carefully: keep the header row and the id column intact.",
    }),
  });
  const id = file.id;

  const meta = await gfetch<{ sheets: { properties: { sheetId: number } }[] }>(at, `${SHEETS}/${id}?fields=sheets.properties.sheetId`);
  const firstId = meta.sheets[0].properties.sheetId;

  const others = TAB_KEYS.filter((k) => k !== "transactions");
  const created = await gfetch<{ replies: { addSheet?: { properties: { sheetId: number } } }[] }>(at, `${SHEETS}/${id}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: [
        {
          updateSheetProperties: {
            properties: { sheetId: firstId, title: TABS.transactions.title, gridProperties: { frozenRowCount: 1 } },
            fields: "title,gridProperties.frozenRowCount",
          },
        },
        ...others.map((k) => ({ addSheet: { properties: { title: TABS[k].title, gridProperties: { frozenRowCount: 1 } } } })),
      ],
    }),
  });
  const sheetIds = [firstId, ...created.replies.slice(1).map((r) => r.addSheet!.properties.sheetId)];

  // Header styling: bold ivory on near-black, like the app
  await gfetch(at, `${SHEETS}/${id}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: sheetIds.map((sheetId) => ({
        repeatCell: {
          range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.08, green: 0.08, blue: 0.09 },
              textFormat: { bold: true, foregroundColor: { red: 0.85, green: 0.71, blue: 0.37 } },
            },
          },
          fields: "userEnteredFormat(backgroundColor,textFormat)",
        },
      })),
    }),
  });

  const { cats, subs } = categoriesToRows(defaultCategories(locale));
  const seed: Record<TabKey, Row[]> = {
    transactions: [],
    categories: cats,
    subcategories: subs,
    budgets: [],
    income: [],
    subscriptions: [],
    settings: settingsToRows(defaultSettings(locale)),
    accounts: [],
    balances: [],
    goals: [],
  };
  await writeValues(at, id, [
    ...TAB_KEYS.map((k) => ({ range: `${TABS[k].title}!A1`, values: [[...TABS[k].headers] as Row, ...seed[k]] })),
  ]);
  return id;
}

export async function ensureSpreadsheet(at: string, locale: Locale, ownerName: string): Promise<string> {
  return (await findSpreadsheet(at)) ?? (await createSpreadsheet(at, locale, ownerName));
}

// ---------------------------------------------------------------------------
// Low-level value helpers
// ---------------------------------------------------------------------------

async function writeValues(at: string, id: string, data: { range: string; values: Row[] }[]) {
  const nonEmpty = data.filter((d) => d.values.length);
  if (!nonEmpty.length) return;
  await gfetch(at, `${SHEETS}/${id}/values:batchUpdate`, {
    method: "POST",
    // RAW keeps "=..." descriptions as text (no formula injection) and ISO dates as text.
    body: JSON.stringify({ valueInputOption: "RAW", data: nonEmpty }),
  });
}

async function clearRanges(at: string, id: string, ranges: string[]) {
  await gfetch(at, `${SHEETS}/${id}/values:batchClear`, { method: "POST", body: JSON.stringify({ ranges }) });
}

async function readRanges(at: string, id: string, tabs: TabKey[]): Promise<Record<TabKey, Row[]>> {
  const params = tabs.map((t) => `ranges=${encodeURIComponent(dataRange(t))}`).join("&");
  const res = await gfetch<{ valueRanges: { values?: Row[] }[] }>(
    at,
    `${SHEETS}/${id}/values:batchGet?${params}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`,
  );
  const out = {} as Record<TabKey, Row[]>;
  tabs.forEach((t, i) => (out[t] = res.valueRanges[i]?.values ?? []));
  return out;
}

async function replaceTabs(at: string, id: string, data: Partial<Record<TabKey, Row[]>>) {
  const keys = Object.keys(data) as TabKey[];
  await clearRanges(at, id, keys.map((k) => dataRange(k)));
  await writeValues(at, id, keys.map((k) => ({ range: `${TABS[k].title}!A2`, values: data[k]! })));
}

async function sheetIdOf(at: string, id: string, tab: TabKey): Promise<number> {
  const meta = await gfetch<{ sheets: { properties: { sheetId: number; title: string } }[] }>(at, `${SHEETS}/${id}?fields=sheets.properties`);
  const found = meta.sheets.find((s) => s.properties.title === TABS[tab].title);
  if (!found) throw new GoogleApiError(404, `Tab ${TABS[tab].title} is missing from the spreadsheet`);
  return found.properties.sheetId;
}

/** 1-based sheet row number of the record with this id, or null. */
async function findRow(at: string, id: string, tab: TabKey, recordId: string): Promise<number | null> {
  const res = await gfetch<{ values?: Row[] }>(at, `${SHEETS}/${id}/values/${encodeURIComponent(`${TABS[tab].title}!A2:A`)}`);
  const idx = (res.values ?? []).findIndex((r) => String(r[0] ?? "") === recordId);
  return idx === -1 ? null : idx + 2;
}

async function upsertRow(at: string, id: string, tab: TabKey, recordId: string, row: Row) {
  const n = await findRow(at, id, tab, recordId);
  const lastCol = colLetter(TABS[tab].headers.length);
  if (n === null) {
    await gfetch(at, `${SHEETS}/${id}/values/${encodeURIComponent(`${TABS[tab].title}!A1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
      method: "POST",
      body: JSON.stringify({ values: [row] }),
    });
  } else {
    await gfetch(at, `${SHEETS}/${id}/values/${encodeURIComponent(`${TABS[tab].title}!A${n}:${lastCol}${n}`)}?valueInputOption=RAW`, {
      method: "PUT",
      body: JSON.stringify({ values: [row] }),
    });
  }
}

async function deleteRow(at: string, id: string, tab: TabKey, recordId: string) {
  const n = await findRow(at, id, tab, recordId);
  if (n === null) return;
  const sheetId = await sheetIdOf(at, id, tab);
  await gfetch(at, `${SHEETS}/${id}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: [{ deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: n - 1, endIndex: n } } }],
    }),
  });
}

/** Deletes the transaction rows with these ids in one request (bottom-up, so row numbers stay valid). */
async function deleteTransactionRows(at: string, id: string, ids: string[]) {
  const res = await gfetch<{ values?: Row[] }>(at, `${SHEETS}/${id}/values/${encodeURIComponent(`${TABS.transactions.title}!A2:A`)}`);
  const wanted = new Set(ids);
  const rows = (res.values ?? []).flatMap((r, i) => (wanted.has(String(r[0] ?? "")) ? [i + 2] : [])).sort((a, b) => b - a);
  if (!rows.length) return;
  const sheetId = await sheetIdOf(at, id, "transactions");
  await gfetch(at, `${SHEETS}/${id}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({ requests: rows.map((n) => ({ deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: n - 1, endIndex: n } } })) }),
  });
}

/**
 * Rewrites the parts of split purchase `group`: updates parts that already have a row, deletes
 * the ones left out, appends the new ones. One read, then at most three writes.
 */
async function replaceGroup(at: string, id: string, group: string, txs: Transaction[]) {
  const tab = TABS.transactions;
  const groupCol = colLetter(tab.headers.indexOf("group") + 1);
  const lastCol = colLetter(tab.headers.length);
  const ranges = [`${tab.title}!A2:A`, `${tab.title}!${groupCol}2:${groupCol}`].map((r) => `ranges=${encodeURIComponent(r)}`).join("&");
  const res = await gfetch<{ valueRanges: { values?: Row[] }[] }>(at, `${SHEETS}/${id}/values:batchGet?${ranges}`);
  const rows = (res.valueRanges[0]?.values ?? []).map((r, i) => ({
    id: String(r[0] ?? ""),
    n: i + 2,
    group: String(res.valueRanges[1]?.values?.[i]?.[0] ?? ""),
  }));
  const rowOf = new Map(rows.map((r) => [r.id, r.n]));
  const keep = new Set(txs.map((t) => t.id));

  const existing = txs.filter((t) => rowOf.has(t.id));
  if (existing.length) {
    await writeValues(at, id, existing.map((t) => ({ range: `${tab.title}!A${rowOf.get(t.id)}:${lastCol}${rowOf.get(t.id)}`, values: [transactionToRow(t)] })));
  }
  // bottom-up, so deleting one row doesn't shift the ones still to delete
  const stale = rows.filter((r) => r.group === group && !keep.has(r.id)).map((r) => r.n).sort((a, b) => b - a);
  if (stale.length) {
    const sheetId = await sheetIdOf(at, id, "transactions");
    await gfetch(at, `${SHEETS}/${id}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({ requests: stale.map((n) => ({ deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: n - 1, endIndex: n } } })) }),
    });
  }
  const added = txs.filter((t) => !rowOf.has(t.id));
  if (added.length) {
    await gfetch(at, `${SHEETS}/${id}/values/${encodeURIComponent(`${tab.title}!A1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
      method: "POST",
      body: JSON.stringify({ values: added.map(transactionToRow) }),
    });
  }
}

/**
 * Sheets created by an older version of Gelbien lack tabs and columns added later (e.g. Goals,
 * split expenses). Add any missing tab with its header row, and any missing header cells at the
 * end of an existing tab. Memoized per server instance.
 */
const ensured = new Set<string>();
export async function ensureTabs(at: string, id: string): Promise<void> {
  if (ensured.has(id)) return;
  const meta = await gfetch<{ sheets: { properties: { title: string } }[] }>(at, `${SHEETS}/${id}?fields=sheets.properties.title`);
  const have = new Set(meta.sheets.map((s) => s.properties.title));
  const missing = TAB_KEYS.filter((k) => !have.has(TABS[k].title));
  if (missing.length) {
    await gfetch(at, `${SHEETS}/${id}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({
        requests: missing.map((k) => ({ addSheet: { properties: { title: TABS[k].title, gridProperties: { frozenRowCount: 1 } } } })),
      }),
    });
    await writeValues(at, id, missing.map((k) => ({ range: `${TABS[k].title}!A1`, values: [[...TABS[k].headers] as Row] })));
  }
  const present = TAB_KEYS.filter((k) => have.has(TABS[k].title));
  if (present.length) {
    const ranges = present.map((k) => `ranges=${encodeURIComponent(`${TABS[k].title}!A1:${colLetter(TABS[k].headers.length)}1`)}`).join("&");
    const heads = await gfetch<{ valueRanges: { values?: Row[] }[] }>(at, `${SHEETS}/${id}/values:batchGet?${ranges}`);
    // A pre-release build had a "tags" column at P of Transactions, dropped again before release:
    // remove it so group / bill line up with the columns above. (Only ever on the developer's sheet.)
    const txHead = heads.valueRanges[present.indexOf("transactions")]?.values?.[0];
    if (present.includes("transactions") && txHead?.[15] === "tags") {
      const sheetId = await sheetIdOf(at, id, "transactions");
      await gfetch(at, `${SHEETS}/${id}:batchUpdate`, {
        method: "POST",
        body: JSON.stringify({ requests: [{ deleteDimension: { range: { sheetId, dimension: "COLUMNS", startIndex: 15, endIndex: 16 } } }] }),
      });
      txHead.splice(15, 1);
    }
    // only past the cells already there, so nothing typed into the sheet is overwritten
    const fixes = present.flatMap((k, i) => {
      const current = heads.valueRanges[i]?.values?.[0] ?? [];
      const wanted = TABS[k].headers;
      return current.length < wanted.length ? [{ range: `${TABS[k].title}!${colLetter(current.length + 1)}1`, values: [wanted.slice(current.length) as Row] }] : [];
    });
    await writeValues(at, id, fixes);
  }
  ensured.add(id);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** The whole dataset, plus `warning` when the sheet can be read but not written (why changes won't save). */
export async function readDataset(at: string, id: string, locale: Locale): Promise<{ data: Omit<Dataset, "meta">; warning?: GoogleErrorCode }> {
  let warning: GoogleErrorCode | undefined;
  try {
    await ensureTabs(at, id);
  } catch (err) {
    // Adding the columns of a newer version is a write. When Google refuses writes (a full Drive,
    // say) the data can still be read: show it, and say why changes can't be saved.
    // 401 and 404 go up — withGoogle refreshes the token or finds the spreadsheet again.
    if (!(err instanceof GoogleApiError) || err.status === 401 || err.status === 404) throw err;
    warning = googleErrorCode(await explainRefusal(at, id, err));
  }
  return { data: datasetFromRanges(await readRanges(at, id, TAB_KEYS), locale), warning };
}

export async function applyMutation(at: string, id: string, m: Mutation): Promise<void> {
  await ensureTabs(at, id);
  switch (m.op) {
    case "addTransaction":
    case "updateTransaction":
      return upsertRow(at, id, "transactions", m.tx.id, transactionToRow(m.tx));
    case "deleteTransaction":
      return deleteRow(at, id, "transactions", m.id);
    case "addTransactions":
      await gfetch(at, `${SHEETS}/${id}/values/${encodeURIComponent(`${TABS.transactions.title}!A1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
        method: "POST",
        body: JSON.stringify({ values: m.txs.map(transactionToRow) }),
      });
      return;
    case "deleteTransactions":
      return deleteTransactionRows(at, id, m.ids);
    case "saveTransactionGroup":
      return replaceGroup(at, id, m.group, m.txs);
    case "deleteTransactionGroup":
      return replaceGroup(at, id, m.group, []);
    case "upsertSubscription":
      return upsertRow(at, id, "subscriptions", m.sub.id, subscriptionToRow(m.sub));
    case "deleteSubscription":
      return deleteRow(at, id, "subscriptions", m.id);
    case "saveSettings": {
      await replaceTabs(at, id, { settings: settingsToRows(m.settings) });
      if (!m.paymentRenames?.length) return;
      // Rewrite only the payment column (G) of expenses and recurring payments, where a name changed.
      const renames = new Map(m.paymentRenames.map((r) => [r.from, r.to]));
      const current = await readRanges(at, id, ["transactions", "subscriptions"]);
      const columns = (["transactions", "subscriptions"] as const)
        .filter((k) => current[k].some((r) => renames.has(String(r[6] ?? ""))))
        .map((k) => ({ range: `${TABS[k].title}!G2`, values: current[k].map((r) => [renames.get(String(r[6] ?? "")) ?? String(r[6] ?? "")]) }));
      return writeValues(at, id, columns);
    }
    case "saveCategories": {
      const { cats, subs } = categoriesToRows(m.categories);
      const updates: Partial<Record<TabKey, Row[]>> = { categories: cats, subcategories: subs };
      if (m.renames.length || m.subRenames?.length) {
        const current = await readRanges(at, id, ["transactions", "budgets", "subscriptions"]);
        const rename = (name: unknown) => {
          const hit = m.renames.find((r) => r.from === String(name ?? ""));
          return hit ? hit.to : name;
        };
        // keyed by the category name before this save
        const renameSub = (category: string, sub: string) => m.subRenames?.find((r) => r.category === category && r.from === sub)?.to ?? sub;
        updates.transactions = current.transactions
          .map(rowToTransaction)
          .filter((t) => t !== null)
          .map((t) => transactionToRow({ ...t, category: String(rename(t.category)), subcategory: renameSub(t.category, t.subcategory) }));
        updates.budgets = current.budgets.map((r) => [r[0], rename(r[1]) as string, r[2]]);
        // category (C) and subcategory (N), the latter keyed by the category's old name
        updates.subscriptions = current.subscriptions.map((r) =>
          r.map((c, i) => (i === 2 ? (rename(c) as string) : i === 13 ? renameSub(String(r[2] ?? ""), String(c ?? "")) : c)),
        );
      }
      return replaceTabs(at, id, updates);
    }
    case "saveBudget": {
      const current = await readRanges(at, id, ["budgets", "income"]);
      const budgets = [
        ...current.budgets.filter((r) => String(r[0] ?? "") !== m.month),
        ...m.lines.filter((l) => l.amount > 0).map(budgetToRow),
      ];
      const updates: Partial<Record<TabKey, Row[]>> = { budgets };
      if (m.income || m.clearIncome) {
        let income = m.clearIncome ? current.income.filter((r) => String(r[0] ?? "") !== m.month) : current.income;
        if (m.income) {
          const inc = m.income;
          income = [...income.filter((r) => String(r[0] ?? "") !== inc.month), incomeToRow(inc)];
        }
        updates.income = income;
      }
      return replaceTabs(at, id, updates);
    }
    case "upsertAccount":
      return upsertRow(at, id, "accounts", m.account.id, accountToRow(m.account));
    case "deleteAccount": {
      // Drop the account, its balance history, and any goal links to it.
      const current = await readRanges(at, id, ["balances", "goals"]);
      await replaceTabs(at, id, {
        balances: current.balances.filter((r) => String(r[0] ?? "") !== m.id),
        goals: current.goals
          .map((r, i) => rowToGoal(r, i))
          .filter((g) => g !== null)
          .map((g) => goalToRow({ ...g, accountIds: g.accountIds.filter((a) => a !== m.id) })),
      });
      return deleteRow(at, id, "accounts", m.id);
    }
    case "saveBalances": {
      const key = (b: { accountId: string; date: string }) => `${b.accountId}|${b.date}`;
      const incoming = new Set(m.balances.map(key));
      const current = await readRanges(at, id, ["balances"]);
      const kept = current.balances.map(rowToBalance).filter((b) => b !== null && !incoming.has(key(b)));
      const all = [...kept, ...m.balances].filter((b) => b !== null).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      return replaceTabs(at, id, { balances: all.map(balanceToRow) });
    }
    case "upsertGoal":
      return upsertRow(at, id, "goals", m.goal.id, goalToRow(m.goal));
    case "deleteGoal":
      return deleteRow(at, id, "goals", m.id);
    case "replaceAll":
      return replaceTabs(at, id, datasetToRanges(m.data));
    default: {
      const never: never = m;
      throw new Error(`Unknown mutation ${(never as { op: string }).op}`);
    }
  }
}

async function receiptsFolder(at: string): Promise<string> {
  const q = `appProperties has { key='${APP_KEY}' and value='${RECEIPTS_MARK}' } and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const found = await gfetch<{ files: { id: string }[] }>(at, `${DRIVE}?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1&spaces=drive`);
  if (found.files?.[0]) return found.files[0].id;
  const folder = await gfetch<{ id: string }>(at, `${DRIVE}?fields=id`, {
    method: "POST",
    body: JSON.stringify({ name: "Gelbien Receipts", mimeType: "application/vnd.google-apps.folder", appProperties: { [APP_KEY]: RECEIPTS_MARK } }),
  });
  return folder.id;
}

/** Store a receipt in the user's Drive ("Gelbien Receipts" folder) and return a view link. */
export async function uploadReceipt(at: string, file: { name: string; type: string; bytes: Uint8Array }): Promise<{ id: string; url: string }> {
  const parent = await receiptsFolder(at);
  const boundary = `gelbien_${crypto.randomUUID()}`;
  const meta = JSON.stringify({ name: file.name, parents: [parent] });
  const enc = new TextEncoder();
  const head = enc.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${file.type}\r\n\r\n`);
  const tail = enc.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(head.length + file.bytes.length + tail.length);
  body.set(head, 0);
  body.set(file.bytes, head.length);
  body.set(tail, head.length + file.bytes.length);
  const res = await gfetch<{ id: string; webViewLink: string }>(at, `${UPLOAD}?uploadType=multipart&fields=id,webViewLink`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  return { id: res.id, url: res.webViewLink };
}
