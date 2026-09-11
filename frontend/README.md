# Milestone Logistics Frontend

This directory contains the React/Vite frontend for the Milestone Logistics decentralized application. It provides a wallet-connected interface for registering users, creating milestone-based escrow agreements, managing checkpoints, and reviewing transactions.

## Technology

- **React** and **Vite** for the user interface and development server.
- **ethers.js** for connecting to MetaMask, creating contract instances, reading blockchain data, and submitting signed transactions.
- **Bootstrap**, **React-Bootstrap**, and the **Bootswatch Brite** theme for the UI components and layout.
- **LogisticsClient.js** as the frontend contract facade. It connects to the deployed `LogisticsClient.sol` contract through ethers.js and exposes application operations such as registration, agreement creation, checkpoint management, deadline checks, and transaction history.

## Prerequisites

- Node.js 20 or newer
- Ganache running at `http://127.0.0.1:7545`
- MetaMask connected to the Ganache network with chain ID `1337`
- A Ganache account imported into MetaMask

## Installation and Deployment

From the repository root, install the backend dependencies and compile the contracts:

```bash
npm install
npx hardhat build
```

Deploy the logistics contracts to Ganache:

```bash
npx hardhat ignition deploy ignition/modules/Logistics.ts --network ganache --reset
```

The frontend loads compiled contract artifacts from `artifacts/` and deployed addresses from `ignition/deployments/`. Run the deployment command again after changing or redeploying the contracts.

Install the frontend dependencies:

```bash
cd frontend
npm install
```

## Development Commands

Run these commands from the `frontend` directory:

```bash
npm run dev      # Start the Vite development server
npm run build    # Create a production build
npm run lint     # Run Oxlint
npm run preview  # Preview the production build
```

Open the URL printed by Vite, usually `http://localhost:5173`.

## Contract Integration

The integration entry point is `src/contracts/index.js`. It creates an ethers.js `BrowserProvider`, requests access to the connected MetaMask account, obtains a signer, and returns a `LogisticsClient` instance.

`src/contracts/LogisticsClient.js` wraps the deployed `contracts/LogisticsClient.sol` contract. React pages use it for:

- Wallet login and user registration
- Agreement creation and agreement details
- Milestones, checkpoints, and deadline checks
- Agreement termination
- User profiles and transaction history

Transactions are signed by the active MetaMask account. The application expects the wallet to be connected to Ganache chain ID `1337` and requires the compiled artifacts and Ignition deployment addresses to be present locally.

## Application Routes

- `/` - Connect a wallet and log in
- `/register` - Register a shipper or carrier profile
- `/main` - View the agreement dashboard
- `/create` - Create a milestone escrow agreement as a shipper
- `/agreement/:id` - View agreement details and manage milestones or checkpoints
- `/transactions` - View agreement transaction history
- `/counter-demo` - Developer demo for the Counter contract
- `/checkpoint-test` - Developer integration test for checkpoint operations

The simulated date control used for deadline demonstrations is intended for local development only. It must not be used as a production time source.

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
