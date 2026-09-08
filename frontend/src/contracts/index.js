import { ethers } from 'ethers';

export const CHAIN_ID = 1337;

// Collect compiled contract artifacts
const artifactModules = import.meta.glob(
  '../../../artifacts/contracts/**/*.json',
  { eager: true }
);

// Collect deployed contract addresses
const deploymentModules = import.meta.glob(
  '../../../ignition/deployments/*/deployed_addresses.json',
  { eager: true }
);

function unwrap(mod) {
  return mod?.default ?? mod;
}

function findArtifact(contractName) {
  const path = Object.keys(artifactModules).find(
    (p) => p.endsWith(`/${contractName}.json`)
  );

  if (!path) {
    throw new Error(
      `No compiled artifact for "${contractName}". Run "npx hardhat build" first.`
    );
  }

  return unwrap(artifactModules[path]);
}

function findAddress(contractName, chainId) {
  const path = Object.keys(deploymentModules).find(
    (p) => p.includes(`/chain-${chainId}/`)
  );

  if (!path) {
    throw new Error(
      `No Ignition deployment found for chain ${chainId}.`
    );
  }

  const addresses = unwrap(deploymentModules[path]);

  const key = Object.keys(addresses).find(
    (k) => k.endsWith(`#${contractName}`)
  );

  if (!key) {
    throw new Error(
      `"${contractName}" hasn't been deployed on chain ${chainId} yet.`
    );
  }

  return addresses[key];
}

export function getContract(
  contractName,
  chainId,
  signerOrProvider
) {
  const artifact = findArtifact(contractName);
  const address = findAddress(contractName, chainId);

  return new ethers.Contract(
    address,
    artifact.abi,
    signerOrProvider
  );
}

export async function getLogisticsClient() {
  const provider = new ethers.BrowserProvider(window.ethereum);

  await provider.send('eth_requestAccounts', []);

  const signer = await provider.getSigner();

  return getContract(
    'LogisticsClient',
    CHAIN_ID,
    signer
  );
}