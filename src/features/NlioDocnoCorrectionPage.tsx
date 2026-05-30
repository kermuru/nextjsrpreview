'use client';

import { useState } from 'react';
import { isApiError } from '@/lib/api';
import {
  verifyDocnoCorrection,
  applyDocnoCorrection,
  DocnoVerifyResult,
  DocnoCorrectResult,
} from '@/services/nlio-docno-correction';

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

function Field({ label, value, highlight }: { label: string; value: string | number | null; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 12, fontSize: '0.82rem', alignItems: 'baseline' }}>
      <span style={{ color: 'var(--muted)', minWidth: 220, flexShrink: 0 }}>{label}</span>
      <code
        style={{
          fontFamily: 'monospace',
          background: highlight ? '#fff3cd' : 'var(--surface)',
          padding: '1px 6px',
          borderRadius: 4,
          fontWeight: highlight ? 700 : 400,
          color: highlight ? '#856404' : undefined,
        }}
      >
        {value === null || value === undefined ? '(null)' : String(value)}
      </code>
    </div>
  );
}

export default function NlioDocnoCorrectionPage() {
  const [token,         setToken]         = useState('');
  const [verifying,     setVerifying]     = useState(false);
  const [applying,      setApplying]      = useState(false);
  const [verifyResult,  setVerifyResult]  = useState<DocnoVerifyResult | null>(null);
  const [correctResult, setCorrectResult] = useState<DocnoCorrectResult | null>(null);
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
      const result = await verifyDocnoCorrection(token.trim());
      setVerifyResult(result);
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
      const result = await applyDocnoCorrection(token.trim());
      setCorrectResult(result);
      setVerifyResult(null);
      setConfirmed(false);
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Apply failed.');
    } finally {
      setApplying(false);
    }
  }

  const needsFix = verifyResult && !verifyResult.already_fixed;

  return (
    <div className="page-shell plain">
      <div className="center-column" style={{ maxWidth: 680 }}>

        {/* Header */}
        <div className="page-card" style={{ marginBottom: 20 }}>
          <h1 style={{ margin: '0 0 4px', fontSize: '1.15rem', color: 'var(--accent)' }}>
            NLIO Document Number Correction
          </h1>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--muted)' }}>
            Renames duplicate IO (ID 1865) from <code>NLIO00931</code> → <code>NLIO00934-CA</code>.
            Updates <code>mp_t_interment_order</code> and <code>doc_t_reference_number</code>.
          </p>
        </div>

        {/* Token input */}
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

          <button
            className="button"
            onClick={handleVerify}
            disabled={verifying || applying}
          >
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
              <span
                style={{
                  background: verifyResult.already_fixed ? '#d4edda' : '#fff3cd',
                  color: verifyResult.already_fixed ? '#155724' : '#856404',
                  borderRadius: 20,
                  padding: '3px 12px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}
              >
                {verifyResult.already_fixed ? 'Already Fixed' : 'Needs Fix'}
              </span>
            </div>

            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)' }}>
              {verifyResult.hint}
            </p>

            <div className="stack" style={{ gap: 6 }}>
              <Field label="IO ID"                          value={verifyResult.current.mp_t_interment_order_id} />
              <Field label="Deceased"                       value={verifyResult.current.deceased} />
              <Field label="IO Active"                      value={verifyResult.current.is_active ?? 'null'} />
              <Field label="Current documentno"             value={verifyResult.current.documentno}    highlight={needsFix ?? false} />
              <Field label="Document No DR (stub)"          value={verifyResult.current.documentno_dr} />
              <Field label="Document No PR (ref)"           value={verifyResult.current.documentno_pr} highlight={needsFix ?? false} />
            </div>

            {needsFix && verifyResult.proposed && (
              <div style={{
                background: '#fff8e6',
                border: '1px solid #f0c040',
                borderRadius: 8,
                padding: '12px 16px',
              }}>
                <p style={{ margin: '0 0 10px', fontSize: '0.82rem', fontWeight: 600 }}>
                  Proposed changes:
                </p>
                <div className="stack" style={{ gap: 6, marginBottom: 12 }}>
                  {Object.entries(verifyResult.proposed).map(([field, value]) => (
                    <Field key={field} label={field} value={value} highlight />
                  ))}
                </div>

                <label className="row" style={{ gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={e => setConfirmed(e.target.checked)}
                    style={{ marginTop: 2, flexShrink: 0 }}
                  />
                  <span style={{ fontSize: '0.82rem' }}>
                    I confirm the deceased is <strong>{verifyResult.current.deceased}</strong> and
                    this record should be renamed from <strong>NLIO00931</strong> to <strong>NLIO00934-CA</strong>.
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
              ✓ Done — IO {correctResult.after.mp_t_interment_order_id} renamed to {correctResult.after.documentno}.
            </div>

            <div className="row" style={{ gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <h3 style={{ margin: '0 0 10px', fontSize: '0.85rem', color: 'var(--muted)' }}>BEFORE</h3>
                <div className="stack" style={{ gap: 6 }}>
                  <Field label="documentno" value={correctResult.before.documentno} />
                  <Field label="is_active"  value={correctResult.before.is_active ?? 'null'} />
                </div>
              </div>

              <div style={{ fontSize: '1.4rem', alignSelf: 'center', color: 'var(--muted)' }}>→</div>

              <div style={{ flex: 1, minWidth: 240 }}>
                <h3 style={{ margin: '0 0 10px', fontSize: '0.85rem', color: 'var(--muted)' }}>AFTER</h3>
                <div className="stack" style={{ gap: 6 }}>
                  <Field label="documentno"    value={correctResult.after.documentno} />
                  <Field label="documentno_dr" value={correctResult.after.documentno_dr} />
                  <Field label="documentno_pr" value={correctResult.after.documentno_pr} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
