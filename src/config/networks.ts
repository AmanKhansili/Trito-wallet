import { NetworkConfig, NetworkId } from '../types';

export const NETWORKS: Record<NetworkId, NetworkConfig> = {
  sepolia: {
    id: 'sepolia',
    name: 'Ethereum Sepolia',
    chainId: 11155111,
    rpcUrl:
      process.env.EXPO_PUBLIC_SEPOLIA_RPC_URL ||
      'https://ethereum-sepolia-rpc.publicnode.com',
    explorerUrl: 'https://sepolia.etherscan.io',
    nativeCurrency: {
      name: 'Sepolia Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  mainnet: {
    id: 'mainnet',
    name: 'Ethereum Mainnet',
    chainId: 1,
    rpcUrl:
      process.env.EXPO_PUBLIC_MAINNET_RPC_URL ||
      'https://eth.llamarpc.com',
    explorerUrl: 'https://etherscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  },
};

export const DEFAULT_NETWORK_ID: NetworkId = 'sepolia';

export function getNetwork(networkId: NetworkId): NetworkConfig {
  const net = NETWORKS[networkId];
  if (!net) {
    throw new Error(`Unsupported network: ${networkId}`);
  }
  return net;
}

export function getExplorerTxUrl(networkId: NetworkId, txHash: string): string {
  const network = getNetwork(networkId);
  return `${network.explorerUrl}/tx/${txHash}`;
}

export function getExplorerAddressUrl(networkId: NetworkId, address: string): string {
  const network = getNetwork(networkId);
  return `${network.explorerUrl}/address/${address}`;
}
