'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiRequest, isApiError } from '@/lib/api';

interface StubRow {
  doc_i_stub_id: number;
  prefix: string;
  suffix: string | null;
  currentno: number;
  stubto: number;
  length: number;
  ad_org_id: number;
  is_active: 0 | 1;
  date_updated: string;
  doc_i_submod_id: number;
  is_draft: 0 | 1;
  next_docno: string;
}

interface VerifyResponse {
  ok: boolean;
  stub: StubRow;
  hint: string;
}

interface CorrectResponse {
  ok: boolean;
  rows_affected: number;
  previous_currentno: number;
  new_currentno: number;
  stub_after: {
    doc_i_stub_id: number;
    prefix: string;
    currentno: number;
    stubto: number;
    next_docno: string;
  };
}

export default function NlioStubCorrectionPage() {
  const [token, setToken]         = useState('');
  const [stub, setStub]           = useState<StubRow | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [targetNo, setTargetNo]           = useState('');
  const [correcting, setCorrecting]       = useState(false);
  const [correctResult, setCorrectResult] = useState<CorrectResponse | null>(null);
  const [correctError, setCorrectError]   = useState<string | null>(null);

  const headers = { 'X-Script-Token': token };

  async function handleVerify() {
    setVerifying(true);
    setVerifyError(null);
    setStub(null);
    setCorrectResult(null);
    setCorrectError(null);
    try {
      const res = await apiRequest<VerifyResponse>('/script/nlio/verify', { headers });
      setStub(res.stub);
    } catch (e) {
      setVerifyError(isApiError(e) ? e.message : 'Failed to reach the server.');
    } finally {
      setVerifying(false);
    }
  }

  async function handleCorrect() {
    if (!stub) return;
    const target = parseInt(targetNo, 10);
    if (!target || target <= stub.currentno) {
      setCorrectError(`Target must be greater than the current value (${stub.currentno}).`);
      return;
    }
    setCorrecting(true);
    setCorrectError(null);
    setCorrectResult(null);
    try {
      const res = await apiRequest<CorrectResponse>('/script/nlio/correct', {
        method: 'POST',
        body: JSON.stringify({ expected_currentno: stub.currentno, target_currentno: target }),
        headers,
      });
      setCorrectResult(res);
      setStub((prev) => prev ? { ...prev, currentno: res.new_currentno } : prev);
    } catch (e) {
      setCorrectError(isApiError(e) ? e.message : 'Correction failed.');
    } finally {
      setCorrecting(false);
    }
  }

  return (
    <div className="page-shell plain">
      <div className="center-column">

        <div style={{ marginBottom: '16px' }}>
          <Link href="/" className="button ghost small">← Back</Link>
        </div>

        <div className="page-card narrow stack">
          <div>
            <h1 style={{ margin: '0 0 4px' }}>NLIO Stub Correction</h1>
            <p className="muted" style={{ margin: 0 }}>
              Advances the NLIO document number counter in <code>doc_i_stub</code>.
              Run Step 1 first, verify the values, then run Step 2.
            </p>
          </div>

          {/* ── TOKEN ── */}
          <div className="status-card" style={{ border: '1px solid var(--border)' }}>
            <label><strong>Script Token</strong></label>
            <p className="helper" style={{ margin: '2px 0 8px' }}>
              Required for both steps. Ask your senior for the token value.
            </p>
            <input
              className="input"
              type="password"
              placeholder="Enter token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </div>

          {/* ── STEP 1 ── */}
          <div className="status-card" style={{ border: '1px solid var(--border)' }}>
            <div className="row between" style={{ marginBottom: stub ? '16px' : 0 }}>
              <div>
                <strong>Step 1 — Verify</strong>
                <p className="helper" style={{ margin: '2px 0 0' }}>
                  Read-only. Confirms the current counter value before making any changes.
                </p>
              </div>
              <button
                className="button small"
                onClick={handleVerify}
                disabled={verifying || !token}
              >
                {verifying ? 'Checking…' : 'Verify'}
              </button>
            </div>

            {verifyError && (
              <p className="error-text" style={{ margin: 0 }}>{verifyError}</p>
            )}

            {stub && (
              <div className="table-wrap" style={{ marginTop: '12px' }}>
                <table className="table">
                  <tbody>
                    <tr><th>Stub ID</th><td>{stub.doc_i_stub_id}</td></tr>
                    <tr><th>Prefix</th><td>{stub.prefix}</td></tr>
                    <tr><th>Current No</th><td><strong>{stub.currentno}</strong></td></tr>
                    <tr><th>Next Docno</th><td><span className="pill">{stub.next_docno}</span></td></tr>
                    <tr><th>Stub Range</th><td>{stub.currentno} – {stub.stubto}</td></tr>
                    <tr><th>Last Updated</th><td className="muted">{stub.date_updated}</td></tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── STEP 2 ── */}
          {!stub ? (
            <div className="status-card" style={{ border: '1px solid var(--border)', opacity: 0.45 }}>
              <strong>Step 2 — Correct</strong>
              <p className="helper" style={{ margin: '2px 0 0' }}>Run Step 1 first to enable this step.</p>
            </div>
          ) : (
            <div className="status-card" style={{ border: '1px solid var(--border)' }}>
              <strong>Step 2 — Correct</strong>
              <p className="helper" style={{ margin: '2px 0 12px' }}>
                Only runs if the live counter matches the expected value.
              </p>

              <div className="stack" style={{ gap: '10px' }}>
                <div>
                  <label className="helper">Expected current no (from Step 1)</label>
                  <input
                    className="input"
                    type="number"
                    value={stub.currentno}
                    readOnly
                    style={{ background: '#f4f4f4', cursor: 'not-allowed' }}
                  />
                </div>
                <div>
                  <label className="helper">Target current no (new value)</label>
                  <input
                    className="input"
                    type="number"
                    placeholder="e.g. 934"
                    value={targetNo}
                    onChange={(e) => {
                      setTargetNo(e.target.value);
                      setCorrectError(null);
                      setCorrectResult(null);
                    }}
                  />
                </div>

                {correctError && (
                  <p className="error-text" style={{ margin: 0 }}>{correctError}</p>
                )}

                {correctResult && (
                  <div className="status-card success" style={{ padding: '12px' }}>
                    <strong>Counter advanced successfully.</strong>
                    <p style={{ margin: '4px 0 0' }}>
                      {correctResult.previous_currentno} → <strong>{correctResult.new_currentno}</strong>
                      &nbsp;· rows affected: {correctResult.rows_affected}
                    </p>
                    <p className="helper" style={{ margin: '4px 0 0' }}>
                      Next docno: <strong>{correctResult.stub_after.next_docno}</strong>
                    </p>
                  </div>
                )}

                <button
                  className="button danger"
                  onClick={handleCorrect}
                  disabled={correcting || !targetNo}
                >
                  {correcting ? 'Applying…' : 'Apply Correction'}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
