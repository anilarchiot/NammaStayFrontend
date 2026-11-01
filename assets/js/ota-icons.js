// OTA brand tiles: coloured rounded square with the OTA's initials (local, no external images).
export const OTA_LIST = [
  { key: 'airbnb', name: 'Airbnb', color: '#FF5A5F', mark: 'A' },
  { key: 'booking', name: 'Booking.com', color: '#003580', mark: 'B.' },
  { key: 'agoda', name: 'Agoda', color: '#5C2D91', mark: 'a' },
  { key: 'expedia', name: 'Expedia', color: '#1B2B5A', mark: 'E' },
  { key: 'makemytrip', name: 'MakeMyTrip', color: '#E8352E', mark: 'M' },
  { key: 'goibibo', name: 'Goibibo', color: '#2276E3', mark: 'go' },
  { key: 'hostelworld', name: 'Hostelworld', color: '#F25621', mark: 'H' },
  { key: 'vrbo', name: 'Vrbo', color: '#1E64C8', mark: 'V' },
  { key: 'yatra', name: 'Yatra', color: '#D7262C', mark: 'Y' },
  { key: 'google', name: 'Google Calendar', color: '#188038', mark: '31' },
];

export const otaIcon = (o) => `<span class="ota-ico" style="background:${o.color}" aria-hidden="true">${o.mark}</span>`;
export const otaTile = (o, caption = '') => `<span class="ota-tile" title="${o.name}">${otaIcon(o)}<b>${o.name}</b>${caption ? `<em>${caption}</em>` : ''}</span>`;
