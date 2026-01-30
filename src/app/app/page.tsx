'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function AppPage() {
  const [amount, setAmount] = useState('')
  const [leverage, setLeverage] = useState(2)

  const numAmount = parseFloat(amount) || 0
  const positionSize = numAmount * leverage
  const baseApy = 4.5
  const borrowCost = 2.1
  const netApy = baseApy * leverage - borrowCost * (leverage - 1)
  const healthFactor = leverage > 0 ? (4 / leverage).toFixed(2) : '4.00'

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-dark-600 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-blue to-accent-purple" />
            <span className="font-semibold text-lg">Resupply</span>
          </Link>
          <div className="px-4 py-2 bg-dark-700 rounded-lg text-sm text-gray-400">
            Demo Mode
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 py-12">
        <div className="max-w-lg mx-auto">
          <h1 className="text-3xl font-bold mb-2">Loop Position</h1>
          <p className="text-gray-400 mb-8">Configure your leverage loop strategy</p>

          {/* Input Card */}
          <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6 mb-6">
            {/* Amount Input */}
            <div className="mb-6">
              <label className="block text-sm text-gray-400 mb-2">Deposit Amount</label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-dark-700 border border-dark-600 rounded-xl px-4 py-4 text-2xl font-medium focus:outline-none focus:border-accent-blue transition-colors"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold">$</div>
                  <span className="font-medium">USDC</span>
                </div>
              </div>
            </div>

            {/* Leverage Slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-gray-400">Leverage</label>
                <span className="text-lg font-semibold text-accent-blue">{leverage}x</span>
              </div>
              <input
                type="range"
                min="1"
                max="4"
                step="0.1"
                value={leverage}
                onChange={(e) => setLeverage(parseFloat(e.target.value))}
                className="w-full h-2 bg-dark-600 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent-blue [&::-webkit-slider-thumb]:cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>1x</span>
                <span>2x</span>
                <span>3x</span>
                <span>4x</span>
              </div>
            </div>
          </div>

          {/* Preview Card */}
          <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6 mb-6">
            <h3 className="text-sm text-gray-400 mb-4">Position Preview</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Position Size</span>
                <span className="text-xl font-semibold">
                  ${positionSize.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Net APY</span>
                <span className="text-xl font-semibold text-green-400">
                  {netApy.toFixed(2)}%
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Health Factor</span>
                <span className={`text-xl font-semibold ${parseFloat(healthFactor) >= 2 ? 'text-green-400' : parseFloat(healthFactor) >= 1.5 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {healthFactor}
                </span>
              </div>
            </div>

            {/* Health Bar */}
            <div className="mt-4 pt-4 border-t border-dark-600">
              <div className="h-2 bg-dark-600 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${parseFloat(healthFactor) >= 2 ? 'bg-green-400' : parseFloat(healthFactor) >= 1.5 ? 'bg-yellow-400' : 'bg-red-400'}`}
                  style={{ width: `${Math.min(parseFloat(healthFactor) / 4 * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Loop Button */}
          <button
            disabled={numAmount <= 0}
            className="w-full py-4 bg-gradient-to-r from-accent-blue to-accent-purple hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold text-lg transition-opacity"
          >
            {numAmount > 0 ? 'Loop Position' : 'Enter Amount'}
          </button>

          {/* Info */}
          <p className="text-center text-gray-500 text-sm mt-4">
            Demo interface - no real transactions
          </p>
        </div>
      </main>
    </div>
  )
}
