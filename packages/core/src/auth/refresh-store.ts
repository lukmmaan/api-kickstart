export interface RefreshRecord {
  jti: string
  familyId: string
  userId: string
  used: boolean
}

export interface RefreshStore {
  save(record: RefreshRecord): Promise<void>
  get(jti: string): Promise<RefreshRecord | null>
  markUsed(jti: string): Promise<void>
  revokeFamily(familyId: string): Promise<void>
  isRevokedFamily(familyId: string): Promise<boolean>
}

export function memoryRefreshStore(): RefreshStore {
  const records = new Map<string, RefreshRecord>()
  const revokedFamilies = new Set<string>()

  return {
    async save(record) {
      records.set(record.jti, record)
    },
    async get(jti) {
      return records.get(jti) ?? null
    },
    async markUsed(jti) {
      const record = records.get(jti)
      if (record) record.used = true
    },
    async revokeFamily(familyId) {
      revokedFamilies.add(familyId)
    },
    async isRevokedFamily(familyId) {
      return revokedFamilies.has(familyId)
    },
  }
}
