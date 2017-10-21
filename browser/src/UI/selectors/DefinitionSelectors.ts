/**
 * DefinitionSelectors
 */

import { createSelector } from "reselect"

import * as Selectors from "./../Selectors"
import { IState } from "./../State"

import { isInRange } from "./../../Utility"

const getDefinitionRaw = (state: IState) => state.definition

export const getActiveDefinition = createSelector(
    [Selectors.getActiveWindow, getDefinitionRaw],
    (win, definition) => {

        if (!win || !definition || !definition.data) {
            return null
        }

        const { token } = definition.data
        const { file, line, column } = win

        if (definition.filePath !== file) {
            return null
        }

        if (!isInRange(line, column, token.range)) {
            return null
        }

        return definition.data
    })
