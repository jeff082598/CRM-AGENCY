import React from 'react';
import Modal from './Modal.jsx';

export default function ConfirmDialog({ open, title = 'Are you sure?', message, onConfirm, onCancel, confirmLabel = 'Confirm', danger = true }) {
  return (
    <Modal open={open} onClose={onCancel} title={title} width="max-w-sm">
      <p className="text-sm text-ink-600 dark:text-ink-300 mb-6">{message}</p>
      <div className="flex justify-end gap-2">
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}
