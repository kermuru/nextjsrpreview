'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DriverPreview,
  DriverRunResult,
  previewDriver,
  runDriver,
} from '@/services/interment-lio-driver';
import { SAMPLES } from '@/services/interment-lio-driver-samples';

/**
 * Interment driver runner — fire one ERP driver with a hand-written payload.
 *
 * The agent's normal path to a driver goes through a whole case: raise it,
 * answer it, weigh it, approve it. That is the right amount of ceremony for a
 * remedy an AI proposed, and far too much for an operator who already knows
 * which document to raise and only needs the ERP to accept it.
 *
 * TWO STEPS, NOT ONE. Preview validates the payload and shows the exact URL and
 * body that would be sent; it has no code path to the executor and cannot write
 * under any configuration. Run really fires it, and against test-executor that
 * means a real, correctly formed document on the replica.
 *
 * The payload is an editable textarea rather than a generated form on purpose:
 * these modules take nested objects (occupancies, projectStandards,
 * projectDetails) whose shape differs per module, and a form that guessed at
 * them would be wrong more often than the JSON you already have.
 */
export default function IntermentLioDriverPage() {
  const [driver, setDriver] = useState('executor_lio');
  const [sampleKey, setSampleKey] = useState(SAMPLES[0].key);
  const [raw, setRaw] = useState(() => JSON.stringify(SAMPLES[0].payload, null, 2));
  const [runBy, setRunBy] = useState('');

  const [preview, setPreview] = useState<DriverPreview | null>(null);
  const [result, setResult] = useState<DriverRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'preview' | 'run' | null>(null);
  const [confirming, setConfirming] = useState(false);

  const parsed = useMemo<{ args: Record<string, unknown> | null; problem: string | null }>(() => {
    try {
      const v = JSON.parse(raw);
      if (typeof v !== 'object' || v === null || Array.isArray(v)) {
        return { args: null, problem: 'The payload must be a JSON object.' };
      }
      // Keys starting with _ are the sample's own annotations, not driver args.
      const args = Object.fromEntries(
        Object.entries(v as Record<string, unknown>).filter(([k]) => !k.startsWith('_')),
      );
      return { args, problem: null };
    } catch (e) {
      return { args: null, problem: e instanceof Error ? e.message : 'Invalid JSON.' };
    }
  }, [raw]);

  const doPreview = useCallback(async () => {
    if (!parsed.args) return;
    setBusy('preview');
    setError(null);
    try {
      setPreview(await previewDriver(driver, parsed.args));
    } catch (e) {
      setPreview(null);
      setError(e instanceof Error ? e.message : 'Preview failed.');
    } finally {
      setBusy(null);
    }
  }, [driver, parsed.args]);

  const doRun = useCallback(async () => {
    if (!parsed.args) return;
    setConfirming(false);
    setBusy('run');
    setError(null);
    try {
      setResult(await runDriver(driver, parsed.args, runBy || undefined));
    } catch (e) {
      // The backend answers a refusal with 4xx and a message; apiRequest throws
      // on it. Show it in the result dialog rather than losing it.
      setResult({
        ok: false,
        sent: false,
        documentno: null,
        error: e instanceof Error ? e.message : 'Run failed.',
        data: null,
      });
    } finally {
      setBusy(null);
    }
  }, [driver, parsed.args, runBy]);

  const willReallySend = !!preview && preview.executor_mode === 'http' && !preview.dry_run_only;

  // Editing the payload after a preview makes that preview a description of
  // something else. Drop it rather than leave a stale panel reassuring anyone.
  useEffect(() => { setPreview(null); }, [raw, driver]);

  function loadSample(key: string) {
    const s = SAMPLES.find((x) => x.key === key);
    if (!s) return;
    setSampleKey(key);
    setRaw(JSON.stringify(s.payload, null, 2));
    setResult(null);
    setError(null);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-xl font-semibold text-slate-900">Interment driver runner</h1>
      <p className="mt-1 max-w-3xl text-sm text-slate-600">
        Fires one registered ERP driver with the payload below. No case, no approval — which is why
        it stays off unless someone has deliberately enabled it on the backend.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <label className="block sm:col-span-3">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Load a sample <span className="font-normal text-slate-400">— replaces the payload below</span>
          </span>
          <select
            value={sampleKey}
            onChange={(e) => loadSample(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {SAMPLES.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </label>

        <label className="block sm:col-span-1">
          <span className="mb-1 block text-sm font-medium text-slate-700">Driver</span>
          <input
            value={driver}
            onChange={(e) => setDriver(e.target.value.trim())}
            className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Run by <span className="font-normal text-slate-400">— written to the log</span>
          </span>
          <input
            value={runBy}
            onChange={(e) => setRunBy(e.target.value)}
            placeholder="your name"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <label className="mt-4 block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Payload (JSON)</span>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={20}
          spellCheck={false}
          className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs leading-relaxed"
        />
      </label>
      <p className="mt-1 text-xs text-slate-400">
        Keys beginning with <code>_</code> are stripped before sending — the samples use them for
        their own notes.
      </p>

      {parsed.problem ? (
        <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {parsed.problem}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={doPreview}
          disabled={!parsed.args || busy !== null}
          className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-40"
        >
          {busy === 'preview' ? 'Checking…' : 'Preview — sends nothing'}
        </button>
        <button
          onClick={() => setConfirming(true)}
          disabled={!parsed.args || busy !== null || !preview}
          title={!preview ? 'Preview first' : undefined}
          className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-40"
        >
          {busy === 'run' ? 'Running…' : 'Run the driver…'}
        </button>
        {!preview && parsed.args ? (
          <span className="text-xs text-slate-400">Preview first — it enables the run button.</span>
        ) : null}
      </div>

      {error ? (
        <p className="mt-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}

      {preview ? <PreviewPanel preview={preview} /> : null}

      {confirming && preview ? (
        <ConfirmDialog
          preview={preview}
          willReallySend={willReallySend}
          onCancel={() => setConfirming(false)}
          onConfirm={doRun}
        />
      ) : null}

      {result ? <ResultDialog result={result} onClose={() => setResult(null)} /> : null}
    </main>
  );
}

/* ── preview ─────────────────────────────────────────────────────────────── */

function PreviewPanel({ preview }: { preview: DriverPreview }) {
  return (
    <section className="mt-6 rounded-md border border-slate-200 bg-slate-50 p-4">
      <h2 className="text-sm font-semibold text-slate-800">What would be sent</h2>
      <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <Row k="URL" v={preview.url} mono />
        <Row k="Module / action" v={`${preview.module} · ${preview.action}`} mono />
        <Row
          k="Executor mode"
          v={preview.executor_mode === 'http' ? 'http — really sends' : `${preview.executor_mode} — sends nothing`}
        />
        <Row k="Driver armed" v={preview.dry_run_only ? 'no — dry_run_only' : 'yes'} />
        <Row k="Execution enabled" v={preview.enabled ? 'yes' : 'no — Run will be refused'} />
      </dl>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-medium text-slate-600">
          Payload ({Object.keys(preview.payload).length} keys)
        </summary>
        <pre className="mt-2 max-h-80 overflow-auto rounded bg-white p-3 font-mono text-xs">
          {JSON.stringify(preview.payload, null, 2)}
        </pre>
      </details>
    </section>
  );
}

/* ── confirm ─────────────────────────────────────────────────────────────── */

function ConfirmDialog({
  preview, willReallySend, onCancel, onConfirm,
}: {
  preview: DriverPreview;
  willReallySend: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Overlay onClose={onCancel} labelledBy="confirm-title">
      <h2 id="confirm-title" className="text-base font-semibold text-slate-900">
        {willReallySend ? 'This writes a real document' : 'Run the driver?'}
      </h2>

      {willReallySend ? (
        <p className="mt-2 text-sm text-slate-600">
          <span className="font-mono">{preview.module}</span> will be processed to PR on{' '}
          <span className="font-mono">{hostOf(preview.url)}</span>. For an interment order that also
          creates the WIP project, its scopes and stages, the BOQ and the LMC budgets — one action,
          many records. It cannot be undone from here; reversing it is a separate ERP document.
        </p>
      ) : (
        <p className="mt-2 text-sm text-slate-600">
          The executor is in <span className="font-mono">{preview.executor_mode}</span> mode, so the
          payload will be built and logged but <strong>nothing will be sent</strong>.
        </p>
      )}

      <dl className="mt-3 grid gap-x-6 gap-y-1 rounded bg-slate-50 p-3 text-sm sm:grid-cols-2">
        <Row k="Driver" v={preview.driver} mono />
        <Row k="Module / action" v={`${preview.module} · ${preview.action}`} mono />
      </dl>

      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className={`rounded-md px-4 py-1.5 text-sm font-medium text-white ${
            willReallySend ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-800 hover:bg-slate-700'
          }`}
        >
          {willReallySend ? 'Yes, write it' : 'Run it'}
        </button>
      </div>
    </Overlay>
  );
}

/* ── result ──────────────────────────────────────────────────────────────── */

function ResultDialog({ result, onClose }: { result: DriverRunResult; onClose: () => void }) {
  // A failure at the `pr` stage reports the draft id that was already committed
  // — the difference between "nothing happened" and "half a document is in the
  // ERP". That must not be buried inside the raw JSON.
  const committed = result.error?.match(/draft id (\d+) was already committed/i)?.[1];
  const stage = result.error?.match(/\(stage=(\w+)\)/i)?.[1];

  return (
    <Overlay onClose={onClose} labelledBy="result-title">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg font-bold ${
            result.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
          }`}
        >
          {result.ok ? '✓' : '!'}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="result-title" className="text-base font-semibold text-slate-900">
            {result.ok ? 'The driver ran' : 'The driver failed'}
          </h2>
          <p className="mt-0.5 text-sm text-slate-600">
            {result.sent
              ? 'Sent to the executor and accepted.'
              : result.ok
                ? 'Nothing was sent — the executor is in log mode.'
                : 'Nothing was written, unless the warning below says otherwise.'}
          </p>
        </div>
      </div>

      {result.documentno ? (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3">
          <div className="text-xs uppercase tracking-wide text-emerald-700">Document created</div>
          <div className="mt-0.5 font-mono text-xl font-semibold text-emerald-900">
            {result.documentno}
          </div>
          <p className="mt-1 text-xs text-emerald-800">
            An interment order also creates its WIP project and BOQ — check both before running again.
          </p>
        </div>
      ) : null}

      {result.error ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3">
          <div className="text-xs uppercase tracking-wide text-red-700">
            Error{stage ? ` — stage ${stage}` : ''}
          </div>
          <p className="mt-1 break-words text-sm text-red-900">{result.error}</p>
        </div>
      ) : null}

      {committed ? (
        <div className="mt-3 rounded-md border-2 border-amber-400 bg-amber-50 p-3">
          <div className="text-sm font-semibold text-amber-900">Needs manual cleanup</div>
          <p className="mt-1 text-sm text-amber-900">
            Draft <span className="font-mono font-semibold">{committed}</span> was committed before
            processing failed. A half-written document is sitting in the ERP — it will not disappear
            on its own, and running again will create a second one.
          </p>
        </div>
      ) : null}

      {result.data ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-medium text-slate-600">
            Full executor response
          </summary>
          <pre className="mt-2 max-h-72 overflow-auto rounded bg-slate-50 p-3 font-mono text-xs">
            {JSON.stringify(result.data, null, 2)}
          </pre>
        </details>
      ) : null}

      <div className="mt-5 flex justify-end">
        <button
          onClick={onClose}
          className="rounded-md bg-slate-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          Close
        </button>
      </div>
    </Overlay>
  );
}

/* ── shared ──────────────────────────────────────────────────────────────── */

/**
 * Modal shell. Backdrop click and Escape both close it — a dialog reporting a
 * failed ERP write is the last place to trap someone.
 */
function Overlay({
  children, onClose, labelledBy,
}: {
  children: React.ReactNode;
  onClose: () => void;
  labelledBy: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <>
      <dt className="text-slate-500">{k}</dt>
      <dd className={`text-slate-800 ${mono ? 'break-all font-mono text-xs' : ''}`}>{v}</dd>
    </>
  );
}

function hostOf(url: string): string {
  try { return new URL(url).host; } catch { return url; }
}
