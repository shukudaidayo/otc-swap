import { useCreateFlow } from './context'
import { ZONE_ADDRESSES, CHAINS } from '../../lib/constants'
import { useAppKitNetwork } from '@reown/appkit/react'
import { mainnet, base, polygon } from '@reown/appkit/networks'

const APPKIT_NETWORKS = {
  1: mainnet,
  8453: base,
  137: polygon,
}

const CHAIN_LOGOS = {
  1: new URL('../../assets/tokens/eth.png', import.meta.url).href,
  8453: new URL('../../assets/chains/base.jpg', import.meta.url).href,
  137: new URL('../../assets/tokens/pol.png', import.meta.url).href,
}

const CHAIN_DESCRIPTIONS = {
  1: 'OG NFTs and ENS names',
  8453: 'Beezie, Slab, and other collectibles',
  137: 'Courtyard collectibles',
}

const DEPLOYED_CHAINS = Object.entries(ZONE_ADDRESSES)
  .filter(([, addr]) => addr !== null)
  .map(([id]) => Number(id))

export default function StepChain({ wallet }) {
  const { next, chainId, setChainId, setMakerAssets, setTakerAssets } = useCreateFlow()
  const { switchNetwork } = useAppKitNetwork()

  const handleSelect = async (id) => {
    // If changing chain, clear any previously selected assets
    if (chainId && chainId !== id) {
      setMakerAssets([])
      setTakerAssets([])
    }

    setChainId(id)

    // Switch wallet network if needed
    if (wallet.chainId !== id) {
      try {
        await switchNetwork(APPKIT_NETWORKS[id])
      } catch {
        // User rejected — stay on this screen
        return
      }
    }

    next()
  }

  return (
    <div className="wizard-screen">
      <h2>Which chain are you trading on?</h2>
      <div className="chain-cards">
        {DEPLOYED_CHAINS.map((id) => (
          <button
            key={id}
            className={`chain-card${chainId === id ? ' chain-card-active' : ''}`}
            onClick={() => handleSelect(id)}
            type="button"
          >
            {CHAIN_LOGOS[id] && <img src={CHAIN_LOGOS[id]} alt="" className="chain-card-logo" />}
            <div className="chain-card-text">
              <span className="chain-card-name">{CHAINS[id]?.name || `Chain ${id}`}</span>
              <span className="chain-card-desc">{CHAIN_DESCRIPTIONS[id] || ''}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
