import test from 'node:test'
import assert from 'node:assert/strict'
import { makeSeed } from '../workflow/data.js'
import { actOnTask, readNotification } from '../workflow/model.js'
import { buildView, defaultProfile, profiles } from '../src/model.js'
import { caseDirectory, casesPanel, filterCases, getCases } from '../src/cases.js'
import { dashboard } from '../src/dashboard.js'

const moment = new Date('2026-11-12T06:00:00Z')
const snapshot = () => makeSeed(moment)
const workspace = (profile, state) => buildView(profile, state, moment.valueOf())

test('incoming assignments state the decision requested and do not invent dates', () => {
  const view = workspace('reviewer', snapshot())
  assert.deepEqual(view.active.map(t => t.entityId).sort(), ['obj-request','prof-package','program','sva-conclusion'])
  const program = view.active.find(t => t.entityId === 'program')
  assert.equal(program.actionTitle, 'Согласовать программу аудита')
  assert.equal(program.title, 'Программа аудита')
  assert.ok(view.active.every(t => !t.overdue && !t.dueDay && t.dateLabel === 'Срок не установлен'))
  assert.deepEqual(view.events, [])
})
test('only the source deadline for this action affects the calendar and overdue count', () => {
  const state = snapshot()
  const program = state.tasks.find(t => t.id === 'task-program')
  Object.assign(program, {dueAt: '2026-11-12', dueSource: 'module'})
  const initial = workspace('reviewer', state)
  assert.equal(initial.events.length, 1)
  assert.equal(initial.events[0].title, 'Согласовать программу аудита')
  assert.equal(initial.events[0].kind, 'Срок поручения')
  assert.equal(initial.active[0].dateLabel, 'Сегодня')
  assert.equal(initial.active[0].overdue, false)
  assert.equal(buildView('reviewer',state,Date.parse('2026-11-12T19:00:00Z')).active[0].overdue, true)
  program.dueAt = '2026-11-12T05:53:00Z'
  const timed = workspace('reviewer', state)
  assert.equal(timed.active[0].overdue, true)
  assert.equal(timed.events[0].kind, 'Срок поручения · 10:53')
  assert.equal(timed.active[0].dateLabel, 'Сегодня, 10:53')
})
test('opening a notification changes only the unread count', () => {
  const state = snapshot(), before = workspace('reviewer', state)
  readNotification(state, 'notice-program', 'reviewer', moment.toISOString())
  const after = workspace('reviewer', state)
  assert.equal(after.unread, before.unread - 1)
  assert.deepEqual(after.active, before.active)
})
test('waiting steps only enter the next employee’s queue after approval', () => {
  const state = snapshot()
  assert.equal(workspace('director', state).active.length, 0)
  const next = actOnTask(state, 'task-program', 'reviewer', 'approve', '', {}, moment.toISOString())
  assert.equal(workspace('reviewer', next).active.length, 3)
  const director = workspace('director', next)
  assert.deepEqual(director.active.map(t => [t.entityId, t.actionTitle]), [['program','Утвердить программу аудита']])
  assert.equal(director.events.length, 0)
})
test('new assignments without a deadline remain in the queue only', () => {
  const state = actOnTask(snapshot(), 'task-program','reviewer','return','Уточните период.',{},moment.toISOString())
  const author = workspace('author', state)
  const revision = author.active.find(t => t.entityId === 'program')
  assert.equal(revision.dueAt, null)
  assert.equal(author.events.some(e => e.entityId === 'program'), false)
})
test('a meeting date is shown without inventing an RSVP deadline', () => {
  const view = workspace('commission', snapshot())
  const meeting = view.events.filter(e => e.entityId === 'meeting')
  assert.deepEqual(meeting.map(e => e.date), ['2026-11-14'])
  assert.ok(meeting[0].kind.includes('15:00'))
  assert.equal(workspace('reviewer', snapshot()).events.some(e => e.id === 'meeting:meeting'), false)
})
test('every visible task and notice is authorized for its recipient and module', () => {
  for (const profile of profiles) {
    const state = snapshot(), view = workspace(profile.id, state)
    for (const row of [...view.incoming,...view.outgoing,...view.notices]) {
      assert.ok(view.allowedEntities.has(row.entityId))
      assert.ok(profile.modules.includes(row.module))
      assert.ok(row.authorId === profile.id || row.recipientId === profile.id)
    }
  }
  assert.equal(workspace('region', snapshot()).allowedEntities.has('program'),false)
  assert.equal(workspace('subject', snapshot()),null)
})
test('learning uses employee assignments and counts active deadlines only', () => {
  const learner = workspace('learner', snapshot()), hr = workspace('hr', snapshot())
  assert.equal(learner.courses.length, 2)
  assert.deepEqual(learner.events.map(e => [e.courseId,e.date]), [['assignment-2-2','2026-11-20']])
  assert.deepEqual(hr.events, [])
  assert.equal(learner.modules[0].id, 'hr')
})
test('SVA calendar keeps the planned audit period separate from document deadlines', () => {
  const view = workspace('sva-auditor', snapshot())
  assert.equal(view.cases.length, 1)
  assert.equal(view.cases[0].responsible, view.primary.name)
  assert.deepEqual(view.events.map(e => e.date), ['2026-11-02','2026-11-20'])
  assert.equal(view.cases[0].eventStatus, 'Проект')
  assert.equal(view.active.length, 0)
  assert.equal(workspace('reviewer', snapshot()).cases.length, 0)
})
test('the default auditor has distinct personally assigned cases from both modules', () => {
  const view = workspace(defaultProfile, snapshot())
  assert.equal(view.primary.name, 'Жукенов Каримжан Амангельдыевич')
  assert.equal(new Set(view.cases.map(r => r.module + ':' + r.number)).size, view.cases.length)
  for (const row of view.cases) {
    assert.ok(row.assigneeIds.includes(view.primary.id))
    assert.ok(view.primary.modules.includes(row.module))
  }
  for (const [module, counts] of [['evga', [6,5,6]], ['sva',[4,0,2]]]) {
    assert.deepEqual(['active','planned','closed'].map(status => filterCases(view.cases, {status,module}).length), counts)
  }
  const created = filterCases(view.cases, {status:'active', creator:defaultProfile})
  assert.equal(created.length,6)
  assert.ok(created.every(r => r.module === 'evga'))
  assert.equal(getCases('auditor', new Set(['sva'])).length, 6)
  assert.deepEqual(getCases('region', new Set(['evga','sva'])), [])
  assert.equal(view.active.length,0)
  assert.equal(workspace('author', snapshot()).cases.length,0)
  assert.equal(view.events.some(e => e.entityId === 'program'), false)
  assert.ok(view.events.every(e => e.module === view.cases.find(r => r.id === e.caseId).moduleLabel))
})
test('home and registry show the actual stage, including specialised deep links', () => {
  const view = workspace(defaultProfile, snapshot())
  const home = casesPanel(view)
  assert.match(home, /Мои дела/)
  assert.match(home, /Подготовительный этап/)
  assert.match(home, /Заключительный этап/)
  assert.match(home, /saq-evga-test[.]vercel[.]app\/#\/cases\/case-2026-0910\/progress/)
  assert.match(home, /saq-sva-test[.]vercel[.]app\/objects\//)
  assert.doesNotMatch(home, /СВА-260921/)
  const directory = caseDirectory(view, new URLSearchParams('module=sva&status=active'))
  assert.match(directory, /СВА-260911/)
  assert.match(directory, /СВА-260923/)
  assert.doesNotMatch(directory, /30101-26-0910|СВА-260922/)
  assert.match(caseDirectory(view, new URLSearchParams('status=closed&module=sva')), /СВА-260921/)
  assert.doesNotMatch(caseDirectory(view, new URLSearchParams('created=1&status=all')), /СВА-260911/)
  const draft = workspace('sva-auditor', snapshot())
  assert.match(casesPanel(draft), /Проект/)
  assert.doesNotMatch(casesPanel(draft), /Предварительный этап/)
  assert.equal(draft.cases[0].lifecycle,'planned')
  const html = dashboard(view, {mini: () => ''}, 'in')
  assert.ok(html.indexOf('class="panel cases-panel"') < html.indexOf('class="panel queue-panel"'))
  assert.match(html, /Поручений, требующих вашего действия, нет/)
  const reviewerHtml = dashboard(workspace('reviewer',snapshot()), {mini: () => ''}, 'in')
  assert.match(reviewerHtml, /Согласовать программу аудита/)
  assert.match(reviewerHtml, /Срок не установлен/)
  assert.doesNotMatch(reviewerHtml, /СВА-260911/)
})
test('concurrent decisions and read marks persist together and repeated decisions are rejected', async () => {
  const { setWorkflowUser, getWorkflow, readNotices, applyWorkflowDecision, restartDemo } = await import('../src/workflow.js')
  const memoryStore = () => {
    const data = new Map()
    return { getItem: key => data.get(key) ?? null, setItem: (key, val) => data.set(key, String(val)), removeItem: key => data.delete(key) }
  }
  Object.defineProperty(globalThis, 'localStorage', { value: memoryStore(), configurable:true })
  Object.defineProperty(globalThis, 'sessionStorage', { value: memoryStore(), configurable:true })
  try {
    setWorkflowUser('reviewer')
    await restartDemo()
    const operations = await Promise.allSettled([
      applyWorkflowDecision('reviewer','program','task-program','approve','',{}),
      readNotices('reviewer',['notice-program']),
      applyWorkflowDecision('reviewer','program','task-program','approve','',{})
    ])
    assert.equal(operations.filter(outcome => outcome.status === 'rejected').length, 1)
    const state = getWorkflow()
    assert.ok(state.notifications.find(n => n.id === 'notice-program').readAt)
    assert.equal(state.tasks.find(t => t.id === 'task-program-final').status, 'pending')
    assert.equal(state.entities.find(d => d.id === 'program').history.filter(h => h.text === 'Документ согласован').length, 1)
    assert.equal(await readNotices('region',['notice-sur-selection']), 0)
    await restartDemo()
    const original = getWorkflow()
    assert.equal(original.tasks.find(t => t.id === 'task-program-final').status, 'waiting')
    assert.equal(original.tasks.find(t => t.id === 'task-program').status, 'pending')
  } finally {
    delete globalThis.localStorage
    delete globalThis.sessionStorage
  }
})
