import { getMappedUserState, getMappedGlobalState, getMappedUserAssets } from './utils/format';
import { ExchangeCalculator } from '@/utils/exchange';
import { ASSET_PAIRS } from '@/utils/assetPairs';
import { GLOBAL_A_BAL, GLOBAL_B_BAL, USR_A_BAL, USR_B_BAL, USR_LIQ_TOKENS } from '@/utils/constants';

export function rawStore(state) {
  return {
    serviceInstance: state.serviceInstance,
    connected: state.connected,
    accounts: state.accounts,
    account: state.account,
    accountData: state.accountData,
    applicationData: state.applicationData,
    pendingAction: state.pendingAction,
    pendingActionMessage: state.pendingActionMessage,
    pendingUpdate: state.pendingUpdate,
    fetchedAccounts: state.fetchedAccounts,
    applicationDataCache: state.applicationDataCache
  };
}

export function userState(state) {
  if (!state.accountData) {
    return {};
  }
  return getMappedUserState(state.accountData, ASSET_PAIRS[state.currentPair].applicationId);
}

export function account(state) {
  return state.account;
}

export function userAssets(state) {
  if (!state.accountData) {
    return {};
  }
  return getMappedUserAssets(state.accountData);
}

export function globalState(state) {
  if (!state.applicationData) {
    return {};
  }
  return getMappedGlobalState(state.applicationData);
}

export function accounts(state) {
  if (!state.accounts) {
    return [];
  }
  return state.accounts.map((value) => {
    return value.address;
  });
}

export function isReady(state) {
  return state.account && state.accountData && state.applicationData;
}

export function isReadyToTransact(state) {
  return state.account && state.accountData && state.applicationData && !state.pendingUpdate;
}

export function isOptedIn(state) {
  if (!state.accountData) {
    return false;
  }
  const accountData = state.accountData;
  const appStates = accountData['apps-local-state'];
  const appIds = appStates.map(value => value.id);
  const applicationId = ASSET_PAIRS[state.currentPair].applicationId;
  return appIds.indexOf(applicationId) !== -1;
}

export function algoBalance(state) {
  if (!state.accountData) {
    return 0;
  }
  const amount = state.accountData['amount-without-pending-rewards'];
  if (!amount) {
    return 0;
  }
  return amount;
}

export function assetBalances(state, getters) {
  if (!state.accountData) {
    return {};
  }
  let balances = {};
  Object.keys(getters.userAssets).forEach((assetIndex) => {
    let userAsset = getters.userAssets[assetIndex];
    balances[assetIndex] = userAsset.amount;
  });
  return balances;
}

export function currentPair(state) {
  return ASSET_PAIRS[state.currentPair];
}

export function exchangeCalculator(state) {
  if (!state.applicationData) {
    return new ExchangeCalculator(0, 0, ASSET_PAIRS[state.currentPair]);
  }
  const globalState = getMappedGlobalState(state.applicationData);
  return new ExchangeCalculator(globalState[GLOBAL_A_BAL], globalState[GLOBAL_B_BAL], ASSET_PAIRS[state.currentPair]);
}

export function hasToWithdrawAssets(state, getters) {
  if (!state.accountData) {
    return false;
  }
  if (getters.userState[USR_A_BAL] > 0 || getters.userState[USR_B_BAL] > 0) {
    return true;
  }
  return getters.userState[USR_LIQ_TOKENS] > 0;
}

export function hasToWithdrawLiquidity(state, getters) {
  if (!state.accountData) {
    return false;
  }
  return getters.userState[USR_LIQ_TOKENS] > 0;
}
