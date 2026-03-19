import { Link, Outlet } from 'react-router'
import { useAppKitAccount, useAppKitProvider, useAppKitNetwork } from '@reown/appkit/react'

export default function App() {
  const { address, isConnected } = useAppKitAccount()
  const { walletProvider } = useAppKitProvider('eip155')
  const { chainId } = useAppKitNetwork()

  const wallet = isConnected ? { address, provider: walletProvider, chainId: Number(chainId) } : null

  return (
    <div className="app">
      <header>
        <nav>
          <Link to="/" className="logo">ocarina.trade</Link>
          <div className="nav-links">
            <Link to="/create">Create</Link>
            <Link to="/offers">Offers</Link>
          </div>
          <appkit-button />
        </nav>
      </header>
      <main>
        <Outlet context={wallet} />
      </main>
      <footer>
        <p>ocarina.trade — peer-to-peer NFT swaps, fully on-chain</p>
      </footer>
    </div>
  )
}
