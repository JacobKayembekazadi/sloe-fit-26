import React, { useState } from 'react';

interface CheckinFormProps {
  onSubmit: (data: { weight_lbs: number; body_fat_pct: number | null; notes: string | null }) => Promise<boolean>;
  defaultWeight?: number | null;
  isSubmitting: boolean;
}

const CheckinForm: React.FC<CheckinFormProps> = ({ onSubmit, defaultWeight, isSubmitting }) => {
  const [weight, setWeight] = useState(defaultWeight?.toString() || '');
  const [bodyFat, setBodyFat] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const w = parseFloat(weight);
    if (!weight || isNaN(w)) {
      setError('Enter your weight');
      return;
    }
    if (w < 50 || w > 600) {
      setError('Weight must be between 50-600 lbs');
      return;
    }

    const bf = bodyFat ? parseFloat(bodyFat) : null;
    if (bf !== null && (isNaN(bf) || bf < 3 || bf > 60)) {
      setError('Body fat must be between 3-60%');
      return;
    }

    const success = await onSubmit({
      weight_lbs: w,
      body_fat_pct: bf,
      notes: notes.trim() || null,
    });

    if (success) {
      // Keep weight pre-filled for next time, clear rest
      setBodyFat('');
      setNotes('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block">
            Weight (lbs) *
          </label>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={weight}
            onChange={e => setWeight(e.target.value)}
            placeholder="175.0"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-[var(--color-primary)] focus:outline-none transition-colors"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block">
            Body Fat %
          </label>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={bodyFat}
            onChange={e => setBodyFat(e.target.value)}
            placeholder="Optional"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-[var(--color-primary)] focus:outline-none transition-colors"
          />
        </div>
      </div>

      <div>
        <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block">
          Notes
        </label>
        <input
          type="text"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="How are you feeling?"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-[var(--color-primary)] focus:outline-none transition-colors"
        />
      </div>

      {error && (
        <p className="text-red-400 text-xs">{error}</p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {isSubmitting ? (
          <>
            <span className="material-symbols-outlined text-sm animate-spin">refresh</span>
            Saving...
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-sm">add_circle</span>
            Log Check-in
          </>
        )}
      </button>
    </form>
  );
};

export default CheckinForm;
