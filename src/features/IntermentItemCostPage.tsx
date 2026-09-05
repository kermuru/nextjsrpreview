'use client';

import { useCallback, useEffect, useState } from 'react';
import { isApiError } from '@/lib/api';
import {
  AddonItemRow,
  IntermentItemCostService,
  ItemType,
  RegisterInput,
  RegisterResult,
  VisibilityRow,
} from '@/services/interment-item-cost';

const normDesc = (d: string) => (d ?? '').toUpperCase().trim();

/**
 * Online "Interment Item & Cost" — register a new add-on item and its price
 * through the INTERMENT-ITEM-COST driver (maker/checker). One submit files and
 * approves the item, then files and approves the price, so the item shows up in
 * the add-on list (which reads only APPROVED, priced, active items) immediately.
 *
 * LAYOUT
 *   Mobile first. The styling lives in globals.css under .iic-*, where the base
 *   rules describe a phone and min-width queries add the desktop back. Two
 *   consequences are worth knowing before editing the markup:
 *
 *     - Below 768px the items table renders as a stack of cards. That is done in
 *       CSS rather than with a second set of components, so every <td> MUST carry
 *       a data-label: it becomes the field name beside the value on a phone, and
 *       is dropped again on desktop. A cell without one shows a value with
 *       nothing naming it.
 *     - Alignment is by class (.iic-num, .iic-mid) rather than inline style,
 *       because it should only apply once the real table is back.
 */

const ITEM_TYPES: ItemType[] = ['INTERMENT', 'MASS', 'RENTAL'];

const peso = (n: number) =>
  '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const emptyForm: RegisterInput = {
  itemType: 'INTERMENT',
  itemDescription: '',
  unitDesc: '',
  qtyDefault: 1,
  amtPrice: 0,
  amtCost: 1,
  dateEffectivity: '',
  itemCode: '',
  isDefault: false,
};

export default function IntermentItemCostPage() {
  const [form, setForm] = useState<RegisterInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RegisterResult | null>(null);

  const [items, setItems] = useState<AddonItemRow[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [vis, setVis] = useState<VisibilityRow[]>([]);
  const [savingDesc, setSavingDesc] = useState<string | null>(null);

  const visibleSet = new Set(vis.map((r) => normDesc(r.description)));
  const perHeadSet = new Set(vis.filter((r) => r.is_per_head).map((r) => normDesc(r.description)));

  const loadItems = useCallback(async () => {
    setLoadingItems(true);
    try {
      const [rows, visRows] = await Promise.all([
        IntermentItemCostService.listItems(),
        IntermentItemCostService.getVisibility().catch(() => [] as VisibilityRow[]),
      ]);
      setItems(rows);
      setVis(visRows);
    } catch {
      /* leave list empty on error */
    } finally {
      setLoadingItems(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  async function toggleVisibility(description: string, isVisible: boolean, isPerHead: boolean) {
    const key = normDesc(description);
    setSavingDesc(key);
    try {
      await IntermentItemCostService.setVisibility(key, isVisible, isPerHead);
      setVis(await IntermentItemCostService.getVisibility());
    } catch {
      /* keep current state on failure */
    } finally {
      setSavingDesc(null);
    }
  }

  function set<K extends keyof RegisterInput>(key: K, value: RegisterInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!form.itemDescription.trim() || !form.unitDesc.trim()) {
      setError('Item description and unit are required.');
      return;
    }
    if (form.qtyDefault <= 0) {
      setError('Default quantity must be greater than 0.');
      return;
    }
    if (form.amtPrice <= 0) {
      setError('Price must be greater than 0.');
      return;
    }

    setSaving(true);
    try {
      const payload: RegisterInput = {
        ...form,
        itemDescription: form.itemDescription.trim(),
        unitDesc: form.unitDesc.trim(),
        itemCode: form.itemCode?.trim() || undefined,
        dateEffectivity: form.dateEffectivity || undefined,
        amtCost: form.amtCost && form.amtCost > 0 ? form.amtCost : undefined,
      };
      const res = await IntermentItemCostService.register(payload);
      setResult(res);
      setForm({ ...emptyForm });
      loadItems();
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Registration failed. Check SAERP before retrying.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="iic-page">
      <div className="iic-shell">
        <header className="iic-head">
          <h1>Interment Item &amp; Cost</h1>
          <p>Register a new add-on item and its price. Filed and approved through the SAERP maker/checker driver.</p>
        </header>

        <div className="iic-grid">
          {/* ── Register form ── */}
          <form onSubmit={handleSubmit} className="iic-card iic-form">
            <h2>Register Add-on Item</h2>

            <div className="iic-note">
              Filed &amp; approved automatically under the SAERP executor bot account (the agent that runs the driver).
            </div>

            <div className="iic-row">
              <div>
                <label className="iic-label" htmlFor="iic-type">
                  Item Type <span className="iic-req">*</span>
                </label>
                <select
                  id="iic-type"
                  className="iic-input"
                  value={form.itemType}
                  onChange={(e) => set('itemType', e.target.value as ItemType)}
                >
                  {ITEM_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="iic-label" htmlFor="iic-qty">
                  Default Qty <span className="iic-req">*</span>
                </label>
                {/* inputMode brings up the numeric keypad on a phone without
                    losing the spinner or the min= guard on desktop */}
                <input
                  id="iic-qty"
                  className="iic-input"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={form.qtyDefault}
                  onChange={(e) => set('qtyDefault', Number(e.target.value))}
                />
              </div>
            </div>

            <div>
              <label className="iic-label" htmlFor="iic-desc">
                Item Description <span className="iic-req">*</span>
              </label>
              <input
                id="iic-desc"
                className="iic-input"
                value={form.itemDescription}
                onChange={(e) => set('itemDescription', e.target.value)}
                placeholder="e.g. RUSH INTERMENT"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
              />
              <div className="iic-hint">Stored uppercase by SAERP.</div>
            </div>

            <div className="iic-row">
              <div>
                <label className="iic-label" htmlFor="iic-unit">
                  Unit <span className="iic-req">*</span>
                </label>
                <input
                  id="iic-unit"
                  className="iic-input"
                  value={form.unitDesc}
                  onChange={(e) => set('unitDesc', e.target.value)}
                  placeholder="e.g. PKG"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
              <div>
                <label className="iic-label" htmlFor="iic-code">Item Code</label>
                <input
                  id="iic-code"
                  className="iic-input"
                  value={form.itemCode ?? ''}
                  onChange={(e) => set('itemCode', e.target.value)}
                  placeholder="SKU code or N/A"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
            </div>

            <div className="iic-row">
              <div>
                <label className="iic-label" htmlFor="iic-price">
                  Price (₱) <span className="iic-req">*</span>
                </label>
                <input
                  id="iic-price"
                  className="iic-input"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min={0}
                  value={form.amtPrice || ''}
                  onChange={(e) => set('amtPrice', Number(e.target.value))}
                  placeholder="1500.00"
                />
              </div>
              <div>
                <label className="iic-label" htmlFor="iic-cost">Cost (₱)</label>
                <input
                  id="iic-cost"
                  className="iic-input"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min={0}
                  value={form.amtCost ?? ''}
                  onChange={(e) => set('amtCost', Number(e.target.value))}
                  placeholder="1.00"
                />
              </div>
            </div>

            <div>
              <label className="iic-label" htmlFor="iic-eff">Effectivity Date</label>
              <input
                id="iic-eff"
                className="iic-input"
                type="date"
                value={form.dateEffectivity ?? ''}
                onChange={(e) => set('dateEffectivity', e.target.value)}
              />
              <div className="iic-hint">Defaults to today if left blank.</div>
            </div>

            <label className="iic-check">
              <input
                type="checkbox"
                checked={!!form.isDefault}
                onChange={(e) => set('isDefault', e.target.checked)}
              />
              Pre-selected as a default add-on
            </label>

            {error && <div className="iic-alert iic-alert--error">{error}</div>}

            {result && (
              <div className="iic-alert iic-alert--ok">
                Registered. Item #{result.itemId ?? '—'} ({result.itemCode}) with price effectivity #{result.effectivityId ?? '—'}.
              </div>
            )}

            <button type="submit" disabled={saving} className="iic-submit">
              {saving ? 'Registering…' : 'Register Item & Price'}
            </button>
          </form>

          {/* ── Existing items ── */}
          <div className="iic-card">
            <div className="iic-listhead">
              <h2>Existing Add-on Items</h2>
              <button type="button" onClick={loadItems} className="iic-refresh">
                Refresh
              </button>
            </div>
            <div className="iic-scroll">
              <table className="iic-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Type</th>
                    <th>Unit</th>
                    <th className="iic-num">Qty</th>
                    <th className="iic-num">Price</th>
                    <th>Code</th>
                    <th className="iic-mid">Client</th>
                    <th className="iic-mid">Per-head</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingItems ? (
                    <tr><td colSpan={8} className="iic-empty">Loading…</td></tr>
                  ) : items.length === 0 ? (
                    <tr><td colSpan={8} className="iic-empty">No items yet.</td></tr>
                  ) : (
                    items.map((it) => {
                      const key = normDesc(it.description);
                      const visible = visibleSet.has(key);
                      const perHead = perHeadSet.has(key);
                      const busy = savingDesc === key;

                      return (
                        <tr key={it.id}>
                          {/* Description leads: it is the heading of the phone card
                              and the first column of the desktop table. */}
                          <td className="iic-cell-desc" data-label="Description">{it.description}</td>
                          <td data-label="Type">{it.item_type}</td>
                          <td data-label="Unit">{it.unit_desc}</td>
                          <td className="iic-num" data-label="Qty">{it.qty_default}</td>
                          <td className="iic-num iic-price" data-label="Price">{peso(it.unit_price)}</td>
                          <td className="iic-code" data-label="Code">{it.item_code}</td>
                          <td className="iic-mid" data-label="Show to client">
                            <input
                              type="checkbox"
                              checked={visible}
                              disabled={busy}
                              onChange={() => toggleVisibility(it.description, !visible, perHead)}
                              aria-label={`Show ${it.description} to clients`}
                              title="Show this add-on to clients"
                            />
                          </td>
                          <td className="iic-mid" data-label="Per-head">
                            <input
                              type="checkbox"
                              checked={perHead}
                              disabled={busy || !visible}
                              onChange={() => toggleVisibility(it.description, true, !perHead)}
                              aria-label={`Price ${it.description} per attendee`}
                              title="Priced per attendee (per head)"
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
