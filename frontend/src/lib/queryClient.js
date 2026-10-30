import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // 401/403/404/422 won't fix themselves; only retry network/server errors once
      retry: (count, error) => count < 1 && !(error?.status >= 400 && error?.status < 500),
    },
  },
});
