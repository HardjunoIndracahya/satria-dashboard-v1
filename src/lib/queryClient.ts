import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, refetchOnReconnect: true },
  },
});

export const SHEET_QUERY_KEY = ['sheet'] as const;
export const syncNow = () => queryClient.refetchQueries({ queryKey: SHEET_QUERY_KEY });
