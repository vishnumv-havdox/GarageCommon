import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SyncEntity = "inventory" | "work_orders" | "part_requests" | "inventory_returns" | "services" | "all";

/**
 * Broadcasts a local and cross-tab data update notification
 * to immediately trigger synchronization across all active pages.
 */
export function broadcastDataUpdate(entity: SyncEntity | string = "all", payload?: any) {
  const timestamp = Date.now();
  // 1. Dispatch custom event for current window
  try {
    window.dispatchEvent(
      new CustomEvent("driveflow:sync", {
        detail: { entity, payload, timestamp },
      })
    );
  } catch (err) {
    console.warn("Failed to dispatch local sync event", err);
  }

  // 2. Broadcast across tabs/windows
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const bc = new BroadcastChannel("driveflow_sync");
      bc.postMessage({ entity, payload, timestamp });
      setTimeout(() => bc.close(), 100);
    }
  } catch (err) {
    console.warn("BroadcastChannel not supported or error", err);
  }
}

/**
 * Subscribes to broadcast and window data update events.
 * Returns an unsubscribe callback.
 */
export function subscribeToDataUpdates(callback: (entity: string, payload?: any) => void): () => void {
  const handleLocal = (e: Event) => {
    const customEvent = e as CustomEvent<{ entity: string; payload?: any }>;
    callback(customEvent.detail?.entity || "all", customEvent.detail?.payload);
  };
  window.addEventListener("driveflow:sync", handleLocal);

  let bc: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== "undefined") {
      bc = new BroadcastChannel("driveflow_sync");
      bc.onmessage = (event) => {
        callback(event.data?.entity || "all", event.data?.payload);
      };
    }
  } catch (e) {
    console.warn("BroadcastChannel init error", e);
  }

  return () => {
    window.removeEventListener("driveflow:sync", handleLocal);
    if (bc) bc.close();
  };
}

/**
 * React hook to listen to both Supabase Realtime table changes and
 * cross-component / cross-tab broadcast events.
 * 
 * @param tables Array of table names to listen for (e.g. ['work_orders', 'part_requests'])
 * @param onSync Callback function to trigger when data changes
 * @param debounceMs Milliseconds to debounce multiple rapid changes
 */
export function useRealtimeSync(
  tables: string[],
  onSync: () => void | Promise<void>,
  debounceMs = 300
) {
  const onSyncRef = useRef(onSync);
  onSyncRef.current = onSync;

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerSync = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        onSyncRef.current();
      } catch (err) {
        console.error("[useRealtimeSync] Error running onSync:", err);
      }
    }, debounceMs);
  }, [debounceMs]);

  useEffect(() => {
    // 1. Listen to local window events
    const handleLocalSync = (e: Event) => {
      const customEvent = e as CustomEvent<{ entity: string }>;
      const entity = customEvent.detail?.entity;
      if (!entity || entity === "all" || tables.includes(entity)) {
        triggerSync();
      }
    };
    window.addEventListener("driveflow:sync", handleLocalSync);

    // 2. Listen to cross-tab broadcast messages
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        bc = new BroadcastChannel("driveflow_sync");
        bc.onmessage = (event) => {
          const entity = event.data?.entity;
          if (!entity || entity === "all" || tables.includes(entity)) {
            triggerSync();
          }
        };
      }
    } catch (e) {
      console.warn("[useRealtimeSync] BroadcastChannel init error", e);
    }

    // 3. Supabase Realtime postgres_changes subscription
    const channelName = `rt-${tables.join("-")}-${Math.random().toString(36).slice(2, 7)}`;
    const channel = supabase.channel(channelName);

    tables.forEach((table) => {
      channel.on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: table,
        },
        () => {
          triggerSync();
        }
      );
    });

    channel.subscribe();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      window.removeEventListener("driveflow:sync", handleLocalSync);
      if (bc) {
        bc.close();
      }
      supabase.removeChannel(channel);
    };
  }, [tables.join(","), triggerSync]);
}
