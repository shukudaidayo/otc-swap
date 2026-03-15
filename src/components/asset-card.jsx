import { useState, useEffect } from 'react'
import { fetchMetadata } from '../lib/metadata'
import { getVerificationStatus, getEtherscanUrl } from '../lib/verification'
import { WHITELISTED_ERC20 } from '../lib/constants'

// Seaport ItemType enum values
const ITEM_TYPE_LABELS = { 0: 'ETH', 1: 'ERC-20', 2: 'ERC-721', 3: 'ERC-1155' }
const BADGE = { verified: '\u2705', unverified: '\u26A0\uFE0F', suspicious: '\uD83D\uDED1' }

function resolveItemType(asset) {
  if (asset.itemType !== undefined) return Number(asset.itemType)
  if (asset.assetType === 'NATIVE') return 0
  if (asset.assetType === 'ERC20') return 1
  if (asset.assetType === 'ERC1155') return 3
  return 2
}

export default function AssetCard({ asset, chainId }) {
  const [metadata, setMetadata] = useState(null)
  const [loading, setLoading] = useState(true)
  const [verification, setVerification] = useState(null)

  const itemType = resolveItemType(asset)
  const isNative = itemType === 0
  const isERC20 = itemType === 1
  const isERC1155 = itemType === 3
  const isNFT = itemType === 2 || itemType === 3

  // Look up ERC-20 symbol from whitelist
  const erc20Info = isERC20 && chainId ? (WHITELISTED_ERC20[chainId] || {})[asset.token] : null

  useEffect(() => {
    if (!asset.token || !chainId || isERC20 || isNative) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setMetadata(null)

    fetchMetadata(chainId, asset.token, asset.tokenId, isERC1155 ? 1 : 0)
      .then((m) => {
        if (!cancelled) {
          setMetadata(m)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [asset.token, asset.tokenId, itemType, chainId, isERC20, isNative, isERC1155])

  // Fetch verification status (async — may call Alchemy)
  useEffect(() => {
    if (!asset.token || !chainId || isNative) return

    let cancelled = false
    getVerificationStatus(chainId, asset.token, metadata?.name).then((v) => {
      if (!cancelled) setVerification(v)
    })

    return () => { cancelled = true }
  }, [asset.token, chainId, isNative, metadata?.name])

  // Native ETH — simple display, no verification needed
  if (isNative) {
    return (
      <div className="asset-card asset-card-verified">
        <div className="asset-card-image">
          <div className="asset-card-placeholder">ETH</div>
        </div>
        <div className="asset-card-info">
          <span className="asset-card-name">{asset.amount || '0'} ETH</span>
          <div className="asset-card-meta">
            <span className="asset-type">Native ETH</span>
          </div>
        </div>
      </div>
    )
  }

  const vStatus = verification || { status: 'unverified', message: null }
  const etherscanUrl = getEtherscanUrl(chainId, asset.token)

  // Display name for ERC-20
  const displayName = isERC20
    ? `${asset.amount || '0'} ${erc20Info?.symbol || 'tokens'}`
    : metadata?.name || `#${asset.tokenId}`

  return (
    <div className={`asset-card asset-card-${vStatus.status}`}>
      <div className="asset-card-image">
        {isERC20 ? (
          <div className="asset-card-placeholder">$</div>
        ) : loading ? (
          <div className="asset-card-placeholder">...</div>
        ) : metadata?.image ? (
          <img src={metadata.image} alt={metadata.name || ''} loading="lazy" />
        ) : (
          <div className="asset-card-placeholder">?</div>
        )}
      </div>
      <div className="asset-card-info">
        <span className="asset-card-name">
          <span className="verification-badge" title={vStatus.status}>
            {BADGE[vStatus.status]}
          </span>
          {displayName}
        </span>
        <a
          className="asset-card-address"
          href={etherscanUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="View on Etherscan"
        >
          {asset.token}
        </a>
        <div className="asset-card-meta">
          <span className="asset-type">{ITEM_TYPE_LABELS[itemType] || 'Unknown'}</span>
          {isERC1155 && (
            <span className="asset-detail">&times;{asset.amount}</span>
          )}
          {isNFT && <span className="asset-card-tokenid">#{asset.tokenId}</span>}
        </div>
        {vStatus.status !== 'verified' && vStatus.message && (
          <p className={`verification-msg verification-${vStatus.status}`}>
            {vStatus.message}
          </p>
        )}
      </div>
    </div>
  )
}
