/*
  app.js — Student Task Manager
  Features:
  - Add/Edit/Delete tasks
  - Validation (min length, duplicates)
  - localStorage persistence
  - Real-time search & character count
  - Accessible & semantic DOM manipulation
*/

(() => {
  // Storage key
  const STORAGE_KEY = 'vit_tasks_v1';

  // DOM Elements
  const form = document.getElementById('task-form');
  const titleInput = document.getElementById('task-title');
  const descInput = document.getElementById('task-desc');
  const dueInput = document.getElementById('task-due');
  const prioritySelect = document.getElementById('task-priority');
  const btnReset = document.getElementById('btn-reset');
  const listEl = document.getElementById('task-list');
  const emptyState = document.getElementById('empty-state');
  const searchInput = document.getElementById('search');
  const titleError = document.getElementById('title-error');
  const titleCount = document.getElementById('title-count');
  const btnClearAll = document.getElementById('btn-clear-all');

  // In-memory state
  let tasks = [];
  let editId = null; // when editing, holds id of task being edited

  // Utilities
  const uid = () => 't_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);

  function saveToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }

  function loadFromStorage() {
    const raw = localStorage.getItem(STORAGE_KEY);
    tasks = raw ? JSON.parse(raw) : [];
  }

  // Validation: title required, min length, unique (case-insensitive)
  function validateTitle(value) {
    const trimmed = (value || '').trim();
    if (!trimmed) return { ok: false, msg: 'Title is required.' };
    if (trimmed.length < 3) return { ok: false, msg: 'Minimum 3 characters required.' };

    // Duplicate check: if adding new or editing a different task
    const exists = tasks.some(t => t.title.trim().toLowerCase() === trimmed.toLowerCase() && t.id !== editId);
    if (exists) return { ok: false, msg: 'A task with this title already exists.' };

    return { ok: true };
  }

  // UI helpers
  function showError(inputEl, message) {
    inputEl.classList.add('input-invalid');
    titleError.textContent = message;
  }
  function clearError(inputEl) {
    inputEl.classList.remove('input-invalid');
    titleError.textContent = '';
  }

  // Render
  function renderTasks(filter = '') {
    const q = (filter || '').trim().toLowerCase();
    listEl.innerHTML = '';

    const visible = tasks
      .filter(t => {
        if (!q) return true;
        return t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q);
      })
      .sort((a,b) => {
        // Sort by priority (high -> low) then date (soonest first)
        const pMap = { high: 0, medium: 1, low: 2 };
        if (pMap[a.priority] !== pMap[b.priority]) return pMap[a.priority] - pMap[b.priority];
        if (a.due && b.due) return new Date(a.due) - new Date(b.due);
        return b.createdAt - a.createdAt;
      });

    if (visible.length === 0) {
      emptyState.hidden = false;
      return;
    }
    emptyState.hidden = true;

    for (const task of visible) {
      const li = document.createElement('li');
      li.className = 'task-item';
      li.dataset.id = task.id;

      const meta = document.createElement('div');
      meta.className = 'task-meta';

      const titleRow = document.createElement('div');
      titleRow.className = 'task-title';

      const h3 = document.createElement('h3');
      h3.textContent = task.title;
      h3.style.margin = 0;

      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);

      titleRow.appendChild(h3);
      titleRow.appendChild(badge);

      const desc = document.createElement('p');
      desc.className = 'task-desc';
      desc.textContent = task.description || (task.due ? `Due: ${task.due}` : '');

      meta.appendChild(titleRow);
      meta.appendChild(desc);

      const actions = document.createElement('div');
      actions.className = 'task-actions';

      const btnEdit = document.createElement('button');
      btnEdit.className = 'action-btn action-edit';
      btnEdit.type = 'button';
      btnEdit.title = 'Edit task';
      btnEdit.textContent = 'Edit';
      btnEdit.addEventListener('click', () => startEdit(task.id));

      const btnDelete = document.createElement('button');
      btnDelete.className = 'action-btn action-delete';
      btnDelete.type = 'button';
      btnDelete.title = 'Delete task';
      btnDelete.textContent = 'Delete';
      btnDelete.addEventListener('click', () => deleteTask(task.id));

      actions.appendChild(btnEdit);
      actions.appendChild(btnDelete);

      li.appendChild(meta);
      li.appendChild(actions);
      listEl.appendChild(li);
    }
  }

  // Business logic
  function addTask(payload) {
    tasks.push(payload);
    saveToStorage();
    renderTasks(searchInput.value);
  }

  function updateTask(id, patch) {
    tasks = tasks.map(t => t.id === id ? { ...t, ...patch } : t);
    saveToStorage();
    renderTasks(searchInput.value);
  }

  function deleteTask(id) {
    if (!confirm('Delete this task? This cannot be undone.')) return;
    tasks = tasks.filter(t => t.id !== id);
    if (editId === id) cancelEdit();
    saveToStorage();
    renderTasks(searchInput.value);
  }

  function clearAll() {
    if (!tasks.length) return;
    if (!confirm('Clear all tasks? This will remove everything.')) return;
    tasks = [];
    saveToStorage();
    renderTasks();
  }

  // Edit flow
  function startEdit(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    editId = id;
    titleInput.value = task.title;
    descInput.value = task.description || '';
    dueInput.value = task.due || '';
    prioritySelect.value = task.priority || 'medium';
    titleInput.focus();
    document.getElementById('btn-submit').textContent = 'Update Task';
  }

  function cancelEdit() {
    editId = null;
    form.reset();
    clearError(titleInput);
    document.getElementById('btn-submit').textContent = 'Save Task';
    updateTitleCount();
  }

  // Events
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const titleVal = titleInput.value;
    const descVal = descInput.value;
    const dueVal = dueInput.value;
    const priorityVal = prioritySelect.value;

    const v = validateTitle(titleVal);
    if (!v.ok) {
      showError(titleInput, v.msg);
      return;
    }
    clearError(titleInput);

    if (editId) {
      updateTask(editId, {
        title: titleVal.trim(),
        description: descVal.trim(),
        due: dueVal || '',
        priority: priorityVal,
        updatedAt: Date.now()
      });
      cancelEdit();
    } else {
      const payload = {
        id: uid(),
        title: titleVal.trim(),
        description: descVal.trim(),
        due: dueVal || '',
        priority: priorityVal,
        createdAt: Date.now()
      };
      addTask(payload);
      form.reset();
      updateTitleCount();
    }
  });

  btnReset.addEventListener('click', () => {
    cancelEdit();
  });

  // Real-time char count + inline validation on keyup
  function updateTitleCount() {
    const len = titleInput.value.length;
    titleCount.textContent = `${len} characters`;
  }

  titleInput.addEventListener('input', () => {
    updateTitleCount();
    const v = validateTitle(titleInput.value);
    if (!v.ok) {
      // Only show when user typed something
      if (titleInput.value.trim().length > 0) showError(titleInput, v.msg);
      else clearError(titleInput);
    } else {
      clearError(titleInput);
    }
  });

  // Search tasks
  searchInput.addEventListener('input', (e) => {
    renderTasks(e.target.value);
  });

  btnClearAll.addEventListener('click', clearAll);

  // Initial load
  function init() {
    loadFromStorage();
    renderTasks();
    updateTitleCount();

    // Accessibility: allow ESC to cancel edit
    document.addEventListener('keyup', (e) => {
      if (e.key === 'Escape') cancelEdit();
    });

    // hint: keep storage in sync across tabs
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY) {
        loadFromStorage();
        renderTasks(searchInput.value);
      }
    });
  }

  // run
  init();

})();
