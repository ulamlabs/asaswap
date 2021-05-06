# List of possible transaction groups

## Description of main contract arguments
Arguments which are passed as Arg[0]:
| Constant name    | API | Description
| ---------------- |-----| -----------
| UPDATE           | `"U"` | Update escrow address (Save escrow address in main smart contract)
| ADD_LIQUIDITY    | `"A"` | Add liquidity to pool
| REMOVE_LIQUIDITY | `"R"` | Remove liquidity from pool
| SWAP             | `"1"` | Swap
| WITHDRAW         | `"W"` | Withdraw
| SETUP_ESCROW     | `"E"` | Setup escrow (opt-in to traded ASA and liquidity token)
|WITHDRAW_LIQUIDITY| `"X"` | Withdraw liquidity tokens
| DEPOSIT_LIQUIDITY| `"Y"` | Deposit liquidity tokens

## Description of MulDiv64 arguments
Arg[0] - operation:
| Constant name    | API | Description
| ---------------- |-----| -----------
| CALC_ADD_LIQ     | `"X"` | `a/A * LT` (calculate received amount of liquidity tokens when adding liquidity)
| CALC_ADD_LIQ_B   | `"Y"` | `lt'/LT * B` (calculate necessary amount of b token when adding liquidity, `lt'` comes from `X` calculation)
| CALC_SWAP_A      | `"1"` | `B/(A+a) * a` (calculate the amount of secondary token when swapping primary token)
| CALC_SWAP_B      | `"2"` | `A/(B+b) * b` (calculate the amount of primary token when swapping secondary token)
| CALC_REM_LIQ_A   | `"A"` | `lt/LT * A` (calculate the amount of primary token user should receive when removing liquidity)
| CALC_REM_LIQ_B   | `"B"` | `lt/LT * B` (calculate the amount of secondary token user should receive when removing liquidity)

Arg[1] - destination for calculation:
| Constant name    | API | Description
| ---------------- | ----- | -----------
| `CALC_SLOT_1`    | `"1"` | The result will be stored in global schema with key "1"
| `CALC_SLOT_1`    | `"2"` | The result will be stored in global schema with key "2"


**Escrow** doesn't take any arguemts

## Setup
The contracts are deployed with a script available in `scripts/deploy.js`

### Main contract create call
Call specification depends on contract type:
1. Algos to ASA:
    ```javascript
    {
        args: [
            `secondary_token_id`,
            `liquidity_token_id`
        ]
        flags: {
            localInts: 3,
            localBytes: 0,
            globalInts: 5,
            globalBytes: 1
        };
    }
    ```

1. ASA to ASA:
    ```javascript
    {
        args: [
            `secondary_token_id`,
            `primary_token_id`,
            `liquidity_token_id`
        ]
        flags: {
            localInts: 3,
            localBytes: 0,
            globalInts: 6,
            globalBytes: 1
        };
    }
    ```

## Business
### Add liquidity
Group size: 5
1. MulDiv64
    ```javascript
    {
        args: [
            "X",
            "1"
        ],
        foreignApps: [main_contract_id]
    }
    ```

2. MulDiv64
    ```javascript
    {
        args: [
            "Y",
            "2"
        ],
        foreignApps: [main_contract_id]
    }
    ```

3. Main contract
    ```javascript
    {
        args: [
            "A"
        ],
        foreignApps: [muldiv64_contract_id]
    }
    ```

4. Transfer primary asset to escrow
5. Transfer secondary asset to escrow

**NOTE:** The transaction will fail, if there is not enough secondary asset supplied.
When there is too much secondary asset, the extra amount can be withdrawn


### Remove liquidity
Group size: 3
1. MulDiv64
    ```javascript
    {
        args: [
            "A",
            "1"
        ],
        foreignApps: [main_contract_id]
    }
    ```
2. MulDiv64
    ```javascript
    {
        args: [
            "B",
            "2"
        ],
        foreignApps: [main_contract_id]
    }
    ```
3. Main contract
    ```javascript
    {
        args: [
            "R",
            `amount_to_remove`
        ],
        foreignApps: [muldiv64_contract_id]
    }
    ```

### Swap primary asset
Group size: 3
1. MulDiv64
    ```javascript
    {
        args: [
            "1",
            "1"
        ],
        foreignApps: [main_contract_id]
    }
    ```
2. Main contract
    ```javascript
    {
        args: [
            "1",
            `min_amount` // the minimum amount of secondary token, that you want to receive - prevents slippage
        ],
        foreignApps: [muldiv64_contract_id]
    }
    ```
3. Transfer primary asset to escrow

### Swap secondary asset
Group size: 3
1. MulDiv64
    ```javascript
    {
        args: [
            "2",
            "1"
        ],
        foreignApps: [main_contract_id]
    }
    ```
2. Main contract
    ```javascript
    {
        args: [
            "1",
            `min_amount` // the minimum amount of secondary token, that you want to receive - prevents slippage
        ],
        foreignApps: [muldiv64_contract_id]
    }
    ```
3. Transfer secondary asset to escrow

### Withdraw
Group size: 4
1. Main contract
    ```javascript
    {
        args: [
            "W"
        ]
    }
    ```
2. Transfer primary asset out of escrow
    ```javascript
    {
        type: TransferAlgo || TransferAsset, // depending on SWAP type
        ?assetID: PrimaryAssetID, // only include when contract type is ASA to ASA
        amount: `primary_asset_amount`, // must withdraw the entire primary asset balance
        from: `escrowAddress`,
        to: `yourAddress`
    }
    ```
3. Transfer secondary asset out of escrow
    ```javascript
    {
        type: TransferAsset,
        assetID: SecondaryAssetID,
        amount: `secondary_asset_amount`, // must withdraw the entire secondary asset balance
        from: `escrowAddress`,
        to: `yourAddress`
    }
    ```
4. Transfer service fee to escrow
    ```javascript
    {
        type: TransferAlgo,
        amountMicroAlgos: 2000,
        from: `yourAddress`,
        to: `escrowAddress`
    }
    ```

### Withdraw liquidity
Group size: 3
1. Main contract
    ```javascript
    {
        args: [
            "X"
        ]
    }
    ```
2. Transfer liquidity token out of escrow
    ```javascript
    {
        type: TransferAsset, 
        assetID: LiquidityTokenID,
        amount: `liquidity_token_amount`,
        from: `escrowAddress`,
        to: `yourAddress`
    }
    ```
3. Transfer service fee to escrow
    ```javascript
    {
        type: TransferAlgo,
        amountMicroAlgos: 2000,
        from: `yourAddress`,
        to: `escrowAddress`
    }
    ```

### Deposit liquidity
Group size: 3
1. Main contract
    ```javascript
    {
        args: [
            "Y"
        ]
    }
    ```
2. Transfer liquidity token out of escrow
    ```javascript
    {
        type: TransferAsset, 
        assetID: LiquidityTokenID,
        amount: `liquidity_token_amount`,
        from: `yourAddress`,
        to: `escrowAddress`
    }
    ```
3. Transfer service fee to escrow
    ```javascript
    {
        type: TransferAlgo,
        amountMicroAlgos: 2000,
        from: `yourAddress`,
        to: `escrowAddress`
    }
    ```
