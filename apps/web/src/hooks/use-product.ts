import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getOrgId } from '@/lib/http';

// Keyed per organization so switching never carries a product name across tenants.
const storageKey = () => `hhl-product:${getOrgId() ?? 'none'}`;

export function useProducts() {
  return useQuery({ queryKey: ['products'], queryFn: api.products });
}

export function useCurrentProduct() {
  const { data: products } = useProducts();
  const [current, setCurrent] = useState<string | null>(() => {
    try {
      return localStorage.getItem(storageKey());
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
        localStorage.setItem(storageKey(), first);
      } catch {
        /* storage unavailable (private mode) */
      }
    }
  }, [products, current]);

  const select = useCallback((name: string) => {
    setCurrent(name);
    try {
      localStorage.setItem(storageKey(), name);
    } catch {
      /* storage unavailable (private mode) */
    }
  }, []);

  return { current, products: products ?? [], select };
}
