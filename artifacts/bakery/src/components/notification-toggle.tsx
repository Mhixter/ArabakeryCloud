import { Bell, BellOff } from "lucide-react";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  iconSize?: number;
  showLabel?: boolean;
}

export function NotificationToggle({ className, iconSize = 15, showLabel = false }: Props) {
  const { permission, subscribed, loading, isSupported, subscribe, unsubscribe } = usePushNotifications();

  if (!isSupported || permission === "denied") return null;

  const handleClick = () => {
    if (subscribed) unsubscribe();
    else subscribe();
  };

  const label = subscribed ? "Notifications on" : "Enable notifications";

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      title={subscribed ? "Turn off push notifications" : "Enable push notifications"}
      className={cn(
        "p-1.5 rounded transition-colors",
        subscribed
          ? "text-amber-400 hover:text-amber-300 hover:bg-sidebar-accent"
          : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground",
        loading && "opacity-50 cursor-wait",
        className,
      )}
    >
      {subscribed ? <Bell size={iconSize} /> : <BellOff size={iconSize} />}
      {showLabel && <span>{label}</span>}
    </button>
  );
}
