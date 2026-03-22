/**
 * Repro: PayloadSDK.login + fetch GET /api/users/me with Bearer.
 * Needs `pnpm dev` (HTTP). Some concurrent responses: me 200 but user.email missing.
 */
import type { Config } from '@/payload-types'
import config from '@/payload.config'
import { PayloadSDK } from '@payloadcms/sdk'
import { getPayload } from 'payload'
import assert from 'node:assert'

import { beforeAll, describe, expect, it } from 'vitest'

const CMS_URL = 'http://localhost:3000/api'
const EMAIL = 'concurrent-login-repro@example.com'
const PASS = 'ConcurrentLoginRepro123!'

async function ensureTestUser() {
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const found = await payload.find({
    collection: 'users',
    limit: 1,
    where: { email: { equals: EMAIL } },
  })
  if (found.totalDocs === 0) {
    await payload.create({
      collection: 'users',
      data: { email: EMAIL, password: PASS },
    })
  }
}

async function cmsLogin(payload: PayloadSDK<Config>) {
  const { token } = await payload.login({
    collection: 'users',
    data: {
      email: EMAIL,
      password: PASS,
    },
  })

  const response = await fetch(`${CMS_URL}/users/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const data = (await response.json()) as { user?: { email?: string } }
  await new Promise((resolve) => setTimeout(resolve, 1000))
  console.log('me', response.status, 'email', data?.user?.email)

  assert(token, 'Failed to login to CMS')

  return data.user
}

describe('cmsLogin (PayloadSDK + Bearer /users/me)', () => {
  beforeAll(async () => {
    await ensureTestUser()
  })

  it('runs 10 concurrent logins', async () => {
    const payload = new PayloadSDK<Config>({
      baseURL: CMS_URL,
    })

    const users = await Promise.all(Array.from({ length: 10 }, () => cmsLogin(payload)))

    for (const user of users) {
      expect(user?.email).toBe(EMAIL)
    }
  }, 30_000)
})
