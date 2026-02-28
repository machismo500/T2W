const fs = require('fs');
const XLSX = require('xlsx');

// 1. Parse rider CSV
const csv = fs.readFileSync('/home/user/T2W/T2W Rider List - Riders  List.csv', 'utf-8');
const lines = csv.split('\n');
const header = lines[0];
const riderMap = {}; // lowercase name -> rider info

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  // Parse CSV - handle commas inside quotes
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let j = 0; j < line.length; j++) {
    if (line[j] === '"') {
      inQuotes = !inQuotes;
    } else if (line[j] === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += line[j];
    }
  }
  fields.push(current.trim());

  const num = fields[0];
  const name = fields[1];
  const address = fields[2] || '';
  const email = fields[3] || '';
  const phone = fields[4] || '';
  const emergencyContact = fields[5] || '';
  const emergencyPhone = fields[6] || '';
  const bloodGroup = fields[7] || '';

  if (!name) continue;

  const key = name.toLowerCase().trim();
  // Only keep first entry for duplicate names (unless different email)
  if (!riderMap[key]) {
    riderMap[key] = {
      csvNum: parseInt(num) || 0,
      name: name.trim(),
      address: address,
      email: email,
      phone: phone,
      emergencyContact: emergencyContact,
      emergencyPhone: emergencyPhone,
      bloodGroup: bloodGroup,
    };
  }
}

// 2. Parse past-rides to get rider-to-rides mapping
const ridesData = JSON.parse(fs.readFileSync('/tmp/rides_data.json', 'utf-8'));

// Build a map: riderName -> [rideIds]
const riderRidesMap = {}; // lowercase name -> [{rideId, rideNumber, rideTitle}]

ridesData.forEach(ride => {
  ride.riders.forEach(riderName => {
    const key = riderName.toLowerCase().trim();
    if (!riderRidesMap[key]) riderRidesMap[key] = [];
    riderRidesMap[key].push({
      rideId: 'ride-t2w-' + ride.rideNumber.replace('#', '').padStart(3, '0'),
      rideNumber: ride.rideNumber,
      rideTitle: ride.title,
      rideDate: ride.startDate,
    });
  });
});

// Fix: ride IDs use the number from rideMeta
ridesData.forEach(ride => {
  const num = ride.rideNumber.replace('#', '');
  ride.riders.forEach(riderName => {
    const key = riderName.toLowerCase().trim();
    // already added above
  });
});

// 3. Match riders from rides to CSV entries
// Name matching: try exact, then try partial/fuzzy
function normalizeForMatch(name) {
  return name.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
}

const allRideRiderNames = Object.keys(riderRidesMap);
const csvKeys = Object.keys(riderMap);

// Build matching map
const matchMap = {}; // ride rider key -> csv key
allRideRiderNames.forEach(rideKey => {
  // Try exact match
  if (riderMap[rideKey]) {
    matchMap[rideKey] = rideKey;
    return;
  }

  // Try normalized match
  const normalized = normalizeForMatch(rideKey);
  for (const csvKey of csvKeys) {
    if (normalizeForMatch(csvKey) === normalized) {
      matchMap[rideKey] = csvKey;
      return;
    }
  }

  // Try substring match (CSV name contains ride name or vice versa)
  for (const csvKey of csvKeys) {
    const csvNorm = normalizeForMatch(csvKey);
    if (csvNorm.includes(normalized) || normalized.includes(csvNorm)) {
      if (Math.abs(csvNorm.length - normalized.length) < 5) {
        matchMap[rideKey] = csvKey;
        return;
      }
    }
  }

  // Try first-name match as last resort (only if unique)
  const firstName = normalized.split(' ')[0];
  if (firstName.length > 3) {
    const matches = csvKeys.filter(k => normalizeForMatch(k).split(' ')[0] === firstName);
    if (matches.length === 1) {
      matchMap[rideKey] = matches[0];
      return;
    }
  }
});

// 4. Generate rider profiles
const profiles = [];
const usedEmails = new Set();
const seenCsvKeys = new Set();
let riderId = 1;

// First, process riders from rides (they have ride history)
allRideRiderNames.forEach(rideKey => {
  const csvKey = matchMap[rideKey];
  const csvData = csvKey ? riderMap[csvKey] : null;

  // Avoid duplicates from CSV
  if (csvKey && seenCsvKeys.has(csvKey)) {
    // Find the existing profile and add the rides
    const existingProfile = profiles.find(p => p._csvKey === csvKey);
    if (existingProfile) {
      const newRides = riderRidesMap[rideKey] || [];
      newRides.forEach(r => {
        if (!existingProfile.ridesParticipated.find(er => er.rideId === r.rideId)) {
          existingProfile.ridesParticipated.push(r);
        }
      });
      existingProfile.ridesCompleted = existingProfile.ridesParticipated.length;
    }
    return;
  }

  const displayName = csvData ? csvData.name : riderRidesMap[rideKey][0] ?
    // Use original case from ride data
    (() => {
      for (const ride of ridesData) {
        for (const r of ride.riders) {
          if (r.toLowerCase().trim() === rideKey) return r;
        }
      }
      return rideKey;
    })() : rideKey;

  let email = csvData ? csvData.email : '';
  if (!email) {
    // Generate email from name
    email = displayName.toLowerCase().replace(/[^a-z\s]/g, '').trim().replace(/\s+/g, '.') + '@t2w-rider.com';
  }

  // Deduplicate emails
  let finalEmail = email;
  if (usedEmails.has(email.toLowerCase())) {
    finalEmail = email.replace('@', riderId + '@');
  }
  usedEmails.add(finalEmail.toLowerCase());

  const rides = riderRidesMap[rideKey] || [];

  const profile = {
    id: `rider-${String(riderId).padStart(3, '0')}`,
    name: displayName,
    email: finalEmail,
    phone: csvData ? csvData.phone : '',
    address: csvData ? csvData.address : '',
    emergencyContact: csvData ? csvData.emergencyContact : '',
    emergencyPhone: csvData ? csvData.emergencyPhone : '',
    bloodGroup: csvData ? csvData.bloodGroup : '',
    joinDate: rides.length > 0 ? rides.sort((a, b) => a.rideDate.localeCompare(b.rideDate))[0].rideDate : '2024-03-16',
    ridesCompleted: rides.length,
    ridesParticipated: rides.sort((a, b) => a.rideDate.localeCompare(b.rideDate)),
    _csvKey: csvKey || null,
    _matched: !!csvKey,
  };

  profiles.push(profile);
  if (csvKey) seenCsvKeys.add(csvKey);
  riderId++;
});

// Sort profiles by name
profiles.sort((a, b) => a.name.localeCompare(b.name));

// Re-assign IDs after sorting
profiles.forEach((p, i) => {
  p.id = `rider-${String(i + 1).padStart(3, '0')}`;
});

// Stats
const matched = profiles.filter(p => p._matched).length;
const unmatched = profiles.filter(p => !p._matched).length;
console.error(`Total profiles: ${profiles.length}, Matched to CSV: ${matched}, Unmatched: ${unmatched}`);
console.error(`Unmatched riders: ${profiles.filter(p => !p._matched).map(p => p.name).join(', ')}`);

// Output clean profiles (remove internal fields)
const cleanProfiles = profiles.map(p => ({
  id: p.id,
  name: p.name,
  email: p.email,
  phone: p.phone,
  address: p.address,
  emergencyContact: p.emergencyContact,
  emergencyPhone: p.emergencyPhone,
  bloodGroup: p.bloodGroup,
  joinDate: p.joinDate,
  ridesCompleted: p.ridesCompleted,
  ridesParticipated: p.ridesParticipated.map(r => ({
    rideId: r.rideId,
    rideNumber: r.rideNumber,
    rideTitle: r.rideTitle,
    rideDate: r.rideDate,
  })),
}));

fs.writeFileSync('/tmp/rider_profiles.json', JSON.stringify(cleanProfiles, null, 2));
console.error('Written to /tmp/rider_profiles.json');
