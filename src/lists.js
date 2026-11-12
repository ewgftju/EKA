import { esc as escape, glyph } from './ui.js'
import { describeTask, describeTaskStage } from './actions.js'

const perPage = 10
const completed = new Set(['completed', 'returned', 'rejected', 'cancelled'])
const statuses = [
  ['active', 'Активные'], ['today', 'Срок сегодня'], ['late', 'Просроченные'],
  ['waiting', 'Ожидают очереди'], ['closed', 'Завершённые'], ['all', 'Все состояния']
]
const stateNames = { pending: 'В работе', waiting: 'Ожидает очереди', completed: 'Исполнено', returned: 'Возвращено', rejected: 'Отклонено', cancelled: 'Отменено' }
const tones = new Set(['blue', 'teal', 'green', 'violet', 'indigo', 'amber', 'rose', 'red', 'slate'])
const boundForms = new WeakSet()
const boundTables = new WeakSet()

function icon(name) {
  return glyph(name, 'el-icon')
}

function href(path, params) {
  const values = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== '' && value != null) values.set(key, String(value))
  }
  const query = values.toString()
  return '#/' + path + (query ? '?' + query : '')
}

function tab(path, query, name, count, selected) {
  return `<a class="el-tab${selected ? ' el-current' : ''}" href="${escape(href(path, query))}" ${selected ? 'aria-current="page"' : ''}>${name}<span>${count}</span></a>`
}

function normalized(value) {
  return String(value ?? '').normalize('NFKC').toLocaleLowerCase('ru').replaceAll('ё', 'е').trim()
}

function matches(query, words) {
  if (!query) return true
  const corpus = normalized(words.filter(value => value != null).join(' '))
  return query.split(/\s+/u).every(word => corpus.includes(word))
}

function moduleFilter(rows, modules) {
  const names = new Map(modules.map(module => [module.id, module.label || module.title]))
  const options = new Map()
  for (const row of rows) {
    if (row.module && !options.has(row.module)) options.set(row.module, row.moduleLabel || names.get(row.module) || row.module)
  }
  return [...options].sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'ru'))
}

function selectOptions(options, chosen) {
  return options.map(([id, label]) => `<option value="${escape(id)}" ${id === chosen ? 'selected' : ''}>${escape(label)}</option>`).join('')
}

function filters({ path, hidden, query, options, chosenModule, chosenStatus }) {
  const fields = Object.entries(hidden).map(([name, value]) => `<input type="hidden" name="${name}" value="${escape(value)}">`).join('')
  const modules = selectOptions([['', 'Все модули'], ...options], chosenModule)
  const status = chosenStatus ? `<label class="el-select"><span class="el-sr">Статус и срок</span><select name="status">${selectOptions(statuses, chosenStatus)}</select>${icon('ChevronDown')}</label>` : ''
  const placeholder = path === 'tasks' ? 'Действие, документ или номер' : 'Поиск по уведомлениям'
  return `<form class="el-filters" role="search" aria-label="Поиск и фильтры" data-el-path="${path}">${fields}
    <label class="el-search">${icon('Search')}<span class="el-sr">Поиск</span>
      <input type="search" name="q" placeholder="${placeholder}" value="${escape(query)}" maxlength="200" autocomplete="off">
    </label>
    <label class="el-select"><span class="el-sr">Модуль</span><select name="module">${modules}</select>${icon('ChevronDown')}</label>
    ${status}<button type="submit" class="el-find">Найти</button>
  </form>`
}

function pageOf(rows, rawPage) {
  const totalPages = Math.max(1, Math.ceil(rows.length / perPage))
  const requested = /^\d+$/u.test(rawPage ?? '') ? Number(rawPage) : 1
  const page = Math.max(1, Math.min(Number.isSafeInteger(requested) ? requested : 1, totalPages))
  const start = (page - 1) * perPage
  return { page, totalPages, start, count: rows.length, rows: rows.slice(start, start + perPage) }
}

function pagination(path, query, data) {
  if (!data.count) return ''
  const { page, totalPages, start, count } = data
  if (totalPages === 1) return `<div class="el-total">Всего записей <b>${count}</b></div>`
  const pageUrl = n => escape(href(path, { ...query, page: n }))
  const arrow = (n, label, glyph) => n < 1 || n > totalPages ?
    `<span class="el-page-arrow el-disabled" aria-hidden="true">${icon(glyph)}</span>` :
    `<a class="el-page-arrow" href="${pageUrl(n)}" aria-label="${label}">${icon(glyph)}</a>`
  const slots = [...new Set([1, page - 1, page, page + 1, totalPages])].filter(n => n >= 1 && n <= totalPages).sort((a, b) => a - b)
  const numbers = slots.map((n, index) => {
    const gap = index > 0 && n - slots[index - 1] > 1 ? '<span class="el-page-gap" aria-hidden="true">…</span>' : ''
    return `${gap}<a class="el-page-num${n === page ? ' el-current' : ''}" href="${pageUrl(n)}" aria-label="Страница ${n}" ${n === page ? 'aria-current="page"' : ''}>${n}</a>`
  }).join('')
  return `<div class="el-pager"><span>${start + 1}–${Math.min(start + perPage, count)} из ${count}</span>
    <nav class="el-pagination" aria-label="Страницы">${arrow(page - 1, 'Предыдущая страница', 'ArrowLeft')}${numbers}${arrow(page + 1, 'Следующая страница', 'ArrowRight')}</nav></div>`
}

function empty(glyph, message, url, action) {
  return `<div class="el-empty"><span class="el-empty-icon">${icon(glyph)}</span><p>${message}</p>
    ${url ? `<a href="${escape(url)}">${action}</a>` : ''}</div>`
}

function matchesStatus(row, status, today) {
  switch (status) {
    case 'active': return row.status === 'pending'
    case 'today': return row.status === 'pending' && row.dueDay === today
    case 'late': return row.status === 'pending' && row.overdue
    case 'waiting': return row.status === 'waiting'
    case 'closed': return completed.has(row.status)
    default: return true
  }
}

function taskRow(row, outgoing, today) {
  const id = escape(row.entityId)
  const documentTitle = row.docTitle || row.title
  const activeIncoming = !outgoing && row.status === 'pending'
  const title = activeIncoming
    ? row.actionTitle || describeTask(row.actionId, documentTitle).title
    : row.stageTitle || describeTaskStage(row.actionId, documentTitle)
  const state = Object.hasOwn(stateNames, row.status) ? row.status : 'unknown'
  const tone = tones.has(row.tone) ? row.tone : 'teal'
  const late = Boolean(row.dueDay) && row.status === 'pending' && row.overdue
  const dueToday = Boolean(row.dueDay) && row.status === 'pending' && row.dueDay === today
  const dueText = row.dueDay ? row.dateLabel || row.dueDay : 'Срок не установлен'
  const dueHint = late ? 'Просрочено' : dueToday && !normalized(dueText).includes('сегодня') ? 'Сегодня' : ''
  const name = outgoing ? row.recipientName : row.authorName
  return `<tr class="el-task-row">
    <td class="el-doc-col"><button class="el-document" type="button" data-document="${id}" title="Открыть документ${documentTitle ? ' «' + escape(documentTitle) + '»' : ''}">${escape(title)}</button>
      <div class="el-doc-meta">${row.number ? `<span class="el-number">${escape(row.number)}</span>` : ''}
      <span class="el-source el-tone-${tone}"><i aria-hidden="true"></i>${escape(row.moduleLabel || row.module)}</span></div></td>
    <td class="el-action-col"><span class="el-status el-state-${state}">${escape(row.statusLabel || stateNames[state] || 'Статус не указан')}</span></td>
    <td class="el-person-col"><span class="el-mobile-label">${outgoing ? 'Получатель' : 'От кого'}</span>${escape(name || '—')}</td>
    <td class="el-due-col${late ? ' el-late' : dueToday ? ' el-due-today' : !row.dueDay ? ' el-no-date' : ''}"><span class="el-due-text">${escape(dueText)}</span>${dueHint ? `<small>${dueHint}</small>` : ''}</td>
    <td class="el-end" aria-hidden="true">${icon('ChevronRight')}</td></tr>`
}

export function taskList(view, params = new URLSearchParams()) {
  const incoming = view.incoming || []
  const outgoing = view.outgoing || []
  const box = params.get('box') === 'out' ? 'out' : 'in'
  const isOut = box === 'out'
  const status = statuses.some(([value]) => value === params.get('status')) ? params.get('status') : 'all'
  const source = isOut ? outgoing : incoming
  const options = moduleFilter(source, view.modules || [])
  const requestedModule = params.get('module') || ''
  const moduleId = options.some(([id]) => id === requestedModule) ? requestedModule : ''
  const q = (params.get('q') || '').slice(0, 200).trim()
  const query = normalized(q)
  const filtered = source.filter(row => (!moduleId || row.module === moduleId) && matchesStatus(row, status, view.today) &&
    (!query || matches(query, [row.docTitle || row.title, row.number, row.moduleLabel, row.action, row.actionTitle, describeTaskStage(row.actionId, row.docTitle || row.title), row.authorName, row.recipientName, row.statusLabel])))
  const data = pageOf(filtered, params.get('page'))
  const hasFilters = Boolean(q || moduleId || status !== 'all')
  const noRows = hasFilters && source.length ?
    empty('ListFilter', 'Поручений с такими условиями нет', href('tasks', { box, status: 'all' }), 'Показать все поручения') :
    empty('Inbox', `Пока нет ${isOut ? 'отправленных' : 'входящих'} поручений`)
  const table = `<table class="el-table"><caption class="el-sr">${isOut ? 'Отправленные' : 'Входящие'} поручения</caption>
    <thead><tr><th scope="col">${isOut ? 'Действие получателя' : 'Поручение'}</th><th scope="col">Статус</th><th scope="col">${isOut ? 'Получатель' : 'От кого'}</th><th scope="col">Срок поручения</th><th aria-label="Переход"></th></tr></thead>
    <tbody>${data.rows.map(row => taskRow(row, isOut, view.today)).join('')}</tbody></table>`
  return `<section class="el-panel" aria-label="Реестр поручений"><div class="el-top"><nav class="el-tabs" aria-label="Направление поручений">
      ${tab('tasks', { box: 'in', status: 'all' }, 'Входящие', incoming.length, !isOut)}
      ${tab('tasks', { box: 'out', status: 'all' }, 'Отправленные', outgoing.length, isOut)}
    </nav></div>
    ${filters({ path: 'tasks', hidden: { box }, query: q, options, chosenModule: moduleId, chosenStatus: status })}
    ${data.count ? table : noRows}
    ${pagination('tasks', { box, status, module: moduleId, q }, data)}</section>`
}

function noticeRow(row) {
  const metadata = [row.moduleLabel || row.module, row.authorName].filter(Boolean).map(escape).join('<span aria-hidden="true">·</span>')
  return `<li><button type="button" class="el-notice${row.read ? '' : ' el-unread'}" data-notice="${escape(row.id)}">
    <span class="el-read-dot" aria-hidden="true"></span><span class="el-sr">${row.read ? 'Прочитано.' : 'Непрочитано.'}</span>
    <span class="el-notice-text"><strong>${escape(row.title || 'Уведомление')}</strong>
      ${row.body ? `<span class="el-notice-body">${escape(row.body)}</span>` : ''}
      ${metadata ? `<small class="el-notice-meta">${metadata}</small>` : ''}</span>
    <span class="el-notice-date">${escape(row.dateLabel)}</span><span class="el-notice-arrow">${icon('ChevronRight')}</span></button></li>`
}

export function noticeList(view, params = new URLSearchParams()) {
  const notices = view.notices || []
  const unread = notices.filter(row => !row.read)
  const tabId = params.get('tab') === 'all' ? 'all' : 'unread'
  const all = tabId === 'all'
  const options = moduleFilter(notices, view.modules || [])
  const requestedModule = params.get('module') || ''
  const moduleId = options.some(([id]) => id === requestedModule) ? requestedModule : ''
  const q = (params.get('q') || '').slice(0, 200).trim()
  const query = normalized(q)
  const source = all ? notices : unread
  const filtered = source.filter(row => (!moduleId || row.module === moduleId) &&
    matches(query, [row.title, row.body, row.moduleLabel, row.authorName, row.number]))
  filtered.sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0))
  const data = pageOf(filtered, params.get('page'))
  const noRows = (q || moduleId) && source.length ?
    empty('Search', 'Уведомлений с такими условиями нет', href('notifications', { tab: tabId }), 'Сбросить фильтры') :
    empty('Bell', all ? 'Уведомлений пока нет' : 'Непрочитанных уведомлений нет', !all && notices.length ? href('notifications', { tab: 'all' }) : '', 'Все уведомления')
  return `<section class="el-panel" aria-label="Лента уведомлений">
    <div class="el-top"><nav class="el-tabs" aria-label="Состояние уведомлений">
      ${tab('notifications', { tab: 'unread' }, 'Непрочитанные', unread.length, !all)}
      ${tab('notifications', { tab: 'all' }, 'Все', notices.length, all)}</nav>
      <button type="button" class="el-mark" data-read-all ${unread.length ? '' : 'disabled'}>${icon('CheckCheck')}Прочитать все</button></div>
    ${filters({ path: 'notifications', hidden: { tab: tabId }, query: q, options, chosenModule: moduleId })}
    ${data.count ? `<ul class="el-notices">${data.rows.map(noticeRow).join('')}</ul>` : noRows}
    ${pagination('notifications', { tab: tabId, module: moduleId, q }, data)}</section>`
}

export function bindLists(root) {
  const forms = root.matches?.('form[data-el-path]') ? [root] : root.querySelectorAll('form[data-el-path]')
  for (const form of forms) {
    if (boundForms.has(form)) continue
    boundForms.add(form)
    function apply() {
      const values = Object.fromEntries(new FormData(form))
      values.q = String(values.q || '').trim()
      window.location.hash = href(form.dataset.elPath, values)
    }
    form.addEventListener('submit', event => { event.preventDefault(); apply() })
    form.addEventListener('change', event => { if (event.target.tagName === 'SELECT') apply() })
  }
  for (const table of root.querySelectorAll('.el-table')) {
    if (boundTables.has(table)) continue
    boundTables.add(table)
    table.addEventListener('click', event => {
      if (event.target.closest('button,a')) return
      event.target.closest('.el-task-row')?.querySelector('.el-document')?.click()
    })
  }
}
