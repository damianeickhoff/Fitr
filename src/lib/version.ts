/**
 * Which build this is: the commit the publish workflow stamped into the image
 * as `APP_VERSION`, or "dev" for anything built by hand. Read at run time, so
 * it answers "did the update apply?" from the running instance itself — Unraid's
 * own update check compares digests and is not always right.
 */
const SHA = /^[0-9a-f]{40}$/i;

export function buildVersion(): string {
  const stamped = process.env.APP_VERSION?.trim();
  if (!stamped) return "dev";
  // Seven characters, like the `sha-<short>` image tag, so it can be found in the registry.
  return SHA.test(stamped) ? stamped.slice(0, 7) : stamped;
}
