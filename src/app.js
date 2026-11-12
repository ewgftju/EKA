import { buildView, defaultProfile, profiles } from './model.js'
import { esc, glyph, iconBox, empty, brand } from './ui.js'
import { dashboard, modulesPage, coursesSection } from './dashboard.js'
import { makeCalendar } from './calendar.js'
import { teamPage, bindTeam } from './team.js'
import { caseDirectory } from './cases.js'
import { taskList, noticeList, bindLists } from './lists.js'
import { getWorkflow, setWorkflowUser, openWorkflowDocument, readNotices, restartDemo, workflowStorageKey } from './workflow.js'

const app = document.querySelector('#app')
const dialog = document.querySelector('#overlay')
const feedback = document.querySelector('#feedback')
const sessionKey = 'saq.eka.session.v1'
const navKey = 'saq.eka.navigation.v1'
const employee = id => profiles.find(person => person.id === id)
const readValue = (storage, key) => { try { return storage.getItem(key) } catch { return null } }
const writeValue = (storage, key, value) => { try { storage.setItem(key, value) } catch { /* Session works in memory. */ } }
let stored = readValue(sessionStorage, sessionKey)
let profileId = stored === null ? defaultProfile : employee(stored)?.id || null
let collapsed = readValue(localStorage, navKey) === 'compact'
let mobileMenu = false
let homeBox = 'in'
let view = null
let page = 'home'
let calendar = null
let calendarKey = ''
let popup = ''
let bellTab = 'unread'
let toastTimer
const pageTitles = { cases:'Мои дела', home:'Рабочий стол', tasks:'Мои поручения', calendar:'Календарь', modules:'Мои модули', team:'Коллектив', learning:'Моё обучение', notifications:'Уведомления' }
const pageNotes = { cases:'Аудиты, которые вы ведёте. Откройте дело, чтобы продолжить работу в его модуле.', tasks:'Во входящих видны действия, назначенные вам. В отправленных можно проверить, у кого сейчас документ.', calendar:'Даты ваших мероприятий, встреч и поручений. Время Астаны.', modules:'Разделы SAQ, доступные вашему профилю.', team:'Рабочий календарь подразделения', learning:'Назначенные курсы и результаты обучения.', notifications:'События по вашим документам и поручениям.' }
function locationState() {
  const hash = location.hash.slice(1).replace(/^\//, '')
  const [path, query = ''] = hash.split('?')
  return { page: path || 'home', params: new URLSearchParams(query) }
}
function go(hash, replace = false) {
  if (location.hash === hash) { render(); return }
  if (replace) { history.replaceState(null, '', hash); render() }
  else location.hash = hash
}
function toast(message) {
  feedback.textContent = message
  feedback.classList.add('visible')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => feedback.classList.remove('visible'), 2800)
}
function activate(id) {
  profileId = employee(id)?.id || null
  writeValue(sessionStorage, sessionKey, profileId || 'signed-out')
  setWorkflowUser(profileId)
  homeBox = 'in'
  calendarKey = ''
  mobileMenu = false
}
function navItem(route, label, icon, count) {
  const selected = page === route
  return '<a class="nav-item' + (selected ? ' current' : '') + '" href="#/' + (route === 'home' ? '' : route) + '"' +
    (selected ? ' aria-current="page"' : '') + ' title="' + esc(label) + '">' + glyph(icon) + '<span class="nav-label">' + esc(label) +
    '</span>' + (count > 0 ? '<span class="nav-count">' + count + '</span>' : '') + '</a>'
}
function sideBar() {
  return '<aside class="sidebar" id="workspace-navigation"><a class="brand" href="#/" aria-label="SAQ, на рабочий стол">' + brand() + '</a>' +
    '<nav aria-label="Основная навигация"><div class="nav-group"><p class="nav-caption">Рабочее место</p>' +
    navItem('home','Рабочий стол','LayoutDashboard') + (view.canViewCases ? navItem('cases','Мои дела','BriefcaseBusiness',view.cases.filter(r => r.lifecycle === 'active').length) : '') +
    (view.learning ? navItem('learning','Моё обучение','GraduationCap') : navItem('tasks','Мои поручения','ClipboardList',view.active.length)) +
    navItem('calendar','Календарь','CalendarDays') + '</div><div class="nav-group"><p class="nav-caption">Пространство SAQ</p>' +
    navItem('modules','Мои модули','Blocks') + navItem('team','Коллектив','Users') + '</div></nav>' +
    '<div class="side-bottom"><button class="nav-item demo-info" data-open="about" title="О демонстрационном стенде"><span class="demo-led"></span><span class="nav-label">Демонстрационный стенд</span></button>' +
    '<button class="nav-item collapse-control" data-toggle-nav aria-controls="workspace-navigation" aria-expanded="' + !collapsed + '" title="' + (collapsed ? 'Развернуть меню' : 'Свернуть меню') + '">' +
    glyph(collapsed ? 'PanelLeftOpen' : 'PanelLeftClose') + '<span class="nav-label">Свернуть меню</span></button></div></aside>'
}
function topBar() {
  const p = view.primary
  return '<header class="topbar"><button class="square-btn mobile-toggle" data-mobile-nav aria-label="Меню" aria-controls="workspace-navigation" aria-expanded="' + mobileMenu + '">' + glyph('Menu') + '</button><div class="product-name">Единый кабинет аудитора</div>' +
    '<div class="head-actions"><button class="global-search" data-open="search" aria-label="Поиск по кабинету">' + glyph('Search') + '<span>Поиск по кабинету</span><kbd>Ctrl K</kbd></button>' +
    '<button class="square-btn bell-button" data-open="notifications" title="Уведомления" aria-label="Уведомления, непрочитанных: ' + view.unread + '">' + glyph('Bell') +
    (view.unread ? '<span class="bell-count">' + view.unread + '</span>' : '') + '</button>' +
    '<button class="profile-button" data-open="profile" title="Сменить демопрофиль" aria-label="Профиль, ' + esc(p.name) + '. Сменить профиль"><span class="avatar">' + esc(p.initials) +
    '</span><span class="profile-caption"><b>' + esc(p.name) + '</b><small>' + esc(p.role) + '</small></span>' + glyph('ChevronDown') + '</button></div></header>'
}
function loginView(selection) {
  const selected = employee(selection)?.id || defaultProfile
  const options = profiles.map(p => '<option value="' + esc(p.id) + '"' + (p.id === selected ? ' selected' : '') + '>' + esc(p.name + ' · ' + p.role) + '</option>').join('')
  return '<main id="main-content" class="login-page"><div class="login-wrap"><div class="login-aside"><div class="login-brand">' + brand() +
    '</div><div class="login-message"><h1>Единый кабинет<br>аудитора</h1><p>Мои дела, поручения и рабочий календарь Smart Audit Qazaqstan.</p></div><span class="login-tag"><i></i>Демонстрационный стенд SAQ</span></div>' +
    '<form id="login-form" class="login-form">' + iconBox('LockKeyhole', 'teal') + '<h2>Вход в кабинет</h2><p>Выберите тестовый профиль. Реквизиты для входа будут заполнены автоматически.</p>' +
    '<label for="role-select">Демонстрационный профиль</label><select id="role-select" name="profile">' + options + '</select>' +
    '<label for="login-name">Логин</label><input id="login-name" name="login" value="' + esc(selected) + '" autocomplete="off" required>' +
    '<label for="demo-password">Пароль</label><div class="password-field"><input id="demo-password" name="password" type="password" value="demo" autocomplete="off" required><button type="button" data-show-pass aria-label="Показать пароль">' + glyph('Eye') + '</button></div>' +
    '<small class="login-hint">Пароль для демопрофилей — <b>demo</b></small><div class="form-error" id="login-error" role="alert"></div>' +
    '<button type="submit" class="button primary">Войти в кабинет' + glyph('ArrowRight') + '</button></form></div></main>'
}
function placeCalendar() {
  const key = JSON.stringify([profileId, view.today, view.events])
  if (key !== calendarKey) {
    calendarKey = key
    calendar = makeCalendar({ today:view.today, events:view.events,
      onOpen: id => {
        const event = view?.events.find(event => event.id === id)
        if (event?.entityId) openDocument(event.entityId)
        else if (event?.courseId) go('#/learning?course=' + encodeURIComponent(event.courseId))
        else if (event?.caseId) {
          const record = view.cases.find(c => c.id === event.caseId)
          if (record) window.open(record.href, '_blank', 'noopener,noreferrer')
        }
      }, onExpand: () => go('#/calendar') })
  }
}
function render() {
  const route = locationState()
  if (popup) closeOverlay()
  const login = route.page === 'login' || !profileId
  if (login) {
    if (profileId || stored === null) activate(null)
    view = null
    document.title = 'Вход · ЕКА SAQ'
    app.innerHTML = loginView(route.params.get('profile'))
    return
  }
  setWorkflowUser(profileId)
  const state = getWorkflow()
  view = buildView(profileId, state)
  if (!view) { activate(null); go('#/login', true); return }
  page = route.page
  placeCalendar()
  document.title = (pageTitles[page] || 'Страница') + ' · ЕКА SAQ'
  const pages = {
    home: () => dashboard(view, calendar, homeBox), calendar: () => calendar.full(),
    tasks: () => taskList(view, route.params), notifications: () => noticeList(view, route.params),
    cases: () => view.canViewCases ? caseDirectory(view, route.params) : empty('В этом профиле нет доступа к делам аудита', '', 'BriefcaseBusiness'),
    modules: () => modulesPage(view), team: () => teamPage(view.today, !!view.primary.canImport),
    learning: () => view.learning ? coursesSection(view, false, route.params) : empty('Обучение этому профилю не назначено', '', 'BookOpen')
  }
  const content = pages[page] ? pages[page]() : '<div class="panel">' + empty('Страница не найдена', '', 'FolderOpen') + '<a class="button quiet" href="#/">На рабочий стол</a></div>'
  const pageHeading = page === 'home' ? '' : '<div class="page-heading"><div class="crumb"><a href="#/">Рабочий стол</a>' + glyph('ChevronRight') + esc(pageTitles[page] || 'Страница') +
    '</div><h1>' + esc(pageTitles[page] || 'Страница') + '</h1>' + (pageNotes[page] && page !== 'team' ? '<p>' + esc(pageNotes[page]) + '</p>' : '') + '</div>'
  app.innerHTML = '<div class="workspace' + (collapsed ? ' compact-nav' : '') + (mobileMenu ? ' menu-open' : '') + '">' + sideBar() +
    (mobileMenu ? '<button class="nav-scrim" data-mobile-nav aria-label="Закрыть меню"></button>' : '') + topBar() + '<main class="main" id="main-content" tabindex="-1">' + pageHeading + content + '</main></div>'
  if (page === 'calendar' || page === 'home') calendar.bind(app)
  if (page === 'tasks' || page === 'notifications') bindLists(app)
  if (page === 'team') bindTeam(app, view.today, () => !!employee(profileId)?.canImport, render)
}
async function openDocument(id, noticeId) {
  if (!view?.allowedEntities.has(id)) { toast('Документ недоступен этому профилю'); return }
  if (noticeId) await readNotices(profileId, [noticeId])
  if (!openWorkflowDocument(profileId, id)) toast('Документ недоступен этому профилю')
}
function closeOverlay() {
  if (dialog.open) dialog.close()
  popup = ''
}
function modalHeader(title, icon) {
  return '<div class="modal-heading"><h2 id="overlay-title">' + (icon ? glyph(icon) : '') + title + '</h2><button class="square-btn close-dialog" data-close aria-label="Закрыть">' + glyph('X') + '</button></div>'
}
function profilePanel() {
  return modalHeader('Профиль для просмотра', 'Users') + '<p class="modal-note">Выберите сотрудника, чтобы увидеть его аудиты, поручения и доступные модули.</p><div class="profile-list">' +
    profiles.map(p => '<button class="persona' + (p.id === profileId ? ' chosen' : '') + '" data-profile="' + esc(p.id) + '" aria-pressed="' + (p.id === profileId) + '">' +
      '<span class="avatar">' + esc(p.initials) + '</span><span class="persona-text"><b>' + esc(p.name) + '</b><small>' + esc(p.role) + '</small></span>' +
      (p.id === profileId ? glyph('Check') : '') + '</button>').join('') + '</div><div class="modal-foot"><button class="button quiet" data-logout>' + glyph('LogOut') + 'Выйти из кабинета</button></div>'
}
function bellPanel() {
  const list = bellTab === 'unread' ? view.notices.filter(n => !n.read) : view.notices
  return modalHeader('Уведомления','Bell') + '<div class="bell-tabs"><button data-bell-tab="unread" class="home-tab' + (bellTab === 'unread' ? ' selected' : '') + '">Непрочитанные <span>' + view.unread + '</span></button>' +
    '<button data-bell-tab="all" class="home-tab' + (bellTab === 'all' ? ' selected' : '') + '">Все</button></div><div class="bell-list">' +
    (list.length ? list.slice(0,5).map(n => '<button class="bell-note" data-notice="' + esc(n.id) + '"><span class="notice-dot' + (n.read ? ' read' : '') + '"></span><span><b>' +
      esc(n.title) + '</b><small>' + esc(n.moduleLabel) + ' · ' + esc(n.dateLabel) + '</small></span>' + glyph('ChevronRight') + '</button>').join('') :
      empty(bellTab === 'unread' ? 'Непрочитанных уведомлений нет' : 'Уведомлений пока нет', '', 'Bell')) +
    '</div><div class="modal-foot"><a class="text-link" data-dialog-nav href="#/notifications?tab=' + bellTab + '">Все уведомления' + glyph('ArrowRight') + '</a></div>'
}
function searchResults(term) {
  const query = term.toLocaleLowerCase('ru-RU').trim()
  const docs = new Map()
  for (const task of [...view.active, ...view.incoming, ...view.outgoing]) docs.set(task.entityId, view.allowedEntities.get(task.entityId))
  for (const n of view.notices) if (!docs.has(n.entityId)) docs.set(n.entityId, view.allowedEntities.get(n.entityId))
  const matches = (value) => !query || value.toLocaleLowerCase('ru-RU').includes(query)
  const records = [...docs.values()].filter(Boolean).filter(d => matches(d.title + ' ' + d.number + ' ' + d.organization)).slice(0, query ? 10 : 3)
  const modules = view.modules.filter(m => matches(m.label + ' ' + m.title + ' ' + m.description)).slice(0, query ? 8 : 3)
  const courses = view.courses.filter(c => matches(c.title))
  const cases = view.cases.filter(c => matches([c.title, c.number, c.object, c.moduleLabel, c.stage, c.eventStatus].filter(Boolean).join(' '))).slice(0, query ? 12 : 3)
  const items = [
    cases.length ? '<h3>Мои дела</h3>' + cases.map(c => '<a class="search-hit" href="' + esc(c.href) + '" target="_blank" rel="noopener noreferrer">' + glyph('BriefcaseBusiness') + '<span><b>' + esc(c.title) + '</b><small>' + esc(c.moduleLabel + ' · ' + c.number + ' · ' + c.object) + '</small></span>' + glyph('ArrowUpRight') + '</a>').join('') : '',
    records.length ? '<h3>Документы</h3>' + records.map(d => '<button class="search-hit" data-document="' + esc(d.id) + '">' + glyph('FileText') + '<span><b>' + esc(d.title) + '</b><small>' + esc(d.number + ' · ' + d.organization) + '</small></span>' + glyph('ChevronRight') + '</button>').join('') : '',
    modules.length ? '<h3>Модули</h3>' + modules.map(m => '<a class="search-hit" href="' + esc(m.url) + '" target="_blank" rel="noopener noreferrer">' + glyph(m.icon) + '<span><b>' + esc(m.title) + '</b></span>' + glyph('ArrowUpRight') + '</a>').join('') : '',
    courses.length ? '<h3>Обучение</h3>' + courses.map(c => '<a class="search-hit" data-dialog-nav href="#/learning?course=' + esc(c.id) + '">' + glyph('BookOpen') + '<span><b>' + esc(c.title) + '</b></span>' + glyph('ChevronRight') + '</a>').join('') : ''
  ].join('')
  return items || empty('По вашему запросу ничего не найдено', 'Попробуйте номер документа, название или модуль.', 'Search')
}
function aboutPanel() {
  return modalHeader('О демонстрационном стенде','CircleHelp') + '<div class="about-body"><p>Дела, назначения и этапы воспроизводят тестовые данные ВГА и СВА. Карточка открывает дело в исходном модуле. Учебные назначения взяты из модуля «Кадры».</p><p>Поручения и решения работают на примерах общего маршрута SAQ. При наличии срока у самого поручения его дата попадает в календарь. Решения и прочтения сохраняются в этом браузере.</p><p>Производственный вход через SAQ ID и обновление из рабочих модулей относятся к следующему этапу.</p></div><div class="modal-foot"><button class="button quiet" data-prepare-demo>' + glyph('RotateCcw') + 'Начать демонстрацию заново</button></div>'
}
function openOverlay(kind) {
  if (!view) return
  popup = kind
  dialog.className = 'dialog dialog-' + kind
  if (kind === 'notifications') { bellTab = 'unread'; dialog.innerHTML = bellPanel() }
  if (kind === 'profile') dialog.innerHTML = profilePanel()
  if (kind === 'about') dialog.innerHTML = aboutPanel()
  if (kind === 'search') dialog.innerHTML = modalHeader('Поиск по кабинету','Search') + '<div class="search-input">' + glyph('Search') +
    '<input id="omnibox" type="search" autocomplete="off" placeholder="Название, номер документа или модуль" aria-label="Найти в кабинете"></div><div class="search-results" id="search-results">' + searchResults('') + '</div>'
  if (!dialog.open) dialog.showModal()
  if (kind === 'search') dialog.querySelector('input').focus()
}
document.addEventListener('click', async event => {
  const target = event.target.closest('button,a')
  if (!target) return
  if (target.matches('.skip')) { event.preventDefault(); document.getElementById('main-content')?.focus(); return }
  if (target.hasAttribute('data-close')) { closeOverlay(); return }
  if (target.hasAttribute('data-show-pass')) {
    const input = document.getElementById('demo-password'), show = input.type === 'password'
    input.type = show ? 'text' : 'password'
    target.innerHTML = glyph(show ? 'EyeOff' : 'Eye')
    target.setAttribute('aria-label', show ? 'Скрыть пароль' : 'Показать пароль')
    return
  }
  if (!view) return
  if (target.hasAttribute('data-prepare-demo')) {
    dialog.innerHTML = modalHeader('Начать демонстрацию заново', 'RotateCcw') + '<div class="about-body"><p>В этом браузере будут восстановлены исходные поручения и уведомления для всех демопрофилей. Тестовые решения и отметки о прочтении будут сброшены.</p></div><div class="modal-foot"><button class="button quiet" data-close>Отмена</button><button class="button primary" data-restart-demo>Восстановить примеры</button></div>'
    return
  }
  if (target.hasAttribute('data-restart-demo')) {
    await restartDemo()
    closeOverlay(); calendarKey = ''; go('#/', true); toast('Демонстрационные примеры восстановлены'); return
  }
  if (target.hasAttribute('data-logout')) { closeOverlay(); activate(null); go('#/login', true); return }
  if (target.dataset.profile) { closeOverlay(); activate(target.dataset.profile); go('#/', true); return }
  if (target.dataset.open) { openOverlay(target.dataset.open); return }
  if (target.dataset.bellTab) { bellTab = target.dataset.bellTab; dialog.innerHTML = bellPanel(); return }
  if (target.hasAttribute('data-read-all')) {
    const count = await readNotices(profileId, view.notices.filter(n => !n.read).map(n => n.id))
    render(); if (count) toast('Уведомления отмечены прочитанными'); return
  }
  if (target.dataset.notice) {
    const notice = view.notices.find(n => n.id === target.dataset.notice)
    if (notice) openDocument(notice.entityId, notice.id)
    return
  }
  if (target.dataset.document) { openDocument(target.dataset.document); return }
  if (target.dataset.homeTab) { homeBox = target.dataset.homeTab; render(); return }
  if (target.hasAttribute('data-toggle-nav')) { collapsed = !collapsed; writeValue(localStorage, navKey, collapsed ? 'compact' : 'expanded'); render(); return }
  if (target.hasAttribute('data-mobile-nav')) { mobileMenu = !mobileMenu; render(); return }
  if (target.hasAttribute('data-dialog-nav')) closeOverlay()
  if (mobileMenu && target.matches('.nav-item,.brand')) { mobileMenu = false; render() }
})
document.addEventListener('input', event => {
  if (event.target.id === 'omnibox') dialog.querySelector('#search-results').innerHTML = searchResults(event.target.value)
})
document.addEventListener('change', event => {
  if (event.target.id === 'role-select') {
    document.querySelector('#login-name').value = event.target.value
    document.querySelector('#demo-password').value = 'demo'
    document.querySelector('#login-error').textContent = ''
  }
})
document.addEventListener('submit', event => {
  if (event.target.id !== 'login-form') return
  event.preventDefault()
  const data = new FormData(event.target)
  const id = data.get('profile')
  if (employee(id) && data.get('login').trim() === id && data.get('password') === 'demo') { activate(id); go('#/', true) }
  else document.querySelector('#login-error').textContent = 'Проверьте логин выбранного профиля и демонстрационный пароль.'
})
document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && view) { event.preventDefault(); openOverlay('search') }
  if (event.key === 'Escape' && mobileMenu && !dialog.open) { mobileMenu = false; render() }
})
dialog.addEventListener('close', () => { if (!dialog.open) popup = '' })
dialog.addEventListener('click', event => { if (event.target === dialog && !event.target.closest('.modal-heading')) {
  const box = dialog.getBoundingClientRect()
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeOverlay()
}})
window.addEventListener('hashchange', () => { mobileMenu = false; render(); window.scrollTo(0, 0) })
window.addEventListener('pageshow', event => { if (event.persisted) render() })
window.addEventListener('storage', event => { if (event.key === workflowStorageKey || event.key?.startsWith('saq.eka.team')) render() })
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && view && !dialog.open && ['home','calendar'].includes(page)) {
    const next = buildView(profileId, getWorkflow())
    if (next.today !== view.today || next.unread !== view.unread || next.active.length !== view.active.length ||
        next.active.some(t => t.overdue !== view.active.find(old => old.id === t.id)?.overdue)) render()
  }
})
render()

// Re-evaluate the two time-sensitive counters while a dashboard stays open.
setInterval(() => {
  if (!view || document.hidden || dialog.open || !['home','calendar'].includes(page)) return
  const next = buildView(profileId, getWorkflow())
  if (next.today !== view.today || next.active.some(t => t.overdue !== view.active.find(old => old.id === t.id)?.overdue)) render()
}, 60_000)
