// Lightweight, dependency-free structured logger.
// - Production: one JSON object per line (searchable by log aggregators).
// - Development: human-readable single line.
// Levels are filtered via LOG_LEVEL (error|warn|info|debug), default "info".

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const current = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;
const isProd = process.env.NODE_ENV === 'production';

function emit(level, msg, meta) {
  if (LEVELS[level] > current) return;

  const entry = { ts: new Date().toISOString(), level, msg };
  if (meta && typeof meta === 'object') Object.assign(entry, meta);

  let line;
  if (isProd) {
    line = JSON.stringify(entry);
  } else {
    const extra = meta && Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    line = `${entry.ts} [${level.toUpperCase()}] ${msg}${extra}`;
  }

  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

module.exports = {
  error: (msg, meta) => emit('error', msg, meta),
  warn: (msg, meta) => emit('warn', msg, meta),
  info: (msg, meta) => emit('info', msg, meta),
  debug: (msg, meta) => emit('debug', msg, meta),
};
