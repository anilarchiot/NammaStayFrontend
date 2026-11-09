export function subscriptionNotice(access, isOwner, formatDate) {
  if (!access || access.state === 'complimentary' || access.state === 'suspended') return null;
  const link = isOwner ? ' <a href="settings.html?tab=billing">Review &amp; renew →</a>' : ' Please ask the owner to renew.';
  if (access.state === 'active' && (access.days_left == null || access.days_left > 7)) return null;
  if (access.pending_payment) return { text: 'Payment details received — waiting for confirmation from NammaStay.', className: 'info' };
  if (access.state === 'trial') {
    return { text: `Free trial: <b>${access.days_left} day${access.days_left === 1 ? '' : 's'} left</b>.${link}`, className: access.days_left <= 3 ? 'warn' : 'info' };
  }
  if (access.state === 'active') {
    const date = access.paid_until ? ` on <b>${formatDate(access.paid_until)}</b>` : ` in <b>${access.days_left} day${access.days_left === 1 ? '' : 's'}</b>`;
    return { text: `Your NammaStay plan ends${date}. Renew to keep managing bookings without interruption.${link}`, className: 'info', dismissible: true };
  }
  if (access.state === 'grace') {
    const end = access.ends_at && access.grace_days != null && Number.isFinite(Number(access.grace_days))
      ? new Date(new Date(access.ends_at).getTime() + Number(access.grace_days) * 86400000) : null;
    const deadline = end && !Number.isNaN(end.getTime()) ? ` on ${formatDate(end)}` : '';
    return { text: `<b>Your subscription has ended.</b> New bookings will pause when the grace period ends${deadline}.${link}`, className: 'warn' };
  }
  return { text: `<b>Subscription ended — new bookings are paused.</b> Your data is safe and still visible.${link}`, className: 'danger' };
}
