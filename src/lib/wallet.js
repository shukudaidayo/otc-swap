/**
 * Truncate address for display: 0x1234...abcd
 */
export function truncateAddress(address) {
  return address.slice(0, 6) + '...' + address.slice(-4)
}
