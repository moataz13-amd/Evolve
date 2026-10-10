import { X } from 'lucide-react';
import { SizeTable } from '../SizeTable';

export function SizeGuideDialog({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Size guide"
        onClick={(event) => event.stopPropagation()}
      >
        <button autoFocus className="modal-close" aria-label="Close size guide" onClick={onClose}>
          <X />
        </button>
        <h2>Find your fit.</h2>
        <p>Sample body measurements in centimeters.</p>
        <SizeTable />
        <p>Between sizes? Choose the larger size for a more relaxed fit.</p>
      </div>
    </div>
  );
}
