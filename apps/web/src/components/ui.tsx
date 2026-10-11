import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'danger';
const variants: Record<Variant, string> = {
  primary: 'bg-leaf text-white hover:bg-forest',
  secondary: 'bg-white text-ink border border-line hover:bg-surface',
  danger: 'bg-danger text-white hover:opacity-90',
};

export function Button({ variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`min-h-12 rounded-lg px-5 font-semibold disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    />
  );
}

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: string; error?: string; children: ReactNode; htmlFor: string }) {
  return (
    <div className="mb-5">
      <label htmlFor={htmlFor} className="block font-semibold mb-1">
        {label}
      </label>
      {hint && (
        <p id={`${htmlFor}-hint`} className="text-sm text-ink-muted mb-2">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="text-danger text-sm mt-1">
          {error}
        </p>
      )}
    </div>
  );
}

const inputClass = 'w-full min-h-12 rounded-lg border border-line px-3 text-base bg-white';
export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ''}`} />;
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputClass} ${props.className ?? ''}`} />;
}
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`w-full rounded-lg border border-line p-3 text-base ${props.className ?? ''}`} />;
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warning' | 'success' | 'danger'; children: ReactNode }) {
  const tones = {
    info: 'bg-surface border-line',
    warning: 'bg-amber-50 border-amber-300 text-warning',
    success: 'bg-green-50 border-green-300 text-success',
    danger: 'bg-red-50 border-red-300 text-danger',
  };
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={`border rounded-lg p-4 mb-5 ${tones[tone]}`}>
      {children}
    </div>
  );
}

export function PageTitle({ children, lead }: { children: ReactNode; lead?: ReactNode }) {
  return (
    <header className="mb-6">
      <h1 className="text-3xl font-bold">{children}</h1>
      {lead && <p className="text-ink-muted mt-2">{lead}</p>}
    </header>
  );
}
