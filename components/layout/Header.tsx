"use client";

import Link from "next/link";

interface HeaderProps {
  userImage?: string | null;
  userName?: string | null;
}

export function Header({ userImage, userName }: HeaderProps = {}) {
  return (
    <header className="sticky top-0 z-40 flex justify-between items-center px-6 h-[72px] w-full bg-[#10131d]/80 backdrop-blur-xl border-b border-white/10 shadow-lg">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-surface-container overflow-hidden border border-outline-variant/20">
          {userImage ? (
            <img
              src={userImage}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-primary font-bold text-sm">
              {userName?.[0] ?? "C"}
            </div>
          )}
        </div>
        <span className="font-bold tracking-tighter text-primary text-2xl">CLAUDIO</span>
      </div>
      <Link
        href="/settings"
        className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-highest transition-colors active:scale-95"
      >
        <span className="material-symbols-outlined text-primary">settings</span>
      </Link>
    </header>
  );
}
