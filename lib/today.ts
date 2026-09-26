/**
 * Today's date as YYYY-MM-DD, resolved on the server and passed down as a
 * prop. Deriving it once server-side keeps every "days remaining" figure
 * identical between the server render and the client hydration.
 */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
