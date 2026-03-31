import { useState, useEffect } from 'react'
import { Link, useOutletContext } from 'react-router'
import { queryOrderEvents, getOrderStatus, deriveOrderStatus } from '../lib/contract'
import { checkHoldings } from '../lib/balances'
import { fetchMetadata } from '../lib/metadata'
import AddressDisplay from '../components/address-display'
import { ZONE_ADDRESSES, CHAINS, WHITELISTED_ERC20 } from '../lib/constants'
import { formatUnits } from 'ethers'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const PAGE_SIZE = 20

// Chains that have a deployed zone contract
const DEPLOYED_CHAINS = Object.entries(ZONE_ADDRESSES)
  .filter(([, addr]) => addr !== null)
  .map(([id]) => Number(id))

export default function Offers() {
  const wallet = useOutletContext()
  const [chainFilter, setChainFilter] = useState('all')
  const [category, setCategory] = useState('all')
  const [autoPromoted, setAutoPromoted] = useState(false)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [partial, setPartial] = useState(false)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  // After orders load, auto-promote: My Offers > All Open > All Trades
  useEffect(() => {
    if (autoPromoted || loading || orders.length === 0) return
    if (wallet) {
      const userAddr = wallet.address.toLowerCase()
      const hasMine = orders.some((o) => {
        const isMaker = o.maker.toLowerCase() === userAddr
        const isTaker = o.taker !== ZERO_ADDRESS && o.taker.toLowerCase() === userAddr
        return isMaker || isTaker
      })
      if (hasMine) { setCategory('mine'); setAutoPromoted(true); return }
    }
    const hasOpen = orders.some((o) => o.status === 'open')
    if (hasOpen) setCategory('open')
    setAutoPromoted(true)
  }, [wallet, loading, orders, autoPromoted])

  useEffect(() => {
    setOrders([])
    setLoading(true)
    setError(null)
    setPartial(false)

    const chainsToLoad = chainFilter === 'all'
      ? DEPLOYED_CHAINS
      : [Number(chainFilter)]

    let cancelled = false
    async function load() {
      try {
        // Load all selected chains in parallel
        const chainResults = await Promise.all(
          chainsToLoad.map(async (cid) => {
            const registrations = await queryOrderEvents(cid, ZONE_ADDRESSES[cid])
            const isPartial = registrations._partial
            // Tag each order with its chain
            const tagged = registrations.map((r) => ({ ...r, chainId: cid }))

            // Fetch Seaport status for each order (batched to avoid RPC rate limits)
            const BATCH_SIZE = 3
            const enriched = []
            for (let i = 0; i < tagged.length; i += BATCH_SIZE) {
              if (cancelled) return []
              const batch = tagged.slice(i, i + BATCH_SIZE)
              const results = await Promise.all(
                batch.map(async (reg) => {
                  try {
                    const seaportStatus = await getOrderStatus(cid, reg.orderHash)
                    const endTime = reg.order?.parameters?.endTime
                    const status = deriveOrderStatus(seaportStatus, endTime)
                    return { ...reg, status }
                  } catch {
                    return { ...reg, status: 'unknown' }
                  }
                })
              )
              enriched.push(...results)
            }

            if (isPartial) enriched._partial = true
            return enriched
          })
        )

        if (cancelled) return

        // Merge results from all chains, most recent first
        const allOrders = chainResults.flat()
        allOrders.reverse()
        const anyPartial = chainResults.some((r) => r._partial)
        if (anyPartial) setPartial(true)
        setOrders(allOrders)
      } catch (err) {
        console.error('Failed to load offers:', err)
        if (!cancelled) setError('Failed to load offers. RPC may be rate-limited.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [chainFilter])

  // Check maker holdings for open offers
  useEffect(() => {
    const openOrders = orders.filter((o) => o.status === 'open' && o.order?.parameters)
    if (openOrders.length === 0) return

    let cancelled = false

    ;(async () => {
      const BATCH = 5
      const checks = []
      for (let i = 0; i < openOrders.length; i += BATCH) {
        if (cancelled) return
        const batch = openOrders.slice(i, i + BATCH)
        const results = await Promise.all(
          batch.map(async (o) => {
            const results = await checkHoldings(o.chainId, o.maker, o.order.parameters.offer)
            return { orderHash: o.orderHash, makerHoldsAll: results.every((h) => h.held) }
          })
        )
        checks.push(...results)
      }
      return checks
    })().then((checks) => {
      if (!checks) return
      if (cancelled) return
      const holdingsMap = {}
      for (const c of checks) holdingsMap[c.orderHash] = c.makerHoldsAll
      setOrders((prev) => prev.map((o) => ({
        ...o,
        makerHoldsAll: holdingsMap[o.orderHash] ?? true,
      })))
    })

    return () => { cancelled = true }
  }, [orders.length]) // re-run when orders finish loading

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [category])

  const userAddr = wallet?.address?.toLowerCase()

  const filtered = orders.filter((o) => {
    if (category === 'mine') {
      if (!userAddr) return false
      const isMaker = o.maker.toLowerCase() === userAddr
      const isTaker = o.taker !== ZERO_ADDRESS && o.taker.toLowerCase() === userAddr
      return isMaker || isTaker
    }
    if (category === 'open') return o.status === 'open'
    if (category === 'all') return true
    return false
  })

  if (category === 'open') {
    // Sort: valid first, then by soonest expiration
    filtered.sort((a, b) => {
      const aValid = a.makerHoldsAll !== false ? 1 : 0
      const bValid = b.makerHoldsAll !== false ? 1 : 0
      if (aValid !== bValid) return bValid - aValid
      const aEnd = Number(a.order?.parameters?.endTime || 0)
      const bEnd = Number(b.order?.parameters?.endTime || 0)
      if (!aEnd && !bEnd) return 0
      if (!aEnd) return 1
      if (!bEnd) return -1
      return aEnd - bEnd
    })
  } else {
    // Sort by creation time, newest first
    filtered.sort((a, b) => {
      const aStart = Number(a.order?.parameters?.startTime || 0)
      const bStart = Number(b.order?.parameters?.startTime || 0)
      return bStart - aStart
    })
  }

  const visible = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length

  return (
    <div className="page offers">
      <h1>Offers</h1>

      <div className="offers-filters">
        <label>
          Chain
          <select value={chainFilter} onChange={(e) => setChainFilter(e.target.value)}>
            <option value="all">All Chains</option>
            {DEPLOYED_CHAINS.map((id) => (
              <option key={id} value={id}>{CHAINS[id]?.name || `Chain ${id}`}</option>
            ))}
          </select>
        </label>
        <label>
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="mine">My Offers</option>
            <option value="open">All Open</option>
            <option value="all">All Offers</option>
          </select>
        </label>
      </div>

      {loading && <p className="text-muted">Loading offers...</p>}
      {error && <p className="form-error">{error}</p>}
      {partial && !loading && <p className="text-muted">Only showing recent offers. Older offers may be missing.</p>}

      {!loading && !error && category === 'mine' && !wallet && (
        <p className="text-muted">Connect your wallet to see your offers.</p>
      )}

      {!loading && !error && filtered.length === 0 && (category !== 'mine' || wallet) && (
        <p className="text-muted">
          {category === 'mine' ? 'No offers involving your wallet.' :
           category === 'open' ? 'No open offers.' : 'No offers found.'}
        </p>
      )}

      {!loading && visible.length > 0 && (
        <div className="offers-list">
          {visible.map((order) => (
            <OfferCard key={order.orderHash} order={order} invalidHoldings={order.makerHoldsAll === false} />
          ))}
        </div>
      )}

      {hasMore && (
        <button
          className="btn btn-secondary"
          style={{ marginTop: '1rem' }}
          onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
        >
          Load More ({filtered.length - visibleCount} remaining)
        </button>
      )}
    </div>
  )
}

const TOKEN_LOGOS = {
  ETH: new URL('../assets/tokens/eth.png', import.meta.url).href,
  POL: new URL('../assets/tokens/pol.png', import.meta.url).href,
  WETH: new URL('../assets/tokens/weth.png', import.meta.url).href,
  USDC: new URL('../assets/tokens/usdc.png', import.meta.url).href,
  USDT: new URL('../assets/tokens/usdt.png', import.meta.url).href,
  USDT0: new URL('../assets/tokens/usdt.png', import.meta.url).href,
  USDS: new URL('../assets/tokens/usds.png', import.meta.url).href,
  EURC: new URL('../assets/tokens/eurc.png', import.meta.url).href,
}

function OfferCard({ order, invalidHoldings }) {
  const { chainId } = order
  const offerUrl = `/offer/${chainId}/${order.transactionHash}`
  const params = order.order?.parameters

  return (
    <Link to={offerUrl} className={`offer-card${invalidHoldings ? ' offer-card-invalid' : ''}`}>
      <div className="offer-card-side">
        <div className="offer-card-from">
          From <AddressDisplay address={order.maker} chainId={chainId} asSpan />
        </div>
        {params && <AssetSummary items={params.offer} chainId={chainId} />}
      </div>
      <div className="offer-card-side">
        <div className="offer-card-from">
          {order.taker === ZERO_ADDRESS ? (
            <>From Anyone</>
          ) : (
            <>From <AddressDisplay address={order.taker} chainId={chainId} asSpan /></>
          )}
        </div>
        {params && <AssetSummary items={params.consideration} chainId={chainId} />}
      </div>
      <div className="offer-card-meta">
        <span className="offer-card-chain">{CHAINS[chainId]?.name}</span>
        <span className={`status-badge status-${order.status}`}>
          {order.status}
        </span>
        {invalidHoldings && (
          <span className="offer-card-warning">Maker no longer holds assets</span>
        )}
      </div>
    </Link>
  )
}

function AssetSummary({ items, chainId }) {
  return (
    <div className="offer-assets">
      {items.map((item, i) => {
        const it = Number(item.itemType)
        if (it === 0) {
          const sym = CHAINS[chainId]?.nativeSymbol || 'ETH'
          return (
            <span key={i} className="offer-asset-item">
              {TOKEN_LOGOS[sym] && <img src={TOKEN_LOGOS[sym]} alt={sym} className="offer-asset-logo" />}
              <span>{formatUnits(item.startAmount, 18)} {sym}</span>
            </span>
          )
        }
        if (it === 1) {
          const info = (WHITELISTED_ERC20[chainId] || {})[item.token]
          const amount = formatUnits(item.startAmount, info?.decimals ?? 18)
          const sym = info?.symbol || '???'
          return (
            <span key={i} className="offer-asset-item">
              {TOKEN_LOGOS[sym] && <img src={TOKEN_LOGOS[sym]} alt={sym} className="offer-asset-logo" />}
              <span>{amount} {sym}</span>
            </span>
          )
        }
        return (
          <NFTAssetItem key={i} chainId={chainId} token={item.token} tokenId={item.identifierOrCriteria} itemType={it} amount={item.startAmount} />
        )
      })}
    </div>
  )
}

function NFTAssetItem({ chainId, token, tokenId, itemType, amount }) {
  const [meta, setMeta] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchMetadata(chainId, token, tokenId, itemType === 3 ? 1 : 0).then((m) => {
      if (!cancelled) setMeta(m)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [chainId, token, tokenId, itemType])

  return (
    <span className="offer-asset-item">
      <span className="offer-asset-thumb">
        {meta?.image ? (
          <img src={meta.image} alt={meta.name || ''} loading="lazy" />
        ) : (
          <span className="offer-asset-thumb-placeholder">?</span>
        )}
      </span>
      <span>{meta?.name || `#${tokenId}`}{Number(amount) > 1 && ` x${amount}`}</span>
    </span>
  )
}
