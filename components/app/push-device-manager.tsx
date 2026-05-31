"use client";

import { useMemo, useState } from "react";

type PushDeviceManagerProps = {
  provider: "web_push" | "fcm" | "disabled";
  vapidPublicKey?: string | null;
  providerConfigured: boolean;
  initialDeviceCount: number;
};

function toUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

function browserPlatform() {
  const ua = navigator.userAgent || "";
  if (/iphone|ipad|ios/i.test(ua)) return "iOS browser";
  if (/android/i.test(ua)) return "Android browser";
  if (/windows/i.test(ua)) return "Windows browser";
  if (/mac os/i.test(ua)) return "macOS browser";
  return "Browser";
}

export function PushDeviceManager(props: PushDeviceManagerProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canEnable = useMemo(() => {
    return props.provider === "web_push" && props.providerConfigured && Boolean(props.vapidPublicKey);
  }, [props.provider, props.providerConfigured, props.vapidPublicKey]);

  async function enablePush() {
    if (!canEnable) {
      setMessage("Push provider not configured.");
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setMessage("This browser does not support Web Push registration.");
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage("Push notifications not enabled.");
        return;
      }

      const registration = await navigator.serviceWorker.register("/aria-push-sw.js", { scope: "/" });
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: toUint8Array(props.vapidPublicKey || "")
      });
      const payload = {
        deviceId: subscription.endpoint.slice(-24),
        endpoint: subscription.endpoint,
        subscriptionJson: JSON.stringify(subscription.toJSON()),
        platform: browserPlatform(),
        userAgent: navigator.userAgent
      };
      const res = await fetch("/api/push/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      setMessage(json?.message || (res.ok ? "Push device registered." : "Push registration failed."));
      if (res.ok) window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Push registration failed.");
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    if (!("serviceWorker" in navigator)) {
      setMessage("Push notifications not enabled.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/aria-push-sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      const deviceId = subscription?.endpoint?.slice(-24);
      await subscription?.unsubscribe();
      if (deviceId) {
        const res = await fetch("/api/push/subscriptions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId })
        });
        const json = await res.json();
        setMessage(json?.message || "Push disabled for this device.");
      } else {
        setMessage("Push disabled for this device.");
      }
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to disable push.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={enablePush}
          disabled={busy || !canEnable}
          className="inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Working..." : canEnable ? "Enable push in this browser" : "Push provider not configured"}
        </button>
        <button
          type="button"
          onClick={disablePush}
          disabled={busy || props.initialDeviceCount === 0}
          className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Disable push
        </button>
      </div>
      {message ? <p className="text-sm text-slate-400">{message}</p> : null}
    </div>
  );
}
