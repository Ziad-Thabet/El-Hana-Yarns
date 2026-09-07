import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/lib/api";
import { QK } from "@/lib/queryKeys";
import type { AuthSession, LoginCredentials, RegisterData } from "./types";

export function useActiveSession(enabled = true) {
  return useQuery<AuthSession>({
    queryKey: QK.authSession,
    queryFn: () => authApi.getActiveSession(),
    staleTime: 0,
    retry: false,
    enabled,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (credentials: LoginCredentials) => authApi.login(credentials),
    onSuccess: (session) => qc.setQueryData(QK.authSession, session),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => authApi.logout(sessionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.authSession }),
  });
}

export function useHasAnyUsers() {
  return useQuery<boolean>({
    queryKey: QK.authHasAnyUsers,
    queryFn: () => authApi.hasAnyUsers(),
    staleTime: 0,
    retry: false,
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: RegisterData) => authApi.register(data),
    onSuccess: (session) => {
      qc.setQueryData(QK.authSession, session);
      qc.setQueryData(QK.authHasAnyUsers, true);
    },
  });
}

/** Wildcard: a role that holds it may do anything. */
const ALL = "*";

/**
 * Asks what the signed-in user may do, rather than what they are.
 *
 * Components should prefer `can("catalogue.manage")` over `isAdmin`: the former
 * survives a role being added or a permission being moved, the latter does not.
 * Returns false while the session is loading — deny by default.
 */
export function useCan(): (capability: string) => boolean {
  const { data: session } = useActiveSession();
  const capabilities = session?.capabilities;
  return (capability: string) => {
    if (!capabilities) return false;
    return capabilities.includes(ALL) || capabilities.includes(capability);
  };
}
