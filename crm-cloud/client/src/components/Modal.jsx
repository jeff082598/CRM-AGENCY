import React from 'react';
import { X } from 'lucide-react';

export default function Modal({ open, onClose, title, children, width = 'max-w-lg' }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4" onMouseDown={onClose}>
      <div
        className={`card w-full ${width} max-h-[90vh] overflow-y-auto p-6`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink-800 dark:text-ink-50">{title}</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700 dark:hover:text-ink-100">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
