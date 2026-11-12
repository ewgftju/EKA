import { esc, glyph, iconBox, empty, plural } from './ui.js'

// The SVA fixture names an object assignee but supplies no shared account ID.
// In EKA this is a separate internal demo identity, scoped to the SVA module.
export const caseProfiles = [{
  id: 'sva-auditor', name: 'Государственный аудитор 12', role: 'Аудитор СВА',
  org: 'Служба внутреннего аудита', initials: 'А12', modules: ['sva']
}]

// saq-sva-test at 0f610e75, initializeSvaEvents(initialSvaEvents).
// start and end come from event.dates; stage comes from object.status.
const assignedObjects = [{
  id: 'sva-260006-obj-15', title: 'Аудит соблюдения отраслевого законодательства',
  number: 'СВА-260006', objectId: 'obj-15', object: 'РГУ «Основная организация Ш»',
  responsible: 'Государственный аудитор 12', region: 'Жамбылская область',
  start: '2026-11-02', end: '2026-11-20', stage: 'Предварительный этап', eventStatus: 'Проект'
}]

export function getCases(profileId) {
  const person = caseProfiles.find(profile => profile.id === profileId)
  if (!person) return []
  return assignedObjects.filter(item => item.responsible === person.name).map(item => ({
    ...item,
    href: 'https://saq-sva-test.vercel.app/objects/' + encodeURIComponent(item.number) + '/' + encodeURIComponent(item.objectId)
  }))
}

const dayFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
function periodLabel(item, today) {
  const start = new Date(item.start + 'T00:00:00Z')
  const end = new Date(item.end + 'T00:00:00Z')
  const range = dayFormat.formatRange(start, end)
  if (today === item.start) return range + ' · начало сегодня'
  if (today === item.end) return range + ' · окончание сегодня'
  return range
}

function caseRow(item, today, full) {
  const title = esc(item.title)
  const date = esc(periodLabel(item, today))
  const context = esc(item.number) + ' · ' + esc(item.object)
  return `<a class="sva-case-row" href="${esc(item.href)}" target="_blank" rel="noopener noreferrer" aria-label="Открыть объект по мероприятию ${esc(item.number)} в модуле СВА в новой вкладке">
    ${iconBox('ClipboardCheck', 'violet', 'row-icon')}<span class="sva-case-body">
      <strong>${title}</strong><span class="sva-case-context">${context}</span>
      <span class="sva-case-period">${glyph('CalendarRange')} Период проведения · ${date}</span>
      ${full ? `<span class="sva-case-facts"><span><small>Ответственный аудитор</small>${esc(item.responsible)}</span><span><small>Этап по объекту</small>${esc(item.stage)}</span><span><small>Статус мероприятия</small>${esc(item.eventStatus)}</span><span><small>Регион</small>${esc(item.region)}</span></span>` : ''}
    </span>${glyph('ArrowUpRight', 'sva-case-open')}</a>`
}

export function casesPanel(cases, today, full = false) {
  const heading = full ? 'Назначенные объекты' : 'Мои мероприятия'
  const action = full
    ? `<span class="sva-case-count">${cases.length} ${plural(cases.length, 'объект', 'объекта', 'объектов')}</span>`
    : `<a class="text-link" href="#/cases">Все мероприятия ${glyph('ArrowRight')}</a>`
  const visible = full ? cases : cases.slice(0, 3)
  const rows = visible.length
    ? visible.map(item => caseRow(item, today, full)).join('')
    : empty('За вами пока не закреплены объекты аудита', '', 'ClipboardCheck')
  return `<section class="panel sva-cases" aria-label="${heading}"><div class="panel-head"><h2>${heading}</h2>${action}</div>${rows}</section>`
}
