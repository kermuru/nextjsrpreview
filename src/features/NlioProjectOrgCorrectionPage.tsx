'use client';

import { useState } from 'react';
import { isApiError } from '@/lib/api';
import {
  verifyProjectOrgs,
  correctProjectOrgs,
  VerifyResult,
  CorrectResult,
} from '@/services/nlio-project-org-correction';

const DEFAULT_DOCS = 'NLIO00931\nNLIO00932\nNLIO00933';

function parseDocNos(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);
}

function StatusPill({ status }: { status: string }) {
  const color =
    status === 'NEEDS FIX' ? 'var(--danger)' :
    status === 'OK'        ? 'var(--success)' :
                             'var(--primary)';
  return (
    <span
      style={{
        display: 'inline-block',
        background: color,
        color: '#fff',
        borderRadius: 20,
        padding: '2px 10px',
        fontSize: '0.72rem',
        fontWeight: 700,
        letterSpacing: '0.04em',
      }}
    >
      {status}
    </span>
  );
}

function Spinner() {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 14,
        height: 14,
        border: '2px solid var(--border)',
        borderTopColor: 'var(--muted)',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
        verticalAlign: 'middle',
        marginRight: 6,
        flexShrink: 0,
      }}
    />
  );
}

export default function NlioProjectOrgCorrectionPage() {
  const [token,      setToken]      = useState('');
  const [docInput,   setDocInput]   = useState(DEFAULT_DOCS);
  const [verifying,  setVerifying]  = useState(false);
  const [applying,   setApplying]   = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [correctResult, setCorrectResult] = useState<CorrectResult | null>(null);
  const [error,      setError]      = useState('');
  const [confirmed,  setConfirmed]  = useState(false);

  async function handleVerify() {
    setError('');
    setVerifyResult(null);
    setCorrectResult(null);
    setConfirmed(false);
    const docs = parseDocNos(docInput);
    if (!docs.length) { setError('Enter at least one document number.'); return; }
    if (!token.trim()) { setError('Enter the script token.'); return; }
    setVerifying(true);
    try {
      const result = await verifyProjectOrgs(docs, token.trim());
      setVerifyResult(result);
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Verify failed.');
    } finally {
      setVerifying(false);
    }
  }

  async function handleApply() {
    setError('');
    setCorrectResult(null);
    const docs = parseDocNos(docInput);
    setApplying(true);
    try {
      const result = await correctProjectOrgs(docs, token.trim());
      setCorrectResult(result);
      setVerifyResult(null);
      setConfirmed(false);
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Apply failed.');
    } finally {
      setApplying(false);
    }
  }

  const needsFix = verifyResult?.needs_fix ?? 0;

  return (
    <div className="page-shell plain">
      <div className="center-column" style={{ maxWidth: 780 }}>

        {/* Header */}
        <div className="page-card" style={{ marginBottom: 20 }}>
          <h1 style={{ margin: '0 0 4px', fontSize: '1.15rem', color: 'var(--accent)' }}>
            NLIO Project Org Correction
          </h1>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--muted)' }}>
            Fixes <code>wip_i_project.ad_org_id</code> from 162011 → 162012 for NLIO interment
            orders whose BOQ project was created under the wrong org.
          </p>
        </div>

        {/* Input card */}
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

          <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>
            Document Numbers
            <span style={{ fontWeight: 400, color: 'var(--muted)', marginLeft: 6 }}>
              (one per line or comma-separated)
            </span>
          </label>
          <textarea
            className="textarea"
            rows={4}
            value={docInput}
            onChange={e => {
              setDocInput(e.target.value);
              setVerifyResult(null);
              setCorrectResult(null);
              setConfirmed(false);
            }}
            placeholder="NLIO00931&#10;NLIO00932&#10;NLIO00933"
            style={{ fontFamily: 'monospace', fontSize: '0.88rem', resize: 'vertical' }}
          />

          <div className="row" style={{ gap: 10 }}>
            <button
              className="button"
              onClick={handleVerify}
              disabled={verifying || applying}
            >
              {verifying && <Spinner />}
              {verifying ? 'Verifying…' : 'Step 1 — Verify'}
            </button>
          </div>
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
              <span
                style={{
                  background: needsFix > 0 ? '#fff3cd' : '#d4edda',
                  color: needsFix > 0 ? '#856404' : '#155724',
                  borderRadius: 20,
                  padding: '3px 12px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}
              >
                {needsFix > 0 ? `${needsFix} need${needsFix === 1 ? 's' : ''} fix` : 'All OK'}
              </span>
            </div>

            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)' }}>
              {verifyResult.hint}
            </p>

            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    <th>Document No</th>
                    <th>Project ID</th>
                    <th>Project Name</th>
                    <th style={{ textAlign: 'center' }}>IO Org</th>
                    <th style={{ textAlign: 'center' }}>Project Org</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {verifyResult.rows.map(r => (
                    <tr key={r.wip_i_project_id}>
                      <td><code>{r.documentno}</code></td>
                      <td style={{ color: 'var(--muted)' }}>{r.wip_i_project_id}</td>
                      <td style={{ maxWidth: 240, wordBreak: 'break-word' }}>{r.project_name}</td>
                      <td style={{ textAlign: 'center' }}>{r.io_org}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{r.project_org}</td>
                      <td style={{ textAlign: 'center' }}><StatusPill status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {needsFix > 0 && (
              <div style={{
                background: '#fff8e6',
                border: '1px solid #f0c040',
                borderRadius: 8,
                padding: '12px 16px',
              }}>
                <label className="row" style={{ gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={e => setConfirmed(e.target.checked)}
                    style={{ marginTop: 2, flexShrink: 0 }}
                  />
                  <span style={{ fontSize: '0.82rem' }}>
                    I have reviewed the table above and confirm that {needsFix} project
                    {needsFix === 1 ? '' : 's'} should be updated from org <strong>162011</strong> → <strong>162012</strong>.
                  </span>
                </label>

                <button
                  className="button"
                  style={{ marginTop: 12, background: confirmed ? 'var(--accent)' : undefined, opacity: confirmed ? 1 : 0.5 }}
                  onClick={handleApply}
                  disabled={!confirmed || applying}
                >
                  {applying && <Spinner />}
                  {applying ? 'Applying…' : 'Step 2 — Apply Fix'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Correct result */}
        {correctResult && (
          <div className="page-card stack">
            <div className="status-card" style={{ background: '#d4edda', color: '#155724', border: '1px solid #c3e6cb' }}>
              ✓ Done — {correctResult.fixed} project{correctResult.fixed === 1 ? '' : 's'} updated to org 162012.
            </div>

            <div className="row" style={{ gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {/* Before */}
              <div style={{ flex: 1, minWidth: 280 }}>
                <h3 style={{ margin: '0 0 10px', fontSize: '0.85rem', color: 'var(--muted)' }}>BEFORE</h3>
                <table className="table" style={{ fontSize: '0.78rem' }}>
                  <thead>
                    <tr>
                      <th>Document No</th>
                      <th>Project ID</th>
                      <th style={{ textAlign: 'center' }}>Org</th>
                    </tr>
                  </thead>
                  <tbody>
                    {correctResult.before.map(r => (
                      <tr key={r.wip_i_project_id}>
                        <td><code>{r.documentno}</code></td>
                        <td style={{ color: 'var(--muted)' }}>{r.wip_i_project_id}</td>
                        <td style={{ textAlign: 'center', color: 'var(--danger)', fontWeight: 700 }}>{r.project_org}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ fontSize: '1.4rem', alignSelf: 'center', color: 'var(--muted)' }}>→</div>

              {/* After */}
              <div style={{ flex: 1, minWidth: 280 }}>
                <h3 style={{ margin: '0 0 10px', fontSize: '0.85rem', color: 'var(--muted)' }}>AFTER</h3>
                <table className="table" style={{ fontSize: '0.78rem' }}>
                  <thead>
                    <tr>
                      <th>Project ID</th>
                      <th>Project Name</th>
                      <th style={{ textAlign: 'center' }}>Org</th>
                    </tr>
                  </thead>
                  <tbody>
                    {correctResult.after.map(r => (
                      <tr key={r.wip_i_project_id}>
                        <td style={{ color: 'var(--muted)' }}>{r.wip_i_project_id}</td>
                        <td style={{ maxWidth: 200, wordBreak: 'break-word', fontSize: '0.72rem' }}>{r.project_name}</td>
                        <td style={{ textAlign: 'center', color: 'var(--success)', fontWeight: 700 }}>{r.project_org}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--muted)' }}>
              The affected IOs will now appear in the 162012 project stage variance report.
            </p>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
