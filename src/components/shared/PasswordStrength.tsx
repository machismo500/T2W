"use client";

interface PasswordStrengthProps {
  password: string;
}

type StrengthLevel = {
  score: number; // 0..4
  label: string;
  color: string;
  bg: string;
};

export function scorePassword(pw: string): StrengthLevel {
  if (!pw) {
    return { score: 0, label: "", color: "text-t2w-muted", bg: "bg-t2w-surface-light" };
  }
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  // Clamp to 0..4
  score = Math.min(4, score);
  const levels: StrengthLevel[] = [
    { score: 0, label: "Too short", color: "text-red-400", bg: "bg-red-500" },
    { score: 1, label: "Weak", color: "text-red-400", bg: "bg-red-500" },
    { score: 2, label: "Fair", color: "text-orange-400", bg: "bg-orange-500" },
    { score: 3, label: "Good", color: "text-yellow-400", bg: "bg-yellow-500" },
    { score: 4, label: "Strong", color: "text-green-400", bg: "bg-green-500" },
  ];
  return levels[score];
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const strength = scorePassword(password);
  if (!password) return null;

  const segments = 4;
  const filled = Math.max(1, strength.score);

  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1">
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              i < filled ? strength.bg : "bg-t2w-surface-light"
            }`}
          />
        ))}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-xs">
        <span className={`font-medium ${strength.color}`}>{strength.label}</span>
        <span className="text-t2w-muted">
          {password.length < 6
            ? "At least 6 characters"
            : strength.score < 3
              ? "Mix letters, numbers, symbols for a stronger password"
              : "Looking good"}
        </span>
      </div>
    </div>
  );
}
