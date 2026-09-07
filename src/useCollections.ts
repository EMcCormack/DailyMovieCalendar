import { useQuery } from "@tanstack/react-query";
import type { Season } from "../shared/models";
import { getCollections } from "./providers";

export function useCollections(season: Season) {
  const query = useQuery({
    queryKey: ["collections", season],
    queryFn: ({ signal }) => getCollections(season, signal),
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });

  return {
    collections: query.data ?? [],
    busy: query.isPending || query.isFetching,
    message: query.isError
      ? query.error instanceof Error
        ? query.error.message
        : "Could not load collections. Please try again."
      : query.data?.length === 0
        ? "No collections have been published for this season yet."
        : "",
    retry: () => query.refetch(),
  };
}
