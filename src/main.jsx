import { Buffer } from 'buffer'
globalThis.Buffer = Buffer

import { lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { createHashRouter, RouterProvider } from 'react-router'
import App from './app'
import Home from './pages/home'
import './style.css'

// Lazy-load heavy pages — they pull in ethers, seaport-js, etc.
const Create = lazy(() => import('./pages/create'))
const Trade = lazy(() => import('./pages/trade'))
import Offers from './pages/offers'

const router = createHashRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Home /> },
      { path: 'create', element: <Create /> },
      { path: 'trade/:chainId/:txHash', element: <Trade /> },
      { path: 'offers', element: <Offers /> },
    ],
  },
])

createRoot(document.getElementById('root')).render(<RouterProvider router={router} />)
