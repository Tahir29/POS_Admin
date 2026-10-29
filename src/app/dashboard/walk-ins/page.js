export default function WalkInsPage() {
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Customer Walk-Ins</h1>
      <p className="text-sm text-gray-500">
        Coming in Phase 3 — pulled directly from OrnaVerse, not MongoDB. The write side is already
        confirmed live (every customer lookup at the POS counter writes a visit record via
        Services/POS/WalkIn/Lookup); the read/list endpoint for that history still needs to be
        found and verified against UAT before this view can be built.
      </p>
    </div>
  );
}
