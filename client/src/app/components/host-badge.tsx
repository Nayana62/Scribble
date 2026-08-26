/**
 * Shared host indicator badge.
 *
 * Used in both the lobby player list and the in-game PlayerList so that the
 * two never drift out of sync visually.
 */
export function HostBadge() {
  return (
    <span className="bg-blue-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider select-none">
      Host
    </span>
  );
}
