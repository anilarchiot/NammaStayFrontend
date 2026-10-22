// Setup items — what owners typically buy or pay for to start each kind of stay.
// Item names only (no prices: costs vary by city and quality). Used by My investment → Add investment
// and the public Startup cost planner (cost-planner.html).
export const SETUP_KINDS = [['hostel', 'Hostel / backpackers'], ['homestay', 'Homestay / B&B'], ['pg', 'PG / co-living'], ['hotel', 'Hotel / guest house'], ['resort', 'Resort']];

const A = ['hostel', 'homestay', 'pg', 'hotel', 'resort'];
const H = 'hostel'; const S = 'homestay'; const P = 'pg'; const O = 'hotel'; const R = 'resort';
// [name, kinds, unit]  unit = what one quantity means
export const SETUP_GROUPS = [
  { key: 'property', title: 'Property & building', items: [
    ['Rent / lease deposit', [H, S, P, O, R], 'lump sum'], ['Advance rent', [H, P, O, R], 'lump sum'], ['Brokerage', [H, P, O, R], 'lump sum'],
    ['Land / lease premium', [R], 'lump sum'], ['Construction of cottages / rooms', [R, S, O], 'room'], ['Civil work & renovation', A, 'lump sum'],
    ['Interior design & carpentry', A, 'lump sum'], ['Painting', A, 'lump sum'], ['Flooring & tiling', A, 'lump sum'], ['Plumbing & bathrooms', A, 'bathroom'],
    ['Electrical wiring & fittings', A, 'lump sum'], ['Partitions / room dividers', [H, P], 'lump sum'], ['Landscaping & garden', [S, R, O], 'lump sum'],
    ['Boundary wall / gate', [S, R], 'lump sum'], ['Parking area', [O, R, P], 'lump sum'], ['Water tank & sump', A, 'each'], ['Rainwater harvesting', [R, O, S], 'lump sum'],
  ] },
  { key: 'sleeping', title: 'Beds & room furniture', items: [
    ['Bunk beds', [H], 'bed'], ['Single beds', [H, P, O], 'bed'], ['Double / queen beds', [S, O, R], 'bed'], ['Mattresses', A, 'each'], ['Pillows', A, 'each'],
    ['Lockers', [H, P], 'each'], ['Privacy curtains for bunks', [H], 'bed'], ['Reading lights & charging points per bed', [H, P], 'bed'],
    ['Wardrobes / cupboards', [S, P, O, R], 'each'], ['Study tables & chairs', [P], 'set'], ['Bedside tables', [S, O, R], 'each'], ['Mirrors', A, 'each'],
    ['Window curtains & blinds', A, 'window'], ['Luggage racks', [H, O, R], 'each'], ['Room safes', [O, R], 'each'], ['Sofa / seating in rooms', [O, R, S], 'each'],
  ] },
  { key: 'linen', title: 'Linen & bathroom', items: [
    ['Bedsheets', A, 'set'], ['Blankets / duvets', A, 'each'], ['Towels', A, 'each'], ['Bath mats', [S, O, R], 'each'], ['Geysers / water heaters', A, 'each'],
    ['Toiletries starter stock', [H, S, O, R], 'lump sum'], ['Hair dryers', [O, R], 'each'], ['Spa / pool linen', [R], 'lump sum'],
  ] },
  { key: 'kitchen', title: 'Kitchen & dining', items: [
    ['Common kitchen for guests', [H], 'lump sum'], ['Commercial kitchen equipment', [O, R, P], 'lump sum'], ['Gas connection & stove', A, 'each'],
    ['Refrigerator', A, 'each'], ['Microwave', [H, S, P], 'each'], ['RO water purifier', A, 'each'], ['Utensils, crockery & cutlery', A, 'lump sum'],
    ['Dining tables & chairs', A, 'set'], ['Mess setup (tables, serving)', [P], 'lump sum'], ['Restaurant furniture', [O, R], 'lump sum'],
    ['Bar setup', [R, O, H], 'lump sum'], ['Café / coffee machine', [H, R, O], 'each'], ['Exhaust & chimney', [O, R, P], 'each'],
  ] },
  { key: 'comfort', title: 'Comfort, appliances & tech', items: [
    ['Air conditioners', A, 'each'], ['Ceiling fans', A, 'each'], ['Coolers / heaters', A, 'each'], ['TVs', [S, O, R], 'each'], ['Common-room TV / projector', [H, P, R], 'each'],
    ['Wi-Fi routers & cabling', A, 'lump sum'], ['CCTV cameras & recorder', A, 'camera'], ['Biometric / smart door locks', [P, H, O], 'door'], ['Key-card system', [O, R], 'lump sum'],
    ['Intercom / EPABX', [O, R], 'lump sum'], ['Inverter / UPS', A, 'each'], ['Generator', [O, R], 'each'], ['Solar panels', [R, S, O], 'lump sum'],
    ['Washing machines', [H, P, S], 'each'], ['Dryer / laundry setup', [H, P, O, R], 'lump sum'], ['Iron & ironing boards', A, 'each'], ['Vacuum cleaner & cleaning equipment', A, 'lump sum'],
    ['Computer / laptop for front desk', [H, P, O, R], 'each'], ['Printer & ID scanner', [H, O, R], 'each'], ['Card / UPI payment device', [H, O, R], 'each'],
  ] },
  { key: 'safety', title: 'Safety', items: [
    ['Fire extinguishers', A, 'each'], ['Smoke detectors / fire alarm system', A, 'lump sum'], ['Emergency lights & exit signs', A, 'each'], ['First-aid kits', A, 'each'],
    ['Sprinklers / hydrant system', [O, R], 'lump sum'], ['Lift', [O, P], 'each'], ['Lifeguard & pool safety kit', [R], 'lump sum'], ['Railings & safety grills', A, 'lump sum'],
  ] },
  { key: 'common', title: 'Common areas & experiences', items: [
    ['Reception desk', [H, O, R, P], 'each'], ['Lobby / lounge furniture', [H, O, R], 'lump sum'], ['Common-room furniture & bean bags', [H, P], 'lump sum'],
    ['Board games, books & guitar', [H], 'lump sum'], ['Rooftop / terrace seating', [H, S, O], 'lump sum'], ['Garden / sit-out furniture', [S, R], 'lump sum'],
    ['Swimming pool', [R, O], 'each'], ['Gym equipment', [R, O, P], 'lump sum'], ['Spa setup', [R], 'lump sum'], ['Kids play area', [R], 'lump sum'],
    ['Activity equipment (bicycles, kayaks, camping)', [R, H], 'lump sum'], ['Bonfire / barbeque setup', [R, S], 'lump sum'], ['Two-wheeler / car for pickups', [R, O, H], 'each'],
    ['Wall art, plants & decor', A, 'lump sum'], ['Signboard & name board', A, 'each'],
  ] },
  { key: 'startup', title: 'Licences, launch & other start-up costs', items: [
    ['Licences & registrations (fees)', A, 'lump sum'], ['Legal, CA & documentation', A, 'lump sum'], ['Insurance (first year)', A, 'lump sum'],
    ['Logo, branding & website', A, 'lump sum'], ['Professional photos & video', A, 'lump sum'],
    ['Launch marketing', A, 'lump sum'], ['Staff hiring & training', [H, P, O, R], 'lump sum'], ['Uniforms', [O, R, H], 'lump sum'],
    ['Opening stock (cleaning, groceries)', A, 'lump sum'], ['Software (NammaStay subscription)', A, 'lump sum'],
  ] },
];

/** Groups with only the items for one property type. */
export function setupItems(kind) {
  return SETUP_GROUPS.map((g) => ({ ...g, items: g.items.filter(([, kinds]) => kinds.includes(kind)).map(([name, , unit]) => ({ name, unit })) }))
    .filter((g) => g.items.length);
}
