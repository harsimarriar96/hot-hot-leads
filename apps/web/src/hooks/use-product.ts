import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { api } from '@/lib/api';
import { getOrgId, subscribeOrg } from '@/lib/http';

// Keyed per organization so switching never carries a product name across tenants.
const storageKey = (orgId: string | null) => `hhl-product:${orgId ?? 'none'}`;

function readStored(orgId: string | null): string | null {
  try {
    return localStorage.getItem(storageKey(orgId));
  } catch {
    return null;
  }
}

// One store for the whole app: the header switcher and every page that shows
// product-scoped data read the same value, so a change re-renders all of them.
const listeners = new Set<() => void>();
let selected: string | null = readStored(getOrgId());

function setSelected(name: string) {
  if (name === selected) return;
  selected = name;
  try {
    localStorage.setItem(storageKey(getOrgId()), name);
  } catch {
    /* storage unavailable (private mode) */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => selected;

// A new organization has its own remembered product.
subscribeOrg(() => {
  selected = readStored(getOrgId());
  listeners.forEach((l) => l());
});

export function useProducts() {
  return useQuery({ queryKey: ['products'], queryFn: api.products });
}

export function useCurrentProduct() {
  const { data: products } = useProducts();
  const current = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    if (!products || products.length === 0) return;
    if (!current || !products.some((p) => p.name === current)) setSelected(products[0].name);
  }, [products, current]);

  const select = useCallback((name: string) => setSelected(name), []);

  return { current, products: products ?? [], select };
}
