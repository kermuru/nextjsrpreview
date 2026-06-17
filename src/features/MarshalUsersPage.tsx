'use client';

import { useEffect, useState } from 'react';
import { isApiError } from '@/lib/api';
import {
  createMarshalUser,
  deleteMarshalUser,
  getMarshalUsers,
  toggleMarshalUser,
} from '@/services/marshal-discord-users';
import type { MarshalDiscordUser } from '@/types/api';

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        border: '2px solid #bfdbfe',
        borderTopColor: '#1d4ed8',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
        verticalAlign: 'middle',
        flexShrink: 0,
      }}
    />
  );
}

export default function MarshalUsersPage() {
  const [marshals, setMarshals] = useState<MarshalDiscordUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [newDiscordId, setNewDiscordId] = useState('');
  const [newName, setNewName] = useState('');

  useEffect(() => {
    void loadMarshals();
  }, []);

  async function loadMarshals() {
    setLoading(true);
    setError('');
    try {
      const data = await getMarshalUsers();
      setMarshals(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load marshals.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!newDiscordId.trim() || !newName.trim()) {
      setError('Both Discord User ID and Name are required.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const created = await createMarshalUser({
        discord_user_id: newDiscordId.trim(),
        name: newName.trim(),
      });
      setMarshals((prev) => [...prev, created]);
      setNewDiscordId('');
      setNewName('');
      setMessage('Marshal added successfully.');
    } catch (err) {
      setError(isApiError(err) ? err.message : err instanceof Error ? err.message : 'Failed to add marshal.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(id: number) {
    setActionId(id);
    setError('');
    setMessage('');
    try {
      const updated = await toggleMarshalUser(id);
      setMarshals((prev) => prev.map((m) => (m.id === id ? updated : m)));
    } catch (err) {
      setError(isApiError(err) ? err.message : err instanceof Error ? err.message : 'Failed to toggle marshal.');
    } finally {
      setActionId(null);
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Remove ${name} from the marshal list?`)) return;
    setActionId(id);
    setError('');
    setMessage('');
    try {
      await deleteMarshalUser(id);
      setMarshals((prev) => prev.filter((m) => m.id !== id));
      setMessage('Marshal removed.');
    } catch (err) {
      setError(isApiError(err) ? err.message : err instanceof Error ? err.message : 'Failed to remove marshal.');
    } finally {
      setActionId(null);
    }
  }

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .marshal-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .marshal-table th { text-align: left; padding: 8px 12px; border-bottom: 2px solid var(--color-border, #e5e7eb); font-weight: 600; color: #6b7280; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; }
        .marshal-table td { padding: 10px 12px; border-bottom: 1px solid var(--color-border, #f3f4f6); vertical-align: middle; }
        .marshal-table tr:last-child td { border-bottom: none; }
        .badge-active { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 600; background: #dcfce7; color: #16a34a; }
        .badge-inactive { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 600; background: #f3f4f6; color: #9ca3af; }
        .btn-sm { padding: 4px 10px; font-size: 12px; border-radius: 6px; border: none; cursor: pointer; font-weight: 500; }
        .btn-toggle { background: #eff6ff; color: #1d4ed8; }
        .btn-toggle:hover { background: #dbeafe; }
        .btn-danger-sm { background: #fee2e2; color: #dc2626; }
        .btn-danger-sm:hover { background: #fecaca; }
        .discord-id-cell { font-family: monospace; font-size: 12px; color: #4b5563; }
      `}</style>

      <div className="page-shell plain">
        <div className="center-column">
          <div className="page-card wide stack">

            <div className="row between">
              <h1 style={{ margin: 0 }}>Marshal Discord Users</h1>
            </div>

            <p style={{ margin: 0, color: '#6b7280', fontSize: 13 }}>
              Marshals listed here are added to every interment Discord thread and mentioned when a new order is notified.
            </p>

            {error   ? <div className="status-card error">{error}</div>   : null}
            {message ? <div className="status-card success">{message}</div> : null}

            {/* ── Add form ── */}
            <div className="page-card stack" style={{ padding: 18 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Add Marshal</h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="helper">Discord User ID</label>
                  <input
                    className="input"
                    value={newDiscordId}
                    onChange={(e) => setNewDiscordId(e.target.value)}
                    placeholder="e.g. 1501014571438047324"
                  />
                </div>
                <div>
                  <label className="helper">Name</label>
                  <input
                    className="input"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Juan Dela Cruz"
                  />
                </div>
              </div>

              <div className="row">
                <button
                  className="button"
                  type="button"
                  onClick={() => void handleAdd()}
                  disabled={saving}
                >
                  {saving ? <><Spinner size={13} />&nbsp;Adding...</> : 'Add Marshal'}
                </button>
              </div>
            </div>

            {/* ── Table ── */}
            <div className="page-card" style={{ padding: 0, overflow: 'hidden' }}>
              {loading ? (
                <div style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 10, color: '#1d4ed8', fontSize: 13 }}>
                  <Spinner /> Loading marshals...
                </div>
              ) : marshals.length === 0 ? (
                <div style={{ padding: 24, color: '#6b7280', fontSize: 13, textAlign: 'center' }}>
                  No marshals configured yet.
                </div>
              ) : (
                <table className="marshal-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Discord User ID</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {marshals.map((m) => (
                      <tr key={m.id}>
                        <td style={{ fontWeight: 500 }}>{m.name}</td>
                        <td className="discord-id-cell">{m.discord_user_id}</td>
                        <td>
                          <span className={m.is_active ? 'badge-active' : 'badge-inactive'}>
                            {m.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              className="btn-sm btn-toggle"
                              type="button"
                              onClick={() => void handleToggle(m.id)}
                              disabled={actionId === m.id}
                            >
                              {actionId === m.id ? <Spinner size={11} /> : m.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              className="btn-sm btn-danger-sm"
                              type="button"
                              onClick={() => void handleDelete(m.id, m.name)}
                              disabled={actionId === m.id}
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
