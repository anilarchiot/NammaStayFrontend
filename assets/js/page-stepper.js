const GUIDES = {
  dashboard: ['Check today’s occupancy, arrivals, dues, and revenue.', 'Use Quick actions to create a booking or record a payment.', 'Open an arrival or departure to review its booking.'],
  bookings: ['Use search and filters to find the right stay.', 'Review dates, guest details, and booking status.', 'Open a booking to check guests, payments, and available actions.'],
  calendar: ['Scan room availability across the displayed dates.', 'Select a booking to open its details.', 'Use the date controls to move to the period you need.'],
  rooms: ['Create rooms or dorms and set their capacity.', 'Review rates and availability for each room or bed.', 'Keep availability up to date so bookings can be assigned correctly.'],
  payments: ['Review recorded payments and outstanding balances.', 'Filter transactions by date or payment method.', 'Record a payment from the matching booking to keep its balance current.'],
  'booking-detail': ['Check the guest, stay dates, and assigned room or bed.', 'Update booking details or status when plans change.', 'Record payments or extras and share check-in details with the guest.'],
  guests: ['Search for a guest to review their profile.', 'Check contact details and previous stays.', 'Open a stay to see its booking and payment information.'],
  checkin: ['Find an existing guest or start a new booking.', 'Enter stay dates and assign an available room or bed.', 'Review the details before saving the booking.'],
  branches: ['Compare occupancy and business results across branches.', 'Select a branch to review its activity.', 'Use the comparison to spot where follow-up is needed.'],
  formc: ['Review foreign guests who need an arrival report.', 'Complete the required guest and passport details.', 'Download the report for submission to the FRRO.'],
  housekeeping: ['Use the filters to see rooms that need attention.', 'Update a room from Dirty to Cleaning, then Ready.', 'Add a note when the team needs specific instructions.'],
  setup: ['Complete the property details first.', 'Add rooms or beds and configure payment details.', 'Invite your team, then finish the setup checklist.'],
  expenses: ['Choose a period to review income and expenses.', 'Record expenses under the category that best describes them.', 'Compare totals and margin to understand current performance.'],
  investment: ['Review money invested and payback progress.', 'Add or update investment and loan details as needed.', 'Keep legal documents and opening dates current.'],
  health: ['Review the score and the areas affecting it.', 'Start with the highest-priority actions.', 'Open an action’s link to update the related business information.'],
  tenants: ['Find a tenant to review their room and rent status.', 'Record move-ins, payments, or changes to a tenancy.', 'Use the tenant details to follow up on upcoming dues.'],
  activities: ['Review recent activity across the property.', 'Use the available filters to narrow the timeline.', 'Open a linked record when you need more context.'],
  dayvisits: ['Review today’s day visitors and their status.', 'Record a visitor with the correct visit details.', 'Update the entry when the visit ends.'],
  groups: ['Review group bookings and their stay dates.', 'Open a group to check its booking and guest details.', 'Keep room assignments and payment status up to date.'],
  ota: ['Use the NammaStay link to export availability to an OTA.', 'Add an OTA calendar link to import its bookings.', 'Use Sync now to check calendars; use the channel manager for two-way OTA syncing.'],
  pgpayments: ['Review rent and other tenant payments.', 'Filter the list to find a tenant or payment period.', 'Open a payment record to review its details.'],
  pgreport: ['Review rent, occupancy, and dues for the selected period.', 'Use the report to identify tenants who need follow-up.', 'Open the related tenant record to take action.'],
  reports: ['Choose a period to review property performance.', 'Compare bookings, revenue, and payments.', 'Export the report when you need to share or retain it.'],
  settings: ['Choose the setting area you need from the tabs.', 'Update property, team, or payment details.', 'Save changes and verify the updated information.'],
};

const TARGETS = {
  dashboard: [
    { selectors: ['.ns-content > div:first-child'], label: 'Today at a glance' },
    { selectors: ['.ns-content .ns-bars', '.ns-content [href="check-in.html?new=1"]'], label: 'Occupancy and quick actions' },
    { selectors: ['.ns-content a[href^="booking-detail.html"]'], label: 'Today’s bookings' },
  ],
  bookings: [
    { selectors: ['.ns-main .ns-search'], label: 'Booking search' },
    { selectors: ['.ns-content [data-status]'], label: 'Status filters' },
    { selectors: ['.ns-content #rows'], label: 'Bookings list' },
  ],
  calendar: [
    { selectors: ['.ns-main #today'], label: 'Calendar navigation' },
    { selectors: ['.ns-content .cal-head'], label: 'Dates and availability' },
    { selectors: ['.ns-content .cal-row'], label: 'Room bookings' },
  ],
  rooms: [
    { selectors: ['.ns-main #add-room'], label: 'Add a room type' },
    { selectors: ['.ns-content [data-bed]'], label: 'Room and bed status' },
    { selectors: ['.ns-content [data-edit]'], label: 'Room settings' },
  ],
  payments: [
    { selectors: ['.ns-content #cards'], label: 'Payment summary' },
    { selectors: ['.ns-content [data-m]'], label: 'Payment filters' },
    { selectors: ['.ns-main #record', '.ns-content #rows'], label: 'Record or review payments' },
  ],
  'booking-detail': [
    { selectors: ['.ns-dialog .ns-guestbox'], label: 'Guest details' },
    { selectors: ['.ns-dialog [name="check_in_at"]'], label: 'Stay dates' },
    { selectors: ['.ns-dialog #pay', '.ns-dialog [data-act]'], label: 'Booking actions' },
  ],
  guests: [
    { selectors: ['.ns-main .ns-search', '.ns-content .ns-guestbox'], label: 'Find a guest' },
    { selectors: ['.ns-content #notes', '.ns-content #view-id'], label: 'Guest profile details' },
    { selectors: ['.ns-content table'], label: 'Stay history' },
  ],
  checkin: [
    { selectors: ['.ns-content .ci-new', '.ns-content [name="full_name"]'], label: 'Guest details or new registration' },
    { selectors: ['.ns-content [name="check_in_at"]', '.ns-content .ci-row'], label: 'Stay dates and arrivals' },
    { selectors: ['.ns-content #checkin-now', '.ns-content [data-checkin]'], label: 'Confirm check-in' },
  ],
  branches: [
    { selectors: ['.ns-content .br-grid'], label: 'Branch overview' },
    { selectors: ['.ns-content .br-cmp'], label: 'Branch comparison' },
    { selectors: ['.ns-content .br-team'], label: 'Branch team' },
  ],
  formc: [
    { selectors: ['.ns-content .fc-intro'], label: 'Form C requirements' },
    { selectors: ['.ns-content #fc-tabs'], label: 'Report status filters' },
    { selectors: ['.ns-content .fc-row [data-copy]', '.ns-content .fc-row'], label: 'Guest report actions' },
  ],
  housekeeping: [
    { selectors: ['.ns-content #hk-filter'], label: 'Housekeeping filters' },
    { selectors: ['.ns-content .hk-tile'], label: 'Room status' },
    { selectors: ['.ns-content .hk-more'], label: 'Team notes and status' },
  ],
  setup: [
    { selectors: ['.ns-content .su-track'], label: 'Setup progress' },
    { selectors: ['.ns-content #su-body .su-grid', '.ns-content #su-rows'], label: 'Property and room details' },
    { selectors: ['.ns-content #su-next'], label: 'Save and continue' },
  ],
  expenses: [
    { selectors: ['.ns-content .pf-kpi'], label: 'Income and expense summary' },
    { selectors: ['.ns-content .pf-grid'], label: 'Expense breakdown' },
    { selectors: ['.ns-content table', '.ns-main #add'], label: 'Expense records' },
  ],
  investment: [
    { selectors: ['.ns-content .ivs-ms-grid'], label: 'Investment progress' },
    { selectors: ['.ns-content #docs'], label: 'Legal documents' },
    { selectors: ['.ns-content #licences'], label: 'Licences checklist' },
  ],
  health: [
    { selectors: ['.ns-content .bhx-score-box'], label: 'Business health score' },
    { selectors: ['.ns-content .bhx-todo'], label: 'Priority actions' },
    { selectors: ['.ns-content .bhx-grid'], label: 'Health details' },
  ],
  tenants: [
    { selectors: ['.ns-content .pg-table', '.ns-content table'], label: 'Tenant list' },
    { selectors: ['.ns-main #movein', '.ns-content [data-tenant]'], label: 'Tenant records' },
    { selectors: ['.ns-content [data-payment]', '.ns-content table'], label: 'Rent and dues' },
  ],
  activities: [
    { selectors: ['.ns-content .pf-kpi'], label: 'Activity summary' },
    { selectors: ['.ns-content #a-list'], label: 'Activity list' },
    { selectors: ['.ns-main #add', '.ns-content [data-add]'], label: 'Activity setup' },
  ],
  dayvisits: [
    { selectors: ['.ns-content .pf-kpi'], label: 'Visitor summary' },
    { selectors: ['.ns-content table'], label: 'Visitor records' },
    { selectors: ['.ns-content table:last-of-type'], label: 'Packages and activities' },
  ],
  groups: [
    { selectors: ['.ns-content table tbody tr'], label: 'Group bookings' },
    { selectors: ['.ns-content .pf-kpi'], label: 'Group totals and payments' },
    { selectors: ['.ns-content table'], label: 'Rooms in the group' },
  ],
  ota: [
    { selectors: ['.ns-content .ota-export'], label: 'Export NammaStay calendar' },
    { selectors: ['.ns-content .ota-add'], label: 'Import an OTA calendar' },
    { selectors: ['.ns-main #sync-now', '.ns-content #cx-sync'], label: 'Sync calendars and channel manager' },
  ],
  pgpayments: [
    { selectors: ['.ns-content .pf-kpi'], label: 'Rent payment summary' },
    { selectors: ['.ns-content [data-filter]', '.ns-content .ns-chips'], label: 'Payment filters' },
    { selectors: ['.ns-content table'], label: 'Payment records' },
  ],
  pgreport: [
    { selectors: ['.ns-content .pf-kpi'], label: 'Rent and occupancy summary' },
    { selectors: ['.ns-content .ns-card'], label: 'Report breakdown' },
    { selectors: ['.ns-content table'], label: 'Report details' },
  ],
  reports: [
    { selectors: ['.ns-main #range'], label: 'Report period' },
    { selectors: ['.ns-content .pf-grid'], label: 'Performance summary' },
    { selectors: ['.ns-content table'], label: 'Room performance details' },
  ],
  settings: [
    { selectors: ['.ns-main > [style*="height:56px"]'], label: 'Settings sections' },
    { selectors: ['.ns-content #prop', '.ns-content .ns-card'], label: 'Property settings' },
    { selectors: ['.ns-content button[id^="save"]'], label: 'Save settings' },
  ],
};

export function mountPageStepper(ctx, route) {
  const host = document.querySelector('.ns-content');
  if (!host || !route || !ctx?.user?.id) return;

  const pageKey = route.key || route.path.replace(/\.html$/, '');
  const storageKey = `ns.page-stepper:${ctx.user.id}:${pageKey}`;
  try { if (localStorage.getItem(storageKey) === 'done') return; } catch { /* Storage may be unavailable. */ }

  const messages = GUIDES[pageKey] || [`Review the information on ${route.title}.`, 'Use the available controls to find or update what you need.', 'Open a related record for more detail.'];
  const targets = TARGETS[pageKey] || [];
  let activeStep = 0;
  const backdrop = document.createElement('div');
  backdrop.className = 'ns-page-stepper-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');
  const guide = document.createElement('section');
  guide.className = 'ns-card ns-page-stepper';
  guide.setAttribute('aria-label', `${route.title} guide`);
  guide.innerHTML = `<div class="ns-page-stepper-copy"><div class="ns-page-stepper-heading"><b>Quick guide · ${route.title}</b><span data-progress></span></div>
    <p data-step aria-live="polite"></p><div class="ns-page-stepper-focus" data-focus></div><div class="ns-page-stepper-track" role="progressbar" aria-label="Guide progress" aria-valuemin="1" aria-valuemax="${messages.length}"><i data-bar></i></div></div>
    <div class="ns-page-stepper-actions"><button type="button" class="ns-btn-ghost" data-back>Back</button><button type="button" class="ns-btn-ghost" data-dismiss>Dismiss</button><button type="button" class="ns-btn-ghost" data-show>Show section</button><button type="button" class="ns-btn" data-next>Next</button></div>`;

  const progress = guide.querySelector('[data-progress]');
  const stepText = guide.querySelector('[data-step]');
  const focusText = guide.querySelector('[data-focus]');
  const bar = guide.querySelector('[data-bar]');
  const back = guide.querySelector('[data-back]');
  const show = guide.querySelector('[data-show]');
  const next = guide.querySelector('[data-next]');
  let highlighted = null;
  let elevatedOverlay = null;
  let observer = null;
  const findTarget = () => {
    const config = targets[activeStep];
    const selectors = config?.selectors || [];
    for (const selector of selectors) {
      const match = document.querySelector(selector);
      if (match && !guide.contains(match)) return match.matches('input,select,textarea') ? match.closest('.ns-field') || match : match;
    }
    return [...host.children].find((child) => child !== guide) || null;
  };
  const clearHighlight = () => {
    highlighted?.classList.remove('ns-page-stepper-target');
    elevatedOverlay?.classList.remove('ns-page-stepper-modal');
    elevatedOverlay = null;
    highlighted = null;
  };
  const showTarget = () => {
    if (!highlighted) return;
    highlighted.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  const finish = () => {
    try { localStorage.setItem(storageKey, 'done'); } catch { /* The guide still dismisses for this visit. */ }
    observer?.disconnect();
    clearHighlight();
    backdrop.remove();
    guide.remove();
  };
  const render = (scroll = false) => {
    clearHighlight();
    guide.classList.add('ns-page-stepper-soft-pulse');
    const targetConfig = targets[activeStep];
    highlighted = findTarget();
    elevatedOverlay = highlighted?.closest('.ns-overlay') || null;
    elevatedOverlay?.classList.add('ns-page-stepper-modal');
    highlighted?.classList.add('ns-page-stepper-target', 'ns-page-stepper-soft-pulse');
    progress.textContent = `Step ${activeStep + 1} of ${messages.length}`;
    stepText.textContent = messages[activeStep];
    focusText.textContent = `On this page: ${targetConfig?.label || route.title}`;
    bar.style.width = `${((activeStep + 1) / messages.length) * 100}%`;
    guide.querySelector('.ns-page-stepper-track').setAttribute('aria-valuenow', String(activeStep + 1));
    back.disabled = activeStep === 0;
    next.textContent = activeStep === messages.length - 1 ? 'Finish' : 'Next';
    show.disabled = !highlighted;
    if (scroll) showTarget();
  };
  back.addEventListener('click', () => { if (activeStep > 0) { activeStep--; render(true); } });
  next.addEventListener('click', () => { if (activeStep === messages.length - 1) finish(); else { activeStep++; render(true); } });
  show.addEventListener('click', showTarget);
  guide.querySelector('[data-dismiss]').addEventListener('click', finish);
  document.body.append(backdrop);
  host.parentNode.insertBefore(guide, host);
  render();
  observer = new MutationObserver(() => render());
  observer.observe(host, { childList: true, subtree: true });
}