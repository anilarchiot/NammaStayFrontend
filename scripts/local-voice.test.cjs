const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('assets/js/local-voice.js', 'utf8').replaceAll('export function', 'function');
const { localVoices, speakLocal, voiceHelpText } = vm.runInNewContext(`${source}\n({ localVoices, speakLocal, voiceHelpText })`);

test('only locally provided voices can receive assistant replies', () => {
  const calls = [];
  const voices = [
    { voiceURI: 'local', name: 'Local', localService: true },
    { voiceURI: 'remote', name: 'Remote', localService: false },
    { voiceURI: 'unknown', name: 'Unknown' },
  ];
  const speech = { getVoices: () => voices, speak: (value) => calls.push(value) };
  class Utterance { constructor(text) { this.text = text; } }
  assert.equal(localVoices(speech).length, 1);
  assert.equal(speakLocal(speech, Utterance, 'remote', 'private reply', () => {}), false);
  assert.equal(speakLocal(speech, Utterance, 'unknown', 'private reply', () => {}), false);
  assert.equal(speakLocal(speech, Utterance, '', 'private reply', () => {}), false);
  assert.equal(calls.length, 0);
  assert.equal(speakLocal(speech, Utterance, 'local', 'local reply', () => {}), true);
  assert.equal(calls[0].voice, voices[0]);
  assert.equal(calls[0].text, 'local reply');
});

test('voice help reflects off, selected, unavailable and unsupported voice lists', () => {
  const voices = [{ voiceURI: 'local' }];
  assert.match(voiceHelpText('', voices), /Voice is off/);
  assert.match(voiceHelpText('local', voices), /Voice is on/);
  assert.match(voiceHelpText('missing', voices), /unavailable/);
  assert.match(voiceHelpText('', []), /No local voices/);
});
