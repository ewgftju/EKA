// Initial assignments from saq-hr-test at d04288c0, hr_frontend/src/data/seed.ts.
export const learningProfiles = [
  {
    id: 'learner', employeeId: 'employee-2', name: 'Алиев Данияр Ерланович',
    role: 'Главный эксперт', org: 'Управление государственного аудита',
    initials: 'АД', modules: ['hr']
  },
  {
    id: 'hr', employeeId: 'employee-10', name: 'Ахметова Мадина Ермековна',
    role: 'Специалист кадровой службы', org: 'Кадровая служба',
    initials: 'АМ', modules: ['hr'], canImport: true
  }
]

// completed is the presence of completedAt in the HR seed after grading attempts.
// The seeded pass for assignment-2-1 includes a score. Course 4 has no test.
const assignments = [
  {
    id: 'assignment-2-2', employeeId: 'employee-2', courseId: 'course-2',
    title: 'Информационная безопасность', deadlineOffset: 8, completed: false,
    progressLabel: '1 из 2 уроков · итоговый тест не начат'
  },
  {
    id: 'assignment-2-1', employeeId: 'employee-2', courseId: 'course-1',
    title: 'Основы государственного аудита', deadlineOffset: 5, completed: true,
    progressLabel: '2 из 2 уроков · итоговый тест сдан на 100 %'
  },
  {
    id: 'assignment-10-4', employeeId: 'employee-10', courseId: 'course-4',
    title: 'Работа в системе SAQ', deadlineOffset: 10, completed: true,
    progressLabel: '2 из 2 уроков · курс без итогового теста'
  }
]

function deadlineFrom(anchorDate, offset) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchorDate)) return null
  const date = new Date(anchorDate + 'T00:00:00Z')
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== anchorDate) return null
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}

export function getCourses(profileId, anchorDate) {
  const profile = learningProfiles.find(item => item.id === profileId)
  if (!profile) return []
  return assignments.filter(item => item.employeeId === profile.employeeId).map(item => ({
    id: item.id,
    title: item.title,
    number: '',
    dueDate: deadlineFrom(anchorDate, item.deadlineOffset),
    status: item.completed ? 'done' : 'active',
    progressLabel: item.progressLabel,
    href: 'https://saq-hr-test.vercel.app/courses/' + item.courseId,
    note: `Для просмотра личного прогресса в модуле «Кадры» выберите режим «Сотрудник» и профиль «${profile.name}».`
  }))
}
