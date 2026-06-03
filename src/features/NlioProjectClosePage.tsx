'use client';

import { useState } from 'react';
import { isApiError } from '@/lib/api';
import {
  verifyProjectClose,
  correctProjectClose,
  VerifyResult,
  CorrectResult,
} from '@/services/nlio-project-close';

function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: 14, height: 14,
      border: '2px solid var(--border)', borderTopColor: 'var(--muted)',
      borderRadius: '50%', animation: 'spin 0.7s linear infinite',
      verticalAlign: 'middle', marginRight: 6, flexShrink: 0,
    }} />
  );
}

function StatusPill({ status }: { status: string }) {
  const bg    = status === 'NEEDS CLOSE' ? 'var(--danger)' : 'var(--success)';
  return (
    <span style={{
      display: 'inline-block', background: bg, color: '#fff',
      borderRadius: 20, padding: '2px 10px',
      fontSize: '0.72rem', fontWeight: 700,
    }}>
      {status}
    </span>
  );
}

export default function NlioProjectClosePage() {
  const [token,         setToken]         = useState('');
  const [verifying,     setVerifying]     = useState(false);
  const [applying,      setApplying]      = useState(false);
  const [verifyResult,  setVerifyResult]  = useState<VerifyResult | null>(null);
  const [correctResult, setCorrectResult] = useState<CorrectResult | null>(null);
  const [confirmed,     setConfirmed]     = useState(false);
  const [error,         setError]         = useState('');

  async function handleVerify() {
    setError('');
    setVerifyResult(null);
    setCorrectResult(null);
    setConfirmed(false);
    if (!token.trim()) { setError('Enter the script token.'); return; }
    setVerifying(true);
    try {
      setVerifyResult(await verifyProjectClose(token.trim()));
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Verify failed.');
    } finally {
      setVerifying(false);
    }
  }

  async function handleApply() {
    setError('');
    setApplying(true);
    try {
      const result = await correctProjectClose(token.trim());
      setCorrectResult(result);
      setVerifyResult(null);
      setConfirmed(false);
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Apply failed.');
    } finally {
      setApplying(false);
    }
  }

  const needsClose = verifyResult?.needs_close ?? 0;

  return (
    <div className="page-shell plain">
      <div className="center-column" style={{ maxWidth: 860 }}>

        {/* Header */}
        <div className="page-card" style={{ marginBottom: 20 }}>
          <h1 style={{ margin: '0 0 4px', fontSize: '1.15rem', color: 'var(--accent)' }}>
            NLIO Duplicate Project Closure
          </h1>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--muted)' }}>
            Closes three orphaned / duplicate projects linked to wrong Superlativo IOs.
            Sets <code>project_status = CLOSED</code>, writes audit log to{' '}
            <code>wip_l_project_status_change</code>.
          </p>
          <div style={{ marginTop: 10, display: 'flex', gap: 16, fontSize: '0.78rem', color: 'var(--muted)' }}>
            <span>• <strong>13391</strong> — NLIO00930 Superlativo (wrong org, duplicate)</span>
            <span>• <strong>13401</strong> — NLIO00931 orphan (no linked IO)</span>
            <span>• <strong>13403</strong> — NLIO00931 Superlativo (null IO, duplicate)</span>
          </div>
        </div>

        {/* Token */}
        <div className="page-card stack" style={{ marginBottom: 16 }}>
          <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>
            Script Token
            <input
              className="input"
              type="password"
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="X-Script-Token value"
              style={{ display: 'block', marginTop: 6, fontFamily: 'monospace', width: '100%' }}
            />
          </label>
          <button className="button" onClick={handleVerify} disabled={verifying || applying}>
            {verifying && <Spinner />}
            {verifying ? 'Verifying…' : 'Step 1 — Verify'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="status-card error" style={{ marginBottom: 16, fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        {/* Verify result */}
        {verifyResult && (
          <div className="page-card stack" style={{ marginBottom: 16 }}>
            <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0, fontSize: '0.95rem' }}>Verification Result</h2>
              <span style={{
                background: needsClose > 0 ? '#fff3cd' : '#d4edda',
                color:      needsClose > 0 ? '#856404' : '#155724',
                borderRadius: 20, padding: '3px 12px',
                fontSize: '0.75rem', fontWeight: 700,
              }}>
                {needsClose > 0 ? `${needsClose} need${needsClose === 1 ? 's' : ''} closing` : 'All Closed'}
              </span>
            </div>

            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)' }}>
              {verifyResult.hint}
            </p>

            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ fontSize: '0.78rem' }}>
                <thead>
                  <tr>
                    <th>Project ID</th>
                    <th>Project Name</th>
                    <th style={{ textAlign: 'center' }}>Current Status</th>
                    <th style={{ textAlign: 'center' }}>Org</th>
                    <th>Doc No</th>
                    <th>Deceased</th>
                    <th>Applicant</th>
                    <th style={{ textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {verifyResult.rows.map(r => (
                    <tr key={r.wip_i_project_id}>
                      <td style={{ color: 'var(--muted)' }}>{r.wip_i_project_id}</td>
                      <td style={{ maxWidth: 200, wordBreak: 'break-word', fontSize: '0.72rem' }}>{r.project_name}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          background: r.project_status === 'CLOSED' ? '#d4edda' : '#fff3cd',
                          color:      r.project_status === 'CLOSED' ? '#155724' : '#856404',
                          borderRadius: 4, padding: '2px 8px',
                          fontSize: '0.72rem', fontWeight: 700,
                        }}>
                          {r.project_status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>{r.ad_org_id}</td>
                      <td><code style={{ fontSize: '0.72rem' }}>{r.documentno ?? '—'}</code></td>
                      <td>{r.deceased ?? <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                      <td>{r.applicant ?? <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                      <td style={{ textAlign: 'center' }}><StatusPill status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {needsClose > 0 && (
              <div style={{
                background: '#fff8e6', border: '1px solid #f0c040',
                borderRadius: 8, padding: '12px 16px',
              }}>
                <label className="row" style={{ gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={e => setConfirmed(e.target.checked)}
                    style={{ marginTop: 2, flexShrink: 0 }}
                  />
                  <span style={{ fontSize: '0.82rem' }}>
                    I have reviewed the table above and confirm that {needsClose} project
                    {needsClose === 1 ? '' : 's'} should be closed.
                    These are Superlativo duplicate / orphaned projects and should not appear
                    in the project stage variance report.
                  </span>
                </label>

                <button
                  className="button"
                  style={{ marginTop: 12, background: confirmed ? 'var(--accent)' : undefined, opacity: confirmed ? 1 : 0.5 }}
                  onClick={handleApply}
                  disabled={!confirmed || applying}
                >
                  {applying && <Spinner />}
                  {applying ? 'Closing…' : 'Step 2 — Close Projects'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Result */}
        {correctResult && (
          <div className="page-card stack">
            <div className="status-card" style={{ background: '#d4edda', color: '#155724', border: '1px solid #c3e6cb' }}>
              ✓ Done — {correctResult.fixed} project{correctResult.fixed === 1 ? '' : 's'} closed.
            </div>

            <table className="table" style={{ fontSize: '0.8rem' }}>
              <thead>
                <tr>
                  <th>Project ID</th>
                  <th>Project Name</th>
                  <th style={{ textAlign: 'center' }}>Was</th>
                  <th style={{ textAlign: 'center' }}>Now</th>
                </tr>
              </thead>
              <tbody>
                {correctResult.data.map(r => (
                  <tr key={r.wip_i_project_id}>
                    <td style={{ color: 'var(--muted)' }}>{r.wip_i_project_id}</td>
                    <td style={{ fontSize: '0.72rem' }}>{r.project_name}</td>
                    <td style={{ textAlign: 'center', color: 'var(--danger)', fontWeight: 700 }}>{r.was_status}</td>
                    <td style={{ textAlign: 'center', color: 'var(--success)', fontWeight: 700 }}>{r.now_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
