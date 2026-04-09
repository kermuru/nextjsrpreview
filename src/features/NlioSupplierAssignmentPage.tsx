'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { isApiError } from '@/lib/api';
import { getAssignableItems } from '@/services/supplier-item-assignments';
import {
  createNlioAssignment,
  deleteNlioAssignment,
  getAssignmentsByDocumentNo,
  getNlioByDocumentNo,
  getSuppliersByItem,
} from '@/services/nlio-supplier-assignments';
import type {
  NlioAssignmentRecord,
  NlioRecord,
  SupplierAssignableItem,
  SupplierByItemRecord,
} from '@/types/api';

export default function NlioSupplierAssignmentPage() {
  const [documentNo, setDocumentNo] = useState('');
  const [assignedBy, setAssignedBy] = useState('');
  const [items, setItems] = useState<SupplierAssignableItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierByItemRecord[]>([]);
  const [nlioRecords, setNlioRecords] = useState<NlioRecord[]>([]);
  const [assignments, setAssignments] = useState<NlioAssignmentRecord[]>([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedSupplierKey, setSelectedSupplierKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function loadItems() {
      try {
        setItems(await getAssignableItems());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load supplier items.');
      }
    }

    void loadItems();
  }, []);

  async function handleSearch() {
    if (!documentNo.trim()) {
      setError('Please enter a document number.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    setSelectedSupplierKey('');

    try {
      const [nlioData, assignmentData] = await Promise.all([
        getNlioByDocumentNo(documentNo.trim()),
        getAssignmentsByDocumentNo(documentNo.trim()),
      ]);

      setNlioRecords(nlioData);
      setAssignments(assignmentData);
    } catch (err) {
      setNlioRecords([]);
      setAssignments([]);
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
        document_no: documentNo.trim(),
        bpar_i_person_id: Number(bparId),
        s_bpartner_id: Number(partnerId),
        supplier_item_id: Number(selectedItemId),
        assigned_by: assignedBy.trim() || undefined,
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
            <h1 style={{ margin: 0 }}>NLIO Supplier Assignment</h1>
          </div>

          <div className="row">
            <div style={{ flex: 1, minWidth: 260 }}>
              <label className="helper">Document No</label>
              <input
                className="input"
                value={documentNo}
                onChange={(event) => setDocumentNo(event.target.value)}
                placeholder="Enter NLIO document number"
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'end' }}>
              <button className="button" type="button" onClick={() => void handleSearch()}>
                Search NLIO
              </button>
            </div>
          </div>

          {loading ? <div className="status-card">Loading...</div> : null}
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
              <label className="helper">Assigned By</label>
              <input
                className="input"
                value={assignedBy}
                onChange={(event) => setAssignedBy(event.target.value)}
                placeholder="Your name"
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
  );
}
