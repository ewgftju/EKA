import { esc, glyph, empty } from './ui.js'
import { evgaCases } from './evgaCases.js'
import { svaAuditors, svaCases } from './svaCases.js'

export const caseProfiles = svaAuditors
const auditCases = [...evgaCases, ...svaCases]
const statuses = [
  ['active', 'В работе'], ['planned', 'Ещё не начаты'], ['closed', 'Завершены'], ['all', 'Все']
]
const emptyStatus = {
  active: 'Дел в работе пока нет', planned: 'Дел, ожидающих начала, нет',
  closed: 'Завершённых дел пока нет', all: 'За вами пока нет закреплённых дел'
}

export function getCases(profileId, allowedModules) {
  return auditCases.filter(record => allowedModules.has(record.module) && record.assigneeIds.includes(profileId))
}

function currentStage(record) {
  if (record.lifecycle === 'closed') return 'Завершено'
  if (record.lifecycle === 'planned') return record.eventStatus === 'Проект' ? 'Проект' : 'Ещё не начато'
  return record.stage
}

function stageBadge(record) {
  const stage = currentStage(record)
  let tone = 'blue'
  if (record.lifecycle === 'planned') tone = 'slate'
  else if (record.lifecycle === 'closed') tone = 'green'
  else if (/заключит/i.test(stage)) tone = 'violet'
  else if (/основн/i.test(stage)) tone = 'teal'
  return '<span class="case-stage tone-' + tone + '"><i></i>' + esc(stage) + '</span>'
}

const dayFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
function periodLabel({ start, end }) {
  const a = start && new Date(start + 'T00:00:00Z')
  const b = end && new Date(end + 'T00:00:00Z')
  if (a && b) return dayFormat.formatRange(a, b)
  if (a) return 'с ' + dayFormat.format(a)
  if (b) return 'по ' + dayFormat.format(b)
  return ''
}

function detail(label, value) {
  return value ? '<span><small>' + esc(label) + '</small>' + esc(value) + '</span>' : ''
}

function caseRow(record, full) {
  const object = record.object && record.object !== record.title
    ? '<span class="case-object">' + esc(record.object) + '</span>' : ''
  const facts = full ? '<span class="case-facts">' +
    detail('Моя роль', record.role) + detail('Период мероприятия', periodLabel(record)) +
    detail('Следующий шаг по делу', record.lifecycle === 'active' && (record.nextAction || record.nextStep)) +
    '</span>' : ''
  const stageSource = full && record.lifecycle === 'active' ? '<small>' + esc(record.stageSource) + '</small>' : ''
  return '<a class="case-row" href="' + esc(record.href) + '" target="_blank" rel="noopener noreferrer" aria-label="' +
    esc('Открыть дело ' + record.number + ' в модуле ' + record.moduleLabel + '. ' + currentStage(record) + '. Новая вкладка') + '">' +
    '<span class="case-identity"><span class="case-ref"><span class="case-module tone-' + esc(record.tone) + '">' +
    esc(record.moduleLabel) + '</span><span>' + esc(record.number) + '</span></span><strong>' + esc(record.title) + '</strong>' + object +
    '</span><span class="case-progress">' + stageBadge(record) + stageSource + '</span>' + glyph('ArrowUpRight', 'case-open') + facts + '</a>'
}

// Alternate modules in the short preview. Show each available stage before a second example of the same stage.
function previewCases(records) {
  const groups = [...new Set(records.map(r => r.module))].map(id => {
    const group = records.filter(r => r.module === id)
    const first = group.filter((r, i) => group.findIndex(x => currentStage(x) === currentStage(r)) === i)
    return [...first, ...group.filter(r => !first.includes(r))]
  })
  const result = []
  for (let i = 0; result.length < Math.min(records.length, 4); i++) {
    for (const group of groups) if (group[i] && result.length < 4) result.push(group[i])
  }
  return result
}

function caseTable(records, full, blank) {
  if (!records.length) return empty(blank, '', 'BriefcaseBusiness')
  return '<div class="case-table"><div class="case-key" aria-hidden="true"><span>Мероприятие и объект</span><span>Текущий этап</span></div>' +
    records.map(r => caseRow(r, full)).join('') + '</div>'
}

export function casesPanel(view) {
  const active = view.cases.filter(r => r.lifecycle === 'active')
  const planned = view.cases.filter(r => r.lifecycle === 'planned')
  const status = active.length ? 'active' : planned.length ? 'planned' : 'active'
  const rows = previewCases(status === 'active' ? active : planned)
  return '<section class="panel cases-panel" aria-label="Мои дела"><div class="panel-head"><h2>Мои дела</h2>' +
    '<a class="text-link" href="#/cases?status=all">Все дела ' + glyph('ArrowRight') + '</a></div>' +
    caseTable(rows, false, emptyStatus.active) + '</section>'
}

export function filterCases(records, { status, module, creator }) {
  return records.filter(record => (status === 'all' || status === record.lifecycle) &&
    (!module || record.module === module) && (!creator || record.createdById === creator))
}

export function caseDirectory(view, params) {
  const status = statuses.some(([id]) => id === params.get('status')) ? params.get('status') : 'active'
  const permitted = view.modules.filter(m => ['evga', 'sva'].includes(m.id))
  const module = permitted.find(m => m.id === params.get('module'))?.id || ''
  const created = params.get('created') === '1'
  const creator = created ? view.primary.id : ''
  function href(next) {
    const query = new URLSearchParams()
    const current = { status, module, created: created ? '1' : '', ...next }
    for (const [key, value] of Object.entries(current)) if (value) query.set(key, value)
    return '#/cases?' + esc(query.toString())
  }
  function option(label, selection, selected, count) {
    return '<a class="home-tab' + (selected ? ' selected' : '') + '" href="' + href(selection) + '"' +
      (selected ? ' aria-current="true"' : '') + '>' + esc(label) + (count === undefined ? '' : '<span>' + count + '</span>') + '</a>'
  }
  const available = filterCases(view.cases, { status: 'all', module, creator })
  const rows = filterCases(available, { status })
  const tabs = statuses.map(([id, label]) => option(label, { status: id }, status === id,
    id === 'all' ? available.length : available.filter(r => r.lifecycle === id).length)).join('')
  const filters = permitted.length > 1 ? '<div class="case-filter" aria-label="Фильтр по модулю">' +
    option('Все модули', { module: '' }, !module) + permitted.map(m => option(m.label, { module: m.id }, module === m.id)).join('') + '</div>' : ''
  const authors = view.cases.some(r => r.createdById === view.primary.id) ? '<div class="case-filter" aria-label="Фильтр по автору">' +
    option('Все мои дела', { created: '' }, !created) + option('Созданные мной', { created: '1' }, created) + '</div>' : ''
  const blank = module || created ? 'По выбранным условиям дел нет' : emptyStatus[status]
  return '<section class="panel case-directory" aria-label="Реестр моих дел"><nav class="case-tabs" aria-label="Состояние дела">' +
    tabs + '</nav>' + ((filters || authors) ? '<div class="case-tools">' + filters + authors + '</div>' : '') +
    caseTable(rows, true, blank) + '</section>'
}
