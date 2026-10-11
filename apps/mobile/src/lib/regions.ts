import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface Area {
  id: string;
  name: string;
}

export function useAreas() {
  const [areas, setAreas] = useState<Area[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    void supabase
      .from('regions')
      .select('id, name')
      .eq('kind', 'area')
      .order('sort')
      .then(({ data, error: err }) => {
        if (err) setError(true);
        else setAreas(data ?? []);
      });
  }, []);
  return { areas, error };
}
