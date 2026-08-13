import type { Context, Middleware } from './types.js'

export async function runMiddlewareChain(chain: Middleware[], ctx: Context, final: () => Promise<void>): Promise<void> {
  let index = -1

  const dispatchNext = async (i: number): Promise<void> => {
    if (i <= index) throw new Error('next() called multiple times')
    index = i
    if (i === chain.length) {
      await final()
      return
    }
    await chain[i](ctx, () => dispatchNext(i + 1))
  }

  await dispatchNext(0)
}
