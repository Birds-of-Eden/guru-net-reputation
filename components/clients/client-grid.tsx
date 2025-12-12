// components/clients/client-grid.tsx
//lint error fixed

"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { ClientCard } from "@/components/clients/client-card";
import type { Client } from "@/types/client";

interface ClientGridProps {
  clients: Client[];
  onViewDetails: (client: Client) => void;
  /** Favorites (am_ceo only): pass through so ClientCard can render heart */
  favoriteIds?: Set<string>;
  onToggleFavorite?: (clientId: string) => void;
}

const ClientGridComponent = function ClientGrid({
  clients,
  onViewDetails,
  favoriteIds,
  onToggleFavorite,
}: ClientGridProps) {
  // ƒs­ OPTIMIZATION: Virtual scrolling / infinite render for large lists
  const ITEMS_PER_PAGE = 30;
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // reset visible count when list changes (filters/pagination)
    setVisibleCount(ITEMS_PER_PAGE);
  }, [clients.length]);

  useEffect(() => {
    if (clients.length <= ITEMS_PER_PAGE) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < clients.length) {
          setVisibleCount((prev) =>
            Math.min(prev + ITEMS_PER_PAGE, clients.length)
          );
        }
      },
      { threshold: 0.1 }
    );

    const sentinel = containerRef.current?.querySelector("[data-sentinel]");
    if (sentinel) observer.observe(sentinel);

    return () => observer.disconnect();
  }, [visibleCount, clients.length]);

  const visibleClients = useMemo(
    () => clients.slice(0, visibleCount),
    [clients, visibleCount]
  );

  const hasMore = visibleCount < clients.length;

  return (
    <div
      ref={containerRef}
      className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
    >
      {visibleClients.map((client) => (
        <ClientCard
          key={client.id}
          client={client}
          clientUserId={(client as any).clientUserId ?? null}
          onViewDetails={() => onViewDetails(client)}
          isFavorite={favoriteIds?.has(client.id) ?? false}
          onToggleFavorite={onToggleFavorite}
        />
      ))}

      {hasMore && (
        <div data-sentinel className="col-span-full p-4 text-center text-sm text-gray-500">
          Loading more clients… ({visibleCount}/{clients.length})
        </div>
      )}
    </div>
  );
};

export const ClientGrid = memo(ClientGridComponent);
