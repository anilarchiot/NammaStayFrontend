export function localVoices(speech) {
  return speech.getVoices().filter((voice) => voice.localService === true);
}

export function voiceHelpText(voiceId, voices) {
  if (voiceId && !voices.some((voice) => voice.voiceURI === voiceId)) {
    return 'The saved voice is unavailable on this device. Choose another local voice or turn voice off.';
  }
  if (!voices.length) return 'No local voices are available on this device.';
  return voiceId ? 'Voice is on for this device. Replies may be heard by people nearby.'
    : 'Voice is off. Choose a local voice to hear replies.';
}

export function speakLocal(speech, Utterance, voiceId, text, onError) {
  const voice = localVoices(speech).find((item) => item.voiceURI === voiceId);
  if (!voice) return false;
  const utterance = new Utterance(text);
  utterance.voice = voice;
  utterance.onerror = onError;
  speech.speak(utterance);
  return true;
}
