type Level = "info" | "warn" | "error";

type Fields = {
  requestId?: string;
  userId?: string;
  handler?: string;
  durationMs?: number;
  [key: string]: unknown;
};

function emit(level: Level, message: string, fields?: Fields) {
  const payload = { level, message, ts: new Date().toISOString(), ...fields };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (message: string, fields?: Fields) => emit("info", message, fields),
  warn: (message: string, fields?: Fields) => emit("warn", message, fields),
  error: (message: string, fields?: Fields) => emit("error", message, fields),
};
