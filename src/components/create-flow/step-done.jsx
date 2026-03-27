import { useState } from 'react'
import { Link } from 'react-router'

export default function StepDone({ chainId, txHash }) {
  const [copied, setCopied] = useState(false)
  const offerPath = `/offer/${chainId}/${txHash}`
  const fullUrl = `${window.location.origin}${offerPath}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
      const input = document.createElement('input')
      input.value = fullUrl
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="wizard-screen wizard-done">
      <div className="done-check">&#10003;</div>
      <h2>Your offer is live!</h2>

      <div className="done-link">
        <code>{fullUrl}</code>
        <button type="button" className="btn btn-sm" onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy Link'}
        </button>
      </div>

      <div className="done-actions">
        <Link to={offerPath} className="btn">View your offer</Link>
        <Link to="/" className="btn btn-secondary">Create another offer</Link>
      </div>
    </div>
  )
}
