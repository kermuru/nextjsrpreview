'use client';

export default function LoadingOverlay({ label, progress }: { label: string; progress?: number }) {
  return (
    <div className="loading-cover">
      <div className="spinner" />
      <div>{label}</div>
      {typeof progress === 'number' ? (
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      ) : null}
    </div>
  );
}
