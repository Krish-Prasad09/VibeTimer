import React, { useState, useEffect } from 'react';

export default function NotesWidget({ onClose }) {
  const [note, setNote] = useState(() => {
    return localStorage.getItem('flocus-notes') || "";
  });

  useEffect(() => {
    localStorage.setItem('flocus-notes', note);
  }, [note]);

  return (
    <div className="absolute bottom-20 left-0 w-80 glass-panel rounded-2xl p-4 shadow-2xl animate-fade-in border border-white/20 z-50 flex flex-col h-80 mb-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-h2 text-lg text-primary">Instant Notes</h3>
        <button onClick={onClose} className="text-on-surface-variant hover:text-primary"><span className="material-symbols-outlined">close</span></button>
      </div>
      
      <textarea 
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Brainstorm or jot down notes here..."
        className="flex-grow bg-transparent text-primary text-sm focus:outline-none resize-none no-scrollbar placeholder:text-white/30"
      />
    </div>
  );
}
