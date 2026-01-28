import React, { useState, useRef, useEffect } from 'react';
import './QuickCapture.css';

function QuickCapture({ onAdd, onClose, areas, hasFocus }) {
  const [text, setText] = useState('');
  const [area, setArea] = useState('personal');
  const [priority, setPriority] = useState('today');
  const [owner, setOwner] = useState('me');
  const inputRef = useRef(null);
  const modalRef = useRef(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Lock body scroll when modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Global ESC key handler
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [onClose]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (text.trim()) {
      onAdd({
        text: text.trim(),
        area,
        priority,
        owner
      });
    }
  };

  return (
    <div className="capture-overlay" onClick={onClose}>
      <div className="capture-modal" ref={modalRef} onClick={e => e.stopPropagation()}>
        <div className="capture-header">
          <h2>➕ הוסף משימה</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="capture-input-wrapper">
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="מה צריך לעשות?"
              className="capture-input"
            />
          </div>

          <div className="capture-options">
            {/* Priority */}
            <div className="option-group">
              <label className="option-label">עדיפות</label>
              <div className="option-buttons">
                {!hasFocus && (
                  <button
                    type="button"
                    className={`option-btn focus ${priority === 'focus' ? 'active' : ''}`}
                    onClick={() => setPriority('focus')}
                  >
                    🎯 Focus
                  </button>
                )}
                <button
                  type="button"
                  className={`option-btn ${priority === 'now' ? 'active' : ''}`}
                  onClick={() => setPriority('now')}
                >
                  עכשיו
                </button>
                <button
                  type="button"
                  className={`option-btn ${priority === 'today' ? 'active' : ''}`}
                  onClick={() => setPriority('today')}
                >
                  היום
                </button>
                <button
                  type="button"
                  className={`option-btn ${priority === 'later' ? 'active' : ''}`}
                  onClick={() => setPriority('later')}
                >
                  מאוחר
                </button>
              </div>
            </div>

            {/* Area */}
            <div className="option-group">
              <label className="option-label">תחום</label>
              <div className="option-buttons areas">
                {areas.map(a => (
                  <button
                    key={a.id}
                    type="button"
                    className={`option-btn area ${area === a.id ? 'active' : ''}`}
                    onClick={() => setArea(a.id)}
                    style={area === a.id ? { borderColor: a.color, color: a.color } : {}}
                  >
                    {a.icon}
                  </button>
                ))}
              </div>
            </div>

            {/* Owner */}
            <div className="option-group">
              <label className="option-label">מי מבצע</label>
              <div className="option-buttons">
                <button
                  type="button"
                  className={`option-btn ${owner === 'me' ? 'active' : ''}`}
                  onClick={() => setOwner('me')}
                >
                  👤 אני
                </button>
                <button
                  type="button"
                  className={`option-btn ${owner === 'pa' ? 'active' : ''}`}
                  onClick={() => setOwner('pa')}
                >
                  🤖 PA
                </button>
              </div>
            </div>
          </div>

          <div className="capture-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>
              ביטול
            </button>
            <button 
              type="submit" 
              className="submit-btn"
              disabled={!text.trim()}
            >
              הוסף
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default QuickCapture;
