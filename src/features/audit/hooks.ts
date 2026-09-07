import { useQuery } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";
import { QK } from "@/lib/queryKeys";
import type { AuditQuery } from "./types";

export function useAuditLog(filters: AuditQuery, enabled = true) {
  return useQuery({
    queryKey: QK.audit(filters),
    queryFn: () => auditApi.query(filters),
    // The log is append-only, so a cached page can only ever be missing new
    // rows — never showing something that has since changed.
    staleTime: 1000 * 15,
    enabled,
  });
}

export function useAuditFilterOptions(enabled = true) {
  return useQuery({
    queryKey: QK.auditFilterOptions,
    queryFn: () => auditApi.getFilterOptions(),
    staleTime: 1000 * 60,
    enabled,
  });
}
