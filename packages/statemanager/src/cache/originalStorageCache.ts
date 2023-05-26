import { bytesToHex } from '@ethereumjs/util'

import type { Address } from '@ethereumjs/util'

type getContractStorage = (address: Address, key: Uint8Array) => Promise<Uint8Array>

export class OriginalStorageCache {
  private map: Map<string, Map<string, Uint8Array>>
  private getContractStorage: getContractStorage
  constructor(getContractStorage: getContractStorage) {
    this.map = new Map()
    this.getContractStorage = getContractStorage
  }

  async getOriginalContractStorage(address: Address, key: Uint8Array): Promise<Uint8Array> {
    const addressHex = bytesToHex(address.bytes)
    const map = this.map.get(addressHex)
    if (map !== undefined) {
      const keyHex = bytesToHex(key)
      const value = map.get(keyHex)
      if (value !== undefined) {
        return value
      }
    }
    const value = await this.getContractStorage(address, key)
    this.putOriginalContractStorage(address, key, value)
    return value
  }

  putOriginalContractStorage(address: Address, key: Uint8Array, value: Uint8Array) {
    const addressHex = bytesToHex(address.bytes)
    let map = this.map.get(addressHex)
    if (map === undefined) {
      map = new Map()
      this.map.set(addressHex, map)
    }
    const keyHex = bytesToHex(key)
    if (map!.has(keyHex) === false) {
      map!.set(keyHex, value)
    }
  }

  clearOriginalStorageCache(): void {
    this.map = new Map()
  }
}
