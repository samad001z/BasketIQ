/**
 * The single typed API client. Mobile talks to FastAPI ONLY through this file,
 * wrapped in React Query hooks (lib/hooks/*). No fetch calls anywhere else.
 */

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:8000";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch (e) {
    throw new ApiError(
      `Network error reaching ${BASE_URL}${path}. Is the backend running and is EXPO_PUBLIC_API_URL correct for your device?`,
    );
  }
  if (!res.ok) {
    throw new ApiError(`Request failed: ${res.status} ${res.statusText}`, res.status);
  }
  return (await res.json()) as T;
}

// ---- Types mirror backend Pydantic models (app/utils/schemas.py) ----

export type DependencyStatus = {
  name: string;
  status: "ok" | "error" | "not_configured";
  detail: string | null;
};

export type HealthResponse = {
  status: "ok" | "degraded";
  service: string;
  version: string;
  timestamp: string;
  dependencies: DependencyStatus[];
};

export type Platform = "blinkit" | "zepto" | "instamart";

export type PlatformPrice = {
  id: string;
  platform: Platform;
  price: number;
  delivery_fee: number;
  free_delivery_threshold: number | null;
  delivery_time_mins: number | null;
  availability: boolean;
  updated_at: string;
};

export type Product = {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  quantity: string | null;
  image_url: string | null;
  created_at: string;
  platform_prices: PlatformPrice[];
};

export type ProductsResponse = {
  page: number;
  page_size: number;
  total: number;
  count: number;
  items: Product[];
};

export type SearchBestOption = {
  cheapest_platform: Platform;
  cheapest_price: number;
  savings_vs_costliest: number;
  fastest_platform: Platform;
  fastest_delivery_mins: number | null;
};

export type SearchMatch = {
  product: Product;
  similarity: number;
  best_option: SearchBestOption | null;
};

export type SearchResponse = {
  query: string;
  count: number;
  matches: SearchMatch[];
};

export type OptimizeRequestItem = { product_id: string; quantity: number };

export type OptimizedLineItem = {
  product_id: string;
  name: string;
  brand: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
};

export type PlatformGroup = {
  platform: Platform;
  items: OptimizedLineItem[];
  subtotal: number;
  delivery_fee: number;
  delivery_applied: number;
  delivery_waived: boolean;
  total: number;
};

export type UnavailableItem = { product_id: string; name: string };

export type OptimizeResponse = {
  split: PlatformGroup[];
  grand_total: number;
  single_best_platform: Platform | null;
  single_best_total: number | null;
  savings: number;
  unavailable_items: UnavailableItem[];
  item_count: number;
};

// ---- Endpoints ----

export const api = {
  baseUrl: BASE_URL,
  getHealth: () => request<HealthResponse>("/health"),
  getProducts: (page = 1, pageSize = 100) =>
    request<ProductsResponse>(`/products?page=${page}&page_size=${pageSize}`),
  search: (q: string, k = 12) =>
    request<SearchResponse>(`/search?q=${encodeURIComponent(q)}&k=${k}`),
  optimize: (items: OptimizeRequestItem[]) =>
    request<OptimizeResponse>("/optimize", {
      method: "POST",
      body: JSON.stringify({ items }),
    }),
};
