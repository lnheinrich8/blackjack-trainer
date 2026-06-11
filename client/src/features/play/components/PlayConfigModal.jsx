// The Play page settings modal. Empty for now — it reuses the same modal styling
// and layout as the trainer's ConfigModal (overlay click or ✕ to close).
function PlayConfigModal({ onClose }) {
    return (
        <div className="modal" onClick={onClose}>
            <div className="modal__panel" onClick={(e) => e.stopPropagation()}>
                <div className="modal__header">
                    <h2>Settings</h2>
                    <button className="modal__close" onClick={onClose} aria-label="Close">
                        ✕
                    </button>
                </div>
            </div>
        </div>
    );
}

export default PlayConfigModal;
