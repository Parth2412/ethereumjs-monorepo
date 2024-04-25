import { Chain, Common, Hardfork } from '@ethereumjs/common'
import {
  CLRequest,
  KECCAK256_RLP,
  bytesToBigInt,
  bytesToHex,
  concatBytes,
  hexToBytes,
  randomBytes,
} from '@ethereumjs/util'
import { assert, describe, it } from 'vitest'

import { Block } from '../src/index.js'

import type { CLRequestType } from '@ethereumjs/util'

class NumberRequest extends CLRequest implements CLRequestType<NumberRequest> {
  constructor(type: number, bytes: Uint8Array) {
    super(type, bytes)
  }

  public static fromRequestData(bytes: Uint8Array): CLRequestType<NumberRequest> {
    return new NumberRequest(0x1, bytes)
  }
  public greaterThan(a: NumberRequest): boolean {
    return bytesToBigInt(a.bytes) < bytesToBigInt(this.bytes)
  }

  serialize() {
    return concatBytes(Uint8Array.from([this.type]), this.bytes)
  }
}

const common = new Common({ chain: Chain.Mainnet, hardfork: Hardfork.Shanghai, eips: [7685] })
describe('7685 tests', () => {
  it('should instantiate block with defaults', () => {
    const block = Block.fromBlockData({}, { common })
    assert.deepEqual(block.header.requestsRoot, KECCAK256_RLP)
    const block2 = new Block(undefined, undefined, undefined, undefined, { common })
    assert.deepEqual(block.header.requestsRoot, KECCAK256_RLP)
    assert.equal(block2.requests?.length, 0)
  })
  it('should instantiate a block with requests', async () => {
    const request = new NumberRequest(0x1, randomBytes(32))
    const requestsRoot = await Block.genRequestsTrieRoot([request])
    const block = Block.fromBlockData(
      {
        requests: [request],
        header: { requestsRoot },
      },
      { common }
    )
    assert.equal(block.requests?.length, 1)
    assert.deepEqual(block.header.requestsRoot, requestsRoot)
  })
  it('RequestsRootIsValid should return false when requestsRoot is invalid', async () => {
    const request = new NumberRequest(0x1, randomBytes(32))
    const block = Block.fromBlockData(
      {
        requests: [request],
        header: { requestsRoot: randomBytes(32) },
      },
      { common }
    )

    assert.equal(await block.requestsTrieIsValid(), false)
  })
  it('should order requests correctly in block', async () => {
    const request1 = new NumberRequest(0x1, hexToBytes('0x1234'))
    const request2 = new NumberRequest(0x1, hexToBytes('0x2345'))
    const requests = [request1, request2]
    const requestsRoot = await Block.genRequestsTrieRoot(requests)
    const block = Block.fromBlockData(
      {
        requests: [request2, request1],
        header: { requestsRoot },
      },
      { common }
    )
    assert.equal(block.requests![0].type, 0x1)
    assert.equal(bytesToHex(block.requests![1].bytes), '0x2345')
  })
})
