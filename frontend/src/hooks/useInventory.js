import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/api';

export function useInventory(params = {}) {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const fetch = useCallback(async (overrides = {}) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/laptops', {
        params: { ...params, ...overrides },
        signal: abortRef.current.signal,
      });
      setData(res.data.data);
      setTotal(res.data.total);
    } catch (err) {
      if (err.name !== 'CanceledError') setError(err.response?.data?.message || 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(params)]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, total, loading, error, refetch: fetch };
}
