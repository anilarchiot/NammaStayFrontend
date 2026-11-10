import { LIVE, rpc, rupees, sb, W } from '../core.js';
import { createStage, stageMarkup } from './purni-stage.js';
import { localVoices as getLocalVoices, speakLocal, voiceHelpText } from '../local-voice.js';

const SHORTCUTS = [
  ["Today's snapshot", 'What is happening today?'],
  ['Occupancy', 'How many beds are available?'],
  ['Arrivals', 'How many arrivals are expected today?'],
  ['Pending dues', 'How much is still due?'],
  ['Housekeeping', 'What needs cleaning?'],
  ['Form C', 'Are any Form C reports due?'],
];

export function mountPurni(ctx) {
  if (document.getElementById('purni-root')) return;

  const root = document.createElement('div');
  root.id = 'purni-root';
  root.className = 'purni-root';
  root.innerHTML = `
    <section class="purni-panel" id="purni-panel" role="dialog" aria-modal="false" aria-labelledby="purni-title" hidden>
      <header class="purni-head">
        <div class="purni-mark" aria-hidden="true">P</div>
        <div class="purni-head-copy"><h2 id="purni-title">Purni</h2><p><span class="purni-status-dot"></span>Ready for ${escapeHtml(ctx.property_name)} questions</p></div>
        <button type="button" class="purni-wa" id="purni-wa" aria-label="Connect Purni to WhatsApp" title="Connect Purni to WhatsApp" hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 11.5a8.5 8.5 0 0 1-12.8 7.3L3 20l1.2-4.4A8.5 8.5 0 1 1 20.5 11.5Z"></path><path d="M9 8.5c.3-.6.7-.6 1-.1l.8 1.3c.2.3.1.6-.2.9l-.5.5c.6 1.1 1.5 2 2.6 2.6l.5-.5c.3-.3.6-.4.9-.2l1.3.8c.5.3.5.7-.1 1-1 .6-2.1.5-3.5-.2a9.5 9.5 0 0 1-3.5-3.5C8.5 10.6 8.4 9.5 9 8.5Z"></path></svg>
        </button>
        <button type="button" class="purni-close" aria-label="Close Purni">×</button>
      </header>
      <div class="purni-stage" id="purni-stage" role="button" tabindex="0" aria-label="Say hi to Purni" data-mood="idle" data-pose="rest" data-mouth="smile">${stageMarkup}</div>
      <details class="purni-settings">
        <summary>Assistant settings</summary>
        <div class="purni-settings-body">
          ${ctx.can('owner') ? `<form id="purni-name-form"><label for="purni-name">Assistant name for this property</label>
            <input class="ns-input" id="purni-name" maxlength="40" required value="Purni"><button class="ns-btn" type="submit" disabled>Save name</button></form>` : ''}
          <label for="purni-voice">Voice on this device</label>
          <select class="ns-input" id="purni-voice" aria-describedby="purni-voice-help"><option value="">Off</option></select>
          <small id="purni-voice-help">Voice is off until you choose a local voice. Replies may be heard by people nearby.</small>
          <div id="purni-settings-status" role="status"></div>
        </div>
      </details>
      <div class="purni-messages" id="purni-messages" aria-live="polite" aria-relevant="additions"></div>
      <div class="purni-suggestions" id="purni-suggestions" aria-label="Suggested questions"></div>
      <form class="purni-form" id="purni-form">
        <label class="purni-sr-only" for="purni-input">Ask Purni</label>
        <input id="purni-input" name="question" maxlength="240" autocomplete="off" placeholder="Ask about your property…" required>
        <button type="submit" aria-label="Send question" title="Send question"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2 11 13"></path><path d="m22 2-7 20-4-9-9-4Z"></path></svg></button>
      </form>
      <p class="purni-note">I can organize your day. You approve changes to records or guest messages.</p>
    </section>
    <button type="button" class="purni-launcher" id="purni-launcher" aria-controls="purni-panel" aria-expanded="false">
      <svg class="purni-avatar" width="38" height="38" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <circle cx="24" cy="24" r="23" fill="#FDF2D7"/>
        <path class="purni-avatar-hair" d="M11 22c0-10 5-16 13-16s13 6 13 16v9H11z" fill="#26304A"/>
        <g class="purni-avatar-body"><path d="M9 46c1-8 7-13 15-13s14 5 15 13" fill="#E88855"/>
        <path d="M20 30h8v6c-2 2-6 2-8 0z" fill="#B56D4D"/>
        <g class="purni-avatar-head">
          <ellipse cx="24" cy="21" rx="10" ry="12" fill="#D99972"/>
          <path d="M14 20c0-9 4-13 10-13 7 0 10 5 10 13-3-1-6-4-7-7-3 4-8 6-13 7z" fill="#26304A"/>
          <circle cx="24" cy="17" r="1.2" fill="#B93139"/>
          <g class="purni-avatar-gaze"><g class="purni-avatar-eyes"><circle cx="20" cy="22" r="1" fill="#26304A"/><circle cx="28" cy="22" r="1" fill="#26304A"/></g></g>
          <path d="M20.5 27c2 2 5 2 7 0" fill="none" stroke="#8D4B3D" stroke-width="1.4" stroke-linecap="round"/>
          <circle cx="13.8" cy="24" r="1.4" fill="#E4A73F"/><circle cx="34.2" cy="24" r="1.4" fill="#E4A73F"/>
        </g>
        <g class="purni-avatar-arm"><path d="M34 38c2-3 4-5 5-8" fill="none" stroke="#E88855" stroke-width="5" stroke-linecap="round"/><g class="purni-avatar-hand"><path d="M39 31c-2-2-2-5-1-7 .5-1 1.4-.7 1.5.3l.2 2.1 1-3c.4-1 1.3-.6 1.2.3l-.5 3 1-1.6c.6-.8 1.4-.2 1 .7l-1.4 3.6c-.7 1.5-2 2-3 1.6z" fill="#D99972"/></g></g>
        </g>
      </svg>
      <span>Ask Purni</span>
    </button>`;
  document.body.append(root);

  const panel = root.querySelector('#purni-panel');
  const launcher = root.querySelector('#purni-launcher');
  const avatar = root.querySelector('.purni-avatar');
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
  const blink = () => {
    if (!calm.matches && !document.hidden) {
      avatar.classList.add('is-blinking');
      setTimeout(() => avatar.classList.remove('is-blinking'), 150);
      if (Math.random() < 0.25) setTimeout(() => { avatar.classList.add('is-blinking'); setTimeout(() => avatar.classList.remove('is-blinking'), 150); }, 320);
    }
    setTimeout(blink, 2200 + Math.random() * 4800);
  };
  setTimeout(blink, 1800);
  let greetTimer;
  document.addEventListener('focusin', (e) => {
    if (calm.matches || root.contains(e.target) || !e.target.matches?.('input,textarea,select')) return;
    avatar.classList.remove('is-greeting');
    void avatar.getBoundingClientRect();
    avatar.classList.add('is-greeting');
    clearTimeout(greetTimer);
    greetTimer = setTimeout(() => avatar.classList.remove('is-greeting'), 2200);
  });
  const messages = root.querySelector('#purni-messages');
  const suggestions = root.querySelector('#purni-suggestions');
  const input = root.querySelector('#purni-input');
  const form = root.querySelector('#purni-form');
  const stage = createStage(root.querySelector('#purni-stage'), { panel, input, suggestions });
  const whatsappButton = root.querySelector('#purni-wa');
  const voiceSelect = root.querySelector('#purni-voice');
  const voiceHelp = root.querySelector('#purni-voice-help');
  const settingsStatus = root.querySelector('#purni-settings-status');
  const nameForm = root.querySelector('#purni-name-form');
  const voiceKey = `ns.purni.voice.${ctx.user.id}.${ctx.property_id}`;
  let assistantName = 'Purni';
  let voiceId = '';
  let localVoices = [];
  try { voiceId = localStorage.getItem(voiceKey) || ''; }
  catch (error) { console.warn('Assistant voice preference could not be loaded', error); }

  function setName(name) {
    assistantName = name;
    stage.setName(name);
    root.querySelector('#purni-title').textContent = name;
    root.querySelector('.purni-mark').textContent = Array.from(name)[0].toUpperCase();
    root.querySelector('.purni-launcher span').textContent = `Ask ${name}`;
    root.querySelector('label[for="purni-input"]').textContent = `Ask ${name}`;
    root.querySelector('.purni-close').setAttribute('aria-label', `Close ${name}`);
    whatsappButton.setAttribute('aria-label', `Connect ${name} to WhatsApp`);
    whatsappButton.title = `Connect ${name} to WhatsApp`;
    if (nameForm) nameForm.querySelector('input').value = name;
  }
  rpc('property_assistant_name', { p_property: ctx.property_id }).then((name) => {
    setName(name);
    if (nameForm) nameForm.querySelector('button').disabled = false;
  }).catch((error) => {
    console.error('Assistant name could not be loaded', error);
    settingsStatus.textContent = `Assistant name could not be loaded: ${error.message}`;
    root.querySelector('.purni-settings').open = true;
  });
  nameForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = nameForm.querySelector('button');
    button.disabled = true;
    try {
      const name = await rpc('set_property_assistant_name', { p_property: ctx.property_id, p_name: nameForm.querySelector('input').value });
      setName(name);
      settingsStatus.textContent = 'Name saved for this property. Other devices will see it when they reload.';
    } catch (error) { settingsStatus.textContent = `Could not save name: ${error.message}`; }
    finally { button.disabled = false; }
  });

  const speech = window.speechSynthesis;
  const supported = speech && typeof window.SpeechSynthesisUtterance === 'function';
  function updateVoices() {
    localVoices = getLocalVoices(speech);
    voiceSelect.replaceChildren(new Option('Off', ''));
    for (const voice of localVoices) voiceSelect.add(new Option(`${voice.name} (${voice.lang})`, voice.voiceURI));
    voiceHelp.textContent = voiceHelpText(voiceId, localVoices);
    voiceSelect.value = localVoices.some((voice) => voice.voiceURI === voiceId) ? voiceId : '';
  }
  if (supported) {
    updateVoices();
    speech.addEventListener('voiceschanged', updateVoices);
    voiceSelect.addEventListener('change', () => {
      voiceId = voiceSelect.value;
      voiceHelp.textContent = voiceHelpText(voiceId, localVoices);
      try { localStorage.setItem(voiceKey, voiceId); }
      catch (error) { settingsStatus.textContent = 'Voice preference could not be saved on this device.'; console.warn(error); }
      speech.cancel();
    });
  } else {
    voiceSelect.disabled = true;
    voiceHelp.textContent = 'Voice is not supported on this device.';
  }
  function speak(text) {
    if (!supported || !voiceId || panel.hidden) return;
    if (!speakLocal(speech, window.SpeechSynthesisUtterance, voiceId, text, () => {
      settingsStatus.textContent = 'Voice playback failed. Check your device voice settings.';
      root.querySelector('.purni-settings').open = true;
    })) {
      voiceHelp.textContent = 'The saved voice is unavailable on this device. Choose another local voice or turn voice off.';
    }
  }

  const addMessage = (text, sender, link, extraClass = '') => {
    const item = document.createElement('div');
    item.className = `purni-message is-${sender} ${extraClass}`.trim();
    const bubble = document.createElement('p');
    bubble.textContent = text;
    item.append(bubble);
    if (link) {
      const anchor = document.createElement('a');
      anchor.href = link.href;
      anchor.textContent = link.label;
      if (/^https:\/\//i.test(link.href)) {
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
      }
      item.append(anchor);
    }
    messages.append(item);
    messages.scrollTop = messages.scrollHeight;
    return item;
  };

  const open = (show) => {
    panel.hidden = !show;
    launcher.setAttribute('aria-expanded', String(show));
    if (show) { input.focus(); stage.start(ctx.name?.trim().split(/\s+/)[0]); }
    else { stage.stop(); if (supported && voiceId) speech.cancel(); }
  };

  const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Kolkata' }).format(new Date()));
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = ctx.name?.trim().split(/\s+/)[0] || 'there';
  const initialShortcuts = ctx.isPg
    ? [['Rent due', 'How much rent is still due?'], ['Vacant beds', 'How many beds are available?'], ['Tenants', 'Open tenants and rent']]
    : SHORTCUTS;
  let firstEntry = false;
  try {
    const welcomeKey = `ns.purni.entered.${ctx.user?.id || firstName}.${ctx.property_id}`;
    firstEntry = sessionStorage.getItem(welcomeKey) !== '1';
    if (firstEntry) sessionStorage.setItem(welcomeKey, '1');
  } catch { firstEntry = true; }
  if (firstEntry) {
    open(true);
    addMessage(`${greeting}, ${firstName}. I’m checking today’s board and will line up anything that needs attention.`, 'purni', null, 'is-welcome');
    const status = addMessage('Reviewing today’s tasks…', 'purni');
    status.setAttribute('role', 'status');
    dailyBriefing(ctx).then((brief) => {
      status.remove();
      stage.onAnswer(brief.summary);
      addMessage(brief.summary, 'purni', null, 'is-briefing');
      if (brief.tasks.length) brief.tasks.forEach((task) => addMessage(task.text, 'purni', task.link, 'is-task'));
      else addMessage('Your board looks clear for now. I’ll be here if anything changes.', 'purni');
      setSuggestions(brief.prompts || SHORTCUTS);
    }).catch(() => {
      status.remove();
      addMessage(`I’m here, ${firstName}. I couldn’t load today’s board just now, but I haven’t changed anything. We can try again or open a task directly.`, 'purni');
      setSuggestions(initialShortcuts);
    });
  } else {
    addMessage(`${greeting}, ${firstName}. I’m ready to help with today’s property tasks. What should we look at?`, 'purni', null, 'is-welcome');
    setSuggestions(initialShortcuts);
  }

  launcher.addEventListener('click', () => open(panel.hidden));
  root.querySelector('.purni-close').addEventListener('click', () => open(false));
  if (LIVE) {
    whatsappButton.hidden = false;
    whatsappButton.addEventListener('click', async () => {
      whatsappButton.disabled = true;
      try {
        const status = await invokeWhatsApp({ action: 'status' });
        if (status.linked) {
          if (!window.confirm(`Disconnect ${assistantName} from the WhatsApp number ending in ${status.phone_last4}?`)) return;
          await invokeWhatsApp({ action: 'unlink' });
          addMessage(`${assistantName} is disconnected from WhatsApp. You can link it again any time.`, 'purni');
          return;
        }

        const pairing = await invokeWhatsApp({ action: 'pair' });
        const phone = String(pairing.phone_number || '').replace(/\D/g, '');
        const code = String(pairing.code || '');
        if (!/^\d{8,15}$/.test(phone) || !/^purni-[0-9a-f]{32}$/.test(code)) {
          throw new Error('The WhatsApp connection is not configured correctly.');
        }
        addMessage(`This links your WhatsApp number to your TheNammaStay account so ${assistantName} can reply with read-only property summaries. Tap below and send the pre-filled message; the one-time link expires in 10 minutes. Message “unlink” any time to disconnect.`, 'purni', {
          href: `https://wa.me/${phone}?text=${encodeURIComponent(code)}`,
          label: 'Open WhatsApp to connect',
        });
      } catch (error) {
        console.error('Purni WhatsApp connection failed', error);
        addMessage('I could not connect WhatsApp just now. Please check the Meta WhatsApp setup or try again later.', 'purni');
      } finally {
        whatsappButton.disabled = false;
      }
    });
  }
  root.addEventListener('click', (event) => {
    const button = event.target.closest('[data-prompt]');
    if (button) ask(button.dataset.prompt);
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    ask(input.value.trim());
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) open(false);
  });

  async function ask(question) {
    if (!question || input.disabled) return;
    addMessage(question, 'user');
    stage.onAsk();
    input.value = '';
    input.disabled = true;
    suggestions.hidden = true;
    const pending = document.createElement('div');
    pending.className = 'purni-message is-purni';
    pending.setAttribute('role', 'status');
    pending.setAttribute('aria-label', `${assistantName} is checking your property`);
    pending.innerHTML = '<span class="purni-thinking"><i></i><i></i><i></i></span>';
    messages.append(pending);
    messages.scrollTop = messages.scrollHeight;

    try {
      const result = await answer(question);
      pending.remove();
      stage.onAnswer(result.text, question);
      addMessage(result.text, 'purni', result.link);
      result.tasks?.forEach((task) => addMessage(task.text, 'purni', task.link, 'is-task'));
      speak([result.text, ...(result.tasks || []).map((task) => task.text)].join(' '));
      setSuggestions(result.prompts || SHORTCUTS.slice(0, 3));
    } catch {
      pending.remove();
      stage.onFail();
      addMessage('I couldn’t reach that property information just now. Give it another try in a moment.', 'purni');
      setSuggestions(SHORTCUTS.slice(0, 3));
    } finally {
      input.disabled = false;
      input.focus();
    }
  }

  async function answer(question) {
    const q = question.toLowerCase();
    const firstName = ctx.name?.trim().split(/\s+/)[0] || 'there';
    const greetingQuestion = q.replace(/[!. ]+$/, '');
    const greetingWithoutName = greetingQuestion.endsWith(` ${assistantName.toLowerCase()}`)
      ? greetingQuestion.slice(0, -assistantName.length).trim() : greetingQuestion;
    if (/^(hi|hello|hey|good morning|good afternoon|good evening)$/.test(greetingWithoutName)) {
      const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Kolkata' }).format(new Date()));
      const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
      return { text: `${timeGreeting}, ${firstName}! Good to see you. I’ve got today’s board ready. Want the priorities first, or should we look at something specific?`, prompts: [['Today’s tasks', 'What needs doing today?'], ...initialShortcuts.slice(0, 2)] };
    }
    if (/\b(thanks|thank you|cheers)\b/.test(q)) {
      return { text: `You’re welcome, ${firstName}. I’m right here if another task comes up.`, prompts: initialShortcuts.slice(0, 3) };
    }
    if (/^(help|what can you do|what can you help|how can you help)[?.! ]*$/.test(q)) {
      return { text: ctx.isPg
        ? 'I can check rent due, vacant beds, tenant move-ins, and your PG dashboard. I can organize the next steps; you confirm any changes.'
        : 'I can check occupancy, arrivals, departures, revenue, dues, housekeeping, and Form C. I can line up the work; you confirm changes to bookings, payments, or messages.', prompts: [['Today’s tasks', 'What needs doing today?'], ...initialShortcuts.slice(0, 2)] };
    }
    if (/today('?s)? tasks|what needs doing|what should i do|daily plan|priorit|to.?do|handle.*today/.test(q)) {
      const brief = await dailyBriefing(ctx);
      return {
        text: brief.tasks.length
          ? `${brief.summary} I found ${brief.tasks.length} item${brief.tasks.length === 1 ? '' : 's'} to take care of. I’ve lined up the next steps below; you stay in control of any changes.`
          : `${brief.summary} Nothing urgent is showing on today’s board. I’ll keep the useful shortcuts here if plans change.`,
        tasks: brief.tasks,
        prompts: brief.prompts,
      };
    }
    if (/^(please\s+)?(take me to|go to|open|navigate to|show me the)\b/.test(q)) {
      const destination = requestedPage(q, ctx);
      if (!destination) return { text: 'Sure. Which page should I open?', prompts: initialShortcuts.slice(0, 3) };
      if (!destination.allowed) return { text: `I can’t open ${destination.label} for your current role. The property owner or manager can help with access.` };
      location.assign(destination.href);
      return { text: `On it. Opening ${destination.label}.` };
    }
    if (ctx.isPg) {
      const data = await rpc('pg_dashboard', { p_property: ctx.property_id });
      const vacant = Array.isArray(data.vacant) ? data.vacant.length : 0;
      const due = Number(data.due_now_paise || 0);
      const overdue = Number(data.overdue_paise || 0);
      if (/occup|available|vacan|free bed|bed/.test(q)) {
        return { text: `${Number(data.beds_occupied || 0)} of ${Number(data.beds_total || 0)} beds are occupied, leaving ${vacant} vacant.`, link: { href: 'tenants.html?movein=1', label: 'Review vacant beds' }, prompts: [['Rent due', 'How much rent is still due?'], ['Today’s tasks', 'What needs doing today?']] };
      }
      if (/due|rent|unpaid|balance|owe/.test(q)) {
        return { text: due ? `${rupees(due)} in rent is due${overdue ? `, including ${rupees(overdue)} overdue` : ''}. I’ve linked the tenant list so you can review it.` : 'There’s no rent due right now. You’re all caught up.', link: { href: 'tenants.html', label: 'Review tenants and rent' }, prompts: [['Vacant beds', 'How many beds are available?'], ['Today’s tasks', 'What needs doing today?']] };
      }
      if (/tenant|move.?in|arrival/.test(q)) {
        return { text: `${Number(data.tenants || 0)} tenants are currently living at the property; ${Array.isArray(data.arriving) ? data.arriving.length : 0} move-ins are scheduled soon.`, link: { href: 'tenants.html', label: 'Open tenants' }, prompts: [['Rent due', 'How much rent is still due?'], ['Vacant beds', 'How many beds are available?']] };
      }
      return { text: `That’s outside what I can help with here, ${firstName}. I can check rent, vacant beds, and tenants; the support team can help with anything else.`, link: supportMailLink(ctx, question), prompts: initialShortcuts.slice(0, 3) };
    }
    if (/housekeep|clean|dirty|room turn/.test(q)) {
      const addon = await rpc('housekeeping_addon_status', { p_property: ctx.property_id }).catch(() => ({ active: false }));
      if (!addon.active) return { text: 'Housekeeping is not enabled for this property yet. The owner can review the add-on from the Housekeeping page.', link: { href: 'housekeeping.html', label: 'View Housekeeping' }, prompts: [['Arrivals', 'How many arrivals are expected today?'], ['Form C', 'Are any Form C reports due?']] };
      const counts = await rpc('hk_counts', { p_property: ctx.property_id });
      const dirty = Number(counts?.dirty || 0);
      const cleaning = Number(counts?.cleaning || 0);
      return { text: dirty + cleaning ? `There are ${dirty} ${W.units} waiting to be cleaned and ${cleaning} in progress. Let’s get the room board up to date.` : 'Housekeeping is looking clear right now. Nice work.', link: { href: 'housekeeping.html', label: 'Open housekeeping' }, prompts: [['Arrivals', 'How many arrivals are expected today?'], ['Form C', 'Are any Form C reports due?']] };
    }
    if (/form\s*c|frro|foreign guest/.test(q)) {
      const count = Number(await rpc('formc_due_count', { p_property: ctx.property_id }).catch(() => 0));
      return { text: count ? `${count} Form C report${count === 1 ? '' : 's'} need attention today. You can review them before the reporting deadline.` : 'You’re all clear: no Form C reports are currently due.', link: { href: 'formc.html', label: 'Open Form C' }, prompts: [['Arrivals', 'How many arrivals are expected today?'], ['Housekeeping', 'What needs cleaning?']] };
    }
    if (/setup|onboard|finish setting/.test(q)) {
      const progress = await rpc('setup_progress', { p_property: ctx.property_id });
      if (!progress) return { text: 'I could not find a setup checklist for this property.', link: { href: 'setup.html', label: 'Open setup' } };
      const tasks = [['details', 'property details'], ['rooms', 'rooms'], ['upi', 'UPI details'], ['staff', 'team invites'], ['booking', 'first booking']];
      const remaining = tasks.filter(([key]) => !progress[key]).map(([, label]) => label);
      return { text: remaining.length ? `A few setup steps are still open: ${remaining.join(', ')}.` : 'Your initial setup checklist is complete. You’re ready to go.', link: { href: 'setup.html', label: 'Open setup' }, prompts: [['Occupancy', 'How many beds are available?'], ['Today\'s snapshot', 'What is happening today?']] };
    }

    const data = await rpc('dashboard_summary', { p_property: ctx.property_id });
    const occupied = Number(data.beds_occupied || 0);
    const total = Number(data.beds_total || 0);
    const available = Math.max(total - occupied, 0);
    const arrivals = Array.isArray(data.arriving) ? data.arriving : [];
    const departures = Array.isArray(data.departing) ? data.departing : [];
    const late = departures.filter((booking) => booking.overdue).length;
    const pending = Number(data.checkins_pending || 0);
    const duesCount = Number(data.dues_count || 0);

    if (/\bwho\b.*\b(guest|arrival|check.?in)\b|\b(guest|arrival) names?\b/.test(q)) {
      if (!ctx.can('owner', 'manager', 'front_desk')) return { text: 'I can’t show guest names for your role. You can ask the property owner or manager for access.' };
      const names = arrivals.slice(0, 5).map((booking) => {
        const room = [booking.room, booking.bed].filter(Boolean).join(' · ');
        return `${booking.guest || 'Guest'}${room ? ` (${room})` : ''}`;
      });
      const more = arrivals.length > names.length ? `, and ${arrivals.length - names.length} more` : '';
      return { text: names.length ? `For today’s arrivals, I have: ${names.join('; ')}${more}.` : 'There are no arrivals listed for today.', link: { href: 'check-in.html', label: 'Open today’s check-ins' }, prompts: [['Arrivals', 'How many arrivals are expected today?'], ['Today’s tasks', 'What needs doing today?']] };
    }
    if (/occup|available|free bed|vacan/.test(q)) {
      const percent = total ? Math.round((occupied / total) * 100) : 0;
      return { text: `${percent}% occupied: ${occupied} of ${total} ${W.units} are in use, with ${available} available.`, link: { href: 'calendar.html', label: 'Open calendar' }, prompts: [['Arrivals', 'How many arrivals are expected today?'], ['Pending dues', 'How much is still due?']] };
    }
    if (/arrival|check.?in|coming/.test(q)) {
      return { text: arrivals.length ? `${arrivals.length} guests are expected today; ${pending} check-in${pending === 1 ? '' : 's'} ${pending === 1 ? 'is' : 'are'} still pending.` : 'No arrivals are scheduled today. The desk can focus on departures and room turns.', link: { href: 'check-in.html', label: 'Open check-in' }, prompts: [['Occupancy', 'How many beds are available?'], ['Housekeeping', 'What needs cleaning?']] };
    }
    if (/depart|check.?out|late/.test(q)) {
      return { text: departures.length ? `${departures.length} check-out${departures.length === 1 ? '' : 's'} are on today’s list${late ? `; ${late} ${late === 1 ? 'is' : 'are'} running late` : ', with none currently marked late'}.` : 'No departures are scheduled today. That gives the team more time for room turns.', link: { href: 'bookings.html?status=checked_in', label: 'View checked-in bookings' }, prompts: [['Housekeeping', 'What needs cleaning?'], ['Arrivals', 'How many arrivals are expected today?']] };
    }
    if (/revenue|income|collected|sales/.test(q)) {
      return { text: `You’ve recorded ${rupees(data.revenue_today || 0)} today.`, link: { href: 'payments.html', label: 'Open payments' }, prompts: [['Pending dues', 'How much is still due?'], ["Today's snapshot", 'What is happening today?']] };
    }
    if (/due|unpaid|balance|owe/.test(q)) {
      return { text: duesCount ? `${rupees(data.dues_paise || 0)} is still due across ${duesCount} booking${duesCount === 1 ? '' : 's'}. You can review the balances before following up.` : 'There are no pending booking dues right now. You’re all caught up.', link: { href: 'payments.html', label: 'Review dues' }, prompts: [['Arrivals', 'How many arrivals are expected today?'], ['Revenue', 'How much revenue was recorded today?']] };
    }
    if (/today|summary|happening|snapshot/.test(q)) {
      const percent = total ? Math.round((occupied / total) * 100) : 0;
      return { text: `Here’s the day at a glance: ${percent}% occupied with ${available} ${W.units} available; ${arrivals.length} arrivals and ${departures.length} departures; ${rupees(data.revenue_today || 0)} recorded and ${rupees(data.dues_paise || 0)} still due.`, link: { href: 'dashboard.html', label: 'Open dashboard' }, prompts: [['Housekeeping', 'What needs cleaning?'], ['Form C', 'Are any Form C reports due?'], ['Pending dues', 'How much is still due?']] };
    }
    return { text: `That’s outside what I can help with here, ${firstName}. I can help with today’s property tasks; for anything else, I’ve prepared an email to TheNammaStay support team.`, link: supportMailLink(ctx, question), prompts: initialShortcuts.slice(0, 3) };
  }

  async function invokeWhatsApp(body) {
    const { data, error } = await sb.functions.invoke('purni-whatsapp', { body });
    if (error) throw error;
    if (!data || data.error) throw new Error(data?.error || 'The WhatsApp service returned no response.');
    return data;
  }

  async function dailyBriefing(context) {
    if (context.isPg) {
      const data = await rpc('pg_dashboard', { p_property: context.property_id });
      const vacant = Array.isArray(data.vacant) ? data.vacant.length : 0;
      const due = Number(data.due_now_paise || 0);
      const overdue = Number(data.overdue_paise || 0);
      const tasks = [];
      if (due > 0 && context.allow('view_payments')) tasks.push({ text: `${rupees(due)} in rent is due${overdue ? `, including ${rupees(overdue)} overdue` : ''}.`, link: { href: 'tenants.html', label: 'Review rent dues' } });
      if (vacant > 0) tasks.push({ text: `${vacant} bed${vacant === 1 ? '' : 's'} are vacant and ready for move-ins.`, link: { href: 'tenants.html?movein=1', label: 'Review vacant beds' } });
      return {
        summary: `Today’s PG snapshot: ${data.beds_occupied || 0} of ${data.beds_total || 0} beds occupied, ${Number(data.tenants || 0)} current tenants, and ${rupees(due)} rent due.`,
        tasks,
        prompts: [['Rent due', 'How much rent is still due?'], ['Vacancies', 'How many beds are available?'], ['Tenants', 'Open tenants and rent']],
      };
    }

    const canSeeOps = context.can('owner', 'manager', 'front_desk');
    const [data, housekeeping, formc] = await Promise.all([
      rpc('dashboard_summary', { p_property: context.property_id }),
      canSeeOps ? rpc('hk_counts', { p_property: context.property_id }).catch(() => null) : Promise.resolve(null),
      !context.isPg && canSeeOps ? rpc('formc_due_count', { p_property: context.property_id }).catch(() => 0) : Promise.resolve(0),
    ]);
    const occupied = Number(data.beds_occupied || 0);
    const total = Number(data.beds_total || 0);
    const available = Math.max(total - occupied, 0);
    const arrivals = Array.isArray(data.arriving) ? data.arriving.length : 0;
    const departures = Array.isArray(data.departing) ? data.departing : [];
    const late = departures.filter((booking) => booking.overdue).length;
    const tasks = [];
    if (Number(data.checkins_pending || 0) > 0 && canSeeOps) tasks.push({ text: `${data.checkins_pending} arrival${Number(data.checkins_pending) === 1 ? '' : 's'} still need check-in.`, link: { href: 'check-in.html', label: 'Open check-in' } });
    if (late > 0 && canSeeOps) tasks.push({ text: `${late} check-out${late === 1 ? '' : 's'} are marked late.`, link: { href: 'bookings.html?status=checked_in', label: 'Review checked-in bookings' } });
    if (housekeeping && Number(housekeeping.dirty || 0) + Number(housekeeping.cleaning || 0) > 0) tasks.push({ text: `${Number(housekeeping.dirty || 0)} rooms need cleaning; ${Number(housekeeping.cleaning || 0)} are in progress.`, link: { href: 'housekeeping.html', label: 'Open housekeeping' } });
    if (Number(formc || 0) > 0) tasks.push({ text: `${formc} Form C report${Number(formc) === 1 ? '' : 's'} need attention.`, link: { href: 'formc.html', label: 'Review Form C' } });
    if (Number(data.dues_count || 0) > 0 && context.allow('view_payments')) tasks.push({ text: `${rupees(data.dues_paise || 0)} remains due across ${data.dues_count} booking${Number(data.dues_count) === 1 ? '' : 's'}.`, link: { href: 'payments.html', label: 'Review pending dues' } });
    const percent = total ? Math.round((occupied / total) * 100) : 0;
    return {
      summary: `Today’s snapshot: ${percent}% occupied with ${available} ${W.units} available, ${arrivals} arrivals, ${departures.length} departures, and ${rupees(data.revenue_today || 0)} recorded.`,
      tasks,
      prompts: [['Occupancy', 'How many beds are available?'], ['Revenue', 'How much revenue was recorded today?'], ['Housekeeping', 'What needs cleaning?']],
    };
  }

  function setSuggestions(prompts) {
    suggestions.innerHTML = prompts.map(([label, question]) => `<button type="button" data-prompt="${escapeHtml(question)}">${escapeHtml(label)}</button>`).join('');
    suggestions.hidden = prompts.length === 0;
  }
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function supportMailLink(ctx, question) {
  const subject = `Purni support request - ${ctx.property_name || 'TheNammaStay'}`;
  const body = [
    'Hi TheNammaStay support,',
    '',
    `I need help with: ${question}`,
    `Property: ${ctx.property_name || 'Not specified'}`,
    `Account: ${ctx.user?.email || ctx.name || 'Not specified'}`,
  ].join('\n');
  return {
    href: `mailto:hello@thenammastay.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    label: 'Email TheNammaStay support',
  };
}
