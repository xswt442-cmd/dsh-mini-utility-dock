// Loopback predicates shared by the host halves of the DSH plugins.
//
// This fragment has ONE source of truth: dsh-mini-utility-dock/dist/loopback.js.
// DSH plugin host halves are plain Node ESM that each package ships standalone,
// so the fragment is embedded into `lib/shared.js` at build time by
//   npm run loopback:sync    (write it)
//   npm run loopback:check   (fail on drift)
// instead of being imported: a bare `import 'dsh-mini-utility-dock/...'` would
// put a runtime dependency on the dock into every plugin, and the whole point of
// the dock is that a plugin works with no sibling installed.
//
// Why it is shared at all: these predicates were copy-pasted per repo and
// drifted twice. The first drift rejected IPv6 loopback in all three plugins;
// the second made the three disagree on which Host spellings count as loopback
// (see scripts/guard-parity.mjs, which compares this block across repos).
//
// "Loopback" is decided in exactly one place — LOOPBACK_HOSTNAMES plus the
// IPv4-mapped IPv6 form of each entry — and both the name and the address
// predicate route through it, so the Host path and the peer path cannot drift
// apart again.
//
// Kept a separate fragment from the host guard on purpose: the predicates are
// stable facts about what an address is, while the guard is a policy about who
// may call an API. `dist/guard.js` imports this module, so the guard depends on
// this block and never the other way round.

// Hostnames a request to a loopback-bound API may legitimately arrive with.
// Exact spellings only: `api.localhost` and `127.0.0.1.evil.example` must stay
// rejected, which is what keeps DNS rebinding out of the API surface.
export const LOOPBACK_HOSTNAMES = ['127.0.0.1', 'localhost', '::1']

// Canonicalize a Host-like value. Trims both ends and lowercases, so the
// allowlist match is case-insensitive and tolerates surrounding whitespace.
export const normalizeHostValue = (value) => String(value == null ? '' : value).trim().toLowerCase()

// Pull the hostname out of a Host header: "127.0.0.1:3080" -> "127.0.0.1",
// "[::1]:3080" -> "::1". A bracketed IPv6 literal carries its colons inside the
// brackets, so the brackets decide where the host ends, not the first colon.
export const hostHostname = (host) => {
  const value = normalizeHostValue(host)
  const bracketed = /^\[([^\]]+)\]/.exec(value)
  return bracketed ? bracketed[1] : value.split(':')[0]
}

// The IPv4 address inside an IPv4-mapped IPv6 literal, or null. Node reports a
// v4 peer on a dual-stack socket in the mapped form, so this is a routine input,
// not an exotic one. Two spellings reach us and both must work:
//
//   ::ffff:127.0.0.1   what Node puts in req.socket.remoteAddress, and what a
//                      client may legally write in a Host header
//   ::ffff:7f00:1      what the WHATWG URL parser normalises the above to, so
//                      this is the shape a browser's Origin header produces
//
// The v4 part is validated as four decimal octets, so `::ffff:1.2.3` and
// `::ffff:999.1.1.1` are not addresses and fail closed.
const mappedIpv4 = (value) => {
  if (!value.startsWith('::ffff:')) return null
  const rest = value.slice(7)
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(rest)) {
    return rest.split('.').every((octet) => Number(octet) <= 255) ? rest : null
  }
  // Hex form: ::ffff:7f00:1 -> 127.0.0.1. Exactly two groups, four hex digits
  // each, as the URL parser emits.
  const hex = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(rest)
  if (!hex) return null
  const high = parseInt(hex[1], 16)
  const low = parseInt(hex[2], 16)
  return `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`
}

/**
 * True when `name` is a loopback hostname — the Host-header side of the guard.
 * Accepts the documented spellings, the IPv4-mapped IPv6 form of 127.0.0.1, and
 * folds case. Fails closed on everything else, including a missing name.
 */
export const isLoopbackName = (name) => {
  const value = normalizeHostValue(name)
  if (!value) return false
  if (LOOPBACK_HOSTNAMES.indexOf(value) !== -1) return true
  const ipv4 = mappedIpv4(value)
  return ipv4 !== null && LOOPBACK_HOSTNAMES.indexOf(ipv4) !== -1
}

/**
 * True when `address` is a real loopback TCP peer address.
 * Headers cannot identify the network peer — a client sets `Host` freely — so
 * the socket address is the only trustworthy signal. Fail closed on anything
 * unrecognised, including a missing address.
 */
export const isLoopbackAddress = (address) => {
  const value = normalizeHostValue(address)
  if (!value) return false
  if (value === '::1') return true
  // IPv4-mapped IPv6 (`::ffff:127.0.0.1`) is how Node reports a v4 peer on a
  // dual-stack socket; fold it back before the 127/8 test.
  const mapped = mappedIpv4(value)
  if (mapped !== null) return /^127\./.test(mapped)
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(value)
}
