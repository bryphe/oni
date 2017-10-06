/**
 * Recorder.ts
 *
 * Manages a variety of recording scenarios, including:
 *  - Take & save screenshot
 *  - Record & save video (.webm)
 */

import * as fs from "fs"
import { desktopCapturer } from "electron"

import * as Log from "./../Log"

declare var MediaRecorder: any

const SECRET_KEY = "oni_secret_key"

// Some of this code was adapted and modified from this stackoverflow post:
// https://stackoverflow.com/questions/36753288/saving-desktopcapturer-to-video-file-in-electron

function toArrayBuffer(blob: any, cb: any) {
    let fileReader = new FileReader();
    fileReader.onload = function() {
        let arrayBuffer = this.result;
        cb(arrayBuffer);
    };
    fileReader.readAsArrayBuffer(blob);
}

function toBuffer(ab: any) {
    let buffer = new Buffer(ab.byteLength);
    let arr = new Uint8Array(ab);
    for (let i = 0; i < arr.byteLength; i++) {
        buffer[i] = arr[i];
    }
    return buffer;
}

class Recorder {
    private _recorder: any = null
    private _blobs: Blob[] = []

    public startRecording(): void {
        var title = document.title;
        document.title = SECRET_KEY;

        desktopCapturer.getSources({ types: ["window", "screen"] }, (error, sources) => {
            if (error) throw error;
            for (let i = 0; i < sources.length; i++) {
                let src = sources[i];
                if (src.name === SECRET_KEY) {
                    document.title = title;

                    navigator["webkitGetUserMedia"]({
                        audio: false,
                        video: {
                            mandatory: {
                                chromeMediaSource: 'desktop',
                                chromeMediaSourceId: src.id,
                                minWidth: 800,
                                maxWidth: screen.availWidth,
                                minHeight: 600,
                                maxHeight: screen.availHeight,
                            }
                        }
                    }, (stream: any) => { this._handleStream(stream) },
                        (err: Error) => { this._handleUserMediaError(err) });
                    return;
                }
            }
        });

    }

    private _handleStream(stream: any) {
        this._recorder = new MediaRecorder(stream)
        this._blobs = []
        this._recorder.ondataavailable = (evt: any) => { this._blobs.push(evt.data) }
        this._recorder.start(100)
    }

    private _handleUserMediaError(err: Error) {
        Log.error(err)
    }

    public stopRecording(): void {
        this._recorder.stop()

        toArrayBuffer(new Blob(this._blobs, {type: "video/webm"}), (ab: any) => {

            const buffer = toBuffer(ab)
            const file = "videos/example.webm"

            if (fs.existsSync(file)) {
                fs.unlinkSync(file)
            }

            fs.writeFileSync(file, buffer)
        })
    }

    public takeScreenshot(): void {

    }
}

export const recorder = new Recorder()
