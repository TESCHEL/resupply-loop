'use client';

interface LeverageSliderProps {
  value: number;
  onChange: (value: number) => void;
}

export function LeverageSlider({ value, onChange }: LeverageSliderProps) {
  const marks = [1, 2, 3, 4];

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <label className="text-sm font-medium text-muted">
          Leverage
        </label>
        <div className="bg-primary/10 px-3 py-1 rounded-md">
          <span className="text-lg font-bold text-primary">{value}x</span>
        </div>
      </div>

      <div className="relative pt-2 pb-6">
        <input
          type="range"
          min="1"
          max="4"
          step="0.1"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-background rounded-lg appearance-none cursor-pointer slider"
          style={{
            background: `linear-gradient(to right, #22c55e 0%, #22c55e ${((value - 1) / 3) * 100}%, #161b22 ${((value - 1) / 3) * 100}%, #161b22 100%)`
          }}
        />
        <div className="flex justify-between mt-2">
          {marks.map((mark) => (
            <button
              key={mark}
              onClick={() => onChange(mark)}
              className={`text-xs font-medium transition-colors ${
                Math.abs(value - mark) < 0.2 ? 'text-primary' : 'text-muted hover:text-white'
              }`}
            >
              {mark}x
            </button>
          ))}
        </div>
      </div>

      <div className="bg-background border border-border rounded-lg p-4 mt-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted">Max LTV</span>
          <span className="font-semibold">95%</span>
        </div>
        <div className="flex justify-between text-sm mt-2">
          <span className="text-muted">Liquidation Fee</span>
          <span className="font-semibold">5%</span>
        </div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          background: #22c55e;
          cursor: pointer;
          border-radius: 50%;
          border: 3px solid #0d1117;
          box-shadow: 0 0 0 1px #22c55e;
        }

        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          background: #22c55e;
          cursor: pointer;
          border-radius: 50%;
          border: 3px solid #0d1117;
          box-shadow: 0 0 0 1px #22c55e;
        }

        .slider::-webkit-slider-thumb:hover {
          background: #16a34a;
          box-shadow: 0 0 0 2px #22c55e;
        }

        .slider::-moz-range-thumb:hover {
          background: #16a34a;
          box-shadow: 0 0 0 2px #22c55e;
        }
      `}</style>
    </div>
  );
}