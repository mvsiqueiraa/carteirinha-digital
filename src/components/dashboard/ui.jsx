import { Inbox, X } from 'lucide-react';

export const inputClass =
  'h-12 w-full rounded-lg border border-app-line bg-white px-3 text-base font-bold text-app-ink outline-none focus:border-app-coral';
export const textAreaClass =
  'min-h-20 w-full rounded-lg border border-app-line bg-white px-3 py-3 text-base font-bold text-app-ink outline-none focus:border-app-coral';

export function EmptyState({ title, text, action, onAction }) {
  return (
    <div className="notebook-paper rounded-lg border border-app-line px-5 py-8 text-center shadow-note">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-app-coralSoft text-app-coralDark">
        <Inbox size={24} />
      </div>
      <h3 className="text-lg font-black">{title}</h3>
      <p className="mt-1 text-sm font-semibold text-app-muted">{text}</p>
      {action ? (
        <button className="mt-5 h-12 rounded-lg bg-app-coral px-5 font-black text-white" onClick={onAction} type="button">
          {action}
        </button>
      ) : null}
    </div>
  );
}

export function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/35 px-3 pb-3">
      <section className="mx-auto max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-app-paper shadow-soft">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-app-line bg-app-paper px-4 py-3">
          <h2 className="text-xl font-black">{title}</h2>
          <button className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-app-ink" onClick={onClose} type="button">
            <X size={20} />
          </button>
        </header>
        <div className="p-4">{children}</div>
      </section>
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-black text-app-muted">{label}</span>
      {children}
    </label>
  );
}