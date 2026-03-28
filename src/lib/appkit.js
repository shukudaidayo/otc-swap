import { createAppKit } from '@reown/appkit/react'
import { EthersAdapter } from '@reown/appkit-adapter-ethers'
import { mainnet, base, polygon, defineChain } from '@reown/appkit/networks'

export const ink = defineChain({
  id: 57073,
  caipNetworkId: 'eip155:57073',
  chainNamespace: 'eip155',
  name: 'Ink',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc-gel.inkonchain.com'] },
  },
  blockExplorers: {
    default: { name: 'Blockscout', url: 'https://explorer.inkonchain.com' },
  },
})

const projectId = import.meta.env.VITE_REOWN_PROJECT_ID

const metadata = {
  name: 'ocarina.trade',
  description: 'Peer-to-peer NFT trades, fully onchain',
  url: window.location.origin,
  icons: [],
}

const inkLogo = new URL('../assets/chains/ink.png', import.meta.url).href

createAppKit({
  adapters: [new EthersAdapter()],
  networks: [mainnet, base, polygon, ink],
  metadata,
  projectId,
  chainImages: {
    57073: inkLogo,
  },
  features: {
    email: false,
    socials: false,
  },
  themeVariables: {
    '--w3m-border-radius-master': '4px',
  },
})
