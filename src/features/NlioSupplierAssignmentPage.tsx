'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { isApiError } from '@/lib/api';
import { getUser, getUserName, logout } from '@/lib/auth';
import { getAssignableItems } from '@/services/supplier-item-assignments';
import {
  createNlioAssignment,
  deleteNlioAssignment,
  getAssignmentsByDocumentNo,
  getAutoAssignSettings,
  getBudgetByDocumentNo,
  getNlioByDocumentNo,
  getRecentNlios,
  getSuppliersByItem,
  notifyMarshalsByDocument,
  triggerAutoAssign,
  updateAutoAssignSettings,
} from '@/services/nlio-supplier-assignments';
import type { BudgetAmountItem, RecentNlioItem } from '@/services/nlio-supplier-assignments';
import type {
  NlioAssignmentRecord,
  NlioRecord,
  SupplierAssignableItem,
  SupplierByItemRecord,
} from '@/types/api';

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        border: '2px solid var(--color-border-secondary)',
        borderTopColor: 'var(--color-text-secondary)',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
        verticalAlign: 'middle',
        flexShrink: 0,
      }}
    />
  );
}

export default function NlioSupplierAssignmentPage() {
  const [recentNlios, setRecentNlios] = useState<RecentNlioItem[]>([]);
  const [days, setDays] = useState<7 | 15 | 30>(7);
  const [listLoading, setListLoading] = useState(false);
  const [documentNo, setDocumentNo] = useState('');
  const [assignedBy, setAssignedBy] = useState(() => getUserName());
  const [items, setItems] = useState<SupplierAssignableItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierByItemRecord[]>([]);
  const [nlioRecords, setNlioRecords] = useState<NlioRecord[]>([]);
  const [assignments, setAssignments] = useState<NlioAssignmentRecord[]>([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedSupplierKey, setSelectedSupplierKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [scheduleEnabled, setScheduleEnabled] = useState<boolean | null>(null);
  const [toggling, setToggling] = useState(false);
  const [intermentDate, setIntermentDate] = useState('');
  const [intermentTime, setIntermentTime] = useState('');
  const [massTime, setMassTime] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [budgetAmounts, setBudgetAmounts] = useState<BudgetAmountItem[]>([]);
  const [serviceAmount, setServiceAmount] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState(false);

  // "Assigned By" is always the logged-in user — auto-filled, not editable.
  useEffect(() => {
    const name = getUserName();
    if (name) setAssignedBy(name);
    const u = getUser();
    setIsAdmin(typeof u?.username === 'string' && u.username === 'kfugata');
  }, []);

  useEffect(() => {
    async function loadInitial() {
      setListLoading(true);
      try {
        const [itemsData, recentData, settingsRes] = await Promise.all([
          getAssignableItems(),
          getRecentNlios(days),
          getAutoAssignSettings().catch(() => null),
        ]);
        setItems(itemsData);
        setRecentNlios(recentData);
        if (settingsRes) setScheduleEnabled(settingsRes.data.enabled);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data.');
      } finally {
        setListLoading(false);
      }
    }

    void loadInitial();
  }, [days]);

  async function handleSelectNlio(docNo: string) {
    setDocumentNo(docNo);
    setNlioRecords([]);
    setAssignments([]);
    setSelectedSupplierKey('');
    setError('');
    setMessage('');

    if (!docNo) return;

    setLoading(true);
    try {
      const [nlioData, assignmentData, budgetData] = await Promise.all([
        getNlioByDocumentNo(docNo),
        getAssignmentsByDocumentNo(docNo),
        getBudgetByDocumentNo(docNo).catch(() => []),
      ]);
      setNlioRecords(nlioData);
      setAssignments(assignmentData);
      setBudgetAmounts(budgetData);
      setServiceAmount('');
      setSelectedItemId('');
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to fetch NLIO record.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleItemChange(itemId: string) {
    setSelectedItemId(itemId);
    setSelectedSupplierKey('');
    setSuppliers([]);

    // Auto-fill budget amount for selected item
    const budgetItem = budgetAmounts.find(b => String(b.supplier_item_id) === itemId);
    setServiceAmount(budgetItem?.budget_amount != null ? String(budgetItem.budget_amount) : '');

    if (!itemId) return;

    try {
      const supplierData = await getSuppliersByItem(Number(itemId));
      setSuppliers(supplierData);
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to fetch suppliers for item.');
      }
    }
  }

  async function refreshAssignments() {
    if (!documentNo.trim()) return;
    setAssignments(await getAssignmentsByDocumentNo(documentNo.trim()));
  }

  async function handleToggleSchedule() {
    if (scheduleEnabled === null || toggling) return;
    const next = !scheduleEnabled;
    setToggling(true);
    try {
      const res = await updateAutoAssignSettings(next);
      setScheduleEnabled(res.data.enabled);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update schedule setting.');
    } finally {
      setToggling(false);
    }
  }

  async function handleAutoAssign() {
    setAutoAssigning(true);
    setError('');
    setMessage('');
    try {
      const res = await triggerAutoAssign(30);
      setMessage(res.message);
      // Refresh the list and current document assignments after auto-assign
      const [recentData] = await Promise.all([
        getRecentNlios(days),
      ]);
      setRecentNlios(recentData);
      if (documentNo.trim()) {
        await refreshAssignments();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auto-assign failed.');
    } finally {
      setAutoAssigning(false);
    }
  }

  async function handleAssign() {
    if (!documentNo.trim()) {
      setError('Please search an NLIO first.');
      return;
    }

    if (!selectedItemId || !selectedSupplierKey) {
      setError('Please select an item and supplier.');
      return;
    }

    const [bparId, partnerId] = selectedSupplierKey.split('|');

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const response = await createNlioAssignment({
        document_no:      documentNo.trim(),
        bpar_i_person_id: Number(bparId),
        s_bpartner_id:    Number(partnerId),
        supplier_item_id: Number(selectedItemId),
        assigned_by:      assignedBy.trim() || undefined,
        service_amount:   serviceAmount ? Number(serviceAmount) : undefined,
        interment_date:   intermentDate.trim() || undefined,
        interment_time:   intermentTime.trim() || undefined,
        mass_time:        massTime.trim() || undefined,
      });

      setMessage(response.message);
      setSelectedSupplierKey('');
      await refreshAssignments();
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to assign supplier to NLIO.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleNotify() {
    if (!documentNo.trim()) return;
    setNotifying(true);
    setError('');
    setMessage('');
    try {
      const overrides: { interment_date?: string; interment_time?: string; mass_time?: string } = {};
      if (intermentDate.trim()) overrides.interment_date = intermentDate.trim();
      if (intermentTime.trim()) overrides.interment_time = intermentTime.trim();
      if (massTime.trim())      overrides.mass_time      = massTime.trim();
      const res = await notifyMarshalsByDocument(documentNo.trim(), overrides);
      setMessage(res.message);
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to notify marshals.');
      }
    } finally {
      setNotifying(false);
    }
  }

  async function handleDelete(id: number) {
    setError('');
    setMessage('');

    try {
      const response = await deleteNlioAssignment(id);
      setMessage(response.message);
      await refreshAssignments();
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to delete NLIO assignment.');
      }
    }
  }

  return (
    <>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    <div className="page-shell plain">
      <div className="center-column">
        <div className="page-card wide stack">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Link
              href="/supplierio"
              style={{ backgroundColor: '#8b6b44', color: 'white', padding: '8px 12px', borderRadius: 4, textDecoration: 'none', width: 'fit-content' }}
            >
              Menu
            </Link>
            <button
              type="button"
              onClick={logout}
              style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 4, padding: '6px 14px', fontSize: '0.8rem', color: '#6b7280', cursor: 'pointer' }}
            >
              Log out
            </button>
          </div>
          <div className="row between" style={{ alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0 }}>NLIO Supplier Assignment</h1>
            {isAdmin && <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              {/* Schedule on/off toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={scheduleEnabled ?? false}
                  onClick={() => void handleToggleSchedule()}
                  disabled={toggling || scheduleEnabled === null}
                  title={scheduleEnabled ? 'Scheduled auto-assign is ON — click to disable' : 'Scheduled auto-assign is OFF — click to enable'}
                  style={{
                    position: 'relative',
                    display: 'inline-block',
                    width: 40,
                    height: 22,
                    borderRadius: 11,
                    background: toggling || scheduleEnabled === null
                      ? '#d1d5db'
                      : scheduleEnabled ? '#16a34a' : '#9ca3af',
                    border: 'none',
                    cursor: (toggling || scheduleEnabled === null) ? 'not-allowed' : 'pointer',
                    padding: 0,
                    transition: 'background 0.2s',
                    flexShrink: 0,
                  }}
                >
                  <span style={{
                    position: 'absolute',
                    top: 3,
                    left: (scheduleEnabled && !toggling) ? 21 : 3,
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: '#fff',
                    transition: 'left 0.18s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {toggling ? <Spinner size={10} /> : null}
                  </span>
                </button>
                <span style={{
                  fontFamily: 'Nunito, sans-serif',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: scheduleEnabled === null ? '#9ca3af' : scheduleEnabled ? '#16a34a' : '#6b7280',
                  whiteSpace: 'nowrap',
                }}>
                  {scheduleEnabled === null ? 'Schedule…' : scheduleEnabled ? 'Schedule ON' : 'Schedule OFF'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => void handleAutoAssign()}
                disabled={autoAssigning}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  background: autoAssigning ? '#6b7280' : '#0a352d',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 18px',
                  fontFamily: 'Nunito, sans-serif',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: autoAssigning ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {autoAssigning ? <><Spinner size={13} /> Running…</> : '⚡ Auto Assign All'}
              </button>
            </div>}
          </div>

          <div>
            <label className="helper" style={{ marginBottom: 8, display: 'block' }}>Interment Orders</label>

            {/* Filter bar — sits ABOVE the list, never inside scroll */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              background: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: '8px 8px 0 0',
              gap: 10,
            }}>
              <span style={{ fontFamily: 'Nunito, sans-serif', fontSize: '0.75rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                {listLoading
                  ? <><Spinner size={12} />&nbsp; Fetching…</>
                  : <><strong style={{ color: '#111827' }}>{recentNlios.length}</strong> order{recentNlios.length !== 1 ? 's' : ''}</>
                }
              </span>

              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {([
                  { d: 7,  label: '7 days'  },
                  { d: 15, label: '15 days' },
                  { d: 30, label: '30 days' },
                ] as const).map(({ d, label }) => (
                  <button
                    key={d}
                    onClick={() => { setDays(d); setDocumentNo(''); }}
                    disabled={listLoading}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 6,
                      border: `1.5px solid ${days === d ? '#0a352d' : '#9ca3af'}`,
                      background: days === d ? '#0a352d' : '#ffffff',
                      color: days === d ? '#ffffff' : '#374151',
                      fontFamily: 'Nunito, sans-serif',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      cursor: listLoading ? 'not-allowed' : 'pointer',
                      opacity: listLoading ? 0.5 : 1,
                      whiteSpace: 'nowrap',
                      minWidth: 62,
                      textAlign: 'center',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable IO list */}
            <div style={{ maxHeight: 290, overflowY: 'auto', border: '1px solid #d1d5db', borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
              {listLoading ? (
                <div style={{
                  padding: '32px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                }}>
                  <Spinner size={24} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      Fetching interment orders…
                    </div>
                    <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: 4 }}>
                      Looking up the last {days} days
                    </div>
                  </div>
                </div>
              ) : recentNlios.length === 0 ? (
                <div style={{
                  padding: '32px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <span style={{ fontSize: '1.5rem' }}>📋</span>
                  <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-text-primary)', textAlign: 'center' }}>
                    No interment orders found
                  </div>
                  <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: '0.75rem', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
                    No orders within the last {days} days. Try expanding to 15 or 30 days.
                  </div>
                </div>
              ) : (
                recentNlios.map((nlio) => {
                  const allDone = nlio.assigned_count === nlio.total_items;
                  const noneDone = nlio.assigned_count === 0;
                  const isSelected = documentNo === nlio.documentno;
                  return (
                    <button
                      key={nlio.documentno}
                      onClick={() => void handleSelectNlio(nlio.documentno)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        border: 'none',
                        borderBottom: '1px solid var(--color-border-secondary)',
                        background: isSelected ? 'var(--color-accent)' : 'transparent',
                        color: isSelected ? '#fff' : 'inherit',
                        cursor: 'pointer',
                        textAlign: 'left',
                        gap: 10,
                      }}
                    >
                      <div>
                        <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: '0.82rem', fontWeight: 700 }}>
                          {nlio.documentno}
                        </div>
                        <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: '0.72rem', opacity: 0.8 }}>
                          {nlio.name1 || '—'} · {nlio.date_interment || '—'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        {(nlio.item_status ?? []).map(item => (
                          <span
                            key={item.id}
                            title={item.item_name}
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: item.assigned
                                ? (isSelected ? '#fff' : '#16a34a')
                                : (isSelected ? 'rgba(255,255,255,0.4)' : '#d1d5db'),
                              display: 'inline-block',
                              flexShrink: 0,
                            }}
                          />
                        ))}
                        <span style={{
                          fontFamily: 'Nunito, sans-serif',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          color: isSelected ? '#fff' : allDone ? '#16a34a' : noneDone ? '#9ca3af' : '#b45309',
                          marginLeft: 4,
                        }}>
                          {nlio.assigned_count}/{nlio.total_items}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>{/* end scrollable list */}
          </div>

          {loading && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                borderRadius: 8,
                background: 'var(--color-background-info)',
                color: 'var(--color-text-info)',
                border: '0.5px solid var(--color-border-info)',
                fontSize: 13,
              }}
            >
              <Spinner size={13} />
              Loading interment details...
            </div>
          )}
          {error ? <div className="status-card error">{error}</div> : null}
          {message ? <div className="status-card success">{message}</div> : null}

          {nlioRecords.length > 0 ? (
            <div className="status-card stack">
              <div className="two-column">
                <div>
                  <strong>Document No</strong>
                  <br />
                  {nlioRecords[0].documentno}
                </div>
                <div>
                  <strong>Owner</strong>
                  <br />
                  {nlioRecords[0].name1 || '-'}
                </div>
                <div>
                  <strong>Contact No</strong>
                  <br />
                  {nlioRecords[0].contact_no || '-'}
                </div>
                <div>
                  <strong>Date Interment</strong>
                  <br />
                  {nlioRecords[0].date_interment || '-'}
                </div>
              </div>
              <div>
                <strong>Occupants</strong>
                <ul className="list">
                  {nlioRecords.map((record, index) => (
                    <li key={`${record.documentno}-${record.occupant}-${index}`}>
                      {record.occupant || '-'}
                    </li>
                  ))}
                </ul>
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <label className="helper">Interment Date (override)</label>
                  <input
                    className="input"
                    value={intermentDate}
                    onChange={(e) => setIntermentDate(e.target.value)}
                    placeholder="e.g. May 25, 2026"
                  />
                </div>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <label className="helper">Interment Time (override)</label>
                  <input
                    className="input"
                    value={intermentTime}
                    onChange={(e) => setIntermentTime(e.target.value)}
                    placeholder="e.g. 2:00 PM"
                  />
                </div>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <label className="helper">Mass Time (override)</label>
                  <input
                    className="input"
                    value={massTime}
                    onChange={(e) => setMassTime(e.target.value)}
                    placeholder="e.g. 1:00 PM"
                  />
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#888' }}>
                Schedule overrides apply to both supplier assignments and marshal notifications — sent to Discord only, not saved to the database.
              </div>
              <div>
                <button
                  className="button"
                  type="button"
                  onClick={() => void handleNotify()}
                  disabled={notifying}
                >
                  {notifying ? 'Notifying...' : '📣 Notify Marshals'}
                </button>
              </div>
            </div>
          ) : null}

          <div className="page-card stack" style={{ padding: 18 }}>
            <h2 style={{ margin: 0 }}>Assign Supplier to NLIO</h2>

            <div>
              <label className="helper">Supplier Item</label>
              <select
                className="select"
                value={selectedItemId}
                onChange={(event) => void handleItemChange(event.target.value)}
              >
                <option value="">Select item</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.item_category} - {item.item_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="helper">Supplier</label>
              <select
                className="select"
                value={selectedSupplierKey}
                onChange={(event) => setSelectedSupplierKey(event.target.value)}
                disabled={!selectedItemId}
              >
                <option value="">Select supplier</option>
                {suppliers.map((supplier) => (
                  <option
                    key={`${supplier.bpar_i_person_id}-${supplier.s_bpartner_id}`}
                    value={`${supplier.bpar_i_person_id}|${supplier.s_bpartner_id}`}
                  >
                    {supplier.name1} - {supplier.email_add || 'No email'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="helper">Service Amount (₱)</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={serviceAmount}
                onChange={(event) => setServiceAmount(event.target.value)}
                placeholder="Auto-filled from BOQ budget (editable)"
                style={{ fontFamily: 'monospace' }}
              />
              {serviceAmount && budgetAmounts.find(b => String(b.supplier_item_id) === selectedItemId)?.budget_amount != null &&
                Number(serviceAmount) !== budgetAmounts.find(b => String(b.supplier_item_id) === selectedItemId)!.budget_amount && (
                <small style={{ color: 'var(--color-warning, #b45309)', fontSize: '0.72rem' }}>
                  ⚠ Amount differs from BOQ budget (₱{budgetAmounts.find(b => String(b.supplier_item_id) === selectedItemId)?.budget_amount?.toLocaleString()})
                </small>
              )}
            </div>

            {/* "Assigned By" is auto-set to the logged-in user — hidden from the form. */}
            <div style={{ display: 'none' }}>
              <label className="helper">Assigned By</label>
              <input
                className="input"
                value={assignedBy}
                readOnly
                aria-hidden
              />
            </div>

            <div>
              <button
                className="button secondary"
                type="button"
                onClick={() => void handleAssign()}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Assign Supplier'}
              </button>
            </div>
          </div>

          <div className="page-card stack" style={{ padding: 18 }}>
            <h2 style={{ margin: 0 }}>Current NLIO Assignments</h2>

            {assignments.length === 0 ? (
              <div className="status-card">No assignments found.</div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>bpar_i_person_id</th>
                      <th>s_bpartner_id</th>
                      <th>Item</th>
                      <th>Category</th>
                      <th>Assigned By</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map((assignment) => (
                      <tr key={assignment.id}>
                        <td>{assignment.bpar_i_person_id}</td>
                        <td>{assignment.s_bpartner_id}</td>
                        <td>{assignment.item_name || '-'}</td>
                        <td>{assignment.item_category || '-'}</td>
                        <td>{assignment.assigned_by || '-'}</td>
                        <td>
                          <button
                            className="button danger small"
                            type="button"
                            onClick={() => void handleDelete(assignment.id)}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
