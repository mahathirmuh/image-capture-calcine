import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    // `user` diisi ulang oleh beforeLoad di __root setiap kali router dimuat
    // atau di-invalidate; null di sini hanya nilai awal sebelum sesi dibaca.
    context: { queryClient, user: null },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
