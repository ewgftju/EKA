// Document form adapted from the SAQ notification prototype's app.js.
import { icon } from './icons.js';
import { describeTask } from '../src/actions.js';
import { applyWorkflowDecision, canOpenWorkflowDocument, getWorkflow, getWorkflowReturnUrl,
  isWorkflowDateOnly, isWorkflowTaskOverdue, workflowStorageKey, workflowUsers } from '../src/workflow.js';

const app = document.querySelector('#content');
const dialog = document.querySelector('#decision-dialog');
const modules = {
  sur: 'Система управления рисками', evga: 'Внутренний государственный аудит',
  sva: 'Служба внутреннего аудита', prof: 'Профилактический контроль', objections: 'Возражения',
};
const actions = {
  approve: [['approve', 'Согласовать'], ['return', 'Вернуть на доработку', 'secondary', 'return'], ['reject', 'Отклонить', 'danger', 'close']],
  'approve-final': [['approve', 'Утвердить'], ['return', 'Вернуть на доработку', 'secondary', 'return'], ['reject', 'Отклонить', 'danger', 'close']],
  acknowledge: [['acknowledge', 'Подтвердить ознакомление']],
  'review-selection': [['submit-selection', 'Завершить рассмотрение']],
  attendance: [['yes', 'Буду участвовать'], ['no', 'Не смогу участвовать', 'secondary', 'close']],
  revise: [['resubmit', 'Отправить новую редакцию', 'primary', 'arrow']],
  respond: [['respond', 'Подготовить ответ', 'primary', 'arrow']],
  review: [['review', 'Завершить рассмотрение']],
};
const dialogTitles = {
  approve: 'Подтвердить решение', return: 'Вернуть на доработку', reject: 'Отклонить документ',
  acknowledge: 'Подтвердить ознакомление', yes: 'Подтвердить участие', no: 'Ответить об отсутствии',
  review: 'Результат рассмотрения', respond: 'Ответ адресату', resubmit: 'Отправить новую редакцию',
};
const commentLabels = {
  return: 'Причина возврата', reject: 'Причина отклонения', no: 'Причина отсутствия', review: 'Результат рассмотрения',
  respond: 'Текст ответа', resubmit: 'Что изменено',
};
const dateFormat = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Asia/Almaty', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});
const dateOnlyFormat = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Asia/Almaty', day: '2-digit', month: '2-digit', year: 'numeric',
});
const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => entities[c]);
const person = id => workflowUsers.find(user => user.id === id)?.name || 'Система SAQ';
let toastTimer;

function notify(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 4200);
}

function currentId() {
  const match = /^#\/document\/([^/?#]+)$/.exec(location.hash);
  if (!match) return null;
  try { return decodeURIComponent(match[1]); } catch { return null; }
}

function taskButtons(task) {
  return (actions[task.action] || []).map(([decision, label, style = 'primary', symbol = 'check']) =>
    `<button type="button" class="button ${style}" data-decision="${decision}" data-task="${esc(task.id)}">${icon(symbol)}${label}</button>`
  ).join('');
}

function due(task) {
  if (!task.dueAt || !Number.isFinite(Date.parse(task.dueAt))) return '<span>Срок не установлен</span>';
  const overdue = isWorkflowTaskOverdue(task);
  const format = isWorkflowDateOnly(task.dueAt) ? dateOnlyFormat : dateFormat;
  return `<span class="deadline-badge ${overdue ? 'overdue' : ''}" data-task-deadline="${esc(task.dueAt)}">
    <span>${overdue ? 'Срок истёк' : 'Срок выполнения'}</span>
    <time datetime="${esc(task.dueAt)}">${format.format(new Date(task.dueAt))}</time></span>`;
}

function selectionTable(entity, editable) {
  return `<div class="selection-table"><table><thead><tr><th scope="col">Объект / риск</th><th scope="col">Включить</th>
    <th scope="col">Основание исключения</th></tr></thead><tbody>${entity.items.map(item => `<tr>
    <td><strong>${esc(item.name)}</strong><span>${esc(item.risk)} риск</span></td>
    <td><input type="checkbox" class="selection-check" data-id="${esc(item.id)}" aria-label="Включить ${esc(item.name)}" ${item.include ? 'checked' : ''} ${editable ? '' : 'disabled'}></td>
    <td><input class="selection-reason" aria-label="Основание исключения ${esc(item.name)}" placeholder="Укажите причину" value="${esc(item.reason)}" ${editable && !item.include ? '' : 'disabled'}></td>
    </tr>`).join('')}</tbody></table></div>`;
}

function render() {
  const state = getWorkflow();
  const employee = workflowUsers.find(user => user.id === state.activeUserId);
  const id = currentId();
  const entity = employee && id && canOpenWorkflowDocument(state, employee.id, id) ? state.entities.find(item => item.id === id) : null;
  const back = `<a class="text-button back-link" href="${esc(getWorkflowReturnUrl())}">${icon('back')}Вернуться в ЕКА</a>`;
  const headerUser = document.querySelector('#employee');
  headerUser.innerHTML = employee ? `<span><strong>${esc(employee.name)}</strong><small>${esc(employee.role)}</small></span><span class="employee-avatar">${esc(employee.initials)}</span>` : '';
  if (!entity) {
    if (dialog.open) dialog.close();
    document.title = 'Документ недоступен · ЕКА';
    app.innerHTML = `<div class="document-navigation">${back}</div><section class="panel unavailable"><h1>Документ недоступен</h1><p>Откройте документ из своего личного кабинета.</p></section>`;
    return;
  }
  const ownTasks = state.tasks.filter(task => task.entityId === id && task.recipientId === employee.id);
  const active = ownTasks.find(task => task.status === 'pending');
  const waiting = ownTasks.some(task => task.status === 'waiting');
  const origin = modules[entity.module] || entity.module;
  document.title = `${entity.title} № ${entity.number} · ЕКА`;
  app.innerHTML = `<nav class="document-navigation" aria-label="Навигация">${back}<div class="breadcrumb">${esc(origin)}<span>/</span>Документы<span>/</span>№ ${esc(entity.number)}</div></nav>
    <div class="document-layout"><section class="panel document-panel" aria-label="Документ ${esc(entity.title)}">
      <header class="document-toolbar"><div><strong>${esc(entity.title)}</strong><span>Редакция ${esc(entity.version)} · ${esc(entity.status)}</span></div>
        ${active ? `<div class="document-actions">${taskButtons(active)}</div>` : ''}</header>
      ${active ? `<div class="document-route-meta"><span>Моё действие · <strong>${esc(describeTask(active.action, entity).title)}</strong></span><span>Инициатор · ${esc(person(active.authorId))}</span>${due(active)}</div>` : `<p class="document-route-meta">${waiting ? 'Ожидается завершение предыдущего этапа согласования.' : 'Документ открыт для просмотра.'}</p>`}
      <article class="document-sheet"><h1>${esc(entity.title)}</h1><p class="document-number">№ ${esc(entity.number)}</p>
      <dl class="document-meta"><div><dt>Организация</dt><dd>${esc(entity.organization)}</dd></div>
        <div><dt>Инициатор</dt><dd>${esc(person(entity.authorId))}</dd></div><div><dt>Редакция</dt><dd>${esc(entity.version)}</dd></div>
        <div><dt>Состояние</dt><dd>${esc(entity.status)}</dd></div></dl>
      <p class="document-content">${esc(entity.content)}</p>${entity.kind === 'selection' ? selectionTable(entity, active?.action === 'review-selection') : ''}
      ${entity.response ? `<div class="notice"><strong>Ответ адресата</strong><p>${esc(entity.response)}</p></div>` : ''}
      <p class="document-demo-note">Демонстрационная форма документа · ${esc(origin)}</p></article></section>
    <aside class="panel history-panel"><h2>История документа</h2><ol>${[...entity.history].reverse().map(event => `<li>
      <strong>${esc(event.text)}</strong><span>${esc(person(event.actorId))}</span><time datetime="${esc(event.at)}">${dateFormat.format(new Date(event.at))}</time>
      ${event.comment ? `<p>${esc(event.comment)}</p>` : ''}</li>`).join('')}</ol></aside></div>`;
}

async function submitDecision(employeeId, taskId, decision, comment = '', payload = {}) {
  try {
    await applyWorkflowDecision(employeeId, currentId(), taskId, decision, comment, payload);
    if (dialog.open) dialog.close();
    render();
    notify('Действие сохранено');
  } catch (error) {
    const errorLabel = dialog.open && dialog.querySelector('#form-error');
    if (errorLabel) errorLabel.textContent = error.message;
    else notify(error.message);
  }
}

app.addEventListener('click', event => {
  const button = event.target.closest('[data-decision]');
  if (!button) return;
  const { task: taskId, decision } = button.dataset;
  const state = getWorkflow();
  const task = state.tasks.find(item => item.id === taskId && item.entityId === currentId() && item.recipientId === state.activeUserId);
  if (!task || task.status !== 'pending' || !canOpenWorkflowDocument(state, state.activeUserId, task.entityId)) {
    render();
    notify('Поручение обновилось');
    return;
  }
  if (decision === 'submit-selection') {
    const items = Array.from(app.querySelectorAll('.selection-check'), check => ({
      id: check.dataset.id, include: check.checked, reason: check.closest('tr').querySelector('.selection-reason').value.trim(),
    }));
    submitDecision(state.activeUserId, taskId, decision, '', { items });
    return;
  }
  const commentLabel = commentLabels[decision];
  dialog.innerHTML = `<form data-employee="${esc(state.activeUserId)}" data-task="${esc(taskId)}" data-decision="${esc(decision)}">
    <div class="dialog-heading"><h2 id="dialog-title">${esc(dialogTitles[decision])}</h2><button type="button" class="icon-button" data-close aria-label="Закрыть">${icon('close')}</button></div>
    <p>${decision === 'reject' ? 'Отклонение завершит маршрут документа.' : 'Результат будет сохранён в истории документа.'}</p>
    ${commentLabel ? `<label class="textarea-label">${esc(commentLabel)} <span>*</span><textarea name="comment" rows="4" required maxlength="2000" placeholder="Введите текст…"></textarea></label>` : ''}
    <p id="form-error" class="form-error" role="alert"></p><div class="dialog-actions"><button type="button" class="button secondary" data-close>Отмена</button>
    <button type="submit" class="button primary">${['respond', 'resubmit'].includes(decision) ? 'Отправить' : 'Подтвердить'}</button></div></form>`;
  dialog.showModal();
  (dialog.querySelector('textarea') || dialog.querySelector('button[type=submit]')).focus();
});

dialog.addEventListener('click', event => { if (event.target.closest('[data-close]')) dialog.close(); });
dialog.addEventListener('submit', event => {
  event.preventDefault();
  const form = event.target;
  submitDecision(form.dataset.employee, form.dataset.task, form.dataset.decision, new FormData(form).get('comment') || '');
});
app.addEventListener('change', event => {
  if (!event.target.matches('.selection-check')) return;
  const reason = event.target.closest('tr').querySelector('.selection-reason');
  reason.disabled = event.target.checked;
  if (!reason.disabled) reason.focus();
});
document.querySelector('.skip').addEventListener('click', event => { event.preventDefault(); app.focus(); });
window.addEventListener('storage', event => { if (!event.key || event.key === workflowStorageKey) render(); });
window.addEventListener('hashchange', render);
window.addEventListener('pageshow', render);
setInterval(() => {
  const badge = app.querySelector('[data-task-deadline]');
  if (badge && !badge.classList.contains('overdue') && isWorkflowTaskOverdue({ status: 'pending', dueAt: badge.dataset.taskDeadline })) {
    badge.classList.add('overdue');
    badge.querySelector('span').textContent = 'Срок истёк';
  }
}, 30000);
render();
