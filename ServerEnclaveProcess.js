const {MessageDispatcher} = require("./MessageDispatcher");
const ServerEnclave = require("./ServerEnclave");

const openDSU = require("opendsu");
const utils = openDSU.loadAPI("utils");
const ObservableMixin = utils.ObservableMixin;
const scAPI = openDSU.loadAPI("sc");

function ServerEnclaveProcess(didDocument, storageFolder) {
    const enclave = new ServerEnclave(didDocument, storageFolder);
    let didDoc;
    const sc = scAPI.getSecurityContext(enclave);
    ObservableMixin(this);
    sc.on("initialised", () => {
        initMessaging(didDocument);
    })

    const initMessaging = async (didDocument) => {
        this.messageDispatcher = new MessageDispatcher(didDocument)
        this.messageDispatcher.waitForMessages((err, commandObject) => {
            this.execute(err, commandObject);
        });
        this.dispatchEvent("initialised");
    }

    const storeDIDPrivateKeys = (privateKeys) => {
        return Promise.all(privateKeys
            .map(key => {
                return $$.promisify(enclave.addPrivateKeyForDID)(didDoc, key)
            }));
    }

    this.execute = (err, commandObject) => {
        if (err) {
            console.log(err);
            return;
        }
        const clientDID = commandObject.params.pop();
        try {
            const command = commandObject.commandName;
            const params = commandObject.params;
            const callback = (err, res) => {
                const resultObj = {
                    "commandResult": err ? err : res,
                    "commandID": commandObject.commandID
                };
                this.messageDispatcher.sendMessage(JSON.stringify(resultObj), clientDID);
            }
            params.push(callback);
            enclave.name = this.name;
            enclave[command].apply(enclave, params);
        } catch (err) {
            console.log(err);
            return err;
        }
    }

    this.addEnclaveMethod = (methodName, method) => {
        enclave[methodName] = method;
    }
}

module.exports = ServerEnclaveProcess;