import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.10",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
        details: {
          yul: false
        }
      }
    }
  },
  networks: {
    hardhat: {},
    goerli: {
      url: `https://eth-goerli.g.alchemy.com/v2/n-PlyY-6naBpj-Z5sYa0vjDM_T1LnzqZ`,
      accounts: [`0xcbdb5c657c17ae763085b54db95877255ae752305d75d6bdcca2b51c2c2d0774`, `0x3d04eb544270c3a1fdbc8cc2b89563372012269e595245f1b50ea3b1bccaad94`, `0x357abde8bab828abe9fb28aa4d5a789db68da4fe3f69717d28f6c7cec26de402`]
    }
  }
};

export default config;
