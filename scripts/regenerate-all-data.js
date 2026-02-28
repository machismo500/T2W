const fs = require('fs');
const XLSX = require('xlsx');

// ─── 1. Parse T2W Ride Data CSV ───
const csvText = fs.readFileSync('/home/user/T2W/T2W Ride Data.csv', 'utf-8');
const csvLines = csvText.split('\n').filter(l => l.trim());
const csvHeader = csvLines[0];

function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { inQuotes = !inQuotes; }
    else if (line[i] === ',' && !inQuotes) { fields.push(current.trim()); current = ''; }
    else { current += line[i]; }
  }
  fields.push(current.trim());
  return fields;
}

function parseDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

const rideDataMap = {};
for (let i = 1; i < csvLines.length; i++) {
  const f = parseCSVLine(csvLines[i]);
  const num = parseInt(f[0]);
  if (!num) continue;
  rideDataMap[num] = {
    num,
    rideName: f[1],
    month: f[2],
    startDate: parseDate(f[3]),
    endDate: parseDate(f[4]),
    totalKms: parseInt(f[5]) || 0,
    rideCost: parseInt(f[6]) || 0,
    accountsBy: f[7] || '',
    organisedBy: f[8] || '',
    pilot: f[9] || '',
    sweep: f[10] || '',
    startingPoint: f[11] || '',
    meetupTime: f[12] || '',
    rideStartTime: f[13] || '',
  };
}

console.error('Parsed CSV rides:', Object.keys(rideDataMap).length);

// ─── 2. Name Renames ───
const nameRenames = {
  'Jay': 'Jay Trivedi',
  'Sapna': 'Sapna Maria',
  'Sandeep sahoo': 'Sandeep Sahoo',
  'Sandee sahoo': 'Sandeep Sahoo',
  'Sandeep': 'Sandeep Sahoo',
  // Merge duplicates per user request
  'deva raju': 'Devaraju S',
  'Dr Raghunath': 'Dr. Raghunath H',
  'Raghunath H': 'Dr. Raghunath H',
  'Abhijit': 'Abhijitt Murugan',
  'Harish': 'Harish Mysuru',
  'Harish Kumar M R': 'Harish Mysuru',
  'Karthik V': 'Karthik V H',
  'MJ': 'Manjushree',
  'Pillion MJ': 'Manjushree',
  'Rama Prasad': 'Ramaprasad',
  'Sanjay Ganesh': 'Sanjay Ganesh Jambagi',
  'Shanks VK': 'Shankar VK',
  'Sudhakar.r': 'Sudhakar R',
};

function renameRider(name) {
  if (nameRenames[name]) return nameRenames[name];
  return name;
}

// ─── 3. Parse existing ride data from rides_data.json (rider lists) ───
const ridesJson = JSON.parse(fs.readFileSync('/tmp/rides_data.json', 'utf-8'));

// Also parse Thailand ride (#023) from Excel
const wb = XLSX.readFile('/home/user/T2W/T2W Ride Accounts.xlsx');

// Build ride map
const rideRidersMap = {};
ridesJson.forEach(r => {
  const num = parseInt(r.rideNumber.replace('#', ''));
  rideRidersMap[num] = r.riders.map(renameRider);
});

// Thailand (#23) has no rider data from Excel
if (!rideRidersMap[23]) rideRidersMap[23] = [];

// ─── 4. Determine ride type based on duration ───
function getRideType(startDate, endDate, title) {
  if (title.includes('Himalayan') || title.includes('Nepal') || title.includes('Thailand')) return 'expedition';
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  if (days <= 1) return 'day';
  if (days <= 2) return 'weekend';
  return 'multi-day';
}

function getDifficulty(title, kms) {
  if (title.includes('Himalayan') || title.includes('Nepal')) return 'extreme';
  if (title.includes('Thailand') || title.includes('Tadiyandamol') || title.includes('Kudremukha') || title.includes('Peak')) return 'challenging';
  if (kms > 1000) return 'challenging';
  if (kms > 600) return 'moderate';
  return 'moderate';
}

// ─── 5. Generate past-rides.ts ───
function esc(str) {
  return (str || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');
}

let pastRidesTs = `import { Ride } from "@/types";\n\nexport const pastRides: Ride[] = [\n`;

for (let num = 1; num <= 27; num++) {
  const csv = rideDataMap[num];
  if (!csv) { console.error(`Missing CSV data for ride #${num}`); continue; }

  const riders = (rideRidersMap[num] || []);
  const id = `ride-t2w-${String(num).padStart(3, '0')}`;
  const rideNumber = `#${String(num).padStart(3, '0')}`;
  const type = getRideType(csv.startDate, csv.endDate, csv.rideName);
  const difficulty = getDifficulty(csv.rideName, csv.totalKms);

  // Determine end location from existing data
  const existingRide = ridesJson.find(r => parseInt(r.rideNumber.replace('#', '')) === num);
  const endLocation = existingRide ? existingRide.endLocation : 'Unknown';

  const ridersStr = riders.map(name => `      "${esc(name)}"`).join(',\n');

  pastRidesTs += `  {
    id: "${id}",
    title: "${esc(csv.rideName)}",
    rideNumber: "${rideNumber}",
    type: "${type}",
    status: "completed",
    startDate: "${csv.startDate}",
    endDate: "${csv.endDate}",
    startLocation: "Bangalore, Karnataka",
    endLocation: "${esc(endLocation)}",
    route: ["Bangalore, Karnataka", "${esc(endLocation)}"],
    distanceKm: ${csv.totalKms},
    maxRiders: ${riders.length + 5},
    registeredRiders: ${riders.length},
    difficulty: "${difficulty}",
    description: "T2W Ride ${rideNumber} - ${esc(csv.rideName)}",
    highlights: [],
    fee: ${csv.rideCost},
    leadRider: "${esc(csv.pilot)}",
    sweepRider: "${esc(csv.sweep)}",
    accountsBy: "${esc(csv.accountsBy)}",
    organisedBy: "${esc(csv.organisedBy)}",
    meetupTime: "${esc(csv.meetupTime)}",
    rideStartTime: "${esc(csv.rideStartTime)}",
    startingPoint: "${esc(csv.startingPoint)}",
    riders: [
${ridersStr}
    ],
  }`;
  if (num < 27) pastRidesTs += ',\n';
  else pastRidesTs += '\n';
}

pastRidesTs += `];\n`;
fs.writeFileSync('/home/user/T2W/src/data/past-rides.ts', pastRidesTs);
console.error('Generated past-rides.ts');

// ─── 6. Generate rider-profiles.ts ───

// Parse rider CSV for personal info
const riderCsv = fs.readFileSync('/home/user/T2W/T2W Rider List - Riders  List.csv', 'utf-8');
const riderLines = riderCsv.split('\n');
const riderInfoMap = {}; // lowercase name -> info

for (let i = 1; i < riderLines.length; i++) {
  const f = parseCSVLine(riderLines[i]);
  const name = (f[1] || '').trim();
  if (!name) continue;
  riderInfoMap[name.toLowerCase()] = {
    name,
    address: f[2] || '',
    email: f[3] || '',
    phone: f[4] || '',
    emergencyContact: f[5] || '',
    emergencyPhone: f[6] || '',
    bloodGroup: f[7] || '',
  };
}

// Add renamed entries
riderInfoMap['jay trivedi'] = riderInfoMap['jay'] || riderInfoMap['jay trivedi'] || { name: 'Jay Trivedi', email: 'jaytrivedi.b@gmail.com', phone: '9986160300', address: '34, 11th cross, Rajajinagar 1st block', emergencyContact: 'Shruthi, spouse', emergencyPhone: '9739899568', bloodGroup: '' };
riderInfoMap['sapna maria'] = riderInfoMap['sapna'] || riderInfoMap['sapna maria'] || { name: 'Sapna Maria', email: 'sapnamaria.v07@gmail.com', phone: '9886144331', address: 'B504 Arvind Sporcia', emergencyContact: 'Roshan', emergencyPhone: '9880141543', bloodGroup: '' };
if (riderInfoMap['jay trivedi']) riderInfoMap['jay trivedi'].name = 'Jay Trivedi';
if (riderInfoMap['sapna maria']) riderInfoMap['sapna maria'].name = 'Sapna Maria';

// Build rider -> rides, kms, organized, sweep maps
const riderRidesMap2 = {}; // lowercase name -> [{rideId, rideNumber, rideTitle, rideDate, distanceKm}]
const riderOrganizedMap = {}; // lowercase name -> count
const riderSweepMap = {}; // lowercase name -> count
const riderPilotMap = {}; // lowercase name -> count

// Process all rides
for (let num = 1; num <= 27; num++) {
  const csv = rideDataMap[num];
  if (!csv) continue;
  const riders = rideRidersMap[num] || [];
  const id = `ride-t2w-${String(num).padStart(3, '0')}`;
  const rideNumber = `#${String(num).padStart(3, '0')}`;

  riders.forEach(riderName => {
    const key = riderName.toLowerCase().trim();
    if (!riderRidesMap2[key]) riderRidesMap2[key] = [];
    riderRidesMap2[key].push({
      rideId: id,
      rideNumber,
      rideTitle: csv.rideName,
      rideDate: csv.startDate,
      distanceKm: csv.totalKms,
    });
  });

  // Track organizer
  if (csv.organisedBy) {
    const orgKey = renameRider(csv.organisedBy).toLowerCase().trim();
    riderOrganizedMap[orgKey] = (riderOrganizedMap[orgKey] || 0) + 1;
  }
  // Track sweep
  if (csv.sweep) {
    const sweepKey = renameRider(csv.sweep).toLowerCase().trim();
    riderSweepMap[sweepKey] = (riderSweepMap[sweepKey] || 0) + 1;
  }
  // Track pilot
  if (csv.pilot) {
    const pilotKey = renameRider(csv.pilot).toLowerCase().trim();
    riderPilotMap[pilotKey] = (riderPilotMap[pilotKey] || 0) + 1;
  }
}

// Normalize name matching
function normalizeForMatch(name) {
  return name.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
}

function findCsvInfo(riderKey) {
  if (riderInfoMap[riderKey]) return riderInfoMap[riderKey];
  const norm = normalizeForMatch(riderKey);
  for (const k of Object.keys(riderInfoMap)) {
    if (normalizeForMatch(k) === norm) return riderInfoMap[k];
  }
  // First name match
  const firstName = norm.split(' ')[0];
  if (firstName.length > 3) {
    const matches = Object.keys(riderInfoMap).filter(k => normalizeForMatch(k).split(' ')[0] === firstName);
    if (matches.length === 1) return riderInfoMap[matches[0]];
  }
  return null;
}

// Build profiles - first resolve display names for all keys, then merge by display name
const allRiderKeys = Object.keys(riderRidesMap2).sort();

// Step 1: Map each key to its display name
const keyToDisplayName = {};
allRiderKeys.forEach(key => {
  const csvInfo = findCsvInfo(key);
  let displayName = key;
  for (let num = 1; num <= 27; num++) {
    const riders = rideRidersMap[num] || [];
    const match = riders.find(r => r.toLowerCase().trim() === key);
    if (match) { displayName = match; break; }
  }
  if (csvInfo && csvInfo.name) displayName = csvInfo.name;
  keyToDisplayName[key] = displayName;
});

// Step 2: Group keys by display name (merge same-person entries)
const displayNameToKeys = {};
allRiderKeys.forEach(key => {
  const dn = keyToDisplayName[key];
  if (!displayNameToKeys[dn]) displayNameToKeys[dn] = [];
  displayNameToKeys[dn].push(key);
});

// Step 3: Build merged profiles
const profiles = [];
const usedEmails = new Set();
let nextId = 1;

Object.entries(displayNameToKeys).forEach(([displayName, keys]) => {
  // Merge all rides from all keys for this person
  const allRides = [];
  const seenRideIds = new Set();
  keys.forEach(key => {
    (riderRidesMap2[key] || []).forEach(ride => {
      if (!seenRideIds.has(ride.rideId)) {
        seenRideIds.add(ride.rideId);
        allRides.push(ride);
      }
    });
  });

  // Find best CSV info from any key
  let csvInfo = null;
  for (const key of keys) {
    csvInfo = findCsvInfo(key);
    if (csvInfo) break;
  }

  // Merge organized/sweep/pilot counts across all keys
  let organized = 0, sweeps = 0, pilots = 0;
  keys.forEach(key => {
    organized += riderOrganizedMap[key] || 0;
    sweeps += riderSweepMap[key] || 0;
    pilots += riderPilotMap[key] || 0;
  });

  let email = csvInfo ? csvInfo.email : '';
  if (!email) {
    email = displayName.toLowerCase().replace(/[^a-z\s]/g, '').trim().replace(/\s+/g, '.') + '@t2w-rider.com';
  }
  let finalEmail = email;
  if (usedEmails.has(email.toLowerCase())) {
    finalEmail = email.replace('@', nextId + '@');
  }
  usedEmails.add(finalEmail.toLowerCase());

  const totalKm = allRides.reduce((sum, r) => sum + (r.distanceKm || 0), 0);
  const sortedRides = [...allRides].sort((a, b) => a.rideDate.localeCompare(b.rideDate));

  profiles.push({
    id: `rider-${String(nextId).padStart(3, '0')}`,
    name: displayName,
    email: finalEmail,
    phone: csvInfo ? csvInfo.phone : '',
    address: csvInfo ? csvInfo.address : '',
    emergencyContact: csvInfo ? csvInfo.emergencyContact : '',
    emergencyPhone: csvInfo ? csvInfo.emergencyPhone : '',
    bloodGroup: csvInfo ? csvInfo.bloodGroup : '',
    joinDate: sortedRides[0] ? sortedRides[0].rideDate : '2024-03-16',
    ridesCompleted: allRides.length,
    totalKm,
    ridesOrganized: organized,
    sweepsDone: sweeps,
    pilotsDone: pilots,
    _keys: keys, // keep for name-to-id map
    ridesParticipated: sortedRides.map(r => ({
      rideId: r.rideId,
      rideNumber: r.rideNumber,
      rideTitle: r.rideTitle,
      rideDate: r.rideDate,
      distanceKm: r.distanceKm,
    })),
  });
  nextId++;
});

// Sort by name
profiles.sort((a, b) => a.name.localeCompare(b.name));
profiles.forEach((p, i) => { p.id = `rider-${String(i + 1).padStart(3, '0')}`; });

// Generate TS
let rpTs = `export interface RiderProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  emergencyContact: string;
  emergencyPhone: string;
  bloodGroup: string;
  joinDate: string;
  ridesCompleted: number;
  totalKm: number;
  ridesOrganized: number;
  sweepsDone: number;
  pilotsDone: number;
  avatarUrl?: string;
  ridesParticipated: {
    rideId: string;
    rideNumber: string;
    rideTitle: string;
    rideDate: string;
    distanceKm: number;
  }[];
}\n\nexport const riderProfiles: RiderProfile[] = [\n`;

profiles.forEach((p, idx) => {
  const ridesStr = p.ridesParticipated.map(r =>
    `      { rideId: "${r.rideId}", rideNumber: "${r.rideNumber}", rideTitle: "${esc(r.rideTitle)}", rideDate: "${r.rideDate}", distanceKm: ${r.distanceKm} }`
  ).join(',\n');

  rpTs += `  {
    id: "${p.id}",
    name: "${esc(p.name)}",
    email: "${esc(p.email)}",
    phone: "${esc(p.phone)}",
    address: "${esc(p.address)}",
    emergencyContact: "${esc(p.emergencyContact)}",
    emergencyPhone: "${esc(p.emergencyPhone)}",
    bloodGroup: "${esc(p.bloodGroup)}",
    joinDate: "${p.joinDate}",
    ridesCompleted: ${p.ridesCompleted},
    totalKm: ${p.totalKm},
    ridesOrganized: ${p.ridesOrganized},
    sweepsDone: ${p.sweepsDone},
    pilotsDone: ${p.pilotsDone},
    ridesParticipated: [
${ridesStr}
    ],
  }`;
  if (idx < profiles.length - 1) rpTs += ',\n';
  else rpTs += '\n';
});

rpTs += `];\n\n`;

// Name lookup map - include all variant keys for each profile
rpTs += `export const riderNameToId: Record<string, string> = {\n`;
const nameToIdEntries = [];
profiles.forEach(p => {
  // Add the display name
  const added = new Set();
  const addEntry = (name) => {
    const lower = name.toLowerCase().trim();
    if (!added.has(lower)) {
      added.add(lower);
      nameToIdEntries.push({ name: lower, id: p.id });
    }
  };
  addEntry(p.name);
  // Add all variant keys from the _keys array
  if (p._keys) p._keys.forEach(k => addEntry(k));
});
nameToIdEntries.forEach((entry, idx) => {
  rpTs += `  "${entry.name}": "${entry.id}"`;
  if (idx < nameToIdEntries.length - 1) rpTs += ',\n';
  else rpTs += '\n';
});
rpTs += `};\n\n`;

rpTs += `export function findRiderByName(name: string): RiderProfile | undefined {
  const key = name.toLowerCase().trim();
  const id = riderNameToId[key];
  if (id) return riderProfiles.find(r => r.id === id);
  return riderProfiles.find(r => r.name.toLowerCase() === key);
}\n`;

fs.writeFileSync('/home/user/T2W/src/data/rider-profiles.ts', rpTs);
console.error(`Generated rider-profiles.ts with ${profiles.length} profiles`);

// ─── 7. Update upcoming ride #028 data ───
const ride28 = rideDataMap[28];
if (ride28) {
  console.error(`Ride #028 data: start=${ride28.startDate}, end=${ride28.endDate}, kms=${ride28.totalKms}, pilot=${ride28.pilot}, sweep=${ride28.sweep}, org=${ride28.organisedBy}`);
}

console.error('Done!');
