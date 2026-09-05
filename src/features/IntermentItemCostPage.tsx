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
 */

const ITEM_TYPES: ItemType[] = ['INTERMENT', 'MASS', 'RENTAL'];

const peso = (n: number) =>
  '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: 20,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};
const label: React.CSSProperties = {
  display: 'block',
  fontSize: '0.72rem',
  fontWeight: 700,
  color: '#57534e',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: 5,
};
const input: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid #d1d5db',
  borderRadius: 7,
  fontSize: '0.85rem',
  outline: 'none',
  boxSizing: 'border-box',
};

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
    <div style={{ minHeight: '100vh', background: '#f5f5f4', padding: '24px 16px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <header style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0a352d', margin: 0 }}>Interment Item &amp; Cost</h1>
          <p style={{ color: '#78716c', fontSize: '0.85rem', margin: '4px 0 0' }}>
            Register a new add-on item and its price. Filed and approved through the SAERP maker/checker driver.
          </p>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 420px) 1fr', gap: 24, alignItems: 'start' }}>
          {/* ── Register form ── */}
          <form onSubmit={handleSubmit} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#0a352d', margin: 0, borderBottom: '1px solid #eee', paddingBottom: 10 }}>
              Register Add-on Item
            </h2>

            <div style={{ fontSize: '0.72rem', color: '#78716c', background: '#f5f5f4', border: '1px solid #e7e5e4', borderRadius: 7, padding: '8px 10px' }}>
              Filed &amp; approved automatically under the SAERP executor bot account (the agent that runs the driver).
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={label}>Item Type <span style={{ color: '#dc2626' }}>*</span></label>
                <select value={form.itemType} onChange={(e) => set('itemType', e.target.value as ItemType)} style={input}>
                  {ITEM_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={label}>Default Qty <span style={{ color: '#dc2626' }}>*</span></label>
                <input type="number" min={1} value={form.qtyDefault} onChange={(e) => set('qtyDefault', Number(e.target.value))} style={input} />
              </div>
            </div>

            <div>
              <label style={label}>Item Description <span style={{ color: '#dc2626' }}>*</span></label>
              <input value={form.itemDescription} onChange={(e) => set('itemDescription', e.target.value)} placeholder="e.g. RUSH INTERMENT" style={input} />
              <div style={{ fontSize: '0.68rem', color: '#a8a29e', marginTop: 3 }}>Stored uppercase by SAERP.</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={label}>Unit <span style={{ color: '#dc2626' }}>*</span></label>
                <input value={form.unitDesc} onChange={(e) => set('unitDesc', e.target.value)} placeholder="e.g. PKG" style={input} />
              </div>
              <div>
                <label style={label}>Item Code</label>
                <input value={form.itemCode ?? ''} onChange={(e) => set('itemCode', e.target.value)} placeholder="SKU code or N/A" style={input} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={label}>Price (₱) <span style={{ color: '#dc2626' }}>*</span></label>
                <input type="number" step="0.01" min={0} value={form.amtPrice || ''} onChange={(e) => set('amtPrice', Number(e.target.value))} placeholder="1500.00" style={input} />
              </div>
              <div>
                <label style={label}>Cost (₱)</label>
                <input type="number" step="0.01" min={0} value={form.amtCost ?? ''} onChange={(e) => set('amtCost', Number(e.target.value))} placeholder="1.00" style={input} />
              </div>
            </div>

            <div>
              <label style={label}>Effectivity Date</label>
              <input type="date" value={form.dateEffectivity ?? ''} onChange={(e) => set('dateEffectivity', e.target.value)} style={input} />
              <div style={{ fontSize: '0.68rem', color: '#a8a29e', marginTop: 3 }}>Defaults to today if left blank.</div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: '#44403c', cursor: 'pointer' }}>
              <input type="checkbox" checked={!!form.isDefault} onChange={(e) => set('isDefault', e.target.checked)} />
              Pre-selected as a default add-on
            </label>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7, padding: '9px 12px', fontSize: '0.8rem', color: '#991b1b' }}>
                {error}
              </div>
            )}

            {result && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 7, padding: '10px 12px', fontSize: '0.8rem', color: '#166534' }}>
                Registered. Item #{result.itemId ?? '—'} ({result.itemCode}) with price effectivity #{result.effectivityId ?? '—'}.
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '11px', borderRadius: 8, border: 'none',
                background: saving ? '#9ca3af' : '#0a352d', color: '#fff',
                fontWeight: 800, fontSize: '0.9rem', cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Registering…' : 'Register Item & Price'}
            </button>
          </form>

          {/* ── Existing items ── */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#0a352d', margin: 0 }}>Existing Add-on Items</h2>
              <button onClick={loadItems} style={{ fontSize: '0.75rem', color: '#0a352d', background: 'none', border: '1px solid #d6d3d1', borderRadius: 6, padding: '5px 10px', cursor: 'pointer' }}>
                Refresh
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#78716c', borderBottom: '2px solid #eee' }}>
                    <th style={{ padding: '8px 6px' }}>Type</th>
                    <th style={{ padding: '8px 6px' }}>Description</th>
                    <th style={{ padding: '8px 6px' }}>Unit</th>
                    <th style={{ padding: '8px 6px', textAlign: 'right' }}>Qty</th>
                    <th style={{ padding: '8px 6px', textAlign: 'right' }}>Price</th>
                    <th style={{ padding: '8px 6px' }}>Code</th>
                    <th style={{ padding: '8px 6px', textAlign: 'center' }}>Client</th>
                    <th style={{ padding: '8px 6px', textAlign: 'center' }}>Per-head</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingItems ? (
                    <tr><td colSpan={8} style={{ padding: 16, color: '#a8a29e' }}>Loading…</td></tr>
                  ) : items.length === 0 ? (
                    <tr><td colSpan={8} style={{ padding: 16, color: '#a8a29e' }}>No items yet.</td></tr>
                  ) : (
                    items.map((it) => (
                      <tr key={it.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '8px 6px' }}>{it.item_type}</td>
                        <td style={{ padding: '8px 6px', fontWeight: 600, color: '#292524' }}>{it.description}</td>
                        <td style={{ padding: '8px 6px' }}>{it.unit_desc}</td>
                        <td style={{ padding: '8px 6px', textAlign: 'right' }}>{it.qty_default}</td>
                        <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 700 }}>{peso(it.unit_price)}</td>
                        <td style={{ padding: '8px 6px', color: '#78716c' }}>{it.item_code}</td>
                        {(() => {
                          const key = normDesc(it.description);
                          const visible = visibleSet.has(key);
                          const perHead = perHeadSet.has(key);
                          const busy = savingDesc === key;
                          return (
                            <>
                              <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={visible}
                                  disabled={busy}
                                  onChange={() => toggleVisibility(it.description, !visible, perHead)}
                                  title="Show this add-on to clients"
                                />
                              </td>
                              <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={perHead}
                                  disabled={busy || !visible}
                                  onChange={() => toggleVisibility(it.description, true, !perHead)}
                                  title="Priced per attendee (per head)"
                                />
                              </td>
                            </>
                          );
                        })()}
                      </tr>
                    ))
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
