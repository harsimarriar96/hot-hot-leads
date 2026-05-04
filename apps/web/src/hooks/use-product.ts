import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

const STORAGE_KEY = 'hhl-product';

export function useProducts() {
  return useQuery({ queryKey: ['products'], queryFn: api.products });
}

export function useCurrentProduct() {
  const { data: products } = useProducts();
  const [current, setCurrent] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (!products || products.length === 0) return;
    if (!current || !products.some((p) => p.name === current)) {
      const first = products[0].name;
      setCurrent(first);
      try {
        localStorage.setItem(STORAGE_KEY, first);
      } catch {}
    }
  }, [products, current]);

  const select = useCallback((name: string) => {
    setCurrent(name);
    try {
      localStorage.setItem(STORAGE_KEY, name);
    } catch {}
  }, []);

  return { current, products: products ?? [], select };
}
