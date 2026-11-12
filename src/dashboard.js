import { esc, glyph, iconBox, empty, plural } from './ui.js'
import { dayTitle } from './model.js'
import { teamWidget } from './team.js'
import { casesPanel } from './cases.js'

function hero(view) {
  const { primary, active, courses, today } = view
  const next = active.find(task => task.dueAt && !task.overdue)
  const course = courses.find(course => course.status === 'active' && course.dueDate >= today)
  const person = primary.name + ' · ' + primary.org
  const nextDoc = next ? '<button class="hero-next" data-document="' + esc(next.entityId) + '">' + glyph('CalendarClock') +
    '<span><small>Ближайший срок поручения</small><strong>' + esc(next.actionTitle) + '</strong><em>' + esc(next.dateLabel) + '</em></span>' + glyph('ArrowUpRight', 'hero-next-arrow') + '</button>' : ''
  const nextCourse = !next && course ? '<a class="hero-next" href="#/learning?course=' + esc(course.id) + '">' + glyph('GraduationCap') + '<span><small>Ближайший срок обучения</small><strong>' +
    esc(course.title) + '</strong><em>' + esc(shortDay(course.dueDate)) + '</em></span>' + glyph('ArrowUpRight', 'hero-next-arrow') + '</a>' : ''
  const upcoming = view.events.filter(e => e.caseId && e.lifecycle !== 'closed' && e.date >= today).sort((a,b) => a.date.localeCompare(b.date))[0]
  const caseLink = !next && !course && upcoming ? '<a class="hero-next" href="#/calendar">' + glyph('CalendarRange') + '<span><small>Ближайшая дата мероприятия</small><strong>' + esc(upcoming.title) + '</strong><em>' + esc(shortDay(upcoming.date)) + '</em></span>' + glyph('ArrowUpRight','hero-next-arrow') + '</a>' : ''
  return '<section class="hero"><div class="hero-pattern" aria-hidden="true"></div><div class="hero-content"><div class="hero-date">' + glyph('CalendarDays') + esc(dayTitle(view.now)) +
    '</div><h1>Мой рабочий стол</h1><p>' + esc(person) + '</p></div>' + nextDoc + nextCourse + caseLink + '</section>'
}
function metric(label, value, icon, tone, href) {
  return '<a class="metric" href="' + href + '"><span class="metric-copy"><span class="metric-label">' + label + '</span><strong>' + value +
    '</strong></span>' + iconBox(icon, tone, 'metric-icon') + '</a>'
}
function metrics(view) {
  if (view.caseProfile) {
    const count = status => view.cases.filter(record => record.lifecycle === status).length
    return metric('Дела в работе', count('active'), 'BriefcaseBusiness', 'blue', '#/cases?status=active') +
      metric('Ещё не начаты', count('planned'), 'Hourglass', 'amber', '#/cases?status=planned') +
      metric('Завершённые дела', count('closed'), 'CircleCheck', 'teal', '#/cases?status=closed') +
      metric('Входящие поручения', view.active.length, 'ClipboardList', 'violet', '#/tasks?status=active')
  }
  if (view.learning) {
    const pending = view.courses.filter(c => c.status === 'active')
    return metric('Курсы в работе', pending.length, 'GraduationCap', 'blue', '#/learning?status=active') +
      metric('Срок сегодня', pending.filter(c => c.dueDate === view.today).length, 'CalendarClock', 'amber', '#/learning?status=today') +
      metric('Просрочено', pending.filter(c => c.dueDate && c.dueDate < view.today).length, 'CircleAlert', 'rose', '#/learning?status=late') +
      metric('Пройдено курсов', view.courses.length - pending.length, 'CircleCheck', 'teal', '#/learning?status=done')
  }
  return metric('Поручения в работе', view.active.length, 'ClipboardList', 'blue', '#/tasks?status=active') +
    metric('Срок сегодня', view.active.filter(t => t.dueDay === view.today).length, 'CalendarClock', 'amber', '#/tasks?status=today') +
    metric('Просрочено', view.active.filter(t => t.overdue).length, 'CircleAlert', 'rose', '#/tasks?status=late') +
    metric('Непрочитанные', view.unread, 'Bell', 'teal', '#/notifications?tab=unread')
}
function cardHead(title, href, action) {
  return '<div class="panel-head"><h2>' + title + '</h2><a class="text-link" href="' + href + '">' + action + glyph('ArrowRight') + '</a></div>'
}
export function moduleTile(module, detailed = false) {
  return '<a class="module-tile" href="' + esc(module.url) + '" target="_blank" rel="noopener noreferrer" aria-label="' + esc('Открыть модуль «' + module.title + '» в новой вкладке') + '">' +
    iconBox(module.icon, module.tone) + '<span class="tile-copy"><b>' + esc(module.title) + '</b>' +
    (detailed ? '<small>' + esc(module.description) + '</small>' : '') + '</span>' + glyph('ArrowUpRight', 'tile-launch') + '</a>'
}
function homeModules(view) {
  const subset = view.modules.slice(0, 4)
  return '<section class="panel home-modules">' + cardHead('Мои модули', '#/modules', 'Все модули') +
    '<div class="module-grid compact">' + subset.map(m => moduleTile(m)).join('') + '</div></section>'
}
const buttonTab = (title, num, value, current) => '<button class="home-tab' + (current === value ? ' selected' : '') + '" data-home-tab="' + value +
  '" aria-pressed="' + (current === value) + '">' + title + '<span>' + num + '</span></button>'
function taskQueue(view, box) {
  const sent = box === 'out'
  const outgoing = view.outgoing.filter(t => t.status === 'pending')
  const items = sent ? outgoing : view.active
  const countWaiting = view.incoming.filter(t => t.status === 'waiting').length
  const dest = sent ? '#/tasks?box=out' : '#/tasks'
  const rows = items.slice(0, 4).map(t =>
    '<button type="button" class="queue-row" data-document="' + esc(t.entityId) + '">' + iconBox(t.icon, t.tone, 'row-icon') +
    '<span class="row-title"><strong>' + esc(sent ? t.stageTitle : t.actionTitle) + '</strong><span class="row-meta">' + esc(t.moduleLabel) + '<i></i>' + esc(t.number) + '</span></span>' +
    '<span class="row-purpose">' + esc(sent ? t.recipientName : t.authorName) + '</span>' +
    '<span class="row-deadline">' + (t.overdue ? '<span class="status-chip danger"><i></i>Просрочено</span>' : '') + '<span>' + esc(t.dateLabel) + '</span></span>' +
    glyph('ChevronRight', 'row-arrow') + '</button>').join('')
  return '<section class="panel queue-panel">' + cardHead('Мои поручения', dest, 'Все поручения') +
    '<div class="queue-tabs">' + buttonTab('Входящие', view.active.length, 'in', box) + buttonTab('Отправленные', outgoing.length, 'out', box) + '</div>' +
    (rows ? '<div class="queue-table"><div class="queue-key"><span>' + (sent ? 'Этап документа' : 'Что нужно сделать') + '</span><span>' + (sent ? 'Получатель' : 'От кого') + '</span><span>Срок поручения</span></div>' + rows + '</div>' :
      empty(sent ? 'Отправленных поручений в работе нет' : 'Поручений, требующих вашего действия, нет', countWaiting && !sent ? 'Следующий этап откроется после решения предыдущего участника.' : '', 'ListChecks')) +
    (countWaiting && !sent ? '<a class="queue-foot" href="#/tasks?box=in&status=waiting">' + glyph('Hourglass') + 'Ожидают предыдущего этапа <b>' + countWaiting + '</b>' + glyph('ArrowRight') + '</a>' : '') + '</section>'
}
function shortDay(day) {
  return day ? new Intl.DateTimeFormat('ru-RU', { timeZone:'UTC', day:'numeric', month:'long' }).format(new Date(day + 'T00:00:00Z')) : 'Без срока'
}
export function coursesSection(view, home = false, params = new URLSearchParams()) {
  const chosen = view.courses.find(c => c.id === params.get('course'))
  if (chosen && !home) {
    return '<section class="panel course-detail"><a class="text-link" href="#/learning">' + glyph('ArrowLeft') + 'Все курсы</a><div class="course-title">' +
      iconBox('GraduationCap', 'teal') + '<h2>' + esc(chosen.title) + '</h2></div><dl class="details-grid"><div><dt>Состояние</dt><dd>' +
      (chosen.status === 'done' ? 'Обучение завершено' : 'В работе') + '</dd></div><div><dt>Срок обучения</dt><dd>' + esc(shortDay(chosen.dueDate)) +
      '</dd></div><div><dt>Мой прогресс</dt><dd>' + esc(chosen.progressLabel) + '</dd></div></dl><p class="hint">' + esc(chosen.note) +
      '</p><a class="button primary" href="' + esc(chosen.href) + '" target="_blank" rel="noopener noreferrer">Открыть курс в модуле «Кадры»' + glyph('ArrowUpRight') + '</a></section>'
  }
  const status = params.get('status') || 'all'
  const courses = view.courses.filter(c =>
    status === 'active' ? c.status === 'active' : status === 'done' ? c.status === 'done' :
    status === 'today' ? c.status === 'active' && c.dueDate === view.today : status === 'late' ? c.status === 'active' && c.dueDate && c.dueDate < view.today : true)
  const tabs = [['all', 'Все'], ['active', 'В работе'], ['done', 'Завершённые'], ...(status === 'late' ? [['late','Просрочено']] : status === 'today' ? [['today','Срок сегодня']] : [])]
  return '<section class="panel courses-panel">' + (home ? cardHead('Моё обучение', '#/learning', 'Все курсы') : '<div class="queue-tabs course-tabs">' +
    tabs.map(([id, label]) => '<a href="#/learning?status=' + id + '" class="home-tab' + (status === id ? ' selected' : '') + '">' + label + '</a>').join('') + '</div>') +
    (courses.length ? courses.map(c => '<a class="course-row" href="#/learning?course=' + esc(c.id) + '">' + iconBox('BookOpen', 'teal') +
      '<span><strong>' + esc(c.title) + '</strong><small>' + esc(c.progressLabel) + '</small></span><span class="course-status">' + (c.status === 'done' ? 'Завершён' : 'До ' + shortDay(c.dueDate)) + '</span>' +
      glyph('ChevronRight','row-arrow') + '</a>').join('') : empty('Курсов по этому условию нет', '', 'GraduationCap')) + '</section>'
}
export function dashboard(view, calendar, box) {
  const cases = view.canViewCases ? casesPanel(view) : ''
  const inbox = view.learning ? coursesSection(view, true) : taskQueue(view, box)
  const ordering = view.canViewCases ? ' has-cases' + (view.caseProfile ? '' : ' queue-first') : ''
  return hero(view) + '<div class="metric-grid">' + metrics(view) + '</div><div class="dashboard-grid' + ordering + '"><div class="primary-column">' +
    (view.caseProfile ? cases + inbox : inbox + cases) + homeModules(view) +
    '</div><aside class="secondary-column" aria-label="Рабочие даты">' + calendar.mini() + teamWidget(view.today) + '</aside></div>'
}
export function modulesPage(view) {
  const text = view.modules.length + ' ' + plural(view.modules.length,'доступный модуль','доступных модуля','доступных модулей')
  return '<section class="panel module-directory"><div class="panel-head"><h2>' + text + '</h2></div><div class="module-grid directory">' +
    view.modules.map(m => moduleTile(m, true)).join('') + '</div></section>'
}
