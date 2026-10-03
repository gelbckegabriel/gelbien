"use client";

import { QueryClient } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { MotionConfig } from "motion/react";
import { useState } from "react";
import { Toaster } from "sonner";

const WEEK = 1000 * 60 * 60 * 24 * 7;
export const CACHE_KEY = "gelbien.cache";

const noopStorage = { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { gcTime: WEEK, retry: 1, refetchOnReconnect: true },
        },
      }),
  );
  const [persister] = useState(() =>
    createSyncStoragePersister({
      storage: typeof window === "undefined" ? noopStorage : window.localStorage,
      key: CACHE_KEY,
      throttleTime: 1000,
    }),
  );

  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister,
        maxAge: WEEK,
        // bumped when the dataset shape changes (v4: splits, bills; v5: merchant on recurring expenses)
        buster: "v5",
        dehydrateOptions: {
          // Cache the Google-backed data (for instant start-up); demo data already lives in localStorage.
          // A cached "signed out" answer must never be trusted after an OAuth round-trip, so only
          // a signed-in session is persisted.
          // Don't cache queued writes: a restored one has no mutationFn in the new session (they're
          // defined by the components that call useMutate), so it could only fail — and while it
          // sits first in the "sheet-writes" queue, later saves wait behind it.
          shouldDehydrateMutation: () => false,
          shouldDehydrateQuery: (q) =>
            q.state.status === "success" &&
            ((q.queryKey[0] === "session" && !!(q.state.data as { user?: unknown } | undefined)?.user) ||
              (q.queryKey[0] === "dataset" && q.queryKey[1] === "google")),
        },
      }}
    >
      <MotionConfig reducedMotion="user" transition={{ type: "spring", stiffness: 380, damping: 32 }}>
        {children}
      </MotionConfig>
      <Toaster
        theme="dark"
        position="top-center"
        // Below the iPhone status bar / Dynamic Island: the app draws under it (viewport-fit=cover)
        offset={{ top: "calc(env(safe-area-inset-top) + 16px)" }}
        mobileOffset={{ top: "calc(env(safe-area-inset-top) + 12px)" }}
        toastOptions={{
          style: { background: "#1a1a1f", border: "1px solid #ffffff1f", color: "#f4f1ea", borderRadius: "14px" },
        }}
      />
    </PersistQueryClientProvider>
  );
}
