/**
 * WindowManager.ts
 *
 * Responsible for managing state of the editor collection, and
 * switching between active editors.
 *
 * It also provides convenience methods for hooking events
 * to the active editor, and managing transitions between editors.
 */

import * as Oni from "oni-api"
import { Event } from "oni-types"

export * from "./LinearSplitProvider"
export * from "./RelationalSplitProvider"
export * from "./SingleSplitProvider"
export * from "./WindowDock"
export * from "./WindowState"

// TODO: Possible API types?
export type Direction = "up" | "down" | "left" | "right"
export type SplitDirection = "horizontal" | "vertical"

export const getInverseDirection = (direction: Direction): Direction => {
    switch (direction) {
        case "up":
            return "down"
        case "down":
            return "up"
        case "left":
            return "right"
        case "right":
            return "left"
        default:
            return null
    }
}

import { WindowDock } from "./WindowDock"
import { ISplitInfo, SplitOrLeaf } from "./WindowState"

import { WindowManager } from "./WindowManager"

/**
 * Interface for something that can navigate between window splits
 */
export interface IWindowSplitNavigator {
    contains(split: Oni.IWindowSplit): boolean
    move(startSplit: Oni.IWindowSplit, direction: Direction): Oni.IWindowSplit
}

/**
 * Interface for something that can manage window splits:
 * - Navigating splits
 * - Creating a new split
 * - Removing a split
 * Later - resizing a split?
 */
export interface IWindowSplitProvider extends IWindowSplitNavigator {
    split(
        newSplit: Oni.IWindowSplit,
        direction: SplitDirection,
        referenceSplit?: Oni.IWindowSplit,
    ): boolean
    close(split: Oni.IWindowSplit): boolean
    getState(): SplitOrLeaf<Oni.IWindowSplit>
}

export const windowManager = new WindowManager()
