import React, { useState, useEffect } from 'react';

export default function TodoWidget({ onClose }) {
  const [tasks, setTasks] = useState(() => {
    const saved = localStorage.getItem('flocus-tasks');
    return saved ? JSON.parse(saved) : [];
  });
  const [newTask, setNewTask] = useState("");

  useEffect(() => {
    localStorage.setItem('flocus-tasks', JSON.stringify(tasks));
  }, [tasks]);

  const addTask = (e) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    setTasks([...tasks, { id: Date.now(), text: newTask, completed: false }]);
    setNewTask("");
  };

  const toggleTask = (id) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const deleteTask = (id) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  return (
    <div className="absolute bottom-20 left-0 w-80 glass-panel rounded-2xl p-4 shadow-2xl animate-fade-in border border-white/20 z-50 flex flex-col mb-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-h2 text-lg text-primary">Tasks</h3>
        <button onClick={onClose} className="text-on-surface-variant hover:text-primary"><span className="material-symbols-outlined">close</span></button>
      </div>
      
      <div className="flex-grow max-h-60 overflow-y-auto mb-4 space-y-2 no-scrollbar">
        {tasks.map(task => (
          <div key={task.id} className="flex items-center justify-between group">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => toggleTask(task.id)}>
              <span className={`material-symbols-outlined ${task.completed ? 'text-primary' : 'text-on-surface-variant'}`}>
                {task.completed ? 'check_circle' : 'radio_button_unchecked'}
              </span>
              <span className={`text-sm ${task.completed ? 'line-through text-on-surface-variant' : 'text-primary'}`}>{task.text}</span>
            </div>
            <button onClick={() => deleteTask(task.id)} className="opacity-0 group-hover:opacity-100 text-on-surface-variant hover:text-error transition-opacity">
              <span className="material-symbols-outlined text-[18px]">delete</span>
            </button>
          </div>
        ))}
        {tasks.length === 0 && <p className="text-sm text-on-surface-variant text-center mt-4">No tasks yet.</p>}
      </div>

      <form onSubmit={addTask} className="flex gap-2">
        <input 
          type="text" 
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          placeholder="Add a task..." 
          className="flex-grow bg-black/30 border border-white/20 rounded-md px-3 py-2 text-primary text-sm focus:outline-none focus:border-white/40"
        />
        <button type="submit" className="bg-white/20 text-primary p-2 rounded-md hover:bg-white/30 transition-colors">
          <span className="material-symbols-outlined text-[20px]">add</span>
        </button>
      </form>
    </div>
  );
}
