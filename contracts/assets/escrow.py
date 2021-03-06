import sys

from pyteal import *

from helpers.parse import parse_args


def escrow(app_id: int):
    on_asset_opt_in = Seq(
        [
            Assert(
                And(
                    Gtxn[1].close_remainder_to() == Global.zero_address(),
                    Gtxn[1].rekey_to() == Global.zero_address(),
                    Gtxn[0].application_id() == Int(app_id),
                    Gtxn[0].type_enum() == TxnType.ApplicationCall,
                    Gtxn[0].application_args[0] == Bytes("E"),
                    Gtxn[1].type_enum() == TxnType.AssetTransfer,
                    Gtxn[1].asset_amount() == Int(0),
                )
            ),
            Return(Int(1)),
        ]
    )

    on_withdraw = Seq(
        [
            Assert(
                And(
                    Gtxn[1].close_remainder_to() == Global.zero_address(),
                    Gtxn[1].rekey_to() == Global.zero_address(),
                    Gtxn[2].close_remainder_to() == Global.zero_address(),
                    Gtxn[2].rekey_to() == Global.zero_address(),
                    Gtxn[0].application_id() == Int(app_id),
                    Gtxn[0].type_enum() == TxnType.ApplicationCall,
                    Gtxn[0].application_args[0] == Bytes("W"),
                    Gtxn[1].type_enum() == TxnType.AssetTransfer,
                    Or(
                        Gtxn[2].type_enum() == TxnType.Payment,
                        Gtxn[2].type_enum() == TxnType.AssetTransfer,
                    ),
                    Or(
                        Gtxn[1].asset_amount() > Int(0),
                        Gtxn[2].amount() > Int(0),
                        Gtxn[2].asset_amount() > Int(0),
                    ),
                    Gtxn[3].sender() == Gtxn[0].sender(),
                    Gtxn[3].type_enum() == TxnType.Payment,
                    Gtxn[3].amount() >= (Gtxn[1].fee() + Gtxn[2].fee()),
                )
            ),
            Return(Int(1)),
        ]
    )

    on_withdraw_liquidity = Seq(
        [
            Assert(
                And(
                    Gtxn[0].type_enum() == TxnType.ApplicationCall,
                    Gtxn[1].close_remainder_to() == Global.zero_address(),
                    Gtxn[1].rekey_to() == Global.zero_address(),
                    Gtxn[0].application_id() == Int(app_id),
                    Gtxn[0].type_enum() == TxnType.ApplicationCall,
                    Gtxn[0].application_args[0] == Bytes("X"),
                    Gtxn[1].type_enum() == TxnType.AssetTransfer,
                    Gtxn[1].asset_amount() > Int(0),
                    Gtxn[2].sender() == Gtxn[0].sender(),
                    Gtxn[2].type_enum() == TxnType.Payment,
                    Gtxn[2].amount() >= Gtxn[1].fee(),
                )
            ),
            Return(Int(1)),
        ]
    )

    return Cond(
        [Global.group_size() == Int(2), on_asset_opt_in],
        [Global.group_size() == Int(4), on_withdraw],
        [Global.group_size() == Int(3), on_withdraw_liquidity],
    )


if __name__ == "__main__":
    params = {"app_id": 123}

    # Overwrite params if sys.argv[1] is passed
    if len(sys.argv) > 1:
        params = parse_args(sys.argv[1], params)

    print(
        compileTeal(
            escrow(
                int(params["app_id"]),
            ),
            Mode.Signature,
        )
    )
