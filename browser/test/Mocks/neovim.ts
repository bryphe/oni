/**
 * Mocks/neovim.ts
 *
 * Implementations of test mocks and doubles,
 * for Neovim facing classes / interfaces.
 */

// import { Event, IEvent } from "oni-types"

import * as Neovim from "./../../src/neovim"

// const noopEvent: IEvent<any> = new Event<any>()

// export class MockNeovimInstance {
//     public get cursorPosition(): Neovim.IPosition {
//         return null
//     }

//     public get quickFix(): Neovim.IQuickFixList {
//         return null
//     }

//     public get onYank(): IEvent<Neovim.INeovimYankInfo> {
//         return noopEvent
//     }

//     public get onShowPopupMenu(): IEvent<Neovim.INeovimCompletionInfo> {
//         return noopEvent
//     }

//     public get onHidePopupMenu(): IEvent<void> {
//         return noopEvent
//     }

//     public get onColorsChanged(): IEvent<void> {
//         return noopEvent
//     }

// }

export class MockScreen implements Neovim.IScreen {

    public backgroundColor: string
    public foregroundColor: string
    public cursorColumn: number = 0
    public cursorRow: number = 0

    private _cells: { [row: number]: { [col: number]: Neovim.ICell }} = { }

    public get currentBackgroundColor(): string {
        return null
    }

    public get currentForegroundColor(): string {
        return null
    }

    public get fontFamily(): null | string {
        return null
    }
    public get fontHeightInPixels(): number {
        return null
    }
    public get fontSize(): null | string {
        return null
    }
    public get fontWidthInPixels(): number {
        return null
    }
    public get height(): number {
        return null
    }
    public get linePaddingInPixels(): number {
        return null
    }
    public get mode(): string {
        return "normal"
    }
    public get width(): number {
        return null
    }

    public dispatch(action: Neovim.IAction): void {
        // tslint:disable-line
    }

    public getCell(x: number, y: number): Neovim.ICell {
        const row = this._cells[y]

        if (!row) {
            return null
        }

        const cell = row[x]
        return cell || null
    }

    public setCell(x: number, y: number, cell: Neovim.ICell): void {
        const row = this._cells[y] || { }

        const updatedRow = {
            ...row,
            [x]: cell,
        }

        this._cells[y] = updatedRow
    }

    public getScrollRegion(): Neovim.IScrollRegion {
        return null
    }
}
