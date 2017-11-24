// SyntaxHighlightingReducer.ts
//
// Reducers for handling state changes from ISyntaxHighlightActions


import { ISyntaxHighlightAction, ISyntaxHighlightState, IBufferSyntaxHighlightState, SyntaxHighlightLines } from "./SyntaxHighlightingStore"

import { Reducer } from "redux"

export const reducer: Reducer<ISyntaxHighlightState> = (
    state: ISyntaxHighlightState = {
        bufferToHighlights: {},
    },
    action: ISyntaxHighlightAction,
) => {

    return {
        ...state,
        bufferToHighlights: bufferToHighlightsReducer(state.bufferToHighlights, action),
    }
}

export const bufferToHighlightsReducer: Reducer<{ [bufferId: string]: IBufferSyntaxHighlightState }> = (
    state: { [bufferId: string]: IBufferSyntaxHighlightState } = {},
    action: ISyntaxHighlightAction,
) => {
    return {
        ...state,
        [action.bufferId]: bufferReducer(state[action.bufferId], action),
    }
}

export const bufferReducer: Reducer<IBufferSyntaxHighlightState> = (
    state: IBufferSyntaxHighlightState = {
        bufferId: null,
        language: null,
        topVisibleLine: -1,
        bottomVisibleLine: -1,
        lines: {},
    },
    action: ISyntaxHighlightAction,
) => {

    switch (action.type) {
        case "SYNTAX_UPDATE_BUFFER":
            return {
                ...state,
                bufferId: action.bufferId,
                language: action.language,
                lines: linesReducer(state.lines, action),
            }
        case "SYNTAX_UPDATE_BUFFER_LINE":
            return {
                ...state,
                lines: linesReducer(state.lines, action)
            }
        case "SYNTAX_UPDATE_BUFFER_VIEWPORT":
            return {
                ...state,
                topVisibleLine: action.topVisibleLine,
                bottomVisibleLine: action.bottomVisibleLine,
            }
        case "SYNTAX_UPDATE_TOKENS_FOR_LINE":
            return {
                ...state,
                lines: linesReducer(state.lines, action),
            }
        default:
            return state
    }
}

export const linesReducer: Reducer<SyntaxHighlightLines> = (
    state: SyntaxHighlightLines = {},
    action: ISyntaxHighlightAction,
) => {

    switch (action.type) {
        case "SYNTAX_UPDATE_TOKENS_FOR_LINE":
            {
            const newState = {
                ...state,
            }

            const originalLine = newState[action.lineNumber]

            // If the ruleStack changed, we need to invalidate the next line
            const shouldDirtyNextLine = originalLine && originalLine.ruleStack && !originalLine.ruleStack.equals(action.ruleStack)

            newState[action.lineNumber] = {
                ...originalLine,
                dirty: false,
                tokens: action.tokens,
                ruleStack: action.ruleStack,
            }

            const nextLine = newState[action.lineNumber + 1]
            if (shouldDirtyNextLine && nextLine) {
                newState[action.lineNumber + 1] = {
                    ...nextLine,
                    dirty: true
                }
            }

            return newState
            }
        case "SYNTAX_UPDATE_BUFFER_LINE":
            const newState = {
                ...state,
            }

            // Set 'dirty' flag for updated line to true
            const oldLine = newState[action.lineNumber]
            newState[action.lineNumber] = {
                tokens: [],
                ruleStack: null,
                ...oldLine,
                line: action.line,
                dirty: true,
            }

            return newState
        case "SYNTAX_UPDATE_BUFFER":

            const updatedBufferState: SyntaxHighlightLines = {
                ...state,
            }

            for (let i = 0; i < action.lines.length; i++) {
                const oldLine = updatedBufferState[i]
                const newLine = action.lines[i]

                if (oldLine && oldLine.line === newLine) {
                    continue
                }

                updatedBufferState[i] = {
                    tokens: [],
                    ruleStack: null,
                    ...oldLine,
                    line: newLine,
                    dirty: true,
                }

            }

            return updatedBufferState
    }

    return state

}

