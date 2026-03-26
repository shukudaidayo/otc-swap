import { createContext, createElement, useContext, useEffect, useState } from 'react'

// Wallet context — populated once AppKit loads asynchronously
const WalletContext = createContext(null)

export function useWallet() {
  return useContext(WalletContext)
}

// Loads appkit config first (createAppKit), then the React hooks module
const appkitReady = import('./appkit').then(() => import('@reown/appkit/react'))

// Provider that async-loads AppKit and provides wallet state
export function WalletProvider({ children }) {
  const [appkit, setAppkit] = useState(null)
  const [wallet, setWallet] = useState(null)

  useEffect(() => {
    appkitReady.then(setAppkit)
  }, [])

  return createElement(WalletContext.Provider, { value: wallet },
    appkit ? createElement(WalletSync, { appkit, setWallet }) : null,
    children
  )
}

// Invisible component that syncs AppKit hook state into the context
function WalletSync({ appkit, setWallet }) {
  const { address, isConnected } = appkit.useAppKitAccount()
  const { walletProvider } = appkit.useAppKitProvider('eip155')
  const { chainId } = appkit.useAppKitNetwork()

  useEffect(() => {
    setWallet(isConnected ? { address, provider: walletProvider, chainId: Number(chainId) } : null)
  }, [address, isConnected, walletProvider, chainId, setWallet])

  return null
}
