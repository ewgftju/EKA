const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const fullDate = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long', timeZone: 'UTC' })
const shortDate = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' })
const weekday = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', timeZone: 'UTC' })
const colors = new Set(['teal', 'blue', 'violet', 'amber', 'rose', 'red', 'green', 'indigo', 'slate'])
const glyphs = {
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  left: '<path d="m14.5 6.5-5.5 5.5 5.5 5.5"/>',
  right: '<path d="m9.5 6.5 5.5 5.5-5.5 5.5"/>',
  expand: '<path d="M7 17 17 7M7 7h10v10"/>'
}

function icon(name) {
  return `<svg class="ec-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${glyphs[name]}</svg>`
}

function escaped(value) {
  const chars = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
  return String(value ?? '').replace(/[&<>"']/g, char => chars[char])
}

function iso(date) {
  return date.toISOString().slice(0, 10)
}

function day(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return null
  const date = new Date(value + 'T00:00:00Z')
  if (!Number.isFinite(date.getTime()) || iso(date) !== value) return null
  return date
}

function moveDays(date, amount) {
  const next = new Date(date)
  next.setUTCDate(date.getUTCDate() + amount)
  return next
}

function monthStart(date, offset = 0) {
  const next = new Date(date)
  next.setUTCDate(1)
  next.setUTCMonth(next.getUTCMonth() + offset)
  return next
}

function mondayIndex(date) {
  return (date.getUTCDay() + 6) % 7
}

function eventsCount(count) {
  const r100 = count % 100
  const r10 = count % 10
  if (r10 === 1 && r100 !== 11) return `${count} событие`
  if (r10 >= 2 && r10 <= 4 && (r100 < 12 || r100 > 14)) return `${count} события`
  return `${count} событий`
}

function toneOf(event) {
  return colors.has(event.tone) ? event.tone : 'teal'
}

function dayDots(items) {
  const tones = [...new Set(items.map(toneOf))].slice(0, 3)
  return tones.map(tone => `<i class="ec-dot ec-tone-${tone}"></i>`).join('')
}

export function makeCalendar({ today, events = [], onOpen, onExpand }) {
  const refDate = day(today)
  if (!refDate) throw new TypeError('Календарю нужна дата в формате YYYY-MM-DD')
  let selected = refDate
  let allMiniEvents = false
  const byDate = new Map()
  const bound = new Set()

  for (const event of events) {
    if (!event || event.id == null || !day(event.date)) continue
    const entries = byDate.get(event.date) ?? []
    if (!entries.some(entry => String(entry.id) === String(event.id))) entries.push(event)
    byDate.set(event.date, entries)
  }

  function shiftMonth(amount) {
    const next = monthStart(selected, amount)
    const last = moveDays(monthStart(next, 1), -1).getUTCDate()
    next.setUTCDate(Math.min(selected.getUTCDate(), last))
    select(next)
  }

  function select(date) {
    selected = date
    allMiniEvents = false
  }

  function monthTools(isFull) {
    const month = months[selected.getUTCMonth()] + ' ' + selected.getUTCFullYear()
    const todayButton = isFull ? '<button type="button" class="ec-today-button" data-ec-action="today">Сегодня</button>' : ''
    return `<div class="ec-toolbar"><${isFull ? 'h2' : 'div'} class="ec-month" aria-live="polite">${month}</${isFull ? 'h2' : 'div'}>
      <div class="ec-controls">${todayButton}
        <button type="button" class="ec-chevron" data-ec-action="prev" aria-label="Предыдущий месяц" title="Предыдущий месяц">${icon('left')}</button>
        <button type="button" class="ec-chevron" data-ec-action="next" aria-label="Следующий месяц" title="Следующий месяц">${icon('right')}</button>
      </div></div>`
  }

  function dateCell(date, isFull) {
    const id = iso(date)
    const entries = byDate.get(id) ?? []
    const active = id === iso(selected)
    const outside = date.getUTCMonth() !== selected.getUTCMonth()
    const classes = ['ec-day', active && 'ec-selected', id === today && 'ec-today', outside && 'ec-outside'].filter(Boolean).join(' ')
    const label = fullDate.format(date) + (entries.length ? ', ' + eventsCount(entries.length) : '')
    const chips = isFull ? entries.slice(0, 2).map(entry => `<span class="ec-cell-event ec-tone-${toneOf(entry)}">${escaped(entry.title)}</span>`).join('') : ''
    const hidden = isFull && entries.length > 2 ? `<span class="ec-cell-overflow">Ещё ${entries.length - 2}</span>` : ''
    return `<button type="button" class="${classes}" data-ec-action="day" data-ec-date="${id}" aria-pressed="${active}" ${id === today ? 'aria-current="date"' : ''} aria-label="${escaped(label)}" tabindex="${active ? 0 : -1}">
      <span class="ec-day-num">${date.getUTCDate()}</span><span class="ec-dots" aria-hidden="true">${dayDots(entries)}</span>${chips}${hidden}
    </button>`
  }

  function grid(isFull) {
    const first = monthStart(selected)
    const start = moveDays(first, -mondayIndex(first))
    const last = moveDays(monthStart(first, 1), -1)
    const count = Math.ceil((mondayIndex(first) + last.getUTCDate()) / 7) * 7
    const cells = Array.from({ length: count }, (_, index) => dateCell(moveDays(start, index), isFull)).join('')
    return `<div class="ec-weekdays" aria-hidden="true">${weekdays.map(w => `<span>${w}</span>`).join('')}</div>
      <div class="ec-grid" role="group" aria-label="Дни месяца">${cells}</div>`
  }

  function agendaRow(event) {
    const detail = [event.module, event.kind].filter((label, i, all) => label && all.indexOf(label) === i).join(' · ')
    return `<li><button class="ec-entry ec-tone-${toneOf(event)}" type="button" data-ec-action="open" data-ec-id="${escaped(event.id)}">
      <span class="ec-entry-dot"></span><span class="ec-entry-text"><strong>${escaped(event.title)}</strong>${detail ? `<small>${escaped(detail)}</small>` : ''}</span>${icon('right')}
    </button></li>`
  }

  function agenda(isFull) {
    const id = iso(selected)
    const entries = byDate.get(id) ?? []
    const date = shortDate.format(selected)
    const heading = isFull ? date : id === today ? `Сегодня, ${date}` : date
    const visible = !isFull && !allMiniEvents ? entries.slice(0, 2) : entries
    const more = entries.length > visible.length ? `<button type="button" class="ec-more" data-ec-action="more">Ещё ${entries.length - visible.length}</button>` : ''
    const body = entries.length ? `<ul class="ec-entries">${visible.map(agendaRow).join('')}</ul>${more}` : '<p class="ec-empty">На этот день событий нет</p>'
    return `<section class="ec-agenda" aria-label="События выбранного дня">
      ${isFull ? `<div class="ec-day-caption">${id === today ? 'Сегодня · ' : ''}${weekday.format(selected)}</div>` : ''}
      <div class="ec-agenda-heading"><h3>${heading}</h3>${entries.length ? `<span class="ec-count" aria-label="${eventsCount(entries.length)}">${entries.length}</span>` : ''}</div>
      ${body}</section>`
  }

  function contents(view) {
    if (view === 'full') return `<div class="ec-full-layout"><section class="ec-month-panel" aria-label="Календарь на месяц">${monthTools(true)}${grid(true)}</section>${agenda(true)}</div>`
    return `<div class="ec-mini-heading"><span class="ec-emblem">${icon('calendar')}</span><h2>Мой календарь</h2>
      <button type="button" class="ec-expand" data-ec-action="expand" title="Открыть календарь" aria-label="Открыть календарь">${icon('expand')}</button></div>
      <div class="ec-month-body">${monthTools(false)}${grid(false)}</div>${agenda(false)}`
  }

  function widget(view) {
    return `<div class="ec-wrap ec-${view}" data-ec-view="${view}">${contents(view)}</div>`
  }

  function repaint(root, focusAction) {
    for (const el of bound) {
      if (!el.isConnected && el !== root) {
        bound.delete(el)
        continue
      }
      el.innerHTML = contents(el.dataset.ecView)
    }
    if (root && focusAction) {
      const selector = focusAction === 'day' ? '.ec-selected' : `[data-ec-action="${focusAction}"]`
      root.querySelector(selector)?.focus({ preventScroll: true })
    }
  }

  function onClick(event) {
    const root = event.currentTarget
    const button = event.target.closest('button[data-ec-action]')
    if (!button || !root.contains(button)) return
    const action = button.dataset.ecAction
    switch (action) {
      case 'open': {
        const entry = (byDate.get(iso(selected)) ?? []).find(item => String(item.id) === button.dataset.ecId)
        if (entry) onOpen?.(entry.id)
        return
      }
      case 'expand': onExpand?.(); return
      case 'day': select(day(button.dataset.ecDate)); break
      case 'prev': shiftMonth(-1); break
      case 'next': shiftMonth(1); break
      case 'today': select(refDate); break
      case 'more': allMiniEvents = true; break
      default: return
    }
    repaint(root, action === 'more' ? null : action)
    if (action === 'more') root.querySelectorAll('.ec-entry')[2]?.focus({ preventScroll: true })
  }

  function onKey(event) {
    if (event.altKey || event.metaKey || event.ctrlKey || event.target.dataset.ecAction !== 'day') return
    const index = mondayIndex(selected)
    const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -index, End: 6 - index }
    if (Object.hasOwn(offsets, event.key)) select(moveDays(selected, offsets[event.key]))
    else if (event.key === 'PageUp' || event.key === 'PageDown') shiftMonth(event.key === 'PageUp' ? -1 : 1)
    else return
    event.preventDefault()
    repaint(event.currentTarget, 'day')
  }

  return {
    mini: () => widget('mini'),
    full: () => widget('full'),
    bind(root) {
      const nodes = root.matches?.('[data-ec-view]') ? [root] : root.querySelectorAll('[data-ec-view]')
      for (const node of nodes) {
        if (bound.has(node)) continue
        bound.add(node)
        node.addEventListener('click', onClick)
        node.addEventListener('keydown', onKey)
      }
      for (const node of bound) if (!node.isConnected && !root.contains(node)) bound.delete(node)
    },
    reset() {
      select(refDate)
      repaint(null, null)
    }
  }
}
