// Licences checklist data — what a stay usually needs, by state and property type.
// General guidance compiled from official / public sources (links per item). Rules differ by city and change:
// owners must confirm with the local office. Update CHECKED_ON and the items when you re-check.
export const CHECKED_ON = '2026-10-14';

export const KINDS = [['hostel', 'Hostel / backpackers'], ['homestay', 'Homestay / B&B'], ['pg', 'PG / co-living'], ['hotel', 'Hotel / guest house / lodge'], ['resort', 'Resort']];
// need per property type: 'yes' = needed · 'if' = needed if the condition applies · 'check' = often needed, confirm locally · 'opt' = optional
const ALL = (need) => ({ hostel: need, homestay: need, pg: need, hotel: need, resort: need });

const L = {
  gst: { label: 'GST portal', url: 'https://www.gst.gov.in/' },
  fssai: { label: 'FSSAI FoSCoS', url: 'https://foscos.fssai.gov.in/' },
  frro: { label: 'Form C (Bureau of Immigration)', url: 'https://boi.gov.in/' },
  formc: { label: 'indianfrro.gov.in Form C', url: 'https://indianfrro.gov.in/frro/FormC' },
  epf: { label: 'EPFO', url: 'https://www.epfindia.gov.in/' },
  esic: { label: 'ESIC', url: 'https://www.esic.gov.in/' },
  nidhi: { label: 'NIDHI (Ministry of Tourism)', url: 'https://nidhi.tourism.gov.in/' },
  sarais: { label: 'Sarais Act, 1867', url: 'https://www.indiacode.nic.in/handle/123456789/19045' },
  delhiFire: { label: 'Delhi Fire Service FAQ (example: hotels over 12 m)', url: 'https://dfs.delhi.gov.in/faqs' },
};

// ---------------------------------------------------------------- items that apply everywhere (state rows can add to them)
export const COMMON = [
  { key: 'ownership', title: 'Ownership proof or rent / lease agreement', doc: 'rental_agreement', need: ALL('yes'),
    what: 'Sale deed / tax receipt if you own it; a registered rent or lease agreement that allows guests or commercial use if you rent it. Most other licences ask for it.',
    who: 'You / your landlord (register the agreement at the sub-registrar)' },
  { key: 'building', title: 'Building approval & permitted use', doc: 'building_approval', need: { hostel: 'yes', homestay: 'check', pg: 'yes', hotel: 'yes', resort: 'yes' },
    what: 'Approved plan / occupancy certificate, and land use that allows lodging. Homestays in a home are usually allowed under state homestay schemes; hostels, PGs, hotels and resorts usually need commercial or permitted use.',
    who: 'Municipal corporation / development authority / panchayat' },
  { key: 'trade', title: 'Trade licence', doc: 'trade_licence', need: { hostel: 'yes', homestay: 'check', pg: 'yes', hotel: 'yes', resort: 'yes' },
    what: 'Licence to run a lodging business at the address. Renewed every year in most cities. Some states exempt registered homestays.',
    who: 'Municipal corporation / municipality / gram panchayat' },
  { key: 'shops', title: 'Shops & Establishments registration', doc: 'shops_establishment', need: { hostel: 'yes', homestay: 'check', pg: 'yes', hotel: 'yes', resort: 'yes' },
    what: 'Registration of your business and staff under the state Shops & Establishments Act. Usually needed once you employ people.',
    who: 'State labour department (online portal)' },
  { key: 'gst', title: 'GST registration', doc: 'gst', need: ALL('if'),
    when: 'Turnover above ₹20 lakh a year (₹10 lakh in Manipur, Mizoram, Nagaland and Tripura)',
    what: 'Rooms up to ₹7,500 a night: 5% GST without input credit; above ₹7,500: 18% with credit. PG / hostel stays of 90+ days up to ₹20,000 per person per month are exempt. Confirm with your CA.',
    who: 'GST department', links: [L.gst] },
  { key: 'fssai', title: 'FSSAI food registration / licence', doc: 'fssai', need: ALL('if'),
    when: 'You serve food (breakfast, meals, café, mess)',
    what: 'Registration up to ₹1.5 crore food turnover; State licence from ₹1.5 crore to ₹50 crore (limits from 1 April 2026).',
    who: 'FSSAI (FoSCoS portal)', links: [L.fssai] },
  { key: 'fire', title: 'Fire NOC / fire safety certificate', doc: 'fire_noc', need: { hostel: 'check', homestay: 'check', pg: 'check', hotel: 'yes', resort: 'yes' },
    what: 'Needed above a height / floor area / number of rooms that each state sets (e.g. Delhi: hotels and guest houses above 12 m or ground + 3 floors). Keep extinguishers and exit signs anyway.',
    who: 'State fire & emergency services', links: [L.delhiFire] },
  { key: 'police', title: 'Police registration / lodging licence & guest register', doc: 'police', need: { hostel: 'check', homestay: 'check', pg: 'check', hotel: 'check', resort: 'check' },
    what: 'Many cities require lodging houses to register with the police (old Sarais Act, 1867 or the city police act) and keep a guest register with ID. PGs: police verification of tenants.',
    who: 'District magistrate / commissioner of police', links: [L.sarais] },
  { key: 'frro', title: 'Foreign guests: FRRO registration + Form C within 24 hours', doc: 'frro', need: ALL('if'),
    when: 'You host foreign nationals',
    what: 'Register your property once with the immigration office, then submit Form C for every foreign guest within 24 hours of arrival (Immigration and Foreigners Act 2025, s.8; Rules 2025, r.17). Penalty up to ₹50,000 per guest. NammaStay’s Form C page helps.',
    who: 'Bureau of Immigration / FRRO', links: [L.frro, L.formc] },
  { key: 'pollution', title: 'Pollution Control Board consent (CTE / CTO)', doc: 'pollution', need: { hostel: 'check', homestay: 'opt', pg: 'opt', hotel: 'yes', resort: 'yes' },
    when: 'By size (CPCB, July 2026): up to 20 rooms Green; 21–300 rooms Orange; above 300 Red',
    what: 'Consent to establish and to operate from the state pollution board. Small units with clean fuel may fall in White (often exempt) — White is not automatic, confirm with the board.',
    who: 'State Pollution Control Board' },
  { key: 'labour', title: 'EPF / ESI for staff', doc: 'labour', need: ALL('if'),
    when: 'EPF from 20 employees; ESI from 10 employees',
    what: 'Register as an employer and pay monthly contributions for staff (ESI from 10 employees in most states).', who: 'EPFO / ESIC', links: [L.epf, L.esic] },
  { key: 'music', title: 'Music licence', doc: 'music', need: ALL('if'), when: 'You play recorded music in common areas or events',
    what: 'Licence from the music copyright owners / their societies for public playback.', who: 'Copyright societies (e.g. PPL, IPRS)' },
  { key: 'liquor', title: 'Bar / liquor licence', doc: 'liquor', need: { hostel: 'if', homestay: 'if', pg: 'opt', hotel: 'if', resort: 'if' }, when: 'You serve alcohol',
    what: 'Licence from the state excise department; renewed every year.', who: 'State excise department' },
  { key: 'lift', title: 'Lift licence', doc: 'lift', need: ALL('if'), when: 'The building has lifts',
    what: 'Lift registration and yearly inspection under the state lifts act.', who: 'State lift inspectorate / electrical inspectorate' },
  { key: 'environment', title: 'Coastal / forest / environment clearances', doc: 'environment', need: { hostel: 'opt', homestay: 'opt', pg: 'opt', hotel: 'if', resort: 'if' },
    when: 'Near the coast (CRZ), forests, eco-sensitive zones, or large built-up area',
    what: 'CRZ clearance on the coast, forest / eco-sensitive zone NOCs, and environmental clearance for very large projects.', who: 'State coastal zone authority / forest dept / SEIAA' },
  { key: 'insurance', title: 'Property & public liability insurance', doc: 'insurance', need: ALL('opt'),
    what: 'Not a licence, but protects you from fire, theft and guest injury claims. Some banks and OTAs ask for it.', who: 'Any general insurer' },
  { key: 'classification', title: 'Ministry of Tourism classification (voluntary)', doc: 'classification', need: { hostel: 'opt', homestay: 'opt', pg: 'opt', hotel: 'opt', resort: 'opt' },
    what: 'Star / Incredible India homestay (Gold, Silver) classification. Optional, helps with credibility and some government listings.', who: 'Ministry of Tourism (NIDHI)', links: [L.nidhi] },
];

// ---------------------------------------------------------------- states & UTs (GST state codes, same as the app)
const T = (key, title, need, what, who, links = [], extra = {}) => ({ key, title, doc: extra.doc || 'tourism', need, what, who, links, ...extra });
const HS = (need) => ({ hostel: 'opt', homestay: need, pg: 'opt', hotel: 'opt', resort: 'opt' });
const PT = (code) => ['27', '29', '36', '19', '37', '33', '24', '23', '32', '18', '10', '20', '03', '11', '16', '14', '17', '34', '22', '15', '13'].includes(code);

export const STATES = {
  '01': { name: 'Jammu & Kashmir', items: [
    T('st_tourism', 'Registration with J&K Tourism (Registration of Tourist Trade Act, 1978)', ALL('yes'),
      'Hotels, guest houses, homestays and paying-guest houses register with the Department of Tourism before taking guests.', 'Department of Tourism, J&K',
      [{ label: 'J&K Registration of Tourist Trade Act', url: 'https://www.indiacode.nic.in/handle/123456789/16516' }, { label: 'Homestay / PG guidelines (2022)', url: 'https://kashmirlife.net/govt-notifies-guidelines-for-homestay-paying-guest-house-registration-296069/' }])] },
  '02': { name: 'Himachal Pradesh', items: [
    T('st_tourism', 'Tourism unit registration (HP Tourism Development & Registration Act, 2002)', { hostel: 'yes', homestay: 'opt', pg: 'check', hotel: 'yes', resort: 'yes' },
      'All tourism units — hotels, resorts, guest houses, dormitories — must register before operating; re-register within 90 days of changes.', 'Deputy Director / District Tourism Development Officer',
      [{ label: 'Procedure checklist', url: 'https://eservices.himachaltourism.gov.in/procedure-checklist' }]),
    T('st_homestay', 'Homestay registration (HP Home Stay Rules, 2025)', HS('yes'),
      '1–6 rooms with attached toilets; register online; Diamond / Gold / Silver by tariff; guest register, CCTV in common areas, fire equipment. Old 2008-scheme units must re-register.', 'Department of Tourism & Civil Aviation',
      [{ label: 'HP Home Stay Rules 2025', url: 'https://himachaltourism.gov.in/wp-content/uploads/2025/06/The-Himachal-Pradesh-Home-Stay-Rules-2025.pdf' }])] },
  '03': { name: 'Punjab', items: [
    T('st_homestay', 'Bed & Breakfast / Homestay scheme registration', HS('check'),
      'Register your home under the state B&B / Homestay scheme (Silver / Gold); certificate valid for life. Farm stays have a separate scheme.', 'Punjab Heritage & Tourism Promotion Board',
      [{ label: 'Punjab B&B scheme', url: 'https://eservices.punjab.gov.in/resources/homePage/3/sop/BnB_About_Page_New.html' }])] },
  '04': { name: 'Chandigarh', items: [] },
  '05': { name: 'Uttarakhand', items: [
    T('st_tourism', 'Tourism accommodation registration', { hostel: 'yes', homestay: 'yes', pg: 'check', hotel: 'yes', resort: 'yes' },
      'Hotels, B&Bs, homestays and other tourism units register with the Tourism Department and renew it.', 'Uttarakhand Tourism Development Board / DTDO',
      [{ label: 'Travel Trade portal', url: 'https://traveltrade.uttarakhandtourism.gov.in/signup' }]),
    T('st_homestay', 'Homestay rules (Homestay Rules, 2015)', HS('yes'),
      'Owner (or lessee) lives there with family; 1–6 rooms; guest register; stays up to 15 days. State subsidy scheme is only for permanent residents.', 'District Tourism Development Officer',
      [{ label: 'Homestay Rules 2015', url: 'https://uttarakhandtourism.gov.in/assets/pdf/homestay_rule1.pdf' }])] },
  '06': { name: 'Haryana', items: [
    T('st_dtcp', 'Permission for a guest / boarding house in a residential zone', { hostel: 'check', homestay: 'check', pg: 'check', hotel: 'check', resort: 'opt' },
      'In DTCP areas (e.g. Gurugram) a guest or boarding house on a residential plot needs permission; plot at least 500 sq yd; conversion charges may apply.', 'Department of Town & Country Planning / municipal corporation',
      [{ label: 'DTCP Haryana', url: 'https://tcpharyana.gov.in/' }], { doc: 'building_approval' })] },
  '07': { name: 'Delhi', items: [
    T('st_police', 'Delhi Police licence for lodging / boarding houses & residential hostels', { hostel: 'yes', homestay: 'check', pg: 'yes', hotel: 'yes', resort: 'yes' },
      'Lodging houses, boarding houses and residential hostels need a licence from the Delhi Police Licensing Unit.', 'Delhi Police (Licensing)',
      [{ label: 'Delhi Police e-licensing', url: 'https://licensing.delhipolice.gov.in/' }], { doc: 'police' }),
    T('st_homestay', 'Bed & Breakfast registration (Delhi B&B Establishments Act, 2007)', HS('check'),
      'Recommended for homestays: premises used as a residence and the owner (or authorised person) lives there.', 'Department of Tourism, Delhi',
      [{ label: 'Delhi Tourism', url: 'https://tourism.delhi.gov.in/' }])] },
  '08': { name: 'Rajasthan', items: [
    T('st_homestay', 'Paying Guest House (Homestay) Scheme, 2021', HS('check'),
      'The state registers and certifies homestays under the simplified PG House (Homestay) Scheme 2021.', 'Department of Tourism, Rajasthan',
      [{ label: 'Rajasthan Tourism', url: 'https://tourism.rajasthan.gov.in/' }])] },
  '09': { name: 'Uttar Pradesh', items: [
    T('st_homestay', 'Bed & Breakfast and Homestay Policy, 2025', HS('check'),
      'Homestay: 1–8 rooms (16 beds), owner or family lives there; B&B: up to 8 rooms with a caretaker on site; online registration and renewal. Hotels and guest houses are not eligible.', 'UP Tourism Department',
      [{ label: 'UP Tourism', url: 'https://uptourism.gov.in/' }])] },
  '10': { name: 'Bihar', items: [
    T('st_homestay', 'Chief Minister Homestay Promotion Scheme (2026)', HS('check'),
      'New state homestay scheme approved in July 2026 — register with the tourism department once it opens.', 'Department of Tourism, Bihar',
      [{ label: 'Bihar Tourism', url: 'https://tourism.bihar.gov.in/' }])] },
  '11': { name: 'Sikkim', ilp: 'protected', items: [
    T('st_tourism', 'Registration under the Sikkim Registration and Licensing of Tourist Trade Act, 2022', ALL('yes'),
      'No hotel, homestay or other tourist entity may run unless registered (registration comes before the trade licence). Homestays must be run by the owner — leasing to third parties is banned (2023).', 'Tourism & Civil Aviation Department',
      [{ label: 'Act No. 22 of 2022', url: 'https://prsindia.org/files/bills_acts/acts_states/sikkim/2022/Act%20No.%2022%20of%202022%20Sikkim.pdf' }])] },
  '12': { name: 'Arunachal Pradesh', ilp: true, items: [] },
  '13': { name: 'Nagaland', ilp: true, items: [] },
  '14': { name: 'Manipur', ilp: true, items: [] },
  '15': { name: 'Mizoram', ilp: true, items: [] },
  '16': { name: 'Tripura', items: [] },
  '17': { name: 'Meghalaya', items: [
    T('st_guests', 'Register every guest on the state tourism app', ALL('yes'),
      'Hotels, homestays, resorts and landlords must register guests on the official Meghalaya tourism app (linked to the police).', 'Department of Tourism, Meghalaya',
      [{ label: 'News (Jun 2025)', url: 'https://www.outlooktraveller.com/News/heres-why-meghalaya-has-made-tourist-registration-mandatory-at-all-accommodations' }], { doc: 'police' })] },
  '18': { name: 'Assam', items: [
    T('st_homestay', 'Homestay authorisation by the district administration', HS('check'),
      'Districts authorise homestays through a committee (e.g. Sivasagar: 1–6 rooms, owner or agent lives there, renewed every year, fire extinguisher and guest register needed).', 'Deputy Commissioner / district tourism office',
      [{ label: 'Homestay guideline (Sivasagar)', url: 'https://sivasagar.assam.gov.in/sites/default/files/public_utility/Homestay%20Guideline.pdf' }])] },
  '19': { name: 'West Bengal', items: [
    T('st_homestay', 'Homestay registration (WB Homestay Tourism Policy, 2026)', HS('check'),
      'Register with the Department of Tourism under the state homestay policy (needed for listing and incentives).', 'Department of Tourism, West Bengal',
      [{ label: 'WB Homestay Policy 2026', url: 'https://www.wbtourism.gov.in/assets/pdf/principal-notice/Final%20WB%20Homestay%20Policy%202026.pdf' }])] },
  '20': { name: 'Jharkhand', items: [] },
  '21': { name: 'Odisha', items: [
    T('st_homestay', 'Homestay registration (Odisha Homestay scheme, “Go Homestay” portal)', HS('check'),
      'Register and get approval from the Tourism Department on the Go Homestay portal (launched March 2026).', 'Department of Tourism, Odisha',
      [{ label: 'Odisha Tourism', url: 'https://odishatourism.gov.in/' }])] },
  '22': { name: 'Chhattisgarh', items: [] },
  '23': { name: 'Madhya Pradesh', items: [
    T('st_homestay', 'Home Stay / Gram Stay / Farm Stay registration', HS('check'),
      'MP Tourism Board registers homestays, village stays and farm stays online.', 'MP Tourism Board',
      [{ label: 'MP Tourism', url: 'https://tourism.mp.gov.in/' }])] },
  '24': { name: 'Gujarat', items: [
    T('st_homestay', 'Homestay registration (Gujarat homestay policy)', { hostel: 'opt', homestay: 'yes', pg: 'yes', hotel: 'opt', resort: 'opt' },
      'Homestays: 1–6 rooms (12 beds) in the owner’s own residence, owner and family living there (policy revised 2020). Gujarat High Court (2025): registration / permission is mandatory before using premises as a homestay or PG hostel.', 'Gujarat Tourism / local authority',
      [{ label: 'Gujarat homestay policy', url: 'https://www.gujarattourism.com/content/dam/gujrattourism/images/business-opportunities/policy-for-registration-of-homestay-establishments.pdf' }])] },
  '26': { name: 'Dadra & Nagar Haveli and Daman & Diu', items: [] },
  '27': { name: 'Maharashtra', items: [
    T('st_shops', 'Shops & Establishments registration for residential hotels / lodging', { hostel: 'yes', homestay: 'check', pg: 'yes', hotel: 'yes', resort: 'yes' },
      'Premises that receive guests register under the Maharashtra Shops & Establishments Act.', 'Labour department / municipal corporation',
      [{ label: 'BMC portal', url: 'https://portal.mcgm.gov.in/irj/portal/anonymous' }], { doc: 'shops_establishment' }),
    T('st_lodging', 'Mumbai: BMC licence for lodging houses and B&Bs', ALL('check'),
      'In Mumbai, lodging houses and B&Bs need a BMC licence — even if registered with MTDC (Bombay High Court). Other cities: check with your municipal corporation.', 'BMC / municipal corporation',
      [{ label: 'BMC portal', url: 'https://portal.mcgm.gov.in/irj/portal/anonymous' }], { doc: 'trade_licence' }),
    T('st_homestay', 'MTDC Bed & Breakfast scheme (voluntary)', HS('opt'), 'Optional state registration for B&Bs and homestays; helps with promotion.', 'Directorate of Tourism, Maharashtra',
      [{ label: 'Maharashtra Tourism', url: 'https://www.maharashtratourism.gov.in/' }])] },
  '29': { name: 'Karnataka', items: [
    T('st_homestay', 'Homestay registration with Karnataka Tourism', HS('yes'),
      'Every homestay must register (revised guidelines 2025). Checked by tourism, police, DC office and panchayat; certificate valid 5 years; display the board and keep guest, bill and complaint registers.', 'Department of Tourism, Karnataka',
      [{ label: 'Karnataka homestay guidelines', url: 'https://karnatakatourism.org/en/news/official-karnataka-homestay-registration-guidelines/' }]),
    T('st_pg', 'Bengaluru PGs: municipal licence & safety norms', { hostel: 'check', homestay: 'opt', pg: 'check', hotel: 'opt', resort: 'opt' },
      'Bengaluru PGs need a municipal trade licence and must meet fire, building and electrical safety norms (Karnataka High Court guidelines, 2026); unlicensed PGs are being sealed.', 'Bengaluru civic body (GBA / BBMP)',
      [{ label: 'Karnataka HC PG guidelines', url: 'https://www.barandbench.com/news/litigation/overcrowding-to-fire-safety-karnataka-hc-issues-safety-guidelines-for-bengaluru-pgs' }], { doc: 'trade_licence' })] },
  '30': { name: 'Goa', items: [
    T('st_tourism', 'Registration under the Goa Registration of Tourist Trade Act, 1982', ALL('yes'),
      'Every hotel, guest house, homestay, B&B and rented villa / apartment must register with the Department of Tourism before operating (homestays & B&Bs: 1–6 rooms). Needs fire NOC and society / RWA NOC where applicable; file Form XI tourist statistics every month.', 'Department of Tourism, Goa',
      [{ label: 'Goa Online — tourism registration', url: 'https://goaonline.gov.in/Appln/Uil/DeptServices?__DocId=TOU&__ServiceId=TOU03' }, { label: 'Homestay policy', url: 'https://goatourism.gov.in/homestay-tourism-policy/' }])] },
  '31': { name: 'Lakshadweep', items: [] },
  '32': { name: 'Kerala', items: [
    T('st_homestay', 'Homestay classification (Kerala Tourism)', HS('check'),
      'Homestays are inspected and classified Diamond / Gold / Silver by the Department of Tourism (valid 3 years); you still need the local body (panchayat / municipality) licence.', 'Department of Tourism, Kerala',
      [{ label: 'Kerala homestay classification', url: 'https://www.keralatourism.org/cls/homestays/classification-criteria.php' }])] },
  '33': { name: 'Tamil Nadu', items: [
    T('st_homestay', 'B&B and Homestay registration scheme', HS('check'), 'Register your homestay or B&B with the Tamil Nadu Department of Tourism.', 'Department of Tourism, Tamil Nadu',
      [{ label: 'Tamil Nadu Tourism', url: 'https://www.tamilnadutourism.tn.gov.in/' }]),
    T('st_hostel', 'Women’s hostel / PG licence (TN Hostels and Homes for Women and Children Act, 2014)', { hostel: 'if', homestay: 'opt', pg: 'if', hotel: 'opt', resort: 'opt' },
      'Hostels and PGs for women need a licence from the District Collector (valid 3 years). Running one without it is punishable.', 'District Collector',
      [{ label: 'How to apply (Chennai)', url: 'https://wikiprocedure.com/index.php/Tamil_Nadu_-_Obtain_Hostel_License_or_Permit' }], { doc: 'hostel_licence', when: 'Your hostel / PG is for women' }),
    T('st_police', 'Chennai: lodging licence from the police', { hostel: 'check', homestay: 'check', pg: 'check', hotel: 'check', resort: 'opt' },
      'Lodging houses in Chennai need a licence from the Commissioner of Police, renewed periodically.', 'Greater Chennai Police',
      [{ label: 'Renew lodging licence', url: 'https://wikiprocedure.com/index.php/Tamil_Nadu_-_Renew_Lodging_Licence_from_Police' }], { doc: 'police' })] },
  '34': { name: 'Puducherry', items: [] },
  '35': { name: 'Andaman & Nicobar Islands', items: [
    T('st_tourism', 'Registration with the Directorate of Tourism', ALL('check'),
      'Hotels, guest houses and tourist accommodation, and Bed & Breakfast units, register (and renew) with the Directorate of Tourism online.', 'Directorate of Tourism, A&N',
      [{ label: 'ANI e-Seva tourism services', url: 'https://anieseva.andamannicobar.gov.in/services_list_depart1.php?id=MzQ%3D' }])] },
  '36': { name: 'Telangana', items: [
    T('st_homestay', 'Homestay scheme (announced 2026)', HS('check'), 'The Tourism Department is launching a homestay registration scheme; register once it opens.', 'Telangana Tourism',
      [{ label: 'Telangana Tourism', url: 'https://tourism.telangana.gov.in/' }])] },
  '37': { name: 'Andhra Pradesh', items: [
    T('st_homestay', 'Homestay & B&B registration portal', HS('check'),
      'Register online; inspection by the District Tourism Officer and approval by the District Level Committee; certificate valid 2 years (Silver / Gold optional).', 'AP Tourism',
      [{ label: 'homestays.ap.gov.in', url: 'https://homestays.ap.gov.in/' }])] },
  '38': { name: 'Ladakh', items: [
    T('st_homestay', 'Homestay listing (Ladakh Homestay Policy, 2023)', HS('yes'),
      'Every eligible homestay is listed with the Department of Tourism (Assistant Director, Leh / Kargil); 1–6 rooms; Ladakh-resident owner; display the proof of listing.', 'Department of Tourism, Ladakh',
      [{ label: 'Homestay Policy 2023', url: 'https://tourism.ladakh.gov.in/assets/pdf/homestaypolicy2023.pdf' }])] },
};

// ---------------------------------------------------------------- build the list for one state + property type
export function checklist(code, kind) {
  const st = STATES[code] || { name: '', items: [] };
  const out = [];
  COMMON.forEach((it) => {
    const need = it.need[kind] || 'check';
    out.push({ ...it, need });
  });
  if (PT(code)) out.push({ key: 'ptax', title: 'Professional tax registration', doc: 'professional_tax', need: 'if', when: 'You have employees',
    what: 'This state levies professional tax: register as an employer and deduct it from salaries.', who: 'State commercial taxes department' });
  if (st.ilp) out.push({ key: 'ilp', title: st.ilp === 'protected' ? 'Guests need permits for protected areas' : 'Guests need an Inner Line Permit', doc: null, need: 'yes', info: true,
    what: st.ilp === 'protected' ? 'Visitors need permits for protected areas such as Tsomgo–Nathu La; foreigners need a Restricted Area Permit. Help guests plan for it.'
      : 'Indian visitors need an Inner Line Permit to enter this state (foreigners need a Protected Area Permit). Ask guests for it at check-in.', who: 'State government' });
  st.items.forEach((it) => out.push({ ...it, need: it.need[kind] || 'check' }));
  if (!st.items.some((x) => x.doc === 'tourism')) {
    out.push({ key: 'st_tourism_generic', title: kind === 'homestay' ? 'State homestay / B&B registration' : 'State tourism department registration', doc: 'tourism',
      need: kind === 'homestay' ? 'check' : 'opt',
      what: kind === 'homestay' ? 'Most states run a homestay or B&B registration scheme through the tourism department. Ask your district tourism office whether it is mandatory here.'
        : 'Some states require tourism units to register; others offer voluntary registration for promotion and incentives. Ask the state tourism department.',
      who: 'State / district tourism office' });
  }
  const rank = { yes: 0, if: 1, check: 2, opt: 3 };
  return out.sort((a, b) => rank[a.need] - rank[b.need]);
}

export const STATE_OPTIONS = Object.entries(STATES).map(([code, s]) => [code, s.name]).sort((a, b) => a[1].localeCompare(b[1]));
