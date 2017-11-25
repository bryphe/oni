// SyntaxHighlightingSelectors.ts
//
// Reducers for handling state changes from ISyntaxHighlightActions

import { ISyntaxHighlightState } from "./SyntaxHighlightingStore"

export type SyntaxHighlightRange = { top: number, bottom: number }

export const NullRange: SyntaxHighlightRange = { top: -1, bottom: -1 }

export const getRelevantRange = (state: ISyntaxHighlightState, bufferId: number | string): SyntaxHighlightRange => {

    if (!state.bufferToHighlights[bufferId]) {
        return NullRange
    }

    const buffer = state.bufferToHighlights[bufferId]

    return {
        top: buffer.topVisibleLine,
        bottom: buffer.bottomVisibleLine
    }
}
