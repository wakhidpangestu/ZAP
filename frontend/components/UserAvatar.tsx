"use client";

import React, { useEffect, useLayoutEffect, useMemo, useState } from "react";

export interface UserAvatarProps {
  name?: string | null;
  email?: string | null;
  avatar?: string | null;
  isGuest?: boolean;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

export function cleanAvatarUrl(url?: string | null): string | undefined {
  if (!url || typeof url !== "string") return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (trimmed.includes("default-user=s96-c") || trimmed.includes("/a/default-user")) {
    return undefined;
  }
  if (trimmed.includes("googleusercontent.com")) {
    return trimmed.replace(/=s\d+(-c)?$/, "=s128-c");
  }
  return trimmed;
}

const SIZE_CLASSES: Record<NonNullable<UserAvatarProps["size"]>, string> = {
  xs: "w-6 h-6 text-[11px]",
  sm: "w-7 h-7 text-xs",
  md: "w-8 h-8 text-xs",
  lg: "w-10 h-10 text-sm",
};

const DATA_URL_PREFIX = "zap_avatar_dataurl_";
const AVATAR_EVENT = "zap_avatar_updated";
const MAX_DATA_URL_CHARS = 300_000;

// useLayoutEffect di klien (baca cache sebelum paint pertama), useEffect di server (tanpa warning SSR)
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Satu permintaan meta per email per sesi tab, dibagi ke semua instance avatar
const inflightMeta = new Map<string, Promise<string | null>>();

function readCachedDataUrl(email: string): string | null {
  if (!email || typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(DATA_URL_PREFIX + email);
    return v && v.startsWith("data:image/") ? v : null;
  } catch {
    return null;
  }
}

function writeCachedDataUrl(email: string, dataUrl: string): void {
  if (!email || typeof window === "undefined") return;
  if (!dataUrl.startsWith("data:image/") || dataUrl.length > MAX_DATA_URL_CHARS) return;
  try {
    if (localStorage.getItem(DATA_URL_PREFIX + email) === dataUrl) return;
    localStorage.setItem(DATA_URL_PREFIX + email, dataUrl);
    window.dispatchEvent(new CustomEvent(AVATAR_EVENT, { detail: { email, dataUrl } }));
  } catch {
    // quota penuh: tetap jalan dengan proxy URL
  }
}

function fetchAvatarDataUrl(email: string, url?: string): Promise<string | null> {
  const key = `${email}|${url || ""}`;
  const existing = inflightMeta.get(key);
  if (existing) return existing;
  const params = new URLSearchParams({ action: "meta", email });
  if (url) params.set("url", url);
  const p = fetch(`/api/user/avatar?${params.toString()}`, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => (j && typeof j.dataUrl === "string" ? (j.dataUrl as string) : null))
    .catch(() => null);
  inflightMeta.set(key, p);
  return p;
}

export default function UserAvatar({
  name,
  email,
  avatar,
  isGuest = false,
  size = "sm",
  className = "",
}: UserAvatarProps) {
  const cleanUrl = cleanAvatarUrl(avatar);
  const cleanEmail = (email || "").trim().toLowerCase();
  const isGuestEmail =
    isGuest ||
    cleanEmail.includes("@student.zap") ||
    cleanEmail.includes("@guest.zap") ||
    !cleanEmail.includes("@");
  const syncEmail = isGuestEmail ? "" : cleanEmail;

  const proxySrc = useMemo(() => {
    if (!syncEmail && !cleanUrl) return undefined;
    const params = new URLSearchParams();
    if (syncEmail) params.set("email", syncEmail);
    if (cleanUrl) params.set("url", cleanUrl);
    return `/api/user/avatar?${params.toString()}`;
  }, [syncEmail, cleanUrl]);

  const [dataUrl, setDataUrl] = useState<string | null>(null);
  // Urutan sumber: data URL lokal -> proxy server -> URL langsung -> inisial
  const [failed, setFailed] = useState<{ data: boolean; proxy: boolean; direct: boolean }>({
    data: false,
    proxy: false,
    direct: false,
  });

  // 1. Baca cache data URL sebelum paint pertama
  useIsoLayoutEffect(() => {
    setDataUrl(readCachedDataUrl(syncEmail));
    setFailed({ data: false, proxy: false, direct: false });
  }, [syncEmail, cleanUrl]);

  // 2. Revalidasi di latar belakang + dengarkan pembaruan dari instance lain
  useEffect(() => {
    if (!syncEmail) return;
    let cancelled = false;
    fetchAvatarDataUrl(syncEmail, cleanUrl).then((fresh) => {
      if (cancelled || !fresh) return;
      writeCachedDataUrl(syncEmail, fresh);
      setDataUrl((prev) => (prev === fresh ? prev : fresh));
      setFailed((f) => (f.data ? { ...f, data: false } : f));
    });
    const onUpdate = (e: Event) => {
      const detail = (e as CustomEvent<{ email: string; dataUrl: string }>).detail;
      if (detail?.email === syncEmail && detail.dataUrl) setDataUrl(detail.dataUrl);
    };
    window.addEventListener(AVATAR_EVENT, onUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener(AVATAR_EVENT, onUpdate);
    };
  }, [syncEmail, cleanUrl]);

  const activeSrc =
    dataUrl && !failed.data
      ? dataUrl
      : proxySrc && !failed.proxy
      ? proxySrc
      : cleanUrl && !failed.direct
      ? cleanUrl
      : undefined;

  const handleError = () => {
    setFailed((f) => {
      if (activeSrc === dataUrl) return { ...f, data: true };
      if (activeSrc === proxySrc) return { ...f, proxy: true };
      return { ...f, direct: true };
    });
  };

  const initial = (name || email || "U").trim().charAt(0).toUpperCase() || "U";
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.sm;

  return (
    <div
      className={`relative rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 select-none bg-[#09090b] dark:bg-white text-white dark:text-[#09090b] font-bold ring-1 ring-black/5 dark:ring-white/10 ${sizeClass} ${className}`}
    >
      {/* Inisial selalu di layer dasar; gambar menutupinya begitu tersedia (tanpa gerbang opacity) */}
      <span aria-hidden="true" className="leading-none">
        {initial}
      </span>

      {activeSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={activeSrc.length > 200 ? `data-${activeSrc.length}` : activeSrc}
          src={activeSrc}
          alt=""
          aria-hidden="true"
          referrerPolicy="no-referrer"
          decoding="async"
          draggable={false}
          onError={handleError}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
    </div>
  );
}
