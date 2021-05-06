from pyteal import *

def make_step(options: "CompileOptions", op, *args):
    if op == Op.store:
        return args[0].store().__teal__(options)
    elif op == Op.load:
        return args[0].load().__teal__(options)
    else:
        return TealBlock.FromOp(options, TealOp(expr=None, op=op), *args)

def make_teal(options: "CompileOptions", make_steps):
    cmds = make_steps()
    steps = map(lambda args: make_step(options, *args), cmds)
    start, end = next(steps)
    for step in steps:
        end.setNextBlock(step[0])
        end = step[1]
    return start, end

class mulw_divw4(Expr):
    def __init__(self, m1, m2, d, iters):
        assert iters > 1
        self.outputType = TealType.uint64
        self.m1 = m1
        self.m2 = m2
        self.d = d
        self.iters = iters
    def __teal__(self, options: "CompileOptions"):
        def steps():
            A = ScratchSlot()
            MF = ScratchSlot()
            M = ScratchSlot()

            for iter in range(self.iters):
                lastIter = iter == self.iters - 1
                if iter:
                    yield Op.mulw,
                else:
                    yield Op.mulw, self.m1, self.m2

                yield Op.dup2,
                yield Op.pop,
                yield Op.addw,
                yield Op.dup2,
                yield Op.pop,
                yield Op.add,

                if iter:
                    yield Op.load, M
                    yield Op.addw,
                    yield Op.dup2,
                    yield Op.pop,
                    yield Op.add,

                    if lastIter:
                        yield Op.load, A
                        yield Op.div,

                    yield Op.store, M
                    yield Op.add,
                else:
                    yield Op.store, M

                yield Op.add,
                yield Op.dup,

                if iter:
                    yield Op.load, MF
                else:
                    yield Op.bitwise_not, Int(0)
                    yield Op.dup, self.d
                    yield Op.store, A
                    yield Op.mod,
                    yield Op.dup,
                    yield Op.store, MF

            yield Op.mul,
            yield Op.load, A
            yield Op.div,
            for iter in range(self.iters):
                yield Op.add,
            yield Op.bitwise_not, Int(0)
            yield Op.load, A
            yield Op.div,
            yield Op.mul,
            yield Op.load, M
            yield Op.add,

        return make_teal(options, steps)

    def __str__(self):
        return "(mulw_divw {} {} {})".format(self.m1, self.m2, self.d)

    def type_of(self):
        return self.outputType


def mulw_divw(m1, m2, d):
    return mulw_divw4(m1, m2, d, 29)
