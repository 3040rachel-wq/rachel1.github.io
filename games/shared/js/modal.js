import { el } from './dom.js';

// showModal({ title, message, actions: [{label, primary, onClick}] })
// Used identically by every game for win/lose/help dialogs.
export function showModal({ title, message, actions = [], extra = null }) {
  const overlay = el('div', { class: 'modal-overlay' });
  const close = () => overlay.remove();

  const actionsEl = el(
    'div',
    { class: 'modal-actions' },
    actions.map((a) =>
      el('button', {
        class: a.primary ? 'btn btn-primary' : 'btn btn-secondary',
        text: a.label,
        onClick: () => {
          close();
          a.onClick && a.onClick();
        },
      })
    )
  );

  const children = [
    el('button', { class: 'modal-close', 'aria-label': 'Close', text: '✕', onClick: close }),
    el('h2', { class: 'modal-title', text: title }),
  ];
  if (message) children.push(el('p', { class: 'modal-message', text: message }));
  if (extra) children.push(extra);
  children.push(actionsEl);

  const modal = el('div', { class: 'modal' }, children);
  overlay.appendChild(modal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  document.body.appendChild(overlay);
  return { close };
}

export function toast(message) {
  const node = el('div', { class: 'toast', text: message });
  document.body.appendChild(node);
  requestAnimationFrame(() => node.classList.add('show'));
  setTimeout(() => {
    node.classList.remove('show');
    setTimeout(() => node.remove(), 300);
  }, 1800);
}
