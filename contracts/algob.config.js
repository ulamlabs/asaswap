// NOTE: below we provide some example accounts.
// DON'T this account in any working environment because everyone can check it and use
// the private keys (this accounts are visible to everyone).

// NOTE: to be able to execute transactions, you need to use an active account with
// a sufficient ALGO balance.

/**
   Check our /docs/algob-config.md documentation (https://github.com/scale-it/algorand-builder/blob/master/docs/algob-config.md) for more configuration options and ways how to
  load a private keys:
  + using mnemonic
  + using binary secret key
  + using KMD daemon
  + loading from a file
  + loading from an environment variable
  + ...
*/

// ## ACCOUNTS USING mnemonic ##
const { mkAccounts, algodCredentialsFromEnv } = require("@algo-builder/algob");
let accounts = mkAccounts([{
  // This is a test account, it has some algos on the testnet/betanet, don't use on mainnet
  name: "master",
  addr: "VBU276RE4T4H6LIPLMYZDHBIZVSBO35ZGB7CFNH7QQI2UN22ROCGDDXSXM",
  mnemonic: "castle faculty catalog desert movie level arena chaos earn radio victory salute angry juice border shield category coach into vast illness test crazy absorb pass"
}]);

// ## ACCOUNTS loaded from a FILE ##
// const { loadAccountsFromFileSync } = require("@algorand-builder/algob");
// const accFromFile = loadAccountsFromFileSync("assets/accounts_generated.yaml");
// accounts = accounts.concat(accFromFile);



/// ## Enabling KMD access
/// Please check https://github.com/scale-it/algorand-builder/blob/master/docs/algob-config.md#credentials for more details and more methods.

// process.env.$KMD_DATA = "/path_to/KMD_DATA";
// let kmdCred = KMDCredentialsFromEnv();



// ## Algod Credentials
// You can set the credentials directly in this file:

let defaultCfg = {
  host: "http://127.0.0.1",
  port: 8777,
  // Below is a token created through our script in `/infrastructure`
  // If you use other setup, update it accordignly (eg content of algorand-node-data/algod.token)
  token: "6ec1210cab32a71481ff421ae007b0536f4211597e1ed11e0896011129fe75a2",
  accounts: accounts,
  // if you want to load accounts from KMD, you need to add the kmdCfg object. Please read
  // algob-config.md documentation for details.
  // kmdCfg: kmdCfg,
};

// ## Deployed contracts specification
let contract_specs = {
  // Pair name, this will be visible on the blockchain in liquidity token description
  // Pairs must have a slash "/" in the name
  "ALGO/USDG": {
    // exchange type ("ALGOS_TO_ASA" or "ASA_TO_ASA")
    type: "ALGOS_TO_ASA",
    // fee for swaps in basis points
    fee_bps: 30,
    // Setup primary asset only when type is "ASA_TO_ASA"
    // primary_asset_id: 3,
    // secondary asset id is required
    secondary_asset_id: 2,
    // there is only ever need to deploy just one muldiv app. 
    // Put its id here or leave it to 0 to have muldiv app created for you
    muldiv_app_id: 0,
    // totalFee with which each tx will be executed during contract creation
    fee: 1000,
  }
}

// Another example (ASA_TO_ASA)
// Unfortunately multiple contracts cannot be created at once with algo-builder without some dirty hacking
// let contract_specs = {
//   "USDH/USDG": {
//     type: "ASA_TO_ASA",
//     fee_bps: 2,
//     primary_asset_id: 3,
//     secondary_asset_id: 2,
//     muldiv_app_id: 0,
//     fee: 1000,
//   }
// }

// You can also use Environment variables to get Algod credentials
// Please check https://github.com/scale-it/algorand-builder/blob/master/docs/algob-config.md#credentials for more details and more methods.
// Method 1
process.env.ALGOD_ADDR = "127.0.0.1:8080";
process.env.ALGOD_TOKEN = "algod_token";
let algodCred = algodCredentialsFromEnv();


let envCfg = {
 host: algodCred.host,
 port: algodCred.port,
 token: algodCred.token,
 accounts: accounts
}


module.exports = {
  networks: {
    default: defaultCfg,
    prod: envCfg
  },
  contract_specs: contract_specs
};
