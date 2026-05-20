'use client';

import { useEffect, useMemo, useState } from 'react';
import { isApiError } from '@/lib/api';
import {
  createDiscordUser,
  deleteDiscordUser,
  getBparDropdownList,
  getDiscordUserByBparId,
  updateDiscordUser,
} from '@/services/discord-usersio';
import type { BparDiscordUserIO, BparDropdownRecord } from '@/types/api';

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

function SkeletonField() {
  return (
    <div
      style={{
        height: 36,
        borderRadius: 8,
        background: 'var(--color-background-secondary)',
        animation: 'pulse 1.4s ease-in-out infinite',
      }}
    />
  );
}

export default function DiscordUserPage() {
  const [bparOptions, setBparOptions] = useState<BparDropdownRecord[]>([]);
  const [selectedBparId, setSelectedBparId] = useState('');
  const [sBpartnerId, setSBpartnerId] = useState('');
  const [discordUserId, setDiscordUserId] = useState('');
  const [record, setRecord] = useState<BparDiscordUserIO | null>(null);
  const [loadingBpar, setLoadingBpar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function loadBparList() {
      setLoadingBpar(true);
      try {
        const data = await getBparDropdownList();
        setBparOptions(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load BPAR list.');
      } finally {
        setLoadingBpar(false);
      }
    }

    void loadBparList();
  }, []);

  const selectedBpar = useMemo(() => {
    if (!selectedBparId) return null;
    return (
      bparOptions.find(
        (item) => String(item.bpar_i_person_id) === selectedBparId
      ) || null
    );
  }, [selectedBparId, bparOptions]);

  useEffect(() => {
    async function loadRecord() {
      if (!selectedBparId) {
        setRecord(null);
        setSBpartnerId('');
        setDiscordUserId('');
        return;
      }

      if (selectedBpar) {
        setSBpartnerId(String(selectedBpar.s_bpartner_id ?? ''));
      }

      setLoading(true);
      setError('');
      setMessage('');

      try {
        const data = await getDiscordUserByBparId(Number(selectedBparId));
        setRecord(data);
        setDiscordUserId(data.discord_user_id);
        setSBpartnerId(String(data.s_bpartner_id ?? selectedBpar?.s_bpartner_id ?? ''));
      } catch (err) {
        setRecord(null);
        setDiscordUserId('');
        if (isApiError(err) && err.status === 404) {
          return;
        }
        if (isApiError(err)) {
          setError(err.message);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Failed to fetch Discord user record.');
        }
      } finally {
        setLoading(false);
      }
    }

    void loadRecord();
  }, [selectedBparId, selectedBpar]);

  async function handleSave() {
    if (!selectedBparId || !discordUserId.trim()) {
      setError('Please select BPAR name and enter discord_user_id.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const payload = {
        bpar_i_person_id: Number(selectedBparId),
        s_bpartner_id: sBpartnerId.trim() ? Number(sBpartnerId) : null,
        discord_user_id: discordUserId.trim(),
      };

      const response = record
        ? await updateDiscordUser(Number(selectedBparId), {
            s_bpartner_id: payload.s_bpartner_id,
            discord_user_id: payload.discord_user_id,
          })
        : await createDiscordUser(payload);

      setRecord(response.record);
      setMessage(response.message);
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to save Discord user record.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedBparId) {
      setError('Please select a BPAR name.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const response = await deleteDiscordUser(Number(selectedBparId));
      setRecord(null);
      setDiscordUserId('');
      setMessage(response.message);
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to delete Discord user record.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Keyframe animations injected once */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>

      <div className="page-shell plain">
        <div className="center-column">
          <div className="page-card wide stack">
            <div className="row between">
              <h1 style={{ margin: 0 }}>Discord User Mapping</h1>
            </div>

            {loadingBpar && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 16px',
                  borderRadius: 8,
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  border: '1px solid #bfdbfe',
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                <Spinner size={14} />
                Loading supplier list...
              </div>
            )}
            {error ? <div className="status-card error">{error}</div> : null}
            {message ? <div className="status-card success">{message}</div> : null}

            <div className="page-card stack" style={{ padding: 18 }}>

              {/* ── BPAR dropdown ── */}
              <div>
                <label className="helper">BPAR Name</label>
                <div style={{ position: 'relative' }}>
                  <select
                    className="select"
                    value={selectedBparId}
                    onChange={(e) => setSelectedBparId(e.target.value)}
                    disabled={loadingBpar}
                    style={{ opacity: loadingBpar ? 0.6 : 1 }}
                  >
                    <option value="">
                      {loadingBpar ? 'Loading BPAR list...' : 'Select BPAR name'}
                    </option>
                    {bparOptions.map((item, index) => (
                      <option
                        key={`${item.bpar_i_person_id}-${index}`}
                        value={item.bpar_i_person_id}
                      >
                        {item.name1 || `BPAR ${item.bpar_i_person_id}`}
                      </option>
                    ))}
                  </select>
                  {loadingBpar && (
                    <span style={{ position: 'absolute', right: 32, top: '50%', transform: 'translateY(-50%)' }}>
                      <Spinner />
                    </span>
                  )}
                </div>
              </div>

              {/* ── Inline "fetching record" banner ── */}
              {loading && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '12px 16px',
                    borderRadius: 8,
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    border: '1px solid #bfdbfe',
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  <Spinner size={14} />
                  Fetching Discord record for this user...
                </div>
              )}

              {/* ── bpar_i_person_id ── */}
              <div>
                <label className="helper">bpar_i_person_id</label>
                {loadingBpar
                  ? <SkeletonField />
                  : <input className="input" value={selectedBparId} readOnly placeholder="Auto-filled" />
                }
              </div>

              {/* ── s_bpartner_id ── */}
              <div>
                <label className="helper">s_bpartner_id</label>
                {loadingBpar
                  ? <SkeletonField />
                  : <input className="input" value={sBpartnerId} readOnly placeholder="Auto-filled" />
                }
              </div>

              {/* ── discord_user_id ── */}
              <div>
                <label className="helper">discord_user_id</label>
                {loadingBpar || loading ? (
                  <SkeletonField />
                ) : (
                  <input
                    className="input"
                    value={discordUserId}
                    onChange={(e) => setDiscordUserId(e.target.value)}
                    placeholder="Enter Discord User ID"
                  />
                )}
              </div>

              {/* ── Actions ── */}
              <div className="row">
                {loadingBpar || loading ? (
                  <button className="button" type="button" disabled style={{ opacity: 0.45 }}>
                    {saving ? 'Saving...' : record ? 'Update' : 'Save'}
                  </button>
                ) : (
                  <button
                    className="button"
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={saving}
                  >
                    {saving
                      ? <><Spinner size={13} /> &nbsp;Saving...</>
                      : record ? 'Update' : 'Save'
                    }
                  </button>
                )}

                {record && !loading ? (
                  <button
                    className="button danger"
                    type="button"
                    onClick={() => void handleDelete()}
                    disabled={saving}
                  >
                    {saving ? <><Spinner size={13} /> &nbsp;Deleting...</> : 'Delete'}
                  </button>
                ) : null}
              </div>

            </div>
          </div>
        </div>
      </div>
    </>
  );
}
