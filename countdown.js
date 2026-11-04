// Deadlines arrive as absolute times with a +09:00 offset, so the device's own time zone cannot shift them.
export function countdown(nowMs, schedule) {
  const toDeadline = Math.max(0, Date.parse(schedule.deadline_at) - nowMs);
  const toDraw = Math.max(0, Date.parse(schedule.draw_at) - nowMs);
  const phase = toDeadline > 0 ? "before_deadline" : toDraw > 0 ? "before_draw" : "pending";
  return { phase, toDeadline, toDraw };
}

export function formatRemaining(ms) {
  const total = Math.floor(ms / 1000);
  const parts = [
    [Math.floor(total / 86400), "일"],
    [Math.floor(total / 3600) % 24, "시간"],
    [Math.floor(total / 60) % 60, "분"],
    [total % 60, "초"],
  ];
  const first = parts.findIndex(([value]) => value > 0);
  if (first < 0) return "0초";
  return parts.slice(first).map(([value, unit]) => `${value}${unit}`).join(" ");
}
