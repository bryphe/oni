/**
 * Test script to validate the modified status for buffers.
 */

import * as assert from "assert"
import * as Oni from "oni-api"

import { createNewFile, getElementByClassName, getSelectedTabElement } from "./Common"

export const test = async (oni: Oni.Plugin.Api) => {
    await oni.automation.waitForEditors()

    await createNewFile("js", oni)

    // Check the buffer did not have a modified state by default
    // let tabState = getElementByClassName("tab selected not-dirty")
    const tabState1 = getSelectedTabElement({ dirty: false })

    assert.ok(tabState1, "Check buffer has no modified icon")

    // Next, edit the buffer and check that shows up
    oni.automation.sendKeys("i")
    await oni.automation.waitFor(() => oni.editors.activeEditor.mode === "insert")

    oni.automation.sendKeys("Buffer has been edited.")
    oni.automation.sendKeys("<esc>")

    await oni.automation.waitFor(() => oni.editors.activeEditor.mode === "normal")

    // tabState = getElementByClassName("tab selected is-dirty")
    const tabState2 = getSelectedTabElement({ dirty: true })

    assert.ok(tabState2, "Check buffer now has a modified icon")

    // Finally, swap buffer and swap back to ensure the modified status remains.
    oni.automation.sendKeys(":")
    oni.automation.sendKeys("e buffer2")
    oni.automation.sendKeys("<enter>")

    await oni.automation.waitFor(() => oni.editors.activeEditor.activeBuffer.id === "2")

    oni.automation.sendKeys(":")
    oni.automation.sendKeys("buf 1")
    oni.automation.sendKeys("<enter>")

    await oni.automation.waitFor(() => oni.editors.activeEditor.activeBuffer.id === "1")

    // tabState = getElementByClassName("tab selected is-dirty")
    const tabState3 = getSelectedTabElement({ dirty: true })

    assert.ok(tabState3, "Check buffer still has modified icon after swapping")
}

// Bring in custom config.
export const settings = {
    config: {
        "tabs.mode": "buffers",
    },
}
