'use client';

import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { isApiError } from '@/lib/api';
import { getStatus, jobImageUrl } from '@/services/barong-editor';
import type { BarongJob, BarongStatusResponse, BarongStatus } from '@/services/barong-editor';

const C = {
  primary: '#8b6b44', active: '#0a352d', border: '#e5e7eb',
  bg: '#f9fafb', text: '#111827', muted: '#6b7280', textSub: '#374151',
  green: '#16a34a', greenBg: '#dcfce7', red: '#dc2626', redBg: '#fee2e2',
  amber: '#d97706', amberBg: '#fef3c7', blue: '#2563eb', blueBg: '#dbeafe',
};

const FONT = 'Nunito, sans-serif';

/** Idle refresh. Long enough not to hammer the API, short enough to watch a run finish. */
const POLL_MS = 10_000;

/**
 * Read-only monitor for every Barong run.
 *
 * DELIBERATELY HAS NO BUTTONS THAT SPEND.
 *
 * The sibling page (/barong-editor) drives the sheet harness: Sync, Run, Retry,
 * Reprocess. Every one of those costs a paid generation, and mixing them into a
 * view you leave open on a second monitor is how an accidental click becomes a
 * bill. This page only reads.
 *
 * Built strictly on the existing GET /status payload — no backend changes. That
 * bounds what it can show: see the note above the table for what the API does
 * not currently carry.
 */
export default function BarongMonitorPage() {
  const [data, setData] = useState<BarongStatusResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [live, setLive] = useState(true);
  const [statusFilter, setStatusFilter] = useState<BarongStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  const [lightbox, setLightbox] = useState<string | null>(null);

  const load = useCallback(() => {
    getStatus()
      .then((d) => { setData(d); setErr(null); })
      .catch((e) => setErr(isApiError(e) ? e.message : 'Could not load the monitor.'))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!live) return;
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [live, load]);

  const jobs = useMemo(() => {
    const all = data?.jobs ?? [];
    const q = query.trim().toLowerCase();
    return all.filter((j) => {
      if (statusFilter !== 'all' && j.status !== statusFilter) return false;
      if (!q) return true;
      return (j.name ?? '').toLowerCase().includes(q);
    });
  }, [data, statusFilter, query]);

  // Average only over runs that actually produced an image; a 1-second download
  // failure would otherwise drag the figure down and make edits look fast.
  const avgSeconds = useMemo(() => {
    const done = (data?.jobs ?? []).filter((j) => j.status === 'done' && j.duration_ms);
    if (!done.length) return null;
    return done.reduce((a, j) => a + (j.duration_ms ?? 0), 0) / done.length / 1000;
  }, [data]);

  return (
    <div style={{ fontFamily: FONT, background: C.bg, minHeight: '100vh', padding: 20 }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <Link href="/barong-editor" style={{ color: C.primary, fontSize: 13, textDecoration: 'none' }}>
          ← Barong Image Editor
        </Link>

        <h1 style={{ margin: '6px 0 4px', fontSize: 22, fontWeight: 800, color: C.active }}>
          Barong runs — monitor
        </h1>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: C.muted }}>
          Every edit the system has attempted, newest first. Read-only.
        </p>

        {err && (
          <div style={{ background: C.redBg, color: C.red, padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 14 }}>
            {err}
          </div>
        )}

        {/* ── Counts, doubling as status filters ────────────────────────── */}
        {data && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            {(['pending', 'processing', 'done', 'failed'] as BarongStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
                title={
                  s === 'processing'
                    ? 'Claimed by a worker. A run stuck here usually means no queue worker is draining the default queue.'
                    : undefined
                }
                style={{
                  flex: '1 1 150px', textAlign: 'left', cursor: 'pointer',
                  background: statusFilter === s ? C.active : '#fff',
                  color: statusFilter === s ? '#fff' : C.text,
                  border: `1px solid ${statusFilter === s ? C.active : C.border}`,
                  borderRadius: 10, padding: '10px 12px', font: 'inherit',
                }}
              >
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', opacity: 0.75, fontWeight: 700 }}>
                  {s}
                </div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{data.counts[s]}</div>
              </button>
            ))}
            <div style={{ flex: '1 1 150px', background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', color: C.muted, fontWeight: 700 }}>
                avg edit
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>
                {avgSeconds === null ? '—' : `${avgSeconds.toFixed(0)}s`}
              </div>
            </div>
          </div>
        )}

        {/* ── Filters ───────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search occupant name…"
            style={{
              flex: '1 1 260px', padding: '8px 10px', fontSize: 13, font: 'inherit',
              border: `1px solid ${C.border}`, borderRadius: 8, background: '#fff',
            }}
          />
          {statusFilter !== 'all' && (
            <button
              onClick={() => setStatusFilter('all')}
              style={{ cursor: 'pointer', font: 'inherit', fontSize: 12.5, fontWeight: 700, padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', color: C.textSub }}
            >
              Clear “{statusFilter}”
            </button>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: C.textSub }}>
            <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />
            Live
          </label>
        </div>

        {/* ── Runs ──────────────────────────────────────────────────────── */}
        <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, overflowX: 'auto' }}>
          {!loaded ? (
            <div style={{ padding: 20, fontSize: 13, color: C.muted }}>Loading…</div>
          ) : jobs.length === 0 ? (
            <div style={{ padding: 20, fontSize: 13, color: C.muted }}>No runs match this filter.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: C.bg, textAlign: 'left' }}>
                  {['Before', 'After', 'Run', 'Occupant', 'Garment', 'Framing', 'Took', 'When'].map((h) => (
                    <th key={h} style={{ padding: '9px 10px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', color: C.muted, borderBottom: `1px solid ${C.border}` }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => <Row key={j.id} job={j} onOpen={setLightbox} />)}
              </tbody>
            </table>
          )}
        </div>

        {data && (
          <p style={{ marginTop: 10, fontSize: 12, color: C.muted }}>
            Showing {jobs.length} of {data.jobs.length} runs · engine {data.config.model} ·
            detect {data.config.detect_mode} · arms {data.config.arms_pose} ·
            default garment {data.config.garment_default}
          </p>
        )}

        <p style={{ marginTop: 6, fontSize: 11.5, color: C.muted, lineHeight: 1.5 }}>
          Built on the existing <code>/status</code> endpoint. It does not carry the interment
          document number, whether a run came from a portal upload or the sheet harness, today&apos;s
          usage against the daily generation cap, or the queue depth — so none of those appear here.
          A run stuck on <strong>processing</strong> most often means no queue worker is draining the
          default queue.
        </p>
      </div>

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out', zIndex: 50 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        </div>
      )}
    </div>
  );
}

function Thumb({ job, type, onOpen }: { job: BarongJob; type: 'input' | 'output'; onOpen: (url: string) => void }) {
  const [broken, setBroken] = useState(false);
  const path = type === 'input' ? job.input_path : job.output_path;

  // A row that 404'd while still processing must not stay blank forever — clear
  // the flag whenever the job moves on, so the finished image gets a fresh try.
  useEffect(() => { setBroken(false); }, [job.updated_at]);

  const empty = (
    <div style={{ width: 34, height: 34, borderRadius: 6, background: C.bg, border: `1px solid ${C.border}` }} />
  );
  if (!path || broken) return empty;

  const url = jobImageUrl(job.id, type, job.updated_at);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      onError={() => setBroken(true)}
      onClick={() => onOpen(url)}
      style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 6, border: `1px solid ${C.border}`, display: 'block', cursor: 'zoom-in' }}
    />
  );
}

function Row({ job, onOpen }: { job: BarongJob; onOpen: (url: string) => void }) {
  const tone =
    job.status === 'done' ? { fg: C.green, bg: C.greenBg }
      : job.status === 'failed' ? { fg: C.red, bg: C.redBg }
        : job.status === 'processing' ? { fg: C.blue, bg: C.blueBg }
          : { fg: C.amber, bg: C.amberBg };

  return (
    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
      <td style={{ padding: '8px 10px' }}><Thumb job={job} type="input" onOpen={onOpen} /></td>
      <td style={{ padding: '8px 10px' }}><Thumb job={job} type="output" onOpen={onOpen} /></td>

      <td style={{ padding: '8px 10px' }}>
        <div style={{ display: 'inline-block', background: tone.bg, color: tone.fg, fontWeight: 700, fontSize: 11.5, padding: '2px 8px', borderRadius: 999 }}>
          {job.status}
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
          #{job.id}{job.attempts > 1 ? ` · ${job.attempts} attempts` : ''}
        </div>
        {job.error && (
          <div style={{ fontSize: 11.5, color: C.red, marginTop: 3, maxWidth: 300 }}>{job.error}</div>
        )}
      </td>

      <td style={{ padding: '8px 10px', color: C.text }}>{job.name ?? '—'}</td>

      <td style={{ padding: '8px 10px', color: C.textSub }}>
        {job.garment ?? <span style={{ color: C.muted }} title="not resolved until the run starts">—</span>}
        {job.sex && <div style={{ fontSize: 11, color: C.muted }}>{job.sex}</div>}
      </td>

      <td style={{ padding: '8px 10px', color: C.textSub, fontSize: 12 }}>
        {job.framing ?? '—'}
        {job.extended && <span style={{ color: C.muted }}> · extended</span>}
        {job.arms_cut && <span style={{ color: C.muted }}> · arms</span>}
      </td>

      <td style={{ padding: '8px 10px', color: C.textSub, fontSize: 12 }}>
        {job.duration_ms ? `${(job.duration_ms / 1000).toFixed(1)}s` : '—'}
      </td>

      <td style={{ padding: '8px 10px', color: C.muted, fontSize: 12, whiteSpace: 'nowrap' }}>
        {fmt(job.updated_at)}
      </td>
    </tr>
  );
}

/** The API returns 'YYYY-MM-DD HH:MM:SS'; Safari needs the T to parse it. */
function fmt(val: string | null): string {
  if (!val) return '—';
  const d = new Date(val.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? val : d.toLocaleString();
}
