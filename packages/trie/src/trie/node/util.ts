import { RLP } from '@ethereumjs/rlp'
import debug from 'debug'

import { removeHexPrefix } from '../../util/hex'
import { bytesToNibbles } from '../../util/nibbles'

import { BranchNode, ExtensionNode, LeafNode, NullNode } from '.'

import type { TNode } from './types'
import type { Debugger } from 'debug'
import { NodeType } from './types'

export function getNodeType(encoded: Uint8Array): NodeType {
  const raw = RLP.decode(encoded as Uint8Array) as (Uint8Array | Uint8Array[])[]
  console.log(`raw (${raw.length}): ${raw.map((r) => r)}`)
  if (raw[1]) {
    console.log(`raw (${raw[1].length})`)
    for (const [idx, r] of raw[1].entries()) {
      console.log(`raw[1][${idx}]: (${r})`)
    }
  }
  const type =
    raw.length === 32
      ? 'ProofNode'
      : raw.length === 17
      ? 'BranchNode'
      : raw.length === 2 && (raw[1] as Uint8Array).length === 32
      ? 'ExtensionNode'
      : raw.length === 2
      ? 'LeafNode'
      : 'NullNode'
  if (!type) {
    throw new Error(`Unknown node type with ${encoded.length} parts: ${type}`)
  }
  return type
}
export async function decodeToNode(
  encoded: Uint8Array,
  d_bug: Debugger = debug('Trie:decodeToNode')
): Promise<TNode> {
  if (encoded.length === 0) {
    d_bug(`node=NullNode`)
    return new NullNode({})
  } else {
    const raw = RLP.decode(encoded) as Uint8Array[]
    const type = getNodeType(encoded)
    d_bug = d_bug.extend(type)
    switch (type) {
      case 'LeafNode': {
        const [encodedkey, value] = raw
        const decodedkey = bytesToNibbles(encodedkey as Uint8Array)
        const key = removeHexPrefix(decodedkey)
        d_bug.extend('LeafNode')(`key=${key}, value=${value}`)
        return new LeafNode({
          key,
          value: value as Uint8Array,
        })
      }
      case 'BranchNode': {
        const value = raw[16] as Uint8Array
        d_bug.extend('BranchNode')(`value=${value}`)
        const children: TNode[] = []
        for (let i = 0; i < raw.length - 1; i++) {
          const branch = raw[i] as Uint8Array
          if (branch.length > 0) {
            try {
              const node = await decodeToNode(RLP.encode(branch), d_bug)
              d_bug.extend(`branch[${branch}]`)(`decoded into ${node.getType()}`)
              children.push(node)
            } catch {
              d_bug(`can't decode branch[${i}]=${branch}`)
            }
          }
        }
        const decoded = new BranchNode({
          children,
          value,
        })

        return decoded
      }
      case 'ExtensionNode': {
        const [key, subNodeRlp] = raw
        const subNode = await decodeToNode(subNodeRlp as Uint8Array, d_bug)
        d_bug.extend('ExtensionNode')(
          `decoded with keyNibbles=${key} and child=${subNode.getType()}`
        )
        return new ExtensionNode({ keyNibbles: bytesToNibbles(key as Uint8Array), subNode })
      }
      case 'NullNode': {
        return new NullNode({})
      }
      default:
        throw new Error(`Unknown node type: ${type}`)
    }
  }
}

// export function decodeRawNode(raw: Uint8Array[]) {
//   if (raw.length === 17) {
//     return BranchNode.fromArray(raw)
//   } else if (raw.length === 2) {
//     const nibbles = bytesToNibbles(raw[0])
//     if (isTerminator(nibbles)) {
//       return new LeafNode(LeafNode.decodeKey(nibbles), raw[1])
//     }
//     return new ExtensionNode(ExtensionNode.decodeKey(nibbles), raw[1])
//   } else {
//     throw new Error('Invalid node')
//   }
// }

// export function decodeNode(raw: Uint8Array) {
//   const des = RLP.decode(Uint8Array.from(raw)) as Uint8Array[]
//   if (!Array.isArray(des)) {
//     throw new Error('Invalid node')
//   }
//   return decodeRawNode(des)
// }

// export function isRawNode(n: any) {
//   return Array.isArray(n) && !(n instanceof Uint8Array)
// }
