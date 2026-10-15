/** The URL the browser loads a stored file from (see app/api/images). */
export function imageUrl(relative: string) {
  return `/api/images/${relative}`;
}
