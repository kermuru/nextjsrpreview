'use client';

import Link from 'next/link';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { isApiError } from '@/lib/api';
import {
  getStatus, syncSheet, processNext, dispatchPending, retryStuck, reprocess, jobImageUrl,
} from '@/services/barong-editor';
import type { BarongJob, BarongCounts, BarongConfig, BarongStatus } from '@/services/barong-editor';

const C = {
  primary: '#8b6b44', active: '#0a352d', border: '#e5e7eb',
  bg: '#f9fafb', text: '#111827', muted: '#6b7280', textSub: '#374151',
  green: '#16a34a', greenBg: '#dcfce7', red: '#dc2626', redBg: '#fee2e2',
  amber: '#d97706', amberBg: '#fef3c7', blue: '#2563eb', blueBg: '#dbeafe',
};

const FONT = 'Nunito, sans-serif';

const TH: React.CSSProperties = {
  padding: '9px 12px', textAlign: 'left', fontSize: 10, fontWeight: 800,
  textTransform: 'uppercase', letterSpacing: '0.07em', color: C.muted,
  background: C.bg, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
};
const TD = (extra?: React.CSSProperties): React.CSSProperties => ({
  padding: '10px 12px', fontSize: 13, color: C.text, verticalAlign: 'middle', ...extra,
});

const TONE: Record<BarongStatus, { bg: string; fg: string }> = {
  pending:    { bg: C.amberBg, fg: C.amber },
  processing: { bg: C.blueBg,  fg: C.blue  },
  done:       { bg: C.greenBg, fg: C.green },
  failed:     { bg: C.redBg,   fg: C.red   },
};

const EMPTY_COUNTS: BarongCounts = { pending: 0, processing: 0, done: 0, failed: 0 };

/** Idle poll interval — paused while the page is driving the queue itself. */
const POLL_MS = 4000;

function fmtWhen(val: string | null) {
  if (!val) return '—';
  const d = new Date(val.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return val;
  return d.toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtDuration(ms: number | null) {
  if (!ms) return '—';
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function Spinner({ size = 12 }: { size?: number }) {
  return (
    <span
      style={{
        display: 'inline-block', width: size, height: size, verticalAlign: -1,
        border: `2px solid ${C.border}`, borderTopColor: C.blue, borderRadius: '50%',
        animation: 'be-spin 0.7s linear infinite',
      }}
    />
  );
}

function Badge({ status }: { status: BarongStatus }) {
  const tone = TONE[status];
  return (
    <span style={{
      background: tone.bg, color: tone.fg, borderRadius: 999, padding: '3px 9px',
      fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>
      {status}
    </span>
  );
}

const GARMENT_LABEL: Record<string, string> = { barong: 'Barong', filipiniana: 'Filipiniana' };

/** Garment chip. Until a job runs, `garment` is null — the sheet's sex value is all we have. */
function GarmentTag({ job }: { job: BarongJob }) {
  if (!job.garment && !job.sex) return null;
  const resolved = job.garment ? GARMENT_LABEL[job.garment] ?? job.garment : null;
  const female = job.garment === 'filipiniana';
  return (
    <span
      title={job.sex ? `sheet sex: ${job.sex}` : 'no sex value in the sheet — using the default garment'}
      style={{
        marginLeft: 6, padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 800,
        textTransform: 'uppercase', letterSpacing: '0.05em',
        background: female ? '#fae8ff' : '#f1f5f9', color: female ? '#a21caf' : C.textSub,
      }}
    >
      {resolved ?? `${job.sex} · pending`}
    </span>
  );
}

function Banner({ tone, children }: { tone: 'ok' | 'err' | 'warn'; children: React.ReactNode }) {
  const map = {
    ok:   { bg: C.greenBg, fg: C.green },
    err:  { bg: C.redBg,   fg: C.red   },
    warn: { bg: C.amberBg, fg: C.amber },
  }[tone];
  return (
    <div style={{ background: map.bg, color: map.fg, padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
      {children}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: BarongStatus }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff',
      border: `1px solid ${C.border}`, borderRadius: 999, padding: '6px 13px', fontSize: 12, color: C.muted,
    }}>
      {label}
      <b style={{ fontSize: 14, color: TONE[tone].fg }}>{value}</b>
    </span>
  );
}

/** Before/after cell: no stored file yet → a placeholder, never a request that 404s. */
function Thumb({ job, type, onOpen }: { job: BarongJob; type: 'input' | 'output'; onOpen: (url: string) => void }) {
  const [broken, setBroken] = useState(false);
  const path = type === 'input' ? job.input_path : job.output_path;

  // A row that 404'd while still processing must not stay "n/a" forever — clear
  // the flag whenever the job moves on, so the finished image gets a fresh try.
  useEffect(() => { setBroken(false); }, [job.updated_at]);

  const box: React.CSSProperties = {
    width: 52, height: 52, borderRadius: 6, border: `1px solid ${C.border}`, background: C.bg,
  };

  if (!path || broken) {
    return (
      <span style={{ ...box, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: C.muted }}>
        {broken ? 'n/a' : '—'}
      </span>
    );
  }

  const url = jobImageUrl(job.id, type, job.updated_at);

  return (
    <img
      src={url}
      alt={`${type} for job ${job.id}`}
      onClick={() => onOpen(url)}
      onError={() => setBroken(true)}
      style={{ ...box, objectFit: 'cover', cursor: 'zoom-in' }}
    />
  );
}

export default function BarongEditorPage() {
  const [jobs, setJobs]     = useState<BarongJob[]>([]);
  const [counts, setCounts] = useState<BarongCounts>(EMPTY_COUNTS);
  const [config, setConfig] = useState<BarongConfig | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [busy, setBusy]       = useState<string | null>(null); // which button is mid-flight
  const [running, setRunning] = useState(false);               // the live process loop
  const [note, setNote]       = useState<string | null>(null);
  const [err, setErr]         = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  // Read inside the loop so "Stop" takes effect on the next iteration (state
  // captured in the closure would stay stale for the whole run).
  const runningRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const d = await getStatus();
      setJobs(d.jobs ?? []);
      setCounts(d.counts ?? EMPTY_COUNTS);
      setConfig(d.config ?? null);
    } catch (e) {
      setErr(isApiError(e) ? e.message : 'Failed to load the job list.');
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  // Live monitor while idle. Paused during the process loop, which refreshes
  // after every job anyway.
  useEffect(() => {
    if (running) return;
    const t = setInterval(() => { void refresh(); }, POLL_MS);
    return () => clearInterval(t);
  }, [running, refresh]);

  useEffect(() => () => { runningRef.current = false; }, []); // stop the loop on unmount

  async function guard(key: string, run: () => Promise<void>) {
    setBusy(key); setErr(null); setNote(null);
    try {
      await run();
    } catch (e) {
      setErr(isApiError(e) ? e.message : 'The request failed.');
    } finally {
      setBusy(null);
    }
  }

  const handleSync = () => guard('sync', async () => {
    const r = await syncSheet();
    setNote(`Synced: +${r.created} new (${r.eligible} eligible, ${r.skipped} already queued).`);
    await refresh();
  });

  /**
   * Drain the queue from the browser, one photo at a time, so each job can be
   * watched live. Each call is a paid edit that blocks for minutes.
   */
  async function handleRun() {
    setErr(null); setNote(null);
    setRunning(true); runningRef.current = true;

    try {
      while (runningRef.current) {
        setNote('Processing the next photo… this takes 1–3 minutes per edit.');
        const r = await processNext();
        await refresh();

        if (!r.processed) { setNote('All pending photos are processed.'); break; }

        const j = r.job;
        setNote(j ? `Job #${j.id} → ${j.status}${j.error ? ` — ${j.error}` : ''}` : 'Processed.');
      }
      if (!runningRef.current) setNote('Stopped. Pending photos were left in the queue.');
    } catch (e) {
      setErr(isApiError(e) ? e.message : 'Processing stopped on a network error.');
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  }

  function handleStop() {
    runningRef.current = false;
    setNote('Stopping after the photo currently in flight…');
  }

  const handleDispatch = () => guard('dispatch', async () => {
    if (!window.confirm(
      'Hand every pending photo to the backend queue worker?\n\n'
      + 'Each one is a paid OpenAI image edit. Progress shows up here as the worker gets through them.'
    )) return;
    const r = await dispatchPending();
    setNote(`Queued ${r.dispatched} photo(s) on the worker.`);
    await refresh();
  });

  const handleRetry = () => guard('retry', async () => {
    const r = await retryStuck();
    setNote(`Requeued ${r.requeued} failed/stuck job(s) — run them with "Process pending".`);
    await refresh();
  });

  const handleReprocessAll = () => guard('reprocess', async () => {
    if (!window.confirm(
      'Re-run EVERY job, including the ones already done?\n\n'
      + 'This overwrites their outputs and pays for each edit again.'
    )) return;
    const r = await reprocess();
    setNote(`Requeued ${r.requeued} job(s) — run them with "Process pending".`);
    await refresh();
  });

  const reprocessOne = (job: BarongJob) => guard(`re-${job.id}`, async () => {
    if (!window.confirm(`Re-run job #${job.id} (${job.name ?? 'unnamed'})? This pays for another edit.`)) return;
    const r = await reprocess(job.id);
    setNote(`Requeued ${r.requeued} job(s) — run them with "Process pending".`);
    await refresh();
  });

  const disabled = running || busy !== null;

  return (
    <div style={{ fontFamily: FONT, padding: 24, maxWidth: 1180, margin: '0 auto' }}>
      <div style={{ marginBottom: 18 }}>
        <Link href="/" style={{ fontSize: 12, color: C.muted, textDecoration: 'none' }}>‹ Home</Link>
        <h1 style={{ margin: '6px 0 4px', fontSize: 22, fontWeight: 800, color: C.active }}>Barong Image Editor</h1>
        <p style={{ margin: 0, fontSize: 13, color: C.muted }}>
          Re-dresses each person in the source sheet — Barong Tagalog, or Filipiniana where the sheet&apos;s <code>sex</code> column says female.
          {config && (
            <>
              {' '}Engine <code>{config.model}</code> · rows where <code>action = {config.filter.action}</code> and{' '}
              <code>status ≠ {config.filter.status_not}</code> with a photolink · mask <code>{config.mask_mode}</code> ·
              body detect <code>{config.detect_mode}</code> · default garment <code>{config.garment_default}</code>.
            </>
          )}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <button onClick={handleSync} disabled={disabled} style={btn(C.primary)}>
          {busy === 'sync' ? <Spinner /> : null} Sync from sheet
        </button>

        {running ? (
          <button onClick={handleStop} style={btn(C.red)}>■ Stop</button>
        ) : (
          <button onClick={handleRun} disabled={disabled || counts.pending === 0} style={btn(C.active)}>
            ▶ Process pending{counts.pending ? ` (${counts.pending})` : ''}
          </button>
        )}

        <button onClick={handleDispatch} disabled={disabled || counts.pending === 0} style={btn('#fff', C.textSub)}>
          {busy === 'dispatch' ? <Spinner /> : null} Queue on worker
        </button>
        <button onClick={handleRetry} disabled={disabled} style={btn('#fff', C.textSub)}>
          {busy === 'retry' ? <Spinner /> : null} Retry failed/stuck
        </button>
        <button onClick={handleReprocessAll} disabled={disabled} style={btn('#fff', C.textSub)}>
          {busy === 'reprocess' ? <Spinner /> : null} Reprocess all
        </button>

        <span style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
          <Stat label="pending" value={counts.pending} tone="pending" />
          <Stat label="processing" value={counts.processing} tone="processing" />
          <Stat label="done" value={counts.done} tone="done" />
          <Stat label="failed" value={counts.failed} tone="failed" />
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
        {err && <Banner tone="err">{err}</Banner>}
        {note && <Banner tone="ok">{running ? <><Spinner /> {note}</> : note}</Banner>}
        {running && (
          <Banner tone="warn">
            Keep this tab open — the browser is driving the queue one photo at a time.
            Use “Queue on worker” instead to let the backend finish them unattended.
          </Banner>
        )}
      </div>

      <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflowX: 'auto', background: '#fff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 940 }}>
          <thead>
            <tr>
              <th style={TH}>#</th>
              <th style={TH}>Name</th>
              <th style={TH}>Status</th>
              <th style={TH}>Before</th>
              <th style={TH}>After</th>
              <th style={TH}>Source</th>
              <th style={TH}>Detail</th>
              <th style={TH}>Took</th>
              <th style={TH}>Updated</th>
              <th style={TH} />
            </tr>
          </thead>
          <tbody>
            {!loaded && (
              <tr><td style={TD({ color: C.muted })} colSpan={10}><Spinner /> Loading…</td></tr>
            )}

            {loaded && jobs.length === 0 && (
              <tr>
                <td style={TD({ color: C.muted })} colSpan={10}>
                  No jobs yet — start with “Sync from sheet”.
                </td>
              </tr>
            )}

            {jobs.map((job) => (
              <tr key={job.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={TD({ color: C.muted })}>{job.id}</td>
                <td style={TD({ fontWeight: 700 })}>
                  {job.name || '(unnamed)'}
                  <GarmentTag job={job} />
                  {job.extended && (
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      rebuilt from {(job.framing ?? 'crop').replace(/_/g, ' ')}{job.arms_cut && ' + arms'}
                    </div>
                  )}
                </td>
                <td style={TD()}>
                  {job.status === 'processing' && <Spinner />} <Badge status={job.status} />
                  {job.attempts > 1 && <span style={{ marginLeft: 6, fontSize: 11, color: C.muted }}>×{job.attempts}</span>}
                </td>
                <td style={TD()}><Thumb job={job} type="input" onOpen={setLightbox} /></td>
                <td style={TD()}><Thumb job={job} type="output" onOpen={setLightbox} /></td>
                <td style={TD()}>
                  <a href={job.photolink} target="_blank" rel="noopener noreferrer" style={{ color: C.blue, fontSize: 12 }}>
                    link ↗
                  </a>
                </td>
                <td style={TD({ color: C.red, fontSize: 11, maxWidth: 260, whiteSpace: 'normal' })}>{job.error || ''}</td>
                <td style={TD({ color: C.muted, fontSize: 12 })}>{fmtDuration(job.duration_ms)}</td>
                <td style={TD({ color: C.muted, fontSize: 12, whiteSpace: 'nowrap' })}>{fmtWhen(job.updated_at)}</td>
                <td style={TD()}>
                  {(job.status === 'done' || job.status === 'failed') && (
                    <button onClick={() => reprocessOne(job)} disabled={disabled} style={{ ...btn('#fff', C.textSub), padding: '5px 10px', fontSize: 11 }}>
                      {busy === `re-${job.id}` ? <Spinner size={10} /> : null} Re-run
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: 14, fontSize: 12, color: C.muted }}>
        Jobs are deduplicated by photolink, so re-syncing never re-queues — or re-pays for — a photo already
        in the list. Like the original workflow this stops after the edit: nothing is written back to the sheet.
      </p>

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 30, cursor: 'zoom-out',
          }}
        >
          <img src={lightbox} alt="" style={{ maxWidth: '92vw', maxHeight: '92vh', borderRadius: 8 }} />
        </div>
      )}

      <style>{'@keyframes be-spin { to { transform: rotate(360deg); } }'}</style>
    </div>
  );
}

function btn(bg: string, fg = '#fff'): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 7, background: bg, color: fg,
    border: bg === '#fff' ? `1px solid ${C.border}` : 'none', borderRadius: 8,
    padding: '9px 15px', fontFamily: FONT, fontSize: 13, fontWeight: 700, cursor: 'pointer',
  };
}
