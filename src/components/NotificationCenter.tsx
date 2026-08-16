"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  PackageX,
  RefreshCw,
  ShoppingBag,
  ShieldAlert,
} from "lucide-react";
import { useToast } from "@/components/ToastProvider";

type NotificationSeverity = "critical" | "warning" | "info" | "success";

type AppNotification = {
  id: string;
  type: string;
  severity: NotificationSeverity;
  title: string;
  message: string;
  created_at: string;
  href?: string;
};

type NotificationPayload = {
  notifications?: AppNotification[];
  unread_count?: number;
  server_time?: string;
};

type NotificationCenterProps = {
  variant?: "admin" | "pos";
};

const seenKey = "oil_mart_seen_notifications";

function notificationIcon(type: string, severity: NotificationSeverity) {
  if (type === "out_of_stock") return PackageX;
  if (type === "low_stock") return AlertTriangle;
  if (type === "revocation") return ShieldAlert;
  if (type === "sale_completed") return ShoppingBag;
  if (severity === "success") return CheckCircle2;
  return Bell;
}

function relativeTime(value: string) {
  const stamp = new Date(value).getTime();
  if (!Number.isFinite(stamp)) return "";
  const diff = Math.max(0, Date.now() - stamp);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return new Date(value).toLocaleDateString();
}

function isBrowserNotificationSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function NotificationCenter({ variant = "admin" }: NotificationCenterProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const firstLoadRef = useRef(true);

  const importantCount = useMemo(
    () => items.filter((item) => item.severity === "critical" || item.severity === "warning").length,
    [items]
  );

  const saveSeen = useCallback(() => {
    if (typeof window === "undefined") return;
    const ids = Array.from(seenRef.current).slice(-250);
    localStorage.setItem(seenKey, JSON.stringify(ids));
  }, []);

  const showDeviceNotification = useCallback(async (item: AppNotification) => {
    if (!isBrowserNotificationSupported() || Notification.permission !== "granted") return;

    const body = item.message;
    const options: NotificationOptions = {
      body,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      tag: item.id,
      data: { url: item.href || "/" },
      requireInteraction: item.severity === "critical",
    };

    try {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(item.title, options);
        return;
      }
      const notification = new Notification(item.title, options);
      notification.onclick = () => {
        window.focus();
        if (item.href) router.push(item.href);
      };
    } catch {
      // Browser notifications are best-effort; in-app toasts still cover the alert.
    }
  }, [router]);

  const handleFreshItems = useCallback((nextItems: AppNotification[]) => {
    const freshImportant = nextItems.filter(
      (item) =>
        !seenRef.current.has(item.id) &&
        (item.severity === "critical" || item.severity === "warning")
    );

    if (firstLoadRef.current && isBrowserNotificationSupported() && Notification.permission === "granted") {
      freshImportant.slice(0, 3).forEach((item) => {
        void showDeviceNotification(item);
      });
    } else if (!firstLoadRef.current) {
      freshImportant.slice(0, 3).forEach((item) => {
        showToast({
          type: item.severity === "critical" ? "error" : "warning",
          title: item.title,
          message: item.message,
          duration: item.severity === "critical" ? 9000 : 6500,
          actionLabel: item.href ? "Open" : undefined,
          onAction: item.href ? () => router.push(item.href as string) : undefined,
        });
        void showDeviceNotification(item);
      });
    }

    nextItems.forEach((item) => seenRef.current.add(item.id));
    saveSeen();
  }, [router, saveSeen, showDeviceNotification, showToast]);

  const loadNotifications = useCallback(async (manual = false) => {
    try {
      if (manual) setLoading(true);
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load notifications");
      const payload: NotificationPayload = await response.json();
      const nextItems = Array.isArray(payload.notifications) ? payload.notifications : [];
      setItems(nextItems);
      setLastUpdated(payload.server_time || new Date().toISOString());
      handleFreshItems(nextItems);
      if (manual) {
        showToast({ type: "success", title: "Notifications refreshed", message: "Latest important alerts loaded." });
      }
    } catch {
      if (manual) {
        showToast({ type: "error", title: "Notification error", message: "Unable to refresh notifications." });
      }
    } finally {
      firstLoadRef.current = false;
      if (manual) setLoading(false);
    }
  }, [handleFreshItems, showToast]);

  const requestDeviceAlerts = async () => {
    if (!isBrowserNotificationSupported()) {
      showToast({ type: "warning", title: "Not supported", message: "This browser does not support device notifications." });
      return;
    }
    const nextPermission = await Notification.requestPermission();
    setPermission(nextPermission);
    if (nextPermission === "granted") {
      showToast({ type: "success", title: "Device alerts enabled", message: "Important POS alerts can now appear in the notification panel." });
      items
        .filter((item) => item.severity === "critical" || item.severity === "warning")
        .slice(0, 3)
        .forEach((item) => {
          void showDeviceNotification(item);
        });
    } else {
      showToast({ type: "warning", title: "Device alerts blocked", message: "Allow notifications in browser settings to receive panel alerts." });
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = JSON.parse(localStorage.getItem(seenKey) || "[]");
      if (Array.isArray(stored)) {
        seenRef.current = new Set(stored.filter((item) => typeof item === "string"));
      }
    } catch {
      seenRef.current = new Set();
    }
    if (isBrowserNotificationSupported()) {
      setPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    void loadNotifications(false);
    const timer = window.setInterval(() => {
      void loadNotifications(false);
    }, document.visibilityState === "visible" ? 20000 : 60000);

    const onVisible = () => {
      if (document.visibilityState === "visible") void loadNotifications(false);
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadNotifications]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const buttonClass = variant === "pos" ? "notification-bell pos-bell" : "notification-bell";

  return (
    <div ref={rootRef} className={`app-notification-center ${variant}`}>
      <button
        type="button"
        className={buttonClass}
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Bell aria-hidden="true" size={variant === "pos" ? 20 : 22} strokeWidth={1.9} />
        <i>{importantCount}</i>
      </button>

      {open && (
        <div className="app-notification-menu">
          <header>
            <div>
              <b>Notifications</b>
              <small>{lastUpdated ? `Updated ${relativeTime(lastUpdated)}` : "Live alerts"}</small>
            </div>
            <button type="button" aria-label="Refresh notifications" onClick={() => void loadNotifications(true)} disabled={loading}>
              <RefreshCw size={15} aria-hidden="true" />
            </button>
          </header>

          {permission !== "granted" && (
            <button type="button" className="notification-permission" onClick={requestDeviceAlerts}>
              <Bell size={16} aria-hidden="true" />
              <span><b>Enable device alerts</b><small>Show important alerts in the tablet or PC notification panel.</small></span>
            </button>
          )}

          <div className="notification-list">
            {items.length ? items.map((item) => {
              const Icon = notificationIcon(item.type, item.severity);
              return (
                <button
                  type="button"
                  key={item.id}
                  className={`notification-item ${item.severity}`}
                  onClick={() => {
                    if (item.href) router.push(item.href);
                    setOpen(false);
                  }}
                >
                  <Icon size={16} aria-hidden="true" />
                  <span>
                    <b>{item.title}</b>
                    <small>{item.message}</small>
                    <em>{relativeTime(item.created_at)}</em>
                  </span>
                </button>
              );
            }) : (
              <div className="notification-empty">
                <CheckCircle2 size={18} aria-hidden="true" />
                <span><b>No important alerts</b><small>Stock, sales, and audit notifications are clear.</small></span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
