'use client';

import { useState } from 'react';
import { isApiError } from '@/lib/api';
import {
  verifyProjectDates,
  correctProjectDates,
  VerifyResult,
  CorrectResult,
} from '@/services/nlio-project-date-correction';

const DEFAULT_DOCS = 'NLIO00932\nNLIO00933';

function parseDocNos(raw: string): string[] {
  return raw.split(/[\n,]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
}

function StatusPill({ status }: { status: string }) {
  const bg = status === 'NEEDS FIX' ? 'var(--danger)' : 'var(--success)';
  return (
    <span style={{
      display: 'inline-block', background: bg, color: '#fff',
      borderRadius: 20, padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700,
    }}>
      {status}
    </span>
  );
}

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

export default function NlioProjectDateCorrectionPage() {
  const [token,         setToken]         = useState('');
  const [docInput,      setDocInput]      = useState(DEFAULT_DOCS);
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
    const docs = parseDocNos(docInput);
    if (!docs.length) { setError('Enter at least one document number.'); return; }
    if (!token.trim()) { setError('Enter the script token.'); return; }
    setVerifying(true);
    try {
      const result = await verifyProjectDates(docs, token.trim());
      setVerifyResult(result);
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Verify failed.');
    } finally {
      setVerifying(false);
    }
  }

  async function handleApply() {
    setError('');
    const docs = parseDocNos(docInput);
    setApplying(true);
    try {
      const result = await correctProjectDates(docs, token.trim());
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
      <div className="center-column" style={{ maxWidth: 860 }}>

        {/* Header */}
        <div className="page-card" style={{ marginBottom: 20 }}>
          <h1 style={{ margin: '0 0 4px', fontSize: '1.15rem', color: 'var(--accent)' }}>
            NLIO Project Date Correction
          </h1>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--muted)' }}>
            Populates missing <code>date_start_design</code>, <code>date_end_design</code>,
            <code> date_start_budgeting</code>, <code>date_end_budgeting</code>,
            <code> date_start_impl</code>, <code>date_end_impl</code> on <code>wip_i_project</code>.
            Values are set to <strong>BOQ creation date → +30 days</strong>, mirroring the Java ERP default.
          </p>
        </div>

        {/* Input */}
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
            placeholder="NLIO00932&#10;NLIO00933"
            style={{ fontFamily: 'monospace', fontSize: '0.88rem', resize: 'vertical' }}
          />

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
                background: needsFix > 0 ? '#fff3cd' : '#d4edda',
                color: needsFix > 0 ? '#856404' : '#155724',
                borderRadius: 20, padding: '3px 12px', fontSize: '0.75rem', fontWeight: 700,
              }}>
                {needsFix > 0 ? `${needsFix} need${needsFix === 1 ? 's' : ''} fix` : 'All OK'}
              </span>
            </div>

            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)' }}>
              {verifyResult.hint}
            </p>

            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ fontSize: '0.78rem' }}>
                <thead>
                  <tr>
                    <th>Document No</th>
                    <th>Project</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                    <th style={{ textAlign: 'center' }}>BOQ Created</th>
                    <th style={{ textAlign: 'center' }}>Proposed Start</th>
                    <th style={{ textAlign: 'center' }}>Proposed End</th>
                    <th style={{ textAlign: 'center' }}>Design Start</th>
                    <th style={{ textAlign: 'center' }}>Budgeting Start</th>
                    <th style={{ textAlign: 'center' }}>Impl Start</th>
                  </tr>
                </thead>
                <tbody>
                  {verifyResult.rows.map(r => (
                    <tr key={r.wip_i_project_id}>
                      <td><code>{r.documentno}</code></td>
                      <td style={{ maxWidth: 200, wordBreak: 'break-word', fontSize: '0.72rem' }}>
                        {r.project_name}
                      </td>
                      <td style={{ textAlign: 'center' }}><StatusPill status={r.status} /></td>
                      <td style={{ textAlign: 'center', color: 'var(--muted)' }}>{r.boq_created}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{r.boq_created}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{r.proposed_end}</td>
                      <td style={{ textAlign: 'center', color: r.date_start_design ? 'var(--success)' : 'var(--danger)' }}>
                        {r.date_start_design ?? '—'}
                      </td>
                      <td style={{ textAlign: 'center', color: r.date_start_budgeting ? 'var(--success)' : 'var(--danger)' }}>
                        {r.date_start_budgeting ?? '—'}
                      </td>
                      <td style={{ textAlign: 'center', color: r.date_start_impl ? 'var(--success)' : 'var(--danger)' }}>
                        {r.date_start_impl ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {needsFix > 0 && (
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
                    I have reviewed the table above and confirm that {needsFix} project
                    {needsFix === 1 ? '' : 's'} should have their date fields populated
                    using each project's BOQ creation date.
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
              ✓ Done — {correctResult.fixed} project{correctResult.fixed === 1 ? '' : 's'} updated.
            </div>

            <table className="table" style={{ fontSize: '0.8rem' }}>
              <thead>
                <tr>
                  <th>Document No</th>
                  <th>Project</th>
                  <th style={{ textAlign: 'center' }}>Date Start</th>
                  <th style={{ textAlign: 'center' }}>Date End (+30 days)</th>
                </tr>
              </thead>
              <tbody>
                {correctResult.data.map(r => (
                  <tr key={r.wip_i_project_id}>
                    <td><code>{r.documentno}</code></td>
                    <td style={{ fontSize: '0.72rem' }}>{r.project_name}</td>
                    <td style={{ textAlign: 'center', color: 'var(--success)', fontWeight: 700 }}>{r.date_start}</td>
                    <td style={{ textAlign: 'center', color: 'var(--success)', fontWeight: 700 }}>{r.date_end}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--muted)' }}>
              Design, budgeting, and implementation date fields have been populated.
              These projects will now show dates in the project stage variance report.
            </p>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
