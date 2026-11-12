import test from 'node:test'
import assert from 'node:assert/strict'
import { describeTask, describeTaskStage } from '../src/actions.js'
import { taskList } from '../src/lists.js'

test('task titles distinguish actions on the same document and describe native module assignments', () => {
  const cases = [
    ['approve', 'Программа аудита', 'Согласовать', 'Согласовать программу аудита'],
    ['approve-final', 'Программа аудита', 'Утвердить', 'Утвердить программу аудита'],
    ['revise', 'Аудиторский отчёт', 'Доработать', 'Доработать аудиторский отчёт'],
    ['acknowledge', 'Аудиторский отчёт', 'Ознакомиться', 'Ознакомиться с аудиторским отчётом'],
    ['acknowledge', 'Проверочный лист', 'Ознакомиться', 'Ознакомиться с проверочным листом'],
    ['review', 'Ответ о принятых мерах', 'Рассмотреть', 'Рассмотреть ответ объекта'],
    ['review', 'Материалы обращения для комиссии', 'Представить', 'Представить позицию по обращению'],
    ['review-selection', 'Результаты СУР для формирования перечня ВГА', 'Рассмотреть', 'Рассмотреть результаты СУР для формирования перечня ВГА'],
    ['respond', 'Требование о представлении сведений', 'Предоставить', 'Предоставить сведения по требованию'],
    ['review', 'Требование о представлении сведений', 'Рассмотреть', 'Рассмотреть ответ по требованию'],
    ['attendance', 'Заседание апелляционной комиссии', 'Подтвердить участие', 'Подтвердить участие в заседании апелляционной комиссии']
  ]
  for (const [actionId, document, action, title] of cases) {
    assert.deepEqual(describeTask(actionId, { title: document }), { action, title })
  }
})

test('unknown document titles are quoted unchanged and unknown actions do not imply approval', () => {
  const document = { title: 'Справка А-17' }
  assert.equal(describeTask('approve', document).title, 'Согласовать документ «Справка А-17»')
  assert.equal(describeTask('acknowledge', document).title, 'Ознакомиться с документом «Справка А-17»')
  assert.equal(describeTask('constructor', document).title, 'Открыть документ «Справка А-17»')
  assert.equal(describeTask('respond', null).title, 'Ответить по документу')
})

const program = {
  entityId: 'program', title: 'Программа аудита', number: 'ВГА-2026-041', module: 'evga', moduleLabel: 'ВГА',
  actionId: 'approve', action: 'Согласовать', actionTitle: 'Согласовать программу аудита', status: 'pending',
  authorName: 'Д. Омаров', recipientName: 'А. Садыков', dueAt: null, dueDay: ''
}
const auditReport = {
  ...program, entityId: 'report', title: 'Аудиторский отчёт', number: 'ВГА-2026-033', actionId: 'revise',
  action: 'Доработать', actionTitle: 'Доработать аудиторский отчёт', dueDay: '2026-11-12', dateLabel: 'Сегодня, 15:00'
}
const view = { today: '2026-11-12', incoming: [program, auditReport], outgoing: [program], modules: [] }
const list = (data, query) => taskList(data, new URLSearchParams(query))

test('inbox leads with searchable actions, document number and source and marks only source deadlines', () => {
  const html = list(view)
  assert.match(html, />Согласовать программу аудита<\/button>/)
  assert.match(html, />ВГА-2026-041<\/span>/)
  assert.match(html, /<\/i>ВГА<\/span>/)
  assert.match(html, />Срок не установлен<\/span>/)
  assert.match(html, />Сегодня, 15:00<\/span>/)
  assert.match(list(view, { q: 'доработать отчёт' }), />Доработать аудиторский отчёт<\/button>/)
  assert.doesNotMatch(list(view, { status: 'today' }), /data-document="program"/)
  assert.match(list(view, { q: 'отсутствует' }), /Показать все поручения<\/a>/)
})

test('outbox names the recipient and expected action and keeps statuses visible', () => {
  const html = list(view, { box: 'out' })
  assert.match(html, /Действие получателя<\/th>/)
  assert.match(html, /Получатель<\/th>/)
  assert.match(html, /А\. Садыков<\/td>/)
  assert.match(html, />Согласование программы аудита<\/button>/)
  assert.match(html, />В работе<\/span>/)
  assert.doesNotMatch(html, />Согласовать программу аудита<\/button>/)
})

test('waiting, returned and closed steps remain discoverable and do not prompt a new decision', () => {
  const rows = [
    { ...program, status: 'completed' }, { ...program, status: 'returned' },
    { ...program, status: 'waiting', actionId: 'approve-final', actionTitle: 'Утвердить программу аудита' }
  ]
  const html = list({ ...view, incoming: rows })
  assert.match(html, />Исполнено<\/span>/)
  assert.match(html, />Возвращено<\/span>/)
  assert.match(html, />Ожидает очереди<\/span>/)
  assert.match(html, />Утверждение программы аудита<\/button>/)
  assert.doesNotMatch(html, />Утвердить программу аудита<\/button>/)
  assert.equal(describeTaskStage('acknowledge', 'Аудиторский отчёт'), 'Ознакомление с аудиторским отчётом')
})
