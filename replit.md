# Resupply Loop

## Overview
A Next.js 14 application for amplifying stablecoin yields with automated leverage loops. The app provides a simple interface to deposit stablecoins (USDC, USDT, DAI), set leverage multipliers, and earn yield through auto-compounding positions.

## Tech Stack
- **Framework**: Next.js 14.2.3
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Package Manager**: npm

## Project Structure
```
src/
├── app/
│   ├── app/           # App-specific pages
│   │   └── page.tsx
│   ├── globals.css    # Global styles with Tailwind
│   ├── layout.tsx     # Root layout
│   └── page.tsx       # Home page
```

## Development
- Run `npm run dev` to start the development server on port 5000
- The application binds to 0.0.0.0 for Replit compatibility

## Build & Deploy
- Run `npm run build` to create a production build
- Run `npm start` to start the production server
