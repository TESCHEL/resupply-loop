# Resupply Loop

## Overview
A Next.js 14 application for amplifying stablecoin yields with automated leverage loops. The app provides a simple interface to deposit crvUSD, mint reUSD, stake in sreUSD vault, and borrow against collateral on Curve Lend.

## Tech Stack
- **Framework**: Next.js 14.2.3
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Web3**: wagmi v2.12.0, viem v2.21.0, @tanstack/react-query
- **Package Manager**: npm

## Project Structure
```
src/
├── app/
│   ├── app/           # App-specific pages (Loop Strategy)
│   │   └── page.tsx   # Main DeFi interaction component
│   ├── globals.css    # Global styles with Tailwind
│   ├── layout.tsx     # Root layout
│   ├── page.tsx       # Home page
│   ├── providers.tsx  # Wagmi/React Query providers
│   └── wagmi.ts       # Wagmi configuration
```

## Gas Optimization
The app implements several gas-saving strategies:
- **Unlimited approvals**: Uses maxUint256 for token approvals (one-time cost)
- **Allowance checking**: Skips approval transactions if already approved
- **Optimized gas limits**: 65k (approve), 250k (deposit), 500k (createLoan), 400k (borrowMore)
- **Gas estimation display**: Shows estimated costs before execution

## Development
- Run `npm run dev` to start the development server on port 5000
- The application binds to 0.0.0.0 for Replit compatibility

## Build & Deploy
- Run `npm run build` to create a production build
- Run `npm start` to start the production server

## Recent Changes
- 2026-01-30: Implemented gas optimizations for DeFi transactions
- Added unlimited token approvals with user warning
- Fixed React hydration errors using mounted state pattern
- Increased gas limits with safety buffers for mainnet operations
