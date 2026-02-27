const fs = require('fs');
const ridesData = JSON.parse(fs.readFileSync('/tmp/rides_data.json', 'utf-8'));

const entries = ridesData.map(r => {
  const ridersArr = r.riders.map(name => {
    const escaped = name.replace(/"/g, '\\"');
    return `      "${escaped}"`;
  }).join(',\n');

  return `  {
    id: "${r.id}",
    title: "${r.title}",
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
    description: "T2W Ride ${r.rideNumber} - ${r.title}",
    highlights: [],
    fee: 0,
    leadRider: "Roshan",
    sweepRider: "Imran",
    riders: [
${ridersArr}
    ],
  }`;
});

console.log(entries.join(',\n'));
