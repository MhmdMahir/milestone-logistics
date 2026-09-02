import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { configVariable, defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [hardhatToolboxMochaEthersPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.34",
        settings: {
          evmVersion: "london",
        },
      },
      production: {
        version: "0.8.34",
        settings: {
          evmVersion: "london",
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: true,
          // getAgreementDetails' return shape (7 values incl. a nested
          // dynamic array) hits "stack too deep" under the legacy codegen
          // once the optimizer is on; viaIR is solc's own suggested fix.
          viaIR: true,
        },
      },
    },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    },
    ganache: {
      type: "http",
      chainType: "l1",
      url: "http://127.0.0.1:7545",
      accounts: [configVariable("GANACHE_PRIVATE_KEY")],
    },
  },
});
