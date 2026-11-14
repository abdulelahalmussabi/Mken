// A small test to verify the logic used in listOpenSlots (without DB or secrets)

function parseTime(time) {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function computeOpenSlots({ hoursStart, hoursEnd, slotDurationMinutes, bookedTimes }) {
  const startMin = parseTime(hoursStart);
  const endMin = parseTime(hoursEnd);
  
  const slots = [];
  for (let m = startMin; m + slotDurationMinutes <= endMin; m += slotDurationMinutes) {
    const timeStr = formatTime(m);
    if (!bookedTimes.has(timeStr)) {
      slots.push(timeStr);
    }
  }
  return slots;
}

// Test cases
const booked = new Set(["10:00", "11:30"]);
const slots = computeOpenSlots({
  hoursStart: '09:00',
  hoursEnd: '12:00',
  slotDurationMinutes: 30,
  bookedTimes: booked
});

const expected = ["09:00", "09:30", "10:30", "11:00"];

console.log("Expected:", expected);
console.log("Actual:  ", slots);

if (JSON.stringify(slots) === JSON.stringify(expected)) {
  console.log("Pure slot logic works correctly.");
} else {
  console.error("❌ Slot logic mismatch.");
  process.exit(1);
}
