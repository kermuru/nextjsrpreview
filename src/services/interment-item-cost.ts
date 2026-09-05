import { apiRequest } from '@/lib/api';

/**
 * Interment Item & Cost (online) — register add-on items + prices through the
 * INTERMENT-ITEM-COST executor driver (maker/checker). `register` runs the full
 * cycle in one call: file + approve the item, then file + approve its price.
 */

export interface AddonItemRow {
  id: number;
  item_code: string;
  item_type: string;
  description: string;
  unit_desc: string;
  qty_default: number;
  is_default: number;
  unit_price: number;
}

export type ItemType = 'INTERMENT' | 'MASS' | 'RENTAL';

export interface RegisterInput {
  // No usercode here — the backend files/approves under the configured executor
  // bot usercode (the agent that runs the driver), not a value from the form.
  itemType: ItemType;
  itemDescription: string;
  unitDesc: string;
  qtyDefault: number;
  amtPrice: number;
  amtCost?: number;
  dateEffectivity?: string;
  itemCode?: string;
  isDefault?: boolean;
}

export interface RegisterResult {
  itemId: number | null;
  itemLogsId: number;
  priceLogsId: number;
  effectivityId: number | null;
  itemCode: string;
}

export interface VisibilityRow {
  description: string;
  is_per_head: boolean;
}

interface Envelope<T> {
  success: boolean;
  data: T;
  error?: string;
}

const BASE = '/interment/item-cost';
const VIS = '/interment/addon-visibility';

export const IntermentItemCostService = {
  async listItems(): Promise<AddonItemRow[]> {
    const res = await apiRequest<{ items: AddonItemRow[] }>(`${BASE}/items`);
    return res.items ?? [];
  },

  async register(input: RegisterInput): Promise<RegisterResult> {
    const res = await apiRequest<Envelope<RegisterResult>>(`${BASE}/register`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return res.data;
  },

  /** Which add-on descriptions are shown to clients (+ per-head flag). */
  async getVisibility(): Promise<VisibilityRow[]> {
    const res = await apiRequest<{ items: VisibilityRow[] }>(VIS);
    return res.items ?? [];
  },

  /** Show/hide an add-on for clients. is_visible=false removes it from the client list. */
  async setVisibility(description: string, isVisible: boolean, isPerHead: boolean): Promise<void> {
    await apiRequest(VIS, {
      method: 'POST',
      body: JSON.stringify({ description, is_visible: isVisible, is_per_head: isPerHead }),
    });
  },
};
