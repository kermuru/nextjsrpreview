'use client';

import { useEffect, useState } from 'react';
import { isApiError } from '@/lib/api';
import { getUserName } from '@/lib/auth';
import {
  deletePayeeMapping,
  listPayeeMappings,
  savePayeeMapping,
  searchPayeeCandidates,
  type PayeeCandidate,
  type PayeeDiscordMapping,
} from '@/services/prjlmc-payee-discord';

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

/** Stable key for a candidate — subject_id alone collides across the two sources. */
const keyOf = (c: PayeeCandidate) => `${c.subject_type}:${c.subject_id}`;

export default function PrjLmcPayeeDiscordPage() {
  const [mappings, setMappings] = useState<PayeeDiscordMapping[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const [term, setTerm] = useState('');
  const [results, setResults] = useState<PayeeCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const [picked, setPicked] = useState<PayeeCandidate | null>(null);
  const [discordId, setDiscordId] = useState('');
  const [discordName, setDiscordName] = useState('');
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [sharedWarning, setSharedWarning] = useState('');

  useEffect(() => {
    void loadMappings();
  }, []);

  async function loadMappings() {
    setLoadingList(true);
    setError('');
    try {
      const res = await listPayeeMappings();
      setMappings(res.data ?? []);
    } catch (err) {
      setError(readError(err, 'Failed to load the existing mappings.'));
    } finally {
      setLoadingList(false);
    }
  }

  // Search only on submit. Nothing is listed until asked for: the list behind this
  // is 24,207 people plus 927 employees, which is not a dropdown.
  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = term.trim();
    if (!q) return;

    setSearching(true);
    setError('');
    setMessage('');
    try {
      const res = await searchPayeeCandidates(q, 50);
      setResults(res.data ?? []);
      setSearched(true);
    } catch (err) {
      setError(readError(err, 'Search failed.'));
    } finally {
      setSearching(false);
    }
  }

  function choose(c: PayeeCandidate) {
    setPicked(c);
    // Pre-fill from the existing mapping so an edit starts from what is stored,
    // rather than silently blanking a value the operator meant to keep.
    setDiscordId(c.discord_user_id ?? '');
    setDiscordName(c.discord_username ?? '');
    setNotes('');
    setSharedWarning('');
    setMessage('');
    setError('');
  }

  async function save() {
    if (!picked) return;

    const id = discordId.trim();
    // Mirrors the API's own rule, so an obvious typo is caught before a round trip.
    if (!/^\d{5,25}$/.test(id)) {
      setError('A Discord user ID is all digits (17-19 of them, usually). Copy it with Developer Mode on: right-click the user, Copy User ID.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');
    setSharedWarning('');
    try {
      const res = await savePayeeMapping({
        bpar_i_person_id: picked.subject_type === 'person' ? picked.subject_id : null,
        s_bpartner_employee_id: picked.subject_type === 'employee' ? picked.subject_id : null,
        s_bpartner_id: picked.s_bpartner_id,
        display_name: picked.display_name,
        discord_user_id: id,
        discord_username: discordName.trim() || null,
        notes: notes.trim() || null,
        mapped_by: getUserName() || null,
      });

      setMessage(`Mapped ${picked.display_name ?? 'payee'} to ${id}.`);

      // Sharing one account across payees is allowed, but the operator should see
      // it happen — twelve suppliers silently sharing one id is how the previous
      // mapping table became untrustworthy.
      if (res.shared_with?.length) {
        const names = res.shared_with.map((s) => s.display_name ?? `#${s.id}`).join(', ');
        setSharedWarning(
          `Heads up: ${res.shared_with.length} other payee(s) already use this same Discord account — ${names}. That is allowed, but make sure it is intended.`,
        );
      }

      // Reflect the new state without a second round trip.
      setResults((rows) =>
        rows.map((r) =>
          keyOf(r) === keyOf(picked)
            ? { ...r, is_mapped: true, discord_user_id: id, discord_username: discordName.trim() || null }
            : r,
        ),
      );
      setPicked(null);
      setDiscordId('');
      setDiscordName('');
      setNotes('');
      await loadMappings();
    } catch (err) {
      setError(readError(err, 'Could not save the mapping.'));
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: PayeeDiscordMapping) {
    setRemovingId(row.id);
    setError('');
    setMessage('');
    try {
      await deletePayeeMapping(row.id);
      setMappings((rows) => rows.filter((r) => r.id !== row.id));
      setMessage(`Removed the mapping for ${row.display_name ?? `#${row.id}`}.`);
    } catch (err) {
      setError(readError(err, 'Could not remove the mapping.'));
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>
        Project LMC — Payee Discord Mapping
      </h1>
      <p style={{ color: '#475569', marginBottom: 20, lineHeight: 1.5 }}>
        Who to DM when a project LMC payout posts. A payee with no mapping here cannot be
        selected on the payout screen — the service order would have nowhere to go.
        Contractors and employees both belong here; employees have no BPAR person record,
        which is why they could not be mapped on the old supplier screen.
      </p>

      {error && <Banner tone="error" text={error} />}
      {message && <Banner tone="ok" text={message} />}
      {sharedWarning && <Banner tone="warn" text={sharedWarning} />}

      {/* ── Search ── */}
      <section style={card}>
        <h2 style={h2}>1. Find the payee</h2>
        <form onSubmit={runSearch} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Name or employee number — e.g. MORALES"
            style={{ ...input, flex: 1 }}
          />
          <button type="submit" disabled={searching || !term.trim()} style={btnPrimary}>
            {searching ? <Spinner /> : 'Search'}
          </button>
        </form>

        {searched && results.length === 0 && !searching && (
          <p style={{ color: '#64748b', margin: 0 }}>No one matched that. Try part of the surname.</p>
        )}

        {results.length > 0 && (
          <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
            {results.map((c) => {
              const active = picked && keyOf(picked) === keyOf(c);
              return (
                <button
                  key={keyOf(c)}
                  type="button"
                  onClick={() => choose(c)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 12px',
                    border: 'none',
                    borderBottom: '1px solid #f1f5f9',
                    background: active ? '#ecfdf5' : '#fff',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 600 }}>
                    {c.display_name ?? '(no name)'}{' '}
                    <span style={c.subject_type === 'employee' ? pillEmp : pillPerson}>
                      {c.subject_type === 'employee' ? 'EMPLOYEE' : 'BPAR'}
                    </span>
                    {c.is_mapped && <span style={pillMapped}>MAPPED</span>}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>
                    {c.subject_type === 'employee' ? 'employee' : 'person'} {c.subject_id}
                    {c.s_bpartner_id ? ` · bpartner ${c.s_bpartner_id}` : ''}
                    {c.discord_user_id ? ` · discord ${c.discord_user_id}` : ''}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Map ── */}
      <section style={{ ...card, opacity: picked ? 1 : 0.55 }}>
        <h2 style={h2}>2. Set their Discord account</h2>
        {!picked && <p style={{ color: '#64748b', margin: 0 }}>Pick someone above first.</p>}

        {picked && (
          <>
            <p style={{ margin: '0 0 12px' }}>
              Mapping <strong>{picked.display_name ?? '(no name)'}</strong>{' '}
              <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>
                ({picked.subject_type} {picked.subject_id})
              </span>
            </p>

            <label style={label}>Discord user ID</label>
            <input
              value={discordId}
              onChange={(e) => setDiscordId(e.target.value)}
              placeholder="e.g. 1488072743860699208"
              style={input}
            />

            <label style={label}>Discord username (optional, but do fill it in)</label>
            <input
              value={discordName}
              onChange={(e) => setDiscordName(e.target.value)}
              placeholder="e.g. kervin.f"
              style={input}
            />
            <p style={hint}>
              The ID is just a number, so months later nobody can tell whose account it is. The
              username is the only way to check.
            </p>

            <label style={label}>Notes (optional)</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. receives on behalf of the shop"
              style={input}
            />

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button type="button" onClick={save} disabled={saving} style={btnPrimary}>
                {saving ? <Spinner /> : 'Save mapping'}
              </button>
              <button type="button" onClick={() => setPicked(null)} disabled={saving} style={btnPlain}>
                Cancel
              </button>
            </div>
          </>
        )}
      </section>

      {/* ── Existing ── */}
      <section style={card}>
        <h2 style={h2}>
          Current mappings {loadingList && <Spinner />}
          <span style={{ fontWeight: 400, color: '#64748b', fontSize: 14 }}> ({mappings.length})</span>
        </h2>

        {!loadingList && mappings.length === 0 && (
          <p style={{ color: '#64748b', margin: 0 }}>
            Nothing mapped yet. Until someone is mapped, the payout screen&apos;s payee list will be empty.
          </p>
        )}

        {mappings.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={th}>Payee</th>
                  <th style={th}>Type</th>
                  <th style={th}>Discord</th>
                  <th style={th}>Mapped by</th>
                  <th style={th} />
                </tr>
              </thead>
              <tbody>
                {mappings.map((m) => (
                  <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={td}>
                      {m.display_name ?? '(no name)'}
                      <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#94a3b8' }}>
                        {m.bpar_i_person_id ? `person ${m.bpar_i_person_id}` : `employee ${m.s_bpartner_employee_id}`}
                      </div>
                    </td>
                    <td style={td}>
                      <span style={m.bpar_i_person_id ? pillPerson : pillEmp}>
                        {m.bpar_i_person_id ? 'BPAR' : 'EMPLOYEE'}
                      </span>
                    </td>
                    <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>
                      {m.discord_user_id}
                      {m.discord_username && (
                        <div style={{ color: '#64748b' }}>{m.discord_username}</div>
                      )}
                    </td>
                    <td style={{ ...td, color: '#64748b' }}>{m.mapped_by ?? '—'}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => remove(m)}
                        disabled={removingId === m.id}
                        style={btnDanger}
                      >
                        {removingId === m.id ? <Spinner /> : 'Remove'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Banner({ tone, text }: { tone: 'ok' | 'error' | 'warn'; text: string }) {
  const palette = {
    ok:    { bg: '#ecfdf5', border: '#a7f3d0', fg: '#065f46' },
    error: { bg: '#fef2f2', border: '#fecaca', fg: '#991b1b' },
    warn:  { bg: '#fffbeb', border: '#fde68a', fg: '#92400e' },
  }[tone];

  return (
    <div
      style={{
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        color: palette.fg,
        borderRadius: 8,
        padding: '10px 12px',
        marginBottom: 14,
        lineHeight: 1.5,
      }}
    >
      {text}
    </div>
  );
}

/** Pull a readable message off whatever was thrown. */
function readError(err: unknown, fallback: string): string {
  if (isApiError(err)) return err.message || fallback;
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}

const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  padding: 18,
  marginBottom: 18,
};
const h2: React.CSSProperties = { fontSize: 16, fontWeight: 700, margin: '0 0 12px' };
const label: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, margin: '10px 0 4px' };
const hint: React.CSSProperties = { fontSize: 12, color: '#64748b', margin: '6px 0 0', lineHeight: 1.5 };
const input: React.CSSProperties = {
  width: '100%',
  padding: '9px 11px',
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  fontSize: 14,
};
const btnPrimary: React.CSSProperties = {
  padding: '9px 16px',
  background: '#0f5132',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontWeight: 600,
  cursor: 'pointer',
};
const btnPlain: React.CSSProperties = {
  padding: '9px 16px',
  background: '#f1f5f9',
  color: '#334155',
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  cursor: 'pointer',
};
const btnDanger: React.CSSProperties = {
  padding: '5px 11px',
  background: '#fff',
  color: '#b91c1c',
  border: '1px solid #fecaca',
  borderRadius: 6,
  fontSize: 12,
  cursor: 'pointer',
};
const th: React.CSSProperties = { padding: '8px 10px', fontWeight: 600, color: '#475569' };
const td: React.CSSProperties = { padding: '9px 10px', verticalAlign: 'top' };
const pillBase: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  padding: '2px 6px',
  borderRadius: 999,
  marginLeft: 6,
  letterSpacing: 0.4,
};
const pillPerson: React.CSSProperties = { ...pillBase, background: '#eff6ff', color: '#1d4ed8' };
const pillEmp: React.CSSProperties = { ...pillBase, background: '#f5f3ff', color: '#6d28d9' };
const pillMapped: React.CSSProperties = { ...pillBase, background: '#ecfdf5', color: '#047857' };
