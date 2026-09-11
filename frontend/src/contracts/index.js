import { ethers } from 'ethers';
import { LogisticsClient } from './LogisticsClient.js';

import logisticsClientArtifact from './abis/LogisticsClient.json';
import userRegistryArtifact from './abis/UserRegistry.json';

// Sepolia
export const CHAIN_ID = 11155111;

// Contracts deployed on Sepolia
const DEPLOYMENTS = {
  11155111: {
    AgreementFactory: '0x5b31b25E9B1272FbCff5F03F486A782aAb2bB158',
    UserRegistry: '0x737993Ea2A28793eDf53C3E560a7bA506205C729',
    LogisticsClient: '0xaDce240eFAD3334144B3141D9fC9925C47e635Ee',
  },
};

const ARTIFACTS = {
  LogisticsClient: logisticsClientArtifact,
  UserRegistry: userRegistryArtifact,
};

export function getContract(contractName, chainId, signerOrProvider) {
  const artifact = ARTIFACTS[contractName];

  if (!artifact) {
    throw new Error(`No ABI found for "${contractName}".`);
  }

  const deployment = DEPLOYMENTS[chainId];

  if (!deployment) {
    throw new Error(`No deployment found for chain ${chainId}.`);
  }

  const address = deployment[contractName];

  if (!address) {
    throw new Error(
      `"${contractName}" has not been deployed on chain ${chainId}.`
    );
  }

  return new ethers.Contract(
    address,
    artifact.abi,
    signerOrProvider
  );
}

export async function getLogisticsClient() {
  if (!window.ethereum) {
    throw new Error('MetaMask is not installed.');
  }

  const provider = new ethers.BrowserProvider(window.ethereum);

  await provider.send('eth_requestAccounts', []);

  const signer = await provider.getSigner();

  return new LogisticsClient(signer);
}