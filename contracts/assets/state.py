import sys
from enum import Enum
from typing import Union

# pylint: disable=unused-wildcard-import
from pyteal import *

# pylint: disable=import-error
from helpers.state import GlobalState, LocalState, get_global_state_ex
from helpers.parse import parse_args


class ExchangeType:
    ALGOS_TO_ASA = "ALGOS_TO_ASA"
    ASA_TO_ASA = "ASA_TO_ASA"


class AlgosToAsaContract:
    def __init__(self, fee_bps: int, muldiv_app_id: int):
        self.fee_divisor = 10000 // fee_bps
        self.type = type
        self.muldiv_app_id = muldiv_app_id
        self.setup_globals()
        self.setup_locals()

    def setup_globals(self):
        self.total_liquidity_tokens = GlobalState("L")  # uint64
        self.a_balance = GlobalState("A")  # uint64
        self.b_balance = GlobalState("B")  # uint64
        self.escrow_addr = GlobalState("E")  # bytes
        self.b_idx = GlobalState("Y")  # uint64
        self.liq_idx = GlobalState("U")  # uint64
        # External globals
        self.muldiv_result_1 = get_global_state_ex(1, "1")  # type: MaybeValue
        self.muldiv_result_2 = get_global_state_ex(1, "2")  # type: MaybeValue

    def setup_locals(self):
        self.a_to_withdraw = LocalState("1")  # uint64
        self.b_to_withdraw = LocalState("2")  # uint64
        self.user_liquidity_tokens = LocalState("L")  # uint64

    def get_contract(self):
        return Cond(
            [Txn.application_id() == Int(0), self.on_create()],
            [Txn.rekey_to() != Global.zero_address(), Err()],
            [Txn.on_completion() == OnComplete.OptIn, self.on_register()],
            [Txn.on_completion() == OnComplete.CloseOut, self.on_closeout()],
            [Txn.on_completion() != OnComplete.NoOp, Err()], # disallow any other on-complete options
            [Txn.application_args[0] == Bytes("U"), self.on_update()],
            [Txn.application_args[0] == Bytes("W"), self.on_withdraw()],
            [Txn.application_args[0] == Bytes("E"), self.setup_escrow()],
            [Txn.application_args[0] == Bytes("X"), self.on_withdraw_liquidity()],
            [Txn.application_args[0] == Bytes("Y"), self.on_deposit_liquidity()],
            # calls that use values from muldiv smart contract
            # This check prevents using external values from anything but muldiv_contract
            [Txn.applications[1] != Int(self.muldiv_app_id), Err()],
            [Txn.application_args[0] == Bytes("A"), self.on_add_liquidity()],
            [Txn.application_args[0] == Bytes("R"), self.on_remove_liquidity()],
            [Txn.application_args[0] == Bytes("1"), self.on_swap()],
        )

    def get_incoming_amount_for_primary_asset(self, tx) -> Expr:
        return tx.amount()

    def validate_incoming_tx_for_primary_asset(self, tx):
        return And(
            tx.type_enum() == TxnType.Payment,
            tx.receiver() == self.escrow_addr.get(),
        )

    def on_create(self):
        return Seq(
            [
                self.b_idx.put(Btoi(Txn.application_args[0])),
                self.liq_idx.put(Btoi(Txn.application_args[1])),
                Return(Int(1)),
            ]
        )

    def on_register(self):
        return Seq(
            [
                # Set default values for user
                self.b_to_withdraw.put(Int(0)),
                self.a_to_withdraw.put(Int(0)),
                self.user_liquidity_tokens.put(Int(0)),
                Return(Int(1)),
            ]
        )

    def on_closeout(self):
        return Seq([
            Assert(
                And(
                    self.b_to_withdraw.get() == Int(0),
                    self.a_to_withdraw.get() == Int(0),
                    self.user_liquidity_tokens.get() == Int(0),
                )
            ),
            Return(Int(1)),
        ])

    def on_update(self):
        return Seq(
            [
                # Update escrow address after creating it
                Assert(
                    And(
                        Txn.sender() == Global.creator_address(),
                        self.escrow_addr.get() == Int(0),
                    )
                ),
                self.escrow_addr.put(Txn.accounts[1]),
                Return(Int(1)),
            ]
        )

    def on_add_liquidity(self):
        calculated_lt = self.muldiv_result_1  # how many liquidity tokens user shall receive
        calculated_b = self.muldiv_result_2  # how many secondary tokens user must provide 
        return Seq(
            [
                Assert(
                    And(
                        Global.group_size() == Int(5),
                        # validate muldiv operations
                        self.validate_muldiv_call(Gtxn[0], "X", "1"),
                        self.validate_muldiv_call(Gtxn[1], "Y", "2"),
                        # verify primary asset transfer
                        self.validate_incoming_tx_for_primary_asset(Gtxn[3]),
                        # verify secondary asset transfer
                        Gtxn[4].type_enum() == TxnType.AssetTransfer,
                        Gtxn[4].asset_receiver() == self.escrow_addr.get(),
                        Gtxn[4].xfer_asset() == self.b_idx.get(),
                    )
                ),
                If(
                    self.total_liquidity_tokens.get() == Int(0),
                    # Handle case when zero liquidity is in the pool
                    Seq([ 
                        self.a_balance.put(self.get_incoming_amount_for_primary_asset(Gtxn[3])),
                        self.b_balance.put(Gtxn[4].asset_amount()),
                        self.user_liquidity_tokens.put(
                            self.get_incoming_amount_for_primary_asset(Gtxn[3])
                        ),
                        self.total_liquidity_tokens.put(
                            self.get_incoming_amount_for_primary_asset(Gtxn[3])
                        ),
                    ]),
                    # Handle case when some liquidity is already present
                    Seq([
                        # eval foreign values
                        calculated_b, 
                        calculated_lt,
                        # make sure that user provided enough secondary tokens, adequate to current exchange rate
                        Assert(calculated_b.value() <= Gtxn[4].asset_amount()),
                        self.a_balance.put(
                            self.a_balance.get()
                            + self.get_incoming_amount_for_primary_asset(Gtxn[3])
                        ),
                        self.b_balance.put(
                            self.b_balance.get()
                            + calculated_b.value()
                        ),
                        self.user_liquidity_tokens.put(
                            self.user_liquidity_tokens.get()
                            + calculated_lt.value()
                        ),
                        self.total_liquidity_tokens.put(
                            self.total_liquidity_tokens.get()
                            + calculated_lt.value()
                        ),
                        # if user provided too many secondary tokens, let them refund them
                        self.b_to_withdraw.put(
                            self.b_to_withdraw.get()
                            + (
                                Gtxn[4].asset_amount() 
                                - calculated_b.value()
                            )
                        )
                    ])
                ),
                Return(Int(1)),
            ]
        )

    def on_remove_liquidity(self):
        a_calc = self.muldiv_result_1
        b_calc = self.muldiv_result_2
        return Seq(
            [
                Assert(
                    And(
                        Global.group_size() == Int(3),
                        # Validate muldiv calls
                        self.validate_muldiv_call(Gtxn[0], "A", "1"),
                        self.validate_muldiv_call(Gtxn[1], "B", "2"),
                        # Check if user has enough balance
                        self.user_liquidity_tokens.get() >= Btoi(Txn.application_args[1]),
                    )
                ),
                # eval foreign values
                a_calc,
                b_calc,
                self.a_to_withdraw.put(
                    self.a_to_withdraw.get()
                    + a_calc.value()
                ),
                self.b_to_withdraw.put(
                    self.b_to_withdraw.get()
                    + b_calc.value()
                ),
                self.user_liquidity_tokens.put(
                    self.user_liquidity_tokens.get() - Btoi(Txn.application_args[1])
                ),
                self.total_liquidity_tokens.put(
                    self.total_liquidity_tokens.get() - Btoi(Txn.application_args[1])
                ),
                self.a_balance.put(self.a_balance.get() - a_calc.value()),
                self.b_balance.put(self.b_balance.get() - b_calc.value()),
                Return(Int(1)),
            ]
        )

    def on_withdraw_liquidity(self):
        return Seq(
            [
                Assert(
                    And(
                        Global.group_size() == Int(3),
                        Gtxn[1].xfer_asset() == self.liq_idx.get(),
                        self.user_liquidity_tokens.get() >= Gtxn[1].asset_amount(),
                        Gtxn[1].sender() == self.escrow_addr.get(),
                        Gtxn[2].receiver() == self.escrow_addr.get(),
                    )
                ),
                self.user_liquidity_tokens.put(
                    self.user_liquidity_tokens.get() - Gtxn[1].asset_amount()
                ),
                Return(Int(1)),
            ]
        )

    def on_deposit_liquidity(self):
        return Seq(
            [
                Assert(
                    And(
                        Global.group_size() == Int(2),
                        Gtxn[1].type_enum() == TxnType.AssetTransfer,
                        Gtxn[1].xfer_asset() == self.liq_idx.get(),
                        Gtxn[1].asset_receiver() == self.escrow_addr.get(),
                    )
                ),
                self.user_liquidity_tokens.put(
                    self.user_liquidity_tokens.get() + Gtxn[1].asset_amount()
                ),
                Return(Int(1)),
            ]
        )

    def on_swap(self):
        # how much secondary token user shall receive after the swap
        received_amount = self.muldiv_result_1
        expected_minimum = Btoi(Txn.application_args[1])
        received_after_fee = ScratchSlot()
        expected_muldiv_mode = ScratchSlot()
        return Seq([
            # eval foreign value
            received_amount,
            # set expected mode
            If(
                And(
                    Gtxn[2].type_enum() == TxnType.AssetTransfer,
                    Gtxn[2].xfer_asset() == self.b_idx.get(),
                    Gtxn[2].asset_receiver() == self.escrow_addr.get(),
                ),
                expected_muldiv_mode.store(Bytes("2")),
                expected_muldiv_mode.store(Bytes("1"))
            ),
            # common assertions
            Assert(
                And(
                    Global.group_size() == Int(3),
                    # validate muldiv call
                    self.validate_muldiv_call(Gtxn[0], expected_muldiv_mode.load(), "1"),
                )
            ),
            received_after_fee.store(
                received_amount.value()
                - (
                    received_amount.value()
                    / Int(self.fee_divisor)
                )
            ),
            # make sure the user receives at least the expected amount
            # The substraction will cause panic when expected_minimum > received_amount
            # This is to make it easier to tell what happened when contract executes
            Pop(received_after_fee.load() - expected_minimum),
            If (
                expected_muldiv_mode.load() == Bytes("2"),
                # swap secondary asset
                Seq([
                    # no need to asset if Gtxn[2] transfers secondary asset
                    self.a_to_withdraw.put(
                        self.a_to_withdraw.get()
                        + received_after_fee.load()),
                    self.a_balance.put(
                        self.a_balance.get()
                        - received_after_fee.load()
                    ),
                    self.b_balance.put(
                        self.b_balance.get()
                        + Gtxn[2].asset_amount()
                    )
                ]),
                # swap primary asset
                Seq([
                    Assert(self.validate_incoming_tx_for_primary_asset(Gtxn[2])),
                    self.b_to_withdraw.put(
                        self.b_to_withdraw.get()
                        + received_after_fee.load()
                    ),
                    self.b_balance.put(
                        self.b_balance.get()
                        - received_after_fee.load()
                    ),
                    self.a_balance.put(
                        self.a_balance.get()
                        + self.get_incoming_amount_for_primary_asset(Gtxn[2])
                    )
                ])
            ),
            Return(Int(1))
        ])

    def on_withdraw(self):
        return Seq(
            [
                Assert(
                    And(
                        Global.group_size() == Int(4),
                        Gtxn[1].asset_amount() == self.b_to_withdraw.get(),
                        Gtxn[1].sender() == self.escrow_addr.get(),
                        Gtxn[1].xfer_asset() == self.b_idx.get(),
                        self.verify_outgoing_tx_for_primary_asset(Gtxn[2]),
                        self.get_outgoing_amount_for_primary_asset(Gtxn[2])
                        == self.a_to_withdraw.get(),
                        Gtxn[3].receiver() == self.escrow_addr.get(),
                    )
                ),
                self.b_to_withdraw.put(Int(0)),
                self.a_to_withdraw.put(Int(0)),
                Return(Int(1)),
            ]
        )

    def verify_outgoing_tx_for_primary_asset(self, tx):
        return And(
            tx.type_enum() == TxnType.Payment,
            tx.sender() == self.escrow_addr.get(),
        )

    def validate_muldiv_call(
        self, 
        tx: TxnObject, 
        expected_mode: Union[str, Expr], 
        expected_dest: Union[str, Expr]
    ) -> Expr:
        if isinstance(expected_mode, str):
            expected_mode = Bytes(expected_mode)
        if isinstance(expected_dest, str):
            expected_dest = Bytes(expected_dest)
        return And(
            # check if correct parameters were passed to muldiv
            tx.application_args[0] == expected_mode,
            tx.application_args[1] == expected_dest,
            tx.type_enum() == TxnType.ApplicationCall,
            # check if the muldiv contract was actually called
            tx.application_id() == Int(self.muldiv_app_id),
            # make sure that this application is provided as a foreign app to muldiv
            tx.applications[1] == Global.current_application_id(),
        )

    def get_outgoing_amount_for_primary_asset(self, tx) -> Expr:
        return tx.amount()

    def setup_escrow(self):
        return Seq(
            [
                Assert(
                    And(
                        Gtxn[0].sender() == Global.creator_address(),
                        self.escrow_addr.get() == Int(0),
                    )
                ),
                Return(Int(1)),
            ]
        )


class AsaToAsaContract(AlgosToAsaContract):
    def __init__(self, fee_bps: int, muldiv_app_id: int):
        super().__init__(fee_bps, muldiv_app_id)
        self.a_idx = GlobalState("X")  # uint64

    def get_incoming_amount_for_primary_asset(self, tx) -> Expr:
        return tx.asset_amount()

    def validate_incoming_tx_for_primary_asset(self, tx):
        return And(
            tx.type_enum() == TxnType.AssetTransfer,
            tx.xfer_asset() == self.a_idx.get(),
            tx.asset_receiver() == self.escrow_addr.get(),
        )

    def verify_outgoing_tx_for_primary_asset(self, tx):
        return And(
            tx.type_enum() == TxnType.AssetTransfer,
            tx.xfer_asset() == self.a_idx.get(),
            tx.sender() == self.escrow_addr.get(),
        )

    def get_outgoing_amount_for_primary_asset(self, tx) -> Expr:
        return tx.asset_amount()

    def on_create(self):
        return Seq(
            [
                self.b_idx.put(Btoi(Txn.application_args[0])),
                self.a_idx.put(Btoi(Txn.application_args[1])),
                self.liq_idx.put(Btoi(Txn.application_args[2])),
                Return(Int(1)),
            ]
        )


if __name__ == "__main__":
    params = {
        "fee_bps": 30,
        "type": ExchangeType.ALGOS_TO_ASA,
        "muldiv_app_id": 10
    }

    # Overwrite params if sys.argv[1] is passed
    if len(sys.argv) > 1:
        params = parse_args(sys.argv[1], params)
        # perform validation of arguments
        if params["type"] != ExchangeType.ASA_TO_ASA and params["type"] != ExchangeType.ALGOS_TO_ASA:
            raise ValueError(
                f"Contract 'type' must be either '{ExchangeType.ASA_TO_ASA}' or '{ExchangeType.ALGOS_TO_ASA}'"
            )
        if params["fee_bps"] > 1000 or params["fee_bps"] < 1:
            raise ValueError(
                f"Fee must be in range 1-1000 BPS"
            )

    if params["type"] == ExchangeType.ALGOS_TO_ASA:
        print(
            compileTeal(
                AlgosToAsaContract(
                    int(params["fee_bps"]),
                    int(params["muldiv_app_id"]),
                ).get_contract(),
                Mode.Application,
                version=3,
            )
        )
    elif params["type"] == ExchangeType.ASA_TO_ASA:
        print(
            compileTeal(
                AsaToAsaContract(
                    int(params["fee_bps"]),
                    int(params["muldiv_app_id"]),
                ).get_contract(),
                Mode.Application,
                version=3,
            )
        )
