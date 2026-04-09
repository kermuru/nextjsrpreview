'use client';

import Link from 'next/link';

import { useEffect, useState } from 'react';
import { isApiError } from '@/lib/api';
import {
  createSupplierItem,
  deleteSupplierItem,
  getSupplierItems,
  updateSupplierItem,
} from '@/services/supplier-itemsio';
import type { SupplierItemIO } from '@/types/api';

export default function SupplierItemsPage() {
  const [items, setItems] = useState<SupplierItemIO[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [itemName, setItemName] = useState('');
  const [itemCategory, setItemCategory] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadItems() {
    try {
      setItems(await getSupplierItems());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load items.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadItems();
  }, []);

  function resetForm() {
    setEditingId(null);
    setItemName('');
    setItemCategory('');
    setIsActive(true);
  }

  async function handleSubmit() {
    if (!itemName.trim() || !itemCategory.trim()) {
      setError('Please enter item name and category.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      if (editingId) {
        const response = await updateSupplierItem(editingId, {
          item_name: itemName.trim(),
          item_category: itemCategory.trim(),
          is_active: isActive,
        });
        setMessage(response.message);
      } else {
        const response = await createSupplierItem({
          item_name: itemName.trim(),
          item_category: itemCategory.trim(),
          is_active: isActive,
        });
        setMessage(response.message);
      }

      resetForm();
      await loadItems();
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to save supplier item.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    setError('');
    setMessage('');

    try {
      const response = await deleteSupplierItem(id);
      setMessage(response.message);
      await loadItems();
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to delete supplier item.');
      }
    }
  }

  function handleEdit(item: SupplierItemIO) {
    setEditingId(item.id);
    setItemName(item.item_name);
    setItemCategory(item.item_category);
    setIsActive(Boolean(item.is_active));
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
            <h1 style={{ margin: 0 }}>Supplier Items</h1>
          </div>

          {loading ? <div className="status-card">Loading items...</div> : null}
          {error ? <div className="status-card error">{error}</div> : null}
          {message ? <div className="status-card success">{message}</div> : null}

          <div className="page-card stack" style={{ padding: 18 }}>
            <h2 style={{ margin: 0 }}>
              {editingId ? 'Edit Supplier Item' : 'Create Supplier Item'}
            </h2>

            <div>
              <label className="helper">Item Name</label>
              <input
                className="input"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="Enter item name"
              />
            </div>

            <div>
              <label className="helper">Item Category</label>
              <input
                className="input"
                value={itemCategory}
                onChange={(e) => setItemCategory(e.target.value)}
                placeholder="Services / Materials"
              />
            </div>

            <div>
              <label className="helper">Status</label>
              <select
                className="select"
                value={isActive ? '1' : '0'}
                onChange={(e) => setIsActive(e.target.value === '1')}
              >
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </select>
            </div>

            <div className="row">
              <button
                className="button"
                type="button"
                onClick={() => void handleSubmit()}
                disabled={saving}
              >
                {saving ? 'Saving...' : editingId ? 'Update Item' : 'Create Item'}
              </button>

              {editingId ? (
                <button
                  className="button secondary"
                  type="button"
                  onClick={resetForm}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </div>

          <div className="page-card stack" style={{ padding: 18 }}>
            <h2 style={{ margin: 0 }}>Supplier Item List</h2>

            {items.length === 0 ? (
              <div className="status-card">No supplier items found.</div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Item Name</th>
                      <th>Category</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.id}</td>
                        <td>{item.item_name}</td>
                        <td>{item.item_category}</td>
                        <td>{Boolean(item.is_active) ? 'Active' : 'Inactive'}</td>
                        <td>
                          <div className="row">
                            <button
                              className="button secondary small"
                              type="button"
                              onClick={() => handleEdit(item)}
                            >
                              Edit
                            </button>
                            <button
                              className="button danger small"
                              type="button"
                              onClick={() => void handleDelete(item.id)}
                            >
                              Delete
                            </button>
                          </div>
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