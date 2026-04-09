'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { isApiError } from '@/lib/api';
import {
  createSupplierItemAssignment,
  deleteSupplierItemAssignment,
  getAssignableItems,
  getAssignableSuppliers,
  getSelectedSupplierItems,
} from '@/services/supplier-item-assignments';
import type {
  SupplierAssignableItem,
  SupplierAssignableMapping,
  SupplierAssignableSupplier,
} from '@/types/api';

export default function SupplierItemAssignmentPage() {
  const [suppliers, setSuppliers] = useState<SupplierAssignableSupplier[]>([]);
  const [items, setItems] = useState<SupplierAssignableItem[]>([]);
  const [records, setRecords] = useState<SupplierAssignableMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selectedBparId, setSelectedBparId] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [supplierData, itemData, recordData] = await Promise.all([
          getAssignableSuppliers(),
          getAssignableItems(),
          getSelectedSupplierItems(),
        ]);

        setSuppliers(supplierData);
        setItems(itemData);
        setRecords(recordData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load supplier item assignment data.');
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const uniqueSuppliers = useMemo(() => {
    return Array.from(
      new Map(
        suppliers.map((supplier, index) => [
          `${supplier.bpar_i_person_id}-${supplier.s_bpartner_id}-${supplier.email_add ?? ''}-${supplier.contact_number ?? ''}-${index}`,
          supplier,
        ])
      ).values()
    );
  }, [suppliers]);

  const selectedSupplier = useMemo(() => {
    if (!selectedBparId) return null;

    return (
      uniqueSuppliers.find(
        (supplier) => String(supplier.bpar_i_person_id) === selectedBparId
      ) || null
    );
  }, [selectedBparId, uniqueSuppliers]);

  async function refreshRecords() {
    setRecords(await getSelectedSupplierItems());
  }

  async function handleAssign() {
    if (!selectedSupplier || !selectedItemId) {
      setError('Please select both supplier and item.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const response = await createSupplierItemAssignment({
        bpar_i_person_id: selectedSupplier.bpar_i_person_id,
        s_bpartner_id: selectedSupplier.s_bpartner_id,
        supplier_item_id: Number(selectedItemId),
      });

      setMessage(response.message);
      setSelectedItemId('');
      await refreshRecords();
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to assign item to supplier.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    setError('');
    setMessage('');

    try {
      const response = await deleteSupplierItemAssignment(id);
      setMessage(response.message);
      await refreshRecords();
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to delete supplier item assignment.');
      }
    }
  }

  return (
    <div className="page-shell plain">
      <div className="center-column">
        <div className="page-card wide stack">
            <Link
              href="/supplierio"
              style={{ backgroundColor: '#8b6b44', color: 'white', padding: '8px 12px', borderRadius: 4, textDecoration: 'none' , width: 'fit-content'}}
              >
              Menu
            </Link>
          <div className="row between">
            <h1 style={{ margin: 0 }}>Supplier Item Assignment</h1>
          </div>

          {loading ? <div className="status-card">Loading assignment data...</div> : null}
          {error ? <div className="status-card error">{error}</div> : null}
          {message ? <div className="status-card success">{message}</div> : null}

          <div className="page-card stack" style={{ padding: 18 }}>
            <h2 style={{ margin: 0 }}>Assign Item to Supplier</h2>

            <div>
              <label className="helper">Supplier</label>
              <select
                className="select"
                value={selectedBparId}
                onChange={(e) => setSelectedBparId(e.target.value)}
              >
                <option value="">Select supplier</option>
                {uniqueSuppliers.map((supplier, index) => (
                  <option
                    key={`${supplier.bpar_i_person_id}-${supplier.s_bpartner_id}-${index}`}
                    value={supplier.bpar_i_person_id}
                  >
                    {supplier.name1} - {supplier.email_add || 'No email'}
                  </option>
                ))}
              </select>
            </div>

            {selectedSupplier ? (
              <div className="status-card">
                <div className="two-column">
                  <div>
                    <strong>bpar_i_person_id</strong>
                    <br />
                    {selectedSupplier.bpar_i_person_id}
                  </div>
                  <div>
                    <strong>s_bpartner_id</strong>
                    <br />
                    {selectedSupplier.s_bpartner_id}
                  </div>
                  <div>
                    <strong>Contact</strong>
                    <br />
                    {selectedSupplier.contact_number || '-'}
                  </div>
                  <div>
                    <strong>Phone</strong>
                    <br />
                    {selectedSupplier.phone || '-'}
                  </div>
                </div>
              </div>
            ) : null}

            <div>
              <label className="helper">Supplier Item</label>
              <select
                className="select"
                value={selectedItemId}
                onChange={(event) => setSelectedItemId(event.target.value)}
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
              <button
                className="button"
                type="button"
                onClick={() => void handleAssign()}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Assign Item'}
              </button>
            </div>
          </div>

          <div className="page-card stack" style={{ padding: 18 }}>
            <h2 style={{ margin: 0 }}>Assigned Supplier Items</h2>

            {records.length === 0 ? (
              <div className="status-card">No supplier item assignments found.</div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>bpar_i_person_id</th>
                      <th>s_bpartner_id</th>
                      <th>Item</th>
                      <th>Category</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record) => (
                      <tr key={record.id}>
                        <td>{record.bpar_i_person_id}</td>
                        <td>{record.s_bpartner_id}</td>
                        <td>{record.item_name || '-'}</td>
                        <td>{record.item_category || '-'}</td>
                        <td>
                          <button
                            className="button danger small"
                            type="button"
                            onClick={() => void handleDelete(record.id)}
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
  );
}