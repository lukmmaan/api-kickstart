import { describe, expect, it } from 'vitest'
import { memoryBroker } from './index.js'

describe('memoryBroker', () => {
  it('records every published message', async () => {
    const broker = memoryBroker({ deliverOnPublish: false })
    await broker.publish('orders.created', { id: 1 })
    await broker.publish('orders.created', { id: 2 })
    expect(broker.published).toEqual([
      { topic: 'orders.created', message: { id: 1 } },
      { topic: 'orders.created', message: { id: 2 } },
    ])
  })

  it('delivers to a registered consumer synchronously by default', async () => {
    const broker = memoryBroker()
    const received: unknown[] = []
    broker.consume?.({ topic: 'orders.created', onMessage: async (message) => { received.push(message) } })
    await broker.publish('orders.created', { id: 42 })
    expect(received).toEqual([{ id: 42 }])
  })

  it('does not deliver when deliverOnPublish is false', async () => {
    const broker = memoryBroker({ deliverOnPublish: false })
    const received: unknown[] = []
    broker.consume?.({ topic: 'orders.created', onMessage: async (message) => { received.push(message) } })
    await broker.publish('orders.created', { id: 42 })
    expect(received).toEqual([])
  })

  it('only delivers to consumers subscribed to the matching topic', async () => {
    const broker = memoryBroker()
    const ordersReceived: unknown[] = []
    const usersReceived: unknown[] = []
    broker.consume?.({ topic: 'orders.created', onMessage: async (m) => { ordersReceived.push(m) } })
    broker.consume?.({ topic: 'users.created', onMessage: async (m) => { usersReceived.push(m) } })
    await broker.publish('orders.created', { id: 1 })
    expect(ordersReceived).toEqual([{ id: 1 }])
    expect(usersReceived).toEqual([])
  })

  it('supports multiple consumers on the same topic', async () => {
    const broker = memoryBroker()
    let countA = 0
    let countB = 0
    broker.consume?.({ topic: 'orders.created', onMessage: async () => { countA += 1 } })
    broker.consume?.({ topic: 'orders.created', onMessage: async () => { countB += 1 } })
    await broker.publish('orders.created', {})
    expect(countA).toBe(1)
    expect(countB).toBe(1)
  })

  it('clears registered consumers on close', async () => {
    const broker = memoryBroker()
    const received: unknown[] = []
    broker.consume?.({ topic: 'orders.created', onMessage: async (m) => { received.push(m) } })
    await broker.close?.()
    await broker.publish('orders.created', {})
    expect(received).toEqual([])
  })
})
