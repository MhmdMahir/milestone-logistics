// Tan Zhen Yu
// Collects the json from hardhat deploy
// And ABI from hardhat build
// To pass to ethers js to communicate with Ganache network

import { ethers } from 'ethers';
import { LogisticsClient } from './LogisticsClient.js';

export const CHAIN_ID = 1337; // Ganache

// Every compiled contract artifact Hardhat produces, and every network's
// deployed-address map Ignition writes. New .sol files and new deployments
// are picked up automatically — nothing to hand-wire here.
const artifactModules = import.meta.glob('../../../artifacts/contracts/**/*.json', { eager: true });
const deploymentModules = import.meta.glob('../../../ignition/deployments/*/deployed_addresses.json', { eager: true });

function unwrap(mod) {
  return mod?.default ?? mod;
}

function findArtifact(contractName) {
  const path = Object.keys(artifactModules).find((p) => p.endsWith(`/${contractName}.json`));
  if (!path) {
    throw new Error(`No compiled artifact for "${contractName}". Run "npx hardhat build" first.`);
  }
  return unwrap(artifactModules[path]);
}

function findAddress(contractName, chainId) {
  const path = Object.keys(deploymentModules).find((p) => p.includes(`/chain-${chainId}/`));
  if (!path) {
    throw new Error(`No Ignition deployment found for chain ${chainId}.`);
  }
  const addresses = unwrap(deploymentModules[path]);
  const key = Object.keys(addresses).find((k) => k.endsWith(`#${contractName}`));
  if (!key) {
    throw new Error(`"${contractName}" hasn't been deployed on chain ${chainId} yet.`);
  }
  return addresses[key];
}

/** Get an ethers.Contract for any Hardhat-compiled, Ignition-deployed contract by name. */
export function getContract(contractName, chainId, signerOrProvider) {
  const artifact = findArtifact(contractName);
  const address = findAddress(contractName, chainId);
  return new ethers.Contract(address, artifact.abi, signerOrProvider);
}

// The only way pages should touch contract-shaped data. The refund demo uses
// the localStorage facade today; a live native-ETH integration can replace
// this return value with getContract('LogisticsClient', CHAIN_ID, signer).
export async function getLogisticsClient() {
  const provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send('eth_requestAccounts', []);
  const signer = await provider.getSigner();
  return new LogisticsClient(signer);
}
