const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const SLOT_QUANTUM_MINUTES = 15;

const indiaTimeParts = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const weekday = values.weekday.toLowerCase().slice(0, 3);

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    dayKey: weekday,
    minutes: Number(values.hour) * 60 + Number(values.minute),
  };
};

const toMinutes = (time) => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(time || ""));
  return match ? Number(match[1]) * 60 + Number(match[2]) : NaN;
};

const dateKeyDay = (dateKey) => {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dateKey) {
    return null;
  }
  return DAY_KEYS[date.getUTCDay()];
};

const dateKeyOffset = (dateKey, todayKey) => {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  const today = new Date(`${todayKey}T12:00:00.000Z`);
  return Math.round((date - today) / 86400000);
};

const getScheduleForDate = (business, dateKey, now = new Date()) => {
  const current = indiaTimeParts(now);
  const dayKey = dateKeyDay(dateKey);
  const settings = business.appointmentSettings || {};
  const offset = dateKeyOffset(dateKey, current.date);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey)) || !dayKey) {
    return { available: false, reason: "Select a valid booking date." };
  }
  if (!settings.enabled) {
    return { available: false, reason: "Online appointments are not enabled." };
  }
  if (offset < 0) {
    return { available: false, reason: "Bookings cannot be made for a past date." };
  }
  if (offset > Number(settings.advanceBookingDays || 30)) {
    return { available: false, reason: "This date is outside the advance booking window." };
  }
  if (!(settings.workingDays || []).includes(dayKey)) {
    return { available: false, reason: "Appointments are not offered on this day." };
  }

  const dayHours = business.hours?.[dayKey];
  if (dayHours?.closed) {
    return { available: false, reason: "The business is closed on this day." };
  }
  const opening = Number.isFinite(toMinutes(settings.openingTime))
    ? toMinutes(settings.openingTime)
    : toMinutes(dayHours?.open);
  const closing = Number.isFinite(toMinutes(settings.closingTime))
    ? toMinutes(settings.closingTime)
    : toMinutes(dayHours?.close);
  if (!Number.isFinite(opening) || !Number.isFinite(closing) || closing <= opening) {
    return { available: false, reason: "Appointment hours have not been configured." };
  }

  return {
    available: true,
    dayKey,
    opening,
    closing,
    currentMinutes: offset === 0 ? current.minutes : -1,
    settings,
  };
};

const getSlotStarts = (schedule, durationMinutes) => {
  if (!schedule.available) return [];

  const step = Number(schedule.settings.slotDurationMinutes || 30);
  const duration = Math.max(1, Number(durationMinutes) || step);
  const buffer = Math.max(0, Number(schedule.settings.bufferMinutes) || 0);
  const starts = [];

  for (
    let start = schedule.opening;
    start + duration + buffer <= schedule.closing;
    start += step
  ) {
    if (start > schedule.currentMinutes) {
      starts.push(`${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`);
    }
  }
  return starts;
};

const getOccupiedIntervals = (time, durationMinutes, bufferMinutes = 0) => {
  const start = toMinutes(time);
  const end = start + Math.max(1, Number(durationMinutes) || SLOT_QUANTUM_MINUTES) + Math.max(0, Number(bufferMinutes) || 0);
  const intervals = [];

  for (
    let interval = Math.floor(start / SLOT_QUANTUM_MINUTES) * SLOT_QUANTUM_MINUTES;
    interval < end;
    interval += SLOT_QUANTUM_MINUTES
  ) {
    intervals.push(interval);
  }
  return intervals;
};

module.exports = {
  SLOT_QUANTUM_MINUTES,
  getIndiaTimeParts: indiaTimeParts,
  getScheduleForDate,
  getSlotStarts,
  getOccupiedIntervals,
  toMinutes,
};
