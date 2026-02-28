const fs = require('fs');
const profiles = JSON.parse(fs.readFileSync('/tmp/rider_profiles.json', 'utf-8'));

// Generate TypeScript file
let output = `export interface RiderProfile {
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
  avatarUrl?: string;
  ridesParticipated: {
    rideId: string;
    rideNumber: string;
    rideTitle: string;
    rideDate: string;
  }[];
}

export const riderProfiles: RiderProfile[] = [\n`;

profiles.forEach((p, idx) => {
  const rides = p.ridesParticipated.map(r =>
    `      { rideId: "${r.rideId}", rideNumber: "${r.rideNumber}", rideTitle: "${esc(r.rideTitle)}", rideDate: "${r.rideDate}" }`
  ).join(',\n');

  output += `  {
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
    ridesParticipated: [
${rides}
    ],
  }`;
  if (idx < profiles.length - 1) output += ',\n';
  else output += '\n';
});

output += `];\n\n`;

// Generate a name-to-id lookup map
output += `// Name -> rider ID lookup (lowercase name to id)\n`;
output += `export const riderNameToId: Record<string, string> = {\n`;

profiles.forEach((p, idx) => {
  output += `  "${p.name.toLowerCase()}": "${p.id}"`;
  if (idx < profiles.length - 1) output += ',\n';
  else output += '\n';
});

output += `};\n\n`;

// Also generate lookup function
output += `export function findRiderByName(name: string): RiderProfile | undefined {
  const key = name.toLowerCase().trim();
  const id = riderNameToId[key];
  if (id) return riderProfiles.find(r => r.id === id);
  // Fuzzy: try partial match
  return riderProfiles.find(r => r.name.toLowerCase() === key);
}\n`;

fs.writeFileSync('/home/user/T2W/src/data/rider-profiles.ts', output);
console.log(`Generated rider-profiles.ts with ${profiles.length} profiles`);

function esc(str) {
  return (str || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');
}
