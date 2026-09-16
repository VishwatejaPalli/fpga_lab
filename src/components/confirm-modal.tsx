"use client";

import { useEffect } from "react";
import { AlertTriangleIcon, ZapIcon, AlertCircleIcon } from "@/components/icons";

interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  isLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmModal({
  isOpen,
  title = "Confirm Action",
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  isLoading = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isLoading) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (variant) {
      case "danger":
        return (
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 shrink-0">
            <AlertTriangleIcon className="w-6 h-6" />
          </div>
        );
      case "warning":
        return (
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
            <ZapIcon className="w-6 h-6" />
          </div>
        );
      default:
        return (
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 shrink-0">
            <AlertCircleIcon className="w-6 h-6" />
          </div>
        );
    }
  };

  const getButtonClass = () => {
    switch (variant) {
      case "danger":
        return "bg-red-600 hover:bg-red-700 text-white font-medium px-5 py-2.5 rounded-lg transition-all shadow-lg shadow-red-500/20 hover:shadow-red-500/30 active:scale-95 disabled:opacity-50";
      case "warning":
        return "bg-amber-600 hover:bg-amber-700 text-white font-medium px-5 py-2.5 rounded-lg transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 active:scale-95 disabled:opacity-50";
      default:
        return "btn-primary";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            {getIcon()}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-foreground tracking-tight">
                {title}
              </h3>
              <p className="mt-2 text-sm text-muted leading-relaxed">
                {message}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-muted/30 px-6 py-4 border-t border-border flex justify-end gap-3 items-center">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="btn-secondary text-sm disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={getButtonClass()}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                Processing...
              </span>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
