/**
 * Centralized state store using React Context + useReducer.
 * Holds filter state (selected sectors, tickers) and cached API responses.
 */
import React, { createContext, useContext, useReducer, useCallback } from 'react';

const initialState = {
  // Filter
  selectedSectors: [],
  selectedTickers: [],
  // Dropdown catalogue
  sectorCatalogue: [],       // [{ sector, tickers:[{ticker,name}] }]
  catalogueLoading: false,
  catalogueError: null,
  // Cached OHLCV per ticker key=ticker+period
  ohlcvCache: {},
  // Cached fundamentals per ticker
  fundaCache: {},
  // Sector metrics heatmap
  sectorMetrics: null,
  sectorMetricsLoading: false,
  // Sankey
  sankeyData: null,
  sankeyLoading: false,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_SELECTED_SECTORS':
      return { ...state, selectedSectors: action.payload, selectedTickers: [] };
    case 'SET_SELECTED_TICKERS':
      return { ...state, selectedTickers: action.payload };
    case 'SET_CATALOGUE':
      return { ...state, sectorCatalogue: action.payload, catalogueLoading: false, catalogueError: null };
    case 'SET_CATALOGUE_LOADING':
      return { ...state, catalogueLoading: action.payload };
    case 'SET_CATALOGUE_ERROR':
      return { ...state, catalogueError: action.payload, catalogueLoading: false };
    case 'SET_OHLCV':
      return { ...state, ohlcvCache: { ...state.ohlcvCache, [action.key]: action.payload } };
    case 'SET_FUNDA':
      return { ...state, fundaCache: { ...state.fundaCache, [action.ticker]: action.payload } };
    case 'SET_SECTOR_METRICS':
      return { ...state, sectorMetrics: action.payload, sectorMetricsLoading: false };
    case 'SET_SECTOR_METRICS_LOADING':
      return { ...state, sectorMetricsLoading: action.payload };
    case 'SET_SANKEY':
      return { ...state, sankeyData: action.payload, sankeyLoading: false };
    case 'SET_SANKEY_LOADING':
      return { ...state, sankeyLoading: action.payload };
    default:
      return state;
  }
}

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <StoreContext.Provider value={{ state, dispatch }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  return useContext(StoreContext);
}

// ── Derived selectors ─────────────────────────────────────────────────────────

/** All tickers available in the currently-selected sectors */
export function useAvailableTickers() {
  const { state } = useStore();
  const { sectorCatalogue, selectedSectors } = state;
  if (!selectedSectors.length) return [];
  const set = new Set();
  for (const entry of sectorCatalogue) {
    if (selectedSectors.includes(entry.sector)) {
      for (const t of entry.tickers) set.add(JSON.stringify(t));
    }
  }
  return [...set].map(s => JSON.parse(s));
}

/** Fundamentals for currently selected tickers (from cache) */
export function useSelectedFundamentals() {
  const { state } = useStore();
  return state.selectedTickers.map(t => state.fundaCache[t] || null);
}

/** OHLCV for a ticker+period from cache */
export function useOHLCV(ticker, period) {
  const { state } = useStore();
  return state.ohlcvCache[`${ticker}__${period}`] || null;
}
