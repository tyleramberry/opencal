const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

export function buildIcs(opts: {
  uid: string;
  start: Date;
  end: Date;
  title: string;
  description: string;
  location?: string;
  organizer?: { name: string; email?: string | null };
  attendee: { name: string; email: string };
  cancelled?: boolean;
}): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//OpenCal//EN",
    `METHOD:${opts.cancelled ? "CANCEL" : "REQUEST"}`,
    "BEGIN:VEVENT",
    `UID:${opts.uid}@opencal`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(opts.start)}`,
    `DTEND:${stamp(opts.end)}`,
    `SUMMARY:${escape(opts.title)}`,
    `DESCRIPTION:${escape(opts.description)}`,
    opts.location ? `LOCATION:${escape(opts.location)}` : "",
    opts.organizer?.email ? `ORGANIZER;CN=${escape(opts.organizer.name)}:mailto:${opts.organizer.email}` : "",
    `ATTENDEE;CN=${escape(opts.attendee.name)};RSVP=TRUE:mailto:${opts.attendee.email}`,
    `STATUS:${opts.cancelled ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.filter(Boolean).join("\r\n");
}
