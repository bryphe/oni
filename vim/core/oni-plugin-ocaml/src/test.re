open Oni;

let activate oni: Oni.LanguageClient.t => {
    let config = Oni.configuration oni;
    let startCommand = Oni.Configuration.getValue config "ocaml.langServerCommand" "ocaml-language-server";

    open Oni;

    let startOptions: runOptions = {
        command: startCommand,
        args: ["a", "b"]
    };

    let getInitializationOptions filePath => {
        let opts: initializationOptions = {
            clientName: "ocaml",
            rootPath: filePath
        };
        Js.Promise.resolve opts;
    };

    let client = Oni.createLanguageClient oni startOptions getInitializationOptions;
    client;
};
