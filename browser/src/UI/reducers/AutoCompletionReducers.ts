/**
 * AutoCompletionReducers.ts
 *
 * Reducers responsible for managing auto-completion UI state
 */

import * as Actions from "./../Actions"
import * as State from "./../State"

import { locatableHigherOrderReducer } from "./LocatableReducer"

const getFilteredEntries = (entries: Oni.Plugin.CompletionInfo[], filterText: string) => {
    return entries.filter((f) => f.label.indexOf(filterText) >= 0)
}

const autoCompletionReducer = (s: State.IAutoCompletionInfo | null, a: Actions.SimpleAction) => {

    if (a.type === "SHOW_AUTO_COMPLETION") {
        return {
            entries: a.payload.entries,
            selectedIndex: 0,
            base: a.payload.base,
            filteredEntries: getFilteredEntries(a.payload.entries, a.payload.base)
        }
    } else if (!s) {
        return s
    }

    // TODO: sync max display items (10) with value in AutoCompletion.render() (AutoCompletion.tsx)
    const currentEntryCount = Math.min(10, s.filteredEntries.length)

    switch (a.type) {
        case "SET_AUTO_COMPLETION_BASE":
            return {
            ...s,
            base: a.payload.base,
            filteredEntries: getFilteredEntries(s.entries, a.payload.base),
        }
        case "NEXT_AUTO_COMPLETION":
            return {...s,
                    selectedIndex: (s.selectedIndex + 1) % currentEntryCount}
        case "PREVIOUS_AUTO_COMPLETION":
            return {...s,
                    selectedIndex: s.selectedIndex > 0 ? s.selectedIndex - 1 : currentEntryCount - 1}
        default:
            return {...s,
                    entries: autoCompletionEntryReducer(s.entries, a)}
    }
}

const autoCompletionEntryReducer = (s: Oni.Plugin.CompletionInfo[], action: Actions.SimpleAction) => {
    switch (action.type) {
        case "SET_AUTO_COMPLETION_DETAILS":
            return s.map((entry) => {
                if (action.payload.detailedEntry && entry.label === action.payload.detailedEntry.label) {
                    return action.payload.detailedEntry
                }
                return entry
            })
        default:
            return s
    }
}

export const autoCompletionReducerWithLocation = locatableHigherOrderReducer(autoCompletionReducer)
