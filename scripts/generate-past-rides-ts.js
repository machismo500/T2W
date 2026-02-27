const fs = require('fs');
const ridesData = JSON.parse(fs.readFileSync('/tmp/rides_data.json', 'utf-8'));

let output = `import { Ride } from "@/types";\n\nexport const pastRides: Ride[] = [\n`;

ridesData.forEach((r, idx) => {
  const ridersStr = r.riders.map(name => {
    const escaped = name.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `      "${escaped}"`;
  }).join(',\n');

  const titleEscaped = r.title.replace(/"/g, '\\"').replace(/'/g, "\\'");

  output += `  {
    id: "${r.id}",
    title: "${titleEscaped}",
    rideNumber: "${r.rideNumber}",
    type: "${r.type}",
    status: "completed",
    startDate: "${r.startDate}",
    endDate: "${r.endDate}",
    startLocation: "${r.startLocation}",
    endLocation: "${r.endLocation}",
    route: ["${r.startLocation}", "${r.endLocation}"],
    distanceKm: 0,
    maxRiders: ${r.riderCount + 5},
    registeredRiders: ${r.riderCount},
    difficulty: "${r.difficulty}",
    description: "T2W Ride ${r.rideNumber} - ${titleEscaped}",
    highlights: [],
    fee: 0,
    leadRider: "Roshan",
    sweepRider: "Imran",
    riders: [
${ridersStr}
    ],
  }`;
  if (idx < ridesData.length - 1) output += ',\n';
  else output += '\n';
});

output += `];\n`;

fs.writeFileSync('/home/user/T2W/src/data/past-rides.ts', output);
console.log('Generated past-rides.ts with ' + ridesData.length + ' rides');
