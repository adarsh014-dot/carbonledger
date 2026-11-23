import addresses from "../contracts/addresses.json";

const ZERO = "0x0000000000000000000000000000000000000000";

export const NETWORKS = {
  11155111: {
    chainId: 11155111,
    hexChainId: "0xaa36a7",
    name: "Sepolia",
    shortName: "Sepolia",
    rpcUrl:
      import.meta.env.VITE_SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com",
    explorer: "https://sepolia.etherscan.io",
    currency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
  },
  31337: {
    chainId: 31337,
    hexChainId: "0x7a69",
    name: "Hardhat Localhost",
    shortName: "Localhost",
    rpcUrl: import.meta.env.VITE_LOCALHOST_RPC_URL || "http://127.0.0.1:8545",
    explorer: "",
    currency: { name: "Ether", symbol: "ETH", decimals: 18 },
  },
};

export const EXPECTED_CHAIN_ID = Number(addresses.chainId) || 11155111;
export const NETWORK = NETWORKS[EXPECTED_CHAIN_ID] || NETWORKS[11155111];
export const IS_CONFIGURED = addresses.ProjectRegistry !== ZERO;
export const DEPLOYMENT_BLOCK = Number(addresses.deploymentBlock) || 0;

export const CONTRACT_ADDRESSES = {
  ProjectRegistry: addresses.ProjectRegistry,
  CarbonCreditToken: addresses.CarbonCreditToken,
  RetirementCertificate: addresses.RetirementCertificate,
  CarbonMarketplace: addresses.CarbonMarketplace,
};

export function txUrl(hash) {
  if (!NETWORK.explorer || !hash) return "";
  return `${NETWORK.explorer}/tx/${hash}`;
}

export function addressUrl(address) {
  if (!NETWORK.explorer || !address) return "";
  return `${NETWORK.explorer}/address/${address}`;
}

export function isCorrectChain(chainId) {
  return Number(chainId) === EXPECTED_CHAIN_ID;
}
