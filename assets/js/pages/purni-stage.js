// Purni's animated "stage" at the top of the chat panel: she looks down at the conversation
// and reacts to what the user does (pointer, typing, sending, answers, clicks, idling).

const SKIN = '#D99972';
const HAIR = '#26304A';
const KURTA = '#E88855';

const eye = (x) => `<g transform="translate(${x} 62)">
    <ellipse rx="5.6" ry="4.2" fill="#fff"/>
    <g class="pc-pupil"><circle r="3" fill="#3A2A24"/><circle cx="-1" cy="-1" r=".9" fill="#fff"/></g>
    <g class="pc-lid"><rect x="-7" y="-5" width="14" height="10" rx="2" fill="${SKIN}"/><path d="M-6 5q6 3 12 0" fill="none" stroke="${HAIR}" stroke-width="1.6" stroke-linecap="round"/></g>
  </g>`;

export const stageMarkup = `
  <div class="purni-stage-say" aria-hidden="true" hidden><span class="purni-say-text"></span><span class="purni-say-dots"><i></i><i></i><i></i></span></div>
  <svg class="purni-stage-art" viewBox="30 12 140 108" aria-hidden="true" focusable="false">
    <g class="pc-body">
      <path d="M44 120C46 98 68 92 100 92s54 6 56 28z" fill="${KURTA}"/>
      <path d="M80 96q20 18 40 0" fill="none" stroke="#FDF2D7" stroke-width="2" stroke-linecap="round"/>
    </g>
    <path d="M91 78h18v14c-4 6-14 6-18 0z" fill="#B56D4D"/>
    <g class="pc-head-pose"><g class="pc-head-nod"><g class="pc-head-idle">
      <path d="M72 56C70 32 84 22 100 22s30 10 28 34l2 32c-10 4-50 4-60 0z" fill="${HAIR}"/>
      <ellipse cx="100" cy="58" rx="25" ry="29" fill="${SKIN}"/>
      <g class="pc-earring pc-earring-l"><path d="M75 64v4" stroke="#E4A73F" stroke-width="1"/><circle cx="75" cy="70" r="2.4" fill="#E4A73F"/></g>
      <g class="pc-earring pc-earring-r"><path d="M125 64v4" stroke="#E4A73F" stroke-width="1"/><circle cx="125" cy="70" r="2.4" fill="#E4A73F"/></g>
      <path d="M75 56C75 36 86 28 100 28s25 8 25 28c-7-3-15-9-19-16-6 8-18 14-31 16z" fill="${HAIR}"/>
      <circle class="pc-blush" cx="81" cy="72" r="4.5" fill="#E8764F"/><circle class="pc-blush" cx="119" cy="72" r="4.5" fill="#E8764F"/>
      <g class="pc-brows" fill="none" stroke="${HAIR}" stroke-width="2" stroke-linecap="round">
        <path class="pc-brow-l" d="M82 51q7-4 14 0"/><path class="pc-brow-r" d="M104 51q7-4 14 0"/>
      </g>
      <circle cx="100" cy="52" r="1.7" fill="#B93139"/>
      <g class="pc-eyes">${eye(89)}${eye(111)}</g>
      <path d="M100 64q-2.5 6 1 8" fill="none" stroke="#B56D4D" stroke-width="1.6" stroke-linecap="round"/>
      <g class="pc-mouth">
        <path class="pc-m-smile" d="M92 76q8 7 16 0" fill="none" stroke="#8D4B3D" stroke-width="2" stroke-linecap="round"/>
        <path class="pc-m-flat" d="M94 78h12" fill="none" stroke="#8D4B3D" stroke-width="2" stroke-linecap="round"/>
        <path class="pc-m-grin" d="M91 75q9 12 18 0z" fill="#7A2F2F" stroke="#7A2F2F" stroke-width="1.5" stroke-linejoin="round"/>
        <ellipse class="pc-m-o" cx="100" cy="78" rx="2.8" ry="3.4" fill="#7A2F2F"/>
        <ellipse class="pc-m-talk" cx="100" cy="78" rx="4.6" ry="3.4" fill="#7A2F2F"/>
      </g>
    </g></g></g>
    <rect x="-300" y="104" width="800" height="40" fill="#173B46"/>
    <rect x="-300" y="104" width="800" height="3" fill="#1C9A6C" opacity=".6"/>
    <g class="pc-hand-l"><path d="M52 104l14 2" stroke="${KURTA}" stroke-width="11" stroke-linecap="round"/><ellipse cx="72" cy="104" rx="8" ry="4.5" fill="${SKIN}"/></g>
    <g class="pc-hand-r"><path d="M148 104l-14 2" stroke="${KURTA}" stroke-width="11" stroke-linecap="round"/><ellipse cx="128" cy="104" rx="8" ry="4.5" fill="${SKIN}"/></g>
    <g class="pc-arm pc-arm-wave">
      <path d="M142 108l16-28" stroke="${KURTA}" stroke-width="11" stroke-linecap="round"/>
      <ellipse cx="160" cy="72" rx="6.5" ry="7.5" fill="${SKIN}" transform="rotate(12 160 72)"/>
      <path d="M156 67l-1-7M159.5 66l0-8M163 67l1-7M166 69l2-6" stroke="${SKIN}" stroke-width="3" stroke-linecap="round"/>
    </g>
    <g class="pc-arm pc-arm-think">
      <path d="M142 108L120 92" stroke="${KURTA}" stroke-width="11" stroke-linecap="round"/>
      <ellipse cx="116" cy="88" rx="6.5" ry="5.5" fill="${SKIN}"/>
      <path d="M113 84l-3-8" stroke="${SKIN}" stroke-width="3.5" stroke-linecap="round"/>
    </g>
  </svg>`;

const MOODS = {
  idle: { pose: 'rest', mouth: 'smile' },
  listen: { pose: 'rest', mouth: 'smile' },
  think: { pose: 'think', mouth: 'o' },
  talk: { pose: 'rest', mouth: 'talk' },
  happy: { pose: 'rest', mouth: 'grin' },
  wave: { pose: 'wave', mouth: 'grin' },
  giggle: { pose: 'giggle', mouth: 'grin' },
  sleepy: { pose: 'rest', mouth: 'flat' },
  oops: { pose: 'rest', mouth: 'o' },
};
const QUIPS = ['Hehe, that tickles!', 'Hi again!', 'Need a hand?', 'I’m all ears.', 'You’re doing great!', 'Ask me anything about today.'];
const ANSWERS = ['Here you go!', 'Found it!', 'Take a look below.', 'All done!'];
const HAPPY_WORDS = /all clear|caught up|looking clear|nothing urgent|nice work|good to see/i;

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function createStage(host, { panel, input, suggestions }) {
  const sayBox = host.querySelector('.purni-stage-say');
  const sayText = host.querySelector('.purni-say-text');
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
  const timers = {};
  let active = false;
  let mood = 'idle';
  let typingX = 0;
  let pointer = { x: 0, y: 1.4 };
  let lastActivity = Date.now();
  let lastHello = 0;
  let clicks = [];
  let name = 'Purni';

  const later = (key, fn, ms) => { clearTimeout(timers[key]); timers[key] = setTimeout(fn, ms); };

  function applyGaze() {
    let x = pointer.x;
    let y = pointer.y;
    let hr = x * 1.2;
    let hy = 2;
    if (mood === 'think') { x = 2.2; y = -1.7; hr = 5; hy = 0; }
    else if (mood === 'listen') { x = typingX; y = 2.4; hr = typingX * 1.4; hy = 4; }
    else if (mood === 'sleepy') { x = 0; y = 2.6; hr = 8; hy = 6; }
    else if (mood === 'oops') { y = 2.4; hr = -3; }
    host.style.setProperty('--px', x.toFixed(2));
    host.style.setProperty('--py', y.toFixed(2));
    host.style.setProperty('--hr', hr.toFixed(2));
    host.style.setProperty('--hy', hy.toFixed(2));
  }

  function setMood(next, ms, after = 'idle') {
    clearInterval(timers.read);
    mood = next;
    const def = MOODS[next];
    host.dataset.mood = next;
    host.dataset.pose = def.pose;
    host.dataset.mouth = def.mouth;
    applyGaze();
    if (ms) later('mood', () => setMood(after), ms);
    else clearTimeout(timers.mood);
  }

  function say(text, ms = 2600, dots = false) {
    clearTimeout(timers.say);
    sayText.textContent = text;
    sayBox.classList.toggle('has-dots', dots);
    sayBox.hidden = false;
    void sayBox.offsetWidth;
    sayBox.classList.add('is-on');
    if (ms) timers.say = setTimeout(hush, ms);
  }
  function hush() {
    sayBox.classList.remove('is-on');
    timers.say = setTimeout(() => { sayBox.hidden = true; }, 220);
  }

  function hearts(count) {
    if (calm.matches) return;
    for (let i = 0; i < count; i += 1) {
      const heart = document.createElement('span');
      heart.className = 'purni-heart';
      heart.textContent = '♥';
      heart.style.setProperty('--x', `${rand(40, 62)}%`);
      heart.style.setProperty('--dx', `${rand(-26, 26).toFixed(0)}px`);
      heart.style.animationDelay = `${(i * 0.12).toFixed(2)}s`;
      heart.addEventListener('animationend', () => heart.remove());
      host.append(heart);
    }
  }

  function nod() {
    const pose = host.querySelector('.pc-head-nod');
    pose.classList.remove('is-nod');
    void pose.getBoundingClientRect();
    pose.classList.add('is-nod');
  }

  function poke() {
    lastActivity = Date.now();
    if (mood === 'sleepy') { setMood('wave', 1500); say('Oh! I’m awake.', 1800); }
  }

  function lookAt(el) {
    const art = host.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    pointer = {
      x: clamp(((r.left + r.width / 2) - (art.left + art.width / 2)) / 70, -1, 1) * 2.3,
      y: 2.4,
    };
    applyGaze();
  }

  function onPointerMove(event) {
    if (!active || calm.matches || panel.hidden) return;
    if (host._raf) return;
    host._raf = requestAnimationFrame(() => {
      host._raf = 0;
      const r = host.getBoundingClientRect();
      const dx = event.clientX - (r.left + r.width / 2);
      const dy = event.clientY - (r.top + r.height * 0.5);
      pointer = { x: clamp(dx / 90, -1, 1) * 2.3, y: 1.3 + clamp(dy / 140, -1, 1) * 1.1 };
      applyGaze();
    });
  }

  function tickle() {
    poke();
    const now = Date.now();
    clicks = clicks.filter((t) => now - t < 5000).concat(now);
    if (clicks.length >= 5) {
      clicks = [];
      setMood('happy', 2400);
      say('Okay okay, back to work!', 2400);
      hearts(5);
      return;
    }
    setMood('giggle', 1700);
    say(QUIPS[Math.floor(Math.random() * QUIPS.length)], 2200);
    hearts(3);
  }

  function blinkLoop() {
    clearTimeout(timers.blink);
    timers.blink = setTimeout(() => {
      if (active && !calm.matches && mood !== 'sleepy') {
        host.classList.add('is-blink');
        setTimeout(() => host.classList.remove('is-blink'), 140);
        if (Math.random() < 0.22) setTimeout(() => { host.classList.add('is-blink'); setTimeout(() => host.classList.remove('is-blink'), 140); }, 330);
      }
      blinkLoop();
    }, rand(2000, 6500));
  }

  function idleLoop() {
    clearTimeout(timers.idle);
    timers.idle = setTimeout(() => {
      if (active && !calm.matches && mood === 'idle') {
        const quiet = Date.now() - lastActivity;
        if (quiet > 45000) { setMood('sleepy'); say('Zzz…', 0); }
        else if (quiet > 9000) {
          const chip = suggestions.querySelector('button');
          if (chip && Math.random() < 0.4) {
            lookAt(chip);
            say(`Try “${chip.textContent.trim()}”`, 3000);
          } else {
            pointer = { x: rand(-2.2, 2.2), y: rand(0.6, 2.2) };
            applyGaze();
          }
        }
      }
      idleLoop();
    }, rand(4000, 8000));
  }

  // Public reactions ------------------------------------------------------------------------
  function start(firstName) {
    active = true;
    lastActivity = Date.now();
    pointer = { x: 0, y: 1.4 };
    hush();
    if (!calm.matches) {
      setMood('wave', 2000);
      say(firstName ? `Hi ${firstName}!` : 'Hi there!', 2200);
    } else setMood('idle');
    blinkLoop();
    idleLoop();
  }
  function stop() {
    active = false;
    Object.values(timers).forEach(clearTimeout);
    clearInterval(timers.read);
    sayBox.hidden = true;
    setMood('idle');
  }
  function onAsk() {
    poke();
    clearTimeout(timers.typing);
    nod();
    setMood('think');
    say('Let me check', 0, true);
  }
  function onAnswer(text, question = '') {
    lastActivity = Date.now();
    if (/\b(thanks|thank you|cheers)\b/i.test(question)) {
      setMood('giggle', 2200); say('My pleasure!', 2400); hearts(4); return;
    }
    if (/^(hi|hello|hey|good (morning|afternoon|evening))\b/i.test(question)) {
      setMood('wave', 2200); say('Hello!', 2400); return;
    }
    if (HAPPY_WORDS.test(text)) {
      setMood('happy', 2600); say('All clear!', 2600); hearts(3); return;
    }
    setMood('talk', clamp(700 + String(text).length * 22, 1200, 4200));
    say(ANSWERS[Math.floor(Math.random() * ANSWERS.length)], 2400);
    // Her eyes sweep along the message she is reading.
    let flip = false;
    timers.read = setInterval(() => {
      flip = !flip;
      pointer = { x: flip ? -1.8 : 1.8, y: 2.3 };
      applyGaze();
    }, 480);
    later('readEnd', () => { clearInterval(timers.read); pointer = { x: 0, y: 1.4 }; applyGaze(); }, clamp(700 + String(text).length * 22, 1200, 4200));
  }
  function onFail() {
    setMood('oops', 3200);
    say('Hmm, that didn’t work. Try again?', 3200);
  }
  function setName(value) {
    name = value;
    host.setAttribute('aria-label', `Say hi to ${name}`);
  }

  // DOM listeners ---------------------------------------------------------------------------
  document.addEventListener('pointermove', onPointerMove, { passive: true });
  host.addEventListener('click', tickle);
  host.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); tickle(); }
  });
  host.addEventListener('pointerenter', () => {
    if (!active || calm.matches || mood !== 'idle' || Date.now() - lastHello < 15000) return;
    lastHello = Date.now();
    setMood('wave', 1700);
    say('Hi!', 1700);
  });
  panel.addEventListener('pointerover', (event) => {
    const chip = event.target.closest?.('.purni-suggestions button');
    if (chip && active && !calm.matches) lookAt(chip);
  });
  panel.addEventListener('keydown', poke);
  panel.addEventListener('pointerdown', poke);
  input.addEventListener('focus', () => { if (active && mood === 'idle') { pointer = { x: 0, y: 2.4 }; applyGaze(); } });
  input.addEventListener('input', () => {
    if (!active || mood === 'think') return;
    poke();
    const max = Number(input.maxLength) > 0 ? Number(input.maxLength) : 240;
    typingX = clamp((input.value.length / Math.min(max, 60) - 0.5) * 4.6, -2.3, 2.3);
    if (!input.value) { setMood('idle'); return; }
    if (mood !== 'listen') { setMood('listen'); } else applyGaze();
    later('typing', () => { if (mood === 'listen') setMood('idle'); }, 1600);
  });

  setName(name);
  setMood('idle');
  return { start, stop, onAsk, onAnswer, onFail, setName };
}
