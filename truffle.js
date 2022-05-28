var HDWalletProvider = require("truffle-hdwallet-provider");
var mnemonic = "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat";

module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",     // Localhost (default: none)
      port: 7545,
      accounts: 50,        // Standard Ethereum port (default: none)
      network_id: "5777",       // Any network (default: none)
    }
  },
  compilers: {
    solc: {
      version: "^0.5.0"
    }
  }
};