"use client";

import { useEffect, useState } from "react";

function parts(target: string, now: number): { days: number; hours: number; minutes: number; seconds: number } {
  const left = Math.max(0, Date.parse(target) - now);
  const days = Math.floor(left / 86_400_000);
  const hours = Math.floor((left % 86_400_000) / 3_600_000);
  const minutes = Math.floor((left % 3_600_000) / 60_000);
  const seconds = Math.floor((left % 60_000) / 1000);
  return { days, hours, minutes, seconds };
}

export function Countdown({
  target,
  labels,
}: {
  target: string;
  labels: [string, string, string, string];
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const clock = parts(target, now);
  const values = [clock.days, clock.hours, clock.minutes, clock.seconds];
  return (
    <div className="digits">
      {values.map((value, index) => (
        <div key={labels[index]}>
          <strong>{String(value).padStart(2, "0")}</strong>
          <span>{labels[index]}</span>
        </div>
      ))}
    </div>
  );
}
