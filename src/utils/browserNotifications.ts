/**
 * Browser Desktop Notification Utility
 */

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  if (Notification.permission === "granted") {
    return "granted";
  }
  try {
    return await Notification.requestPermission();
  } catch (err) {
    console.error("Error requesting notification permission:", err);
    return "denied";
  }
}

export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function sendBrowserNotification(
  title: string,
  options?: {
    body?: string;
    icon?: string;
    tag?: string;
    onClick?: () => void;
  }
): Notification | null {
  if (!isNotificationSupported() || Notification.permission !== "granted") {
    return null;
  }

  try {
    const notification = new Notification(title, {
      body: options?.body || "AmmaAuto Reminder Alert",
      icon: options?.icon || "/favicon.ico",
      tag: options?.tag,
    });

    notification.onclick = () => {
      window.focus();
      if (options?.onClick) {
        options.onClick();
      }
      notification.close();
    };

    return notification;
  } catch (err) {
    console.error("Error showing browser notification:", err);
    return null;
  }
}
