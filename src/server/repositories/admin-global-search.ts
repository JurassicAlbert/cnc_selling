/**
 * Global search (Ctrl/⌘+K) - `docs/ARCHITECTURE.md` §16A.5: "jump to order
 * 2026/08/0042 by typing it, from anywhere." Reuses the four entities' own
 * existing admin list queries rather than duplicating search logic -
 * `listOrdersForAdmin`/`listCustomersForAdmin` already had a `search`
 * filter with the right semantics; `listDesignsForAdmin`/
 * `listProductsForAdmin` gained one (optional, backward-compatible) for
 * this feature specifically.
 */

import { listOrdersForAdmin } from '@/server/repositories/admin-orders';
import { listCustomersForAdmin } from '@/server/repositories/admin-customers';
import { listDesignsForAdmin } from '@/server/repositories/admin-designs';
import { listProductsForAdmin } from '@/server/repositories/admin-products';

export type GlobalSearchResultType = 'order' | 'customer' | 'design' | 'product';

export type GlobalSearchResult = {
  readonly type: GlobalSearchResultType;
  readonly id: string;
  readonly label: string;
  readonly sublabel: string;
  readonly href: string;
};

export type GlobalSearchResults = {
  readonly orders: readonly GlobalSearchResult[];
  readonly customers: readonly GlobalSearchResult[];
  readonly designs: readonly GlobalSearchResult[];
  readonly products: readonly GlobalSearchResult[];
};

const RESULTS_PER_TYPE = 5;

const EMPTY_RESULTS: GlobalSearchResults = { orders: [], customers: [], designs: [], products: [] };

export async function searchGlobal(query: string): Promise<GlobalSearchResults> {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return EMPTY_RESULTS;
  }

  const [orders, customers, designs, products] = await Promise.all([
    listOrdersForAdmin({ search: trimmed }),
    listCustomersForAdmin(trimmed),
    listDesignsForAdmin({ search: trimmed }),
    listProductsForAdmin({ search: trimmed }),
  ]);

  return {
    orders: orders.slice(0, RESULTS_PER_TYPE).map((order) => ({
      type: 'order',
      id: order.orderNumber,
      label: order.orderNumber,
      sublabel: order.customerName,
      href: `/panel/zamowienia/${encodeURIComponent(order.orderNumber)}`,
    })),
    customers: customers.slice(0, RESULTS_PER_TYPE).map((customer) => ({
      type: 'customer',
      id: customer.id,
      label: customer.name,
      sublabel: customer.email,
      href: `/panel/klienci/${customer.id}`,
    })),
    designs: designs.slice(0, RESULTS_PER_TYPE).map((design) => ({
      type: 'design',
      id: design.id,
      label: design.namePl,
      sublabel: design.code,
      href: `/panel/wzory/${design.id}`,
    })),
    products: products.slice(0, RESULTS_PER_TYPE).map((product) => ({
      type: 'product',
      id: product.id,
      label: product.namePl,
      sublabel: product.categoryNamePl,
      href: `/panel/produkty/${product.id}`,
    })),
  };
}
