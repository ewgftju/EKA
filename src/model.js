import { workflowUsers, isWorkflowDateOnly, isWorkflowTaskOverdue } from './workflow.js'
import { describeTask, describeTaskStage } from './actions.js'
import { workflowGrants as grants } from '../workflow/access.js'
import { getCourses, learningProfiles } from './learning.js'
import { caseProfiles, getCases } from './cases.js'

export const zone = 'Asia/Almaty'
const dateKey = new Intl.DateTimeFormat('sv-SE', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' })
const smallDate = new Intl.DateTimeFormat('ru-RU', { timeZone: zone, day: 'numeric', month: 'short' })
const clock = new Intl.DateTimeFormat('ru-RU', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const longDay = new Intl.DateTimeFormat('ru-RU', { timeZone: zone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
export const isoDay = stamp => dateKey.format(new Date(stamp))
export const dayTitle = stamp => longDay.format(new Date(stamp)).replace(/\s?г\.$/, '')
const plusDay = (day, count) => {
  const at = new Date(day + 'T00:00:00Z')
  at.setUTCDate(at.getUTCDate() + count)
  return at.toISOString().slice(0, 10)
}
export function displayStamp(iso, today) {
  if (!iso || !Number.isFinite(Date.parse(iso))) return 'Срок не установлен'
  const day = isoDay(iso)
  const label = day === today ? 'Сегодня' : day === plusDay(today, 1) ? 'Завтра' : smallDate.format(new Date(iso))
  return isWorkflowDateOnly(iso) ? label : label + ', ' + clock.format(new Date(iso))
}

export const catalog = {
  evga: { label: 'ВГА', title: 'Внутренний государственный аудит', description: 'Мероприятия, документы и исполнение предписаний', icon: 'Landmark', tone: 'blue', url: 'https://saq-evga-test.vercel.app/#/cases' },
  prof: { label: 'Профконтроль', title: 'Профилактический контроль', description: 'Дела контроля, проверочные листы и предписания', icon: 'ShieldCheck', tone: 'teal', url: 'https://saq-prof-test.vercel.app/' },
  objections: { label: 'Возражения', title: 'Возражения', description: 'Обращения, запросы материалов и решения комиссии', icon: 'MessagesSquare', tone: 'amber', url: 'https://saq-objections-test.vercel.app/processes' },
  sva: { label: 'СВА', title: 'Служба внутреннего аудита', description: 'Мероприятия СВА и заключения контроля качества', icon: 'ClipboardCheck', tone: 'violet', url: 'https://saq-sva-test.vercel.app/' },
  sur: { label: 'СУР', title: 'Система управления рисками', description: 'Оценка рисков и формирование перечней', icon: 'Radar', tone: 'green', url: 'https://saq-sur-test.vercel.app/' },
  reports: { label: 'Отчётность', title: 'Отчёт и аналитика', description: 'Формы отчётов управлений и сводные показатели', icon: 'ChartNoAxesCombined', tone: 'blue', url: 'https://saq-reports-test.vercel.app/#catalog' },
  hr: { label: 'Кадры', title: 'Кадровая служба', description: 'Назначенные курсы и результаты обучения', icon: 'GraduationCap', tone: 'teal', url: 'https://saq-hr-test.vercel.app/my-learning' }
}

export const defaultProfile = 'auditor'
export const profiles = [
  ...caseProfiles,
  ...Object.entries(grants).map(([id, modules]) => ({ ...workflowUsers.find(user => user.id === id), modules })),
  ...learningProfiles
]
const taskStates = {
  pending: 'В работе', waiting: 'Ожидает этапа', completed: 'Исполнено',
  returned: 'Возвращено', cancelled: 'Отменено', rejected: 'Отклонено'
}
const nameOf = id => workflowUsers.find(user => user.id === id)?.name || (id === 'system' ? 'Система SAQ' : 'Сотрудник')

export function buildView(profileId, state, now = Date.now()) {
  const primary = profiles.find(person => person.id === profileId)
  if (!primary) return null
  const today = isoDay(now)
  const modules = primary.modules.map(id => ({ id, ...catalog[id] }))
  const permitted = new Set(primary.modules)
  const allowedEntities = new Map(state.entities
    .filter(doc => permitted.has(doc.module) && doc.allowedUserIds.includes(profileId))
    .map(doc => [doc.id, doc]))

  const assignments = state.tasks.flatMap(task => {
    const doc = allowedEntities.get(task.entityId)
    if (!doc || (task.recipientId !== profileId && task.authorId !== profileId)) return []
    const module = catalog[doc.module]
    const hasDate = Boolean(task.dueAt && Number.isFinite(Date.parse(task.dueAt)))
    const instruction = describeTask(task.action, doc)
    return [{
      ...task, title: doc.title, number: doc.number, module: doc.module, moduleLabel: module.label,
      tone: module.tone, icon: module.icon, organization: doc.organization,
      action: instruction.action, actionTitle: instruction.title, stageTitle: describeTaskStage(task.action, doc), actionId: task.action,
      authorName: nameOf(task.authorId), recipientName: nameOf(task.recipientId),
      statusLabel: taskStates[task.status] || task.status,
      dueDay: hasDate ? isoDay(task.dueAt) : '',
      dateLabel: displayStamp(task.dueAt, today),
      overdue: isWorkflowTaskOverdue(task, now)
    }]
  })
  const byDeadline = (a, b) => {
    if (a.dueDay !== b.dueDay) return (a.dueDay || '9999').localeCompare(b.dueDay || '9999')
    if (a.dueDay) {
      const dayOnly = Number(isWorkflowDateOnly(a.dueAt)) - Number(isWorkflowDateOnly(b.dueAt))
      if (dayOnly) return dayOnly
      const order = Date.parse(a.dueAt) - Date.parse(b.dueAt)
      if (order) return order
    }
    return b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)
  }
  const incoming = assignments.filter(task => task.recipientId === profileId).sort(byDeadline)
  const outgoing = assignments.filter(task => task.authorId === profileId).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.step - b.step)
  const active = incoming.filter(task => task.status === 'pending')
  const notices = state.notifications.filter(note => note.recipientId === profileId && allowedEntities.has(note.entityId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
    .map(note => ({
      ...note, read: Boolean(note.readAt), moduleLabel: catalog[note.module].label,
      dateLabel: displayStamp(note.createdAt, today), authorName: nameOf(note.actorId)
    }))
  const courses = getCourses(profileId, isoDay(state.createdAt))
  const events = active.filter(task => task.dueDay).map(task => ({
    id: 'task:' + task.id, date: task.dueDay,
    title: task.actionTitle,
    module: task.moduleLabel, tone: task.overdue ? 'rose' : task.tone,
    kind: 'Срок поручения' + (isWorkflowDateOnly(task.dueAt) ? '' : ' · ' + clock.format(new Date(task.dueAt))), entityId: task.entityId
  }))
  // The existing example stores the meeting date in its document text, separately from the RSVP deadline.
  const attendance = incoming.find(task => task.entityId === 'meeting' && task.actionId === 'attendance' && !['cancelled','rejected'].includes(task.status) && task.decision !== 'no')
  const meeting = allowedEntities.get('meeting')
  const meetingTime = attendance && meeting?.content.match(/(\d{2})\.(\d{2})\.(\d{4}) в (\d{2}:\d{2})/)
  if (meetingTime) {
    const [, d, m, y, time] = meetingTime
    events.push({ id: 'meeting:' + meeting.id, date: [y, m, d].join('-'), title: meeting.title, module: catalog[meeting.module].label,
      tone: 'violet', kind: 'Заседание · ' + time, entityId: meeting.id })
  }
  for (const course of courses.filter(course => course.status === 'active' && course.dueDate)) {
    events.push({ id: 'course:' + course.id, date: course.dueDate, title: course.title, module: 'Кадры', tone: 'teal', kind: 'Срок обучения', courseId: course.id })
  }
  const cases = getCases(profileId, permitted).map(record => ({
    ...record, moduleLabel: catalog[record.module].label, tone: catalog[record.module].tone
  }))
  for (const record of cases) {
    for (const [date, label, edge] of [[record.start, 'Плановое начало', 'start'], [record.end, 'Плановое окончание', 'end']]) {
      if (date) events.push({ id: 'case:' + record.id + ':' + edge, date, title: label + ' · ' + record.number,
        module: record.moduleLabel, tone: record.tone, kind: record.object, caseId: record.id, lifecycle: record.lifecycle })
    }
  }
  return { primary, modules, allowedEntities, incoming, outgoing, active, notices, courses, cases, events, today, now,
    canViewCases: permitted.has('evga') || permitted.has('sva'),
    caseProfile: caseProfiles.some(p => p.id === profileId),
    unread: notices.filter(note => !note.read).length, learning: learningProfiles.some(p => p.id === profileId) }
}
