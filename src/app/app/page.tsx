'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAccount, useConnect, useDisconnect, useWriteContract, useWaitForTransactionReceipt, useReadContract, useGasPrice } from 'wagmi'
import { parseUnits, formatUnits, maxUint256 } from 'viem'
import { injected } from 'wagmi/connectors'

const ADDRESSES = {
  crvUSD: '0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E' as const,
  reUSD: '0x57aB1E0003F623289CD798B1824Be09a793e4Bec' as const,
  sreUSD: '0x557AB1e003951A73c12D16F0fEA8490E39C33C35' as const,
  curveLendMarket: '0x4F79Fe450a2BAF833E8f50340BD230f5A3eCaFe9' as const,
}

const GAS_LIMITS = {
  approve: 65000n,
  deposit: 250000n,
  createLoan: 500000n,
  borrowMore: 400000n,
}

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

const RESUPPLY_MINTER_ABI = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'assets', type: 'uint256' }, { name: 'receiver', type: 'address' }],
    outputs: [{ name: 'shares', type: 'uint256' }],
  },
] as const

const VAULT_ABI = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'assets', type: 'uint256' }, { name: 'receiver', type: 'address' }],
    outputs: [{ name: 'shares', type: 'uint256' }],
  },
] as const

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
  const [mounted, setMounted] = useState(false)
  const [amount, setAmount] = useState('')
  const [leverage, setLeverage] = useState(2)
  const [currentStep, setCurrentStep] = useState<LoopStep>('idle')
  const [loopIteration, setLoopIteration] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [estimatedGas, setEstimatedGas] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()
  const { writeContract, data: txHash, isPending } = useWriteContract()
  const { isLoading: isTxLoading, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash: txHash })
  const { data: gasPrice } = useGasPrice()

  const { data: crvUSDBalance } = useReadContract({
    address: ADDRESSES.crvUSD,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  })

  const { data: crvUSDAllowance } = useReadContract({
    address: ADDRESSES.crvUSD,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, ADDRESSES.reUSD] : undefined,
  })

  const { data: reUSDAllowance } = useReadContract({
    address: ADDRESSES.reUSD,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, ADDRESSES.sreUSD] : undefined,
  })

  const { data: sreUSDAllowance } = useReadContract({
    address: ADDRESSES.sreUSD,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, ADDRESSES.curveLendMarket] : undefined,
  })

  const numAmount = parseFloat(amount) || 0
  const positionSize = numAmount * leverage
  const baseApy = 4.5
  const borrowCost = 2.1
  const netApy = baseApy * leverage - borrowCost * (leverage - 1)
  const healthFactor = leverage > 0 ? (4 / leverage).toFixed(2) : '4.00'
  const borrowRatio = 0.80

  const LARGE_ALLOWANCE_THRESHOLD = BigInt(10) ** BigInt(30)
  
  const hasCrvUSDApproval = crvUSDAllowance && crvUSDAllowance >= LARGE_ALLOWANCE_THRESHOLD
  const hasReUSDApproval = reUSDAllowance && reUSDAllowance >= LARGE_ALLOWANCE_THRESHOLD
  const hasSreUSDApproval = sreUSDAllowance && sreUSDAllowance >= LARGE_ALLOWANCE_THRESHOLD

  useEffect(() => {
    if (!gasPrice || numAmount <= 0) {
      setEstimatedGas(null)
      return
    }

    let totalGas = 0n

    if (!hasCrvUSDApproval) {
      totalGas += GAS_LIMITS.approve
    }
    if (!hasReUSDApproval) {
      totalGas += GAS_LIMITS.approve
    }
    if (!hasSreUSDApproval) {
      totalGas += GAS_LIMITS.approve
    }

    for (let i = 0; i < leverage; i++) {
      totalGas += GAS_LIMITS.deposit
      totalGas += GAS_LIMITS.deposit
      totalGas += i === 0 ? GAS_LIMITS.createLoan : GAS_LIMITS.borrowMore
    }

    const estimatedCostWei = totalGas * gasPrice
    const estimatedCostEth = formatUnits(estimatedCostWei, 18)
    setEstimatedGas(parseFloat(estimatedCostEth).toFixed(6))
  }, [gasPrice, numAmount, leverage, hasCrvUSDApproval, hasReUSDApproval, hasSreUSDApproval])

  const handleConnect = () => {
    connect({ connector: injected() })
  }

  const handleDisconnect = () => {
    disconnect()
  }

  const executeLoop = async () => {
    if (!address || numAmount <= 0) return
    setError(null)
    setLoopIteration(1)
    
    try {
      const amountWei = parseUnits(amount, 18)

      if (!hasCrvUSDApproval) {
        setCurrentStep('approve-crvusd')
        writeContract({
          address: ADDRESSES.crvUSD,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [ADDRESSES.reUSD, maxUint256],
          gas: GAS_LIMITS.approve,
        })
      } else {
        setCurrentStep('deposit-crvusd')
        writeContract({
          address: ADDRESSES.reUSD,
          abi: RESUPPLY_MINTER_ABI,
          functionName: 'deposit',
          args: [amountWei, address],
          gas: GAS_LIMITS.deposit,
        })
      }
    } catch (err: any) {
      setError(err.message || 'Transaction failed')
      setCurrentStep('idle')
    }
  }

  useEffect(() => {
    if (!isTxSuccess || !address) return

    const amountWei = parseUnits(amount || '0', 18)
    const iterationAmount = loopIteration === 1 ? amountWei : amountWei * BigInt(Math.floor(borrowRatio * 100)) / BigInt(100)

    const progressToNextStep = async () => {
      try {
        switch (currentStep) {
          case 'approve-crvusd':
            setCurrentStep('deposit-crvusd')
            writeContract({
              address: ADDRESSES.reUSD,
              abi: RESUPPLY_MINTER_ABI,
              functionName: 'deposit',
              args: [iterationAmount, address],
              gas: GAS_LIMITS.deposit,
            })
            break

          case 'deposit-crvusd':
            if (!hasReUSDApproval) {
              setCurrentStep('approve-reusd')
              writeContract({
                address: ADDRESSES.reUSD,
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [ADDRESSES.sreUSD, maxUint256],
                gas: GAS_LIMITS.approve,
              })
            } else {
              setCurrentStep('deposit-reusd')
              writeContract({
                address: ADDRESSES.sreUSD,
                abi: VAULT_ABI,
                functionName: 'deposit',
                args: [iterationAmount, address],
                gas: GAS_LIMITS.deposit,
              })
            }
            break

          case 'approve-reusd':
            setCurrentStep('deposit-reusd')
            writeContract({
              address: ADDRESSES.sreUSD,
              abi: VAULT_ABI,
              functionName: 'deposit',
              args: [iterationAmount, address],
              gas: GAS_LIMITS.deposit,
            })
            break

          case 'deposit-reusd':
            if (!hasSreUSDApproval) {
              setCurrentStep('approve-sreusd')
              writeContract({
                address: ADDRESSES.sreUSD,
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [ADDRESSES.curveLendMarket, maxUint256],
                gas: GAS_LIMITS.approve,
              })
            } else {
              setCurrentStep('borrow-crvusd')
              const borrowAmount = iterationAmount * BigInt(Math.floor(borrowRatio * 100)) / BigInt(100)
              if (loopIteration === 1) {
                writeContract({
                  address: ADDRESSES.curveLendMarket,
                  abi: CURVE_LEND_ABI,
                  functionName: 'create_loan',
                  args: [iterationAmount, borrowAmount, BigInt(4)],
                  gas: GAS_LIMITS.createLoan,
                })
              } else {
                writeContract({
                  address: ADDRESSES.curveLendMarket,
                  abi: CURVE_LEND_ABI,
                  functionName: 'borrow_more',
                  args: [iterationAmount, borrowAmount],
                  gas: GAS_LIMITS.borrowMore,
                })
              }
            }
            break

          case 'approve-sreusd':
            setCurrentStep('borrow-crvusd')
            const borrowAmount = iterationAmount * BigInt(Math.floor(borrowRatio * 100)) / BigInt(100)
            if (loopIteration === 1) {
              writeContract({
                address: ADDRESSES.curveLendMarket,
                abi: CURVE_LEND_ABI,
                functionName: 'create_loan',
                args: [iterationAmount, borrowAmount, BigInt(4)],
                gas: GAS_LIMITS.createLoan,
              })
            } else {
              writeContract({
                address: ADDRESSES.curveLendMarket,
                abi: CURVE_LEND_ABI,
                functionName: 'borrow_more',
                args: [iterationAmount, borrowAmount],
                gas: GAS_LIMITS.borrowMore,
              })
            }
            break

          case 'borrow-crvusd':
            if (loopIteration < leverage) {
              setLoopIteration(prev => prev + 1)
              setCurrentStep('deposit-crvusd')
              const nextIterationAmount = iterationAmount * BigInt(Math.floor(borrowRatio * 100)) / BigInt(100)
              writeContract({
                address: ADDRESSES.reUSD,
                abi: RESUPPLY_MINTER_ABI,
                functionName: 'deposit',
                args: [nextIterationAmount, address],
                gas: GAS_LIMITS.deposit,
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
      case 'approve-crvusd': return `Approving crvUSD (one-time)...`
      case 'deposit-crvusd': return `Depositing crvUSD to mint reUSD (Loop ${loopIteration}/${leverage})...`
      case 'approve-reusd': return `Approving reUSD (one-time)...`
      case 'deposit-reusd': return `Depositing reUSD to sreUSD vault (Loop ${loopIteration}/${leverage})...`
      case 'approve-sreusd': return `Approving sreUSD (one-time)...`
      case 'borrow-crvusd': return `Borrowing crvUSD from Curve Lend (Loop ${loopIteration}/${leverage})...`
      case 'complete': return 'Loop Complete!'
      default: return ''
    }
  }

  const isProcessing = isPending || isTxLoading || (currentStep !== 'idle' && currentStep !== 'complete')

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-dark-600 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-blue to-accent-purple" />
            <span className="font-semibold text-lg">Resupply</span>
          </Link>
          
          {mounted && isConnected ? (
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

      <main className="flex-1 px-6 py-12">
        <div className="max-w-lg mx-auto">
          <h1 className="text-3xl font-bold mb-2">Loop Strategy</h1>
          <p className="text-gray-400 mb-8">Amplify your yield with leveraged stablecoin positions</p>

          <div className="bg-dark-800 rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400">Deposit</span>
              {mounted && isConnected && crvUSDBalance && (
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

            {estimatedGas && numAmount > 0 && (
              <div className="p-4 rounded-xl mb-4 text-sm bg-dark-700/50 border border-dark-600">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Estimated Gas Cost</span>
                  <span className="font-medium text-accent-cyan">~{estimatedGas} ETH</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Gas limits optimized per transaction.
                </p>
                {(!hasCrvUSDApproval || !hasReUSDApproval || !hasSreUSDApproval) && (
                  <p className="text-xs text-yellow-500 mt-2">
                    This will grant unlimited token approvals for gas efficiency. You can revoke approvals later via Etherscan or Revoke.cash.
                  </p>
                )}
              </div>
            )}

            {currentStep !== 'idle' && (
              <div className={currentStep === 'complete' ? 'p-4 rounded-xl mb-4 text-sm bg-green-900/30 text-green-400' : 'p-4 rounded-xl mb-4 text-sm bg-blue-900/30 text-blue-400'}>
                {getStepLabel()}
              </div>
            )}

            {error && (
              <div className="p-4 rounded-xl mb-4 text-sm bg-red-900/30 text-red-400">
                {error}
              </div>
            )}

            {(!mounted || !isConnected) ? (
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
