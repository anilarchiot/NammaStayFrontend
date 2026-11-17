// Shared room → bed list controls for long lists (calendar, OTA).
// Markup: [data-bl-find], [data-bl-count], [data-bl-expand], [data-bl-collapse];
// .bl-group[data-room] > [data-toggle-room] + .bl-body > .bl-item[data-q] (data-q is lowercase searchable text).
// `state` = { find: string, collapsed: Set<room name> } and should outlive re-renders.

export function applyBedList(state, units) {
  const q = state.find.trim().toLowerCase();
  let shown = 0; let total = 0;
  document.querySelectorAll('.bl-group').forEach((group) => {
    let hits = 0;
    const items = group.querySelectorAll('.bl-item');
    items.forEach((item) => {
      const match = !q || item.dataset.q.includes(q);
      item.classList.toggle('bl-hide', !match);
      if (match) hits++;
    });
    total += items.length; shown += hits;
    group.classList.toggle('bl-hide', !!q && hits === 0);
    group.classList.toggle('is-collapsed', !q && state.collapsed.has(group.dataset.room));
    group.querySelector('[data-toggle-room]')?.setAttribute('aria-expanded', String(!group.classList.contains('is-collapsed')));
  });
  const count = document.querySelector('[data-bl-count]');
  if (count) count.textContent = q ? `${shown} of ${total} ${units}` : `${total} ${units}`;
}

export function wireBedList(state, units) {
  const find = document.querySelector('[data-bl-find]');
  if (find) {
    find.value = state.find;
    find.addEventListener('input', () => { state.find = find.value; applyBedList(state, units); });
  }
  document.querySelectorAll('[data-toggle-room]').forEach((btn) => {
    btn.onclick = () => {
      const room = btn.closest('.bl-group').dataset.room;
      if (state.collapsed.has(room)) state.collapsed.delete(room);
      else state.collapsed.add(room);
      applyBedList(state, units);
    };
  });
  document.querySelector('[data-bl-expand]')?.addEventListener('click', () => { state.collapsed.clear(); applyBedList(state, units); });
  document.querySelector('[data-bl-collapse]')?.addEventListener('click', () => {
    document.querySelectorAll('.bl-group').forEach((g) => state.collapsed.add(g.dataset.room));
    applyBedList(state, units);
  });
  applyBedList(state, units);
}
