"use client";

import { useState } from "react";

const HAZARD_TYPES = [
  { value: "pothole", label: "Pothole", icon: "🕳️" },
  { value: "flood", label: "Flood", icon: "🌊" },
  { value: "accident", label: "Accident", icon: "🚗" },
  { value: "roadblock", label: "Road Block", icon: "🚧" },
  { value: "debris", label: "Debris", icon: "🪨" },
  { value: "other", label: "Other", icon: "📍" },
] as const;

const SEVERITY_LEVELS = [
  { value: 1, label: "Low", color: "#eab308" },
  { value: 2, label: "Medium", color: "#f97316" },
  { value: 3, label: "High", color: "#ef4444" },
] as const;

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  userLat: number | null;
  userLng: number | null;
  apiUrl: string;
  onSuccess: () => void;
}

export default function BottomSheet({
  isOpen,
  onClose,
  userLat,
  userLng,
  apiUrl,
  onSuccess,
}: BottomSheetProps) {
  const [type, setType] = useState<string>("pothole");
  const [severity, setSeverity] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState(false);

  const handleSubmit = async () => {
    if (!userLat || !userLng) {
      setError("Unable to get your location. Please enable GPS and try again.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${apiUrl}/api/hazards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, lat: userLat, lng: userLng, severity }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      setSuccessMsg(true);
      setTimeout(() => {
        setSuccessMsg(false);
        setType("pothole");
        setSeverity(1);
        onSuccess();
        onClose();
      }, 1200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="bottom-sheet__overlay"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        className={`bottom-sheet ${isOpen ? "bottom-sheet--open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Report a hazard"
      >
        {/* Drag handle */}
        <div className="bottom-sheet__handle" />

        {/* Header */}
        <div className="bottom-sheet__header">
          <h2 className="bottom-sheet__title">Report a Hazard</h2>
          <button
            className="bottom-sheet__close"
            onClick={onClose}
            aria-label="Close report form"
          >
            ✕
          </button>
        </div>

        <div className="bottom-sheet__body">
          {/* Hazard type grid */}
          <p className="bottom-sheet__section-label">Type of Hazard</p>
          <div className="bottom-sheet__type-grid">
            {HAZARD_TYPES.map((t) => (
              <button
                key={t.value}
                className={`bottom-sheet__type-btn${type === t.value ? " bottom-sheet__type-btn--active" : ""}`}
                onClick={() => setType(t.value)}
                aria-pressed={type === t.value}
              >
                <span className="bottom-sheet__type-icon">{t.icon}</span>
                <span className="bottom-sheet__type-label">{t.label}</span>
              </button>
            ))}
          </div>

          {/* Severity picker */}
          <p className="bottom-sheet__section-label">Severity</p>
          <div className="bottom-sheet__severity-row">
            {SEVERITY_LEVELS.map((s) => (
              <button
                key={s.value}
                className={`bottom-sheet__severity-btn${severity === s.value ? " bottom-sheet__severity-btn--active" : ""}`}
                style={
                  severity === s.value
                    ? { borderColor: s.color, color: s.color, background: `${s.color}18` }
                    : {}
                }
                onClick={() => setSeverity(s.value)}
                aria-pressed={severity === s.value}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Location display */}
          <div className="bottom-sheet__location">
            <span className="bottom-sheet__location-icon">📍</span>
            <span className="bottom-sheet__location-text">
              {userLat && userLng
                ? `${userLat.toFixed(5)}, ${userLng.toFixed(5)}`
                : "Waiting for GPS..."}
            </span>
          </div>

          {/* Error */}
          {error && <p className="bottom-sheet__error" role="alert">{error}</p>}

          {/* Success */}
          {successMsg && (
            <p className="bottom-sheet__success" role="status">
              ✅ Hazard reported successfully!
            </p>
          )}

          {/* Submit */}
          <button
            className="bottom-sheet__submit"
            onClick={handleSubmit}
            disabled={isSubmitting || !userLat}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? "Submitting..." : "Submit Report"}
          </button>
        </div>
      </div>
    </>
  );
}
