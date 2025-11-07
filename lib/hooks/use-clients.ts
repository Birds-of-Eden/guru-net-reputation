// lib/hooks/use-clients.ts
// Custom hook for optimized client data fetching with caching

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Client } from "@/types/client";
import { toast } from "sonner";

interface UseClientsReturn {
  clients: Client[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// In-memory cache with timestamp
const clientsCache = {
  data: null as Client[] | null,
  timestamp: 0,
  CACHE_DURATION: 30000, // 30 seconds
};

export function useClients(): UseClientsReturn {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const isMounted = useRef(true);
  const fetchController = useRef<AbortController | null>(null);

  const fetchClients = useCallback(async () => {
    // Check cache first
    const now = Date.now();
    if (
      clientsCache.data &&
      now - clientsCache.timestamp < clientsCache.CACHE_DURATION
    ) {
      setClients(clientsCache.data);
      setLoading(false);
      return;
    }

    // Cancel any ongoing request
    if (fetchController.current) {
      fetchController.current.abort();
    }

    // Create new abort controller
    fetchController.current = new AbortController();

    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/clients", {
        signal: fetchController.current.signal,
        // Enable browser caching
        cache: "force-cache",
        next: { revalidate: 10 },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch clients");
      }

      const data: Client[] = await response.json();

      if (isMounted.current) {
        setClients(data);
        // Update cache
        clientsCache.data = data;
        clientsCache.timestamp = Date.now();
        setLoading(false);
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.name !== "AbortError") {
          console.error("Error fetching clients:", err);
          if (isMounted.current) {
            setError(err);
            toast.error("Failed to load clients data.");
            setLoading(false);
          }
        }
      }
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    fetchClients();

    return () => {
      isMounted.current = false;
      // Cleanup: abort any ongoing request
      if (fetchController.current) {
        fetchController.current.abort();
      }
    };
  }, [fetchClients]);

  return {
    clients,
    loading,
    error,
    refetch: fetchClients,
  };
}
