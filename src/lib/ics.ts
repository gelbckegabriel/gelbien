/**
 * A monthly calendar reminder as an .ics file — works with Google Calendar, Apple
 * Calendar and Outlook without asking for any calendar permission.
 */
export function monthlyReminderIcs(opts: { title: string; description: string; url: string; firstDate: string; day: number }): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const date = opts.firstDate.replace(/-/g, "");
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Gelbien//Monthly check-in//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:gelbien-checkin-${date}@gelbien`,
    `DTSTAMP:${stamp}`,
    // floating local time: 9:00 wherever the user is
    `DTSTART:${date}T090000`,
    `DTEND:${date}T091500`,
    `RRULE:FREQ=MONTHLY;BYMONTHDAY=${opts.day}`,
    `SUMMARY:${esc(opts.title)}`,
    `DESCRIPTION:${esc(`${opts.description}\n${opts.url}`)}`,
    `URL:${opts.url}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(opts.title)}`,
    "TRIGGER:PT0M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
