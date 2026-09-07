import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { settingsApi } from "@/lib/api";
import { QK } from "@/lib/queryKeys";
import type { ClientSettings, SettingValue } from "./types";

/** Compiled fallbacks, so a component never renders before settings arrive. */
const CLIENT_DEFAULTS: ClientSettings = {
  "shop.name": "الهنا للخيوط",
  "shop.tagline": "خيوط تريكو وكروشيه",
  "shop.address": "",
  "shop.phone": "",
  "receipt.widthMm": 80,
  "receipt.footerNote": "",
  "inventory.lowStockThreshold": 10,
  "shift.staleHours": 10,
};

/**
 * The settings every logged-in user may read.
 *
 * Cached indefinitely and invalidated explicitly on save: these change a few
 * times a year, and refetching them on every mount would put a query in front
 * of every threshold comparison.
 */
export function useSettings() {
  return useQuery({
    queryKey: QK.settings,
    queryFn: () => settingsApi.getClient(),
    staleTime: Infinity,
    gcTime: Infinity,
    placeholderData: CLIENT_DEFAULTS,
  });
}

/** Reads one setting with its compiled default as the fallback. */
export function useSetting<T extends SettingValue>(key: string, fallback: T): T {
  const { data } = useSettings();
  const value = data?.[key] ?? CLIENT_DEFAULTS[key];
  return (value === undefined ? fallback : value) as T;
}

/** Admin-only: every setting with its metadata, for the editor. */
export function useAllSettings(enabled = true) {
  return useQuery({
    queryKey: QK.allSettings,
    queryFn: () => settingsApi.getAll(),
    staleTime: 1000 * 30,
    enabled,
  });
}

function useInvalidateSettings() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: QK.settings });
    // Thresholds change report and product output, so those caches are stale too.
    qc.invalidateQueries({ queryKey: QK.products });
    qc.invalidateQueries({ queryKey: ["reports"] });
  };
}

export function useUpdateSettings() {
  const invalidate = useInvalidateSettings();
  return useMutation({
    mutationFn: (values: Record<string, SettingValue>) =>
      settingsApi.update(values),
    onSuccess: invalidate,
  });
}

export function useResetSetting() {
  const invalidate = useInvalidateSettings();
  return useMutation({
    mutationFn: (key: string) => settingsApi.reset(key),
    onSuccess: invalidate,
  });
}

export { CLIENT_DEFAULTS };
