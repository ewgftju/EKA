export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
}
export function glyph(name, cls = '') {
  return '<svg class="ico ' + cls + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="./assets/icons.svg#' + name + '"></use></svg>'
}
export function iconBox(name, tone, size = '') {
  return '<span class="icon-box tone-' + tone + ' ' + size + '">' + glyph(name) + '</span>'
}
export function empty(label, detail = '', icon = 'Inbox') {
  return '<div class="empty-state">' + iconBox(icon, 'slate') + '<strong>' + esc(label) + '</strong>' + (detail ? '<p>' + esc(detail) + '</p>' : '') + '</div>'
}
export function brand() {
  return '<span class="brand-mark"><img src="./assets/saq-mark.svg" width="42" height="42" alt=""></span><span class="brand-type"><b>SAQ</b><small>Smart Audit Qazaqstan</small></span>'
}
export function plural(n, one, few, many) {
  const dec = n % 100, last = n % 10
  return dec >= 11 && dec <= 14 ? many : last === 1 ? one : last >= 2 && last <= 4 ? few : many
}
