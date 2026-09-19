const isDev = import.meta.env.DEV;

/** DEV에서만 log/info/debug 출력. warn/error는 프로덕션에서도 유지. */
export const logger = {
  log: isDev ? console.log.bind(console) : () => {},
  info: isDev ? console.info.bind(console) : () => {},
  debug: isDev ? console.debug.bind(console) : () => {},
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};
