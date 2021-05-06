# pylint: disable=unused-wildcard-import
from pyteal import *
# pylint: disable=import-error
from helpers.state import GlobalState, get_global_state_ex
from helpers.calc import mulw_divw

class MulDiv64:
    def __init__(self):
        # foreign_id = 1 means the first foreign app
        # the external variables must be evaluated, before calling .value() on them
        self.total_liquidity_tokens = get_global_state_ex(1, "L")  # type: MaybeValue
        self.a_balance = get_global_state_ex(1, "A")  # type: MaybeValue
        self.b_balance = get_global_state_ex(1, "B")  # type: MaybeValue
        self.multiplier1 = ScratchSlot()
        self.multiplier2 = ScratchSlot()
        self.divisor = ScratchSlot()

    def get_contract(self):
        """
        Returned stateful smart contract is meant to be used together with the main stateful contract in a Tx group.
        This contract allows to make an expensive calculation of m1*m2/d without overflow and losing precision (up to 62 bits).

        The contract call transaction needs to supply the main stateful contract in Txn.ForeignApps.
        The contract expects two arguments:
            [0] - calculation mode (described below)
            [1] - destination for calculation (1 or 2)
        The results of the calculation are stored in the global state "1" or "2".

        The performed calculations are described below:
        X: a/A * LT (calculate received amount of liquidity tokens when adding liquidity)
        Y: lt'/LT * B (calculate necessary amount of b token when adding liquidity, lt' comes from "X" calculation)
        1: B/(A+a) * a (calculate the amount of secondary token when swapping primary token)
        2: A/(B+b) * b (calculate the amount of primary token when swapping secondary token)
        A: lt/LT * A (calculate the amount of primary token user should receive when removing liquidity)
        B: lt/LT * B (calculate the amount of secondary token user should receive when removing liquidity)

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
        return If(
            Txn.application_id() == Int(0),
            Return(Int(1)), # The app is being created, nothing to be done
            Seq([ # The app is set up, run its primary function
                Assert(
                    And(
                        Txn.on_completion() == OnComplete.NoOp,
                        Txn.rekey_to() == Global.zero_address(),
                        Txn.application_args.length() == Int(2),
                        Txn.applications.length() == Int(1),  # Foreign applications count
                    )
                ),
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
                    [operation_mode == Bytes("X"), self.setup_liquidity_calculation()], # may terminate execution
                    [operation_mode == Bytes("Y"), self.setup_required_b_calculation()], # may terminate execution
                    [operation_mode == Bytes("A"), self.setup_liquidate_a_calculation()],
                    [operation_mode == Bytes("B"), self.setup_liquidate_b_calculation()],
                    [operation_mode == Bytes("1"), self.setup_swap_a_calculation()],
                    [operation_mode == Bytes("2"), self.setup_swap_b_calculation()],
                    [Int(1), Err()]
                ),
                # store the result in requested slot
                App.globalPut(result_destination, self.calculate()),
                Return(Int(1)), # Execution should always succeed
            ])
        )
    
    def initialize_external_globals(self) -> Expr:
        """
        MaybeValues need to be evaluated before use.
        Reference:
        https://pyteal.readthedocs.io/en/stable/state.html#external-global
        """
        return Seq([
            # evaluate external state so that they can be used
            self.total_liquidity_tokens,
            self.a_balance,
            self.b_balance,
        ])

    def calculate(self) -> Expr:
        """
        Precisely calculate multiplication and then division of three uint64 variables.
        Returns:
            PyTEAL Expr which calculates (multiplier1 * multiplier2) / divisor
        """
        return mulw_divw(self.multiplier1.load(), self.multiplier2.load(), self.divisor.load())

    def get_transferred_value(self, incoming_txn: TxnObject) -> Expr:
        """
        Get transferred value from incoming transaction.
        If the transaction type is asset transfer, then the returned expression
        will fetch the asset amount, otherwise fetches the amount of transferred Algos.
        Returns:
            Expression which should evaluate to transferred value (either ASAs or Algos)
        """
        return If(
            incoming_txn.type_enum() == TxnType.AssetTransfer,
            incoming_txn.asset_amount(),
            incoming_txn.amount(),
        )

    def setup_liquidity_calculation(self) -> Expr:
        """
        Setup calculation for the amount of received liquidity tokens. (a/A * LT)
        """
        return Seq([
            # return when there aren't any tokens (it's the first liquidity provision)
            If(
                self.total_liquidity_tokens.value() == Int(0), 
                Return(Int(1))
            ),
            self.multiplier1.store(self.get_transferred_value(Gtxn[3])),  # a
            self.multiplier2.store(self.total_liquidity_tokens.value()),  # LT
            self.divisor.store(self.a_balance.value()),  # A
        ])

    def setup_required_b_calculation(self) -> Expr:
        """
        Setup calculation for the amount of required secondary tokens for adding liquidity. (lt'/LT * B)
        """
        return Seq([
            # return when there aren't any tokens (it's the first liquidity provision)
            If(
                self.total_liquidity_tokens.value() == Int(0), 
                Return(Int(1))
            ),
            # lt' should be calculated in the previous execution of this contract
            self.multiplier1.store(App.globalGet(Bytes("1"))),  # lt'
            self.multiplier2.store(self.b_balance.value()),  # B
            self.divisor.store(self.total_liquidity_tokens.value()),  # LT
        ])

    def setup_swap_a_calculation(self) -> Expr:
        """
        Setup calculation for swapping primary asset to secondary asset. (B/(A+a) * a)
        """
        transferred_amount = ScratchSlot()
        return Seq([
            transferred_amount.store(self.get_transferred_value(Gtxn[2])),
            self.multiplier1.store(transferred_amount.load()),  # a
            self.multiplier2.store(self.b_balance.value()),  # B
            self.divisor.store(self.a_balance.value() + transferred_amount.load()),  # A + a
        ])

    def setup_swap_b_calculation(self) -> Expr:
        """
        Setup calculation for swapping secondary asset to primary asset. (A/(B+b) * b)
        """
        transferred_amount = ScratchSlot()
        return Seq([
            transferred_amount.store(self.get_transferred_value(Gtxn[2])),
            self.multiplier1.store(transferred_amount.load()),  # b
            self.multiplier2.store(self.a_balance.value()),  # A
            self.divisor.store(self.b_balance.value() + transferred_amount.load()),  # B + b
        ])
        
    def setup_liquidate_a_calculation(self) -> Expr:
        """
        Setup calculation of received primary token after removing liquidity. (lt/LT * A)
        """
        return Seq([
            # amount of liquidity to remove passed as an argument to main stateful contract
            self.multiplier1.store(Btoi(Gtxn[2].application_args[1])),  # lt
            self.multiplier2.store(self.a_balance.value()),  # A
            self.divisor.store(self.total_liquidity_tokens.value()),  # LT
        ])

    def setup_liquidate_b_calculation(self) -> Expr:
        """
        Setup calculation of received secondary token after removing liquidity. (lt/LT * B)
        """
        return Seq([
            # amount of liquidity to remove passed as an argument to main stateful contract
            self.multiplier1.store(Btoi(Gtxn[2].application_args[1])),  # lt
            self.multiplier2.store(self.b_balance.value()),  # B
            self.divisor.store(self.total_liquidity_tokens.value()),  # LT
        ])

if __name__ == "__main__":
    print(compileTeal(MulDiv64().get_contract(), Mode.Application, version=3))
