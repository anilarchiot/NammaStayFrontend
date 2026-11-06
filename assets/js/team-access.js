import { confirmDialog, rpc } from './core.js';

export async function changeBranchAccess(select, person, branch) {
  const role = select.value || null;
  const previous = select.dataset.cur || '';
  const remaining = (person.access || []).filter((access) => access.property_id !== branch.id).length;
  if (!role && !remaining && !(await confirmDialog('Remove all access?', `${person.name} will no longer be able to sign in to any of your properties.`, { confirmLabel: 'Remove', danger: true }))) {
    select.value = previous;
    return false;
  }
  try {
    await rpc('branch_access_set', { p_user: person.user_id, p_property: branch.id, p_role: role });
  } catch (error) {
    select.value = previous;
    throw error;
  }
  select.dataset.cur = role || '';
  person.access = (person.access || []).filter((access) => access.property_id !== branch.id);
  if (role) person.access.push({ property_id: branch.id, role });
  return true;
}
