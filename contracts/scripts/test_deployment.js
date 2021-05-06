// This script file tests the deployment on the blockchain
// Only the most recent deployment will be tested
// The script will execute a few small trades to check if all aspects of the contract are working
/* globals module, require */

const fs = require('fs');
const { stringToBytes, executeTransaction } = require('@algo-builder/algob');
const { makeLogicSig } = require('algosdk');
const { TransactionType, SignType } = require('@algo-builder/runtime/build/types.js');

const {
  ADD_LIQUIDITY,
  WITHDRAW_LIQUIDITY,
  WITHDRAW,
  DEPOSIT_LIQUIDITY,
  REMOVE_LIQUIDITY,
  SWAP
} = require('../common/constants.js');

const DEPLOYMENT_DIRECTORY = 'artifacts/deployed';
const ALGOS_TO_ASA = 'ALGOS_TO_ASA';
const TRADE_SIZE = 10000; 

// class Params {
//   sender
//   mainAppID
//   muldivAppID
//   escrow
//   secondaryAssetID
//   liquidityTokenID
//   primaryAmount
//   secondaryAmount
// };

function generateAddLiquidityGroup(params) {
  return [
    {
      type: TransactionType.CallNoOpSSC,
      sign: SignType.SecretKey,
      fromAccount: params.sender,
      appId: params.muldivAppID,
      appArgs: [stringToBytes('X'), stringToBytes('1')],
      foreignApps: [params.mainAppID],
      payFlags: { totalFee: 1000 },
    },
    {
      type: TransactionType.CallNoOpSSC,
      sign: SignType.SecretKey,
      fromAccount: params.sender,
      appId: params.muldivAppID,
      appArgs: [stringToBytes('Y'), stringToBytes('2')],
      foreignApps: [params.mainAppID],
      payFlags: { totalFee: 1000 },
    },
    {
      type: TransactionType.CallNoOpSSC,
      sign: SignType.SecretKey,
      fromAccount: params.sender,
      appId: params.mainAppID,
      appArgs: [stringToBytes(ADD_LIQUIDITY)],
      foreignApps: [params.muldivAppID],
      payFlags: { totalFee: 1000 },
    },
    {
      type: TransactionType.TransferAlgo,
      sign: SignType.SecretKey,
      fromAccount: params.sender,
      toAccountAddr: params.escrow.address(),
      amountMicroAlgos: params.primaryAmount,
      payFlags: {
        totalFee: 1000,
      },
    },
    {
      type: TransactionType.TransferAsset,
      assetID: params.secondaryAssetID,
      sign: SignType.SecretKey,
      fromAccount: params.sender,
      toAccountAddr: params.escrow.address(),
      amount: params.secondaryAmount,
      payFlags: {
        totalFee: 1000,
      },
    },
  ];
}

function generateWithdrawLiquidityGroup(params) {
  let appArgs = [stringToBytes(WITHDRAW_LIQUIDITY)];
  // console.log(params.liquidityTokenID);
  return [
    {
      type: TransactionType.CallNoOpSSC,
      sign: SignType.SecretKey,
      fromAccount: params.sender,
      appId: params.mainAppID,
      appArgs: appArgs,
      payFlags: { totalFee: 1000 },
    },
    {
      type: TransactionType.TransferAsset,
      sign: SignType.LogicSignature,
      assetID: params.liquidityTokenID,
      lsig: params.escrow,
      fromAccount: { addr: params.escrow.address() },
      toAccountAddr: params.sender.addr,
      amount: params.amount,
      payFlags: {
        totalFee: 1000,
      },
    },
    {
      type: TransactionType.TransferAlgo,
      sign: SignType.SecretKey,
      fromAccount: params.sender,
      toAccountAddr: params.escrow.address(),
      amountMicroAlgos: 2000,
      payFlags: {
        totalFee: 1000,
      },
    }
  ];
}

function generateWithdrawGroup(params) {
  return [
    {
      type: TransactionType.CallNoOpSSC,
      sign: SignType.SecretKey,
      fromAccount: params.sender,
      appId: params.mainAppID,
      appArgs: [stringToBytes(WITHDRAW)],
      payFlags: { totalFee: 1000 },
    },
    {
      type: TransactionType.TransferAsset,
      assetID: params.secondaryAssetID,
      sign: SignType.LogicSignature,
      lsig: params.escrow,
      fromAccount: { addr: params.escrow.address() },
      toAccountAddr: params.sender.addr,
      amount: params.secondaryAmount,
      payFlags: {
        totalFee: 1000,
      },
    },
    {
      type: TransactionType.TransferAlgo,
      sign: SignType.LogicSignature,
      lsig: params.escrow,
      fromAccount: { addr: params.escrow.address() },
      toAccountAddr: params.sender.addr,
      amountMicroAlgos: params.primaryAmount,
      payFlags: {
        totalFee: 1000,
      },
    },
    {
      type: TransactionType.TransferAlgo,
      sign: SignType.SecretKey,
      fromAccount: params.sender,
      toAccountAddr: params.escrow.address(),
      amountMicroAlgos: 2000,
      payFlags: {
        totalFee: 1000,
      },
    }
  ];
}

function generateDepositLiquidityGroup(params) {
  return [
    {
      type: TransactionType.CallNoOpSSC,
      sign: SignType.SecretKey,
      fromAccount: params.sender,
      appId: params.mainAppID,
      appArgs: [stringToBytes(DEPOSIT_LIQUIDITY)],
      payFlags: {
        totalFee: 1000
      },
    },
    {
      type: TransactionType.TransferAsset,
      assetID: params.liquidityTokenID,
      sign: SignType.SecretKey,
      fromAccount: params.sender,
      toAccountAddr: params.escrow.address(),
      amount: params.amount,
      payFlags: {
        totalFee: 1000,
      },
    }
  ];
}

function generateRemoveLiquidityGroup(params) {
  return [
    {
      type: TransactionType.CallNoOpSSC,
      sign: SignType.SecretKey,
      fromAccount: params.sender,
      appId: params.muldivAppID,
      appArgs: [stringToBytes('A'), stringToBytes('1')],
      foreignApps: [params.mainAppID],
      payFlags: { totalFee: 1000 },
    },
    {
      type: TransactionType.CallNoOpSSC,
      sign: SignType.SecretKey,
      fromAccount: params.sender,
      appId: params.muldivAppID,
      appArgs: [stringToBytes('B'), stringToBytes('2')],
      foreignApps: [params.mainAppID],
      payFlags: { totalFee: 1000 },
    },
    {
      type: TransactionType.CallNoOpSSC,
      sign: SignType.SecretKey,
      fromAccount: params.sender,
      appId: params.mainAppID,
      appArgs: [stringToBytes(REMOVE_LIQUIDITY), `int:${params.amount}`],
      foreignApps: [params.muldivAppID],
      payFlags: { totalFee: 1000 },
    }
  ];
}

function generateSwapPrimaryAssetGroup(params) {
  return [
    {
      type: TransactionType.CallNoOpSSC,
      sign: SignType.SecretKey,
      fromAccount: params.sender,
      appId: params.muldivAppID,
      appArgs: [stringToBytes('1'), stringToBytes('1')],
      foreignApps: [params.mainAppID],
      payFlags: { totalFee: 1000 },
    },
    {
      type: TransactionType.CallNoOpSSC,
      sign: SignType.SecretKey,
      fromAccount: params.sender,
      appId: params.mainAppID,
      appArgs: [stringToBytes(SWAP), `int:${params.minimumExpected}`],
      foreignApps: [params.muldivAppID],
      payFlags: { totalFee: 1000 },
    },
    {
      type: TransactionType.TransferAlgo,
      sign: SignType.SecretKey,
      fromAccount: params.sender,
      toAccountAddr: params.escrow.address(),
      amountMicroAlgos: params.amount,
      payFlags: {
        totalFee: 1000,
      },
    }
  ];
}

function generateSwapSecondaryAssetGroup(params) {
  return [
    {
      type: TransactionType.CallNoOpSSC,
      sign: SignType.SecretKey,
      fromAccount: params.sender,
      appId: params.muldivAppID,
      appArgs: [stringToBytes('2'), stringToBytes('1')],
      foreignApps: [params.mainAppID],
      payFlags: { totalFee: 1000 },
    },
    {
      type: TransactionType.CallNoOpSSC,
      sign: SignType.SecretKey,
      fromAccount: params.sender,
      appId: params.mainAppID,
      appArgs: [stringToBytes(SWAP), `int:${params.minimumExpected}`],
      foreignApps: [params.muldivAppID],
      payFlags: { totalFee: 1000 },
    },
    {
      type: TransactionType.TransferAsset,
      assetID: params.secondaryAssetID,
      sign: SignType.SecretKey,
      fromAccount: params.sender,
      toAccountAddr: params.escrow.address(),
      amount: params.amount,
      payFlags: {
        totalFee: 1000,
      },
    }
  ];
}

async function run (runtimeEnv, deployer) {
  if (!fs.existsSync(DEPLOYMENT_DIRECTORY)) {
    console.log(`Deployment directory doesn't exist "${DEPLOYMENT_DIRECTORY}"`);
    return;
  }
  // find the newest deployment
  const orderedFiles = fs.readdirSync(DEPLOYMENT_DIRECTORY)
    .map(file => DEPLOYMENT_DIRECTORY + '/' + file) // map filename to path to file
    .filter(f => fs.lstatSync(f).isFile())
    .map(file => ({ file, mtime: fs.lstatSync(file).mtime }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  const newestFile = orderedFiles[0].file;
  let deployment = JSON.parse(fs.readFileSync(newestFile).toString('utf-8'));
  if (deployment['type'] != ALGOS_TO_ASA) {
    throw 'Unfortunatelly the test script can only handle ALGOS_TO_ASA contract';
  }
  // convert escrow logic to Uint8Array
  deployment['escrowLogic'] = Uint8Array.from(Buffer.from(deployment['escrowLogic'], 'base64'));
  let escrow = makeLogicSig(Uint8Array.from(deployment['escrowLogic']));

  const masterAccount = deployer.accountsByName.get('master');

  console.log('Opting-in master account to main smart contract');
  try {
    await deployer.optInToSSC(masterAccount, deployment['mainAppID'], { totalFee: 1001 }, {});
  } catch(error) {
    console.log('An error occoured when opting-in, skipping...');
  }

  // Params for the upcoming transactions
  let params = {}; // Params
  params.sender = masterAccount;
  params.escrow = escrow;
  params.mainAppID = deployment['mainAppID'];
  params.muldivAppID = deployment['muldivAppID'];
  params.secondaryAssetID = deployment['secondaryAssetID'];
  params.liquidityTokenID = deployment['liquidityTokenID'];
  params.primaryAmount = TRADE_SIZE;
  params.secondaryAmount = TRADE_SIZE;

  let gtxn = generateAddLiquidityGroup(params);
  console.log('Adding initial liquidity to the contract');
  await executeTransaction(deployer, gtxn);

  params.amount = TRADE_SIZE;
  gtxn = generateWithdrawLiquidityGroup(params);
  console.log('Withdrawing liquidity tokens');
  await executeTransaction(deployer, gtxn);

  params.secondaryAmount = TRADE_SIZE + 10;
  gtxn = generateAddLiquidityGroup(params);
  console.log('Adding a little more liquidity');
  await executeTransaction(deployer, gtxn);

  gtxn = generateWithdrawLiquidityGroup(params);
  console.log('Withdrawing liquidity tokens');
  await executeTransaction(deployer, gtxn);

  params.primaryAmount = 0;
  params.secondaryAmount = 10; // withdraw the extra, unused tokens
  gtxn = generateWithdrawGroup(params);
  console.log('Withdrawing extra tokens');
  await executeTransaction(deployer, gtxn);

  params.amount = TRADE_SIZE;
  gtxn = generateDepositLiquidityGroup(params);
  console.log('Depositing some liquidity tokens');
  await executeTransaction(deployer, gtxn);

  params.amount = TRADE_SIZE;
  gtxn = generateRemoveLiquidityGroup(params);
  console.log('Removing liquidity');
  await executeTransaction(deployer, gtxn);

  params.primaryAmount = TRADE_SIZE;
  params.secondaryAmount = TRADE_SIZE;
  gtxn = generateWithdrawGroup(params);
  console.log('Withdrawing tokens removed from pool');
  await executeTransaction(deployer, gtxn);

  params.amount = 10;
  params.minimumExpected = 9;
  gtxn = generateSwapPrimaryAssetGroup(params);
  console.log('Swapping primary asset');
  await executeTransaction(deployer, gtxn);

  params.amount = 10;
  params.minimumExpected = 9;
  gtxn = generateSwapSecondaryAssetGroup(params);
  console.log('Swapping secondary asset');
  await executeTransaction(deployer, gtxn);
}

module.exports = { default: run };
