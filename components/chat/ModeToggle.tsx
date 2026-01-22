'use client';

interface ModeToggleProps {
  mode: 'strict' | 'hybrid';
  onChange: (mode: 'strict' | 'hybrid') => void;
}

export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
      <button
        onClick={() => onChange('strict')}
        className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
          mode === 'strict'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
        title="Svarar endast baserat på transkript"
      >
        Endast transkript
      </button>
      <button
        onClick={() => onChange('hybrid')}
        className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
          mode === 'hybrid'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
        title="Kan komplettera med allmän kunskap"
      >
        + Allmän kunskap
      </button>
    </div>
  );
}
