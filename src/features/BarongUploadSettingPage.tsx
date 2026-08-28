'use client';

import Link from 'next/link';
import React, { useCallback, useEffect, useState } from 'react';
import { isApiError } from '@/lib/api';
import { getUserName } from '@/lib/auth';
import { getBarongSetting, updateBarongSetting } from '@/services/barong-editor';
import type { BarongSetting } from '@/services/barong-editor';

const C = {
  primary: '#8b6b44', active: '#0a352d', border: '#e5e7eb',
  bg: '#f9fafb', text: '#111827', muted: '#6b7280', textSub: '#374151',
  green: '#16a34a', greenBg: '#dcfce7', red: '#dc2626', redBg: '#fee2e2',
  amber: '#d97706', amberBg: '#fef3c7',
};

const FONT = 'Nunito, sans-serif';

/**
 * The on-upload toggle for the Barong editor.
 *
 * Turning it on means every portrait a family uploads is re-dressed by AI, and
 * the generated version — not the photo they sent — is what the lapida engraver
 * and the video livestreaming supplier receive. That deserves a confirmation and
 * plainly-worded consequences, not a bare switch, which is why both live here.
 */
export default function BarongUploadSettingPage() {
  const [setting, setSetting] = useState<BarongSetting | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    getBarongSetting()
      .then(setSetting)
      .catch((e) => setErr(isApiError(e) ? e.message : 'Could not load the setting.'));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function flip(field: 'dress_on_upload' | 'archive_to_drive', next: boolean) {
    if (!setting) return;

    // Only the consequential direction asks. Turning things OFF is always safe:
    // it stops spending and stops replacing photos.
    if (field === 'dress_on_upload' && next) {
      const proceed = window.confirm(
        'Turn ON automatic re-dressing for new uploads?\n\n'
        + '• Every portrait a family uploads becomes a paid AI image generation\n'
        + '• The DRESSED photo replaces what the lapida engraver and video livestreaming supplier receive\n'
        + '• The family\'s original is always kept and can be restored per photo\n\n'
        + 'Photos already uploaded are not affected — this applies from the next upload onward.',
      );
      if (!proceed) return;
    }

    setBusy(field); setOk(null); setErr(null);
    try {
      const r = await updateBarongSetting({ [field]: next }, getUserName() || undefined);
      setSetting(r.data);
      setOk(r.message);
    } catch (e) {
      setErr(isApiError(e) ? e.message : 'Could not save the setting.');
    } finally {
      setBusy(null);
    }
  }

  const on = setting?.dress_on_upload === true;

  return (
    <div style={{ fontFamily: FONT, padding: 24, maxWidth: 780, margin: '0 auto' }}>
      <div style={{ marginBottom: 18 }}>
        <Link href="/" style={{ fontSize: 12, color: C.muted, textDecoration: 'none' }}>‹ Home</Link>
        <h1 style={{ margin: '6px 0 4px', fontSize: 22, fontWeight: 800, color: C.active }}>
          Barong Editor — Uploaded Photos
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: C.muted }}>
          What happens to a portrait when a family uploads it through the portal.
        </p>
      </div>

      {err && <Banner tone="err">{err}</Banner>}
      {ok && <Banner tone="ok">{ok}</Banner>}

      {!setting ? (
        <p style={{ fontSize: 13, color: C.muted }}>Loading…</p>
      ) : (
        <>
          <Row
            title="Re-dress uploads automatically"
            detail={
              on
                ? 'On — uploads are dressed in Barong or Filipiniana, and the dressed photo is what suppliers receive.'
                : 'Off — uploads stay exactly as the family sent them, and that is what suppliers receive.'
            }
            checked={on}
            busy={busy === 'dress_on_upload'}
            onChange={(v) => flip('dress_on_upload', v)}
          />

          <Row
            title="Archive to Google Drive"
            detail={
              setting.archive_to_drive
                ? `On — the supplier-facing photo (${on ? 'dressed' : 'raw'}) is copied to Drive.`
                : 'Off — nothing is copied to Drive.'
            }
            checked={setting.archive_to_drive}
            busy={busy === 'archive_to_drive'}
            onChange={(v) => flip('archive_to_drive', v)}
          />

          <div style={{
            marginTop: 18, padding: '12px 14px', borderRadius: 8, fontSize: 12.5,
            background: on ? C.amberBg : C.bg, color: on ? C.amber : C.textSub,
            border: `1px solid ${C.border}`,
          }}>
            <strong>Right now:</strong> {setting.effect}
          </div>

          <p style={{ marginTop: 14, fontSize: 12, color: C.muted }}>
            Changing this affects <strong>new uploads only</strong> — photos already uploaded are
            untouched. Whichever way this is set, an individual photo can always be dressed or
            restored by hand, and the family&apos;s original is never overwritten.
            {setting.updated_by && <> Last changed by {setting.updated_by}.</>}
          </p>
        </>
      )}
    </div>
  );
}

function Row({
  title, detail, checked, busy, onChange,
}: {
  title: string; detail: string; checked: boolean; busy: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16, padding: '16px 0',
      borderBottom: `1px solid ${C.border}`,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{title}</div>
        <div style={{ marginTop: 3, fontSize: 12.5, color: C.muted }}>{detail}</div>
      </div>

      <button
        role="switch"
        aria-checked={checked}
        aria-label={title}
        disabled={busy}
        onClick={() => onChange(!checked)}
        style={{
          position: 'relative', width: 52, height: 28, flexShrink: 0,
          borderRadius: 999, border: 'none', cursor: busy ? 'wait' : 'pointer',
          background: checked ? C.green : '#cbd5e1', opacity: busy ? 0.6 : 1,
          transition: 'background 0.15s ease',
        }}
      >
        <span style={{
          position: 'absolute', top: 3, left: checked ? 27 : 3,
          width: 22, height: 22, borderRadius: '50%', background: '#fff',
          transition: 'left 0.15s ease',
        }} />
      </button>
    </div>
  );
}

function Banner({ tone, children }: { tone: 'ok' | 'err'; children: React.ReactNode }) {
  const map = { ok: { bg: C.greenBg, fg: C.green }, err: { bg: C.redBg, fg: C.red } }[tone];
  return (
    <div style={{
      background: map.bg, color: map.fg, padding: '10px 14px', borderRadius: 8,
      fontSize: 13, fontWeight: 700, marginBottom: 14,
    }}>
      {children}
    </div>
  );
}
