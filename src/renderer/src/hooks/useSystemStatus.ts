import { useState, useEffect } from 'react'
import { electronService } from '../services/electronService'
import type { SystemStatus } from '../types'

export function useSystemStatus(): { status: SystemStatus; loading: boolean } {
  const [status, setStatus] = useState<SystemStatus>({
    ready: false,
    message: 'Инициализация системы...'
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function checkSystem(): Promise<void> {
      try {
        const [pingRes, sysInfo] = await Promise.all([
          electronService.ping(),
          electronService.getSystemInfo()
        ])

        if (isMounted) {
          setStatus({
            ready: pingRes === 'pong' || Boolean(pingRes),
            message: 'Система готова',
            platform: sysInfo.platform,
            arch: sysInfo.arch,
            nodeVersion: sysInfo.nodeVersion,
            electronVersion: sysInfo.electronVersion,
            chromeVersion: sysInfo.chromeVersion
          })
          setLoading(false)
        }
      } catch (error) {
        if (isMounted) {
          setStatus({
            ready: false,
            message: error instanceof Error ? error.message : 'Сбой инициализации системы'
          })
          setLoading(false)
        }
      }
    }

    checkSystem()

    return () => {
      isMounted = false
    }
  }, [])

  return { status, loading }
}
