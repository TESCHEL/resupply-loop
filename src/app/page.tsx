import Link from 'next/link'

export default function Home() {
  const steps = [
    {
      number: '01',
      title: 'Deposit Stables',
      description: 'Supply USDC, USDT, or DAI as collateral to begin your loop strategy.'
    },
    {
      number: '02', 
      title: 'Set Leverage',
      description: 'Choose your leverage multiplier from 1x to 4x based on your risk tolerance.'
    },
    {
      number: '03',
      title: 'Earn Yield',
      description: 'Your position auto-compounds, maximizing returns while maintaining health.'
    }
  ]

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-dark-600 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-blue to-accent-purple" />
            <span className="font-semibold text-lg">Resupply</span>
          </div>
          <Link 
            href="/app"
            className="px-4 py-2 bg-accent-blue hover:bg-blue-600 rounded-lg transition-colors text-sm font-medium"
          >
            Launch App
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-20">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white via-blue-100 to-accent-blue bg-clip-text text-transparent">
            Loop Your Stables
          </h1>
          <p className="text-xl text-gray-400 mb-10 max-w-xl mx-auto">
            Amplify your stablecoin yields with automated leverage loops. 
            Simple, efficient, and optimized for maximum returns.
          </p>
          <Link 
            href="/app"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-accent-blue to-accent-purple hover:opacity-90 rounded-xl transition-opacity text-lg font-semibold"
          >
            Start Looping
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>

        {/* Steps */}
        <div className="max-w-5xl mx-auto mt-24 grid md:grid-cols-3 gap-6 w-full">
          {steps.map((step) => (
            <div 
              key={step.number}
              className="bg-dark-800 border border-dark-600 rounded-2xl p-6 hover:border-dark-600/80 transition-colors"
            >
              <div className="text-accent-blue font-mono text-sm mb-3">{step.number}</div>
              <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-dark-600 px-6 py-6">
        <div className="max-w-6xl mx-auto text-center text-gray-500 text-sm">
          Built on Resupply Protocol
        </div>
      </footer>
    </main>
  )
}
