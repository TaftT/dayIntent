import { Modal } from './Modal.jsx'
import { Button } from './Button.jsx'

// Small yes/no dialog (instead of window.confirm, which blocks the page and
// can't be styled).
export function ConfirmModal({ title, message, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel }) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      width={380}
      footer={
        <>
          <Button variant="subtle" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="confirm-message">{message}</p>
    </Modal>
  )
}
