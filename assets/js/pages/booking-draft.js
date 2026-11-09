// Serialize writes so an older request cannot overwrite a newer draft on this device.
export function createBookingDraftSync({ rpc, propertyId, status, delay = 500 }) {
  let timer = null;
  let pending = null;
  let running = null;
  let stopped = false;

  async function flush() {
    clearTimeout(timer);
    timer = null;
    if (running) await running.catch(() => {});
    if (!pending || stopped) return;
    const snapshot = pending;
    pending = null;
    running = rpc('booking_draft_set', { p_property: propertyId, p_draft: snapshot });
    try {
      await running;
      if (!pending && !stopped) status('Draft saved to your account.');
    } catch (error) {
      if (!pending) pending = snapshot;
      if (!stopped) status(`Draft could not be saved: ${error.message}`, true);
    } finally {
      running = null;
    }
    if (pending && pending !== snapshot) await flush();
  }

  return {
    schedule(snapshot) {
      if (stopped) return;
      pending = snapshot;
      status('Saving draft…');
      clearTimeout(timer);
      timer = setTimeout(flush, delay);
    },
    flush,
    async clear() {
      stopped = true;
      clearTimeout(timer);
      pending = null;
      if (running) await running.catch(() => {});
      try { await rpc('booking_draft_set', { p_property: propertyId, p_draft: null }); }
      catch (error) { stopped = false; throw error; }
    },
  };
}
