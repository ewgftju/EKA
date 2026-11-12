const storageKey = 'saq.eka.team.birthdays.v1'
const dateFormat = new Intl.DateTimeFormat('ru-RU', { timeZone: 'UTC', day: 'numeric', month: 'long' })
const shortMonth = new Intl.DateTimeFormat('ru-RU', { timeZone: 'UTC', month: 'short' })
const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const headerNames = { 'фио': 'name', 'имя': 'name', 'сотрудник': 'name', 'name': 'name', 'день': 'day', 'day': 'day', 'месяц': 'month', 'month': 'month' }
const sample = '\uFEFFФИО;День;Месяц\r\nПримерова Алия;18;11\r\nҮлгібеков Данияр;3;12\r\n'
const cake = '<path d="M4 15h16v5H4zM4 15v-3a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3M4 14c1.1 2.2 3 2.2 4 0 1.1 2.2 3 2.2 4 0 1.1 2.2 3 2.2 4 0 1.1 2.2 3 2.2 4 0M8 7v3m4-5v5m4-3v3"/>'
const upload = '<path d="M12 15V4m-4 4 4-4 4 4M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3"/>'
const arrow = '<path d="M5 12h14m-5-5 5 5-5 5"/>'
let importNotice = ''

function icon(paths) {
  return `<svg class="et-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`
}

function escapeHtml(value) {
  const replacements = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
  return String(value).replace(/[&<>"']/g, char => replacements[char])
}

function normalizedName(value) {
  const name = String(value ?? '').normalize('NFKC').trim().replace(/ +/g, ' ')
  const unsafe = /[<>\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]|^[\s"'‘’“”«»]*[=+@-]/u
  if (!name || !/\p{L}/u.test(name) || unsafe.test(name)) throw Error('проверьте ФИО сотрудника.')
  return name
}

function entry(name, day, month) {
  if (!/^\d{1,2}$/.test(day) || !/^\d{1,2}$/.test(month)) throw Error('день и месяц должны быть целыми числами.')
  const d = Number(day), m = Number(month)
  const maxDay = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]
  if (!maxDay || d < 1 || d > maxDay) throw Error('такого дня в указанном месяце нет.')
  return { name: normalizedName(name), day: d, month: m }
}

function readList() {
  const raw = localStorage.getItem(storageKey)
  if (raw === null) return []
  const rows = JSON.parse(raw)
  if (!Array.isArray(rows)) throw Error('Некорректный локальный список.')
  return rows.map(row => entry(row.name, row.day, row.month))
}

function advance(birthday, from) {
  const year = from.getUTCFullYear()
  for (let y = year; ; y++) {
    const candidate = new Date(Date.UTC(y, birthday.month - 1, birthday.day))
    if (candidate >= from && candidate.getUTCMonth() === birthday.month - 1) return candidate
  }
}

function makeView(today) {
  let rows
  try { rows = readList() } catch { return { unavailable: true, rows: [], upcoming: [] } }
  const iso = (today instanceof Date ? today.toISOString() : String(today)).slice(0, 10)
  const from = new Date(iso + 'T00:00:00Z')
  if (!Number.isFinite(from.getTime())) throw Error('Для коллектива требуется дата YYYY-MM-DD.')
  const upcoming = rows.map(row => {
    const date = advance(row, from)
    return { ...row, date, days: (date - from) / 86400000 }
  }).sort((a, b) => a.date - b.date || a.name.localeCompare(b.name, 'ru'))
  rows.sort((a, b) => a.month - b.month || a.day - b.day || a.name.localeCompare(b.name, 'ru'))
  return { rows, upcoming, unavailable: false }
}

function countLabel(n) {
  const ending = n % 10
  if (n % 100 < 11 || n % 100 > 14) {
    if (ending === 1) return 'сотрудник'
    if (ending >= 2 && ending <= 4) return 'сотрудника'
  }
  return 'сотрудников'
}

function upcomingList(entries) {
  return `<ol class="et-people">${entries.map(item => {
    const relative = item.days === 0 ? 'Сегодня' : item.days === 1 ? 'Завтра' : ''
    const label = relative || dateFormat.format(item.date) + (item.days >= 365 ? ' ' + item.date.getUTCFullYear() : '')
    return `<li class="et-person"><span class="et-day" aria-hidden="true"><b>${item.day}</b><small>${shortMonth.format(item.date).replace('.', '')}</small></span><div><strong>${escapeHtml(item.name)}</strong><small class="et-person-date">${label}</small></div></li>`
  }).join('')}</ol>`
}

export function teamWidget(today) {
  const { upcoming, unavailable } = makeView(today)
  return `<section class="et-card et-widget" aria-label="Дни рождения"><div class="et-heading"><div class="et-title"><span class="et-symbol">${icon(cake)}</span><h2>Дни рождения</h2></div><a class="et-link" href="#/team">Подробнее ${icon(arrow)}</a></div>${upcoming.length ? upcomingList(upcoming.slice(0, 3)) : `<p class="et-muted">${unavailable ? 'Локальный список недоступен' : 'Сведения пока не загружены'}</p>`}</section>`
}

function allBirthdays(rows) {
  return `<section class="et-card et-year"><h2>Дни рождения по месяцам</h2><div class="et-months">${monthNames.map((name, i) => {
    const people = rows.filter(entry => entry.month === i + 1)
    if (!people.length) return ''
    return `<section class="et-month"><h3>${name}</h3><ul>${people.map(person => `<li><span class="et-day-number">${person.day}</span>${escapeHtml(person.name)}</li>`).join('')}</ul></section>`
  }).join('')}</div></section>`
}

function importCard() {
  return `<section class="et-card et-import"><div class="et-title"><span class="et-symbol et-symbol-import">${icon(upload)}</span><h2>Загрузка списка</h2></div><p>В CSV укажите ФИО, день и месяц рождения. Новые записи дополнят список.</p><a class="et-link" download="obrazec-dni-rozhdeniya.csv" href="data:text/csv;charset=utf-8,${encodeURIComponent(sample)}">Скачать образец CSV</a><div class="et-import-control"><label class="et-file"><input class="et-file-input" type="file" accept=".csv,text/csv" data-et-file><span>${icon(upload)} Выбрать CSV</span></label></div><p class="et-local">Список хранится в этом браузере и доступен его внутренним демопрофилям.</p><div class="et-feedback" role="status" aria-live="polite" data-et-feedback>${escapeHtml(importNotice)}</div></section>`
}

function mayImport(permission) {
  return typeof permission === 'function' ? permission() === true : permission === true
}

export function teamPage(today, canImport) {
  const { rows, upcoming, unavailable } = makeView(today)
  const allow = mayImport(canImport)
  const empty = unavailable ? 'Не удалось прочитать список из хранилища браузера.' : 'Сведения пока не загружены. После загрузки списка кадровой службой здесь появятся дни рождения коллег.'
  return `<div class="et-page"><div class="et-top ${allow ? 'et-with-import' : ''}"><section class="et-card"><div class="et-title"><span class="et-symbol">${icon(cake)}</span><h2>Ближайшие дни рождения</h2></div>${upcoming.length ? upcomingList(upcoming.slice(0, 4)) : `<p class="et-empty">${empty}</p>`}</section>${allow ? importCard() : ''}</div>${rows.length ? allBirthdays(rows) : ''}</div>`
}

function csvRows(csv) {
  const input = csv.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const header = input.split('\n').find(line => line.trim())
  if (!header) throw Error('Файл пуст.')
  const separator = header.includes(';') ? ';' : ','
  const result = []
  let fields = [], field = '', quoted = false, closed = false, line = 1, start = 1
  function finishField() { fields.push(field); field = ''; closed = false }
  function finishRow() {
    finishField()
    if (fields.length > 1 || fields[0].trim()) result.push({ fields, line: start })
    fields = []
    start = line + 1
  }
  for (let i = 0; i < input.length; i++) {
    const c = input[i]
    if (quoted) {
      if (c === '"' && input[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') { quoted = false; closed = true }
      else { field += c; if (c === '\n') line++ }
    } else if (c === separator) finishField()
    else if (c === '\n') { finishRow(); line++ }
    else if ((c === ' ' || c === '\t') && closed) continue
    else if (c === '"' && !field && !closed) quoted = true
    else if (closed || c === '"') throw Error(`Строка ${line}. Проверьте кавычки в CSV.`)
    else field += c
  }
  if (quoted) throw Error(`Строка ${start}. Текст в кавычках не завершён.`)
  finishRow()
  return result
}

function parseList(csv) {
  const [header, ...data] = csvRows(csv)
  const columns = header?.fields.map(v => headerNames[v.trim().toLowerCase().replace(/\./g, '')])
  if (columns?.length !== 3 || !['name', 'day', 'month'].every(key => columns.includes(key))) throw Error('В первой строке укажите три заголовка: ФИО, День, Месяц.')
  if (!data.length) throw Error('После заголовка добавьте хотя бы одну запись.')
  return data.map(({ fields, line }) => {
    if (fields.length !== 3) throw Error(`Строка ${line}. Требуются ровно три поля.`)
    const get = key => fields[columns.indexOf(key)].trim()
    try { return entry(get('name'), get('day'), get('month')) } catch (error) { throw Error(`Строка ${line}: ${error.message}`) }
  })
}

function merge(list) {
  const existing = readList()
  const unique = row => JSON.stringify([row.name.toLocaleLowerCase('ru'), row.day, row.month])
  const ids = new Set(existing.map(unique))
  let added = 0
  for (const item of list) {
    const id = unique(item)
    if (ids.has(id)) continue
    ids.add(id)
    existing.push(item)
    added++
  }
  if (added) localStorage.setItem(storageKey, JSON.stringify(existing))
  return { added, total: existing.length }
}

export function bindTeam(root, today, canImport, refresh) {
  if (!mayImport(canImport)) return
  const input = root.querySelector('[data-et-file]')
  const feedback = root.querySelector('[data-et-feedback]')
  if (!input || !feedback || input.dataset.etBound) return
  input.dataset.etBound = 'true'
  const authorized = () => mayImport(canImport) && input.isConnected && root.contains(input)
  input.addEventListener('change', async () => {
    const file = input.files?.[0]
    if (!file || !authorized()) return
    input.disabled = true
    feedback.textContent = 'Проверяем файл…'
    feedback.classList.remove('et-error')
    importNotice = ''
    try {
      const text = await file.text()
      if (!authorized()) return
      const rows = parseList(text)
      const commit = () => authorized() ? merge(rows) : null
      const result = globalThis.navigator?.locks ? await navigator.locks.request(storageKey, commit) : commit()
      if (!result || !authorized()) return
      importNotice = `Добавлено записей: ${result.added}. Всего в списке: ${result.total} ${countLabel(result.total)}.`
      feedback.textContent = importNotice
      refresh()
    } catch (error) {
      if (!authorized()) return
      const reason = error?.name === 'Error' ? error.message : 'Не удалось прочитать файл или сохранить данные в браузере.'
      feedback.textContent = `Список не изменён. ${reason}`
      feedback.classList.add('et-error')
    } finally {
      input.value = ''
      input.disabled = false
    }
  })
}
