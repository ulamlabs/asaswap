<template>
  <div>
    <WithdrawalModal v-if="hasToWithdrawAssets && !rawStore.pendingAction && !rawStore.pendingUpdate" />
    <Card>
      <div class="py-4 px-8 mt-3">
        <div class="flex flex-col mb-8">
          <h1 class="text-gray-700 font-semibold tracking-wide mb-2">
            Swap
          </h1>
          <p class="text-gray-500 text-base">
            Enter the amount of currency that you would like to swap.
          </p>
        </div>
        <div class="bg-gray-100 rounded-lg mb-4">
          <div class="py-4 px-4">
            <div class="sm:flex sm:flex-row sm:flex-wrap">
              <div class="sm:flex sm:flex-col sm:flex-grow sm:mr-4">
                <NumberInput
                  v-model="firstAmount"
                  :disabled="!exchangeRate || !isFinite(exchangeRate)"
                  @change="onFirstInputChange"
                  @input.native="onFirstInputChange"
                />
              </div>
              <div class="sm:flex sm:flex-col mt-2 sm:mt-0">
                <t-select
                  :value="firstAsset.assetName.toUpperCase()"
                  class="h-full"
                  :options="firstCurrencyOptions"
                  @input="onFirstCurrencyChange"
                />
              </div>
            </div>
          </div>
        </div>
        <div class="flex flex-col justify-center items-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            class="h-4"
          >
            <path
              fillRule="evenodd"
              d="M14.707 12.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l2.293-2.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div class="bg-gray-100 rounded-lg mt-4">
          <div class="py-4 px-4">
            <div class="sm:flex sm:flex-row sm:flex-wrap">
              <div class="sm:flex sm:flex-col sm:flex-grow sm:mr-4">
                <NumberInput
                  v-model="secondAmount"
                  :disabled="!exchangeRate || !isFinite(exchangeRate)"
                  @change="onSecondInputChange(true)"
                  @input.native="onSecondInputChange(false)"
                />
              </div>
              <div class="sm:flex sm:flex-col mt-2 sm:mt-0">
                <t-select
                  :value="secondAsset.assetName.toUpperCase()"
                  class="h-full"
                  :options="secondCurrencyOptions"
                  @input="onSecondCurrencyChange"
                />
              </div>
            </div>
          </div>
        </div>
        <div class="py-4">
          <ActionButton
            label="Swap"
            :execute="onSwap"
            :validate="validate"
            :error="error"
          />
        </div>
      </div>
      <div
        v-if="Object.keys(globalState).length !== 0"
        class="bg-gray-100 rounded-lg"
      >
        <div class="py-4 px-4">
          <div class="flex flex-col">
            <div class="flex sm:flex-row flex-col mt-2 sm:mt-0">
              <div>Exchange rate:</div>
              <div class="sm:text-right flex-grow font-bold">
                {{ exchangeRateDisplay }}
              </div>
            </div>
            <div class="flex sm:flex-row flex-col">
              <div />
              <div class="sm:text-right flex-grow font-bold">
                {{ reverseExchangeRateDisplay }}
              </div>
            </div>
            <div class="flex sm:flex-row flex-col mt-2 sm:mt-0">
              <div>Price impact:</div>
              <div class="sm:text-right flex-grow font-bold">
                {{ priceImpactDisplay }}
              </div>
            </div>
            <div class="flex sm:flex-row flex-col mt-2 sm:mt-0">
              <div>Liquidity fee:</div>
              <div class="sm:text-right flex-grow font-bold">
                {{ feeDisplay }}
              </div>
            </div>
            <div class="flex sm:flex-row flex-col mt-2 sm:mt-0">
              <div>Minimum received:</div>
              <div class="sm:text-right flex-grow font-bold">
                {{ minimumReceivedDisplay }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  </div>
</template>
<script>
import { uniq } from 'lodash';
import { mapGetters } from 'vuex';
import { getInputError } from '@/utils/validation';
import ActionButton from '../ActionButton';
import { ASSET_PAIRS } from '@/utils/assetPairs';
import Card from '@/components/cards/Card';
import NumberInput from '@/components/NumberInput';
import { GLOBAL_LIQ_TOKENS, USR_A_BAL, USR_B_BAL } from '@/utils/constants';
import WithdrawalModal from '@/components/modals/WithdrawalModal';
import { getMappedGlobalState } from '@/store/algorand/utils/format';

export default {
  name: 'SwapCard',
  components: {
    NumberInput,
    ActionButton,
    Card,
    WithdrawalModal
  },
  data() {
    return {
      firstAmount: null,
      secondAmount: null,
      feePercentage: 3,
      error: null,
    };
  },
  computed: {
    ...mapGetters({
      rawStore: 'algorand/rawStore',
      globalState: 'algorand/globalState',
      exchangeCalculator: 'algorand/exchangeCalculator',
      currentPair: 'algorand/currentPair',
      hasToWithdrawAssets: 'algorand/hasToWithdrawAssets',
      account: 'algorand/account',
    }),
    primaryAsset() {
      return this.currentPair.primaryAsset;
    },
    secondaryAsset() {
      return this.currentPair.secondaryAsset;
    },
    firstAsset() {
      return this.currentPair.reversedKey ? this.secondaryAsset : this.primaryAsset;
    },
    secondAsset() {
      return this.currentPair.reversedKey ? this.primaryAsset : this.secondaryAsset;
    },
    filteredPairs() {
      const pairs = Object.keys(ASSET_PAIRS).filter((key) => {
        let pair = ASSET_PAIRS[key];
        let applicationData = this.rawStore.applicationDataCache[pair.applicationId];
        if (!applicationData) {
          return true;
        }
        const globalState = getMappedGlobalState(applicationData);
        return globalState[GLOBAL_LIQ_TOKENS] > 0;
      });
      if (pairs.length === 0) {
        return [this.currentPair.key];
      } else {
        return pairs;
      }
    },
    firstCurrencyOptions() {
      return uniq(this.filteredPairs.map((key) => {
        return key.split('/')[0].toUpperCase();
      }));
    },
    secondCurrencyOptions() {
      let pairs = this.filteredPairs.map((pair) => pair.split('/'));
      pairs = pairs.filter((pair) => {
        return pair[0] === this.firstAsset.assetName.toUpperCase() || pair[1] === this.firstAsset.assetName.toUpperCase();
      });
      return uniq(pairs.map((pair) => pair[1]));
    },
    globalExchangeRate() {
      return this.exchangeCalculator.getGlobalExchangeRate();
    },
    exchangeRate() {
      if (this.currentPair.reversedKey) {
        return this.exchangeCalculator.getSwapExchangeRate(0, this.secondaryAsset.getRawAssetAmount(this.firstAmount));
      } else {
        return this.exchangeCalculator.getSwapExchangeRate(this.primaryAsset.getRawAssetAmount(this.firstAmount), 0);
      }
    },
    reverseExchangeRate() {
      if (this.currentPair.reversedKey) {
        return this.exchangeCalculator.getReverseSwapExchangeRate(0, this.secondaryAsset.getRawAssetAmount(this.firstAmount));
      } else {
        return this.exchangeCalculator.getReverseSwapExchangeRate(this.primaryAsset.getRawAssetAmount(this.firstAmount), 0);
      }
    },
    exchangeRateDisplay() {
      if (!this.exchangeRate || !isFinite(this.exchangeRate)) {
        return 'N/A';
      }
      const value = this.primaryAsset.getAssetDisplayAmount(
        this.secondaryAsset.getRawAssetAmount(this.exchangeRate) / this.currentPair.ratio, this.currentPair.ratioDecimalPoints
      );
      return `${value} ${this.primaryAsset.assetName.toUpperCase()} PER ${this.secondaryAsset.assetName.toUpperCase()}`;
    },
    reverseExchangeRateDisplay() {
      if (!this.reverseExchangeRate || !isFinite(this.reverseExchangeRate)) {
        return 'N/A';
      }
      const value = this.secondaryAsset.getAssetDisplayAmount(
        this.primaryAsset.getRawAssetAmount(this.reverseExchangeRate) / this.currentPair.ratio, this.currentPair.ratioDecimalPoints
      );
      return `${value} ${this.secondaryAsset.assetName.toUpperCase()} PER ${this.primaryAsset.assetName.toUpperCase()}`;
    },
    priceImpact() {
      return Math.trunc(
        (Math.abs(this.exchangeRate - this.globalExchangeRate) *
          this.currentPair.ratio) /
        this.globalExchangeRate
      ) / this.currentPair.ratio;
    },
    priceImpactDisplay() {
      if (!isFinite(this.priceImpact) || !this.firstAmount || !this.secondAmount) {
        return '0 %';
      }
      return (this.priceImpact * 100).toFixed(2) + ' %';
    },
    fee() {
      if (this.currentPair.reversedKey) {
        return this.exchangeCalculator.getSecondaryToPrimaryFee(
          this.secondaryAsset.getRawAssetAmount(this.firstAmount)
        );
      } else {
        return this.exchangeCalculator.getPrimaryToSecondaryFee(this.primaryAsset.getRawAssetAmount(this.firstAmount));
      }
    },
    feeDisplay() {
      let value = 0;
      if (this.fee) {
        value = this.secondAsset.getAssetDisplayAmount(this.fee);
      }
      return `${value} ${this.secondAsset.assetName.toUpperCase()}`;
    },
    minimumReceived() {
      return this.exchangeCalculator.minimumReceived(
        this.secondAsset.getRawAssetAmount(this.secondAmount)
      );
    },
    minimumReceivedDisplay() {
      let minRcv = this.secondAsset.getAssetDisplayAmount(this.minimumReceived);
      let symbol = this.secondAsset.assetName;
      return `${minRcv} ${symbol}`;
    }
  },
  watch: {
    currentPair() {
      this.firstAmount = null;
      this.secondAmount = null;
      this.onFirstInputChange();
    },
    filteredPairs() {
      if (this.filteredPairs.indexOf(this.currentPair.key) === -1 && this.filteredPairs.length > 0) {
        this.$store.dispatch('algorand/SET_CURRENT_PAIR', { pairKey: this.filteredPairs[0] });
      }
    }
  },
  mounted() {
    if (this.filteredPairs.indexOf(this.currentPair.key) === -1 && this.filteredPairs.length > 0) {
      this.$store.dispatch('algorand/SET_CURRENT_PAIR', { pairKey: this.filteredPairs[0] });
    }
  },
  methods: {
    onFirstCurrencyChange(value) {
      const splittedKey = this.currentPair.key.split('/');
      const potentialPair = `${value}/${this.secondAsset.assetName.toUpperCase()}`;
      if (ASSET_PAIRS[potentialPair]) {
        this.$store.dispatch('algorand/SET_CURRENT_PAIR', { pairKey: potentialPair });
      } else if (value === splittedKey[1]) {
        const reversedKey = [splittedKey[1], splittedKey[0]].join('/');
        this.$store.dispatch('algorand/SET_CURRENT_PAIR', { pairKey: reversedKey });
      } else {
        let pairs = Object.keys(ASSET_PAIRS).map((pair) => pair.split('/'));
        pairs = pairs.filter((pair) => {
          return pair[0] === value;
        });
        pairs = pairs.map((pair) => pair[1]);
        const newKey = [value, pairs[0]].join('/');
        this.$store.dispatch('algorand/SET_CURRENT_PAIR', { pairKey: newKey });
      }
      this.firstAmount = null;
      this.secondAmount = null;
      this.onFirstInputChange();
      this.$forceUpdate();
    },
    onSecondCurrencyChange(value) {
      const potentialPair = `${this.firstAsset.assetName.toUpperCase()}/${value}`;
      const splittedKey = this.currentPair.key.split('/');
      if (ASSET_PAIRS[potentialPair]) {
        this.$store.dispatch('algorand/SET_CURRENT_PAIR', { pairKey: potentialPair });
      } else if (value === splittedKey[0]) {
        const reversedKey = [splittedKey[1], splittedKey[0]].join('/');
        this.$store.dispatch('algorand/SET_CURRENT_PAIR', { pairKey: reversedKey });
      } else {
        let pairs = Object.keys(ASSET_PAIRS).map((pair) => pair.split('/'));
        pairs = pairs.filter((pair) => {
          return pair[1] === value;
        });
        pairs = pairs.map((pair) => pair[0]);
        const newKey = [pairs[0], value].join('/');
        this.$store.dispatch('algorand/SET_CURRENT_PAIR', { pairKey: newKey });
      }
      this.firstAmount = null;
      this.secondAmount = null;
      this.onFirstInputChange();
      this.$forceUpdate();
    },
    onFirstInputChange() {
      this.validate();
      if (!this.globalState) {
        return;
      } else if (this.firstAmount === null || this.firstAmount === '') {
        this.secondAmount = null;
        return;
      }
      if (this.currentPair.reversedKey) {
        const rawSecondary = this.secondaryAsset.getRawAssetAmount(this.firstAmount);
        const rawPrimary = this.exchangeCalculator.secondaryToPrimary(rawSecondary);
        this.secondAmount = this.primaryAsset.getAssetDisplayAmount(rawPrimary);
      } else {
        const rawPrimary = this.primaryAsset.getRawAssetAmount(this.firstAmount);
        const rawSecondary = this.exchangeCalculator.primaryToSecondary(rawPrimary);
        this.secondAmount = this.secondaryAsset.getAssetDisplayAmount(rawSecondary);
      }
    },
    onSecondInputChange(recalculate) {
      this.validate();
      if (!this.globalState) {
        return;
      } else if (this.secondAmount === null || this.secondAmount === '') {
        this.firstAmount = null;
        return;
      }
      if (this.currentPair.reversedKey) {
        const rawPrimary = this.primaryAsset.getRawAssetAmount(this.secondAmount);
        const rawSecondary = this.exchangeCalculator.reverseSecondaryToPrimary(rawPrimary);
        this.firstAmount = this.secondaryAsset.getAssetDisplayAmount(rawSecondary);
        const secondAmount = this.primaryAsset.getAssetDisplayAmount(this.exchangeCalculator.secondaryToPrimary(rawPrimary));
        if (recalculate || secondAmount < this.secondAmount) {
          this.secondAmount = secondAmount;
        }
      } else {
        const rawSecondary = this.secondaryAsset.getRawAssetAmount(this.secondAmount);
        const rawPrimary = this.exchangeCalculator.reversePrimaryToSecondary(rawSecondary);
        this.firstAmount = this.primaryAsset.getAssetDisplayAmount(rawPrimary);
        const secondAmount = this.secondaryAsset.getAssetDisplayAmount(
          this.exchangeCalculator.primaryToSecondary(rawPrimary)
        );
        if (recalculate || secondAmount < this.secondAmount) {
          this.secondAmount = secondAmount;
        }
      }
    },
    validate() {
      let error = null;
      error = getInputError(
        this.firstAmount,
        this.firstAsset.decimalPoints,
        this.firstAsset.assetName
      );
      error =
        error ||
        getInputError(this.secondAmount, this.secondAsset.decimalPoints, this.secondAsset.assetName);

      this.error = error;
      this.$forceUpdate();
      return !error;
    },
    async onSwap() {
      console.log(this.currentPair.reversedKey);
      if (this.currentPair.reversedKey) {
        await this.$store.dispatch('algorand/QUEUE_ASSET_OPT_IN', {
          assetIds: [this.primaryAsset.assetIndex]
        });
        const amount = this.secondaryAsset.getRawAssetAmount(this.firstAmount);
        await this.$store.dispatch('algorand/QUEUE_ACTION', {
          actionMethod: async () =>
            await this.rawStore.serviceInstance.swapSecondary(
              this.account,
              amount,
              this.minimumReceived
            ),
          actionMessage: 'Swapping...',
          actionVerificationMethod: ({ prevState, newState }) => {
            return Number(prevState[USR_A_BAL]) !== (newState[USR_A_BAL]) || Number(prevState[USR_B_BAL]) !== (newState[USR_B_BAL]);
          }
        });
        await this.$store.dispatch('algorand/QUEUE_ACTION', {
          actionMethod: async () => {
            await this.$store.dispatch('algorand/WITHDRAW');
          },
          actionMessage: 'Withdrawing...'
        });
      } else {
        await this.$store.dispatch('algorand/QUEUE_ASSET_OPT_IN', {
          assetIds: [this.secondaryAsset.assetIndex]
        });
        const amount = this.primaryAsset.getRawAssetAmount(this.firstAmount);
        await this.$store.dispatch('algorand/QUEUE_ACTION', {
          actionMethod: async () =>
            await this.rawStore.serviceInstance.swapPrimary(
              this.account,
              amount,
              this.minimumReceived
            ),
          actionMessage: 'Swapping...',
          actionVerificationMethod: ({ prevState, newState }) => {
            return Number(prevState[USR_A_BAL]) !== (newState[USR_A_BAL]) || Number(prevState[USR_B_BAL]) !== (newState[USR_B_BAL]);
          }
        });
        await this.$store.dispatch('algorand/QUEUE_ACTION', {
          actionMethod: async () => {
            await this.$store.dispatch('algorand/WITHDRAW');
          },
          actionMessage: 'Withdrawing...'
        });
      }
      this.firstAmount = null;
      this.secondAmount = null;
    },
  },
};
</script>
