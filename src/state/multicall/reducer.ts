import { createReducer } from '@reduxjs/toolkit'

import {
  addMulticallListeners,
  errorFetchingMulticallResults,
  fetchingMulticallResults,
  removeMulticallListeners,
  toCallKey,
  updateMulticallResults,
} from './actions'

export interface MulticallState {
  callListeners?: {
    // on a per-chain basis
    [chainId: number]: {
      // stores for each call key the listeners' preferences
      [callKey: string]: {
        // stores how many listeners there are per each blocks per fetch preference
        [blocksPerFetch: number]: number
      }
    }
  }

  callResults: {
    [chainId: number]: {
      [callKey: string]: {
        data?: Maybe<string>
        blockNumber?: number
        fetchingBlockNumber?: number
      }
    }
  }
}

const initialState: MulticallState = {
  callResults: {},
}

export default createReducer(initialState, (builder) =>
  builder
    .addCase(
      addMulticallListeners,
      (state, { payload: { calls, chainId, options: { blocksPerFetch = 1 } = {} } }) => {
        const listeners: MulticallState['callListeners'] = state.callListeners
          ? state.callListeners
          : (state.callListeners = {})
        listeners[chainId] = listeners[chainId] ?? {}
        calls.forEach((call) => {
          const callKey = toCallKey(call)
          listeners[chainId][callKey] = listeners[chainId][callKey] ?? {}
          listeners[chainId][callKey][blocksPerFetch] =
            (listeners[chainId][callKey][blocksPerFetch] ?? 0) + 1
        })
      },
    )
    .addCase(
      removeMulticallListeners,
      (state, { payload: { calls, chainId, options: { blocksPerFetch = 1 } = {} } }) => {
        const listeners: MulticallState['callListeners'] = state.callListeners
          ? state.callListeners
          : (state.callListeners = {})

        if (!listeners[chainId]) return
        calls.forEach((call) => {
          const callKey = toCallKey(call)
          if (!listeners[chainId][callKey]) return
          if (!listeners[chainId][callKey][blocksPerFetch]) return

          if (listeners[chainId][callKey][blocksPerFetch] === 1) {
            delete listeners[chainId][callKey][blocksPerFetch]
          } else {
            listeners[chainId][callKey][blocksPerFetch]--
          }
        })
      },
    )
    .addCase(
      fetchingMulticallResults,
      (state, { payload: { calls, chainId, fetchingBlockNumber } }) => {
        state.callResults[chainId] = state.callResults[chainId] ?? {}
        calls.forEach((call) => {
          const callKey = toCallKey(call)
          const current = state.callResults[chainId][callKey]
          if (!current) {
            state.callResults[chainId][callKey] = {
              fetchingBlockNumber,
            }
          } else {
            if (current.fetchingBlockNumber ?? 0 >= fetchingBlockNumber) return
            state.callResults[chainId][callKey].fetchingBlockNumber = fetchingBlockNumber
          }
        })
      },
    )
    .addCase(
      errorFetchingMulticallResults,
      (state, { payload: { calls, chainId, fetchingBlockNumber } }) => {
        state.callResults[chainId] = state.callResults[chainId] ?? {}
        calls.forEach((call) => {
          const callKey = toCallKey(call)
          const current = state.callResults[chainId][callKey]
          if (current && current.fetchingBlockNumber !== fetchingBlockNumber) return
          delete current.fetchingBlockNumber
        })
      },
    )
    .addCase(updateMulticallResults, (state, { payload: { blockNumber, chainId, results } }) => {
      state.callResults[chainId] = state.callResults[chainId] ?? {}
      Object.keys(results).forEach((callKey) => {
        const current = state.callResults[chainId][callKey]
        if ((current?.blockNumber ?? 0) > blockNumber) return
        state.callResults[chainId][callKey] = {
          data: results[callKey],
          blockNumber,
        }
      })
    }),
)
