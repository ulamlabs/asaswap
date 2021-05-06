# Deployed Contracts
Deployed contracts can be found in `contracts/artifacts/deployed`.
The structure of the .json files is defined in `contracts/scripts/deploy.js`.
As of now the .json files are structured as follows (example is a testnet USDH/USDG pair):
```javascript
{
    pair: "USDH/USDG",
    type: "ASA_TO_ASA",
    feeBPS: 2,
    secondaryAssetID: 2,
    primaryAssetID: 3
    muldivAppID: 54,
    mainAppID: 53,
    liquidityTokenID: 50,
    escrowAddress: "QS2TBI2WUCKSCS6PUAKHQBMF7O6YFHEC5ZTSWLUET5EX6FKFPRY7HTHB3I",
    escrowLogic: "[base64_encoded]"
  }
```
