const GLOB_LIQ_TOKENS = 'L';
const GLOBAL_A_BAL = 'A';
const GLOBAL_B_BAL = 'B';
const ESCROW_ADDRESS = 'E';
const A_IDX = 'X';
const B_IDX = 'Y';
const LIQ_IDX = 'U';

const USR_A_BAL = '1';
const USR_B_BAL = '2';
const USR_LIQ_TOKENS = 'L';

const SWAP = '1';
const WITHDRAW = 'W';
const SETUP_ESCROW = 'E';
const WITHDRAW_LIQUIDITY = 'X';
const DEPOSIT_LIQUIDITY = 'Y';
const UPDATE = 'U';
const ADD_LIQUIDITY = 'A';
const REMOVE_LIQUIDITY = 'R';

const CALC_ADD_LIQ = 'X';
const CALC_ADD_LIQ_B = 'Y';
const CALC_SWAP_A = '1';
const CALC_SWAP_B = '2';
const CALC_REM_LIQ_A = 'A';
const CALC_REM_LIQ_B = 'B';

const CALC_SLOT_1 = '1';
const CALC_SLOT_2 = '2';

const TRADE_MAX = BigInt(2**53); // maximum trade size and liquidity addition that can be executed on the platform

// eslint-disable-next-line no-undef
module.exports = {
  GLOB_LIQ_TOKENS,
  GLOBAL_A_BAL,
  GLOBAL_B_BAL,
  ESCROW_ADDRESS,
  A_IDX,
  B_IDX,
  LIQ_IDX,
  USR_A_BAL,
  USR_B_BAL,
  USR_LIQ_TOKENS,
  SWAP,
  WITHDRAW,
  SETUP_ESCROW,
  WITHDRAW_LIQUIDITY,
  DEPOSIT_LIQUIDITY,
  UPDATE,
  ADD_LIQUIDITY,
  REMOVE_LIQUIDITY,
  TRADE_MAX,
  CALC_ADD_LIQ,
  CALC_ADD_LIQ_B,
  CALC_SWAP_A,
  CALC_SWAP_B,
  CALC_REM_LIQ_A,
  CALC_REM_LIQ_B,
  CALC_SLOT_1,
  CALC_SLOT_2
};
