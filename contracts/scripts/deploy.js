// Original file: https://github.com/scale-it/algorand-builder/blob/master/examples/crowdfunding/scripts/createApp.js
/* globals module, require */

const { SETUP_ESCROW, UPDATE } = require('../common/constants.js');

const { stringToBytes } = require('@algo-builder/algob');
const { executeTransaction } = require('@algo-builder/algob');
const { TransactionType, SignType } = require('@algo-builder/runtime/build/types.js');
const fs = require('fs');

const ALGOS_TO_ASA = 'ALGOS_TO_ASA';
const ASA_TO_ASA = 'ASA_TO_ASA';
const LIQUIDITY_TOKEN_TOTAL = 2n**64n - 1n; // must be the same as in asa.yaml
const DEPLOYMENT_DIRECTORY = 'artifacts/deployed';

// Only checks if fields are present and have a correct type
function validateSpecifications(specs) {
  // Make sure ther is at least one spec provided
  if (Object.entries(specs).length == 0)
    throw 'Specifications for contracts must be provided';

  function assertNumber(specName, fieldName, value) {
    if (typeof (value) != typeof (30)) {
      throw new Error(`${fieldName} in contract specification "${specName}" must exist and be of type Number`);
    }
  }

  for (let specName in specs) {
    if (specName.split('/').length != 2) {
      throw new Error(`Contract specification "${specName}" must contain exactly one slash "/"`);
    }
    const spec = specs[specName];
    assertNumber(specName, 'fee_bps',            spec['fee_bps']);
    assertNumber(specName, 'secondary_asset_id', spec['secondary_asset_id']);
    assertNumber(specName, 'fee',                spec['fee']);
    assertNumber(specName, 'muldiv_app_id',      spec['muldiv_app_id']);
    if (spec['type'] == ASA_TO_ASA) {
      assertNumber(specName, 'primary_asset_id', spec['primary_asset_id']);
    }
  }
}

function createLiquidityToken(deployer, masterAccount, totalFee, specName) {
  // At this moment asa.yaml needs to be edited manually
  const liquidityTokenNote = `ASASwap Liquidity Token for ${specName}. Make sure to verify its authenticity.`;
  const tradedTokens = specName.split('/');
  const liquidityTokenUnit = `${tradedTokens[0][0]}${tradedTokens[1][0]}_LIQ`;
  // Ugly hack to create multiple liquidity tokens from the same template
  return deployer.deployASA('liquidity_token', {
    creator: masterAccount,
    manager: masterAccount,
    reserve: masterAccount,
    freeze: masterAccount,
    clawback: masterAccount,
    note: liquidityTokenNote,
    unitName: liquidityTokenUnit,
    totalFee: totalFee
  }); // return type: Promise<ASAInfo>
}

async function deployMulDiv64(deployer, masterAccount, totalFee) {
  await deployer.ensureCompiled('muldiv64.py', true, {});
  const md64res = await deployer.deploySSC(
    'muldiv64.py',
    'empty_clear.py',
    {
      sender: masterAccount,
      localInts: 0,
      localBytes: 0,
      globalInts: 2,
      globalBytes: 0,
      appArgs: []
    },
    {
      totalFee: totalFee
    },
    {}
  );
  return md64res;  // type: SSCInfo
}

async function deployMainContract(deployer, masterAccount, totalFee, deploySpec, liquidityTokenID) {
  // Initialize app arguments
  let appArgs;
  if (deploySpec['type'] === ALGOS_TO_ASA) {
    appArgs = [
      `int:${deploySpec['secondary_asset_id']}`,
      `int:${liquidityTokenID}`
    ];
  } else {
    appArgs = [
      `int:${deploySpec['secondary_asset_id']}`,
      `int:${deploySpec['primary_asset_id']}`,
      `int:${liquidityTokenID}`
    ];
  }

  // Parameters the app will be created with
  let appParams = {
    type: deploySpec['type'],
    fee_bps: deploySpec['fee_bps'],
    muldiv_app_id: deploySpec['muldiv_app_id']
  };

  // Create Application
  // Note: An Account can have maximum of 10 Applications.
  await deployer.ensureCompiled('state.py', true, appParams);
  const res = await deployer.deploySSC(
    'state.py', // approval program
    'clear.py', // clear program
    {
      sender: masterAccount,
      localInts: 3,
      localBytes: 0,
      globalInts: deploySpec['type'] === ALGOS_TO_ASA ? 5 : 6,
      globalBytes: 1,
      appArgs: appArgs
    },
    {
      totalFee: totalFee,
    },
    {
      type: deploySpec['type'],
      fee_bps: deploySpec['fee_bps'],
      muldiv_app_id: deploySpec['muldiv_app_id']
    }
  );
  return res;  // type: SSCInfo
}

function saveDeployment(specName, spec, liquidityTokenID, mainID, escrowAccount) {
  const fileName = specName.replaceAll('/', '_') + '_' + mainID.toString() + '.json';
  const data = {
    pair: specName,
    type: spec['type'],
    feeBPS: spec['fee_bps'],
    secondaryAssetID: spec['secondary_asset_id'],
    primaryAssetID: spec['primary_asset_id'],
    muldivAppID: spec['muldiv_app_id'],
    mainAppID: mainID,
    liquidityTokenID: liquidityTokenID,
    escrowAddress: escrowAccount.address(),
    escrowLogic: Buffer.from(escrowAccount.logic).toString('base64')
  };
  if (!fs.existsSync(DEPLOYMENT_DIRECTORY)) {
    fs.mkdirSync(DEPLOYMENT_DIRECTORY);
  }
  const dataStr = JSON.stringify(data, null, 2);
  fs.writeFileSync(DEPLOYMENT_DIRECTORY + '/' + fileName, dataStr);
}

async function run (runtimeEnv, deployer) {
  let specifications = runtimeEnv.config.contract_specs;
  validateSpecifications(specifications);

  const masterAccount = deployer.accountsByName.get('master');
  let savedMuldivID = 0; // remembers the ID of previously created MulDiv contract

  // create all specified contracts, currently for loop serves no purpose due to limitations of algo-builder
  for (let specName in specifications) {
    let spec = specifications[specName];
    const totalFee = spec['fee'];
    const contractType = spec['type'];
    const secondaryAssetID = spec['secondary_asset_id'];
    const primaryAssetID = spec['primary_asset_id'];

    //// Create liquidity token on the blockchain
    const liquidityTokenInfo = await createLiquidityToken(deployer, masterAccount, totalFee, specName);
    const liquidityTokenID = liquidityTokenInfo.assetIndex;
    console.log('Deployed Liquidity Token: ', liquidityTokenInfo);

    //// Create MulDiv64 contract
    // only create new muldiv if user hasn't specified its ID one hasn't been created already
    if (spec['muldiv_app_id'] == 0 && savedMuldivID == 0) {
      const md64res = await deployMulDiv64(deployer, masterAccount);
      savedMuldivID = md64res.appID;
      console.log(`Created MulDiv64 contract with ID: ${md64res.appID}`);
    } else {
      console.log('MulDiv64 contract already exists, skipping deployment...');
    }
    // save MulDiv64 contract id to use with main contract
    if (spec['muldiv_app_id'] == 0) {
      spec['muldiv_app_id'] = savedMuldivID;
    }

    //// Create Main contract
    const mainRes = await deployMainContract(deployer, masterAccount, totalFee, spec, liquidityTokenID);
    const mainID = mainRes.appID;
    console.log(`Created Main contract with ID: ${mainID}`);

    //// Get escrow account address
    const escrowAccount = await deployer.loadLogic('escrow.py', [], { app_id: mainID });
    console.log('Escrow Account Address:', escrowAccount.address());

    // Send funds for minimum escrow balance
    const algoTxnParams = {
      type: TransactionType.TransferAlgo,
      sign: SignType.SecretKey,
      fromAccount: masterAccount,
      toAccountAddr: escrowAccount.address(),
      amountMicroAlgos: contractType === ALGOS_TO_ASA ? 302000 : 405000,
      payFlags: { totalFee: totalFee }
    };
    await executeTransaction(deployer, algoTxnParams);

    console.log('Opting-In For Escrow');
    console.log('- Opting-in to secondary asset');
    let txnParams = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: masterAccount,
        appId: mainID,
        appArgs: [stringToBytes(SETUP_ESCROW)],
        payFlags: { totalFee: totalFee }
      },
      {
        type: TransactionType.TransferAsset,
        sign: SignType.LogicSignature,
        fromAccount: { addr: escrowAccount.address() },
        toAccountAddr: escrowAccount.address(),
        lsig: escrowAccount,
        amount: 0,
        assetID: secondaryAssetID,
        payFlags: { totalFee: totalFee }
      }
    ];
    await executeTransaction(deployer, txnParams);

    if (contractType === ASA_TO_ASA) {
      console.log('- Opting-in to primary asset');
      txnParams = [
        {
          type: TransactionType.CallNoOpSSC,
          sign: SignType.SecretKey,
          fromAccount: masterAccount,
          appId: mainID,
          appArgs: [stringToBytes(SETUP_ESCROW)],
          payFlags: { totalFee: totalFee }
        },
        {
          type: TransactionType.TransferAsset,
          sign: SignType.LogicSignature,
          fromAccount: { addr: escrowAccount.address() },
          toAccountAddr: escrowAccount.address(),
          lsig: escrowAccount,
          amount: 0,
          assetID: primaryAssetID,
          payFlags: { totalFee: totalFee }
        }
      ];
      await executeTransaction(deployer, txnParams);
    }

    console.log('- Opting-in to liquidity token');
    txnParams = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: masterAccount,
        appId: mainID,
        appArgs: [stringToBytes(SETUP_ESCROW)],
        payFlags: { totalFee: totalFee }
      },
      {
        type: TransactionType.TransferAsset,
        sign: SignType.LogicSignature,
        fromAccount: { addr: escrowAccount.address() },
        toAccountAddr: escrowAccount.address(),
        lsig: escrowAccount,
        amount: 0,
        assetID: liquidityTokenID,
        payFlags: { totalFee: totalFee }
      }
    ];
    await executeTransaction(deployer, txnParams);

    console.log('Sending all liquidity tokens to escrow');
    txnParams = [
      {
        type: TransactionType.TransferAsset,
        sign: SignType.SecretKey,
        fromAccount: masterAccount,
        toAccountAddr: escrowAccount.address(),
        amount: LIQUIDITY_TOKEN_TOTAL,
        assetID: liquidityTokenID,
        payFlags: { totalFee: totalFee }
      }
    ];
    await executeTransaction(deployer, txnParams);

    console.log('Updating Liquidity Token');
    const assetModFields = {
      manager: escrowAccount.address(),
      reserve: escrowAccount.address(),
      freeze: escrowAccount.address(),
      clawback: escrowAccount.address()
    };
    const assetConfigParams = {
      type: TransactionType.ModifyAsset,
      sign: SignType.SecretKey,
      fromAccount: masterAccount,
      assetID: liquidityTokenInfo.assetIndex,
      fields: assetModFields,
      payFlags: { totalFee: totalFee }
    };
    await executeTransaction(deployer, assetConfigParams);

    console.log('Linking main contract with escrow');
    await executeTransaction(
      deployer,
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: masterAccount,
        appId: mainID,
        appArgs: [stringToBytes(UPDATE)],
        accounts: [escrowAccount.address()],
        payFlags: { totalFee: totalFee }
      }
    );
    console.log('Saving deployment');
    saveDeployment(specName, spec, liquidityTokenID, mainID, escrowAccount);
  } // for
} // run

module.exports = { default: run };
