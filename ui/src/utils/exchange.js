// MAX_SLIPPAGE is the maximum allowed slippage allowed when executing a trade, this is applied after 
// price impact is calculated.
// This constant could be replaced by a more sophisticated algorithm that would, 
// for example, take liquidity into account
const MAX_SLIPPAGE = 0.005; // 0.5%

export class ExchangeCalculator {
  constructor(globalPrimaryAssetAmount, globalSecondaryAssetAmount, assetPair) {
    this.globalPrimaryAssetAmount = globalPrimaryAssetAmount;
    this.globalSecondaryAssetAmount = globalSecondaryAssetAmount;
    this.assetPair = assetPair;
  }

  getGlobalExchangeRate() {
    if (!this.globalPrimaryAssetAmount || !this.globalSecondaryAssetAmount) {
      return 0;
    }
    return ((this.globalPrimaryAssetAmount * this.assetPair.ratio) / this.globalSecondaryAssetAmount);
  }

  getReverseGlobalExchangeRate() {
    if (!this.globalPrimaryAssetAmount || !this.globalSecondaryAssetAmount) {
      return 0;
    }
    return ((this.globalSecondaryAssetAmount * this.assetPair.ratio) / this.globalPrimaryAssetAmount);
  }

  getSwapExchangeRate(addedAlgos, addedTokens) {
    return (((this.globalPrimaryAssetAmount + addedAlgos) * this.assetPair.ratio) / (this.globalSecondaryAssetAmount + addedTokens));
  }

  getReverseSwapExchangeRate(addedAlgos, addedTokens) {
    return ((this.globalSecondaryAssetAmount + addedTokens) * this.assetPair.ratio / (this.globalPrimaryAssetAmount + addedAlgos));
  }

  secondaryToPrimary(assetAmount) {
    const exchangeRate = this.getSwapExchangeRate(0, assetAmount);
    return Math.trunc((exchangeRate * assetAmount * (100 - this.assetPair.feePercentage)) / (this.assetPair.ratio * 100));
  }

  primaryToSecondary(assetAmount) {
    const exchangeRate = this.getSwapExchangeRate(assetAmount, 0);
    return Math.trunc((assetAmount * (100 - this.assetPair.feePercentage)) * this.assetPair.ratio / 100 / exchangeRate);
  }

  getSecondaryToPrimaryFee(assetAmount) {
    const exchangeRate = this.getSwapExchangeRate(0, assetAmount);
    return (exchangeRate * assetAmount * this.assetPair.feePercentage) / (this.assetPair.ratio * 100);
  }

  getPrimaryToSecondaryFee(assetAmount) {
    const exchangeRate = this.getSwapExchangeRate(assetAmount, 0);
    return (assetAmount * this.assetPair.feePercentage * this.assetPair.ratio) / 100 / exchangeRate;
  }

  reverseSecondaryToPrimary(assetAmount) {
    const value = Math.ceil(
      Math.trunc(-100 * assetAmount * this.globalSecondaryAssetAmount * this.assetPair.ratio) /
      ((100 * assetAmount) + (this.globalPrimaryAssetAmount * (this.assetPair.feePercentage - 100))) /
      this.assetPair.ratio
    );
    if (value < 0) {
      return this.reverseSecondaryToPrimary(
        Math.ceil(
          Math.abs((this.globalPrimaryAssetAmount - 1) * (this.assetPair.feePercentage - 100)) / 100
        )
      );
    }
    return value;
  }

  reversePrimaryToSecondary(assetAmount) {
    const value = Math.ceil(
      Math.trunc((-100 * assetAmount * this.globalPrimaryAssetAmount) * this.assetPair.ratio) /
      ((100 * assetAmount) + (this.globalSecondaryAssetAmount * (this.assetPair.feePercentage - 100))) /
      this.assetPair.ratio
    );
    if (value < 0) {
      return this.reversePrimaryToSecondary(
        Math.ceil(
          Math.abs((this.globalSecondaryAssetAmount - 1) * (this.assetPair.feePercentage - 100)) / 100
        )
      );
    }
    return value;
  }

  allowedSlippage() {
    return MAX_SLIPPAGE;
  }

  minimumReceived(expectedAssetAmount) {
    return Math.trunc(expectedAssetAmount * (1-MAX_SLIPPAGE));
  }
}
