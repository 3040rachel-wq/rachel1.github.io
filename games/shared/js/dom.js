// Minimal DOM helpers — no framework, just enough sugar to keep the
// per-game render.js files readable.

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (v === true) {
      node.setAttribute(k, '');
    } else {
      node.setAttribute(k, v);
    }
  }
  for (const c of [].concat(children)) {
    if (c === null || c === undefined) continue;
    node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(c) : c);
  }
  return node;
}

export function svg(tag, attrs = {}, children = []) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined) continue;
    node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c) node.appendChild(c);
  }
  return node;
}

export function qs(sel, root = document) {
  return root.querySelector(sel);
}

export function qsa(sel, root = document) {
  return [...root.querySelectorAll(sel)];
}

export function on(target, ev, handler, opts) {
  target.addEventListener(ev, handler, opts);
  return () => target.removeEventListener(ev, handler, opts);
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}
