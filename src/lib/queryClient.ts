import { QueryClient } from "@tanstack/react-query";
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      retryDelay: 500,
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 10,
    },
    mutations: {
      retry: 0,
    },
  },
});
