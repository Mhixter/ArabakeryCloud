import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  showDate?: boolean;
  showSeconds?: boolean;
}

export function LiveClock({ className, showDate = true, showSeconds = true }: Props) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const time = now.toLocaleTimeString("en-NG", {
    hour: "2-digit",
    minute: "2-digit",
    ...(showSeconds ? { second: "2-digit" } : {}),
    hour12: true,
  });

  const date = now.toLocaleDateString("en-NG", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className={cn("text-right leading-none select-none", className)}>
      <p className="font-semibold tabular-nums tracking-tight">{time}</p>
      {showDate && <p className="text-[10px] opacity-60 mt-0.5">{date}</p>}
    </div>
  );
}
