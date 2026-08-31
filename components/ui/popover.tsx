"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";

export type PopoverProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
};

export type PopoverTriggerProps = {
  asChild?: boolean;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
};

export type PopoverContentProps = {
  align?: "start" | "center" | "end";
  sideOffset?: number;
  className?: string;
  children: React.ReactNode;
};

type PopoverContextType = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
};

const PopoverContext = React.createContext<PopoverContextType | null>(null);

export function Popover({ open: controlledOpen, onOpenChange, children }: PopoverProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen;
  const containerRef = useRef<HTMLDivElement | null>(null);

  const setIsOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(next);
      }
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange]
  );

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const el = containerRef.current;
      if (el && !el.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, setIsOpen]);

  return (
    <PopoverContext.Provider value={{ isOpen, setIsOpen }}>
      <div ref={containerRef} className="relative inline-block text-left">
        {children}
      </div>
    </PopoverContext.Provider>
  );
}

export function PopoverTrigger({ children, onClick }: PopoverTriggerProps) {
  const ctx = React.useContext(PopoverContext);
  if (!ctx) throw new Error("PopoverTrigger must be used within Popover");

  return (
    <div
      onClick={(e) => {
        onClick?.(e);
        ctx.setIsOpen(!ctx.isOpen);
      }}
      aria-expanded={ctx.isOpen}
      aria-haspopup="dialog"
      className="inline-flex cursor-pointer"
    >
      {children}
    </div>
  );
}

export function PopoverContent({
  align = "start",
  sideOffset = 6,
  className = "",
  children,
}: PopoverContentProps) {
  const ctx = React.useContext(PopoverContext);
  if (!ctx) throw new Error("PopoverContent must be used within Popover");

  if (!ctx.isOpen) return null;

  const alignClass =
    align === "end"
      ? "right-0"
      : align === "center"
      ? "left-1/2 -translate-x-1/2"
      : "left-0";

  return (
    <div
      style={{ marginTop: sideOffset }}
      className={`absolute z-50 rounded-lg border border-black/10 bg-white p-3 shadow-xl ring-1 ring-black/5 animate-in fade-in-0 zoom-in-95 ${alignClass} ${className}`}
    >
      {children}
    </div>
  );
}
