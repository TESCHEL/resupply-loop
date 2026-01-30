'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAccount, useConnect, useDisconnect, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { injected } from 'wagmi/connectors'

// Contract addresses (Ethereum Mainnet)
const ADDRESSES = {
  crvUSD: '0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E' as const,
  reUSD: '0x57aB1E0003F623289CD798B1824Be09a793e4Bec' as const,
  sreUSD: '0x557AB1e003951A73c12D16F0fEA8490E39C33C35' as const,
  curveLendMarket: '0x4F79Fe450a2BAF833E8f50340BD230f5A3eCaFe9' as const,
}

// Minimal ABIs for the operations we need
const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

// Resupply minter ABI (deposit crvUSD -> mint reUSD)
const RESUPPLY_MINTER_ABI = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'assets', type: 'uint256' }, { name: 'receiver', type: 'address' }],
    outputs: [{ name: 'shares', type: 'uint256' }],
  },
] as const

// ERC4626 vault ABI (sreUSD vault)
const VAULT_ABI = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'assets', type: 'uint256' }, { name: 'receiver', type: 'address' }],
    outputs: [{ name: 'shares', type: 'uint256' }],
  },
] as const

// Curve Lend market ABI (borrow crvUSD against sreUSD collateral)
const CURVE_LEND_ABI = [
  {
    name: 'create_loan',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'collateral', type: 'uint256' },
      { name: 'debt', type: 'uint256' },
      { name: 'n_bands', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'borrow_more',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'collateral', type: 'uint256' },
      { name: 'debt', type: 'uint256' },
    ],
    outputs: [],
  },
] as const

type LoopStep = 
  | 'idle' 
  | 'approve-crvusd' 
  | 'deposit-crvusd' 
  | 'approve-reusd' 
  | 'deposit-reusd' 
  | 'approve-sreusd' 
  | 'borrow-crvusd'
  | 'complete'

export default function AppPage() {
  const [amount, setAmount] = useState('')
  const [leverage, setLeverage] = useState(2)
  const [currentStep, setCurrentStep] = useState<LoopStep>('idle')
  const [loopIteration, setLoopIteration] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()
  const { writeContract, data: txHash, isPending } = useWriteContract()
  const { isLoading: isTxLoading, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  // Read crvUSD balance
  const { data: crvUSDBalance } = useReadContract({
    address: ADDRESSES.crvUSD,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  })

  const numAmount = parseFloat(amount) || 0
  const positionSize = numAmount * leverage
  const baseApy = 4.5
  const borrowCost = 2.1
  const netApy = baseApy * leverage - borrowCost * (leverage - 1)
  const healthFactor = leverage > 0 ? (4 / leverage).toFixed(2) : '4.00'

  // Calculate borrow amount based on ~80% LTV (conservative)
  const borrowRatio = 0.80

  const handleConnect = () => {
    connect({ connector: injected() })
  }

  const handleDisconnect = () => {
    disconnect()
  }

  // Execute the loop
  const executeLoop = async () => {
    if (!address || numAmount <= 0) return
    setError(null)
    setLoopIteration(1)
    
    try {
      // Step 1: Approve crvUSD for Resupply minter (reUSD contract)
      setCurrentStep('approve-crvusd')
      const amountWei = parseUnits(amount, 18)
      
      writeContract({
        address: ADDRESSES.crvUSD,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [ADDRESSES.reUSD, amountWei * BigInt(leverage)], // Approve for all iterations
      })
    } catch (err: any) {
      setError(err.message || 'Transaction failed')
      setCurrentStep('idle')
    }
  }

  // Handle transaction success and progress through steps
  useEffect(() => {
    if (!isTxSuccess || !address) return

    const amountWei = parseUnits(amount || '0', 18)
    const iterationAmount = loopIteration === 1 ? amountWei : amountWei * BigInt(Math.floor(borrowRatio * 100)) / BigInt(100)

    const progressToNextStep = async () => {
      try {
        switch (currentStep) {
          case 'approve-crvusd':
            // After approval, deposit crvUSD to mint reUSD
            setCurrentStep('deposit-crvusd')
            writeContract({
              address: ADDRESSES.reUSD,
              abi: RESUPPLY_MINTER_ABI,
              functionName: 'deposit',
              args: [iterationAmount, address],
            })
            break

          case 'deposit-crvusd':
            // After minting reUSD, approve it for sreUSD vault
            setCurrentStep('approve-reusd')
            writeContract({
              address: ADDRESSES.reUSD,
              abi: ERC20_ABI,
              functionName: 'approve',
              args: [ADDRESSES.sreUSD, iterationAmount],
            })
            break

          case 'approve-reusd':
            // Deposit reUSD into sreUSD vault
            setCurrentStep('deposit-reusd')
            writeContract({
              address: ADDRESSES.sreUSD,
              abi: VAULT_ABI,
              functionName: 'deposit',
              args: [iterationAmount, address],
            })
            break

          case 'deposit-reusd':
            // Approve sreUSD for Curve Lend market
            setCurrentStep('approve-sreusd')
            writeContract({
              address: ADDRESSES.sreUSD,
              abi: ERC20_ABI,
              functionName: 'approve',
              args: [ADDRESSES.curveLendMarket, iterationAmount],
            })
            break

          case 'approve-sreusd':
            // Borrow crvUSD using sreUSD as collateral
            setCurrentStep('borrow-crvusd')
            const borrowAmount = iterationAmount * BigInt(Math.floor(borrowRatio * 100)) / BigInt(100)
            
            if (loopIteration === 1) {
              // First iteration: create loan
              writeContract({
                address: ADDRESSES.curveLendMarket,
                abi: CURVE_LEND_ABI,
                functionName: 'create_loan',
                args: [iterationAmount, borrowAmount, BigInt(4)], // 4 bands
              })
            } else {
              // Subsequent iterations: borrow more
              writeContract({
                address: ADDRESSES.curveLendMarket,
                abi: CURVE_LEND_ABI,
                functionName: 'borrow_more',
                args: [iterationAmount, borrowAmount],
              })
            }
            break

          case 'borrow-crvusd':
            // Check if we need more iterations
            if (loopIteration < leverage) {
              setLoopIteration(prev => prev + 1)
              setCurrentStep('deposit-crvusd')
              // Use borrowed crvUSD for next iteration
              const nextIterationAmount = iterationAmount * BigInt(Math.floor(borrowRatio * 100)) / BigInt(100)
              writeContract({
                address: ADDRESSES.reUSD,
                abi: RESUPPLY_MINTER_ABI,
                functionName: 'deposit',
                args: [nextIterationAmount, address],
              })
            } else {
              setCurrentStep('complete')
            }
            break
        }
      } catch (err: any) {
        setError(err.message || 'Transaction failed')
        setCurrentStep('idle')
      }
    }

    progressToNextStep()
  }, [isTxSuccess])

  const getStepLabel = () => {
    switch (currentStep) {
      case 'approve-crvusd': return `Approving crvUSD (Loop ${loopIteration}/${leverage})...`
      case 'deposit-crvusd': return `Depositing crvUSD to mint reUSD (Loop ${loopIteration}/${leverage})...`
      case 'approve-reusd': return `Approving reUSD (Loop ${loopIteration}/${leverage})...`
      case 'deposit-reusd': return `Depositing reUSD to sreUSD vault (Loop ${loopIteration}/${leverage})...`
      case 'approve-sreusd': return `Approving sreUSD (Loop ${loopIteration}/${leverage})...`
      case 'borrow-crvusd': return `Borrowing crvUSD from Curve Lend (Loop ${loopIteration}/${leverage})...`
      case 'complete': return 'Loop Complete!'
      default: return ''
    }
  }

  const isProcessing = isPending || isTxLoading || (currentStep !== 'idle' && currentStep !== 'complete')

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-dark-600 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-blue to-accent-purple" />
            <span className="font-semibold text-lg">Resupply</span>
          </Link>
          
          {isConnected ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </span>
              <button
                onClick={handleDisconnect}
                className="px-4 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg text-sm transition-colors"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnect}
              className="px-4 py-2 bg-gradient-to-r from-accent-blue to-accent-purple rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 py-12">
        <div className="max-w-lg mx-auto">
          <h1 className="text-3xl font-bold mb-2">Loop Strategy</h1>
          <p className="text-gray-400 mb-8">Amplify your yield with leveraged stablecoin positions</p>

          {/* Input Card */}
          <div className="bg-dark-800 rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400">Deposit</span>
              {isConnected && crvUSDBalance && (
                <span className="text-sm text-gray-500">
                  Balance: {parseFloat(formatUnits(crvUSDBalance, 18)).toFixed(2)} crvUSD
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 mb-6">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="flex-1 bg-transparent text-3xl font-medium outline-none placeholder-gray-600"
              />
              <div className="flex items-center gap-2 px-4 py-2 bg-dark-700 rounded-xl">
                <div className="w-6 h-6 rounded-full bg-yellow-500" />
                <span className="font-medium">crvUSD</span>
              </div>
            </div>

            {/* Leverage Slider */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400">Leverage</span>
                <span className="font-medium">{leverage}x</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={leverage}
                onChange={(e) => setLeverage(parseInt(e.target.value))}
                className="w-full h-2 bg-dark-600 rounded-full appearance-none cursor-pointer accent-accent-blue"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>1x</span>
                <span>2x</span>
                <span>3x</span>
                <span>4x</span>
                <span>5x</span>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-dark-700/50 rounded-xl mb-6">
              <div>
                <span className="text-gray-400 text-sm">Position Size</span>
                <p className="font-semibold">{positionSize.toFixed(2)} crvUSD</p>
              </div>
              <div>
                <span className="text-gray-400 text-sm">Net APY</span>
                <p className="font-semibold text-green-400">{netApy.toFixed(2)}%</p>
              </div>
              <div>
                <span className="text-gray-400 text-sm">Health Factor</span>
                <p className="font-semibold">{healthFactor}</p>
              </div>
              <div>
                <span className="text-gray-400 text-sm">Liquidation Risk</span>
                <p className="font-semibold text-yellow-400">{leverage > 3 ? 'High' : leverage > 2 ? 'Medium' : 'Low'}</p>
              </div>
            </div>

            {/* Status Message */}
            {currentStep !== 'idle' && (
              <div className={currentStep === 'complete' ? 'p-4 rounded-xl mb-4 text-sm bg-green-900/30 text-green-400' : 'p-4 rounded-xl mb-4 text-sm bg-blue-900/30 text-blue-400'}>
                {getStepLabel()}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-4 rounded-xl mb-4 text-sm bg-red-900/30 text-red-400">
                {error}
              </div>
            )}

            {/* Action Button */}
            {!isConnected ? (
              <button
                onClick={handleConnect}
                className="w-full py-4 bg-gradient-to-r from-accent-blue to-accent-purple rounded-xl font-semibold hover:opacity-90 transition-opacity"
              >
                Connect Wallet
              </button>
            ) : (
              <button
                onClick={executeLoop}
                disabled={isProcessing || numAmount <= 0 || currentStep === 'complete'}
                className="w-full py-4 bg-gradient-to-r from-accent-blue to-accent-purple rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? 'Processing...' : currentStep === 'complete' ? 'Loop Complete' : 'Execute Loop'}
              </button>
            )}
          </div>

          {/* Protocol Flow Info */}
          <div className="bg-dark-800 rounded-2xl p-6">
            <h3 className="font-semibold mb-4">How it works</h3>
            <div className="space-y-3 text-sm text-gray-400">
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-dark-600 flex items-center justify-center text-xs">1</span>
                <span>Deposit crvUSD to mint reUSD on Resupply</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-dark-600 flex items-center justify-center text-xs">2</span>
                <span>Stake reUSD in sreUSD vault for yield</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-dark-600 flex items-center justify-center text-xs">3</span>
                <span>Use sreUSD as collateral on Curve Lend</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-dark-600 flex items-center justify-center text-xs">4</span>
                <span>Borrow crvUSD and repeat for leverage</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
