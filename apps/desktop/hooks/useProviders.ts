import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/hooks/api";
import { describeError } from "@/hooks/errors";
import type { ProviderConfig, ProviderInfo, ProvidersState } from "@/types/generate";

export const useProviders = (root: string | null): ProvidersState => {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setProviders(await api.providersList(root));
      setError(null);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  }, [root]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const configure = useCallback(
    async (config: ProviderConfig, activate: boolean, apiKey: string | null) => {
      setSaving(true);
      try {
        setProviders(await api.providerConfigure(root, config, activate, apiKey));
        setError(null);
      } catch (e) {
        setError(describeError(e));
      } finally {
        setSaving(false);
      }
    },
    [root],
  );

  const active = useMemo(() => providers.find((p) => p.active) ?? null, [providers]);

  return useMemo(
    () => ({ providers, active, loading, saving, error, reload, configure }),
    [providers, active, loading, saving, error, reload, configure],
  );
};
