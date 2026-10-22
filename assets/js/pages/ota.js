import { page, content, setSubtitle, headerActions, showFatal } from '../core.js';
import { cnCard } from './connect-card.js';

page('ota', async (ctx) => {
  if (!ctx.can('owner', 'manager')) {
    showFatal('Only the owner or manager can manage OTA sync.');
    return;
  }
  headerActions().replaceChildren();
  setSubtitle('Connect NammaStay to Beds24 and sync availability, rates, and reservations.');
  content('<div id="cn-card"></div>');
  await cnCard(ctx);
});
