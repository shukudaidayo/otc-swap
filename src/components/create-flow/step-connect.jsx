import { useEffect } from 'react'
import { useCreateFlow } from './context'
import AddressDisplay from '../address-display'

export default function StepConnect({ wallet }) {
  const { next, taker, takerENS } = useCreateFlow()

  // Auto-advance when wallet is connected
  useEffect(() => {
    if (wallet) next()
  }, [wallet, next])

  return (
    <div className="wizard-screen">
      <h2>Connect your wallet</h2>
      {taker && (
        <p className="text-muted">
          Trading with: {takerENS || ''} {takerENS && <br />}
          <code className="address-mono">{taker}</code>
        </p>
      )}

      {wallet ? (
        <div className="wizard-connected">
          <p>Connected as:</p>
          <AddressDisplay address={wallet.address} chainId={1} showFull />
        </div>
      ) : (
        <div className="wizard-connect-cta">
          <appkit-button />
        </div>
      )}
    </div>
  )
}
