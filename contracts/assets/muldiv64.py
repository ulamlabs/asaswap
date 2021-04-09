# pylint: disable=unused-wildcard-import
from pyteal import *
# pylint: disable=import-error
from helpers.state import GlobalState, GlobalStateEx

class MulDiv64:
    def __init__(self):
        # foreign_id = 1 means the first foreign app
        # the external variables must be evaluated, before calling .value() on them
        self.total_liquidity_tokens = GlobalStateEx(1, "L").getEx()  # type: MaybeValue
        self.a_balance = GlobalStateEx(1, "A").getEx()  # type: MaybeValue
        self.b_balance = GlobalStateEx(1, "B").getEx()  # type: MaybeValue
        self.guard_app_ID = GlobalState("G")
        self.multiplier1 = ScratchSlot()
        self.multiplier2 = ScratchSlot()
        self.divisor = ScratchSlot()

    def get_contract(self):
        """
        Returned stateful smart contract is meant to be used together with the main stateful contract in a Tx group.
        This contract allows to make an expensive calculation of m1*m2/d without overflow and losing precision (up to 62 bits).

        The contract call transaction needs to supply the main stateful contract in Txn.ForeignApps.
        The contract expects two arguments:
            [0] - calculation mode (L, A, B)
            [1] - destination for calculation (1 or 2)
        The results of the calculation are stored in the global state "1" or "2".

        The performed calculations are described below:
        L: a/A * LT (calculate received amount of liquidity tokens when adding liquidity)
        SA: B/A * a (calculate the amount of secondary token when swapping primary token)
        SB: A/B * b (calculate the amount of primary token when swapping secondary token)
        a: lt/LT * A (calculate the amount of primary token user should receive when removing liquidity)
        b: lt/LT * B (calculate the amount of secondary token user should receive when removing liquidity)

        Variables are:
        a - amount of primary tokens deposited to escrow
        b - amount of secondary tokens deposited to escrow
        lt - amount of liquidity tokens user requested to remove
        A - total amount of primary token in the pool
        B - total amount of secondary token in the pool
        LT - total amount of liquidity token distributed
        """
        operation_mode = Txn.application_args[0]
        result_destination = Txn.application_args[1]
        return Cond(
            [
                Txn.application_id() == Int(0), 
                self.on_create()
            ],
            [
                Txn.on_completion() == OnComplete.OptIn,
                Return(Int(1))
            ],
            [
                Int(1),  # Default case
                Seq([ # The app is set up, run its primary function
                    # make sure that the guard is part of the TX group
                    Assert(self.guard_app_ID.get() == Gtxn[0].application_id()),
                    # make sure the stored result will be in either of these 2 slots
                    Assert(  
                        Or(
                            result_destination == Bytes("1"),
                            result_destination == Bytes("2"),
                        )
                    ),
                    self.initialize_external_globals(),
                    # setup calculations based on the 0th argument
                    Cond(
                        [operation_mode == Bytes("L"), self.setup_liquidity_calculation()],
                        [operation_mode == Bytes("SA"), self.setup_swap_a_calculation()],
                        [operation_mode == Bytes("SB"), self.setup_swap_b_calculation()],
                        [operation_mode == Bytes("a"), self.setup_liquidate_a_calculation()],
                        [operation_mode == Bytes("b"), self.setup_liquidate_b_calculation()]
                    ),
                    # store the result in requested slot
                    App.globalPut(result_destination, self.calculate()),
                    Return(Int(1)),
                ])
            ],
        )

    def on_create(self) -> Seq:
        return Seq(
            [
                self.guard_app_ID.put(Txn.application_args[0]),
                Return(Int(1)),
            ]
        )
    
    def initialize_external_globals(self) -> Expr:
        """
        MaybeValues need to be evaluated before use.
        Reference:
        https://pyteal.readthedocs.io/en/stable/state.html#external-global
        """
        return Seq([
            # evaluate external state so that it can be used
            self.total_liquidity_tokens,
            self.a_balance,
            self.b_balance,
            # make sure the global state vars are available
            Assert(self.total_liquidity_tokens.hasValue()),
            Assert(self.a_balance.hasValue()),
            Assert(self.b_balance.hasValue()),
        ])

    def calculate(self) -> Expr:
        """
        Precisely calculate multiplication and then division of three uint64 variables.
        Returns:
            PyTEAL Expr which calculates (multiplier1 * multiplier2) / divisor
        """
        # TODO: Replace with actual calculation
        return self.multiplier1.load() * self.multiplier2.load() / self.divisor.load()

    def setup_liquidity_calculation(self) -> Expr:
        """
        Setup calculation for the amount of received liquidity tokens. (a/A * LT)
        """
        return Seq([
            self.multiplier1.store(Gtxn[2].asset_amount()),  # a
            self.multiplier2.store(self.total_liquidity_tokens.value()),  # LT
            self.divisor.store(self.a_balance.value()),  # A
        ])

    def setup_swap_a_calculation(self) -> Expr:
        """
        Setup calculation for swapping primary asset to secondary asset. (B/A * a)
        """
        return Seq([
            self.multiplier1.store(Gtxn[1].asset_amount()),  # a
            self.multiplier2.store(self.b_balance.value()),  # B
            self.divisor.store(self.a_balance.value()),  # A
        ])

    def setup_swap_b_calculation(self) -> Expr:
        """
        Setup calculation for swapping secondary asset to primary asset. (A/B * b)
        """
        return Seq([
            self.multiplier1.store(Gtxn[1].asset_amount()),  # b
            self.multiplier2.store(self.a_balance.value()),  # A
            self.divisor.store(self.b_balance.value()),  # B
        ])
        
    def setup_liquidate_a_calculation(self) -> Expr:
        """
        Setup calculation of received primary token after removing liquidity. (lt/LT * A)
        """
        return Seq([
            # amount of liquidity to remove passed as an argument to main stateful contract
            self.multiplier1.store(Gtxn[2].application_args[1]),  # lt
            self.multiplier2.store(self.a_balance.value()),  # A
            self.divisor.store(self.total_liquidity_tokens.value()),  # LT
        ])

    def setup_liquidate_b_calculation(self) -> Expr:
        """
        Setup calculation of received secondary token after removing liquidity. (lt/LT * B)
        """
        return Seq([
            # amount of liquidity to remove passed as an argument to main stateful contract
            self.multiplier1.store(Gtxn[2].application_args[1]),  # lt
            self.multiplier2.store(self.b_balance.value()),  # B
            self.divisor.store(self.total_liquidity_tokens.value()),  # LT
        ])

if __name__ == "__main__":
    print(compileTeal(MulDiv64().get_contract(), Mode.Application))
