import { ASSET_PAIRS as CONFIG_ASSET_PAIRS } from '@/config';

export const ASA_TO_ASA = 'ASA_TO_ASA';
export const ALGOS_TO_ASA = 'ALGOS_TO_ASA';

function InvalidPairType() {
  return new Error('Invalid type of asset pair');
}

function toFixed(num, fixed) {
  return Number((Math.floor(num * Math.pow(10, fixed)) / Math.pow(10, fixed)).toFixed(fixed));
}

export class Asset {
  constructor(params) {
    this.assetName = params['assetName'];
    this.assetIndex = params['assetIndex'];
    this.decimalPoints = params['decimalPoints'];
    this.ratio = 10 ** params['decimalPoints'];
  }

  getRawAssetAmount(displayAmount) {
    return Math.trunc(Number(displayAmount) * this.ratio);
  }

  getAssetDisplayAmount(rawAmount, customDecimals=null) {
    let decimals = this.decimalPoints;
    if (customDecimals) {
      decimals = customDecimals;
    }
    return toFixed((Number(rawAmount) / this.ratio), decimals);
  }
}

export class AssetPair {
  constructor(params, reversedKey) {
    this.primaryAsset = new Asset(params['primaryAsset']);
    this.secondaryAsset = new Asset(params['secondaryAsset']);
    this.liquidityAsset = new Asset(params['liquidityAsset']);
    if (reversedKey) {
      this.key = `${this.secondaryAsset.assetName}/${this.primaryAsset.assetName}`.toUpperCase();
    } else {
      this.key = `${this.primaryAsset.assetName}/${this.secondaryAsset.assetName}`.toUpperCase();
    }
    this.reversedKey = reversedKey;
    this.ratioDecimalPoints = params['ratioDecimalPoints'];
    this.ratio = 10 ** params['ratioDecimalPoints'];
    this.applicationId = params['applicationId'];
    this.muldivAppId = params['muldivAppId'];
    this.escrowAddress = params['escrowAddress'];
    this.compiledEscrow = params['compiledEscrow'];
    this.feePercentage = params['feePercentage'];
    this.type = params['type'];
    if (this.type !== ASA_TO_ASA && this.type !== ALGOS_TO_ASA) {
      throw InvalidPairType();
    }
  }
}

function registerAsset(assets, asset) {
  if (!assets[asset.assetName]) {
    assets[asset.assetName.toUpperCase()] = asset;
  }
}

function fromConfig(assetPairs) {
  let pairClasses = {};
  const assets = {};
  Object.keys(assetPairs).forEach((key) => {
    const assetPair = new AssetPair(CONFIG_ASSET_PAIRS[key], false);
    pairClasses[assetPair.key] = assetPair;
    registerAsset(assets, assetPair.secondaryAsset);
  });
  const singlePairs = Object.assign({}, pairClasses);
  Object.keys(assetPairs).forEach((key) => {
    const assetPair = new AssetPair(CONFIG_ASSET_PAIRS[key], true);
    pairClasses[assetPair.key] = assetPair;
    registerAsset(assets, assetPair.primaryAsset);
  });
  return {
    ASSETS: assets,
    ASSET_PAIRS: pairClasses,
    SINGLE_PAIRS: singlePairs
  };
}

export const { ASSETS, ASSET_PAIRS, SINGLE_PAIRS } = fromConfig(CONFIG_ASSET_PAIRS);
