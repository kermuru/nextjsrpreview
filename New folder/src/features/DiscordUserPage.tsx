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

export default function DiscordUserPage() {
  const [bparOptions, setBparOptions] = useState<BparDropdownRecord[]>([]);
  const [selectedBparId, setSelectedBparId] = useState('');
  const [sBpartnerId, setSBpartnerId] = useState('');
  const [discordUserId, setDiscordUserId] = useState('');
  const [record, setRecord] = useState<BparDiscordUserIO | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function loadBparList() {
      try {
        const data = await getBparDropdownList();
        setBparOptions(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load BPAR list.');
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
    <div className="page-shell plain">
      <div className="center-column">
        <div className="page-card wide stack">
          <div className="row between">
            <h1 style={{ margin: 0 }}>Discord User Mapping</h1>
          </div>

          {loading ? <div className="status-card">Loading...</div> : null}
          {error ? <div className="status-card error">{error}</div> : null}
          {message ? <div className="status-card success">{message}</div> : null}

          <div className="page-card stack" style={{ padding: 18 }}>
            <div>
              <label className="helper">BPAR Name</label>
              <select
                className="select"
                value={selectedBparId}
                onChange={(e) => setSelectedBparId(e.target.value)}
              >
                <option value="">Select BPAR name</option>
                {/* {bparOptions.map((item) => (
                  <option key={item.bpar_i_person_id} value={item.bpar_i_person_id}>
                    {item.name1 || `BPAR ${item.bpar_i_person_id}`}
                  </option>
                ))} */}

                {bparOptions.map((item, index) => (
                <option
                    key={`${item.bpar_i_person_id}-${index}`}
                    value={item.bpar_i_person_id}
                >
                    {item.name1 || `BPAR ${item.bpar_i_person_id}`}
                </option>
                ))}
              </select>
            </div>

            <div>
              <label className="helper">bpar_i_person_id</label>
              <input
                className="input"
                value={selectedBparId}
                readOnly
                placeholder="Auto-filled"
              />
            </div>

            <div>
              <label className="helper">s_bpartner_id</label>
              <input
                className="input"
                value={sBpartnerId}
                readOnly
                placeholder="Auto-filled"
              />
            </div>

            <div>
              <label className="helper">discord_user_id</label>
              <input
                className="input"
                value={discordUserId}
                onChange={(e) => setDiscordUserId(e.target.value)}
                placeholder="Enter Discord User ID"
              />
            </div>

            <div className="row">
              <button
                className="button"
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
              >
                {saving ? 'Saving...' : record ? 'Update' : 'Save'}
              </button>

              {record ? (
                <button
                  className="button danger"
                  type="button"
                  onClick={() => void handleDelete()}
                  disabled={saving}
                >
                  Delete
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}