import test from 'node:test'
import assert from 'node:assert/strict'
import { makeSeed } from '../workflow/data.js'
import { actOnTask, readNotification } from '../workflow/model.js'
import { buildView, profiles } from '../src/model.js'

const moment = new Date('2026-11-12T06:00:00Z')
const snapshot = () => makeSeed(moment)
const workspace = (profile, state) => buildView(profile, state, moment.valueOf())

test('the same four live assignments feed metrics, lists and date cells', () => {
  const view = workspace('reviewer', snapshot())
  assert.equal(view.active.length, 4)
  assert.deepEqual(view.active.filter(t => t.overdue).map(t => t.number), ['ВОЗ-2026-027'])
  assert.deepEqual(view.events.map(e => e.entityId).sort(), view.active.map(t => t.entityId).sort())
  assert.equal(view.events.some(e => e.entityId === 'sur-ready'), false)
  const withToday = view.active.filter(t => t.dueDay === view.today)
  assert.deepEqual(withToday.map(t => t.entityId), ['obj-request', 'program'])
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
  assert.deepEqual(director.active.map(t => [t.entityId, t.action]), [['program','Утверждение']])
  assert.equal(director.events.length, 1)
})
test('new assignments without a deadline remain in the queue only', () => {
  const state = actOnTask(snapshot(), 'task-program','reviewer','return','Уточните период.',{},moment.toISOString())
  const author = workspace('author', state)
  const revision = author.active.find(t => t.entityId === 'program')
  assert.equal(revision.dueAt, null)
  assert.equal(author.events.some(e => e.entityId === 'program'), false)
})
test('a commission member sees the RSVP deadline and meeting date as separate events', () => {
  const view = workspace('commission', snapshot())
  const meeting = view.events.filter(e => e.entityId === 'meeting')
  assert.deepEqual(meeting.map(e => e.date), ['2026-11-13','2026-11-14'])
  assert.ok(meeting[1].kind.includes('15:00'))
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
